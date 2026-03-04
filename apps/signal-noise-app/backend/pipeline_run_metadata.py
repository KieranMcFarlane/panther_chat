#!/usr/bin/env python3
"""
Shared helpers for shaping pipeline run metadata.
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict, Optional


def merge_pipeline_phase_metadata(existing_metadata: Optional[Dict[str, Any]], payload: Dict[str, Any]) -> Dict[str, Any]:
    metadata = deepcopy(existing_metadata or {})
    metadata["phase_details"] = payload
    if payload.get("monitoring_summary") is not None:
        metadata["monitoring_summary"] = payload.get("monitoring_summary")
    if payload.get("escalation_reason") is not None:
        metadata["escalation_reason"] = payload.get("escalation_reason")
    if payload.get("performance_summary") is not None:
        metadata["performance_summary"] = payload.get("performance_summary")
    if payload.get("discovery_context") is not None:
        metadata["discovery_context"] = payload.get("discovery_context")
    return metadata


def merge_pipeline_run_metadata(
    existing_metadata: Optional[Dict[str, Any]],
    *,
    phases: Optional[Dict[str, Any]] = None,
    scores: Optional[Dict[str, Any]] = None,
    monitoring_summary: Optional[Dict[str, Any]] = None,
    escalation_reason: Optional[str] = None,
    performance_summary: Optional[Dict[str, Any]] = None,
    discovery_context: Optional[Dict[str, Any]] = None,
    promoted_rfp_ids: Optional[list[str]] = None,
    completed_at: Optional[str] = None,
) -> Dict[str, Any]:
    metadata = deepcopy(existing_metadata or {})
    if phases is not None:
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
    if promoted_rfp_ids is not None:
        metadata["promoted_rfp_ids"] = promoted_rfp_ids
    if completed_at is not None:
        metadata["completed_at"] = completed_at
    return metadata


def derive_discovery_context(result: Dict[str, Any]) -> Dict[str, Any]:
    discovery_result = ((result.get("artifacts") or {}).get("discovery_result") or {})
    hypotheses = discovery_result.get("hypotheses") or []
    if not isinstance(hypotheses, list):
        hypotheses = []
    performance_summary = discovery_result.get("performance_summary") or {}
    slowest_iteration = performance_summary.get("slowest_iteration") or {}

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
    }


def derive_monitoring_summary(result: Dict[str, Any]) -> Dict[str, Any]:
    monitoring_result = ((result.get("artifacts") or {}).get("monitoring_result") or {})
    candidate_types: Dict[str, int] = {}
    llm_validated_count = 0
    escalation_recommended_count = 0
    for candidate in monitoring_result.get("candidates") or []:
        candidate_type = str(candidate.get("candidate_type") or "unknown")
        candidate_types[candidate_type] = candidate_types.get(candidate_type, 0) + 1
        validation_result = (candidate.get("metadata") or {}).get("validation_result") or {}
        if validation_result:
            llm_validated_count += 1
            if validation_result.get("should_escalate"):
                escalation_recommended_count += 1
    return {
        "pages_fetched": monitoring_result.get("pages_fetched", 0),
        "pages_changed": monitoring_result.get("pages_changed", 0),
        "pages_unchanged": monitoring_result.get("pages_unchanged", 0),
        "candidate_count": monitoring_result.get("candidate_count", 0),
        "snapshot_count": len(monitoring_result.get("snapshots") or []),
        "candidate_types": candidate_types,
        "llm_validated_count": llm_validated_count,
        "escalation_recommended_count": escalation_recommended_count,
    }
