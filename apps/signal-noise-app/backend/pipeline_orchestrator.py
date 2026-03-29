#!/usr/bin/env python3
"""
Canonical entity pipeline orchestrator.

This is the single backend entry point intended to run an entity through:
1. dossier generation
2. dossier-guided discovery
3. Ralph validation
4. temporal persistence
5. dashboard scoring
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import time
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Awaitable, Callable, Dict, List, Optional
from urllib.parse import urlparse

try:
    from backend.pipeline_run_metadata import canonicalize_phase_details_by_phase, build_phase_status_map
except ImportError:
    from pipeline_run_metadata import canonicalize_phase_details_by_phase, build_phase_status_map
try:
    from backend.persistence_coordinator import DualWritePersistenceCoordinator
except ImportError:
    from persistence_coordinator import DualWritePersistenceCoordinator
try:
    from backend.objective_profiles import DEFAULT_PIPELINE_OBJECTIVE, normalize_run_objective
except ImportError:
    from objective_profiles import DEFAULT_PIPELINE_OBJECTIVE, normalize_run_objective

logger = logging.getLogger(__name__)


@dataclass
class PipelineArtifacts:
    dossier: Dict[str, Any]
    discovery_result: Any
    validated_signals: List[Dict[str, Any]]
    episodes: List[Dict[str, Any]]
    scores: Dict[str, Any]


class PipelineOrchestrator:
    def __init__(
        self,
        dossier_generator,
        discovery,
        ralph_validator,
        graphiti_service,
        dashboard_scorer,
        baseline_monitoring_runner=None,
        persistence_coordinator=None,
        brightdata_client=None,
        claude_client=None,
    ):
        self.dossier_generator = dossier_generator
        self.discovery = discovery
        self.ralph_validator = ralph_validator
        self.graphiti_service = graphiti_service
        self.dashboard_scorer = dashboard_scorer
        self.baseline_monitoring_runner = baseline_monitoring_runner
        self.brightdata_client = brightdata_client
        self.claude_client = claude_client
        self.discovery_timeout_seconds = int(os.getenv("ENTITY_DISCOVERY_TIMEOUT_SECONDS", "90"))
        self.discovery_max_iterations = int(os.getenv("ENTITY_DISCOVERY_MAX_ITERATIONS", "8"))
        self.discovery_hard_timeout = os.getenv("ENTITY_DISCOVERY_HARD_TIMEOUT", "0").lower() in {"1", "true", "yes"}
        self.acceptance_min_confidence = float(os.getenv("PIPELINE_ACCEPTANCE_MIN_CONFIDENCE", "0.55"))
        self.acceptance_min_signals = int(os.getenv("PIPELINE_ACCEPTANCE_MIN_SIGNALS", "2"))
        self.run_profile = os.getenv("PIPELINE_RUN_PROFILE", "bounded_production")
        self.require_dual_write = os.getenv("PIPELINE_REQUIRE_DUAL_WRITE", "true").lower() in {"1", "true", "yes"}
        self.question_first_enabled = os.getenv("PIPELINE_QUESTION_FIRST_ENABLED", "false").lower() in {"1", "true", "yes"}
        self.question_first_persist_reports = os.getenv("PIPELINE_QUESTION_FIRST_PERSIST_REPORTS", "true").lower() in {"1", "true", "yes"}
        self.question_first_output_dir = os.getenv("PIPELINE_QUESTION_FIRST_OUTPUT_DIR", "backend/data/question_first_dossiers")
        self.question_first_max_questions = int(os.getenv("PIPELINE_QUESTION_FIRST_MAX_QUESTIONS", "0") or 0)
        self.question_first_brightdata_timeout = float(os.getenv("PIPELINE_QUESTION_FIRST_BRIGHTDATA_TIMEOUT_SECONDS", "60"))
        self._last_question_first_report: Dict[str, Any] | None = None
        self.persistence_coordinator = persistence_coordinator or self._build_default_persistence_coordinator()

    def _build_default_persistence_coordinator(self):
        supabase_writer = getattr(self.graphiti_service, "persist_pipeline_record_supabase", None)
        falkordb_writer = getattr(self.graphiti_service, "persist_pipeline_record_falkordb", None)
        return DualWritePersistenceCoordinator(
            supabase_writer=supabase_writer if callable(supabase_writer) else None,
            falkordb_writer=falkordb_writer if callable(falkordb_writer) else None,
            max_attempts=int(os.getenv("PIPELINE_DUAL_WRITE_MAX_ATTEMPTS", "3")),
        )
    async def run_entity_pipeline(
        self,
        entity_id: str,
        entity_name: str,
        entity_type: str = "CLUB",
        priority_score: int = 50,
        run_objective: Optional[str] = None,
        initial_dossier: Optional[Dict[str, Any]] = None,
        phase_callback: Optional[Callable[[str, Dict[str, Any]], Awaitable[None]]] = None,
    ) -> Dict[str, Any]:
        logger.warning("🚦 Pipeline boundary: orchestrator:start")
        requested_objective = str(run_objective or "").strip().lower() or DEFAULT_PIPELINE_OBJECTIVE
        objective = normalize_run_objective(requested_objective, default=DEFAULT_PIPELINE_OBJECTIVE)
        dossier_objective_default = (
            "leadership_enrichment"
            if self.question_first_enabled or objective == "procurement_discovery"
            else objective
        )
        dossier_objective = normalize_run_objective(
            os.getenv("PIPELINE_DOSSIER_OBJECTIVE", dossier_objective_default),
            default=dossier_objective_default,
        )
        phase_objectives = {
            "dossier_generation": dossier_objective,
            "discovery": objective,
            "ralph_validation": objective,
            "temporal_persistence": objective,
            "dashboard_scoring": objective,
        }
        run_id = f"{entity_id}-{int(time.time())}"
        phase_results: Dict[str, Dict[str, Any]] = {
            "dossier_generation": {"status": "pending"},
            "discovery": {"status": "pending"},
            "ralph_validation": {"status": "pending"},
            "temporal_persistence": {"status": "pending"},
            "dashboard_scoring": {"status": "pending"},
        }
        step_artifacts: List[Dict[str, Any]] = []
        dossier = initial_dossier
        if dossier is None:
            await self._emit_phase_update(phase_callback, "dossier_generation", {"status": "running"})
            dossier = await self._run_dossier_generation(
                entity_id=entity_id,
                entity_name=entity_name,
                entity_type=entity_type,
                priority_score=priority_score,
                run_objective=phase_objectives["dossier_generation"],
            )
            dossier = self._coerce_dossier_payload(dossier)
            if self.question_first_enabled:
                logger.warning("🚦 Pipeline boundary: question_first_enrichment:start")
                await self._emit_phase_update(phase_callback, "dossier_generation", {"status": "question_first_running"})
                dossier = await self._run_question_first_enrichment(
                    dossier=dossier,
                    entity_id=entity_id,
                    entity_name=entity_name,
                )
                question_first_meta = (dossier.get("question_first") or {}) if isinstance(dossier, dict) else {}
                self._last_question_first_report = question_first_meta.get("report") if isinstance(question_first_meta, dict) else None
                await self._emit_phase_update(
                    phase_callback,
                    "dossier_generation",
                    {
                        "status": "question_first_completed",
                        "questions_answered": int(question_first_meta.get("questions_answered") or 0),
                        "category_count": len(question_first_meta.get("categories") or []),
                    },
                )
                logger.warning("🚦 Pipeline boundary: question_first_enrichment:complete")
            await self._emit_phase_update(
                phase_callback,
                "dossier_generation",
                {
                    "status": "completed",
                    "hypothesis_count": dossier.get("metadata", {}).get("hypothesis_count", 0),
                    "signal_count": dossier.get("metadata", {}).get("signal_count", 0),
                },
            )
            phase_results["dossier_generation"] = {
                "status": "completed",
                "hypothesis_count": dossier.get("metadata", {}).get("hypothesis_count", 0),
                "signal_count": dossier.get("metadata", {}).get("signal_count", 0),
            }
            step_artifacts.extend(self._build_dossier_step_artifacts(dossier=dossier, entity_id=entity_id))
        else:
            dossier = self._coerce_dossier_payload(dossier)
            phase_results["dossier_generation"] = {"status": "completed"}
            step_artifacts.extend(self._build_dossier_step_artifacts(dossier=dossier, entity_id=entity_id))

        discovery_result: Any = {"signals_discovered": [], "hypotheses": []}
        raw_signals: List[Dict[str, Any]] = []
        ralph_result: Dict[str, Any] = self._coerce_ralph_result([])
        validated_signals: List[Dict[str, Any]] = []
        capability_signals: List[Dict[str, Any]] = []
        validated_rfps: List[Dict[str, Any]] = []
        episodes: List[Dict[str, Any]] = []

        try:
            logger.warning("🚦 Pipeline boundary: discovery:start")
            await self._emit_phase_update(phase_callback, "discovery", {"status": "running"})
            discovery_result = await self._run_discovery(
                entity_id=entity_id,
                entity_name=entity_name,
                entity_type=entity_type,
                dossier=dossier,
                phase_callback=phase_callback,
                run_objective=phase_objectives["discovery"],
            )
            discovery_budget = getattr(self, "_last_discovery_budget", {})
            raw_signals = self._extract_raw_signals(discovery_result)
            phase_results["discovery"] = {
                "status": "completed",
                "signals_discovered": len(raw_signals),
                "final_confidence": getattr(discovery_result, "final_confidence", None),
                **discovery_budget,
            }
            step_artifacts.extend(self._build_discovery_step_artifacts(discovery_result=discovery_result))
            await self._emit_phase_update(phase_callback, "discovery", phase_results["discovery"])
            logger.warning("🚦 Pipeline boundary: discovery:complete")
        except Exception as exc:
            error_message = "Discovery timed out" if isinstance(exc, TimeoutError) else str(exc)
            logger.exception("Discovery phase failed for %s: %s", entity_id, error_message)
            phase_results["discovery"] = {"status": "failed", "error": error_message}
            phase_results["ralph_validation"] = {"status": "skipped", "reason": "discovery_failed"}
            phase_results["temporal_persistence"] = {"status": "skipped", "reason": "discovery_failed"}
            await self._emit_phase_update(phase_callback, "discovery", phase_results["discovery"])
            await self._emit_phase_update(phase_callback, "ralph_validation", phase_results["ralph_validation"])
            await self._emit_phase_update(phase_callback, "temporal_persistence", phase_results["temporal_persistence"])
        else:
            try:
                await self._emit_phase_update(phase_callback, "ralph_validation", {"status": "running"})
                raw_ralph_result = await self._run_ralph_validation(
                    entity_id=entity_id,
                    raw_signals=raw_signals,
                )
                ralph_result = self._coerce_ralph_result(raw_ralph_result)
                validated_signals = self._normalize_validated_signals(ralph_result.get("validated_signals", []))
                capability_signals = self._normalize_validated_signals(ralph_result.get("capability_signals", []))
                validated_rfps = [signal for signal in validated_signals if self._is_rfp_signal(signal)]
                phase_results["ralph_validation"] = {
                    "status": "completed",
                    "validated_signal_count": len(validated_signals),
                    "capability_signal_count": len(capability_signals),
                    "rfp_count": len(validated_rfps),
                }
                step_artifacts.extend(self._build_ralph_step_artifacts(ralph_result=ralph_result))
                await self._emit_phase_update(phase_callback, "ralph_validation", phase_results["ralph_validation"])
            except Exception as exc:
                error_message = "Ralph validation timed out" if isinstance(exc, TimeoutError) else str(exc)
                logger.exception("Ralph validation failed for %s: %s", entity_id, error_message)
                phase_results["ralph_validation"] = {"status": "failed", "error": error_message}
                phase_results["temporal_persistence"] = {"status": "skipped", "reason": "ralph_validation_failed"}
                await self._emit_phase_update(phase_callback, "ralph_validation", phase_results["ralph_validation"])
                await self._emit_phase_update(phase_callback, "temporal_persistence", phase_results["temporal_persistence"])
            else:
                try:
                    await self._emit_phase_update(phase_callback, "temporal_persistence", {"status": "running"})
                    episodes = await self._run_temporal_persistence(
                        entity_id=entity_id,
                        entity_name=entity_name,
                        validated_signals=validated_signals,
                    )
                    phase_results["temporal_persistence"] = {
                        "status": "completed",
                        "episode_count": len(episodes),
                    }
                    await self._emit_phase_update(phase_callback, "temporal_persistence", phase_results["temporal_persistence"])
                except Exception as exc:
                    error_message = "Temporal persistence timed out" if isinstance(exc, TimeoutError) else str(exc)
                    logger.exception("Temporal persistence failed for %s: %s", entity_id, error_message)
                    phase_results["temporal_persistence"] = {"status": "failed", "error": error_message}
                    await self._emit_phase_update(phase_callback, "temporal_persistence", phase_results["temporal_persistence"])

        await self._emit_phase_update(phase_callback, "dashboard_scoring", {"status": "running"})
        logger.warning("🚦 Pipeline boundary: dashboard_scoring:start")
        scores = await self._run_dashboard_scoring(
            entity_id=entity_id,
            entity_name=entity_name,
            discovery_result=discovery_result,
            validated_signals=validated_signals,
            validated_rfps=validated_rfps,
            episodes=episodes,
        )
        await self._emit_phase_update(
            phase_callback,
            "dashboard_scoring",
            {
                "status": "completed",
                "sales_readiness": scores.get("sales_readiness"),
                "active_probability": scores.get("active_probability"),
                "procurement_maturity": scores.get("procurement_maturity"),
            },
        )
        phase_results["dashboard_scoring"] = {
            "status": "completed",
            "sales_readiness": scores.get("sales_readiness"),
            "active_probability": scores.get("active_probability"),
            "procurement_maturity": scores.get("procurement_maturity"),
        }
        logger.warning("🚦 Pipeline boundary: dashboard_scoring:complete")
        failure_taxonomy = self._build_failure_taxonomy(
            discovery_result=discovery_result,
            phase_results=phase_results,
            raw_signals=raw_signals,
        )
        temporal_status = str((phase_results.get("temporal_persistence") or {}).get("status") or "").lower()
        step_persistence_status: Dict[str, Any] = {
            "total_count": len(step_artifacts),
            "persisted_count": 0,
            "failed_count": len(step_artifacts),
            "dual_write_ok": False,
            "status_matrix": [],
            "reconcile_required": False,
            "reconciliation_payloads": [],
            "failure_taxonomy": {
                "supabase_write_failure": 0,
                "falkordb_write_failure": 0,
                "dual_write_incomplete": 0,
            },
        }
        if temporal_status == "completed":
            persistence_status = await self.persistence_coordinator.persist_run_artifacts(
                run_id=run_id,
                entity_id=entity_id,
                phase="dashboard_scoring",
                record_type="pipeline_run",
                record_id=entity_id,
                payload={
                    "entity_name": entity_name,
                    "entity_type": entity_type,
                    "dossier": dossier,
                    "discovery_result": self._serialize_discovery_result(discovery_result),
                    "scores": scores,
                    "phase_results": phase_results,
                    "validated_signal_count": len(validated_signals),
                    "rfp_count": len(validated_rfps),
                    "requested_objective": requested_objective,
                    "effective_objective": objective,
                    "phase_objectives": phase_objectives,
                },
            )
            step_persistence_status = await self.persistence_coordinator.persist_step_artifacts(
                run_id=run_id,
                entity_id=entity_id,
                phase="pipeline_steps",
                artifacts=step_artifacts,
            )
        else:
            persistence_status = {
                "dual_write_ok": False,
                "supabase": {"ok": False, "attempts": 0, "error_class": "phase_not_completed"},
                "falkordb": {"ok": False, "attempts": 0, "error_class": "phase_not_completed"},
                "reconcile_required": False,
                "reconciliation_payload": None,
            }
        dual_write_ok = bool(persistence_status.get("dual_write_ok"))
        step_dual_write_ok = bool(step_persistence_status.get("dual_write_ok"))
        if temporal_status == "completed" and self.require_dual_write and not dual_write_ok:
            phase_results["temporal_persistence"] = {
                "status": "failed",
                "error": "dual_write_incomplete",
            }
            failure_taxonomy["supabase_write_failure"] = int(not (persistence_status.get("supabase") or {}).get("ok"))
            failure_taxonomy["falkordb_write_failure"] = int(not (persistence_status.get("falkordb") or {}).get("ok"))
            failure_taxonomy["dual_write_incomplete"] = 1
        else:
            failure_taxonomy["supabase_write_failure"] = 0
            failure_taxonomy["falkordb_write_failure"] = 0
            failure_taxonomy["dual_write_incomplete"] = 0
        step_failure_taxonomy = step_persistence_status.get("failure_taxonomy", {})
        failure_taxonomy["supabase_write_failure"] = max(
            int(failure_taxonomy.get("supabase_write_failure", 0) or 0),
            int(step_failure_taxonomy.get("supabase_write_failure", 0) or 0),
        )
        failure_taxonomy["falkordb_write_failure"] = max(
            int(failure_taxonomy.get("falkordb_write_failure", 0) or 0),
            int(step_failure_taxonomy.get("falkordb_write_failure", 0) or 0),
        )
        failure_taxonomy["dual_write_incomplete"] = max(
            int(failure_taxonomy.get("dual_write_incomplete", 0) or 0),
            int(step_failure_taxonomy.get("dual_write_incomplete", 0) or 0),
        )
        step_artifact_counts = {
            "total": int(step_persistence_status.get("total_count", len(step_artifacts)) or 0),
            "persisted": int(step_persistence_status.get("persisted_count", 0) or 0),
            "failed": int(step_persistence_status.get("failed_count", 0) or 0),
        }
        acceptance_gate = self._build_acceptance_gate(
            discovery_result=discovery_result,
            phase_results=phase_results,
            raw_signals=raw_signals,
            validated_signals=validated_signals,
            dual_write_ok=bool(dual_write_ok and step_dual_write_ok),
            enforce_dual_write_gate=(temporal_status == "completed"),
        )
        acceptance_step_artifact = self._build_acceptance_step_artifact(
            discovery_result=discovery_result,
            validated_signals=validated_signals,
            dual_write_ok=bool(dual_write_ok and step_dual_write_ok),
            provisional=False,
        )
        step_artifacts.append(acceptance_step_artifact)
        if temporal_status == "completed":
            acceptance_persistence = await self.persistence_coordinator.persist_step_artifacts(
                run_id=run_id,
                entity_id=entity_id,
                phase="acceptance_scoring",
                artifacts=[acceptance_step_artifact],
            )
            step_persistence_status["total_count"] = int(step_persistence_status.get("total_count", 0) or 0) + int(
                acceptance_persistence.get("total_count", 0) or 0
            )
            step_persistence_status["persisted_count"] = int(
                step_persistence_status.get("persisted_count", 0) or 0
            ) + int(acceptance_persistence.get("persisted_count", 0) or 0)
            step_persistence_status["failed_count"] = int(step_persistence_status.get("failed_count", 0) or 0) + int(
                acceptance_persistence.get("failed_count", 0) or 0
            )
            step_persistence_status["status_matrix"] = list(step_persistence_status.get("status_matrix") or []) + list(
                acceptance_persistence.get("status_matrix") or []
            )
            step_persistence_status["reconciliation_payloads"] = list(
                step_persistence_status.get("reconciliation_payloads") or []
            ) + list(acceptance_persistence.get("reconciliation_payloads") or [])
            step_persistence_status["reconcile_required"] = bool(
                step_persistence_status.get("reconcile_required")
                or acceptance_persistence.get("reconcile_required")
            )
            base_failure_taxonomy = step_persistence_status.get("failure_taxonomy", {}) or {}
            add_failure_taxonomy = acceptance_persistence.get("failure_taxonomy", {}) or {}
            step_persistence_status["failure_taxonomy"] = {
                "supabase_write_failure": int(base_failure_taxonomy.get("supabase_write_failure", 0) or 0)
                + int(add_failure_taxonomy.get("supabase_write_failure", 0) or 0),
                "falkordb_write_failure": int(base_failure_taxonomy.get("falkordb_write_failure", 0) or 0)
                + int(add_failure_taxonomy.get("falkordb_write_failure", 0) or 0),
                "dual_write_incomplete": int(
                    (base_failure_taxonomy.get("dual_write_incomplete", 0) or 0)
                    or (add_failure_taxonomy.get("dual_write_incomplete", 0) or 0)
                ),
            }
            step_persistence_status["dual_write_ok"] = int(step_persistence_status.get("failed_count", 0) or 0) == 0
        degraded_mode = any(
            (details or {}).get("status") in {"failed", "skipped"}
            for details in phase_results.values()
            if isinstance(details, dict)
        )

        canonical_phase_details = canonicalize_phase_details_by_phase(phase_results)
        logger.warning("🚦 Pipeline boundary: orchestrator:complete")
        return {
            "entity_id": entity_id,
            "entity_name": entity_name,
            "run_id": run_id,
            "requested_objective": requested_objective,
            "effective_objective": objective,
            "phase_objectives": phase_objectives,
            "objective": objective,
            "objective_result": {
                "validated_signal_count": len(validated_signals),
                "rfp_count": len(validated_rfps),
                "final_confidence": getattr(discovery_result, "final_confidence", None),
                "acceptance_passed": bool(acceptance_gate.get("passed")),
                "acceptance_mode": acceptance_gate.get("acceptance_mode"),
                "acceptance_reasons": acceptance_gate.get("reasons", []),
                "validated_event_signal_count": int(acceptance_gate.get("observed", {}).get("validated_event_signals") or 0),
            },
            "llm_efficiency_metrics": self._extract_llm_efficiency_metrics(discovery_result),
            "phases": build_phase_status_map(canonical_phase_details),
            "phase_details_by_phase": deepcopy(canonical_phase_details),
            "validated_signal_count": len(validated_signals),
            "capability_signal_count": len(capability_signals),
            "rfp_count": len(validated_rfps),
            "sales_readiness": scores.get("sales_readiness"),
            "acceptance_gate": acceptance_gate,
            "failure_taxonomy": failure_taxonomy,
            "run_profile": self.run_profile,
            "degraded_mode": degraded_mode,
            "dual_write_ok": bool(dual_write_ok and step_dual_write_ok),
            "persistence_status": {
                **persistence_status,
                "step_artifacts": step_persistence_status,
                "dual_write_ok": bool(dual_write_ok and step_dual_write_ok),
            },
            "step_artifact_counts": step_artifact_counts,
            "step_failure_taxonomy": step_failure_taxonomy,
            "artifacts": {
                "dossier_id": entity_id,
                "dossier": dossier,
                "discovery_result": self._serialize_discovery_result(discovery_result),
                "validated_signals": validated_signals,
                "capability_signals": capability_signals,
                "episodes": episodes,
                "scores": scores,
                "hypothesis_states": ralph_result.get("hypothesis_states", {}),
                "step_artifacts": step_artifacts,
            },
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }

    async def _run_dossier_generation(
        self,
        entity_id: str,
        entity_name: str,
        entity_type: str,
        priority_score: int,
        run_objective: str,
    ) -> Dict[str, Any]:
        universal = getattr(self.dossier_generator, "generate_universal_dossier", None)
        if callable(universal):
            return await universal(
                entity_id=entity_id,
                entity_name=entity_name,
                entity_type=entity_type,
                priority_score=priority_score,
                run_objective=run_objective,
            )

        try:
            return await self.dossier_generator.generate_dossier(
                entity_id=entity_id,
                entity_name=entity_name,
                entity_type=entity_type,
                priority_score=priority_score,
                run_objective=run_objective,
            )
        except TypeError:
            return await self.dossier_generator.generate_dossier(
                entity_id=entity_id,
                entity_name=entity_name,
                entity_type=entity_type,
                priority_score=priority_score,
            )

    async def _run_discovery(
        self,
        entity_id: str,
        entity_name: str,
        entity_type: str,
        dossier: Dict[str, Any],
        run_objective: str,
        phase_callback: Optional[Callable[[str, Dict[str, Any]], Awaitable[None]]] = None,
    ):
        started_at = time.perf_counter()

        async def emit_discovery_progress(payload: Dict[str, Any]) -> None:
            await self._emit_phase_update(phase_callback, "discovery", payload)

        discovery_coro = self.discovery.run_discovery_with_dossier_context(
            entity_id=entity_id,
            entity_name=entity_name,
            dossier=dossier,
            entity_type=entity_type,
            max_iterations=self.discovery_max_iterations,
            progress_callback=emit_discovery_progress,
            run_objective=run_objective,
        )

        if self.discovery_hard_timeout:
            result = await asyncio.wait_for(discovery_coro, timeout=self.discovery_timeout_seconds)
        else:
            result = await discovery_coro

        elapsed_seconds = round(time.perf_counter() - started_at, 2)
        budget_exceeded = elapsed_seconds > self.discovery_timeout_seconds
        self._last_discovery_budget = {
            "duration_seconds": elapsed_seconds,
            "budget_seconds": self.discovery_timeout_seconds,
            "budget_exceeded": budget_exceeded,
            "timeout_mode": "hard" if self.discovery_hard_timeout else "soft",
        }

        return result

    def _extract_llm_efficiency_metrics(self, discovery_result: Any) -> Dict[str, int]:
        summary = (
            getattr(discovery_result, "performance_summary", None)
            if discovery_result is not None
            else None
        )
        if not isinstance(summary, dict):
            return {
                "llm_call_count": 0,
                "llm_fallback_count": 0,
                "length_stop_count": 0,
                "schema_fail_count": 0,
            }
        return {
            "llm_call_count": int(summary.get("llm_call_count", 0) or 0),
            "llm_fallback_count": int(summary.get("llm_fallback_count", 0) or 0),
            "length_stop_count": int(summary.get("length_stop_count", 0) or 0),
            "schema_fail_count": int(summary.get("schema_fail_count", 0) or 0),
        }

    async def _run_ralph_validation(
        self,
        entity_id: str,
        raw_signals: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        return await self.ralph_validator.validate_signals(raw_signals, entity_id)

    async def _run_temporal_persistence(
        self,
        entity_id: str,
        entity_name: str,
        validated_signals: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        episodes: List[Dict[str, Any]] = []

        if not validated_signals and hasattr(self.graphiti_service, "add_discovery_episode"):
            no_signal_episode = await self.graphiti_service.add_discovery_episode(
                entity_id=entity_id,
                entity_name=entity_name,
                entity_type="Entity",
                episode_type="NO_SIGNAL_FOUND",
                description="No validated signals remained after Ralph validation",
                source="pipeline_orchestrator",
                confidence=0.0,
                url=None,
                metadata={
                    "entity_id": entity_id,
                    "signal_type": "NO_SIGNAL_FOUND",
                    "reason_code": "post_ralph_no_validated_signals",
                },
            )
            episodes.append(no_signal_episode)

        for signal in validated_signals:
            if self._is_rfp_signal(signal):
                episode = await self.graphiti_service.add_rfp_episode({
                    "rfp_id": signal.get("id") or f"{entity_id}-rfp",
                    "organization": entity_name,
                    "entity_type": "Entity",
                    "title": signal.get("statement") or signal.get("text") or "Validated RFP signal",
                    "url": signal.get("url"),
                    "confidence_score": signal.get("confidence"),
                    "metadata": {
                        "entity_id": entity_id,
                        "signal_type": signal.get("type"),
                    },
                })
                episodes.append(episode)
                if hasattr(self.graphiti_service, "persist_unified_rfp"):
                    await self.graphiti_service.persist_unified_rfp(
                        self._build_unified_rfp_record(
                            entity_id=entity_id,
                            entity_name=entity_name,
                            signal=signal,
                            episode=episode,
                        )
                    )
            elif hasattr(self.graphiti_service, "add_discovery_episode"):
                episode = await self.graphiti_service.add_discovery_episode(
                    entity_id=entity_id,
                    entity_name=entity_name,
                    entity_type="Entity",
                    episode_type=signal.get("type", "DISCOVERY_SIGNAL"),
                    description=signal.get("statement") or signal.get("text") or "Validated discovery signal",
                    source="pipeline_orchestrator",
                    confidence=signal.get("confidence"),
                    url=signal.get("url"),
                    metadata={
                        "entity_id": entity_id,
                        "signal_type": signal.get("type"),
                    },
                )
                episodes.append(episode)

        if hasattr(self.graphiti_service, "get_entity_timeline"):
            return await self.graphiti_service.get_entity_timeline(entity_id, limit=50)

        return episodes

    async def _run_dashboard_scoring(
        self,
        entity_id: str,
        entity_name: str,
        discovery_result: Any,
        validated_signals: List[Dict[str, Any]],
        validated_rfps: List[Dict[str, Any]],
        episodes: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        hypotheses = getattr(discovery_result, "hypotheses", [])
        return await self.dashboard_scorer.calculate_entity_scores(
            entity_id=entity_id,
            entity_name=entity_name,
            hypotheses=hypotheses,
            signals=validated_signals,
            episodes=episodes,
            validated_rfps=validated_rfps,
        )

    async def _run_question_first_enrichment(
        self,
        *,
        dossier: Dict[str, Any],
        entity_id: str,
        entity_name: str,
    ) -> Dict[str, Any]:
        questions = dossier.get("questions")
        if not isinstance(questions, list) or not questions:
            logger.info("Question-first enrichment skipped for %s: no questions on dossier", entity_id)
            return dossier
        if self.brightdata_client is None or self.claude_client is None:
            logger.info("Question-first enrichment skipped for %s: missing clients", entity_id)
            return dossier

        try:
            from backend import question_first_dossier_runner as question_first_runner
        except ImportError:
            import question_first_dossier_runner as question_first_runner  # type: ignore

        max_questions = self.question_first_max_questions if int(self.question_first_max_questions or 0) > 0 else None
        report = await question_first_runner.run_question_first_dossier_from_payload(
            source_payload=dossier,
            output_dir=Path(self.question_first_output_dir) if self.question_first_persist_reports else None,
            brightdata_client=getattr(self, "brightdata_client", None),
            claude_client=getattr(self, "claude_client", None),
            max_questions=max_questions,
            brightdata_timeout=self.question_first_brightdata_timeout,
            question_source_label=f"{entity_id}::question-first",
        )
        enriched = question_first_runner.merge_question_first_report_into_dossier(
            dossier_payload=dossier,
            report=report,
        )
        return enriched if isinstance(enriched, dict) else dossier

    def _extract_raw_signals(self, discovery_result: Any) -> List[Dict[str, Any]]:
        if isinstance(discovery_result, dict):
            raw_signals = discovery_result.get("raw_signals")
            if isinstance(raw_signals, list):
                return [item for item in raw_signals if isinstance(item, dict)]
            merged: List[Dict[str, Any]] = []
            for key in ("signals_discovered", "provisional_signals", "candidate_signals"):
                values = discovery_result.get(key)
                if isinstance(values, list):
                    merged.extend([item for item in values if isinstance(item, dict)])
            return merged
        raw_signals = getattr(discovery_result, "raw_signals", None)
        if isinstance(raw_signals, list):
            return [item for item in raw_signals if isinstance(item, dict)]
        merged: List[Dict[str, Any]] = []
        for key in ("signals_discovered", "provisional_signals", "candidate_signals"):
            values = getattr(discovery_result, key, None)
            if isinstance(values, list):
                merged.extend([item for item in values if isinstance(item, dict)])
        return merged

    async def _emit_phase_update(
        self,
        callback: Optional[Callable[[str, Dict[str, Any]], Awaitable[None]]],
        phase: str,
        payload: Dict[str, Any],
    ) -> None:
        if callback is not None:
            await callback(phase, payload)

    def _coerce_ralph_result(self, result: Any) -> Dict[str, Any]:
        if isinstance(result, dict):
            return result

        if isinstance(result, list):
            return {
                "validated_signals": result,
                "capability_signals": [],
                "hypothesis_states": {},
            }

        return {
            "validated_signals": [],
            "capability_signals": [],
            "hypothesis_states": {},
        }

    def _coerce_dossier_payload(self, dossier: Any) -> Dict[str, Any]:
        if isinstance(dossier, dict):
            payload = dict(dossier)
        else:
            to_dict = getattr(dossier, "to_dict", None)
            if callable(to_dict):
                payload = to_dict()
                if not isinstance(payload, dict):
                    payload = {}
            else:
                payload = {}

        metadata = payload.get("metadata")
        if not isinstance(metadata, dict):
            attr_metadata = getattr(dossier, "metadata", None)
            metadata = dict(attr_metadata) if isinstance(attr_metadata, dict) else {}
            payload["metadata"] = metadata

        if isinstance(metadata, dict):
            canonical_sources = metadata.get("canonical_sources")
            if not isinstance(canonical_sources, dict):
                canonical_sources = {}
                metadata["canonical_sources"] = canonical_sources
            website_candidate = metadata.get("website")
            if website_candidate and not canonical_sources.get("official_site"):
                canonical_sources["official_site"] = website_candidate
            if not metadata.get("website"):
                section_host = self._extract_website_from_core_section(payload)
                if section_host:
                    metadata["website"] = section_host
                    canonical_sources.setdefault("official_site", section_host)

        return payload

    @staticmethod
    def _extract_website_from_core_section(payload: Dict[str, Any]) -> Optional[str]:
        sections = payload.get("sections")
        if not isinstance(sections, list):
            return None
        for section in sections:
            if not isinstance(section, dict):
                continue
            if str(section.get("id") or "").strip().lower() != "core_information":
                continue
            content_lines = section.get("content")
            if not isinstance(content_lines, list):
                continue
            joined = " ".join(str(line or "") for line in content_lines)
            match = re.search(
                r"\b(?:https?://)?(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:/[a-z0-9._~:/?#@!$&'()*+,;=-]*)?\b",
                joined,
                flags=re.IGNORECASE,
            )
            if not match:
                continue
            candidate = str(match.group(0) or "").strip()
            if not candidate:
                continue
            if not candidate.startswith(("http://", "https://")):
                candidate = f"https://{candidate.lstrip('/')}"
            return candidate.rstrip("/")
        return None

    def _normalize_validated_signals(self, signals: List[Any]) -> List[Dict[str, Any]]:
        normalized_signals: List[Dict[str, Any]] = []

        for signal in signals:
            if isinstance(signal, dict):
                metadata = signal.get("metadata") if isinstance(signal.get("metadata"), dict) else {}
                evidence_pointer_ids = signal.get("evidence_pointer_ids")
                if not isinstance(evidence_pointer_ids, list):
                    evidence_pointer_ids = metadata.get("evidence_pointer_ids")
                if not isinstance(evidence_pointer_ids, list):
                    evidence_pointer_ids = []
                normalized_signal = dict(signal)
                normalized_signal["validation_state"] = str(
                    signal.get("validation_state") or "validated"
                ).strip().lower()
                normalized_signal["accept_guard_passed"] = bool(signal.get("accept_guard_passed", True))
                normalized_signal["evidence_pointer_ids"] = evidence_pointer_ids
                normalized_signals.append(normalized_signal)
                continue

            signal_type = getattr(signal, "signal_class", None) or getattr(getattr(signal, "type", None), "value", None) or getattr(signal, "type", None)
            subtype = getattr(getattr(signal, "subtype", None), "value", None) or getattr(signal, "subtype", None)
            text = getattr(signal, "statement", None) or getattr(signal, "text", None) or getattr(signal, "summary", None)
            if not text:
                metadata = getattr(signal, "metadata", {}) or {}
                text = metadata.get("statement") or metadata.get("text") or metadata.get("summary")

            normalized_signals.append({
                "id": getattr(signal, "id", None),
                "type": signal_type,
                "subtype": subtype,
                "confidence": getattr(signal, "confidence", None),
                "statement": text,
                "text": text,
                "url": getattr(signal, "source_url", None),
                "entity_id": getattr(signal, "entity_id", None),
                "metadata": getattr(signal, "metadata", {}) or {},
                "validation_state": "validated",
                "accept_guard_passed": True,
                "evidence_pointer_ids": (
                    ((getattr(signal, "metadata", {}) or {}).get("evidence_pointer_ids"))
                    or []
                ),
            })

        return normalized_signals

    def _build_dossier_step_artifacts(self, *, dossier: Dict[str, Any], entity_id: str) -> List[Dict[str, Any]]:
        metadata = dossier.get("metadata") if isinstance(dossier.get("metadata"), dict) else {}
        field_rows = metadata.get("field_extraction_results") if isinstance(metadata, dict) else []
        if not isinstance(field_rows, list):
            field_rows = []
        artifacts: List[Dict[str, Any]] = []
        for index, row in enumerate(field_rows):
            if not isinstance(row, dict):
                continue
            artifacts.append(
                {
                    "step_type": "dossier_field_extraction",
                    "step_id": str(row.get("field_id") or f"field_{index + 1}"),
                    "status": str(row.get("status") or "completed"),
                    "reason_code": str(row.get("reason_code") or "validated"),
                    "source_url": row.get("source_url"),
                    "source_tier": row.get("source_tier"),
                    "evidence_pointer_ids": row.get("evidence_pointer_ids") or [],
                    "content_hash": row.get("content_hash"),
                    "parse_path": str(row.get("parse_path") or "dossier_field_contract_v1"),
                    "model_used": str(row.get("model_used") or "deterministic"),
                    "schema_valid": bool(row.get("schema_valid", True)),
                }
            )
        if not artifacts:
            artifacts.append(
                {
                    "step_type": "dossier_field_extraction",
                    "step_id": f"{entity_id}:field_contract_placeholder",
                    "status": "completed",
                    "reason_code": "no_structured_fields_available",
                    "source_url": None,
                    "source_tier": None,
                    "evidence_pointer_ids": [],
                    "content_hash": None,
                    "parse_path": "dossier_field_contract_v1_placeholder",
                    "model_used": "deterministic",
                    "schema_valid": True,
                }
            )
        return artifacts

    def _build_discovery_step_artifacts(self, *, discovery_result: Any) -> List[Dict[str, Any]]:
        payload = self._serialize_discovery_result(discovery_result)
        candidate_evaluations = payload.get("candidate_evaluations") or []
        if not isinstance(candidate_evaluations, list):
            candidate_evaluations = []
        artifacts: List[Dict[str, Any]] = []
        for index, item in enumerate(candidate_evaluations):
            if not isinstance(item, dict):
                continue
            artifacts.append(
                {
                    "step_type": "discovery_candidate_eval",
                    "step_id": str(item.get("step_id") or f"candidate_{index + 1}"),
                    "status": str(item.get("status") or "completed"),
                    "reason_code": str(item.get("reason_code") or "evaluated"),
                    "source_url": item.get("source_url"),
                    "source_tier": item.get("source_tier"),
                    "evidence_pointer_ids": item.get("evidence_pointer_ids") or [],
                    "content_hash": item.get("content_hash"),
                    "parse_path": str(item.get("parse_path") or "discovery_v2_candidate_eval"),
                    "model_used": str(item.get("model_used") or "haiku"),
                    "schema_valid": bool(item.get("schema_valid", False)),
                }
            )
        return artifacts

    def _build_ralph_step_artifacts(self, *, ralph_result: Dict[str, Any]) -> List[Dict[str, Any]]:
        validations = ralph_result.get("signal_validations") if isinstance(ralph_result, dict) else []
        if not isinstance(validations, list):
            validations = []
        artifacts: List[Dict[str, Any]] = []
        for index, item in enumerate(validations):
            if not isinstance(item, dict):
                continue
            status = "completed" if str(item.get("decision") or "").upper() == "ACCEPT" else "rejected"
            artifacts.append(
                {
                    "step_type": "ralph_signal_validation",
                    "step_id": str(item.get("signal_id") or f"signal_{index + 1}"),
                    "status": status,
                    "reason_code": str(item.get("reason_code") or "validated"),
                    "source_url": None,
                    "source_tier": None,
                    "evidence_pointer_ids": item.get("evidence_pointer_ids") or [],
                    "content_hash": None,
                    "parse_path": str(item.get("parse_path") or "ralph_pass2_json_contract"),
                    "model_used": str(item.get("model_used") or "haiku"),
                    "schema_valid": bool(item.get("schema_valid", False)),
                }
            )
        aggregation = ralph_result.get("aggregation_summary") if isinstance(ralph_result, dict) else None
        if isinstance(aggregation, dict):
            artifacts.append(
                {
                    "step_type": "ralph_aggregation",
                    "step_id": "aggregation_summary",
                    "status": "completed",
                    "reason_code": "aggregated",
                    "source_url": None,
                    "source_tier": None,
                    "evidence_pointer_ids": [],
                    "content_hash": None,
                    "parse_path": "ralph_aggregation_v1",
                    "model_used": "deterministic",
                    "schema_valid": True,
                    "summary": aggregation,
                }
            )
        return artifacts

    def _build_acceptance_step_artifact(
        self,
        *,
        discovery_result: Any,
        validated_signals: List[Dict[str, Any]],
        dual_write_ok: bool,
        provisional: bool = False,
    ) -> Dict[str, Any]:
        final_confidence = self._read_discovery_metric(discovery_result, "final_confidence")
        validated_event_signals = self._count_validated_event_signals(validated_signals)
        status = "completed" if (not provisional and dual_write_ok) else "pending"
        return {
            "step_type": "acceptance_scoring",
            "step_id": "acceptance_gate",
            "status": status,
            "reason_code": "provisional" if provisional else "computed",
            "source_url": None,
            "source_tier": None,
            "evidence_pointer_ids": [],
            "content_hash": None,
            "parse_path": "acceptance_validated_events_only_v1",
            "model_used": "deterministic",
            "schema_valid": True,
            "metrics": {
                "final_confidence": final_confidence,
                "validated_event_signals": validated_event_signals,
                "dual_write_ok": dual_write_ok,
            },
        }

    def _serialize_discovery_result(self, discovery_result: Any) -> Dict[str, Any]:
        if isinstance(discovery_result, dict):
            return discovery_result

        return {
            "final_confidence": getattr(discovery_result, "final_confidence", None),
            "iterations_completed": getattr(discovery_result, "iterations_completed", None),
            "signals_discovered": getattr(discovery_result, "signals_discovered", []),
            "provisional_signals": getattr(discovery_result, "provisional_signals", []),
            "raw_signals": getattr(discovery_result, "raw_signals", []),
            "hypotheses": getattr(discovery_result, "hypotheses", []),
            "performance_summary": getattr(discovery_result, "performance_summary", {}),
            "parse_path": getattr(discovery_result, "parse_path", None),
            "llm_last_status": getattr(discovery_result, "llm_last_status", None),
            "candidate_evaluations": getattr(discovery_result, "candidate_evaluations", []),
            "candidate_events_summary": getattr(discovery_result, "candidate_events_summary", {}),
            "lane_failures": getattr(discovery_result, "lane_failures", {}),
            "controller_health_reasons": getattr(discovery_result, "controller_health_reasons", []),
        }

    def _count_validated_event_signals(self, validated_signals: List[Dict[str, Any]]) -> int:
        count = 0
        for signal in validated_signals:
            if not isinstance(signal, dict):
                continue
            validation_state = str(signal.get("validation_state") or "validated").strip().lower()
            accept_guard = signal.get("accept_guard_passed", True)
            evidence_pointer_ids = signal.get("evidence_pointer_ids") or (signal.get("metadata") or {}).get("evidence_pointer_ids")
            if not isinstance(evidence_pointer_ids, list):
                evidence_pointer_ids = []
            if validation_state == "validated" and bool(accept_guard) and len(evidence_pointer_ids) > 0:
                count += 1
        return count

    def _build_acceptance_gate(
        self,
        *,
        discovery_result: Any,
        phase_results: Dict[str, Dict[str, Any]],
        raw_signals: List[Dict[str, Any]],
        validated_signals: List[Dict[str, Any]],
        dual_write_ok: bool,
        enforce_dual_write_gate: bool,
    ) -> Dict[str, Any]:
        final_confidence = self._read_discovery_metric(discovery_result, "final_confidence")
        signals_discovered = len(validated_signals)
        provisional_signals_raw = self._read_discovery_metric(discovery_result, "provisional_signals")
        provisional_signals = provisional_signals_raw if isinstance(provisional_signals_raw, list) else []
        provisional_count = len(provisional_signals)
        performance_summary = self._read_discovery_metric(discovery_result, "performance_summary")
        if not isinstance(performance_summary, dict):
            performance_summary = {}
        candidate_events_count = int(
            performance_summary.get("signals_candidate_events_count")
            or performance_summary.get("candidate_evaluations_count")
            or 0
        )
        schema_fail_count = int(performance_summary.get("schema_fail_count") or 0)
        validated_event_signals = self._count_validated_event_signals(validated_signals)
        raw_signal_count = len(raw_signals)
        reasons: List[str] = []
        discovery_status = (phase_results.get("discovery") or {}).get("status")
        if discovery_status != "completed":
            reasons.append("discovery_failed")
        if final_confidence is None or float(final_confidence) < self.acceptance_min_confidence:
            reasons.append("confidence_below_threshold")
        strict_pass = validated_event_signals >= self.acceptance_min_signals
        hybrid_pass = (
            validated_event_signals >= 1
            and provisional_count >= 2
            and final_confidence is not None
            and float(final_confidence) >= self.acceptance_min_confidence
            and schema_fail_count == 0
        )
        if not strict_pass and not hybrid_pass:
            reasons.append("signals_below_threshold")
        if validated_event_signals < signals_discovered:
            reasons.append("unvalidated_or_ungrounded_signals_excluded")
        if enforce_dual_write_gate and self.require_dual_write and not dual_write_ok:
            reasons.append("dual_write_incomplete")
        acceptance_mode = "strict" if strict_pass else "hybrid_provisional" if hybrid_pass else "none"
        return {
            "passed": len(reasons) == 0,
            "reasons": reasons,
            "acceptance_mode": acceptance_mode,
            "thresholds": {
                "final_confidence": self.acceptance_min_confidence,
                "signals_discovered": self.acceptance_min_signals,
                "provisional_signals_for_hybrid": 2,
            },
            "observed": {
                "final_confidence": final_confidence,
                "signals_discovered": signals_discovered,
                "validated_event_signals": validated_event_signals,
                "signals_provisional_count": provisional_count,
                "signals_candidate_events_count": candidate_events_count,
                "schema_fail_count": schema_fail_count,
                "raw_signals_discovered": raw_signal_count,
                "dual_write_ok": dual_write_ok,
            },
        }

    def _build_failure_taxonomy(
        self,
        *,
        discovery_result: Any,
        phase_results: Dict[str, Dict[str, Any]],
        raw_signals: List[Dict[str, Any]],
    ) -> Dict[str, int]:
        taxonomy = {
            "import_context_failure": 0,
            "llm_empty_response": 0,
            "schema_gate_fallback": 0,
            "low_signal_content": 0,
            "entity_grounding_reject": 0,
            "supabase_write_failure": 0,
            "falkordb_write_failure": 0,
            "dual_write_incomplete": 0,
        }
        discovery_payload = self._serialize_discovery_result(discovery_result)
        parse_path = str(discovery_payload.get("parse_path") or "").lower()
        llm_last_status = str(discovery_payload.get("llm_last_status") or "").lower()
        discovery_error = str((phase_results.get("discovery") or {}).get("error") or "").lower()
        performance_summary = discovery_payload.get("performance_summary") or {}
        hop_timings = performance_summary.get("hop_timings") if isinstance(performance_summary, dict) else []

        if "schema_gate" in parse_path or "fallback" in parse_path:
            taxonomy["schema_gate_fallback"] = 1
        if (
            "empty" in llm_last_status
            or "timeout" in llm_last_status
            or "empty" in discovery_error
            or "timeout" in discovery_error
        ):
            taxonomy["llm_empty_response"] = 1
        if "import_context_failure" in discovery_error or "no module named" in discovery_error:
            taxonomy["import_context_failure"] = 1
        if len(raw_signals) < self.acceptance_min_signals:
            taxonomy["low_signal_content"] = 1
        if isinstance(hop_timings, list) and any(
            str((hop or {}).get("evidence_type") or "").strip().lower() == "entity_grounding_filter"
            for hop in hop_timings
            if isinstance(hop, dict)
        ):
            taxonomy["entity_grounding_reject"] = 1

        return taxonomy

    def _read_discovery_metric(self, discovery_result: Any, key: str) -> Any:
        if isinstance(discovery_result, dict):
            return discovery_result.get(key)
        return getattr(discovery_result, key, None)

    def _build_unified_rfp_record(
        self,
        entity_id: str,
        entity_name: str,
        signal: Dict[str, Any],
        episode: Dict[str, Any],
    ) -> Dict[str, Any]:
        confidence = signal.get("confidence")
        if isinstance(confidence, (int, float)) and confidence > 1:
            confidence = confidence / 100.0

        title = signal.get("statement") or signal.get("text") or "Validated RFP signal"
        return {
            "rfp_id": signal.get("id") or f"{entity_id}-rfp",
            "title": title,
            "organization": entity_name,
            "description": title,
            "source": "ai-detected",
            "source_url": signal.get("url"),
            "category": signal.get("subtype") or signal.get("type") or "general",
            "status": "detected",
            "priority": "high" if (confidence or 0) >= 0.8 else "medium",
            "priority_score": 8 if (confidence or 0) >= 0.8 else 6,
            "confidence_score": confidence,
            "confidence": int(round((confidence or 0) * 100)),
            "yellow_panther_fit": 80 if self._is_rfp_signal(signal) else 60,
            "entity_id": entity_id,
            "entity_name": entity_name,
            "entity_type": signal.get("entity_type") or "CLUB",
            "location": self._extract_location_from_url(signal.get("url")),
            "tags": ["imported-entity", "pipeline-generated"],
            "keywords": self._extract_keywords(title),
            "metadata": {
                "episode_id": episode.get("episode_id"),
                "signal_id": signal.get("id"),
                "pipeline_source": "entity_import_pipeline",
                "signal_type": signal.get("type"),
            },
        }

    def _extract_keywords(self, text: str) -> List[str]:
        words = [word.strip(".,:;()[]{}").lower() for word in text.split()]
        return [word for word in words if len(word) > 3][:8]

    def _extract_location_from_url(self, url: Optional[str]) -> Optional[str]:
        if not url:
            return None

        hostname = urlparse(url).hostname
        return hostname or None

    def _is_rfp_signal(self, signal: Dict[str, Any]) -> bool:
        signal_type = str(signal.get("type") or signal.get("signal_type") or "").upper()
        text = str(signal.get("statement") or signal.get("text") or "").upper()
        return "RFP" in signal_type or "RFP" in text or "PROCUREMENT" in signal_type
