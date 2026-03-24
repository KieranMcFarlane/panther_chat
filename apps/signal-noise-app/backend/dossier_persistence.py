from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict, Optional


def _first_non_empty(*values: Any) -> str:
    for value in values:
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return ""


def _extract_canonical_sources(dossier: Dict[str, Any], entity_data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    metadata = dossier.get("metadata") if isinstance(dossier, dict) else {}
    canonical_sources = metadata.get("canonical_sources") if isinstance(metadata, dict) else {}
    if not isinstance(canonical_sources, dict):
        canonical_sources = {}

    entity_data = entity_data if isinstance(entity_data, dict) else {}
    return {
        "official_site": _first_non_empty(
            canonical_sources.get("official_site"),
            metadata.get("source_url"),
            entity_data.get("official_site_url"),
            entity_data.get("website"),
            canonical_sources.get("press"),
        ),
        "press": _first_non_empty(canonical_sources.get("press"), metadata.get("press_url")),
    }


def _format_leadership_summary(dossier: Dict[str, Any]) -> str:
    leadership = (dossier.get("leadership_analysis") or {}).get("decision_makers") or []
    if not isinstance(leadership, list) or not leadership:
        return "none"

    formatted: list[str] = []
    for item in leadership[:3]:
        if not isinstance(item, dict):
            continue
        name = _first_non_empty(item.get("name"), "unknown")
        role = _first_non_empty(item.get("role"), "")
        formatted.append(f"{name} ({role})" if role else name)

    return ", ".join(formatted) if formatted else "none"


def build_dossier_persistence_context(
    *,
    entity_id: str,
    entity_name: str,
    dossier: Dict[str, Any],
    entity_data: Optional[Dict[str, Any]] = None,
    run_objective: Optional[str] = None,
) -> Dict[str, Any]:
    dossier = dossier if isinstance(dossier, dict) else {}
    entity_data = entity_data if isinstance(entity_data, dict) else {}
    metadata = dossier.get("metadata") if isinstance(dossier.get("metadata"), dict) else {}
    canonical_sources = _extract_canonical_sources(dossier, entity_data)

    browser_dossier_url = f"/entity-browser/{entity_id}/dossier"
    source_url = canonical_sources.get("official_site") or canonical_sources.get("press") or browser_dossier_url
    page_url = browser_dossier_url

    opportunities = (dossier.get("procurement_signals") or {}).get("upcoming_opportunities") or []
    if not isinstance(opportunities, list):
        opportunities = []

    leadership = (dossier.get("leadership_analysis") or {}).get("decision_makers") or []
    if not isinstance(leadership, list):
        leadership = []

    top_probability = 0
    top_opportunity_name = ""
    for opportunity in opportunities:
        if not isinstance(opportunity, dict):
            continue
        probability = opportunity.get("rfp_probability")
        try:
            probability_value = int(round(float(probability)))
        except (TypeError, ValueError):
            probability_value = 0
        if probability_value >= top_probability:
            top_probability = probability_value
            top_opportunity_name = _first_non_empty(opportunity.get("opportunity"), opportunity.get("type"), "opportunity")

    opportunity_score = top_probability if opportunities else 0
    rfp_confidence = round(opportunity_score / 100.0, 2) if opportunity_score > 0 else 0.0
    leadership_summary = _format_leadership_summary(dossier)
    leadership_count = len([item for item in leadership if isinstance(item, dict)])
    opportunity_count = len([item for item in opportunities if isinstance(item, dict)])

    if opportunity_count > 0 and opportunity_score >= 70:
        signal_state = "opportunity_high"
    elif opportunity_count > 0:
        signal_state = "opportunity_monitor"
    elif leadership_count > 0:
        signal_state = "leadership_monitor_only"
    else:
        signal_state = "monitor_no_opportunity"

    if opportunity_count > 0:
        decision_summary = (
            f"{opportunity_count} opportunity signal(s) detected"
            + (f" ({top_opportunity_name})" if top_opportunity_name else "")
            + f"; decision makers: {leadership_summary}; signal state: {signal_state}."
        )
    else:
        decision_summary = (
            f"No procurement opportunity detected; decision makers: {leadership_summary}; "
            f"signal state: {signal_state}."
        )

    generated_at = _first_non_empty(
        dossier.get("generated_at"),
        metadata.get("generated_at"),
        metadata.get("collected_at"),
    )

    run_reference = {
        "entity_id": entity_id,
        "entity_name": entity_name,
        "run_objective": _first_non_empty(run_objective, metadata.get("run_objective"), "dossier_core"),
        "generated_at": generated_at,
        "browser_dossier_url": browser_dossier_url,
        "source_url": source_url,
    }

    return {
        "browser_dossier_url": browser_dossier_url,
        "source_url": source_url,
        "page_url": page_url,
        "opportunity_score": opportunity_score,
        "rfp_confidence": rfp_confidence,
        "signal_state": signal_state,
        "decision_summary": decision_summary,
        "last_pipeline_run_ref": run_reference,
    }


def apply_dossier_persistence_context(
    dossier: Dict[str, Any],
    *,
    entity_id: str,
    entity_name: str,
    entity_data: Optional[Dict[str, Any]] = None,
    run_objective: Optional[str] = None,
) -> Dict[str, Any]:
    enriched = deepcopy(dossier if isinstance(dossier, dict) else {})
    metadata = enriched.get("metadata")
    if not isinstance(metadata, dict):
        metadata = {}
        enriched["metadata"] = metadata

    persistence_context = build_dossier_persistence_context(
        entity_id=entity_id,
        entity_name=entity_name,
        dossier=enriched,
        entity_data=entity_data,
        run_objective=run_objective,
    )

    metadata.update(persistence_context)
    enriched.update(persistence_context)
    return enriched


def apply_dashboard_score_persistence_context(
    dossier: Dict[str, Any],
    *,
    entity_id: str,
    entity_name: str,
    dashboard_scores: Optional[Dict[str, Any]] = None,
    entity_data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    enriched = deepcopy(dossier if isinstance(dossier, dict) else {})
    metadata = enriched.get("metadata")
    if not isinstance(metadata, dict):
        metadata = {}
        enriched["metadata"] = metadata

    entity_data = entity_data if isinstance(entity_data, dict) else {}
    dashboard_scores = dashboard_scores if isinstance(dashboard_scores, dict) else {}

    browser_dossier_url = _first_non_empty(
        metadata.get("browser_dossier_url"),
        enriched.get("browser_dossier_url"),
        f"/entity-browser/{entity_id}/dossier",
    )
    source_url = _first_non_empty(
        metadata.get("source_url"),
        enriched.get("source_url"),
        metadata.get("website"),
        (metadata.get("canonical_sources") or {}).get("official_site") if isinstance(metadata.get("canonical_sources"), dict) else None,
        entity_data.get("official_site_url"),
        entity_data.get("website"),
        browser_dossier_url,
    )

    if browser_dossier_url:
        metadata["browser_dossier_url"] = browser_dossier_url
        metadata.setdefault("page_url", browser_dossier_url)
        enriched["browser_dossier_url"] = browser_dossier_url
        enriched.setdefault("page_url", browser_dossier_url)

    if source_url:
        metadata["source_url"] = source_url
        enriched["source_url"] = source_url
        canonical_sources = metadata.get("canonical_sources")
        if not isinstance(canonical_sources, dict):
            canonical_sources = {}
            metadata["canonical_sources"] = canonical_sources
        canonical_sources.setdefault("official_site", source_url)

    active_probability = dashboard_scores.get("active_probability")
    sales_readiness = _first_non_empty(dashboard_scores.get("sales_readiness"), metadata.get("signal_state")).upper()
    if sales_readiness in {"LIVE", "HIGH_PRIORITY", "ENGAGE"}:
        try:
            active_probability_value = float(active_probability)
        except (TypeError, ValueError):
            active_probability_value = 0.0
        opportunity_score = int(round(active_probability_value * 100))
        rfp_confidence = round(active_probability_value, 3)
        signal_state = "opportunity_high" if opportunity_score >= 70 else "opportunity_monitor"
        if opportunity_score <= 0:
            signal_state = "monitor_no_opportunity"
    else:
        opportunity_score = int(metadata.get("opportunity_score") or 0)
        rfp_confidence = float(metadata.get("rfp_confidence") or 0.0)
        signal_state = _first_non_empty(metadata.get("signal_state"), "monitor_no_opportunity")
        if opportunity_score <= 0:
            signal_state = "monitor_no_opportunity"

    metadata["opportunity_score"] = opportunity_score
    metadata["rfp_confidence"] = rfp_confidence
    metadata["signal_state"] = signal_state
    enriched["opportunity_score"] = opportunity_score
    enriched["rfp_confidence"] = rfp_confidence
    enriched["signal_state"] = signal_state

    decision_summary = _first_non_empty(metadata.get("decision_summary"))
    if not decision_summary:
        if opportunity_score > 0:
            decision_summary = (
                f"Dashboard posture {sales_readiness or 'UNKNOWN'} with opportunity score "
                f"{opportunity_score}/100 and active probability {rfp_confidence:.2f}."
            )
        else:
            decision_summary = "Dashboard posture MONITOR with no validated procurement opportunity."
    metadata["decision_summary"] = decision_summary
    enriched["decision_summary"] = decision_summary

    run_reference = metadata.get("last_pipeline_run_ref")
    if not isinstance(run_reference, dict):
        run_reference = {}
    run_reference.update(
        {
            "entity_id": entity_id,
            "entity_name": entity_name,
            "browser_dossier_url": browser_dossier_url,
            "source_url": source_url,
            "opportunity_score": opportunity_score,
            "rfp_confidence": rfp_confidence,
            "signal_state": signal_state,
            "sales_readiness": sales_readiness or dashboard_scores.get("sales_readiness"),
            "active_probability": dashboard_scores.get("active_probability"),
            "procurement_maturity": dashboard_scores.get("procurement_maturity"),
        }
    )
    metadata["last_pipeline_run_ref"] = run_reference
    enriched["last_pipeline_run_ref"] = run_reference

    return enriched


def finalize_run_report_payload(report_payload: Dict[str, Any], report_path: str) -> Dict[str, Any]:
    finalized = deepcopy(report_payload if isinstance(report_payload, dict) else {})
    report_path_str = str(report_path)

    finalized["report_path"] = report_path_str
    finalized["run_report_path"] = report_path_str

    artifacts = finalized.get("artifacts")
    if not isinstance(artifacts, dict):
        artifacts = {}
        finalized["artifacts"] = artifacts

    artifacts["report_path"] = report_path_str
    artifacts["run_report_path"] = report_path_str

    for key in ("dossier_path", "discovery_path", "scores_path", "hop_trace_path", "control_discovery_path", "agentic_discovery_path"):
        value = finalized.get(key)
        if value is None and key in artifacts:
            value = artifacts.get(key)
        if value is not None:
            finalized[key] = value

    return finalized
