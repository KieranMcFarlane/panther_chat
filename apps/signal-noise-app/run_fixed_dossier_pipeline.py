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
import importlib.util
import json
import logging
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional
from urllib.parse import urlparse

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

try:
    from backend.dossier_persistence import (
        apply_dashboard_score_persistence_context,
        finalize_run_report_payload,
    )
except ImportError:
    from dossier_persistence import (  # type: ignore
        apply_dashboard_score_persistence_context,
        finalize_run_report_payload,
    )

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
        self._last_dual_compare_payload: Dict[str, Any] | None = None
        self._last_control_compare_payload: Dict[str, Any] | None = None
        self._last_candidate_compare_payload: Dict[str, Any] | None = None
        self._last_v2_compare_payload: Dict[str, Any] | None = None
        self._last_agentic_compare_payload: Dict[str, Any] | None = None
        self._last_template_id: str | None = None
        self._last_max_iterations: int | None = None
        self._shadow_client = None
        self._shadow_discovery = None
        self._control_compare_client = None
        self._control_compare_discovery = None
        self._candidate_compare_client = None
        self._candidate_compare_discovery = None
        self._v2_compare_client = None
        self._v2_compare_discovery = None
        self._agentic_client = None
        self._agentic_discovery = None
        from backend.claude_client import ClaudeClient
        from backend.brightdata_client_factory import create_pipeline_brightdata_client
        from backend.dossier_generator import EntityDossierGenerator
        from backend.discovery_engine_factory import create_discovery_engine
        from backend.dashboard_scorer import DashboardScorer
        from backend.pipeline_orchestrator import PipelineOrchestrator

        logger.info("🚀 Initializing Fixed Dossier-First Pipeline...")

        # Initialize clients
        self.claude = ClaudeClient()
        self.brightdata = create_pipeline_brightdata_client()
        requested_runtime_mode = str(os.getenv("PIPELINE_DISCOVERY_RUNTIME", "v2") or "v2").strip().lower()
        if requested_runtime_mode not in {"v2", "agentic_v3", "agentic_v4_batched", "dual_compare"}:
            requested_runtime_mode = "v2"
        self.discovery_runtime_mode = requested_runtime_mode
        if requested_runtime_mode == "agentic_v3":
            primary_engine_name = "agentic_v3"
        elif requested_runtime_mode == "agentic_v4_batched":
            primary_engine_name = "agentic_v4_batched"
        else:
            primary_engine_name = str(os.getenv("DISCOVERY_ENGINE", "v2") or "v2").strip().lower()

        # Initialize components - use WORKING EntityDossierGenerator
        self.dossier_generator = EntityDossierGenerator(self.claude)
        self.discovery, self.discovery_engine = create_discovery_engine(
            claude_client=self.claude,
            brightdata_client=self.brightdata,
            graphiti_service=None,
            falkordb_client=None,
            engine=primary_engine_name,
        )
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
        self.two_pass_enabled = _bool_env(os.getenv("PIPELINE_TWO_PASS_ENABLED", "true"))
        self.two_pass_pass_a_only = _bool_env(os.getenv("PIPELINE_PASS_A_ONLY", "false"))
        self.two_pass_pass_a_iterations = max(
            1,
            int(os.getenv("PIPELINE_PASS_A_MAX_ITERATIONS", "2")),
        )
        self.two_pass_pass_b_iterations = max(
            1,
            int(os.getenv("PIPELINE_PASS_B_MAX_ITERATIONS", "5")),
        )
        self.two_pass_gate_min_confidence = float(os.getenv("PIPELINE_PASS_A_MIN_CONFIDENCE", "0.45"))
        self.two_pass_gate_min_signals = max(0, int(os.getenv("PIPELINE_PASS_A_MIN_SIGNALS", "1")))
        self.run_objective = str(os.getenv("PIPELINE_RUN_OBJECTIVE", "dossier_core")).strip().lower() or "dossier_core"
        self.requested_objective = self.run_objective
        self.effective_objective = self.run_objective
        self.phase_objectives: Dict[str, str] = {
            "dossier_generation": "dossier_core",
            "discovery": self.run_objective,
            "ralph_validation": self.run_objective,
            "temporal_persistence": self.run_objective,
            "dashboard_scoring": self.run_objective,
        }

        if _bool_env(os.getenv("PIPELINE_FORCE_BRIGHTDATA", "false")):
            os.environ["BRIGHTDATA_FORCE_ONLY"] = "true"
            os.environ.setdefault("BRIGHTDATA_GENEROUS_RETRY", "true")
            os.environ.setdefault("BRIGHTDATA_SEARCH_MAX_ATTEMPTS", "5")
            os.environ.setdefault("BRIGHTDATA_SCRAPE_MAX_ATTEMPTS", "5")
            os.environ.setdefault("BRIGHTDATA_REQUEST_MAX_ATTEMPTS", "5")
            logger.info("🔒 PIPELINE_FORCE_BRIGHTDATA enabled (BrightData-only + generous retries)")

        # Dual-compare and agentic runtime orchestration currently lives in the
        # fixed runner path, not in canonical orchestrator.
        if self.discovery_runtime_mode in {"dual_compare", "agentic_v3", "agentic_v4_batched"} and self._use_canonical_orchestrator:
            self._use_canonical_orchestrator = False
            logger.info(
                "🧪 discovery_runtime_mode=%s: using fixed runner (canonical orchestrator bypassed)",
                self.discovery_runtime_mode,
            )

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

            async def persist_pipeline_record_supabase(self, _payload):
                raise RuntimeError("noop_graphiti_supabase_unavailable")

            async def persist_pipeline_record_falkordb(self, _payload):
                raise RuntimeError("noop_graphiti_falkordb_unavailable")

        graphiti_service = _NoopGraphitiService()
        try:
            from backend.graphiti_service import GraphitiService

            graphiti_service = GraphitiService()
            logger.info("✅ Using GraphitiService for canonical pipeline persistence")
        except Exception as graphiti_error:  # noqa: BLE001
            logger.warning("⚠️ GraphitiService unavailable in fixed runner, using noop: %s", graphiti_error)

        self.orchestrator = PipelineOrchestrator(
            dossier_generator=self.dossier_generator,
            discovery=self.discovery,
            ralph_validator=_IdentityRalphValidator(),
            graphiti_service=graphiti_service,
            dashboard_scorer=self.dashboard_scorer,
        )

        self._runtime_preflight = self._run_startup_preflight()
        self._runtime_preflight_fail_fast = _bool_env(
            os.getenv(
                "PIPELINE_PREFLIGHT_FAIL_FAST",
                "false" if os.getenv("PYTEST_CURRENT_TEST") else "true",
            )
        )
        if not bool(self._runtime_preflight.get("ok", False)):
            message = str(self._runtime_preflight.get("message") or "runtime_preflight_failed")
            if self._runtime_preflight_fail_fast:
                raise RuntimeError(message)
            logger.warning("⚠️ Runtime preflight degraded mode: %s", message)

        # Create output directory
        self.output_dir = Path("backend/data/dossiers")
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.run_reports_dir = self.output_dir / "run_reports"
        self.run_reports_dir.mkdir(parents=True, exist_ok=True)

        logger.info("✅ Pipeline initialized")

    def _run_startup_preflight(self) -> Dict[str, Any]:
        pdfplumber_ok = importlib.util.find_spec("pdfplumber") is not None
        pymupdf_ok = importlib.util.find_spec("fitz") is not None
        planner_model = str(getattr(self.claude, "chutes_model_planner", "") or "").strip()
        judge_model = str(getattr(self.claude, "chutes_model_judge", "") or "").strip()
        fallback_model = str(getattr(self.claude, "chutes_model_fallback", "") or "").strip()
        brightdata_token = str(os.getenv("BRIGHTDATA_API_TOKEN") or "").strip()
        brightdata_zone_candidates = list(getattr(self.brightdata, "_zone_candidates", []) or [])

        failures: list[str] = []
        warnings: list[str] = []
        if not (pdfplumber_ok or pymupdf_ok):
            failures.append("pdf_extractor_missing(pdfplumber|pymupdf)")
        if not planner_model or not judge_model or not fallback_model:
            failures.append("chutes_role_model_mapping_incomplete")
        if not brightdata_token:
            failures.append("brightdata_api_token_missing")
        if not brightdata_zone_candidates:
            warnings.append("brightdata_zone_candidates_empty")

        ok = len(failures) == 0
        message = "ok" if ok else "; ".join(failures)
        return {
            "ok": ok,
            "message": message,
            "failures": failures,
            "warnings": warnings,
            "checks": {
                "pdfplumber_available": pdfplumber_ok,
                "pymupdf_available": pymupdf_ok,
                "planner_model": planner_model,
                "judge_model": judge_model,
                "fallback_model": fallback_model,
                "brightdata_token_present": bool(brightdata_token),
                "brightdata_zone_candidates": brightdata_zone_candidates,
            },
        }

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
        v2_close_fn = getattr(getattr(self, "_v2_compare_client", None), "close", None)
        if callable(v2_close_fn):
            try:
                await v2_close_fn()
            except Exception as close_error:  # noqa: BLE001
                logger.warning("⚠️ Failed to close v2 compare BrightData client: %s", close_error)
        agentic_close_fn = getattr(getattr(self, "_agentic_client", None), "close", None)
        if callable(agentic_close_fn):
            try:
                await agentic_close_fn()
            except Exception as close_error:  # noqa: BLE001
                logger.warning("⚠️ Failed to close agentic BrightData client: %s", close_error)

    async def _prewarm_brightdata_client(self) -> None:
        """Prewarm BrightData before discovery/collection starts."""
        try:
            from backend.brightdata_client_factory import prewarm_pipeline_brightdata_client
        except ImportError:
            from brightdata_client_factory import prewarm_pipeline_brightdata_client  # type: ignore

        warmup_timeout = float(os.getenv("BRIGHTDATA_MCP_WARMUP_TIMEOUT_SECONDS", "60") or "60")
        warm_service_enabled = _bool_env(os.getenv("BRIGHTDATA_MCP_WARM_SERVICE", "true"))
        try:
            await prewarm_pipeline_brightdata_client(
                self.brightdata,
                timeout=warmup_timeout,
                background=warm_service_enabled,
            )
        except Exception as warmup_error:  # noqa: BLE001
            logger.warning("⚠️ BrightData prewarm failed; continuing with fallback path: %s", warmup_error)

    async def run_pipeline(
        self,
        entity_id: str,
        entity_name: str,
        entity_type: str = "CLUB",
        tier_score: int = 50,
        max_discovery_iterations: int = 15,
        template_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Run the complete 4-phase dossier-first pipeline"""
        self._last_discovery_error_class = None
        self._last_discovery_error_message = None
        await self._prewarm_brightdata_client()
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
        discovery_engine = str(getattr(self, "discovery_engine", os.getenv("DISCOVERY_ENGINE", "v2") or "v2")).strip().lower()
        runtime_mode = str(getattr(self, "discovery_runtime_mode", "v2") or "v2").strip().lower()
        use_legacy_template_routing = discovery_engine in {"legacy", "v1", "hypothesis"} and runtime_mode == "v2"
        league_context = self._extract_dossier_league_context(dossier)
        if use_legacy_template_routing:
            from backend.hypothesis_driven_discovery import resolve_template_id

            discovery_template_id = resolve_template_id(
                template_id,
                entity_type,
                league_or_competition=league_context.get("league_or_competition"),
                org_type=league_context.get("org_type"),
                entity_id=entity_id,
                entity_name=entity_name,
            )
            logger.info(
                "🧭 Legacy template routing resolved: %s (league=%s, org_type=%s)",
                discovery_template_id,
                league_context.get("league_or_competition") or "n/a",
                league_context.get("org_type") or "n/a",
            )
        else:
            discovery_template_id = (template_id or "").strip() or None
            logger.info("🧭 Discovery runtime active (%s): template routing disabled (template=%s)", runtime_mode, discovery_template_id or "none")

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
            template_id=discovery_template_id,
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
        # Non-canonical fixed runner does not execute persistence coordinator dual-write.
        fixed_runner_persistence_status = {
            "supabase": {"ok": False, "error": "not_executed_non_canonical"},
            "falkordb": {"ok": False, "error": "not_executed_non_canonical"},
            "dual_write_ok": False,
            "reconcile_required": True,
        }
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
            persistence_status=fixed_runner_persistence_status,
            dual_write_ok=False,
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
            "dual_write_ok": False,
            "persistence_status": fixed_runner_persistence_status,
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
            run_objective=self.run_objective,
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
            persistence_status=orchestrated.get("persistence_status") if isinstance(orchestrated, dict) else None,
            dual_write_ok=orchestrated.get("dual_write_ok") if isinstance(orchestrated, dict) else None,
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
            "dual_write_ok": orchestrated.get("dual_write_ok") if isinstance(orchestrated, dict) else False,
            "persistence_status": orchestrated.get("persistence_status") if isinstance(orchestrated, dict) else None,
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
            run_objective=(self.phase_objectives or {}).get("dossier_generation", "dossier_core"),
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
        if bool(getattr(self, "two_pass_enabled", False)) and not bool(getattr(self, "_two_pass_internal", False)):
            pass_a_iterations = min(
                int(max_iterations),
                int(getattr(self, "two_pass_pass_a_iterations", 2) or 2),
            )
            pass_b_iterations = min(
                int(max_iterations),
                int(getattr(self, "two_pass_pass_b_iterations", max_iterations) or max_iterations),
            )

            self._two_pass_internal = True
            try:
                pass_a_result = await self._phase_2_run_discovery(
                    entity_id=entity_id,
                    entity_name=entity_name,
                    dossier=dossier,
                    max_iterations=pass_a_iterations,
                    template_id=template_id,
                    entity_type=entity_type,
                )
            finally:
                self._two_pass_internal = False

            pass_a_confidence = float(getattr(pass_a_result, "final_confidence", 0.0) or 0.0)
            pass_a_signals = getattr(pass_a_result, "signals_discovered", []) or []
            pass_a_signal_count = len(pass_a_signals) if isinstance(pass_a_signals, list) else 0
            pass_a_gate_passed = (
                pass_a_confidence >= float(getattr(self, "two_pass_gate_min_confidence", 0.45) or 0.45)
                and pass_a_signal_count >= int(getattr(self, "two_pass_gate_min_signals", 1) or 1)
            )
            pass_a_only = bool(getattr(self, "two_pass_pass_a_only", False))

            two_pass_summary = {
                "enabled": True,
                "pass_a": {
                    "iterations": pass_a_iterations,
                    "final_confidence": pass_a_confidence,
                    "signals_discovered": pass_a_signal_count,
                    "gate_passed": pass_a_gate_passed,
                },
                "pass_b_executed": False,
                "pass_b": None,
                "selected_result": "pass_a",
            }

            if not pass_a_only and pass_a_gate_passed and pass_b_iterations > 0:
                self._two_pass_internal = True
                try:
                    pass_b_result = await self._phase_2_run_discovery(
                        entity_id=entity_id,
                        entity_name=entity_name,
                        dossier=dossier,
                        max_iterations=pass_b_iterations,
                        template_id=template_id,
                        entity_type=entity_type,
                    )
                finally:
                    self._two_pass_internal = False
                pass_b_confidence = float(getattr(pass_b_result, "final_confidence", 0.0) or 0.0)
                pass_b_signals = getattr(pass_b_result, "signals_discovered", []) or []
                pass_b_signal_count = len(pass_b_signals) if isinstance(pass_b_signals, list) else 0
                two_pass_summary["pass_b_executed"] = True
                two_pass_summary["pass_b"] = {
                    "iterations": pass_b_iterations,
                    "final_confidence": pass_b_confidence,
                    "signals_discovered": pass_b_signal_count,
                }
                two_pass_summary["selected_result"] = "pass_b"
                result = pass_b_result
            else:
                result = pass_a_result

            perf = getattr(result, "performance_summary", None)
            if not isinstance(perf, dict):
                perf = {}
            perf["two_pass"] = two_pass_summary
            setattr(result, "performance_summary", perf)
            return result

        self._last_shadow_discovery_payload = None
        self._last_template_id = template_id
        self._last_max_iterations = max_iterations
        logger.info(f"🔍 Running discovery (max {max_iterations} iterations, template: {template_id})")

        # Try with dossier context first, fall back to standard discovery
        try:
            if isinstance(dossier, dict):
                dossier_payload = dict(dossier)
            elif hasattr(dossier, "to_dict"):
                dossier_payload = dossier.to_dict()
            else:
                dossier_payload = {}
            dossier_payload = self._ensure_dossier_metadata_payload(
                dossier_payload=dossier_payload,
                entity_id=entity_id,
                entity_name=entity_name,
            )
            known_official_site = self._extract_official_site_from_dossier_payload(dossier_payload)
            generator = getattr(self, "dossier_generator", None)
            getter = getattr(generator, "get_last_official_site_url", None)
            if not known_official_site and callable(getter):
                try:
                    getter_candidate = getter(entity_id)
                    if self._is_likely_synthetic_entity_domain(getter_candidate, entity_name):
                        getter_candidate = None
                    known_official_site = getter_candidate
                except Exception as seed_error:  # noqa: BLE001
                    logger.debug("Could not fetch seeded official site for %s: %s", entity_id, seed_error)
            if not known_official_site:
                artifact_candidate = self._lookup_official_site_from_recent_artifacts(entity_id)
                if self._is_likely_synthetic_entity_domain(artifact_candidate, entity_name):
                    artifact_candidate = None
                known_official_site = artifact_candidate
            if not known_official_site:
                known_official_site = self._schema_first_official_site()

            if isinstance(known_official_site, str) and known_official_site.strip():
                logger.info("🌐 Discovery official-site seed: %s", known_official_site)
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
            if template_id:
                context_kwargs["template_id"] = template_id
            if entity_type:
                context_kwargs["entity_type"] = entity_type

            runtime_mode = str(getattr(self, "discovery_runtime_mode", "v2") or "v2").strip().lower()
            if runtime_mode == "dual_compare":
                control_runtime_name, candidate_runtime_name = self._dual_compare_runtime_names()
                control_runtime = self._ensure_compare_discovery(control_runtime_name)
                candidate_runtime = self._ensure_compare_discovery(candidate_runtime_name)
                if isinstance(known_official_site, str) and known_official_site.strip():
                    setattr(control_runtime, "current_official_site_url", known_official_site)
                    setattr(candidate_runtime, "current_official_site_url", known_official_site)
                control_kwargs = self._prepare_context_kwargs(runtime=control_runtime, context_kwargs=context_kwargs)
                candidate_kwargs = self._prepare_context_kwargs(runtime=candidate_runtime, context_kwargs=context_kwargs)
                control_result, candidate_result = await asyncio.gather(
                    control_runtime.run_discovery_with_dossier_context(**control_kwargs),
                    candidate_runtime.run_discovery_with_dossier_context(**candidate_kwargs),
                    return_exceptions=True,
                )
                lane_errors = {}
                if isinstance(control_result, Exception):
                    lane_errors[control_runtime_name] = self._build_failed_compare_payload(runtime_name=control_runtime_name, error=control_result)
                if isinstance(candidate_result, Exception):
                    lane_errors[candidate_runtime_name] = self._build_failed_compare_payload(runtime_name=candidate_runtime_name, error=candidate_result)
                control_payload = self._normalize_discovery_payload(
                    lane_errors[control_runtime_name] if isinstance(control_result, Exception) else self._result_to_payload(control_result)
                )
                candidate_payload = self._normalize_discovery_payload(
                    lane_errors[candidate_runtime_name] if isinstance(candidate_result, Exception) else self._result_to_payload(candidate_result)
                )
                if isinstance(control_result, Exception) and isinstance(candidate_result, Exception):
                    comparison_payload = {
                        "mode": "dual_compare",
                        "status": "both_lanes_failed",
                        "winner_runtime": None,
                        "loser_runtime": None,
                        "winner_reason_codes": ["both_lanes_failed"],
                        "winner_score_breakdown": {},
                        "lane_errors": lane_errors,
                        "runtimes": {
                            control_runtime_name: self._discovery_winner_score(control_payload),
                            candidate_runtime_name: self._discovery_winner_score(candidate_payload),
                        },
                    }
                else:
                    comparison_payload = self._compare_discovery_payloads(
                        v2_payload=control_payload,
                        agentic_payload=candidate_payload,
                    )
                if lane_errors and comparison_payload.get("status") != "both_lanes_failed":
                    comparison_payload["status"] = "partial_lane_failure"
                    comparison_payload["lane_errors"] = lane_errors
                elif comparison_payload.get("status") != "both_lanes_failed":
                    comparison_payload["status"] = "ok"
                self._last_control_compare_payload = control_payload
                self._last_candidate_compare_payload = candidate_payload
                self._last_v2_compare_payload = control_payload
                self._last_agentic_compare_payload = candidate_payload
                self._last_dual_compare_payload = comparison_payload
                self._last_shadow_discovery_payload = candidate_payload
                winner_runtime = comparison_payload.get("winner_runtime")
                if winner_runtime == candidate_runtime_name:
                    winner_result = candidate_result
                    winner_payload = candidate_payload
                else:
                    winner_result = control_result
                    winner_payload = control_payload
                if comparison_payload.get("status") == "both_lanes_failed":
                    from backend.hypothesis_driven_discovery import DiscoveryResult

                    winner_result = DiscoveryResult(
                        entity_id=entity_id,
                        entity_name=entity_name,
                        final_confidence=0.0,
                        confidence_band="LOW",
                        is_actionable=False,
                        iterations_completed=0,
                        total_cost_usd=0.0,
                        hypotheses=[],
                        depth_stats={},
                        signals_discovered=[],
                    )
                    winner_payload = control_payload
                elif isinstance(winner_result, Exception):
                    winner_result = control_result if not isinstance(control_result, Exception) else candidate_result
                    winner_payload = control_payload if winner_result is control_result else candidate_payload
                winner_payload["winner_metadata"] = comparison_payload
                performance = winner_payload.get("performance_summary")
                if not isinstance(performance, dict):
                    performance = {}
                    winner_payload["performance_summary"] = performance
                performance["runtime_mode"] = runtime_mode
                performance["comparison_summary"] = comparison_payload
                performance["winner_runtime"] = winner_runtime
                performance["compare_partial_failure"] = bool(lane_errors)
                performance["compare_payload_missing"] = False
                setattr(winner_result, "winner_metadata", comparison_payload)
                setattr(winner_result, "performance_summary", performance)
                result = winner_result
                logger.info(
                    "🧪 Dual compare complete: winner=%s %s_score=%.3f %s_score=%.3f",
                    winner_runtime,
                    control_runtime_name,
                    float((((comparison_payload.get("runtimes") or {}).get(control_runtime_name) or {}).get("weighted_total") or 0.0)),
                    candidate_runtime_name,
                    float((((comparison_payload.get("runtimes") or {}).get(candidate_runtime_name) or {}).get("weighted_total") or 0.0)),
                )
                return result

            context_method = self.discovery.run_discovery_with_dossier_context
            context_kwargs = self._prepare_context_kwargs(runtime=self.discovery, context_kwargs=context_kwargs)

            shadow_unbounded_floor = int(getattr(self, "shadow_unbounded_floor", 6) or 6)
            shadow_unbounded_multiplier = float(getattr(self, "shadow_unbounded_multiplier", 1.8) or 1.8)
            shadow_iterations = max(
                shadow_unbounded_floor,
                int(round(float(max_iterations) * shadow_unbounded_multiplier)),
            )
            shadow_kwargs = dict(context_kwargs)
            shadow_kwargs["max_iterations"] = shadow_iterations
            shadow_lane_enabled = bool(getattr(self, "shadow_unbounded_enabled", False))

            if shadow_lane_enabled:
                logger.info(
                    "🧪 Shadow unbounded lane enabled (iterations=%s, parallel=%s)",
                    shadow_iterations,
                    bool(getattr(self, "shadow_unbounded_parallel", False)),
                )

            if shadow_lane_enabled and bool(getattr(self, "shadow_unbounded_parallel", False)):
                shadow_discovery = self._ensure_shadow_discovery()
                shadow_kwargs = self._prepare_context_kwargs(runtime=shadow_discovery, context_kwargs=shadow_kwargs)

                primary_task = asyncio.create_task(context_method(**context_kwargs))
                shadow_task = asyncio.create_task(shadow_discovery.run_discovery_with_dossier_context(**shadow_kwargs))
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
                    shadow_kwargs = self._prepare_context_kwargs(runtime=shadow_discovery, context_kwargs=shadow_kwargs)
                    shadow_result = await shadow_discovery.run_discovery_with_dossier_context(**shadow_kwargs)
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
            runtime_mode = str(getattr(self, "discovery_runtime_mode", "v2") or "v2").strip().lower()
            if runtime_mode == "dual_compare" and not isinstance(getattr(self, "_last_dual_compare_payload", None), dict):
                control_runtime_name, _ = self._dual_compare_runtime_names()
                self._last_dual_compare_payload = {
                    "mode": "dual_compare",
                    "winner_runtime": control_runtime_name,
                    "status": "fallback_due_exception",
                    "compare_execution_failed": True,
                    "error_class": self._last_discovery_error_class,
                    "error_message": self._last_discovery_error_message,
                    "runtimes": {},
                    "winner_reason_codes": [self._last_discovery_error_class],
                }
            logger.warning(f"⚠️ Dossier-context discovery failed: {e}")
            logger.info("🔄 Falling back to standard discovery...")

            # Try standard discovery with template
            try:
                if entity_type:
                    self.discovery.current_entity_type = entity_type
                metadata = dossier_payload.get("metadata", {}) if isinstance(dossier_payload, dict) else {}
                league_or_competition = metadata.get("league_or_competition") if isinstance(metadata, dict) else None
                org_type = metadata.get("org_type") if isinstance(metadata, dict) else None
                result = await self.discovery.run_discovery(
                    entity_id=entity_id,
                    entity_name=entity_name,
                    template_id=template_id,
                    league_or_competition=league_or_competition,
                    org_type=org_type,
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
        from backend.discovery_engine_factory import create_discovery_engine

        self._shadow_client = BrightDataSDKClient()
        shadow_engine_name = os.getenv(
            "DISCOVERY_SHADOW_ENGINE",
            "legacy" if str(getattr(self, "discovery_engine", "")).lower() == "v2" else "v2",
        )
        self._shadow_discovery, _ = create_discovery_engine(
            claude_client=self.claude,
            brightdata_client=self._shadow_client,
            graphiti_service=None,
            falkordb_client=None,
            engine=shadow_engine_name,
        )
        return self._shadow_discovery

    def _ensure_compare_discovery(self, runtime_name: str):
        from backend.brightdata_sdk_client import BrightDataSDKClient
        from backend.discovery_engine_factory import create_discovery_engine

        control_runtime_name, candidate_runtime_name = self._dual_compare_runtime_names()
        normalized = str(runtime_name or control_runtime_name).strip().lower()
        if normalized == control_runtime_name and self.discovery_engine == control_runtime_name:
            return self.discovery
        if normalized == candidate_runtime_name and self.discovery_engine == candidate_runtime_name:
            return self.discovery
        if normalized == control_runtime_name:
            if self._control_compare_discovery is None:
                self._control_compare_client = BrightDataSDKClient()
                self._control_compare_discovery, _ = create_discovery_engine(
                    claude_client=self.claude,
                    brightdata_client=self._control_compare_client,
                    graphiti_service=None,
                    falkordb_client=None,
                    engine=control_runtime_name,
                )
            return self._control_compare_discovery
        if self._candidate_compare_discovery is None:
            self._candidate_compare_client = BrightDataSDKClient()
            self._candidate_compare_discovery, _ = create_discovery_engine(
                claude_client=self.claude,
                brightdata_client=self._candidate_compare_client,
                graphiti_service=None,
                falkordb_client=None,
                engine=candidate_runtime_name,
            )
        return self._candidate_compare_discovery

    @staticmethod
    def _build_failed_compare_payload(*, runtime_name: str, error: Exception) -> Dict[str, Any]:
        error_class = type(error).__name__
        error_message = str(error)
        return {
            "signals_discovered": [],
            "provisional_signals": [],
            "candidate_evaluations": [],
            "actionability_score": 0.0,
            "entity_grounded_signal_count": 0,
            "controller_health_reasons": [f"{runtime_name}_runtime_failed"],
            "performance_summary": {
                "planner_decision_applied_rate": 0.0,
                "off_entity_reject_rate": 0.0,
                "schema_fail_count": 1,
                "total_duration_ms": 0.0,
                "actionability_score": 0.0,
                "runtime_failure": True,
                "runtime_failure_class": error_class,
                "runtime_failure_message": error_message,
            },
        }

    @staticmethod
    def _result_to_payload(result: Any) -> Dict[str, Any]:
        if isinstance(result, dict):
            return dict(result)
        if hasattr(result, "to_dict"):
            payload = result.to_dict()
            return payload if isinstance(payload, dict) else {}
        return {}

    def _prepare_context_kwargs(
        self,
        *,
        runtime: Any,
        context_kwargs: Dict[str, Any],
    ) -> Dict[str, Any]:
        prepared = dict(context_kwargs)
        context_method = runtime.run_discovery_with_dossier_context
        signature = inspect.signature(context_method)
        supports_kwargs = any(
            param.kind == inspect.Parameter.VAR_KEYWORD
            for param in signature.parameters.values()
        )
        if not (supports_kwargs or "template_id" in signature.parameters):
            prepared.pop("template_id", None)
        if not (supports_kwargs or "entity_type" in signature.parameters):
            prepared.pop("entity_type", None)
        return prepared

    @staticmethod
    def _safe_ratio(numerator: float, denominator: float) -> float:
        if denominator <= 0:
            return 0.0
        return float(numerator) / float(denominator)

    @staticmethod
    def _dual_compare_runtime_names() -> tuple[str, str]:
        return ("agentic_v3", "agentic_v4_batched")

    def _discovery_winner_score(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        performance = payload.get("performance_summary") if isinstance(payload.get("performance_summary"), dict) else {}
        validated = payload.get("signals_discovered") if isinstance(payload.get("signals_discovered"), list) else []
        provisional = payload.get("provisional_signals") if isinstance(payload.get("provisional_signals"), list) else []
        candidates = payload.get("candidate_evaluations") if isinstance(payload.get("candidate_evaluations"), list) else []
        total_evidence = len(validated) + len(provisional) + len(candidates)
        actionability = float(
            payload.get("actionability_score")
            or performance.get("actionability_score")
            or 0.0
        )
        grounded_count = int(
            payload.get("entity_grounded_signal_count")
            or performance.get("entity_grounded_signal_count")
            or 0
        )
        precision = min(1.0, self._safe_ratio(grounded_count, max(1, len(validated) + len(provisional))))
        procurement_hits = sum(
            1
            for item in [*validated, *provisional]
            if isinstance(item, dict)
            and any(
                token in str(item.get("subtype") or item.get("reason_code") or "").lower()
                for token in ("procurement", "tender", "rfp", "commercial", "digital", "hiring")
            )
        )
        procurement_relevance = min(1.0, self._safe_ratio(procurement_hits, max(1, len(validated) + len(provisional))))
        decision_maker_hits = sum(
            1
            for item in [*validated, *provisional]
            if isinstance(item, dict)
            and any(token in str(item.get("text") or item.get("statement") or "").lower() for token in ("chief", "director", "head of", "ceo"))
        )
        decision_maker_usefulness = min(1.0, self._safe_ratio(decision_maker_hits, max(1, len(validated) + len(provisional))))
        duration_ms = float(performance.get("total_duration_ms") or 0.0)
        planner_applied_rate = float(
            performance.get("planner_decision_applied_rate")
            or performance.get("planner_action_applied_rate")
            or 0.0
        )
        off_entity_reject_rate = float(performance.get("off_entity_reject_rate") or 0.0)
        schema_fail_count = int(performance.get("schema_fail_count") or 0)
        controller_reasons = payload.get("controller_health_reasons") if isinstance(payload.get("controller_health_reasons"), list) else []
        scores = {
            "evidence_actionability": round(min(1.0, actionability / 100.0), 4),
            "entity_grounded_precision": round(precision, 4),
            "procurement_future_need_relevance": round(procurement_relevance, 4),
            "decision_maker_usefulness": round(decision_maker_usefulness, 4),
            "runtime_efficiency_stability": round(max(0.0, 1.0 - min(1.0, (off_entity_reject_rate + (schema_fail_count * 0.05)))), 4),
        }
        total_score = (
            (scores["evidence_actionability"] * 0.35)
            + (scores["entity_grounded_precision"] * 0.25)
            + (scores["procurement_future_need_relevance"] * 0.20)
            + (scores["decision_maker_usefulness"] * 0.10)
            + (scores["runtime_efficiency_stability"] * 0.10)
        )
        return {
            "score_breakdown": scores,
            "weighted_total": round(total_score, 4),
            "planner_applied_rate": round(planner_applied_rate, 4),
            "duration_ms": round(duration_ms, 2),
            "off_entity_reject_rate": round(off_entity_reject_rate, 4),
            "schema_fail_count": schema_fail_count,
            "total_evidence_items": total_evidence,
            "controller_health_reasons": controller_reasons,
        }

    def _compare_discovery_payloads(
        self,
        *,
        v2_payload: Dict[str, Any],
        agentic_payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        control_runtime_name, candidate_runtime_name = self._dual_compare_runtime_names()
        v2_summary = self._discovery_winner_score(v2_payload)
        agentic_summary = self._discovery_winner_score(agentic_payload)
        runtimes = {
            control_runtime_name: {"payload": v2_payload, **v2_summary},
            candidate_runtime_name: {"payload": agentic_payload, **agentic_summary},
        }
        for runtime_name, row in runtimes.items():
            payload = row["payload"]
            performance = payload.get("performance_summary") if isinstance(payload.get("performance_summary"), dict) else {}
            row["eligible"] = True
            row["ineligible_reasons"] = []
            if row["planner_applied_rate"] <= 0.0:
                row["eligible"] = False
                row["ineligible_reasons"].append("planner_applied_rate_zero")
            if row["off_entity_reject_rate"] > 0.25:
                row["eligible"] = False
                row["ineligible_reasons"].append("off_entity_reject_rate_gt_25pct")
            if row["schema_fail_count"] > 0 and self._safe_ratio(row["schema_fail_count"], max(1, row["total_evidence_items"])) > 0.15:
                row["eligible"] = False
                row["ineligible_reasons"].append("schema_fail_rate_gt_15pct")
            if float(payload.get("actionability_score") or performance.get("actionability_score") or 0.0) <= 0.0:
                row["ineligible_reasons"].append("sparse_fallback_only")

        eligible = {name: row for name, row in runtimes.items() if row["eligible"]}
        if eligible:
            winner_runtime = max(eligible.items(), key=lambda item: item[1]["weighted_total"])[0]
        else:
            winner_runtime = max(
                runtimes.items(),
                key=lambda item: (
                    item[1]["weighted_total"],
                    len(item[1].get("payload", {}).get("turn_trace") or []),
                    -item[1]["off_entity_reject_rate"],
                ),
            )[0]
        loser_runtime = candidate_runtime_name if winner_runtime == control_runtime_name else control_runtime_name
        duration_fastest = min(
            runtimes[control_runtime_name]["duration_ms"] or float("inf"),
            runtimes[candidate_runtime_name]["duration_ms"] or float("inf"),
        )
        for row in runtimes.values():
            if duration_fastest and duration_fastest != float("inf") and row["duration_ms"] > 0:
                row["score_breakdown"]["runtime_efficiency_stability"] = round(
                    min(
                        row["score_breakdown"]["runtime_efficiency_stability"],
                        duration_fastest / row["duration_ms"],
                    ),
                    4,
                )
        return {
            "mode": "dual_compare",
            "winner_runtime": winner_runtime,
            "loser_runtime": loser_runtime,
            "winner_reason_codes": runtimes[winner_runtime]["payload"].get("controller_health_reasons") or [],
            "winner_score_breakdown": runtimes[winner_runtime]["score_breakdown"],
            "runtimes": {
                control_runtime_name: {k: v for k, v in runtimes[control_runtime_name].items() if k != "payload"},
                candidate_runtime_name: {k: v for k, v in runtimes[candidate_runtime_name].items() if k != "payload"},
            },
        }

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

    def _extract_dossier_league_context(self, dossier: Any) -> Dict[str, str]:
        """Extract league/org context for template routing."""
        payload: Dict[str, Any] = {}
        if isinstance(dossier, dict):
            payload = dossier
        elif hasattr(dossier, "to_dict"):
            try:
                payload = dossier.to_dict()
            except Exception:  # noqa: BLE001
                payload = {}

        metadata = payload.get("metadata") if isinstance(payload, dict) else None
        entity = payload.get("entity") if isinstance(payload, dict) else None
        if not isinstance(metadata, dict):
            metadata = {}
        if not isinstance(entity, dict):
            entity = {}

        league_or_competition = (
            metadata.get("league_or_competition")
            or entity.get("league_or_competition")
            or entity.get("entity_league")
            or ""
        )
        org_type = metadata.get("org_type") or entity.get("org_type") or ""
        return {
            "league_or_competition": str(league_or_competition or "").strip(),
            "org_type": str(org_type or "").strip(),
        }

    def _extract_official_site_from_dossier_payload(self, payload: Dict[str, Any]) -> str | None:
        if not isinstance(payload, dict):
            return None
        metadata = payload.get("metadata")
        canonical_sources = metadata.get("canonical_sources") if isinstance(metadata, dict) else None
        candidates = [
            canonical_sources.get("official_site") if isinstance(canonical_sources, dict) else None,
            metadata.get("website") if isinstance(metadata, dict) else None,
            payload.get("official_site_url"),
            payload.get("website"),
        ]
        sections = payload.get("sections") if isinstance(payload.get("sections"), list) else []
        for section in sections:
            if not isinstance(section, dict):
                continue
            if str(section.get("id") or "").strip().lower() != "core_information":
                continue
            content_lines = section.get("content") if isinstance(section.get("content"), list) else []
            joined = " ".join(str(line or "") for line in content_lines)
            url_match = re.search(r"https?://[^\s)]+", joined)
            if url_match:
                candidates.append(url_match.group(0))
            bare_match = re.search(r"\b(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:/[a-z0-9._~:/?#@!$&'()*+,;=-]*)?\b", joined, flags=re.IGNORECASE)
            if bare_match:
                candidates.append(bare_match.group(0))
        ranked: list[tuple[int, str]] = []
        for candidate in candidates:
            normalized = self._normalize_http_url(candidate, prefer_official_root=True)
            if not normalized:
                continue
            ranked.append((self._official_site_candidate_score(normalized), normalized))
        if not ranked:
            return None
        ranked.sort(key=lambda item: item[0], reverse=True)
        return ranked[0][1]

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
    def _normalize_http_url(candidate: Any, *, prefer_official_root: bool = False) -> str | None:
        if not isinstance(candidate, str):
            return None
        value = candidate.strip()
        if not value:
            return None
        if value.startswith(("http://", "https://")):
            normalized = value.rstrip("/")
        elif value.startswith("www.") or "." in value:
            normalized = f"https://{value.lstrip('/').rstrip('/')}"
        else:
            return None
        parsed = urlparse(normalized)
        host = (parsed.hostname or "").lower().lstrip("www.")
        if not host:
            return None
        path = (parsed.path or "").lower().strip()
        if prefer_official_root and (
            path.endswith(".pdf")
            or any(token in host for token in ("images.", "img.", "cdn", "assets.", "static."))
        ):
            return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
        return normalized

    @staticmethod
    def _official_site_candidate_score(url: str) -> int:
        parsed = urlparse(str(url or ""))
        host = (parsed.hostname or "").lower()
        path = (parsed.path or "").strip().lower()
        score = 0
        if host.startswith("www."):
            score += 2
        if not path or path in {"/", "/home", "/index", "/index.html"}:
            score += 3
        if ".pdf" not in path:
            score += 2
        if not any(token in host for token in ("images.", "img.", "cdn", "assets.", "static.")):
            score += 2
        return score

    @staticmethod
    def _is_likely_synthetic_entity_domain(candidate: Any, entity_name: str) -> bool:
        if not isinstance(candidate, str):
            return False
        normalized = FixedDossierFirstPipeline._normalize_http_url(candidate)
        if not normalized:
            return False
        host = (urlparse(normalized).hostname or "").lower().lstrip("www.")
        if not host:
            return False
        compact = re.sub(r"[^a-z0-9]+", "", str(entity_name or "").lower())
        if not compact:
            return False
        return host in {f"{compact}.com", f"{compact}.org", f"{compact}.net"}

    async def _phase_3_calculate_scores(
        self,
        entity_id: str,
        entity_name: str,
        dossier: Any,
        discovery_result: Any
    ):
        """Phase 3: Calculate dashboard scores"""
        logger.info(f"📊 Calculating three-axis dashboard scores")
        raw_signals = discovery_result.signals_discovered if hasattr(discovery_result, 'signals_discovered') else []
        validated_signals = [
            signal
            for signal in (raw_signals or [])
            if isinstance(signal, dict) and str(signal.get("validation_state") or "").strip().lower() == "validated"
        ]

        scores = await self.dashboard_scorer.calculate_entity_scores(
            entity_id=entity_id,
            entity_name=entity_name,
            hypotheses=discovery_result.hypotheses if hasattr(discovery_result, 'hypotheses') else [],
            signals=validated_signals,
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

        # Normalize discovery payload once so dossier/report artifacts stay aligned.
        if isinstance(discovery_result, dict):
            discovery_data = dict(discovery_result)
        elif hasattr(discovery_result, 'to_dict'):
            discovery_data = discovery_result.to_dict()
        else:
            discovery_data = {
                'entity_id': getattr(discovery_result, "entity_id", entity_id),
                'final_confidence': getattr(discovery_result, "final_confidence", 0.0),
                'iterations_completed': getattr(discovery_result, "iterations_completed", 0),
                'signals_discovered': getattr(discovery_result, "signals_discovered", []),
            }
        discovery_data = self._normalize_discovery_payload(discovery_data)

        # Save dossier
        dossier_path = self.output_dir / f"{entity_id}_dossier_fixed_{timestamp}.json"
        if isinstance(dossier, dict):
            dossier_payload = dict(dossier)
        elif hasattr(dossier, "to_dict"):
            dossier_payload = dossier.to_dict()
        else:
            dossier_payload = {}
        dossier_payload = self._ensure_dossier_metadata_payload(
            dossier_payload=dossier_payload,
            entity_id=entity_id,
            entity_name=entity_name,
        )
        dossier_payload = self._enrich_dossier_with_discovery(
            dossier_payload=dossier_payload,
            discovery_payload=discovery_data,
        )
        dossier_payload = apply_dashboard_score_persistence_context(
            dossier_payload,
            entity_id=entity_id,
            entity_name=entity_name,
            dashboard_scores=dashboard_scores,
            entity_data=getattr(self.dossier_generator, "_last_entity_data_by_id", {}).get(entity_id),
        )
        self._last_saved_dossier_payload = dossier_payload
        with open(dossier_path, 'w') as f:
            json.dump(dossier_payload, f, indent=2, default=str)
        logger.info(f"💾 Dossier saved: {dossier_path}")

        # Save discovery
        discovery_path = self.output_dir / f"{entity_id}_discovery_fixed_{timestamp}.json"
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
        dual_compare_payload = getattr(self, "_last_dual_compare_payload", None)
        if isinstance(dual_compare_payload, dict):
            comparison_path = self.output_dir / f"{entity_id}_discovery_comparison_{timestamp}.json"
            with open(comparison_path, "w") as compare_file:
                json.dump(dual_compare_payload, compare_file, indent=2, default=str)
            artifacts["comparison_path"] = str(comparison_path)
            logger.info(f"💾 Discovery comparison saved: {comparison_path}")
        control_runtime_name, candidate_runtime_name = self._dual_compare_runtime_names()
        if isinstance(getattr(self, "_last_control_compare_payload", None), dict):
            control_path = self.output_dir / f"{entity_id}_discovery_{control_runtime_name}_{timestamp}.json"
            with open(control_path, "w") as compare_file:
                json.dump(self._last_control_compare_payload, compare_file, indent=2, default=str)
            artifacts["control_discovery_path"] = str(control_path)
        if isinstance(getattr(self, "_last_candidate_compare_payload", None), dict):
            candidate_path = self.output_dir / f"{entity_id}_discovery_{candidate_runtime_name}_{timestamp}.json"
            with open(candidate_path, "w") as compare_file:
                json.dump(self._last_candidate_compare_payload, compare_file, indent=2, default=str)
            artifacts["agentic_discovery_path"] = str(candidate_path)

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

    @staticmethod
    def _summarize_candidate_events(candidate_evaluations: Any) -> Dict[str, Any]:
        summary = {
            "total": 0,
            "by_validation_state": {},
            "by_reason_code": {},
        }
        if not isinstance(candidate_evaluations, list):
            return summary
        for item in candidate_evaluations:
            if not isinstance(item, dict):
                continue
            summary["total"] += 1
            state = str(item.get("validation_state") or "unknown").strip().lower()
            reason = str(item.get("reason_code") or "unknown").strip().lower()
            summary["by_validation_state"][state] = int(summary["by_validation_state"].get(state, 0) or 0) + 1
            summary["by_reason_code"][reason] = int(summary["by_reason_code"].get(reason, 0) or 0) + 1
        return summary

    def _normalize_discovery_payload(self, discovery_data: Dict[str, Any]) -> Dict[str, Any]:
        payload = dict(discovery_data or {})
        signals = payload.get("signals_discovered")
        if not isinstance(signals, list):
            payload["signals_discovered"] = []
        provisional = payload.get("provisional_signals")
        if not isinstance(provisional, list):
            payload["provisional_signals"] = []
        candidate_evaluations = payload.get("candidate_evaluations")
        if not isinstance(candidate_evaluations, list):
            candidate_evaluations = []
            payload["candidate_evaluations"] = candidate_evaluations

        perf = payload.get("performance_summary")
        if not isinstance(perf, dict):
            perf = {}
            payload["performance_summary"] = perf
        runtime_mode = str(getattr(self, "discovery_runtime_mode", "v2") or "v2").strip().lower()
        dual_compare_payload = getattr(self, "_last_dual_compare_payload", None)
        if (
            runtime_mode == "dual_compare"
            and isinstance(dual_compare_payload, dict)
            and not isinstance(perf.get("comparison_summary"), dict)
        ):
            perf["comparison_summary"] = dual_compare_payload
            perf["winner_runtime"] = dual_compare_payload.get("winner_runtime")
            winner_metadata = payload.get("winner_metadata")
            if not isinstance(winner_metadata, dict):
                winner_metadata = {}
            winner_metadata.setdefault("comparison", dual_compare_payload)
            payload["winner_metadata"] = winner_metadata
        if runtime_mode == "dual_compare" and not isinstance(perf.get("comparison_summary"), dict):
            control_runtime_name, _ = self._dual_compare_runtime_names()
            perf["comparison_summary"] = {
                "mode": "dual_compare",
                "status": "missing_compare_payload",
                "compare_execution_failed": True,
                "winner_runtime": control_runtime_name,
                "runtimes": {},
                "winner_reason_codes": ["missing_compare_payload"],
            }
        compare_payload_missing = runtime_mode == "dual_compare" and not isinstance(getattr(self, "_last_dual_compare_payload", None), dict)

        if not isinstance(payload.get("candidate_events_summary"), dict):
            payload["candidate_events_summary"] = self._summarize_candidate_events(candidate_evaluations)
        if not isinstance(payload.get("lane_failures"), dict):
            payload["lane_failures"] = perf.get("lane_failures") if isinstance(perf.get("lane_failures"), dict) else {}
        if not isinstance(payload.get("controller_health_reasons"), list):
            reasons = perf.get("controller_health_reasons")
            payload["controller_health_reasons"] = reasons if isinstance(reasons, list) else []
        for key in ("turn_trace", "planner_decisions", "executed_actions", "credit_ledger", "evidence_ledger"):
            if not isinstance(payload.get(key), list):
                payload[key] = []
        if not isinstance(payload.get("winner_metadata"), dict):
            payload["winner_metadata"] = {}

        perf.setdefault("signals_validated_count", len(payload.get("signals_discovered") or []))
        perf.setdefault("signals_provisional_count", len(payload.get("provisional_signals") or []))
        perf.setdefault("signals_candidate_events_count", len(candidate_evaluations))
        perf.setdefault("candidate_events_summary", payload.get("candidate_events_summary"))
        perf.setdefault("lane_failures", payload.get("lane_failures"))
        perf.setdefault("controller_health_reasons", payload.get("controller_health_reasons"))
        perf.setdefault("planner_decision_parse_fail_count", perf.get("planner_action_parse_fail_count") or 0)
        applied_from_trace = sum(
            1
            for row in payload.get("turn_trace") or []
            if isinstance(row, dict) and str(row.get("planner_status") or "").strip().lower() == "applied"
        )
        recorded_applied = int(perf.get("planner_decision_applied_count") or perf.get("planner_action_applied_count") or 0)
        perf["planner_decision_applied_count"] = max(recorded_applied, applied_from_trace)
        perf["planner_decision_applied_rate"] = round(
            float(perf.get("planner_decision_applied_count") or 0)
            / max(
                1,
                int(perf.get("planner_turn_count") or 0)
                + int(perf.get("planner_decision_parse_fail_count") or 0),
            ),
            4,
        )
        artifact_consistency_issues = list(perf.get("artifact_consistency_issues") or [])
        if applied_from_trace != recorded_applied:
            artifact_consistency_issues.append("planner_applied_count_mismatch")
        if int(perf.get("planner_turn_count") or 0) != len(payload.get("turn_trace") or []):
            artifact_consistency_issues.append("planner_turn_count_mismatch")
        if len(payload.get("planner_decisions") or []) != len(payload.get("turn_trace") or []):
            artifact_consistency_issues.append("planner_decision_trace_mismatch")
        if len(payload.get("executed_actions") or []) != len(payload.get("turn_trace") or []):
            artifact_consistency_issues.append("executed_action_trace_mismatch")
        perf["artifact_consistency_issues"] = sorted(set(str(item) for item in artifact_consistency_issues if str(item)))
        perf["artifact_consistency_ok"] = len(perf["artifact_consistency_issues"]) == 0
        perf["compare_payload_missing"] = compare_payload_missing
        perf["winner_selection_missing"] = runtime_mode == "dual_compare" and perf.get("winner_runtime") is None
        perf["planner_influence_unobserved"] = (
            (applied_from_trace > 0 and float(perf.get("planner_decision_applied_rate") or 0.0) <= 0.0)
            or (applied_from_trace > 0 and "planner_applied_count_mismatch" in perf["artifact_consistency_issues"])
        )
        perf.setdefault("actionability_score", float(payload.get("actionability_score") or perf.get("actionability_score") or 0.0))
        perf.setdefault(
            "entity_grounded_signal_count",
            int(payload.get("entity_grounded_signal_count") or perf.get("entity_grounded_signal_count") or 0),
        )
        return payload

    def _enrich_dossier_with_discovery(
        self,
        *,
        dossier_payload: Dict[str, Any],
        discovery_payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        enrich_fn = getattr(getattr(self, "dossier_generator", None), "enrich_dossier_with_discovery_evidence", None)
        if not callable(enrich_fn):
            return dossier_payload
        try:
            enriched = enrich_fn(dossier_payload=dossier_payload, discovery_payload=discovery_payload)
        except Exception as enrich_error:  # noqa: BLE001
            logger.warning("⚠️ Dossier discovery enrichment failed: %s", enrich_error)
            return dossier_payload
        return enriched if isinstance(enriched, dict) else dossier_payload

    def _ensure_dossier_metadata_payload(
        self,
        *,
        dossier_payload: Dict[str, Any],
        entity_id: str,
        entity_name: str,
    ) -> Dict[str, Any]:
        payload = dict(dossier_payload or {})
        metadata = payload.get("metadata")
        if not isinstance(metadata, dict):
            metadata = {}
            payload["metadata"] = metadata

        getter = getattr(getattr(self, "dossier_generator", None), "get_last_entity_data", None)
        last_entity_data = getter(entity_id) if callable(getter) else {}
        if not isinstance(last_entity_data, dict):
            last_entity_data = {}

        website = metadata.get("website")
        if not website:
            website = (
                payload.get("official_site_url")
                or payload.get("website")
                or self._extract_official_site_from_dossier_payload(payload)
                or last_entity_data.get("official_site_url")
                or last_entity_data.get("entity_website")
                or last_entity_data.get("website")
            )
        normalized_website = self._normalize_http_url(website)
        if normalized_website:
            metadata["website"] = normalized_website
            canonical_sources = metadata.setdefault("canonical_sources", {})
            if isinstance(canonical_sources, dict):
                canonical_sources.setdefault("official_site", normalized_website)
            payload.setdefault("official_site_url", normalized_website)

        metadata.setdefault("entity_id", entity_id)
        metadata.setdefault("entity_name", entity_name)
        metadata.setdefault("sport", last_entity_data.get("entity_sport") or last_entity_data.get("sport"))
        metadata.setdefault("country", last_entity_data.get("entity_country") or last_entity_data.get("country"))
        metadata.setdefault(
            "league_or_competition",
            last_entity_data.get("entity_league") or last_entity_data.get("league_or_competition"),
        )
        metadata.setdefault("founded", last_entity_data.get("entity_founded") or last_entity_data.get("founded"))
        metadata.setdefault("headquarters", last_entity_data.get("hq"))
        return payload

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
            provisional = payload.get("provisional_signals")
            candidate_events = payload.get("candidate_evaluations")
            return {
                "final_confidence": float(payload.get("final_confidence") or 0.0),
                "iterations_completed": int(payload.get("iterations_completed") or 0),
                "signals_discovered": len(signals) if isinstance(signals, list) else 0,
                "signals_provisional": len(provisional) if isinstance(provisional, list) else 0,
                "signals_candidate_events": len(candidate_events) if isinstance(candidate_events, list) else 0,
                "run_profile": payload.get("run_profile"),
                "parse_path": payload.get("parse_path"),
                "llm_last_status": payload.get("llm_last_status"),
                "hop_count": len(hops),
            }

        payload = {
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
        comparison = getattr(self, "_last_dual_compare_payload", None)
        if isinstance(comparison, dict):
            control_runtime_name, candidate_runtime_name = self._dual_compare_runtime_names()
            payload["comparison"] = comparison
            payload["lanes"][control_runtime_name] = {
                "summary": _lane_summary(
                    getattr(self, "_last_control_compare_payload", {}) or {},
                    (((getattr(self, "_last_control_compare_payload", {}) or {}).get("performance_summary") or {}).get("hop_timings") or []),
                ),
                "hop_timings": (((getattr(self, "_last_control_compare_payload", {}) or {}).get("performance_summary") or {}).get("hop_timings") or []),
                "official_site_resolution_traces": (((getattr(self, "_last_control_compare_payload", {}) or {}).get("performance_summary") or {}).get("official_site_resolution_traces") or []),
            }
            payload["lanes"][candidate_runtime_name] = {
                "summary": _lane_summary(
                    getattr(self, "_last_candidate_compare_payload", {}) or {},
                    (((getattr(self, "_last_candidate_compare_payload", {}) or {}).get("performance_summary") or {}).get("hop_timings") or []),
                ),
                "hop_timings": (((getattr(self, "_last_candidate_compare_payload", {}) or {}).get("performance_summary") or {}).get("hop_timings") or []),
                "official_site_resolution_traces": (((getattr(self, "_last_candidate_compare_payload", {}) or {}).get("performance_summary") or {}).get("official_site_resolution_traces") or []),
            }
        return payload

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
            hard_reason_codes = {
                "timeout_partial",
                "source_low_signal",
                "schema_gate_failed",
                "json_repair_failed",
                "generation_failed",
                "llm_error",
            }
            hard_reason_prefixes = ("timeout", "error", "failed", "schema", "parse")
            reason_is_hard_failure = (
                reason_code in hard_reason_codes
                or any(reason_code.startswith(prefix) for prefix in hard_reason_prefixes)
            )
            if (
                status in {"completed_with_fallback", "completed_with_sparse_fallback", "degraded_sparse_evidence", "failed"}
                or reason_is_hard_failure
                or
                "returned no structured content" in lowered
                or "json repair failed" in lowered
                or "using fallback section" in lowered
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
        provisional_count: int,
        candidate_events_count: int,
        schema_fail_count: int = 0,
        section_fallbacks: int,
        dual_write_required: bool = True,
        dual_write_ok: Optional[bool] = None,
    ) -> Dict[str, Any]:
        min_confidence = float(os.getenv("PIPELINE_ACCEPT_MIN_CONFIDENCE", "0.55"))
        min_signals = int(os.getenv("PIPELINE_ACCEPT_MIN_SIGNALS", "2"))
        max_fallbacks = int(os.getenv("PIPELINE_ACCEPT_MAX_SECTION_FALLBACKS", "3"))
        hybrid_min_validated = int(os.getenv("PIPELINE_ACCEPT_HYBRID_MIN_VALIDATED", "1"))
        hybrid_min_provisional = int(os.getenv("PIPELINE_ACCEPT_HYBRID_MIN_PROVISIONAL", "2"))
        strict_pass = signal_count >= min_signals
        hybrid_pass = (
            signal_count >= hybrid_min_validated
            and provisional_count >= hybrid_min_provisional
            and schema_fail_count == 0
        )
        reasons = []
        if final_confidence < min_confidence:
            reasons.append(f"final_confidence<{min_confidence}")
        if not strict_pass and not hybrid_pass:
            reasons.append(f"signal_count<{min_signals}")
        if section_fallbacks > max_fallbacks:
            reasons.append(f"section_fallbacks>{max_fallbacks}")
        if dual_write_required and dual_write_ok is False:
            reasons.append("dual_write_incomplete")
        acceptance_mode = "strict" if strict_pass else "hybrid_provisional" if hybrid_pass else "none"
        return {
            "passed": len(reasons) == 0,
            "reasons": reasons,
            "acceptance_mode": acceptance_mode,
            "thresholds": {
                "min_confidence": min_confidence,
                "min_signals": min_signals,
                "hybrid_min_validated": hybrid_min_validated,
                "hybrid_min_provisional": hybrid_min_provisional,
                "max_section_fallbacks": max_fallbacks,
                "dual_write_required": dual_write_required,
            },
            "observed": {
                "signals_validated_count": signal_count,
                "signals_provisional_count": provisional_count,
                "signals_candidate_events_count": candidate_events_count,
                "schema_fail_count": schema_fail_count,
            },
        }

    def _write_run_report(
        self,
        *,
        entity_id: str,
        entity_name: str,
        dossier: Dict[str, Any],
        discovery: Dict[str, Any],
        shadow_discovery: Optional[Dict[str, Any]] = None,
        scores: Dict[str, Any],
        phase_timings: Dict[str, float],
        artifacts: Dict[str, str],
        total_time_seconds: float,
        phases: Dict[str, Any] | None = None,
        persistence_status: Optional[Dict[str, Any]] = None,
        dual_write_ok: Optional[bool] = None,
    ) -> Dict[str, Any]:
        phases = phases or {}
        discovery = self._normalize_discovery_payload(discovery if isinstance(discovery, dict) else {})
        saved_dossier = getattr(self, "_last_saved_dossier_payload", None)
        if isinstance(saved_dossier, dict):
            dossier = saved_dossier
        else:
            dossier = dossier if isinstance(dossier, dict) else {}
        scores = scores if isinstance(scores, dict) else {}
        shadow_discovery = shadow_discovery if isinstance(shadow_discovery, dict) else {}
        performance = discovery.get("performance_summary")
        if not isinstance(performance, dict):
            performance = {}
        validated_signals = discovery.get("signals_discovered")
        provisional_signals = discovery.get("provisional_signals")
        signal_events: List[Dict[str, Any]] = []
        if isinstance(validated_signals, list):
            signal_events.extend([item for item in validated_signals if isinstance(item, dict)])
        if isinstance(provisional_signals, list):
            signal_events.extend([item for item in provisional_signals if isinstance(item, dict)])
        validated_signal_list = [
            signal
            for signal in signal_events
            if isinstance(signal, dict) and str(signal.get("validation_state") or "").strip().lower() == "validated"
        ]
        provisional_signal_list = [
            signal
            for signal in signal_events
            if isinstance(signal, dict) and str(signal.get("validation_state") or "").strip().lower() == "provisional"
        ]
        candidate_signal_list = [
            signal
            for signal in signal_events
            if isinstance(signal, dict) and str(signal.get("validation_state") or "").strip().lower() == "candidate"
        ]
        diagnostic_signal_list = [
            signal
            for signal in signal_events
            if isinstance(signal, dict) and str(signal.get("validation_state") or "").strip().lower() == "diagnostic"
        ]
        signal_count = len(validated_signal_list)
        provisional_count = len(provisional_signal_list)
        candidate_events = discovery.get("candidate_evaluations")
        candidate_events_count = len(candidate_events) if isinstance(candidate_events, list) else int(
            performance.get("signals_candidate_events_count") or 0
        )
        accepted_empty_evidence_count = 0
        for signal in validated_signal_list:
            evidence_found = str(signal.get("evidence_found") or "").strip()
            evidence_items = signal.get("evidence") if isinstance(signal.get("evidence"), list) else []
            has_content_item = any(str(item.get("content") or "").strip() for item in evidence_items if isinstance(item, dict))
            if not evidence_found and not has_content_item:
                accepted_empty_evidence_count += 1
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
        metadata_coverage_score = None
        unknown_required_field_count = None
        metadata_missing_fields: list[str] = []
        sections = dossier.get("sections") if isinstance(dossier.get("sections"), list) else []
        core_section = next(
            (
                section
                for section in sections
                if isinstance(section, dict) and str(section.get("id") or "").strip() == "core_information"
            ),
            None,
        )
        if isinstance(core_section, dict):
            for metric in core_section.get("metrics") or []:
                metric_text = str(metric or "")
                if metric_text.lower().startswith("metadata coverage score:"):
                    try:
                        metadata_coverage_score = float(metric_text.split(":", 1)[1].strip())
                    except Exception:
                        metadata_coverage_score = None
                if metric_text.lower().startswith("unknown required fields:"):
                    try:
                        unknown_required_field_count = int(float(metric_text.split(":", 1)[1].strip()))
                    except Exception:
                        unknown_required_field_count = None
        core_content_text = " ".join(str(line or "") for line in (core_section.get("content") or [])) if isinstance(core_section, dict) else ""
        core_metrics = core_section.get("metrics") if isinstance(core_section, dict) and isinstance(core_section.get("metrics"), list) else []
        if any(str(metric).lower().startswith("founded: unknown") for metric in core_metrics):
            metadata_missing_fields.append("founded")
        if any(str(metric).lower().startswith("country: unknown") for metric in core_metrics):
            metadata_missing_fields.append("country")
        core_content_lower = core_content_text.lower()
        if "unknown sport" in core_content_lower:
            metadata_missing_fields.append("sport")
        if "unknown competition" in core_content_lower:
            metadata_missing_fields.append("competition")
        if "website unknown" in core_content_lower or "website: unknown" in core_content_lower:
            metadata_missing_fields.append("website")
        metadata_missing_fields = sorted(set(metadata_missing_fields))
        section_partial_timeout_count = sum(
            1
            for section in sections
            if isinstance(section, dict)
            and str(section.get("reason_code") or "").strip().lower() == "timeout_partial"
        )
        dual_write_required = not (
            isinstance(persistence_status, dict) and bool(persistence_status.get("reconcile_required"))
        )
        acceptance_gate = self._build_acceptance_gate(
            final_confidence=final_confidence,
            signal_count=signal_count,
            provisional_count=provisional_count,
            candidate_events_count=candidate_events_count,
            schema_fail_count=int(performance.get("schema_fail_count") or 0),
            section_fallbacks=section_counters["hard_fallback_sections"],
            dual_write_required=dual_write_required,
            dual_write_ok=dual_write_ok,
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
        entity_grounding_reject_count_by_lane = performance.get("entity_grounding_reject_count_by_lane")
        if not isinstance(entity_grounding_reject_count_by_lane, dict):
            entity_grounding_reject_count_by_lane = {}
        entity_grounding_reject_count = sum(
            int(value or 0) for value in entity_grounding_reject_count_by_lane.values()
        )
        if entity_grounding_reject_count == 0:
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
            "supabase_write_failure": int(
                bool(isinstance(persistence_status, dict) and not ((persistence_status.get("supabase") or {}).get("ok", True)))
            ),
            "falkordb_write_failure": int(
                bool(isinstance(persistence_status, dict) and not ((persistence_status.get("falkordb") or {}).get("ok", True)))
            ),
            "dual_write_incomplete": int(dual_write_required and dual_write_ok is False),
            "last_discovery_error_class": self._last_discovery_error_class,
            "last_discovery_error_message": self._last_discovery_error_message,
        }
        planner_action_counts: Dict[str, int] = {}
        planner_search_refinement_count = 0
        planner_model = getattr(getattr(self, "claude", None), "chutes_model_planner", None)
        judge_model = getattr(getattr(self, "claude", None), "chutes_model_judge", None)
        fallback_model = getattr(getattr(self, "claude", None), "chutes_model_fallback", None)
        for hop in hop_timings:
            if not isinstance(hop, dict):
                continue
            planner_action = hop.get("planner_action") if isinstance(hop.get("planner_action"), dict) else {}
            action_name = str(planner_action.get("action") or "").strip()
            if action_name:
                planner_action_counts[action_name] = int(planner_action_counts.get(action_name, 0) or 0) + 1
            planner_queries = hop.get("planner_search_queries")
            if isinstance(planner_queries, list) and any(str(query or "").strip() for query in planner_queries):
                planner_search_refinement_count += 1

        discovery_controller = {
            "planner_model": planner_model,
            "judge_model": judge_model,
            "fallback_model": fallback_model,
            "hop_budget_initial": int(performance.get("hop_budget_initial") or 0),
            "hop_budget_final": int(performance.get("hop_budget_final") or 0),
            "hop_credits_earned": int(performance.get("hop_credits_earned") or 0),
            "hop_credit_events": int(performance.get("hop_credit_events") or 0),
            "dynamic_hop_credits_enabled": bool(performance.get("dynamic_hop_credits_enabled", False)),
            "llm_hop_selection_count": int(performance.get("llm_hop_selection_count") or 0),
            "planner_action_applied_count": int(
                performance.get("planner_action_applied_count")
                or performance.get("planner_decision_applied_count")
                or 0
            ),
            "planner_action_parse_fail_count": int(
                performance.get("planner_action_parse_fail_count")
                or performance.get("planner_decision_parse_fail_count")
                or 0
            ),
            "planner_turn_count": int(performance.get("planner_turn_count") or 0),
            "planner_decision_applied_rate": float(performance.get("planner_decision_applied_rate") or 0.0),
            "planner_search_refinement_count": int(planner_search_refinement_count),
            "planner_action_counts": planner_action_counts,
            "planner_block_reason_counts": dict(performance.get("planner_block_reason_counts") or {}),
            "controller_health_reasons": list(performance.get("controller_health_reasons") or []),
            "llm_json_hop_count": int(performance.get("llm_json_hop_count") or 0),
            "heuristic_hop_count": int(performance.get("heuristic_hop_count") or 0),
            "agent_influence_ratio": float(performance.get("agent_influence_ratio") or 0.0),
            "artifact_consistency_ok": bool(performance.get("artifact_consistency_ok", True)),
            "artifact_consistency_issues": list(performance.get("artifact_consistency_issues") or []),
            "compare_payload_missing": bool(performance.get("compare_payload_missing", False)),
            "winner_selection_missing": bool(performance.get("winner_selection_missing", False)),
            "planner_influence_unobserved": bool(performance.get("planner_influence_unobserved", False)),
            "credits_spent": int(performance.get("credits_spent") or 0),
            "credits_earned": int(performance.get("credits_earned") or 0),
            "entity_grounded_signal_count": int(performance.get("entity_grounded_signal_count") or 0),
            "actionability_score": float(performance.get("actionability_score") or discovery.get("actionability_score") or 0.0),
            "off_entity_reject_rate": float(performance.get("off_entity_reject_rate") or 0.0),
        }
        llm_hop_selection_count = int(discovery_controller.get("llm_hop_selection_count") or 0)
        planner_action_applied_count = int(discovery_controller.get("planner_action_applied_count") or 0)
        planner_action_parse_fail_count = int(discovery_controller.get("planner_action_parse_fail_count") or 0)
        discovery_controller["controller_health"] = (
            "degraded_no_applied_actions"
            if llm_hop_selection_count > 0 and planner_action_applied_count == 0
            else "degraded_parse_failures"
            if planner_action_parse_fail_count > 0
            else "healthy"
        )
        runtime_mode = str(
            performance.get("runtime_mode")
            or getattr(self, "discovery_runtime_mode", getattr(self, "discovery_engine", "v2"))
        )
        comparison_payload = performance.get("comparison_summary")
        if not isinstance(comparison_payload, dict):
            cached_compare = getattr(self, "_last_dual_compare_payload", None)
            comparison_payload = cached_compare if isinstance(cached_compare, dict) else None
        if runtime_mode == "dual_compare" and not isinstance(comparison_payload, dict):
            control_runtime_name, _ = self._dual_compare_runtime_names()
            comparison_payload = {
                "mode": "dual_compare",
                "status": "missing_compare_payload",
                "compare_execution_failed": True,
                "winner_runtime": control_runtime_name,
                "runtimes": {},
                "winner_reason_codes": [
                    str(self._last_discovery_error_class or "dual_compare_not_emitted")
                ],
                "error_class": self._last_discovery_error_class,
                "error_message": self._last_discovery_error_message,
            }
        winner_runtime = (
            str(performance.get("winner_runtime") or "")
            or (str(comparison_payload.get("winner_runtime") or "") if isinstance(comparison_payload, dict) else "")
            or (self._dual_compare_runtime_names()[0] if runtime_mode == "dual_compare" else "")
            or None
        )
        report_payload = {
            "run_at": datetime.now(timezone.utc).isoformat(),
            "entity_id": entity_id,
            "entity_name": entity_name,
            "runtime_mode": runtime_mode,
            "requested_objective": getattr(self, "requested_objective", self.run_objective if hasattr(self, "run_objective") else "dossier_core"),
            "effective_objective": getattr(self, "effective_objective", self.run_objective if hasattr(self, "run_objective") else "dossier_core"),
            "phase_objectives": dict(getattr(self, "phase_objectives", {})),
            "total_time_seconds": round(total_time_seconds, 3),
            "phase_timings_seconds": phase_timings,
            "phase_statuses": phases,
            "signals_validated_count": int(acceptance_gate.get("observed", {}).get("signals_validated_count") or signal_count),
            "signals_provisional_count": int(acceptance_gate.get("observed", {}).get("signals_provisional_count") or provisional_count),
            "signals_candidate_events_count": int(
                acceptance_gate.get("observed", {}).get("signals_candidate_events_count") or candidate_events_count
            ),
            "acceptance_mode": acceptance_gate.get("acceptance_mode"),
            "winner_runtime": winner_runtime,
            "comparison_summary": comparison_payload if isinstance(comparison_payload, dict) else None,
            "winner_runtime_status": (
                str(comparison_payload.get("status"))
                if isinstance(comparison_payload, dict) and comparison_payload.get("status") is not None
                else ("missing_compare_payload" if runtime_mode == "dual_compare" else None)
            ),
            "metrics": {
                "dossier_sections": len(dossier.get("sections") or []) if isinstance(dossier.get("sections"), list) else 0,
                "final_confidence": final_confidence,
                "entity_confidence": float(performance.get("entity_confidence") or discovery.get("entity_confidence") or final_confidence),
                "pipeline_confidence": float(performance.get("pipeline_confidence") or discovery.get("pipeline_confidence") or final_confidence),
                "signals_discovered": signal_count,
                "signals_total_events": int(performance.get("signals_total_events") or len(signal_events)),
                "signals_validated_count": int(performance.get("signals_validated_count") or len(validated_signal_list)),
                "signals_provisional_count": int(performance.get("signals_provisional_count") or provisional_count),
                "signals_candidate_count": int(performance.get("signals_candidate_count") or len(candidate_signal_list)),
                "signals_candidate_events_count": int(
                    performance.get("signals_candidate_events_count") or candidate_events_count
                ),
                "signals_diagnostic_count": int(performance.get("signals_diagnostic_count") or len(diagnostic_signal_list)),
                "planner_turn_count": int(performance.get("planner_turn_count") or 0),
                "planner_decision_parse_fail_count": int(performance.get("planner_decision_parse_fail_count") or 0),
                "planner_decision_applied_count": int(performance.get("planner_decision_applied_count") or 0),
                "planner_decision_applied_rate": float(performance.get("planner_decision_applied_rate") or 0.0),
                "planner_block_reason_counts": dict(performance.get("planner_block_reason_counts") or {}),
                "planner_branch_change_count": int(performance.get("planner_branch_change_count") or 0),
                "artifact_consistency_ok": bool(performance.get("artifact_consistency_ok", True)),
                "artifact_consistency_issues": list(performance.get("artifact_consistency_issues") or []),
                "compare_payload_missing": bool(performance.get("compare_payload_missing", False)),
                "winner_selection_missing": bool(performance.get("winner_selection_missing", False)),
                "planner_influence_unobserved": bool(performance.get("planner_influence_unobserved", False)),
                "credits_spent": int(performance.get("credits_spent") or 0),
                "credits_earned": int(performance.get("credits_earned") or 0),
                "entity_grounded_signal_count": int(performance.get("entity_grounded_signal_count") or discovery.get("entity_grounded_signal_count") or 0),
                "actionability_score": float(performance.get("actionability_score") or discovery.get("actionability_score") or 0.0),
                "off_entity_reject_rate": float(performance.get("off_entity_reject_rate") or 0.0),
                "metadata_coverage_score": metadata_coverage_score,
                "unknown_required_field_count": unknown_required_field_count,
                "metadata_missing_fields": metadata_missing_fields,
                "section_partial_timeout_count": int(section_partial_timeout_count),
                "sparse_fallback_section_count": sum(
                    1
                    for section in sections
                    if isinstance(section, dict)
                    and str(section.get("output_status") or "").strip().lower() in {"completed_with_sparse_fallback", "degraded_sparse_evidence"}
                ),
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
                "synthetic_url_attempt_count": int(performance.get("synthetic_url_attempt_count") or 0),
                "dead_end_event_count": int(performance.get("dead_end_event_count") or 0),
                "entity_grounding_reject_count_by_lane": entity_grounding_reject_count_by_lane,
                "pdf_binary_reject_count": int(performance.get("pdf_binary_reject_count") or 0),
                "non_english_source_reject_count": int(performance.get("non_english_source_reject_count") or 0),
                "off_entity_validated_signals": int(performance.get("off_entity_validated_signals") or 0),
                "fallback_accept_block_count": int(performance.get("fallback_accept_block_count") or 0),
                "llm_call_count": int(performance.get("llm_call_count") or 0),
                "llm_fallback_count": int(performance.get("llm_fallback_count") or 0),
                "length_stop_count": int(performance.get("length_stop_count") or 0),
                "schema_fail_count": int(performance.get("schema_fail_count") or 0),
                "empty_content_count": int(performance.get("empty_content_count") or 0),
                "strict_eval_metrics_by_model": performance.get("strict_eval_metrics_by_model") if isinstance(performance.get("strict_eval_metrics_by_model"), dict) else {},
                "accepted_empty_evidence_count": int(accepted_empty_evidence_count),
                "llm_circuit_broken": bool(performance.get("llm_circuit_broken", False)),
                "dual_write_required": dual_write_required,
                "discovery_controller": discovery_controller,
                "acceptance_mode": acceptance_gate.get("acceptance_mode"),
                "dual_write_ok": dual_write_ok,
                "runtime_preflight": dict(getattr(self, "_runtime_preflight", {}) or {}),
                "persistence_status": persistence_status if isinstance(persistence_status, dict) else None,
                "comparison_summary": comparison_payload if isinstance(comparison_payload, dict) else None,
                "winner_runtime": winner_runtime,
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
            "persistence_status": persistence_status if isinstance(persistence_status, dict) else None,
        }
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        report_path = self.run_reports_dir / f"{entity_id}_run_report_{timestamp}.json"
        report_payload = finalize_run_report_payload(report_payload, str(report_path))
        with open(report_path, "w") as report_file:
            json.dump(report_payload, report_file, indent=2, default=str)
        logger.info("🧾 Run report saved: %s", report_path)
        if acceptance_gate["passed"]:
            logger.info("✅ Acceptance gate passed")
        else:
            logger.warning("⚠️ Acceptance gate failed: %s", acceptance_gate["reasons"])
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
    parser.add_argument("--template-id", default="")
    parser.add_argument(
        "--profile",
        choices=["default", "fast-regression"],
        default="default",
        help="Runtime profile presets for repeatable benchmarking",
    )
    args = parser.parse_args()

    if args.profile == "fast-regression":
        os.environ["PIPELINE_PASS_A_ONLY"] = "true"
        os.environ["PIPELINE_ENFORCE_DISCOVERY_ITERATION_CAP"] = os.getenv(
            "PIPELINE_ENFORCE_DISCOVERY_ITERATION_CAP",
            "true",
        )
        os.environ["PIPELINE_PASS_A_MAX_ITERATIONS"] = os.getenv("PIPELINE_PASS_A_MAX_ITERATIONS", "2")
        os.environ["DOSSIER_PARALLEL_COLLECTION_TOTAL_BUDGET_SECONDS"] = os.getenv(
            "DOSSIER_PARALLEL_COLLECTION_TOTAL_BUDGET_SECONDS",
            "15",
        )
        os.environ["DOSSIER_PARALLEL_COLLECTION_MIN_REMAINING_SECONDS"] = os.getenv(
            "DOSSIER_PARALLEL_COLLECTION_MIN_REMAINING_SECONDS",
            "4",
        )
        os.environ["DOSSIER_SECTION_GENERATION_TIMEOUT_SECONDS"] = os.getenv(
            "DOSSIER_SECTION_GENERATION_TIMEOUT_SECONDS",
            "20",
        )
        os.environ["BRIGHTDATA_RENDERED_MAX_TOTAL_ATTEMPTS"] = os.getenv(
            "BRIGHTDATA_RENDERED_MAX_TOTAL_ATTEMPTS",
            "8",
        )
        logger.info("⚙️ Runtime profile enabled: fast-regression")

    discovery_engine = str(os.getenv("DISCOVERY_ENGINE", "v2") or "v2").strip().lower()
    use_legacy_template_routing = discovery_engine in {"legacy", "v1", "hypothesis"}
    requested_template_id = (args.template_id or "").strip() or None
    if use_legacy_template_routing:
        from backend.hypothesis_driven_discovery import (
            get_template_recommended_hop_cap,
            resolve_template_id,
        )

        resolved_template_id = resolve_template_id(
            requested_template_id,
            args.entity_type,
            entity_id=args.entity_id,
            entity_name=args.entity_name,
        )
        if args.max_discovery_iterations is None:
            resolved_max_iterations = get_template_recommended_hop_cap(resolved_template_id, fallback=5)
        else:
            resolved_max_iterations = max(1, int(args.max_discovery_iterations))
    else:
        resolved_template_id = requested_template_id
        if args.max_discovery_iterations is None:
            resolved_max_iterations = max(1, int(os.getenv("DISCOVERY_MAX_HOPS", "5")))
        else:
            resolved_max_iterations = max(1, int(args.max_discovery_iterations))
    logger.info(
        "🧭 Discovery runtime defaults: engine=%s template=%s max_iterations=%s",
        discovery_engine,
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
