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
import argparse
import inspect
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional

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
        self._runtime_import_guard = self._validate_runtime_imports()
        self._last_discovery_error_class: str | None = None
        self._last_discovery_error_message: str | None = None
        self._last_shadow_discovery_payload: Dict[str, Any] | None = None
        self._last_template_id: str | None = None
        self._last_max_iterations: int | None = None
        self._shadow_client = None
        self._shadow_discovery = None
        from backend.claude_client import ClaudeClient
        from backend.brightdata_sdk_client import BrightDataSDKClient
        from backend.dossier_generator import EntityDossierGenerator
        from backend.hypothesis_driven_discovery import HypothesisDrivenDiscovery
        from backend.dashboard_scorer import DashboardScorer
        from backend.pipeline_orchestrator import PipelineOrchestrator

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
        self._use_canonical_orchestrator = _bool_env(
            os.getenv("PIPELINE_USE_CANONICAL_ORCHESTRATOR", "true")
        )
        self.shadow_unbounded_enabled = _bool_env(
            os.getenv("PIPELINE_SHADOW_UNBOUNDED_ENABLED", "false")
        )
        self.shadow_unbounded_parallel = _bool_env(
            os.getenv("PIPELINE_SHADOW_UNBOUNDED_PARALLEL", "true")
        )
        self.shadow_unbounded_multiplier = max(
            1.0,
            float(os.getenv("PIPELINE_SHADOW_UNBOUNDED_ITERATION_MULTIPLIER", "3.0")),
        )
        self.shadow_unbounded_floor = max(
            1,
            int(os.getenv("PIPELINE_SHADOW_UNBOUNDED_MIN_ITERATIONS", "12")),
        )

        if _bool_env(os.getenv("PIPELINE_FORCE_BRIGHTDATA", "false")):
            os.environ["BRIGHTDATA_FORCE_ONLY"] = "true"
            os.environ.setdefault("BRIGHTDATA_GENEROUS_RETRY", "true")
            os.environ.setdefault("BRIGHTDATA_SEARCH_MAX_ATTEMPTS", "5")
            os.environ.setdefault("BRIGHTDATA_SCRAPE_MAX_ATTEMPTS", "5")
            os.environ.setdefault("BRIGHTDATA_REQUEST_MAX_ATTEMPTS", "5")
            logger.info("🔒 PIPELINE_FORCE_BRIGHTDATA enabled (BrightData-only + generous retries)")

        # Shadow mode currently runs via fixed runner path, not canonical orchestrator.
        if self.shadow_unbounded_enabled and self._use_canonical_orchestrator:
            self._use_canonical_orchestrator = False
            logger.info("🧪 PIPELINE_SHADOW_UNBOUNDED_ENABLED: using fixed runner (canonical orchestrator bypassed)")

        class _IdentityRalphValidator:
            async def validate_signals(self, raw_signals, _entity_id):
                return list(raw_signals or [])

        class _NoopGraphitiService:
            async def add_rfp_episode(self, _rfp_data):
                return {"episode_id": "noop-rfp"}

            async def add_discovery_episode(self, **_kwargs):
                return {"episode_id": "noop-discovery"}

            async def get_entity_timeline(self, _entity_id, limit=50):
                return []

        self.orchestrator = PipelineOrchestrator(
            dossier_generator=self.dossier_generator,
            discovery=self.discovery,
            ralph_validator=_IdentityRalphValidator(),
            graphiti_service=_NoopGraphitiService(),
            dashboard_scorer=self.dashboard_scorer,
        )

        # Create output directory
        self.output_dir = Path("backend/data/dossiers")
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.run_reports_dir = self.output_dir / "run_reports"
        self.run_reports_dir.mkdir(parents=True, exist_ok=True)

        logger.info("✅ Pipeline initialized")

    @staticmethod
    def _validate_runtime_imports() -> Dict[str, Any]:
        """
        Verify critical modules can be imported in current execution context.
        Produces a single actionable failure class for run reports.
        """
        try:
            from backend.pipeline_run_metadata import validate_runtime_imports
        except ImportError:
            from pipeline_run_metadata import validate_runtime_imports

        payload = validate_runtime_imports()
        missing = payload.get("missing") or []
        if missing:
            logger.warning(
                "⚠️ Runtime import guard failed (%s). Canonical mode is PYTHONPATH=backend python3 run_fixed_dossier_pipeline.py",
                ", ".join(missing),
            )
        return payload

    async def close(self) -> None:
        """Close pipeline-owned clients."""
        claude_close_fn = getattr(self.claude, "close", None)
        if callable(claude_close_fn):
            try:
                await claude_close_fn()
            except Exception as close_error:  # noqa: BLE001
                logger.warning("⚠️ Failed to close Claude client: %s", close_error)
        close_fn = getattr(self.brightdata, "close", None)
        if callable(close_fn):
            try:
                await close_fn()
            except Exception as close_error:  # noqa: BLE001
                logger.warning("⚠️ Failed to close BrightData client: %s", close_error)
        shadow_close_fn = getattr(getattr(self, "_shadow_client", None), "close", None)
        if callable(shadow_close_fn):
            try:
                await shadow_close_fn()
            except Exception as close_error:  # noqa: BLE001
                logger.warning("⚠️ Failed to close shadow BrightData client: %s", close_error)

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
        self._last_discovery_error_class = None
        self._last_discovery_error_message = None
        if getattr(self, "_use_canonical_orchestrator", False) and getattr(self, "orchestrator", None) is not None:
            return await self._run_pipeline_via_orchestrator(
                entity_id=entity_id,
                entity_name=entity_name,
                entity_type=entity_type,
                tier_score=tier_score,
            )

        start_time = datetime.now(timezone.utc)
        phase_timings_seconds: Dict[str, float] = {}

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

        phase_started = time.perf_counter()
        dossier = await self._phase_1_generate_dossier(
            entity_id=entity_id,
            entity_name=entity_name,
            entity_type=entity_type,
            tier_score=tier_score
        )
        phase_timings_seconds["phase_1_dossier_generation"] = round(time.perf_counter() - phase_started, 3)
        self._merge_schema_first_into_dossier(dossier)

        # =========================================================================
        # PHASE 2: DISCOVERY (with dossier context)
        # =========================================================================
        logger.info("\n🔍 PHASE 2: DISCOVERY")
        logger.info("-" * 60)

        phase_started = time.perf_counter()
        discovery_result = await self._phase_2_run_discovery(
            entity_id=entity_id,
            entity_name=entity_name,
            dossier=dossier,
            max_iterations=max_discovery_iterations,
            template_id=template_id,
            entity_type=entity_type,
        )
        phase_timings_seconds["phase_2_discovery"] = round(time.perf_counter() - phase_started, 3)

        # =========================================================================
        # PHASE 3: DASHBOARD SCORING
        # =========================================================================
        logger.info("\n📊 PHASE 3: DASHBOARD SCORING")
        logger.info("-" * 60)

        phase_started = time.perf_counter()
        dashboard_scores = await self._phase_3_calculate_scores(
            entity_id=entity_id,
            entity_name=entity_name,
            dossier=dossier,
            discovery_result=discovery_result
        )
        phase_timings_seconds["phase_3_dashboard_scoring"] = round(time.perf_counter() - phase_started, 3)

        # =========================================================================
        # PHASE 4: SAVE RESULTS
        # =========================================================================
        logger.info("\n💾 PHASE 4: SAVE RESULTS")
        logger.info("-" * 60)

        phase_started = time.perf_counter()
        saved_paths = await self._save_results(entity_id, entity_name, dossier, discovery_result, dashboard_scores)
        phase_timings_seconds["phase_4_save_results"] = round(time.perf_counter() - phase_started, 3)

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

        if isinstance(discovery_result, dict):
            discovery_payload = discovery_result
        elif hasattr(discovery_result, "to_dict"):
            discovery_payload = discovery_result.to_dict()
        else:
            discovery_payload = {}
        diagnostics = self._extract_discovery_diagnostics(discovery_payload)
        run_report = self._write_run_report(
            entity_id=entity_id,
            entity_name=entity_name,
            dossier=dossier.to_dict() if hasattr(dossier, "to_dict") else dossier,
            discovery=discovery_payload,
            shadow_discovery=self._last_shadow_discovery_payload,
            scores=dashboard_scores,
            phase_timings=phase_timings_seconds,
            artifacts=saved_paths,
            total_time_seconds=total_time,
        )

        return {
            "entity_id": entity_id,
            "entity_name": entity_name,
            "total_time_seconds": round(total_time, 2),
            "dossier_sections": len(dossier.sections) if hasattr(dossier, 'sections') else 0,
            "discovery_confidence": discovery_result.final_confidence,
            "procurement_maturity": dashboard_scores['procurement_maturity'],
            "sales_readiness": dashboard_scores['sales_readiness'],
            "run_report_path": run_report.get("report_path"),
            "acceptance_gate_passed": run_report.get("acceptance_gate", {}).get("passed"),
            "acceptance_gate_reasons": run_report.get("acceptance_gate", {}).get("reasons", []),
            **diagnostics,
        }

    async def _run_pipeline_via_orchestrator(
        self,
        *,
        entity_id: str,
        entity_name: str,
        entity_type: str,
        tier_score: int,
    ) -> Dict[str, Any]:
        self._last_discovery_error_class = None
        self._last_discovery_error_message = None
        started_at = datetime.now(timezone.utc)
        phase_timings_seconds: Dict[str, float] = {}
        phase_started_at: Dict[str, float] = {}
        phase_payloads: Dict[str, Dict[str, Any]] = {}

        async def _phase_callback(phase: str, payload: Dict[str, Any]) -> None:
            if not isinstance(payload, dict):
                payload = {"value": payload}
            status = str(payload.get("status") or "").lower()
            now = time.perf_counter()
            if status == "running":
                phase_started_at[phase] = now
            elif status in {"completed", "failed", "skipped"}:
                started = phase_started_at.get(phase)
                if started is not None:
                    phase_timings_seconds[phase] = round(now - started, 3)
            phase_payloads[phase] = payload

        orchestrated = await self.orchestrator.run_entity_pipeline(
            entity_id=entity_id,
            entity_name=entity_name,
            entity_type=entity_type,
            priority_score=tier_score,
            phase_callback=_phase_callback,
        )
        artifacts = orchestrated.get("artifacts", {}) if isinstance(orchestrated, dict) else {}
        dossier = artifacts.get("dossier", {}) if isinstance(artifacts, dict) else {}
        discovery = artifacts.get("discovery_result", {}) if isinstance(artifacts, dict) else {}
        scores = artifacts.get("scores", {}) if isinstance(artifacts, dict) else {}
        if not isinstance(dossier, dict):
            dossier = {}
        if not isinstance(discovery, dict):
            discovery = {}
        if not isinstance(scores, dict):
            scores = {}

        save_started = time.perf_counter()
        saved_paths = await self._save_results(entity_id, entity_name, dossier, discovery, scores)
        phase_timings_seconds["save_results"] = round(time.perf_counter() - save_started, 3)

        total_time_seconds = (datetime.now(timezone.utc) - started_at).total_seconds()
        diagnostics = self._extract_discovery_diagnostics(discovery)
        run_report = self._write_run_report(
            entity_id=entity_id,
            entity_name=entity_name,
            dossier=dossier,
            discovery=discovery,
            shadow_discovery=None,
            scores=scores,
            phase_timings=phase_timings_seconds,
            phases=orchestrated.get("phases", {}) if isinstance(orchestrated, dict) else {},
            artifacts=saved_paths,
            total_time_seconds=total_time_seconds,
        )
        return {
            "entity_id": entity_id,
            "entity_name": entity_name,
            "total_time_seconds": round(total_time_seconds, 2),
            "dossier_sections": len(dossier.get("sections") or []),
            "discovery_confidence": float(discovery.get("final_confidence") or 0.0),
            "procurement_maturity": scores.get("procurement_maturity"),
            "sales_readiness": scores.get("sales_readiness"),
            "active_probability": scores.get("active_probability"),
            "run_report_path": run_report.get("report_path"),
            "acceptance_gate_passed": run_report.get("acceptance_gate", {}).get("passed"),
            "acceptance_gate_reasons": run_report.get("acceptance_gate", {}).get("reasons", []),
            **diagnostics,
        }

    @staticmethod
    def _extract_discovery_diagnostics(discovery: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(discovery, dict):
            return {}
        performance = discovery.get("performance_summary")
        if not isinstance(performance, dict):
            performance = {}
        official_traces = performance.get("official_site_resolution_traces")
        latest_trace = {}
        if isinstance(official_traces, list) and official_traces:
            latest_candidate = official_traces[-1]
            if isinstance(latest_candidate, dict):
                latest_trace = latest_candidate

        lane_statuses = latest_trace.get("lane_statuses")
        if not isinstance(lane_statuses, dict):
            lane_statuses = {}

        hop_timings = performance.get("hop_timings")
        if not isinstance(hop_timings, list):
            hop_timings = []
        no_progress_chain = 0
        for hop in reversed(hop_timings):
            if not isinstance(hop, dict):
                continue
            if str(hop.get("decision") or "").upper() != "NO_PROGRESS":
                break
            no_progress_chain += 1
        for hypothesis in discovery.get("hypotheses") or []:
            if not isinstance(hypothesis, dict):
                continue
            try:
                no_progress_chain = max(no_progress_chain, int(hypothesis.get("iterations_no_progress") or 0))
            except (TypeError, ValueError):
                continue

        has_search_lane = any(str(k).startswith("search:") for k in lane_statuses.keys())
        search_hit = any(
            str(key).startswith("search:") and str(value).strip().lower() == "hit"
            for key, value in lane_statuses.items()
        )
        cooldown_skipped = str(lane_statuses.get("guard:cooldown", "")).strip().lower() == "skipped"
        official_site_dead_end = (has_search_lane and not search_hit) or cooldown_skipped

        return {
            "evaluation_mode": discovery.get("evaluation_mode") or performance.get("evaluation_mode"),
            "parse_path": discovery.get("parse_path") or performance.get("parse_path"),
            "llm_last_status": discovery.get("llm_last_status") or performance.get("llm_last_status"),
            "llm_retry_attempts": discovery.get("llm_retry_attempts") or performance.get("llm_retry_attempts"),
            "llm_circuit_broken": bool(
                discovery.get("llm_circuit_broken")
                if discovery.get("llm_circuit_broken") is not None
                else performance.get("llm_circuit_broken", False)
            ),
            "promotion_gate_passed": discovery.get("promotion_gate_passed"),
            "promotion_gate_reasons": discovery.get("promotion_gate_reasons") or [],
            "run_profile": discovery.get("run_profile"),
            "hold_status": discovery.get("hold_status"),
            "official_site_selected_url": latest_trace.get("selected_url"),
            "official_site_selected_score": latest_trace.get("selected_score"),
            "official_site_lane_statuses": lane_statuses,
            "official_site_ranked_lanes": latest_trace.get("ranked_lanes") or [],
            "official_site_dead_end": official_site_dead_end,
            "official_site_no_progress_chain": no_progress_chain,
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

        schema_entity_data = None
        if isinstance(getattr(self, "schema_first_result", None), dict):
            schema_fields = (self.schema_first_result or {}).get("fields")
            if isinstance(schema_fields, dict):
                schema_entity_data = {
                    "schema_first_fields": schema_fields,
                    "schema_first": self.schema_first_result,
                    "schema_first_unanswered_fields": (self.schema_first_result or {}).get("unanswered_fields", []),
                }

        # Generate dossier
        dossier = await self.dossier_generator.generate_dossier(
            entity_id=entity_id,
            entity_name=entity_name,
            entity_type=entity_type,
            priority_score=tier_score,
            entity_data=schema_entity_data,
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
        self._last_shadow_discovery_payload = None
        self._last_template_id = template_id
        self._last_max_iterations = max_iterations
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

            shadow_iterations = max(
                self.shadow_unbounded_floor,
                int(round(float(max_iterations) * self.shadow_unbounded_multiplier)),
            )
            shadow_kwargs = dict(context_kwargs)
            shadow_kwargs["max_iterations"] = shadow_iterations
            shadow_lane_enabled = bool(self.shadow_unbounded_enabled)

            if shadow_lane_enabled:
                logger.info(
                    "🧪 Shadow unbounded lane enabled (iterations=%s, parallel=%s)",
                    shadow_iterations,
                    self.shadow_unbounded_parallel,
                )

            if shadow_lane_enabled and self.shadow_unbounded_parallel:
                shadow_discovery = self._ensure_shadow_discovery()
                shadow_context_method = shadow_discovery.run_discovery_with_dossier_context
                shadow_signature = inspect.signature(shadow_context_method)
                shadow_supports_kwargs = any(
                    param.kind == inspect.Parameter.VAR_KEYWORD
                    for param in shadow_signature.parameters.values()
                )
                if not (shadow_supports_kwargs or "template_id" in shadow_signature.parameters):
                    shadow_kwargs.pop("template_id", None)
                if not (shadow_supports_kwargs or "entity_type" in shadow_signature.parameters):
                    shadow_kwargs.pop("entity_type", None)

                primary_task = asyncio.create_task(context_method(**context_kwargs))
                shadow_task = asyncio.create_task(shadow_context_method(**shadow_kwargs))
                primary_result, shadow_result = await asyncio.gather(primary_task, shadow_task, return_exceptions=True)

                if isinstance(primary_result, Exception):
                    raise primary_result
                result = primary_result

                if isinstance(shadow_result, Exception):
                    logger.warning("⚠️ Shadow unbounded lane failed: %s", shadow_result)
                    self._last_shadow_discovery_payload = {"error": str(shadow_result)}
                else:
                    shadow_payload = (
                        shadow_result.to_dict()
                        if hasattr(shadow_result, "to_dict")
                        else shadow_result
                    )
                    self._last_shadow_discovery_payload = shadow_payload if isinstance(shadow_payload, dict) else {}
            else:
                result = await context_method(**context_kwargs)
                if shadow_lane_enabled:
                    shadow_discovery = self._ensure_shadow_discovery()
                    shadow_context_method = shadow_discovery.run_discovery_with_dossier_context
                    shadow_signature = inspect.signature(shadow_context_method)
                    shadow_supports_kwargs = any(
                        param.kind == inspect.Parameter.VAR_KEYWORD
                        for param in shadow_signature.parameters.values()
                    )
                    if not (shadow_supports_kwargs or "template_id" in shadow_signature.parameters):
                        shadow_kwargs.pop("template_id", None)
                    if not (shadow_supports_kwargs or "entity_type" in shadow_signature.parameters):
                        shadow_kwargs.pop("entity_type", None)
                    shadow_result = await shadow_context_method(**shadow_kwargs)
                    shadow_payload = (
                        shadow_result.to_dict()
                        if hasattr(shadow_result, "to_dict")
                        else shadow_result
                    )
                    self._last_shadow_discovery_payload = shadow_payload if isinstance(shadow_payload, dict) else {}
        except Exception as e:
            self._last_discovery_error_message = str(e)
            self._last_discovery_error_class = (
                "import_context_failure"
                if isinstance(e, ModuleNotFoundError) or "No module named" in str(e)
                else "discovery_runtime_failure"
            )
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
                self._last_discovery_error_message = str(e2)
                self._last_discovery_error_class = (
                    "import_context_failure"
                    if isinstance(e2, ModuleNotFoundError) or "No module named" in str(e2)
                    else "discovery_runtime_failure"
                )
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

        if self._last_shadow_discovery_payload:
            shadow_conf = float(self._last_shadow_discovery_payload.get("final_confidence") or 0.0)
            shadow_signals = self._last_shadow_discovery_payload.get("signals_discovered") or []
            logger.info(
                "🧪 Shadow lane summary: confidence=%.3f signals=%s",
                shadow_conf,
                len(shadow_signals) if isinstance(shadow_signals, list) else 0,
            )

        logger.info(f"✅ Discovery complete:")
        logger.info(f"   - Final confidence: {result.final_confidence:.3f}")
        logger.info(f"   - Iterations: {result.iterations_completed}")
        logger.info(f"   - Signals: {len(result.signals_discovered)}")

        return result

    def _ensure_shadow_discovery(self):
        if self._shadow_discovery is not None:
            return self._shadow_discovery
        from backend.brightdata_sdk_client import BrightDataSDKClient
        from backend.hypothesis_driven_discovery import HypothesisDrivenDiscovery

        self._shadow_client = BrightDataSDKClient()
        self._shadow_discovery = HypothesisDrivenDiscovery(self.claude, self._shadow_client)
        return self._shadow_discovery

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
    ) -> Dict[str, str]:
        """Save all results to files"""
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

        # Save dossier
        dossier_path = self.output_dir / f"{entity_id}_dossier_fixed_{timestamp}.json"
        with open(dossier_path, 'w') as f:
            json.dump(dossier.to_dict() if hasattr(dossier, 'to_dict') else dossier, f, indent=2, default=str)
        logger.info(f"💾 Dossier saved: {dossier_path}")

        # Save discovery
        discovery_path = self.output_dir / f"{entity_id}_discovery_fixed_{timestamp}.json"
        if isinstance(discovery_result, dict):
            discovery_data = discovery_result
        elif hasattr(discovery_result, 'to_dict'):
            discovery_data = discovery_result.to_dict()
        else:
            discovery_data = {
                'entity_id': getattr(discovery_result, "entity_id", entity_id),
                'final_confidence': getattr(discovery_result, "final_confidence", 0.0),
                'iterations_completed': getattr(discovery_result, "iterations_completed", 0),
                'signals_discovered': getattr(discovery_result, "signals_discovered", []),
            }
        with open(discovery_path, 'w') as f:
            json.dump(discovery_data, f, indent=2, default=str)
        logger.info(f"💾 Discovery saved: {discovery_path}")

        # Save scores
        scores_path = self.output_dir / f"{entity_id}_scores_fixed_{timestamp}.json"
        with open(scores_path, 'w') as f:
            json.dump(dashboard_scores, f, indent=2, default=str)
        logger.info(f"💾 Scores saved: {scores_path}")
        artifacts = {
            "dossier_path": str(dossier_path),
            "discovery_path": str(discovery_path),
            "scores_path": str(scores_path),
        }

        hop_trace_payload = self._build_hop_trace_payload(
            entity_id=entity_id,
            entity_name=entity_name,
            primary_discovery=discovery_data,
            shadow_discovery=self._last_shadow_discovery_payload,
        )
        if hop_trace_payload:
            hop_trace_path = self.output_dir / f"{entity_id}_hop_trace_{timestamp}.json"
            with open(hop_trace_path, "w") as trace_file:
                json.dump(hop_trace_payload, trace_file, indent=2, default=str)
            logger.info(f"💾 Hop trace saved: {hop_trace_path}")
            artifacts["hop_trace_path"] = str(hop_trace_path)
        return artifacts

    def _build_hop_trace_payload(
        self,
        *,
        entity_id: str,
        entity_name: str,
        primary_discovery: Dict[str, Any],
        shadow_discovery: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        primary_perf = primary_discovery.get("performance_summary")
        if not isinstance(primary_perf, dict):
            primary_perf = {}
        primary_hops = primary_perf.get("hop_timings")
        if not isinstance(primary_hops, list):
            primary_hops = []

        shadow_perf = shadow_discovery.get("performance_summary") if isinstance(shadow_discovery, dict) else {}
        if not isinstance(shadow_perf, dict):
            shadow_perf = {}
        shadow_hops = shadow_perf.get("hop_timings")
        if not isinstance(shadow_hops, list):
            shadow_hops = []

        if not primary_hops and not shadow_hops:
            return {}

        def _lane_summary(payload: Dict[str, Any], hops: list[Dict[str, Any]]) -> Dict[str, Any]:
            signals = payload.get("signals_discovered")
            return {
                "final_confidence": float(payload.get("final_confidence") or 0.0),
                "iterations_completed": int(payload.get("iterations_completed") or 0),
                "signals_discovered": len(signals) if isinstance(signals, list) else 0,
                "run_profile": payload.get("run_profile"),
                "parse_path": payload.get("parse_path"),
                "llm_last_status": payload.get("llm_last_status"),
                "hop_count": len(hops),
            }

        return {
            "captured_at": datetime.now(timezone.utc).isoformat(),
            "entity_id": entity_id,
            "entity_name": entity_name,
            "template_id": self._last_template_id,
            "deterministic_max_iterations": self._last_max_iterations,
            "lanes": {
                "deterministic": {
                    "summary": _lane_summary(primary_discovery, primary_hops),
                    "hop_timings": primary_hops,
                    "official_site_resolution_traces": primary_perf.get("official_site_resolution_traces") or [],
                },
                "shadow_unbounded": {
                    "enabled": bool(shadow_discovery),
                    "summary": _lane_summary(shadow_discovery or {}, shadow_hops) if shadow_discovery else {},
                    "hop_timings": shadow_hops,
                    "official_site_resolution_traces": shadow_perf.get("official_site_resolution_traces") or [],
                },
            },
        }

    def _count_section_fallbacks(self, dossier: Dict[str, Any]) -> Dict[str, int]:
        sections = dossier.get("sections") if isinstance(dossier, dict) else []
        if not isinstance(sections, list):
            sections = []
        hard_fallback = 0
        low_confidence = 0
        empty_like = 0
        for section in sections:
            if not isinstance(section, dict):
                continue
            status = str(section.get("output_status") or "").strip().lower()
            reason_code = str(section.get("reason_code") or "").strip().lower()
            fallback_flag = bool(section.get("fallback_used"))
            content_items = section.get("content")
            joined_content = " ".join(
                item for item in content_items if isinstance(item, str)
            ) if isinstance(content_items, list) else str(content_items or "")
            lowered = joined_content.lower()
            confidence = section.get("confidence")
            try:
                confidence_value = float(confidence)
            except (TypeError, ValueError):
                confidence_value = 0.0
            if confidence_value <= 0.3:
                low_confidence += 1
            if (
                fallback_flag
                or status in {"completed_with_fallback", "failed"}
                or bool(reason_code) or
                "returned no structured content" in lowered
                or "json repair failed" in lowered
                or "fallback" in lowered
            ):
                hard_fallback += 1
            if not joined_content.strip():
                empty_like += 1
        return {
            "hard_fallback_sections": hard_fallback,
            "low_confidence_sections": low_confidence,
            "empty_sections": empty_like,
        }

    def _build_acceptance_gate(
        self,
        *,
        final_confidence: float,
        signal_count: int,
        section_fallbacks: int,
    ) -> Dict[str, Any]:
        min_confidence = float(os.getenv("PIPELINE_ACCEPT_MIN_CONFIDENCE", "0.55"))
        min_signals = int(os.getenv("PIPELINE_ACCEPT_MIN_SIGNALS", "2"))
        max_fallbacks = int(os.getenv("PIPELINE_ACCEPT_MAX_SECTION_FALLBACKS", "3"))
        reasons = []
        if final_confidence < min_confidence:
            reasons.append(f"final_confidence<{min_confidence}")
        if signal_count < min_signals:
            reasons.append(f"signal_count<{min_signals}")
        if section_fallbacks > max_fallbacks:
            reasons.append(f"section_fallbacks>{max_fallbacks}")
        return {
            "passed": len(reasons) == 0,
            "reasons": reasons,
            "thresholds": {
                "min_confidence": min_confidence,
                "min_signals": min_signals,
                "max_section_fallbacks": max_fallbacks,
            },
        }

    def _write_run_report(
        self,
        *,
        entity_id: str,
        entity_name: str,
        dossier: Dict[str, Any],
        discovery: Dict[str, Any],
        shadow_discovery: Optional[Dict[str, Any]],
        scores: Dict[str, Any],
        phase_timings: Dict[str, float],
        artifacts: Dict[str, str],
        total_time_seconds: float,
        phases: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        phases = phases or {}
        discovery = discovery if isinstance(discovery, dict) else {}
        dossier = dossier if isinstance(dossier, dict) else {}
        scores = scores if isinstance(scores, dict) else {}
        shadow_discovery = shadow_discovery if isinstance(shadow_discovery, dict) else {}
        performance = discovery.get("performance_summary")
        if not isinstance(performance, dict):
            performance = {}
        signals = discovery.get("signals_discovered")
        signal_count = len(signals) if isinstance(signals, list) else 0
        official_traces = performance.get("official_site_resolution_traces")
        latest_trace = official_traces[-1] if isinstance(official_traces, list) and official_traces else {}
        lane_statuses = latest_trace.get("lane_statuses") if isinstance(latest_trace, dict) else {}
        if not isinstance(lane_statuses, dict):
            lane_statuses = {}
        search_hit_lanes = sum(
            1
            for lane, status in lane_statuses.items()
            if str(lane).startswith("search:") and str(status).lower() == "hit"
        )
        section_counters = self._count_section_fallbacks(dossier)
        final_confidence = float(discovery.get("final_confidence") or 0.0)
        acceptance_gate = self._build_acceptance_gate(
            final_confidence=final_confidence,
            signal_count=signal_count,
            section_fallbacks=section_counters["hard_fallback_sections"],
        )
        hop_timings = performance.get("hop_timings")
        if not isinstance(hop_timings, list):
            hop_timings = []
        parse_path_candidates = [
            str(discovery.get("parse_path") or "").strip(),
            str(performance.get("parse_path") or "").strip(),
        ]
        llm_status_candidates = [
            str(discovery.get("llm_last_status") or "").strip(),
            str(performance.get("llm_last_status") or "").strip(),
        ]
        for hop in hop_timings:
            if not isinstance(hop, dict):
                continue
            hop_parse_path = str(hop.get("parse_path") or "").strip()
            hop_llm_status = str(hop.get("llm_last_status") or "").strip()
            if hop_parse_path:
                parse_path_candidates.append(hop_parse_path)
            if hop_llm_status:
                llm_status_candidates.append(hop_llm_status)
        parse_path = next((candidate for candidate in parse_path_candidates if candidate), "")
        llm_last_status = next((candidate for candidate in llm_status_candidates if candidate), "")
        entity_grounding_reject_count = sum(
            1 for hop in hop_timings
            if isinstance(hop, dict) and str(hop.get("evidence_type") or "").strip().lower() == "entity_grounding_filter"
        )
        failure_taxonomy = {
            "import_context_failure": int(
                bool(self._runtime_import_guard.get("missing")) or self._last_discovery_error_class == "import_context_failure"
            ),
            "llm_empty_response": int("empty_response" in llm_last_status),
            "schema_gate_fallback": int("schema_gate" in parse_path or "schema_gate" in llm_last_status),
            "low_signal_content": int("low_signal" in parse_path),
            "entity_grounding_reject": int(entity_grounding_reject_count),
            "last_discovery_error_class": self._last_discovery_error_class,
            "last_discovery_error_message": self._last_discovery_error_message,
        }
        report_payload = {
            "run_at": datetime.now(timezone.utc).isoformat(),
            "entity_id": entity_id,
            "entity_name": entity_name,
            "total_time_seconds": round(total_time_seconds, 3),
            "phase_timings_seconds": phase_timings,
            "phase_statuses": phases,
            "metrics": {
                "dossier_sections": len(dossier.get("sections") or []) if isinstance(dossier.get("sections"), list) else 0,
                "final_confidence": final_confidence,
                "signals_discovered": signal_count,
                "iterations_completed": int(discovery.get("iterations_completed") or 0),
                "procurement_maturity": scores.get("procurement_maturity"),
                "sales_readiness": scores.get("sales_readiness"),
                "active_probability": scores.get("active_probability"),
                "parse_path": parse_path or None,
                "llm_last_status": llm_last_status or None,
                "official_site": {
                    "selected_url": latest_trace.get("selected_url") if isinstance(latest_trace, dict) else None,
                    "selected_score": latest_trace.get("selected_score") if isinstance(latest_trace, dict) else None,
                    "search_hit_lanes": search_hit_lanes,
                    "lane_statuses": lane_statuses,
                },
                "section_fallbacks": section_counters,
                "failure_taxonomy": failure_taxonomy,
                "shadow_unbounded": {
                    "enabled": bool(shadow_discovery),
                    "final_confidence": float(shadow_discovery.get("final_confidence") or 0.0) if shadow_discovery else None,
                    "iterations_completed": int(shadow_discovery.get("iterations_completed") or 0) if shadow_discovery else None,
                    "signals_discovered": (
                        len(shadow_discovery.get("signals_discovered") or [])
                        if isinstance(shadow_discovery.get("signals_discovered"), list)
                        else 0
                    ) if shadow_discovery else None,
                    "run_profile": shadow_discovery.get("run_profile") if shadow_discovery else None,
                },
            },
            "acceptance_gate": acceptance_gate,
            "artifacts": artifacts,
        }
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        report_path = self.run_reports_dir / f"{entity_id}_run_report_{timestamp}.json"
        with open(report_path, "w") as report_file:
            json.dump(report_payload, report_file, indent=2, default=str)
        logger.info("🧾 Run report saved: %s", report_path)
        if acceptance_gate["passed"]:
            logger.info("✅ Acceptance gate passed")
        else:
            logger.warning("⚠️ Acceptance gate failed: %s", acceptance_gate["reasons"])
        report_payload["report_path"] = str(report_path)
        return report_payload


async def main():
    """Main entry point"""
    from dotenv import load_dotenv
    load_dotenv()
    parser = argparse.ArgumentParser(description="Run fixed dossier-first pipeline")
    parser.add_argument("--entity-id", default="coventry-city-fc")
    parser.add_argument("--entity-name", default="Coventry City FC")
    parser.add_argument("--entity-type", default="CLUB")
    parser.add_argument("--tier-score", type=int, default=75)
    parser.add_argument("--max-discovery-iterations", type=int, default=None)
    parser.add_argument("--template-id", default="yellow_panther_agency")
    args = parser.parse_args()

    from backend.hypothesis_driven_discovery import (
        get_template_recommended_hop_cap,
        resolve_template_id,
    )
    resolved_template_id = resolve_template_id(args.template_id, args.entity_type)
    if args.max_discovery_iterations is None:
        resolved_max_iterations = get_template_recommended_hop_cap(resolved_template_id, fallback=5)
    else:
        resolved_max_iterations = max(1, int(args.max_discovery_iterations))
    logger.info(
        "🧭 Discovery runtime defaults: template=%s max_iterations=%s",
        resolved_template_id,
        resolved_max_iterations,
    )

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
            entity_id=args.entity_id,
            entity_name=args.entity_name,
            entity_type=args.entity_type,
            tier_score=args.tier_score,
            max_discovery_iterations=resolved_max_iterations,
            template_id=resolved_template_id,
        )
    finally:
        await pipeline.close()

    print("\n" + "=" * 60)
    print("📋 PIPELINE SUMMARY")
    print("=" * 60)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
