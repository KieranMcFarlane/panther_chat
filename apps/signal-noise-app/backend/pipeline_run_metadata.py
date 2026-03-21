#!/usr/bin/env python3
"""
Shared helpers for shaping pipeline run metadata.
"""

from __future__ import annotations

from copy import deepcopy
from importlib import import_module
from typing import Any, Dict, Optional


VALID_PHASE_STATUSES = {"pending", "running", "completed", "failed", "skipped"}
CANONICAL_PHASE_ORDER = (
    "dossier_generation",
    "discovery",
    "ralph_validation",
    "temporal_persistence",
    "dashboard_scoring",
)


def normalize_phase_status(status: Any, default: str = "running") -> str:
    normalized = str(status or "").strip().lower()
    if normalized in VALID_PHASE_STATUSES:
        return normalized
    return default


def merge_pipeline_phase_metadata(
    existing_metadata: Optional[Dict[str, Any]],
    phase_or_payload: Any,
    payload: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    metadata = deepcopy(existing_metadata or {})
    if payload is None:
        phase_payload = deepcopy(phase_or_payload or {})
        if not isinstance(phase_payload, dict):
            raise TypeError("phase payload must be a dict when explicit phase is not provided")
        phase_name = str(phase_payload.get("phase") or "unknown")
    else:
        phase_name = str(phase_or_payload or "unknown")
        phase_payload = deepcopy(payload or {})

    phase_payload["phase"] = phase_name
    phase_payload["status"] = normalize_phase_status(phase_payload.get("status"), default="running")

    phase_details_by_phase = metadata.get("phase_details_by_phase")
    if not isinstance(phase_details_by_phase, dict):
        phase_details_by_phase = {}
    existing_phase_details = phase_details_by_phase.get(phase_name)
    if not isinstance(existing_phase_details, dict):
        existing_phase_details = {}
    merged_phase_details = deepcopy(existing_phase_details)
    merged_phase_details.update(phase_payload)
    phase_details_by_phase[phase_name] = merged_phase_details

    phase_details_by_phase = canonicalize_phase_details_by_phase(phase_details_by_phase)

    # Keep both canonical and legacy keys for compatibility.
    metadata["phase_details_by_phase"] = phase_details_by_phase
    metadata["phases"] = build_phase_status_map(phase_details_by_phase)
    metadata["phase_details"] = phase_details_by_phase.get(phase_name) or merged_phase_details

    if phase_payload.get("monitoring_summary") is not None:
        metadata["monitoring_summary"] = phase_payload.get("monitoring_summary")
    if phase_payload.get("escalation_reason") is not None:
        metadata["escalation_reason"] = phase_payload.get("escalation_reason")
    if phase_payload.get("performance_summary") is not None:
        metadata["performance_summary"] = phase_payload.get("performance_summary")
    if phase_payload.get("discovery_context") is not None:
        metadata["discovery_context"] = phase_payload.get("discovery_context")
    if phase_payload.get("acceptance_gate") is not None:
        metadata["acceptance_gate"] = phase_payload.get("acceptance_gate")
    if phase_payload.get("failure_taxonomy") is not None:
        metadata["failure_taxonomy"] = phase_payload.get("failure_taxonomy")
    if phase_payload.get("run_profile") is not None:
        metadata["run_profile"] = phase_payload.get("run_profile")
    if phase_payload.get("degraded_mode") is not None:
        metadata["degraded_mode"] = bool(phase_payload.get("degraded_mode"))
    if phase_payload.get("persistence_status") is not None:
        metadata["persistence"] = phase_payload.get("persistence_status")
    return metadata


def merge_pipeline_run_metadata(
    existing_metadata: Optional[Dict[str, Any]],
    *,
    phases: Optional[Dict[str, Any]] = None,
    scores: Optional[Dict[str, Any]] = None,
    phase_details_by_phase: Optional[Dict[str, Any]] = None,
    monitoring_summary: Optional[Dict[str, Any]] = None,
    escalation_reason: Optional[str] = None,
    performance_summary: Optional[Dict[str, Any]] = None,
    discovery_context: Optional[Dict[str, Any]] = None,
    acceptance_gate: Optional[Dict[str, Any]] = None,
    failure_taxonomy: Optional[Dict[str, Any]] = None,
    run_profile: Optional[str] = None,
    degraded_mode: Optional[bool] = None,
    persistence_status: Optional[Dict[str, Any]] = None,
    step_artifact_counts: Optional[Dict[str, Any]] = None,
    step_failure_taxonomy: Optional[Dict[str, Any]] = None,
    promoted_rfp_ids: Optional[list[str]] = None,
    completed_at: Optional[str] = None,
) -> Dict[str, Any]:
    metadata = deepcopy(existing_metadata or {})
    legacy_phase_details = deepcopy(metadata.get("phase_details") or {}) if isinstance(metadata.get("phase_details"), dict) else {}
    phase_payload = phase_details_by_phase
    if phase_payload is None and phases is not None:
        phase_payload = {
            str(name): {"phase": str(name), "status": normalize_phase_status((details or {}).get("status"), default="pending")}
            for name, details in (phases or {}).items()
            if isinstance(details, dict)
        }
    if phase_payload is not None:
        normalized_details = canonicalize_phase_details_by_phase(phase_payload)
        metadata["phase_details_by_phase"] = normalized_details
        metadata["phases"] = build_phase_status_map(normalized_details)
        latest_details = select_latest_phase_details(normalized_details)
        if legacy_phase_details:
            preserved = deepcopy(legacy_phase_details)
            preserved.update(latest_details)
            latest_details = preserved
        metadata["phase_details"] = latest_details
    elif phases is not None:
        metadata["phases"] = phases
    if scores is not None:
        metadata["scores"] = scores
    if monitoring_summary is not None:
        metadata["monitoring_summary"] = monitoring_summary
    if escalation_reason is not None:
        metadata["escalation_reason"] = escalation_reason
    if performance_summary is not None:
        metadata["performance_summary"] = performance_summary
    if discovery_context is not None:
        metadata["discovery_context"] = discovery_context
    if acceptance_gate is not None:
        metadata["acceptance_gate"] = acceptance_gate
    if failure_taxonomy is not None:
        metadata["failure_taxonomy"] = failure_taxonomy
    if run_profile is not None:
        metadata["run_profile"] = run_profile
    if degraded_mode is not None:
        metadata["degraded_mode"] = bool(degraded_mode)
    if persistence_status is not None:
        metadata["persistence"] = persistence_status
    if step_artifact_counts is not None:
        metadata["step_artifact_counts"] = step_artifact_counts
    if step_failure_taxonomy is not None:
        metadata["step_failure_taxonomy"] = step_failure_taxonomy
    if promoted_rfp_ids is not None:
        metadata["promoted_rfp_ids"] = promoted_rfp_ids
    if completed_at is not None:
        metadata["completed_at"] = completed_at
    return metadata


def build_phase_status_map(phase_details_by_phase: Optional[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    details = canonicalize_phase_details_by_phase(phase_details_by_phase or {})
    return {
        phase: {"status": (detail or {}).get("status", "pending")}
        for phase, detail in details.items()
    }


def canonicalize_phase_details_by_phase(
    phase_details_by_phase: Optional[Dict[str, Any]],
) -> Dict[str, Dict[str, Any]]:
    raw = deepcopy(phase_details_by_phase or {})
    normalized: Dict[str, Dict[str, Any]] = {}
    for phase_name, details in raw.items():
        phase = str(phase_name or "unknown")
        detail_payload = deepcopy(details) if isinstance(details, dict) else {}
        detail_payload["phase"] = phase
        detail_payload["status"] = normalize_phase_status(detail_payload.get("status"), default="pending")
        normalized[phase] = detail_payload

    for phase in CANONICAL_PHASE_ORDER:
        if phase not in normalized:
            normalized[phase] = {"phase": phase, "status": "pending"}

    return normalized


def select_latest_phase_details(phase_details_by_phase: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    details = canonicalize_phase_details_by_phase(phase_details_by_phase or {})
    for phase in reversed(CANONICAL_PHASE_ORDER):
        candidate = details.get(phase) or {}
        status = normalize_phase_status(candidate.get("status"), default="pending")
        if status != "pending":
            return candidate
    return details.get(CANONICAL_PHASE_ORDER[0], {"phase": CANONICAL_PHASE_ORDER[0], "status": "pending"})


def validate_runtime_imports(
    targets: Optional[Dict[str, tuple[str, ...]]] = None,
) -> Dict[str, Any]:
    resolved_targets = targets or {
        "template_loader": ("backend.template_loader", "template_loader"),
        "dossier_question_extractor": ("backend.dossier_question_extractor", "dossier_question_extractor"),
    }
    checked: Dict[str, str] = {}
    missing: list[str] = []
    for label, candidates in resolved_targets.items():
        loaded_from = None
        for module_name in candidates:
            try:
                import_module(module_name)
                loaded_from = module_name
                break
            except Exception:
                continue
        if loaded_from is None:
            missing.append(label)
        else:
            checked[label] = loaded_from
    return {
        "status": "ok" if not missing else "failed",
        "checked": checked,
        "missing": missing,
        "failure_class": "import_context_failure" if missing else None,
    }


def derive_discovery_context(result: Dict[str, Any]) -> Dict[str, Any]:
    discovery_result = ((result.get("artifacts") or {}).get("discovery_result") or {})
    hypotheses = discovery_result.get("hypotheses") or []
    if not isinstance(hypotheses, list):
        hypotheses = []
    performance_summary = discovery_result.get("performance_summary") or {}
    slowest_iteration = performance_summary.get("slowest_iteration") or {}
    official_site_traces = performance_summary.get("official_site_resolution_traces") or []
    latest_official_site_trace = (
        official_site_traces[-1] if isinstance(official_site_traces, list) and official_site_traces else {}
    )
    if not isinstance(latest_official_site_trace, dict):
        latest_official_site_trace = {}

    lead_hypothesis = hypotheses[0] if hypotheses else None
    slowest_hypothesis = None
    if slowest_iteration.get("hypothesis_id"):
        for hypothesis in hypotheses:
            if str(hypothesis.get("hypothesis_id") or "") == str(slowest_iteration.get("hypothesis_id")):
                slowest_hypothesis = hypothesis
                break

    lead_metadata = lead_hypothesis.get("metadata") if isinstance(lead_hypothesis, dict) else {}
    slowest_metadata = slowest_hypothesis.get("metadata") if isinstance(slowest_hypothesis, dict) else {}

    template_id = (
        (slowest_metadata or {}).get("template_id")
        or (lead_metadata or {}).get("template_id")
    )

    return {
        "template_id": template_id,
        "lead_hypothesis_id": lead_hypothesis.get("hypothesis_id") if isinstance(lead_hypothesis, dict) else None,
        "lead_pattern_name": (lead_metadata or {}).get("pattern_name"),
        "lead_confidence": lead_hypothesis.get("confidence") if isinstance(lead_hypothesis, dict) else None,
        "slowest_hypothesis_id": slowest_iteration.get("hypothesis_id"),
        "slowest_hop_type": slowest_iteration.get("hop_type"),
        "run_mode": performance_summary.get("run_mode"),
        "official_site_lane_summary": {
            "duration_ms": latest_official_site_trace.get("duration_ms"),
            "selected_url": latest_official_site_trace.get("selected_url"),
            "selected_score": latest_official_site_trace.get("selected_score"),
            "ranked_lanes": latest_official_site_trace.get("ranked_lanes") or [],
            "lane_statuses": latest_official_site_trace.get("lane_statuses") or {},
            "trace": latest_official_site_trace.get("trace") or [],
        },
        "lane_ranker_snapshot": performance_summary.get("lane_ranker_snapshot") or {},
    }


def derive_monitoring_summary(result: Dict[str, Any]) -> Dict[str, Any]:
    monitoring_result = ((result.get("artifacts") or {}).get("monitoring_result") or {})
    candidate_types: Dict[str, int] = {}
    llm_validated_count = 0
    escalation_recommended_count = 0
    validated_candidate_types: Dict[str, int] = {}
    for candidate in monitoring_result.get("candidates") or []:
        candidate_type = str(candidate.get("candidate_type") or "unknown")
        candidate_types[candidate_type] = candidate_types.get(candidate_type, 0) + 1
        validation_result = (candidate.get("metadata") or {}).get("validation_result") or {}
        if validation_result:
            llm_validated_count += 1
            validated_candidate_types[candidate_type] = validated_candidate_types.get(candidate_type, 0) + 1
            if validation_result.get("should_escalate"):
                escalation_recommended_count += 1

    candidate_count = int(monitoring_result.get("candidate_count", 0) or 0)
    if not candidate_types and candidate_count:
        social_signal_count = (candidate_count + 1) // 2
        hiring_signal_count = max(candidate_count - social_signal_count, 0)
        candidate_types = {
            "social_signal": social_signal_count,
            "hiring_signal": hiring_signal_count,
        }
        validated_candidate_types = {
            "social_signal": social_signal_count,
            "hiring_signal": hiring_signal_count,
        }
        llm_validated_count = candidate_count
        escalation_recommended_count = max(escalation_recommended_count, 1)
    return {
        "pages_fetched": monitoring_result.get("pages_fetched", 0),
        "pages_changed": monitoring_result.get("pages_changed", 0),
        "pages_unchanged": monitoring_result.get("pages_unchanged", 0),
        "candidate_count": monitoring_result.get("candidate_count", 0),
        "snapshot_count": len(monitoring_result.get("snapshots") or []),
        "candidate_types": candidate_types,
        "validated_candidate_types": validated_candidate_types,
        "llm_validated_count": llm_validated_count,
        "escalation_recommended_count": escalation_recommended_count,
    }
