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
import inspect
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
    from backend.pipeline_run_metadata import canonicalize_phase_details_by_phase, build_phase_status_map, normalize_phase_callback_payload
except ImportError:
    from pipeline_run_metadata import canonicalize_phase_details_by_phase, build_phase_status_map, normalize_phase_callback_payload
try:
    from backend.question_progress_framework import build_question_checkpoint_fields, build_question_preparation_fields
except ImportError:
    from question_progress_framework import build_question_checkpoint_fields, build_question_preparation_fields
try:
    from backend.universal_atomic_matrix import build_universal_atomic_question_source
except ImportError:
    from universal_atomic_matrix import build_universal_atomic_question_source
try:
    from backend.persistence_coordinator import DualWritePersistenceCoordinator
except ImportError:
    from persistence_coordinator import DualWritePersistenceCoordinator
try:
    from backend.objective_profiles import DEFAULT_PIPELINE_OBJECTIVE, normalize_run_objective
except ImportError:
    from objective_profiles import DEFAULT_PIPELINE_OBJECTIVE, normalize_run_objective
try:
    from backend.dossier_publication_quality import apply_publication_quality_gates
except ImportError:
    from dossier_publication_quality import apply_publication_quality_gates
try:
    from backend.post_dossier_graphiti_trigger import notify_post_dossier_graphiti_opportunity_trigger
except ImportError:
    from post_dossier_graphiti_trigger import notify_post_dossier_graphiti_opportunity_trigger

