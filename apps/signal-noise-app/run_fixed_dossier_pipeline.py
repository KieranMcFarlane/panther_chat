#!/usr/bin/env python3
"""
Fixed Dossier-First Pipeline for Coventry City FC

Uses the WORKING EntityDossierGenerator instead of the failing UniversalDossierGenerator.
Based on the successful generate_coventry_dossier.py script.

Pipeline:
1. PHASE 1: Generate dossier (using EntityDossierGenerator)
2. PHASE 2: Run hypothesis-driven discovery (warm start)
3. PHASE 3: Calculate dashboard scores
4. PHASE 4: Enrich and save results
"""

import asyncio
import inspect
import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def _bool_env(value: str) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


class FixedDossierFirstPipeline:
    """Fixed pipeline using EntityDossierGenerator"""

    def __init__(self):
        from backend.claude_client import ClaudeClient
        from backend.brightdata_sdk_client import BrightDataSDKClient
        from backend.dossier_generator import EntityDossierGenerator
        from backend.hypothesis_driven_discovery import HypothesisDrivenDiscovery
        from backend.dashboard_scorer import DashboardScorer

        logger.info("🚀 Initializing Fixed Dossier-First Pipeline...")

        # Initialize clients
        self.claude = ClaudeClient()
        self.brightdata = BrightDataSDKClient()

        # Initialize components - use WORKING EntityDossierGenerator
        self.dossier_generator = EntityDossierGenerator(self.claude)
        self.discovery = HypothesisDrivenDiscovery(self.claude, self.brightdata)
        self.dashboard_scorer = DashboardScorer()
        self.schema_first_enabled = _bool_env(os.getenv("PIPELINE_SCHEMA_FIRST_ENABLED", "false"))
        self.schema_sweep_enabled = _bool_env(os.getenv("PIPELINE_SCHEMA_SWEEP_ENABLED", "false"))
        self.schema_first_output_dir = os.getenv("PIPELINE_SCHEMA_FIRST_OUTPUT_DIR", str(self.output_dir if hasattr(self, "output_dir") else "backend/data/dossiers"))
        self.schema_first_max_results = max(1, int(os.getenv("PIPELINE_SCHEMA_FIRST_MAX_RESULTS", "8")))
        self.schema_first_max_candidates_per_query = max(
            1,
            int(os.getenv("PIPELINE_SCHEMA_FIRST_MAX_CANDIDATES_PER_QUERY", "4")),
        )
        fields_env = str(os.getenv("PIPELINE_SCHEMA_FIRST_FIELDS", "") or "").strip()
        self.schema_first_fields = [f.strip() for f in fields_env.split(",") if f.strip()] if fields_env else None
        self.schema_first_result: Dict[str, Any] | None = None

        # Create output directory
        self.output_dir = Path("backend/data/dossiers")
        self.output_dir.mkdir(parents=True, exist_ok=True)

        logger.info("✅ Pipeline initialized")

    async def close(self) -> None:
        """Close pipeline-owned clients."""
        close_fn = getattr(self.brightdata, "close", None)
        if callable(close_fn):
            try:
                await close_fn()
            except Exception as close_error:  # noqa: BLE001
                logger.warning("⚠️ Failed to close BrightData client: %s", close_error)

    async def run_pipeline(
        self,
        entity_id: str,
        entity_name: str,
        entity_type: str = "CLUB",
        tier_score: int = 50,
        max_discovery_iterations: int = 15,
        template_id: str = "yellow_panther_agency"
    ) -> Dict[str, Any]:
        """Run the complete 4-phase dossier-first pipeline"""

        start_time = datetime.now(timezone.utc)

        logger.info("=" * 60)
        logger.info(f"🎯 DOSSIER-FIRST PIPELINE: {entity_name}")
        logger.info("=" * 60)

        if getattr(self, "schema_first_enabled", False):
            logger.info("\n🧭 PRE-PHASE: SCHEMA-FIRST")
            logger.info("-" * 60)
            try:
                self.schema_first_result = await self._run_schema_first_prepass(
                    entity_id=entity_id,
                    entity_name=entity_name,
                    entity_type=entity_type,
                )
                answered = sum(
                    1
                    for value in (self.schema_first_result or {}).get("fields", {}).values()
                    if isinstance(value, dict) and str(value.get("value") or "").strip()
                )
                logger.info("✅ Schema-first prepass complete (answered_fields=%s)", answered)
            except Exception as schema_error:  # noqa: BLE001
                logger.warning("⚠️ Schema-first prepass failed; continuing pipeline: %s", schema_error)
                self.schema_first_result = None
        self._seed_phase1_official_site(entity_name)

        # =========================================================================
        # PHASE 1: DOSSIER GENERATION (Using EntityDossierGenerator)
        # =========================================================================
        logger.info("\n📋 PHASE 1: DOSSIER GENERATION")
        logger.info("-" * 60)

        dossier = await self._phase_1_generate_dossier(
            entity_id=entity_id,
            entity_name=entity_name,
            entity_type=entity_type,
            tier_score=tier_score
        )
        self._merge_schema_first_into_dossier(dossier)

        # =========================================================================
        # PHASE 2: DISCOVERY (with dossier context)
        # =========================================================================
        logger.info("\n🔍 PHASE 2: DISCOVERY")
        logger.info("-" * 60)

        discovery_result = await self._phase_2_run_discovery(
            entity_id=entity_id,
            entity_name=entity_name,
            dossier=dossier,
            max_iterations=max_discovery_iterations,
            template_id=template_id,
            entity_type=entity_type,
        )

        # =========================================================================
        # PHASE 3: DASHBOARD SCORING
        # =========================================================================
        logger.info("\n📊 PHASE 3: DASHBOARD SCORING")
        logger.info("-" * 60)

        dashboard_scores = await self._phase_3_calculate_scores(
            entity_id=entity_id,
            entity_name=entity_name,
            dossier=dossier,
            discovery_result=discovery_result
        )

        # =========================================================================
        # PHASE 4: SAVE RESULTS
        # =========================================================================
        logger.info("\n💾 PHASE 4: SAVE RESULTS")
        logger.info("-" * 60)

        await self._save_results(entity_id, entity_name, dossier, discovery_result, dashboard_scores)

        # =========================================================================
        # SUMMARY
        # =========================================================================
        end_time = datetime.now(timezone.utc)
        total_time = (end_time - start_time).total_seconds()

        logger.info("\n" + "=" * 60)
        logger.info(f"✅ PIPELINE COMPLETE: {entity_name}")
        logger.info("=" * 60)
        logger.info(f"⏱️  Total time: {total_time:.1f} seconds")
        logger.info(f"📋 Dossier sections: {len(dossier.sections) if hasattr(dossier, 'sections') else 0}")
        logger.info(f"🔍 Discovery confidence: {discovery_result.final_confidence:.3f}")
        logger.info(f"📊 Maturity: {dashboard_scores['procurement_maturity']}/100")
        logger.info(f"📈 Probability: {dashboard_scores['active_probability']*100:.1f}%")
        logger.info(f"🎯 Readiness: {dashboard_scores['sales_readiness']}")
        logger.info("=" * 60)

        return {
            "entity_id": entity_id,
            "entity_name": entity_name,
            "total_time_seconds": round(total_time, 2),
            "dossier_sections": len(dossier.sections) if hasattr(dossier, 'sections') else 0,
            "discovery_confidence": discovery_result.final_confidence,
            "procurement_maturity": dashboard_scores['procurement_maturity'],
            "sales_readiness": dashboard_scores['sales_readiness']
        }

    async def _phase_1_generate_dossier(
        self,
        entity_id: str,
        entity_name: str,
        entity_type: str,
        tier_score: int
    ):
        """Phase 1: Generate dossier using WORKING EntityDossierGenerator"""
        logger.info(f"📋 Generating {tier_score}-priority dossier for {entity_name}")

        # Generate dossier
        dossier = await self.dossier_generator.generate_dossier(
            entity_id=entity_id,
            entity_name=entity_name,
            entity_type=entity_type,
            priority_score=tier_score
        )

        logger.info(f"✅ Dossier generated:")
        logger.info(f"   - Tier: {dossier.tier}")
        logger.info(f"   - Sections: {len(dossier.sections)}")
        logger.info(f"   - Cost: ${dossier.total_cost_usd:.6f}")
        logger.info(f"   - Time: {dossier.generation_time_seconds:.1f}s")

        # List sections
        for section in dossier.sections:
            logger.info(f"     • {section.id}: {section.title}")

        return dossier

    async def _phase_2_run_discovery(
        self,
        entity_id: str,
        entity_name: str,
        dossier: Any,
        max_iterations: int,
        template_id: str,
        entity_type: str | None = None,
    ):
        """Phase 2: Run discovery with dossier context"""

        logger.info(f"🔍 Running discovery (max {max_iterations} iterations, template: {template_id})")

        # Try with dossier context first, fall back to standard discovery
        try:
            dossier_payload = dossier.to_dict() if hasattr(dossier, 'to_dict') else {}
            known_official_site = None
            generator = getattr(self, "dossier_generator", None)
            getter = getattr(generator, "get_last_official_site_url", None)
            if callable(getter):
                try:
                    known_official_site = getter(entity_id)
                except Exception as seed_error:  # noqa: BLE001
                    logger.debug("Could not fetch seeded official site for %s: %s", entity_id, seed_error)
            if not known_official_site:
                known_official_site = self._lookup_official_site_from_recent_artifacts(entity_id)
            if not known_official_site:
                known_official_site = self._schema_first_official_site()

            if isinstance(known_official_site, str) and known_official_site.strip():
                metadata = dossier_payload.setdefault("metadata", {})
                if isinstance(metadata, dict):
                    metadata.setdefault("website", known_official_site)
                    canonical_sources = metadata.setdefault("canonical_sources", {})
                    if isinstance(canonical_sources, dict):
                        canonical_sources.setdefault("official_site", known_official_site)
                self.discovery.current_official_site_url = known_official_site

            context_kwargs = {
                "entity_id": entity_id,
                "entity_name": entity_name,
                "dossier": dossier_payload,
                "max_iterations": max_iterations,
            }
            context_method = self.discovery.run_discovery_with_dossier_context
            context_signature = inspect.signature(context_method)
            supports_kwargs = any(
                param.kind == inspect.Parameter.VAR_KEYWORD
                for param in context_signature.parameters.values()
            )
            if supports_kwargs or "template_id" in context_signature.parameters:
                context_kwargs["template_id"] = template_id
            if entity_type and (supports_kwargs or "entity_type" in context_signature.parameters):
                context_kwargs["entity_type"] = entity_type

            result = await context_method(**context_kwargs)
        except Exception as e:
            logger.warning(f"⚠️ Dossier-context discovery failed: {e}")
            logger.info("🔄 Falling back to standard discovery...")

            # Try standard discovery with template
            try:
                if entity_type:
                    self.discovery.current_entity_type = entity_type
                result = await self.discovery.run_discovery(
                    entity_id=entity_id,
                    entity_name=entity_name,
                    template_id=template_id,
                    max_iterations=max_iterations
                )
            except Exception as e2:
                logger.warning(f"⚠️ Standard discovery also failed: {e2}")
                # Create minimal discovery result
                from backend.hypothesis_driven_discovery import DiscoveryResult
                result = DiscoveryResult(
                    entity_id=entity_id,
                    entity_name=entity_name,
                    final_confidence=0.50,
                    confidence_band="EXPLORATORY",
                    is_actionable=False,
                    iterations_completed=0,
                    total_cost_usd=0.0,
                    hypotheses=[],
                    depth_stats={},
                    signals_discovered=[]
                )

        logger.info(f"✅ Discovery complete:")
        logger.info(f"   - Final confidence: {result.final_confidence:.3f}")
        logger.info(f"   - Iterations: {result.iterations_completed}")
        logger.info(f"   - Signals: {len(result.signals_discovered)}")

        return result

    async def _run_schema_first_prepass(
        self,
        *,
        entity_id: str,
        entity_name: str,
        entity_type: str,
    ) -> Dict[str, Any]:
        if getattr(self, "schema_sweep_enabled", False):
            from backend.schema_sweep_runner import run_schema_sweep

            runner = run_schema_sweep
        else:
            from backend.schema_first_pilot import run_schema_first_pilot

            runner = run_schema_first_pilot

        return await runner(
            entity_name=entity_name,
            entity_id=entity_id,
            entity_type=entity_type,
            output_dir=str(getattr(self, "schema_first_output_dir", self.output_dir)),
            max_results=int(getattr(self, "schema_first_max_results", 8)),
            max_candidates_per_query=int(getattr(self, "schema_first_max_candidates_per_query", 4)),
            field_names=getattr(self, "schema_first_fields", None),
        )

    def _schema_first_official_site(self) -> str | None:
        payload = getattr(self, "schema_first_result", None)
        if not isinstance(payload, dict):
            return None
        fields = payload.get("fields")
        if not isinstance(fields, dict):
            return None
        official = fields.get("official_site")
        if not isinstance(official, dict):
            return None
        return self._normalize_http_url(official.get("value"))

    def _merge_schema_first_into_dossier(self, dossier: Any) -> None:
        official_site = self._schema_first_official_site()
        if not official_site:
            return

        metadata: Dict[str, Any] | None = None
        if isinstance(dossier, dict):
            metadata = dossier.setdefault("metadata", {})
        elif hasattr(dossier, "metadata"):
            metadata = getattr(dossier, "metadata", None)
            if metadata is None:
                metadata = {}
                setattr(dossier, "metadata", metadata)
        if not isinstance(metadata, dict):
            return

        canonical_sources = metadata.setdefault("canonical_sources", {})
        if not isinstance(canonical_sources, dict):
            canonical_sources = {}
            metadata["canonical_sources"] = canonical_sources
        canonical_sources.setdefault("official_site", official_site)
        metadata.setdefault("schema_first", self.schema_first_result or {})

    def _seed_phase1_official_site(self, entity_name: str) -> None:
        official_site = self._schema_first_official_site()
        if not official_site:
            return
        seed_fn = getattr(getattr(self, "dossier_generator", None), "seed_official_site_url", None)
        if not callable(seed_fn):
            return
        seeded = seed_fn(entity_name, official_site)
        if seeded:
            logger.info("🎯 Seeded phase-1 official-site from schema-first: %s", seeded)

    def _lookup_official_site_from_recent_artifacts(self, entity_id: str) -> str | None:
        """Load the most recent official site URL from saved dossier artifacts."""
        output_dir = Path(getattr(self, "output_dir", "backend/data/dossiers"))
        if not output_dir.exists():
            return None

        pattern = f"{entity_id}_dossier_fixed_*.json"
        for dossier_path in sorted(output_dir.glob(pattern), reverse=True):
            try:
                payload = json.loads(dossier_path.read_text())
            except Exception:
                continue

            metadata = payload.get("metadata") if isinstance(payload, dict) else None
            canonical_sources = metadata.get("canonical_sources") if isinstance(metadata, dict) else None
            candidates = [
                canonical_sources.get("official_site") if isinstance(canonical_sources, dict) else None,
                metadata.get("website") if isinstance(metadata, dict) else None,
                payload.get("official_site_url") if isinstance(payload, dict) else None,
                payload.get("website") if isinstance(payload, dict) else None,
            ]
            for candidate in candidates:
                normalized = self._normalize_http_url(candidate)
                if normalized:
                    logger.info("♻️ Using official-site fallback from artifact: %s", normalized)
                    return normalized

        return None

    @staticmethod
    def _normalize_http_url(candidate: Any) -> str | None:
        if not isinstance(candidate, str):
            return None
        value = candidate.strip()
        if not value:
            return None
        if value.startswith(("http://", "https://")):
            return value.rstrip("/")
        if value.startswith("www.") or "." in value:
            return f"https://{value.lstrip('/').rstrip('/')}"
        return None

    async def _phase_3_calculate_scores(
        self,
        entity_id: str,
        entity_name: str,
        dossier: Any,
        discovery_result: Any
    ):
        """Phase 3: Calculate dashboard scores"""
        logger.info(f"📊 Calculating three-axis dashboard scores")

        scores = await self.dashboard_scorer.calculate_entity_scores(
            entity_id=entity_id,
            entity_name=entity_name,
            hypotheses=discovery_result.hypotheses if hasattr(discovery_result, 'hypotheses') else [],
            signals=discovery_result.signals_discovered if hasattr(discovery_result, 'signals_discovered') else [],
            episodes=None
        )

        logger.info(f"✅ Dashboard scores calculated:")
        logger.info(f"   - Procurement Maturity: {scores['procurement_maturity']}/100")
        logger.info(f"   - Active Probability: {scores['active_probability']*100:.1f}%")
        logger.info(f"   - Sales Readiness: {scores['sales_readiness']}")

        return scores

    async def _save_results(
        self,
        entity_id: str,
        entity_name: str,
        dossier: Any,
        discovery_result: Any,
        dashboard_scores: Dict[str, Any]
    ):
        """Save all results to files"""
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

        # Save dossier
        dossier_path = self.output_dir / f"{entity_id}_dossier_fixed_{timestamp}.json"
        with open(dossier_path, 'w') as f:
            json.dump(dossier.to_dict() if hasattr(dossier, 'to_dict') else dossier, f, indent=2, default=str)
        logger.info(f"💾 Dossier saved: {dossier_path}")

        # Save discovery
        discovery_path = self.output_dir / f"{entity_id}_discovery_fixed_{timestamp}.json"
        discovery_data = discovery_result.to_dict() if hasattr(discovery_result, 'to_dict') else {
            'entity_id': discovery_result.entity_id,
            'final_confidence': discovery_result.final_confidence,
            'iterations_completed': discovery_result.iterations_completed,
            'signals_discovered': discovery_result.signals_discovered
        }
        with open(discovery_path, 'w') as f:
            json.dump(discovery_data, f, indent=2, default=str)
        logger.info(f"💾 Discovery saved: {discovery_path}")

        # Save scores
        scores_path = self.output_dir / f"{entity_id}_scores_fixed_{timestamp}.json"
        with open(scores_path, 'w') as f:
            json.dump(dashboard_scores, f, indent=2, default=str)
        logger.info(f"💾 Scores saved: {scores_path}")


async def main():
    """Main entry point"""
    from dotenv import load_dotenv
    load_dotenv()

    # Verify environment
    required_vars = ['ANTHROPIC_AUTH_TOKEN', 'BRIGHTDATA_API_TOKEN']
    missing = [var for var in required_vars if not os.getenv(var)]
    if missing:
        logger.error(f"❌ Missing required environment variables: {', '.join(missing)}")
        return

    # Create and run pipeline
    pipeline = FixedDossierFirstPipeline()
    try:
        result = await pipeline.run_pipeline(
            entity_id="coventry-city-fc",
            entity_name="Coventry City FC",
            tier_score=75,  # PREMIUM tier for richer data
            max_discovery_iterations=15,
            template_id="yellow_panther_agency"  # Use working template
        )
    finally:
        await pipeline.close()

    print("\n" + "=" * 60)
    print("📋 PIPELINE SUMMARY")
    print("=" * 60)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
