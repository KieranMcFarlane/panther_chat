#!/usr/bin/env python3
"""Shared publication-quality gates for persisted dossier payloads."""

from __future__ import annotations

from typing import Any, Dict


def _as_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _has_text(value: Any) -> bool:
    return bool(str(value or "").strip())


def _has_non_empty_section(value: Any) -> bool:
    if not isinstance(value, list):
        return False
    for item in value:
        if isinstance(item, dict):
            content = item.get("content")
            if isinstance(content, list) and any(_has_text(part) for part in content):
                return True
            if _has_text(item.get("summary") or item.get("body") or item.get("text")):
                return True
        elif _has_text(item):
            return True
    return False


def has_meaningful_publication_artifacts(dossier: Dict[str, Any]) -> bool:
    """Return true only when a dossier has the minimum commercial artifacts for full publication."""
    payload = _as_dict(dossier)
    question_first = _as_dict(payload.get("question_first"))
    discovery_summary = _as_dict(question_first.get("discovery_summary"))
    graphiti_sales_brief = _as_dict(discovery_summary.get("graphiti_sales_brief") or payload.get("graphiti_sales_brief"))
    yellow_panther_fit = _as_dict(
        discovery_summary.get("yellow_panther_fit")
        or discovery_summary.get("yellow_panther_opportunity")
        or payload.get("yellow_panther_fit")
    )
    outreach_strategy = _as_dict(discovery_summary.get("outreach_strategy") or payload.get("outreach_strategy"))
    executive_summary = _as_dict(payload.get("executive_summary"))
    strategic_analysis = _as_dict(payload.get("strategic_analysis"))

    has_sales_brief = (
        str(graphiti_sales_brief.get("status") or "").strip().lower() == "available"
        and any(_has_text(graphiti_sales_brief.get(key)) for key in ("buyer_name", "outreach_target", "outreach_angle"))
    )
    has_yp_fit = any(
        _has_text(yellow_panther_fit.get(key))
        for key in ("fit_rationale", "fit_feedback", "competitive_advantage", "best_service", "service_fit")
    )
    has_outreach = any(
        _has_text(outreach_strategy.get(key))
        for key in ("recommended_target", "recommended_route", "recommended_angle", "first_message_strategy")
    )
    has_summary = (
        any(_has_text(executive_summary.get(key)) for key in ("summary", "headline"))
        or any(_has_text(strategic_analysis.get(key)) for key in ("recommended_approach", "overall_assessment"))
        or _has_non_empty_section(payload.get("sections"))
    )
    has_buyer_path = has_sales_brief or has_outreach

    return has_sales_brief and has_yp_fit and has_outreach and has_summary and has_buyer_path


def apply_publication_quality_gates(dossier: Dict[str, Any]) -> Dict[str, Any]:
    """Demote full published status unless commercial publication artifacts are present."""
    payload = dossier if isinstance(dossier, dict) else {}
    if not payload:
        return payload

    if not has_meaningful_publication_artifacts(payload):
        publish_status = str(payload.get("publish_status") or payload.get("publication_status") or "").strip().lower()
        if publish_status.startswith("published"):
            payload["publish_status"] = "published_partial"
            payload["publication_status"] = "published_partial"
            question_first = payload.get("question_first")
            if isinstance(question_first, dict):
                question_first["publish_status"] = "published_partial"
            metadata = payload.get("metadata")
            if isinstance(metadata, dict):
                metadata_question_first = metadata.get("question_first")
                if isinstance(metadata_question_first, dict):
                    metadata_question_first["publish_status"] = "published_partial"
    return payload