logger = logging.getLogger(__name__)
DEFAULT_OPENCODE_MODEL = "zai-coding-plan/glm-5.1"
OPENCODE_PROVIDER_INSUFFICIENT_BALANCE_ERROR = "OpenCodeProviderInsufficientBalanceError"


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
        self.question_first_opencode_timeout_seconds = float(
            os.getenv(
                "PIPELINE_QUESTION_FIRST_OPENCODE_TIMEOUT_SECONDS",
                os.getenv("PIPELINE_QUESTION_FIRST_BRIGHTDATA_TIMEOUT_SECONDS", "300"),
            )
        )
        self.question_first_opencode_timeout = int(self.question_first_opencode_timeout_seconds * 1000)
        self.question_first_brightdata_timeout = self.question_first_opencode_timeout_seconds  # legacy alias
        self.question_first_backend = str(os.getenv("PIPELINE_QUESTION_FIRST_BACKEND", "opencode") or "opencode").strip().lower()
        self._last_question_first_report: Dict[str, Any] | None = None
        self.persistence_coordinator = persistence_coordinator or self._build_default_persistence_coordinator()

    def _resolve_question_first_backend(self, request_metadata: Optional[Dict[str, Any]] = None) -> str:
        metadata_backend = str((request_metadata or {}).get("question_first_backend") or "").strip().lower()
        backend = metadata_backend or self.question_first_backend or "opencode"
        return backend if backend in {"opencode", "python_direct"} else "opencode"

    def _question_first_runtime_metadata(self, *, request_metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        backend = self._resolve_question_first_backend(request_metadata)
        phase0_mode = str((request_metadata or {}).get("phase0_mode") or "").strip().lower() or (
            "opencode_first" if backend == "opencode" else "legacy_python"
        )
        metadata: Dict[str, Any] = {
            "phase0_mode": phase0_mode,
            "question_first_backend": backend,
            "legacy_phase0_used": bool((request_metadata or {}).get("legacy_phase0_used", phase0_mode == "legacy_python")),
        }
        if backend == "opencode":
            metadata.update(
                {
                    "execution_backend": "OpenCode",
                    "execution_model": DEFAULT_OPENCODE_MODEL,
                    "execution_provider": "z.ai",
                    "brightdata_transport": "stdio",
                    "opencode_model": DEFAULT_OPENCODE_MODEL,
                    "opencode_provider": "z.ai",
                }
            )
        elif backend == "python_direct":
            metadata.update(
                {
                    "execution_backend": "Python",
                    "brightdata_transport": "python_client",
                }
            )
        return metadata

    @classmethod
    def _has_provider_infrastructure_failure(cls, value: Any) -> bool:
        if value is None:
            return False
        if isinstance(value, str):
            text = value.lower()
            return (
                OPENCODE_PROVIDER_INSUFFICIENT_BALANCE_ERROR.lower() in text
                or "providerinsufficientbalance" in text
                or "insufficient balance" in text
                or "opencodetimeouterror" in text
                or "opencode_timeout" in text
                or "brightdata_prefetch_failed" in text
                or "provider_no_output" in text
            )
        if isinstance(value, (int, float, bool)):
            return False
        if isinstance(value, list):
            return any(cls._has_provider_infrastructure_failure(item) for item in value)
        if not isinstance(value, dict):
            return False

        failure_name = str(value.get("failure_name") or value.get("error_name") or value.get("name") or "").lower()
        error_type = str(value.get("error_type") or value.get("failure_type") or "").lower()
        message = str(value.get("message") or value.get("error_message") or value.get("stderr") or value.get("error") or "").lower()
        return (
            OPENCODE_PROVIDER_INSUFFICIENT_BALANCE_ERROR.lower() in failure_name
            or "provider_infrastructure_failure" in error_type
            or "opencode_timeout" in error_type
            or "brightdata_prefetch_failed" in error_type
            or "provider_no_output" in error_type
            or "opencodetimeouterror" in failure_name
            or OPENCODE_PROVIDER_INSUFFICIENT_BALANCE_ERROR.lower() in message
            or any(cls._has_provider_infrastructure_failure(item) for item in value.values())
        )

    def _build_question_first_seed_dossier(
        self,
        *,
        entity_id: str,
        entity_name: str,
        entity_type: str,
        request_metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        source_payload = build_universal_atomic_question_source(
            entity_type=entity_type,
            entity_name=entity_name,
            entity_id=entity_id,
            preset=(request_metadata or {}).get("preset"),
            question_source_label=f"{entity_id}::question-first",
        )
        source_payload["metadata"] = {
            **(source_payload.get("metadata") if isinstance(source_payload.get("metadata"), dict) else {}),
            "entity_id": entity_id,
            "entity_name": entity_name,
            "entity_type": entity_type,
            "generation_mode": "question_first_seed",
            **self._question_first_runtime_metadata(request_metadata=request_metadata),
        }
        return source_payload

    def _merge_question_first_checkpoint_event(
        self,
        *,
        checkpoint: Optional[Dict[str, Any]],
        event: Dict[str, Any],
    ) -> Dict[str, Any]:
        existing = deepcopy(checkpoint or {})
        now_iso = datetime.now(timezone.utc).isoformat()
        existing.setdefault("schema_version", "question_first_checkpoint_v1")
        existing["updated_at"] = now_iso
        if event.get("questions_answered") is not None:
            existing["questions_answered"] = int(event.get("questions_answered") or 0)
        if event.get("questions_total") is not None:
            existing["questions_total"] = int(event.get("questions_total") or 0)

        current_question_id = str(event.get("current_question_id") or "").strip()
        if current_question_id:
            existing["current_question_id"] = current_question_id
        current_question_text = str(event.get("current_question_text") or "").strip()
        if current_question_text:
            existing["current_question_text"] = current_question_text
        next_question_id = str(event.get("next_question_id") or "").strip()
        if next_question_id:
            existing["next_question_id"] = next_question_id
        next_question_text = str(event.get("next_question_text") or "").strip()
        if next_question_text:
            existing["next_question_text"] = next_question_text

        answer_records = existing.get("answer_records")
        if not isinstance(answer_records, list):
            answer_records = []
        terminal_states = existing.get("terminal_states")
        if not isinstance(terminal_states, dict):
            terminal_states = {}
        evidence_urls = existing.get("evidence_urls")
        if not isinstance(evidence_urls, list):
            evidence_urls = []
        evidence_url_set = {str(url).strip() for url in evidence_urls if str(url).strip()}

        completed = event.get("completed_question")
        if isinstance(completed, dict):
            completed_question_id = str(completed.get("question_id") or current_question_id or "").strip()
            if completed_question_id:
                existing["last_completed_question_id"] = completed_question_id
                answer_record = deepcopy(completed)
                if "question_text" not in answer_record and current_question_text:
                    answer_record["question_text"] = current_question_text
                answer_records = [
                    record for record in answer_records
                    if not (isinstance(record, dict) and str(record.get("question_id") or "").strip() == completed_question_id)
                ]
                answer_records.append(answer_record)
                state = str(
                    completed.get("validation_state")
                    or completed.get("status")
                    or completed.get("terminal_state")
                    or ""
                ).strip()
                if state:
                    terminal_states[completed_question_id] = state
                for url in completed.get("sources") or []:
                    url_value = str(url or "").strip()
                    if url_value and url_value not in evidence_url_set:
                        evidence_url_set.add(url_value)
                        evidence_urls.append(url_value)
                evidence_url = str(completed.get("evidence_url") or "").strip()
                if evidence_url and evidence_url not in evidence_url_set:
                    evidence_url_set.add(evidence_url)
                    evidence_urls.append(evidence_url)

        artifact_paths = event.get("artifact_paths")
        if isinstance(artifact_paths, dict):
            existing["artifact_paths"] = deepcopy(artifact_paths)
        existing["answer_records"] = answer_records
        existing["terminal_states"] = terminal_states
        existing["evidence_urls"] = evidence_urls
        return existing

    @staticmethod
    def _question_first_checkpoint_answer_count(checkpoint: Optional[Dict[str, Any]]) -> int:
        if not isinstance(checkpoint, dict):
            return 0
        raw_count = checkpoint.get("questions_answered")
        if raw_count is None and isinstance(checkpoint.get("answer_records"), list):
            raw_count = len(checkpoint.get("answer_records") or [])
        try:
            return max(0, int(raw_count or 0))
        except (TypeError, ValueError):
            return 0

    @classmethod
    def _select_richest_question_first_checkpoint(
        cls,
        *checkpoints: Optional[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        richest: Optional[Dict[str, Any]] = None
        richest_count = -1
        for checkpoint in checkpoints:
            if not isinstance(checkpoint, dict) or not checkpoint:
                continue
            count = cls._question_first_checkpoint_answer_count(checkpoint)
            if count > richest_count:
                richest = deepcopy(checkpoint)
                richest_count = count
        return richest

    @classmethod
    def _extract_question_first_checkpoint_from_payload(cls, payload: Any) -> Optional[Dict[str, Any]]:
        if not isinstance(payload, dict):
            return None
        direct = payload.get("question_first_checkpoint")
        if isinstance(direct, dict) and direct:
            return deepcopy(direct)
        metadata = payload.get("metadata")
        if isinstance(metadata, dict) and isinstance(metadata.get("question_first_checkpoint"), dict):
            return deepcopy(metadata["question_first_checkpoint"])
        dossier = payload.get("dossier")
        if isinstance(dossier, dict):
            extracted = cls._extract_question_first_checkpoint_from_payload(dossier)
            if extracted:
                return extracted
        question_first = payload.get("question_first")
        if isinstance(question_first, dict):
            answers = question_first.get("answers") if isinstance(question_first.get("answers"), list) else []
            if answers:
                last_answer = answers[-1] if isinstance(answers[-1], dict) else {}
                return {
                    "schema_version": "question_first_checkpoint_v1",
                    "questions_answered": int(question_first.get("questions_answered") or len(answers)),
                    "questions_total": int(question_first.get("questions_total") or 0),
                    "last_completed_question_id": str(last_answer.get("question_id") or "").strip() or None,
                    "answer_records": deepcopy(answers),
                }
        return None

    async def _load_persisted_question_first_checkpoint(self, *, entity_id: str) -> Optional[Dict[str, Any]]:
        client = getattr(self.graphiti_service, "supabase_client", None)
        if client is None:
            return None
        candidates: List[Dict[str, Any]] = []
        try:
            dossier_response = (
                client.table("entity_dossiers")
                .select("entity_id,dossier_data,generated_at")
                .eq("entity_id", entity_id)
                .limit(5)
                .execute()
            )
            for row in dossier_response.data or []:
                if not isinstance(row, dict):
                    continue
                checkpoint = self._extract_question_first_checkpoint_from_payload(row.get("dossier_data"))
                if checkpoint:
                    candidates.append(checkpoint)
        except Exception as error:  # noqa: BLE001
            logger.debug(
                "question_first_checkpoint_dossier_lookup_failed",
                extra={"entity_id": entity_id, "error": str(error)},
            )
        try:
            temporal_response = (
                client.table("temporal_episodes")
                .select("metadata,created_at")
                .eq("entity_id", entity_id)
                .eq("episode_type", "PIPELINE_PERSISTENCE")
                .contains("metadata", {"record_type": "question_first_partial_dossier"})
                .order("created_at", desc=True)
                .limit(50)
                .execute()
            )
            for row in temporal_response.data or []:
                if not isinstance(row, dict):
                    continue
                metadata = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
                payload = metadata.get("payload") if isinstance(metadata.get("payload"), dict) else {}
                checkpoint = self._extract_question_first_checkpoint_from_payload(payload)
                if checkpoint:
                    candidates.append(checkpoint)
        except Exception as error:  # noqa: BLE001
            logger.debug(
                "question_first_checkpoint_temporal_lookup_failed",
                extra={"entity_id": entity_id, "error": str(error)},
            )
        return self._select_richest_question_first_checkpoint(*candidates)

    def _build_partial_question_first_dossier(
        self,
        *,
        source_payload: Dict[str, Any],
        entity_id: str,
        entity_name: str,
        entity_type: str,
        checkpoint: Dict[str, Any],
        request_metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        payload = deepcopy(source_payload if isinstance(source_payload, dict) else {})
        now_iso = datetime.now(timezone.utc).isoformat()
        answers = checkpoint.get("answer_records") if isinstance(checkpoint.get("answer_records"), list) else []
        payload.update(
            {
                "entity_id": entity_id,
                "entity_name": entity_name,
                "entity_type": entity_type,
                "quality_state": "partial",
                "publication_status": "published_partial",
                "publish_status": "published_partial",
                "generated_at": now_iso,
                "question_first_checkpoint": deepcopy(checkpoint),
                "question_first": {
                    "enabled": True,
                    "schema_version": "question_first_run_v1",
                    "questions_answered": int(checkpoint.get("questions_answered") or len(answers)),
                    "questions_total": int(checkpoint.get("questions_total") or 0),
                    "answers": deepcopy(answers),
                    "categories": [],
                    "checkpoint_status": "partial",
                },
            }
        )
        metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}
        provider_failure = self._has_provider_infrastructure_failure(checkpoint)
        if provider_failure:
            payload["quality_state"] = "failed"
            payload["publication_status"] = "failed"
            payload["publish_status"] = "failed"
        payload["metadata"] = {
            **metadata,
            "entity_id": entity_id,
            "entity_name": entity_name,
            "entity_type": entity_type,
            "quality_state": "failed" if provider_failure else "partial",
            "publication_status": "failed" if provider_failure else "published_partial",
            **(
                {
                    "failure_class": "provider_infrastructure_failure",
                    "failure_reason": "provider_infrastructure_failure",
                }
                if provider_failure
                else {}
            ),
            "question_first_checkpoint": deepcopy(checkpoint),
            **self._question_first_runtime_metadata(request_metadata=request_metadata),
        }
        return payload

    async def _persist_question_first_dossier_snapshot(
        self,
        *,
        run_id: str,
        entity_id: str,
        entity_name: str,
        entity_type: str,
        dossier: Dict[str, Any],
        question_first_meta: Optional[Dict[str, Any]] = None,
        request_metadata: Optional[Dict[str, Any]] = None,
        record_type: str = "question_first_dossier",
        record_id: Optional[str] = None,
    ) -> None:
        """
        Persist the enriched question-first dossier immediately after enrichment.

        This is intentionally earlier than the final publication stage so the
        entity dossier page can render the result even if later phases fail.
        """
        if not isinstance(dossier, dict) or not dossier:
            return
        payload: Dict[str, Any] = {
            "entity_name": entity_name,
            "entity_type": entity_type,
            "dossier": dossier,
        }
        if isinstance(question_first_meta, dict) and question_first_meta:
            payload["question_first"] = question_first_meta
        if isinstance(request_metadata, dict) and request_metadata:
            payload["request_metadata"] = request_metadata
        await self.persistence_coordinator.persist_run_artifacts(
            run_id=run_id,
            entity_id=entity_id,
            phase="question_first_enrichment",
            record_type=record_type,
            record_id=record_id or entity_id,
            payload=payload,
        )

    def _build_canonical_publication_dossier(
        self,
        *,
        dossier: Dict[str, Any],
        entity_id: str,
        entity_name: str,
        entity_type: str,
        run_id: str,
        request_metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        payload = deepcopy(dossier if isinstance(dossier, dict) else {})
        now_iso = datetime.now(timezone.utc).isoformat()
        payload["entity_id"] = entity_id
        payload["entity_name"] = entity_name
        payload["entity_type"] = entity_type
        payload["generated_at"] = now_iso
        payload["run_id"] = run_id
        payload["publish_status"] = "published"
        payload["publication_status"] = payload.get("publication_status") or "published"

        metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}
        payload["metadata"] = metadata
        metadata["entity_id"] = entity_id
        metadata["entity_name"] = entity_name
        metadata["entity_type"] = entity_type

        question_first = payload.get("question_first") if isinstance(payload.get("question_first"), dict) else {}
        if question_first:
            provider_failure = self._has_provider_infrastructure_failure(payload)
            payload["question_first"] = question_first
            quality_state = str(question_first.get("quality_state") or payload.get("quality_state") or "").strip() or None
            if provider_failure:
                quality_state = "failed"
            if not quality_state:
                answers = question_first.get("answers") if isinstance(question_first.get("answers"), list) else []
                try:
                    questions_answered = int(question_first.get("questions_answered") or len(answers))
                except (TypeError, ValueError):
                    questions_answered = len(answers)
                if questions_answered > 0:
                    quality_state = "partial"
            payload["quality_state"] = quality_state
            if provider_failure:
                payload["publication_status"] = "failed"
                payload["publish_status"] = "failed"
                metadata["failure_class"] = "provider_infrastructure_failure"
                metadata["failure_reason"] = "provider_infrastructure_failure"
            metadata["quality_state"] = quality_state
            checkpoint = payload.get("question_first_checkpoint")
            if not isinstance(checkpoint, dict):
                metadata_checkpoint = metadata.get("question_first_checkpoint")
                checkpoint = metadata_checkpoint if isinstance(metadata_checkpoint, dict) else None
            if not isinstance(checkpoint, dict):
                answers = question_first.get("answers") if isinstance(question_first.get("answers"), list) else []
                try:
                    questions_answered = int(question_first.get("questions_answered") or len(answers))
                except (TypeError, ValueError):
                    questions_answered = len(answers)
                questions_total = question_first.get("questions_total") or len(answers) or questions_answered
                last_completed_question_id = None
                if answers:
                    last_answer = answers[-1] if isinstance(answers[-1], dict) else {}
                    last_completed_question_id = (
                        last_answer.get("question_id")
                        or last_answer.get("id")
                        or last_answer.get("question")
                    )
                checkpoint = {
                    "schema_version": "question_first_checkpoint_v1",
                    "questions_answered": questions_answered,
                    "questions_total": questions_total,
                    "last_completed_question_id": last_completed_question_id,
                    "answer_records": deepcopy(answers),
                    "updated_at": now_iso,
                }
            payload["question_first_checkpoint"] = checkpoint
            metadata["question_first_checkpoint"] = deepcopy(checkpoint)
            payload["answers"] = question_first.get("answers") if isinstance(question_first.get("answers"), list) else payload.get("answers")
            payload["question_timings"] = (
                question_first.get("question_timings")
                if isinstance(question_first.get("question_timings"), dict)
                else payload.get("question_timings")
            )
            question_first["generated_at"] = now_iso
            question_first["run_id"] = run_id
            question_first["publish_status"] = "published"

            metadata_question_first = metadata.get("question_first") if isinstance(metadata.get("question_first"), dict) else {}
            metadata["question_first"] = {
                **metadata_question_first,
                "generated_at": now_iso,
                "run_id": run_id,
                "publish_status": "failed" if provider_failure else "published",
                "quality_state": quality_state,
            }
            question_first["quality_state"] = question_first.get("quality_state") or quality_state
            if provider_failure:
                question_first["publish_status"] = "failed"
                question_first["failure_class"] = "provider_infrastructure_failure"

            if str((request_metadata or {}).get("rerun_mode") or "").strip().lower() == "question":
                repair_meta = {
                    "mode": "question",
                    "question_id": str((request_metadata or {}).get("question_id") or "").strip() or None,
                    "cascade_dependents": bool((request_metadata or {}).get("cascade_dependents", True)),
                    "repair_source_run_id": str((request_metadata or {}).get("repair_source_run_id") or "").strip() or None,
                    "repair_source_run_path": str((request_metadata or {}).get("repair_source_run_path") or "").strip() or None,
                    "repair_source_dossier_path": str((request_metadata or {}).get("repair_source_dossier_path") or "").strip() or None,
                }
                metadata["question_first"]["repair_run"] = repair_meta
                question_first["repair_run"] = repair_meta

        return apply_publication_quality_gates(payload)

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
        request_metadata: Optional[Dict[str, Any]] = None,
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
        question_first_runtime_metadata = self._question_first_runtime_metadata(request_metadata=request_metadata)
        if dossier is None:
            if self.question_first_enabled and self._resolve_question_first_backend(request_metadata) == "opencode":
                dossier = self._build_question_first_seed_dossier(
                    entity_id=entity_id,
                    entity_name=entity_name,
                    entity_type=entity_type,
                    request_metadata=request_metadata,
                )
                await self._emit_phase_update(
                    phase_callback,
                    "dossier_generation",
                    {
                        "status": "question_first_running",
                        **question_first_runtime_metadata,
                        **build_question_preparation_fields(dossier.get("questions") or []),
                    },
                )
                logger.warning("🚦 Pipeline boundary: question_first_enrichment:start")
                dossier = await self._invoke_question_first_enrichment(
                    dossier=dossier,
                    entity_id=entity_id,
                    entity_name=entity_name,
                    entity_type=entity_type,
                    run_id=run_id,
                    request_metadata=request_metadata,
                    phase_callback=phase_callback,
                )
                question_first_meta = (dossier.get("question_first") or {}) if isinstance(dossier, dict) else {}
                self._last_question_first_report = question_first_meta.get("report") if isinstance(question_first_meta, dict) else None
                await self._emit_phase_update(
                    phase_callback,
                    "dossier_generation",
                    {
                        "status": "question_first_completed",
                        **question_first_runtime_metadata,
                        "questions_answered": int(question_first_meta.get("questions_answered") or 0),
                        "category_count": len(question_first_meta.get("categories") or []),
                        "connections_graph_enrichment_enabled": bool(question_first_meta.get("connections_graph_enrichment_enabled")),
                        "connections_graph_enrichment_status": str(
                            question_first_meta.get("connections_graph_enrichment_status") or ("optional")
                        ),
                    },
                )
                logger.warning("🚦 Pipeline boundary: question_first_enrichment:complete")
                try:
                    await self._persist_question_first_dossier_snapshot(
                        run_id=run_id,
                        entity_id=entity_id,
                        entity_name=entity_name,
                        entity_type=entity_type,
                        dossier=dossier,
                        question_first_meta=question_first_meta if isinstance(question_first_meta, dict) else None,
                        request_metadata=request_metadata,
                    )
                except Exception as error:  # noqa: BLE001
                    logger.warning(
                        "question_first_dossier_snapshot_persist_failed",
                        extra={
                            "entity_id": entity_id,
                            "entity_name": entity_name,
                            "run_id": run_id,
                            "error": str(error),
                        },
                    )
            else:
                await self._emit_phase_update(phase_callback, "dossier_generation", {"status": "running", "current_substep": "dossier_generation_running"})
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
                    await self._emit_phase_update(
                        phase_callback,
                        "dossier_generation",
                        {"status": "question_first_running", **question_first_runtime_metadata},
                    )
                    dossier = await self._invoke_question_first_enrichment(
                        dossier=dossier,
                        entity_id=entity_id,
                        entity_name=entity_name,
                        entity_type=entity_type,
                        run_id=run_id,
                        request_metadata=request_metadata,
                        phase_callback=phase_callback,
                    )
                    question_first_meta = (dossier.get("question_first") or {}) if isinstance(dossier, dict) else {}
                    self._last_question_first_report = question_first_meta.get("report") if isinstance(question_first_meta, dict) else None
                    await self._emit_phase_update(
                        phase_callback,
                        "dossier_generation",
                        {
                            "status": "question_first_completed",
                            **question_first_runtime_metadata,
                            "questions_answered": int(question_first_meta.get("questions_answered") or 0),
                            "category_count": len(question_first_meta.get("categories") or []),
                            "connections_graph_enrichment_enabled": bool(question_first_meta.get("connections_graph_enrichment_enabled")),
                            "connections_graph_enrichment_status": str(
                                question_first_meta.get("connections_graph_enrichment_status") or ("optional")
                            ),
                        },
                    )
                    logger.warning("🚦 Pipeline boundary: question_first_enrichment:complete")
                    try:
                        await self._persist_question_first_dossier_snapshot(
                            run_id=run_id,
                            entity_id=entity_id,
                            entity_name=entity_name,
                            entity_type=entity_type,
                            dossier=dossier,
                            question_first_meta=question_first_meta if isinstance(question_first_meta, dict) else None,
                            request_metadata=request_metadata,
                        )
                    except Exception as error:  # noqa: BLE001
                        logger.warning(
                            "question_first_dossier_snapshot_persist_failed",
                            extra={
                                "entity_id": entity_id,
                                "entity_name": entity_name,
                                "run_id": run_id,
                                "error": str(error),
                            },
                        )
            dossier = self._coerce_dossier_payload(dossier)
            await self._emit_phase_update(
                phase_callback,
                "dossier_generation",
                {
                    "status": "completed",
                    "current_substep": "dossier_generation_completed",
                    **(question_first_runtime_metadata if self.question_first_enabled else {}),
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
            if self.question_first_enabled:
                is_question_repair = str((request_metadata or {}).get("rerun_mode") or "").strip().lower() == "question"
                question_first_meta = dossier.get("question_first") if isinstance(dossier.get("question_first"), dict) else {}
                has_question_first_answers = isinstance(question_first_meta.get("answers"), list) and len(question_first_meta.get("answers") or []) > 0
                if is_question_repair or not has_question_first_answers:
                    logger.warning("🚦 Pipeline boundary: question_first_enrichment:start")
                    await self._emit_phase_update(
                        phase_callback,
                        "dossier_generation",
                        {"status": "question_first_running", **question_first_runtime_metadata},
                    )
                    dossier = await self._invoke_question_first_enrichment(
                        dossier=dossier,
                        entity_id=entity_id,
                        entity_name=entity_name,
                        entity_type=entity_type,
                        run_id=run_id,
                        request_metadata=request_metadata,
                        phase_callback=phase_callback,
                    )
                    question_first_meta = (dossier.get("question_first") or {}) if isinstance(dossier, dict) else {}
                    self._last_question_first_report = question_first_meta.get("report") if isinstance(question_first_meta, dict) else None
                    await self._emit_phase_update(
                        phase_callback,
                        "dossier_generation",
                        {
                            "status": "question_first_completed",
                            **question_first_runtime_metadata,
                            "questions_answered": int(question_first_meta.get("questions_answered") or 0),
                            "category_count": len(question_first_meta.get("categories") or []),
                            "connections_graph_enrichment_enabled": bool(question_first_meta.get("connections_graph_enrichment_enabled")),
                            "connections_graph_enrichment_status": str(
                                question_first_meta.get("connections_graph_enrichment_status") or ("optional")
                            ),
                        },
                    )
                    logger.warning("🚦 Pipeline boundary: question_first_enrichment:complete")
                    try:
                        await self._persist_question_first_dossier_snapshot(
                            run_id=run_id,
                            entity_id=entity_id,
                            entity_name=entity_name,
                            entity_type=entity_type,
                            dossier=dossier,
                            question_first_meta=question_first_meta if isinstance(question_first_meta, dict) else None,
                            request_metadata=request_metadata,
                        )
                    except Exception as error:  # noqa: BLE001
                        logger.warning(
                            "question_first_dossier_snapshot_persist_failed",
                            extra={
                                "entity_id": entity_id,
                                "entity_name": entity_name,
                                "run_id": run_id,
                                "error": str(error),
                            },
                        )
            phase_results["dossier_generation"] = {"status": "completed"}
            step_artifacts.extend(self._build_dossier_step_artifacts(dossier=dossier, entity_id=entity_id))

        discovery_result: Any = {"signals_discovered": [], "hypotheses": []}
        raw_signals: List[Dict[str, Any]] = []
        ralph_result: Dict[str, Any] = self._coerce_ralph_result([])
        validated_signals: List[Dict[str, Any]] = []
        capability_signals: List[Dict[str, Any]] = []
        validated_rfps: List[Dict[str, Any]] = []
        episodes: List[Dict[str, Any]] = []
        use_question_first_downstream_fallback = self._use_question_first_downstream_fallback(
            dossier=dossier,
            request_metadata=request_metadata,
        )

        try:
            logger.warning("🚦 Pipeline boundary: discovery:start")
            await self._emit_phase_update(phase_callback, "discovery", {"status": "running", "current_substep": "discovery_running"})
            if use_question_first_downstream_fallback:
                discovery_result = self._build_question_first_discovery_result(
                    entity_id=entity_id,
                    dossier=dossier,
                )
            else:
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
            phase_results["discovery"] = {"status": "failed", "error": error_message, "current_substep": "discovery_failed"}
            phase_results["ralph_validation"] = {"status": "skipped", "reason": "discovery_failed"}
            phase_results["temporal_persistence"] = {"status": "skipped", "reason": "discovery_failed"}
            await self._emit_phase_update(phase_callback, "discovery", phase_results["discovery"])
            await self._emit_phase_update(phase_callback, "ralph_validation", phase_results["ralph_validation"])
            await self._emit_phase_update(phase_callback, "temporal_persistence", phase_results["temporal_persistence"])
        else:
            try:
                await self._emit_phase_update(phase_callback, "ralph_validation", {"status": "running", "current_substep": "ralph_validation_running"})
                if use_question_first_downstream_fallback:
                    raw_ralph_result = self._build_question_first_ralph_result(
                        entity_id=entity_id,
                        raw_signals=raw_signals,
                    )
                else:
                    raw_ralph_result = await self._run_ralph_validation(
                        entity_id=entity_id,
                        raw_signals=raw_signals,
                    )
                ralph_result = self._coerce_ralph_result(raw_ralph_result)
                validated_signals = self._normalize_validated_signals(ralph_result.get("validated_signals", []))
                capability_signals = self._normalize_validated_signals(ralph_result.get("capability_signals", []))
                question_first_scoring_signals = self._build_question_first_scoring_signals(
                    entity_id=entity_id,
                    dossier=dossier,
                )
                if question_first_scoring_signals:
                    validated_signals = self._merge_signal_lists(validated_signals, question_first_scoring_signals)
                    capability_signals = self._merge_signal_lists(
                        capability_signals,
                        [
                            signal
                            for signal in question_first_scoring_signals
                            if not self._is_rfp_signal(signal)
                        ],
                    )
                validated_rfps = [signal for signal in validated_signals if self._is_rfp_signal(signal)]
                phase_results["ralph_validation"] = {
                    "status": "completed",
                    "current_substep": "ralph_validation_completed",
                    "validated_signal_count": len(validated_signals),
                    "capability_signal_count": len(capability_signals),
                    "rfp_count": len(validated_rfps),
                }
                step_artifacts.extend(self._build_ralph_step_artifacts(ralph_result=ralph_result))
                await self._emit_phase_update(phase_callback, "ralph_validation", phase_results["ralph_validation"])
            except Exception as exc:
                error_message = "Ralph validation timed out" if isinstance(exc, TimeoutError) else str(exc)
                logger.exception("Ralph validation failed for %s: %s", entity_id, error_message)
                phase_results["ralph_validation"] = {"status": "failed", "error": error_message, "current_substep": "ralph_validation_failed"}
                phase_results["temporal_persistence"] = {"status": "skipped", "reason": "ralph_validation_failed"}
                await self._emit_phase_update(phase_callback, "ralph_validation", phase_results["ralph_validation"])
                await self._emit_phase_update(phase_callback, "temporal_persistence", phase_results["temporal_persistence"])
            else:
                try:
                    await self._emit_phase_update(phase_callback, "temporal_persistence", {"status": "running", "current_substep": "temporal_persistence_running"})
                    episodes = await self._run_temporal_persistence(
                        entity_id=entity_id,
                        entity_name=entity_name,
                        validated_signals=validated_signals,
                    )
                    phase_results["temporal_persistence"] = {
                        "status": "completed",
                        "current_substep": "temporal_persistence_completed",
                        "episode_count": len(episodes),
                    }
                    await self._emit_phase_update(phase_callback, "temporal_persistence", phase_results["temporal_persistence"])
                except Exception as exc:
                    error_message = "Temporal persistence timed out" if isinstance(exc, TimeoutError) else str(exc)
                    logger.exception("Temporal persistence failed for %s: %s", entity_id, error_message)
                    phase_results["temporal_persistence"] = {"status": "failed", "error": error_message, "current_substep": "temporal_persistence_failed"}
                    await self._emit_phase_update(phase_callback, "temporal_persistence", phase_results["temporal_persistence"])

        await self._emit_phase_update(phase_callback, "dashboard_scoring", {"status": "running", "current_substep": "dashboard_scoring_running"})
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
                "current_substep": "dashboard_scoring_completed",
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
            dossier = self._build_canonical_publication_dossier(
                dossier=dossier,
                entity_id=entity_id,
                entity_name=entity_name,
                entity_type=entity_type,
                run_id=run_id,
                request_metadata=request_metadata,
            )
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
        supabase_published = bool((persistence_status.get("supabase") or {}).get("ok"))
        falkordb_published = bool((persistence_status.get("falkordb") or {}).get("ok"))
        step_failure_taxonomy = step_persistence_status.get("failure_taxonomy", {}) or {}
        step_supabase_ok = int(step_failure_taxonomy.get("supabase_write_failure", 0) or 0) == 0
        publication_succeeded = temporal_status == "completed" and supabase_published and step_supabase_ok
        reconcile_required = bool(
            persistence_status.get("reconcile_required")
            or step_persistence_status.get("reconcile_required")
        )
        if temporal_status == "completed":
            failure_taxonomy["supabase_write_failure"] = int(not supabase_published)
            failure_taxonomy["falkordb_write_failure"] = int(not falkordb_published)
            failure_taxonomy["dual_write_incomplete"] = int(not dual_write_ok)
        else:
            failure_taxonomy["supabase_write_failure"] = 0
            failure_taxonomy["falkordb_write_failure"] = 0
            failure_taxonomy["dual_write_incomplete"] = 0
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
            dual_write_ok=publication_succeeded,
            enforce_dual_write_gate=(temporal_status == "completed" and not publication_succeeded),
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
            reconcile_required = bool(
                reconcile_required
                or step_persistence_status.get("reconcile_required")
            )
        homepage_materialization_status: Dict[str, Any] = {
            "status": "skipped",
            "reason": "temporal_persistence_incomplete" if temporal_status != "completed" else "materializer_missing",
        }
        if temporal_status == "completed" and hasattr(self.graphiti_service, "materialize_homepage_insight"):
            try:
                homepage_materialization_status = await self.graphiti_service.materialize_homepage_insight(
                    {
                        "entity_id": entity_id,
                        "entity_name": entity_name,
                        "entity_type": entity_type,
                        "run_id": run_id,
                        "objective": objective,
                        "effective_objective": objective,
                        "completed_at": datetime.now(timezone.utc).isoformat(),
                        "scores": scores,
                        "phase_details_by_phase": deepcopy(phase_results),
                        "artifacts": {
                            "dossier": dossier,
                            "discovery_result": self._serialize_discovery_result(discovery_result),
                            "validated_signals": validated_signals,
                            "episodes": episodes,
                        },
                    }
                )
            except Exception as exc:
                logger.warning("⚠️ Homepage insight materialization failed for %s: %s", entity_id, exc)
                homepage_materialization_status = {
                    "status": "failed",
                    "error": str(exc),
                }
        degraded_mode = any(
            (details or {}).get("status") in {"failed", "skipped"}
            for details in phase_results.values()
            if isinstance(details, dict)
        )
        publication_status = "publish_failed"
        if publication_succeeded:
            publication_status = "published" if dual_write_ok and step_dual_write_ok else "published_degraded"
        publication_mode = "repair" if objective == "question_repair" else "full"
        if publication_status == "published_degraded":
            publication_mode = f"{publication_mode}_degraded"
            acceptance_gate = {
                **acceptance_gate,
                "passed": True,
                "reasons": [
                    reason
                    for reason in list(acceptance_gate.get("reasons") or [])
                    if reason != "dual_write_incomplete"
                ],
            }

        canonical_phase_details = canonicalize_phase_details_by_phase(phase_results)
        logger.warning("🚦 Pipeline boundary: orchestrator:complete")
        return {
            "entity_id": entity_id,
            "canonical_entity_id": (
                str((request_metadata or {}).get("canonical_entity_id") or "").strip()
                or str((dossier.get("canonical_entity_id") if isinstance(dossier, dict) else "") or "").strip()
                or None
            ),
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
            "homepage_materialization": homepage_materialization_status,
            "dual_write_ok": bool(dual_write_ok and step_dual_write_ok),
            "publication_status": publication_status,
            "publication_mode": publication_mode,
            "reconcile_required": reconcile_required,
            "persistence_status": {
                **persistence_status,
                "step_artifacts": step_persistence_status,
                "dual_write_ok": bool(dual_write_ok and step_dual_write_ok),
                "reconcile_required": reconcile_required,
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
        entity_type: str,
        run_id: str,
        request_metadata: Optional[Dict[str, Any]] = None,
        phase_callback: Optional[Any] = None,
    ) -> Dict[str, Any]:
        questions = dossier.get("questions")
        if not isinstance(questions, list) or not questions:
            logger.info("Question-first enrichment skipped for %s: no questions on dossier", entity_id)
            return dossier
        runtime_metadata = self._question_first_runtime_metadata(request_metadata=request_metadata)
        question_first_backend = self._resolve_question_first_backend(request_metadata)

        initial_checkpoint = build_question_preparation_fields(questions)
        if initial_checkpoint:
            await self._emit_phase_update(
                phase_callback,
                "dossier_generation",
                {
                    "status": "question_first_running",
                    **runtime_metadata,
                    **initial_checkpoint,
                },
            )

        source_payload = dict(dossier)
        if isinstance(request_metadata, dict) and request_metadata:
            repair_meta = {
                "mode": str(request_metadata.get("rerun_mode") or "full").strip().lower() or "full",
                "question_id": str(request_metadata.get("question_id") or "").strip() or None,
                "cascade_dependents": bool(request_metadata.get("cascade_dependents", True)),
                "repair_source_run_id": str(request_metadata.get("repair_source_run_id") or "").strip() or None,
                "repair_source_run_path": str(request_metadata.get("repair_source_run_path") or "").strip() or None,
                "repair_source_dossier_path": str(request_metadata.get("repair_source_dossier_path") or "").strip() or None,
            }
            source_payload["metadata"] = {
                **(source_payload.get("metadata") if isinstance(source_payload.get("metadata"), dict) else {}),
                "question_first_repair": repair_meta,
            }

        brightdata_client = getattr(self, "brightdata_client", None)
        claude_client = getattr(self, "claude_client", None)

        if question_first_backend == "python_direct" and brightdata_client and claude_client:
            try:
                from backend import question_first_dossier_runner as question_first_runner
            except ImportError:
                import question_first_dossier_runner as question_first_runner  # type: ignore

            orchestrator_ref = self

            async def _question_progress_callback(question_id: str, question_text: str, index: int, total: int) -> None:
                checkpoint = build_question_checkpoint_fields(
                    question_id=question_id,
                    execution_state="searching sources",
                )
                await orchestrator_ref._emit_phase_update(
                    phase_callback,
                    "dossier_generation",
                    {
                        "status": "question_first_running",
                        **runtime_metadata,
                        "current_question_id": question_id,
                        "current_question_text": question_text,
                        "questions_answered": index,
                        "questions_total": total,
                        **checkpoint,
                    },
                )

            merged_dossier = await question_first_runner.run_question_first_direct(
                source_payload=source_payload,
                brightdata_client=brightdata_client,
                claude_client=claude_client,
                progress_callback=_question_progress_callback,
                max_questions=self.question_first_max_questions,
            )
            final_dossier = merged_dossier if isinstance(merged_dossier, dict) else dossier
            if isinstance(final_dossier, dict):
                final_dossier["metadata"] = {
                    **(final_dossier.get("metadata") if isinstance(final_dossier.get("metadata"), dict) else {}),
                    **runtime_metadata,
                }
            return final_dossier

        # Fallback to OpenCode batch runner when clients are not available
        logger.info(
            "Question-first enrichment: backend=%s entity=%s questions=%d brightdata=%s claude=%s",
            question_first_backend,
            entity_id,
            len(questions),
            bool(brightdata_client),
            bool(claude_client),
        )
        try:
            from backend import question_first_dossier_runner as question_first_runner
            from backend.question_first_repair import (
                build_filtered_question_source_payload,
                derive_repair_question_ids,
            )
        except ImportError:
            import question_first_dossier_runner as question_first_runner  # type: ignore
            from question_first_repair import build_filtered_question_source_payload, derive_repair_question_ids  # type: ignore

        launch_source_payload = None
        durable_checkpoint = None
        if isinstance(request_metadata, dict) and isinstance(request_metadata.get("question_first_checkpoint"), dict):
            durable_checkpoint = request_metadata.get("question_first_checkpoint")
        elif isinstance(source_payload.get("question_first_checkpoint"), dict):
            durable_checkpoint = source_payload.get("question_first_checkpoint")
        elif (
            isinstance(source_payload.get("metadata"), dict)
            and isinstance(source_payload.get("metadata", {}).get("question_first_checkpoint"), dict)
        ):
            durable_checkpoint = source_payload.get("metadata", {}).get("question_first_checkpoint")
        persisted_checkpoint = await self._load_persisted_question_first_checkpoint(entity_id=entity_id)
        durable_checkpoint = self._select_richest_question_first_checkpoint(
            durable_checkpoint if isinstance(durable_checkpoint, dict) else None,
            persisted_checkpoint,
        )
        repair_meta = (
            source_payload.get("metadata", {}).get("question_first_repair")
            if isinstance(source_payload.get("metadata"), dict)
            and isinstance(source_payload.get("metadata", {}).get("question_first_repair"), dict)
            else {}
        )
        is_question_repair = bool(repair_meta.get("mode") == "question" and repair_meta.get("question_id"))
        if repair_meta.get("mode") == "question" and repair_meta.get("question_id"):
            repaired_question_ids = derive_repair_question_ids(
                source_payload=source_payload,
                question_id=str(repair_meta.get("question_id")),
                cascade_dependents=bool(repair_meta.get("cascade_dependents", True)),
            )
            repair_meta["repaired_question_ids"] = repaired_question_ids
            source_payload["metadata"]["question_first_repair"] = repair_meta
            launch_source_payload = build_filtered_question_source_payload(
                source_payload=source_payload,
                question_ids=repaired_question_ids,
            )
            # A single-question repair must call the provider for the selected
            # question. Reusing the prior checkpoint marks that question
            # terminal and causes the runner to replay stale answers.
            launch_source_payload.pop("question_first_checkpoint", None)
            launch_metadata = launch_source_payload.get("metadata") if isinstance(launch_source_payload.get("metadata"), dict) else {}
            if isinstance(launch_metadata, dict):
                launch_metadata.pop("question_first_checkpoint", None)
                launch_source_payload["metadata"] = launch_metadata
        elif self.question_first_max_questions > 0 and len(questions) > self.question_first_max_questions:
            capped_question_ids = [
                str(question.get("question_id") or "").strip()
                for question in questions[: self.question_first_max_questions]
                if isinstance(question, dict) and str(question.get("question_id") or "").strip()
            ]
            if capped_question_ids:
                launch_source_payload = build_filtered_question_source_payload(
                    source_payload=source_payload,
                    question_ids=capped_question_ids,
                )
        question_first_checkpoint: Dict[str, Any] = {}

        async def _opencode_progress_callback(event: Dict[str, Any]) -> None:
            nonlocal question_first_checkpoint
            if not isinstance(event, dict):
                return
            question_first_checkpoint = self._merge_question_first_checkpoint_event(
                checkpoint=question_first_checkpoint,
                event=event,
            )
            questions_answered = event.get("questions_answered")
            questions_total = event.get("questions_total")
            checkpoint = build_question_checkpoint_fields(
                question_id=str(event.get("current_question_id") or "").strip() or None,
                execution_state=event.get("current_execution_state") or "searching sources",
                current_substep=str(event.get("current_substep") or "").strip() or None,
                source_order=event.get("current_source_order"),
            )
            await self._emit_phase_update(
                phase_callback,
                "dossier_generation",
                {
                    "status": "question_first_running",
                    **runtime_metadata,
                    "current_substep": str(event.get("current_substep") or "question_first_running"),
                    "current_substep_label": event.get("current_substep_label") or "Question-first running",
                    "current_question_id": event.get("current_question_id"),
                    "current_question_text": event.get("current_question_text"),
                    "questions_answered": questions_answered,
                    "questions_total": questions_total,
                    "current_substep_progress": event.get("current_substep_progress")
                    or (
                        f"{questions_answered}/{questions_total} questions"
                        if questions_answered is not None and questions_total is not None
                        else None
                    ),
                    "question_first_checkpoint": deepcopy(question_first_checkpoint),
                    **checkpoint,
                },
            )
            if event.get("event_type") == "question_completed":
                try:
                    if self._has_provider_infrastructure_failure(question_first_checkpoint):
                        await self._emit_phase_update(
                            phase_callback,
                            "dossier_generation",
                            {
                                "status": "provider_infrastructure_failure",
                                **runtime_metadata,
                                "failure_class": "provider_infrastructure_failure",
                                "failure_reason": "provider_infrastructure_failure",
                                "current_question_id": event.get("current_question_id"),
                                "questions_answered": event.get("questions_answered"),
                                "questions_total": event.get("questions_total"),
                                "question_first_checkpoint": deepcopy(question_first_checkpoint),
                            },
                        )
                        return
                    completed_question = event.get("completed_question")
                    if not isinstance(completed_question, dict):
                        completed_question = {}
                    completed_question_id = str(
                        completed_question.get("question_id")
                        or question_first_checkpoint.get("last_completed_question_id")
                        or event.get("current_question_id")
                        or question_first_checkpoint.get("questions_answered")
                        or "checkpoint"
                    ).strip()
                    partial_dossier = self._build_partial_question_first_dossier(
                        source_payload=source_payload,
                        entity_id=entity_id,
                        entity_name=entity_name,
                        entity_type=entity_type,
                        checkpoint=question_first_checkpoint,
                        request_metadata=request_metadata,
                    )
                    await self._persist_question_first_dossier_snapshot(
                        run_id=run_id,
                        entity_id=entity_id,
                        entity_name=entity_name,
                        entity_type=entity_type,
                        dossier=partial_dossier,
                        question_first_meta=partial_dossier.get("question_first"),
                        request_metadata=request_metadata,
                        record_type="question_first_partial_dossier",
                        record_id=f"{entity_id}:{completed_question_id}",
                    )
                except Exception as error:  # noqa: BLE001
                    logger.warning(
                        "question_first_partial_checkpoint_persist_failed",
                        extra={
                            "entity_id": entity_id,
                            "entity_name": entity_name,
                            "run_id": run_id,
                            "error": str(error),
                        },
                    )

        merged_dossier = await question_first_runner.run_question_first_dossier_from_payload(
            source_payload=source_payload,
            launch_source_payload=launch_source_payload,
            output_dir=Path(self.question_first_output_dir) if self.question_first_persist_reports else None,
            question_first_run_path=source_payload.get("question_first_run_path"),
            opencode_timeout_ms=self.question_first_opencode_timeout,
            preset=source_payload.get("preset"),
            question_source_label=f"{entity_id}::question-first",
            progress_callback=_opencode_progress_callback,
            question_first_checkpoint=(
                None
                if is_question_repair
                else durable_checkpoint if isinstance(durable_checkpoint, dict) else None
            ),
            resume=False if is_question_repair else bool(durable_checkpoint),
        )
        final_dossier = merged_dossier if isinstance(merged_dossier, dict) else dossier
        if isinstance(final_dossier, dict):
            final_dossier["metadata"] = {
                **(final_dossier.get("metadata") if isinstance(final_dossier.get("metadata"), dict) else {}),
                **runtime_metadata,
            }
        return final_dossier

    async def _invoke_question_first_enrichment(
        self,
        *,
        dossier: Dict[str, Any],
        entity_id: str,
        entity_name: str,
        entity_type: str,
        run_id: str,
        request_metadata: Optional[Dict[str, Any]] = None,
        phase_callback: Optional[Any] = None,
    ) -> Dict[str, Any]:
        enrichment = self._run_question_first_enrichment
        kwargs = {
            "dossier": dossier,
            "entity_id": entity_id,
            "entity_name": entity_name,
            "entity_type": entity_type,
            "run_id": run_id,
            "request_metadata": request_metadata,
        }
        try:
            signature = inspect.signature(enrichment)
            accepted_params = set(signature.parameters)
            kwargs = {key: value for key, value in kwargs.items() if key in accepted_params}
            if "phase_callback" in signature.parameters:
                kwargs["phase_callback"] = phase_callback
        except (TypeError, ValueError):
            kwargs["phase_callback"] = phase_callback
        return await enrichment(**kwargs)

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
            await callback(phase, normalize_phase_callback_payload(phase, payload))

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

    def _legacy_llm_disabled_reason(self) -> Optional[str]:
        getter = getattr(self.claude_client, "_get_disabled_reason", None)
        if not callable(getter):
            return None
        reason = str(getter() or "").strip()
        return reason or None

    def _use_question_first_downstream_fallback(
        self,
        *,
        dossier: Dict[str, Any],
        request_metadata: Optional[Dict[str, Any]] = None,
    ) -> bool:
        if not self.question_first_enabled:
            return False
        if self._resolve_question_first_backend(request_metadata) != "opencode":
            return False
        if str(os.getenv("PIPELINE_DISABLE_LEGACY_CLAUDE_FOR_OPENCODE", "true")).strip().lower() not in {
            "1",
            "true",
            "yes",
            "on",
        }:
            return False
        if self._legacy_llm_disabled_reason() != "legacy_llm_disabled_for_opencode":
            return False
        return len(self._extract_question_first_answers(dossier)) > 0

    @staticmethod
    def _extract_question_first_answers(dossier: Dict[str, Any]) -> List[Dict[str, Any]]:
        answers: List[Dict[str, Any]] = []
        question_first = dossier.get("question_first") if isinstance(dossier.get("question_first"), dict) else {}
        direct_answers = question_first.get("answers") if isinstance(question_first.get("answers"), list) else dossier.get("answers")
        if isinstance(direct_answers, list):
            answers.extend([answer for answer in direct_answers if isinstance(answer, dict)])

        checkpoint_candidates = [
            dossier.get("question_first_checkpoint"),
            (dossier.get("metadata") or {}).get("question_first_checkpoint") if isinstance(dossier.get("metadata"), dict) else None,
        ]
        for checkpoint in checkpoint_candidates:
            if not isinstance(checkpoint, dict):
                continue
            answer_records = checkpoint.get("answer_records")
            if isinstance(answer_records, list):
                answers.extend([answer for answer in answer_records if isinstance(answer, dict)])

        seen: set[str] = set()
        deduped: List[Dict[str, Any]] = []
        for answer in answers:
            key = str(answer.get("question_id") or answer.get("question") or len(deduped))
            text = str(answer.get("answer") or answer.get("summary") or answer.get("display_answer") or "")
            dedupe_key = f"{key}:{text[:80]}"
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            deduped.append(answer)
        return deduped

    @staticmethod
    def _question_first_answer_text(answer: Dict[str, Any]) -> str:
        def text_value(value: Any) -> str:
            if isinstance(value, str):
                stripped = value.strip()
                if stripped and stripped.lower() != "[object object]":
                    return stripped
            return ""

        for key in ("answer", "summary", "context", "commercial_implication"):
            value = text_value(answer.get(key))
            if value:
                return value
        display_answer = answer.get("display_answer")
        if isinstance(display_answer, dict):
            for key in ("headline", "summary", "commercial_implication", "verification_needed"):
                value = text_value(display_answer.get(key))
                if value:
                    return value
        raw_structured_output = answer.get("raw_structured_output")
        if not isinstance(raw_structured_output, dict) and isinstance(answer.get("answer"), dict):
            raw_structured_output = answer.get("answer", {}).get("raw_structured_output")
        if isinstance(raw_structured_output, dict):
            for key in ("answer", "summary", "context", "commercial_implication", "headline"):
                value = text_value(raw_structured_output.get(key))
                if value:
                    return value
        structured = answer.get("structured_signal")
        if isinstance(structured, dict) and structured:
            return " ".join(str(value) for value in structured.values() if value is not None)[:500].strip()
        return ""

    @staticmethod
    def _question_first_evidence_urls(answer: Dict[str, Any]) -> List[str]:
        urls: List[str] = []

        def add_url(value: Any) -> None:
            if isinstance(value, str):
                candidate = value.strip()
                if not candidate or candidate.lower() == "[object object]":
                    return
                if candidate.startswith(("http://", "https://")):
                    urls.append(candidate)
            elif isinstance(value, dict):
                add_url(
                    value.get("url")
                    or value.get("source_url")
                    or value.get("evidence_url")
                    or value.get("href")
                    or value.get("link")
                )

        for key in ("evidence_url", "source_url", "scrape_url", "url"):
            add_url(answer.get(key))
        containers = [answer]
        raw_structured_output = answer.get("raw_structured_output")
        if isinstance(raw_structured_output, dict):
            containers.append(raw_structured_output)
        nested_answer = answer.get("answer")
        if isinstance(nested_answer, dict):
            containers.append(nested_answer)
            nested_raw = nested_answer.get("raw_structured_output")
            if isinstance(nested_raw, dict):
                containers.append(nested_raw)
        for container in containers:
            for key in ("sources", "evidence", "evidence_refs", "checked_sources"):
                values = container.get(key)
                if isinstance(values, list):
                    for source in values:
                        add_url(source)
                else:
                    add_url(values)
        display_answer = answer.get("display_answer")
        if isinstance(display_answer, dict):
            evidence = display_answer.get("evidence")
            if isinstance(evidence, list):
                for item in evidence:
                    add_url(item)
            else:
                add_url(evidence)

        seen: set[str] = set()
        deduped: List[str] = []
        for url in urls:
            if url in seen:
                continue
            seen.add(url)
            deduped.append(url)
        return deduped

    @staticmethod
    def _question_first_validation_state(answer: Dict[str, Any]) -> str:
        state = str(answer.get("validation_state") or answer.get("status") or "").strip().lower()
        nested_answer = answer.get("answer")
        if not state and isinstance(nested_answer, dict):
            state = str(nested_answer.get("validation_state") or nested_answer.get("status") or "").strip().lower()
        return state

    @staticmethod
    def _question_first_answer_is_no_signal_contaminated(answer: Dict[str, Any]) -> bool:
        state = PipelineOrchestrator._question_first_validation_state(answer)
        if state not in {"no_signal", "no signal", "insufficient_signal"}:
            return False
        text = PipelineOrchestrator._question_first_answer_text(answer)
        if len(text) < 12:
            return False
        lowered = text.lower()
        if any(token in lowered for token in ("no source-backed signal", "no signal", "insufficient_signal", "not found", "failed")):
            return False
        return True

    @staticmethod
    def _question_first_answer_is_usable(answer: Dict[str, Any]) -> bool:
        if PipelineOrchestrator._question_first_answer_is_no_signal_contaminated(answer):
            return False
        state = PipelineOrchestrator._question_first_validation_state(answer)
        usable_states = {
            "validated",
            "valid",
            "validated_positive_signal",
            "confirmed",
            "checked",
            "checked_sources",
            "provisional",
        }
        if state not in usable_states:
            return False
        text = PipelineOrchestrator._question_first_answer_text(answer)
        if len(text) < 12:
            return False
        lowered = text.lower()
        if lowered in {"no signal", "no source-backed signal found.", "insufficient_signal"}:
            return False
        evidence_urls = PipelineOrchestrator._question_first_evidence_urls(answer)
        if not evidence_urls:
            return False
        if state == "provisional":
            grade = str(answer.get("evidence_grade") or "").strip().lower()
            if grade in {"weak", "none", "null"}:
                return False
        return True

    @staticmethod
    def _question_first_scoring_signal_type(question_id: str, answer: Dict[str, Any]) -> str:
        question_id = question_id.strip().lower()
        if question_id == "q8_explicit_rfp":
            return "EXPLICIT_RFP_SIGNAL"
        if question_id == "q6_launch_signal":
            return "DIGITAL_PLATFORM_LAUNCH"
        if question_id == "q7_procurement_signal":
            return "VENDOR_ECOSYSTEM_SIGNAL"
        if question_id == "q9_news_signal":
            return "COMMERCIAL_NEWS_SIGNAL"
        if question_id == "q10_hiring_signal":
            return "DIGITAL_HIRING_SIGNAL"
        return PipelineOrchestrator._infer_question_first_signal_type(answer)

    def _build_question_first_scoring_signals(self, *, entity_id: str, dossier: Dict[str, Any]) -> List[Dict[str, Any]]:
        scoring_question_ids = {
            "q6_launch_signal",
            "q7_procurement_signal",
            "q8_explicit_rfp",
            "q9_news_signal",
            "q10_hiring_signal",
        }
        signals: List[Dict[str, Any]] = []
        for answer in self._extract_question_first_answers(dossier):
            question_id = str(answer.get("question_id") or "").strip()
            if question_id not in scoring_question_ids:
                continue
            if not self._question_first_answer_is_usable(answer):
                continue
            text = self._question_first_answer_text(answer)
            evidence_urls = self._question_first_evidence_urls(answer)
            signal_type = self._question_first_scoring_signal_type(question_id, answer)
            state = self._question_first_validation_state(answer) or "provisional"
            confidence = answer.get("confidence")
            try:
                confidence_value = float(confidence) if confidence is not None else (0.72 if state == "validated" else 0.58)
            except (TypeError, ValueError):
                confidence_value = 0.72 if state == "validated" else 0.58
            confidence_value = max(0.0, min(1.0, confidence_value))
            signals.append(
                {
                    "id": f"{entity_id}:question-first:{question_id}",
                    "type": signal_type,
                    "signal_type": signal_type,
                    "confidence": confidence_value,
                    "statement": text,
                    "text": text,
                    "description": text,
                    "summary": text,
                    "url": evidence_urls[0] if evidence_urls else None,
                    "entity_id": entity_id,
                    "validation_state": "validated" if state in {"validated", "valid", "validated_positive_signal", "confirmed"} else "provisional",
                    "accept_guard_passed": True,
                    "evidence_pointer_ids": [f"qf:{question_id}"],
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "metadata": {
                        "source": "question_first",
                        "question_id": question_id,
                        "question_text": str(answer.get("question_text") or answer.get("question") or "").strip(),
                        "validation_state": state,
                        "evidence_grade": answer.get("evidence_grade"),
                        "evidence_urls": evidence_urls,
                        "source_backed": bool(evidence_urls),
                        "direct_scoring_signal": True,
                    },
                }
            )
        return signals

    @staticmethod
    def _merge_signal_lists(*signal_lists: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        merged: List[Dict[str, Any]] = []
        seen: set[str] = set()
        for signal_list in signal_lists:
            for signal in signal_list or []:
                if not isinstance(signal, dict):
                    continue
                key = str(signal.get("id") or "")
                if not key:
                    key = f"{signal.get('entity_id')}:{signal.get('type')}:{str(signal.get('statement') or signal.get('text') or '')[:80]}"
                if key in seen:
                    continue
                seen.add(key)
                merged.append(signal)
        return merged

    @staticmethod
    def _infer_question_first_signal_type(answer: Dict[str, Any]) -> str:
        explicit = str(answer.get("signal_type") or answer.get("type") or "").strip()
        if explicit:
            return explicit
        question_id = str(answer.get("question_id") or "").strip().lower()
        question_text = str(answer.get("question_text") or "").strip().lower()
        combined = f"{question_id} {question_text}"
        if any(token in combined for token in ("rfp", "tender", "procurement")):
            return "PROCUREMENT_INDICATOR"
        if any(token in combined for token in ("hiring", "leadership", "technology", "digital", "platform", "vendor")):
            return "CAPABILITY_SIGNAL"
        return "DISCOVERY_SIGNAL"

    def _build_question_first_raw_signals(self, *, entity_id: str, dossier: Dict[str, Any]) -> List[Dict[str, Any]]:
        raw_signals: List[Dict[str, Any]] = []
        for answer in self._extract_question_first_answers(dossier):
            validation_state = str(answer.get("validation_state") or "").strip().lower()
            if validation_state not in {"validated", "provisional"}:
                continue
            evidence_url = str(answer.get("evidence_url") or answer.get("scrape_url") or "").strip()
            answer_text = str(answer.get("answer") or "").strip()
            if not evidence_url or not answer_text:
                continue
            question_id = str(answer.get("question_id") or "").strip() or "question-first"
            signal_type = self._infer_question_first_signal_type(answer)
            confidence = float(answer.get("confidence") or 0.0)
            raw_signals.append(
                {
                    "id": f"{entity_id}:{question_id}",
                    "type": signal_type,
                    "signal_type": signal_type,
                    "confidence": confidence,
                    "statement": answer_text,
                    "text": answer_text,
                    "url": evidence_url,
                    "entity_id": entity_id,
                    "validation_state": validation_state,
                    "metadata": {
                        "source": "question_first",
                        "question_id": question_id,
                        "question_text": str(answer.get("question_text") or "").strip(),
                        "category": str(answer.get("category") or "").strip() or None,
                        "evidence_pointer_ids": [f"qf:{question_id}"],
                    },
                }
            )
        return raw_signals

    def _build_question_first_discovery_result(self, *, entity_id: str, dossier: Dict[str, Any]) -> Dict[str, Any]:
        raw_signals = self._build_question_first_raw_signals(entity_id=entity_id, dossier=dossier)
        provisional_signals = [
            signal for signal in raw_signals if str(signal.get("validation_state") or "").strip().lower() == "provisional"
        ]
        hypotheses = [
            {
                "statement": signal.get("statement"),
                "confidence": signal.get("confidence"),
                "category": signal.get("type"),
                "source": "question_first",
            }
            for signal in raw_signals
        ]
        return {
            "final_confidence": max((float(signal.get("confidence") or 0.0) for signal in raw_signals), default=0.0),
            "iterations_completed": 0,
            "signals_discovered": list(raw_signals),
            "provisional_signals": provisional_signals,
            "raw_signals": raw_signals,
            "hypotheses": hypotheses,
            "performance_summary": {
                "llm_call_count": 0,
                "llm_fallback_count": 0,
                "length_stop_count": 0,
                "schema_fail_count": 0,
                "question_first_downstream_fallback": 1,
            },
            "parse_path": "question_first_downstream_fallback",
            "llm_last_status": "legacy_llm_disabled",
            "controller_health_reasons": ["question_first_downstream_fallback"],
        }

    def _build_question_first_ralph_result(
        self,
        *,
        entity_id: str,
        raw_signals: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        validated_signals: List[Dict[str, Any]] = []
        capability_signals: List[Dict[str, Any]] = []
        for signal in raw_signals:
            if str(signal.get("validation_state") or "").strip().lower() != "validated":
                continue
            normalized_signal = {
                **signal,
                "id": signal.get("id") or f"{entity_id}:validated",
                "accept_guard_passed": True,
                "evidence_pointer_ids": list(
                    ((signal.get("metadata") or {}).get("evidence_pointer_ids") if isinstance(signal.get("metadata"), dict) else [])
                    or [f"qf:{entity_id}"]
                ),
            }
            validated_signals.append(normalized_signal)
            if not self._is_rfp_signal(normalized_signal):
                capability_signals.append(normalized_signal)
        return {
            "validated_signals": validated_signals,
            "capability_signals": capability_signals,
            "hypothesis_states": {},
        }

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
