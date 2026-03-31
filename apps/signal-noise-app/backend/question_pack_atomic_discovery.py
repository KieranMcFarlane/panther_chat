#!/usr/bin/env python3
"""Map final Ralph prompts into an atomic discovery pack shape."""

from __future__ import annotations

from typing import Any, Dict, List, Mapping, Sequence

SERVICE_KEYWORDS = {
    "MOBILE_APPS": ["mobile app", "mobile", "ios", "android", "app"],
    "DIGITAL_TRANSFORMATION": ["digital transformation", "modernization", "modernisation", "migration", "legacy", "platform"],
    "FAN_ENGAGEMENT": ["fan engagement", "fan experience", "supporter", "loyalty"],
    "ANALYTICS": ["analytics", "data", "reporting", "insight", "dashboard"],
    "ECOMMERCE": ["e-commerce", "ecommerce", "ticketing", "merchandise", "shop", "checkout"],
    "UI_UX_DESIGN": ["ui", "ux", "design", "experience", "interface"],
}

BUDGET_MAP = {
    "MOBILE_APPS": "£80K-£300K",
    "DIGITAL_TRANSFORMATION": "£150K-£500K",
    "FAN_ENGAGEMENT": "£80K-£250K",
    "ANALYTICS": "£100K-£400K",
    "ECOMMERCE": "£100K-£500K",
    "UI_UX_DESIGN": "£50K-£150K",
}

POSITIONING_MAP = {
    "direct_revenue_signal": "SOLUTION_PROVIDER",
    "high_signal": "STRATEGIC_PARTNER",
    "context_support": "CAPABILITY_PARTNER",
    "weak_signal": "TRUSTED_ADVISOR",
}


def _normalize(text: str) -> str:
    return " ".join(str(text).strip().split()).lower().rstrip(" .")


def _derive_services(prompt: str, section_title: str = "") -> List[str]:
    normalized = _normalize(prompt)
    normalized_section = _normalize(section_title)
    services: List[str] = []

    for service, keywords in SERVICE_KEYWORDS.items():
        if any(keyword in normalized for keyword in keywords) or (
            service == "DIGITAL_TRANSFORMATION" and "digital transformation" in normalized_section
        ):
            services.append(service)

    if not services:
        services = ["DIGITAL_TRANSFORMATION"] if "digital" in normalized else ["MOBILE_APPS"]

    return list(dict.fromkeys(services))


def _derive_yp_advantage(services: Sequence[str]) -> str:
    if "ECOMMERCE" in services:
        return "Position Yellow Panther around revenue-adjacent digital commerce and fan conversion"
    if "ANALYTICS" in services:
        return "Position Yellow Panther around measurable insight, reporting, and decision support"
    if "MOBILE_APPS" in services or "FAN_ENGAGEMENT" in services:
        return "Position Yellow Panther around fan experience and mobile-first engagement"
    return "Position Yellow Panther around evidence-backed digital execution"


def _derive_accept_criteria(prompt: str, bucket: str) -> str:
    stem = prompt.rstrip("?") if "?" in prompt else prompt
    if bucket == "direct_revenue_signal":
        return f"Evidence of direct Yellow Panther fit for: {stem}"
    if bucket == "high_signal":
        return f"Evidence that supports a high-priority Yellow Panther opportunity for: {stem}"
    if bucket == "context_support":
        return f"Supporting evidence that sharpens the discovery readout for: {stem}"
    return f"Fallback evidence only if nothing stronger exists for: {stem}"


def _derive_next_signals(services: Sequence[str], bucket: str) -> List[str]:
    signals = ["official site", "press releases", "job postings"]
    if "ECOMMERCE" in services:
        signals = ["official site", "ticketing vendor", "press releases", "procurement notices"]
    if "ANALYTICS" in services:
        signals = ["official site", "job postings", "press releases", "data stack clues"]
    if "FAN_ENGAGEMENT" in services or "MOBILE_APPS" in services:
        signals = ["official site", "app store", "press releases", "social channels"]
    if bucket == "context_support":
        signals.append("supporting context")
    return list(dict.fromkeys(signals))


def _derive_hypothesis_template(entity_name: str, prompt: str, bucket: str) -> str:
    if bucket == "direct_revenue_signal":
        return f"{entity_name} may have an active opportunity matching: {prompt}"
    if bucket == "high_signal":
        return f"{entity_name} may warrant a Yellow Panther pilot around: {prompt}"
    return f"{entity_name} may use this prompt as supporting context: {prompt}"


def _derive_evidence_focus(prompt: str, section_title: str) -> str:
    normalized = _normalize(prompt)
    section = _normalize(section_title)

    if section == "core information":
        return "entity_fact"
    if section == "digital transformation":
        if "vendor" in normalized or "partner" in normalized:
            return "vendor_stack"
        if "mobile" in normalized:
            return "mobile_platform"
        if "crm" in normalized:
            return "crm_platform"
        if "analytics" in normalized or "data" in normalized:
            return "analytics_stack"
        return "technology_stack"
    if section == "key decision makers":
        return "decision_maker"
    if section == "connections analysis":
        return "connection_path"
    if section == "recent news":
        return "dated_signal"
    if section == "strategic opportunities":
        return "opportunity_signal"
    if section == "outreach strategy":
        return "outreach_signal"
    if section == "risk assessment":
        return "risk_signal"
    if section == "league context":
        return "market_context"
    if section == "ai reasoner assessment":
        return "fit_signal"
    return "supporting_evidence"


def _derive_promotion_target(section_title: str, evidence_focus: str) -> str:
    section = _normalize(section_title)

    if evidence_focus == "entity_fact":
        return "profile"
    if evidence_focus in {"decision_maker", "connection_path"}:
        return "decision_owners"
    if evidence_focus in {"vendor_stack", "mobile_platform", "crm_platform", "analytics_stack", "technology_stack"}:
        return "platform_change_signals"
    if evidence_focus == "opportunity_signal":
        return "opportunity_signals"
    if evidence_focus == "outreach_signal":
        return "outreach_implications"
    if evidence_focus == "risk_signal":
        return "risk_watchouts"
    if evidence_focus == "dated_signal":
        return "timing_and_procurement"
    if section == "league context":
        return "market_context"
    if section == "ai reasoner assessment":
        return "discovery_summary"
    return "supporting_context"


def _derive_answer_kind(evidence_focus: str) -> str:
    if evidence_focus == "entity_fact":
        return "fact"
    if evidence_focus == "decision_maker":
        return "owner"
    if evidence_focus == "connection_path":
        return "path"
    if evidence_focus in {"vendor_stack", "mobile_platform", "crm_platform", "analytics_stack", "technology_stack"}:
        return "platform"
    if evidence_focus in {"opportunity_signal", "dated_signal", "risk_signal", "fit_signal", "outreach_signal"}:
        return "signal"
    if evidence_focus == "market_context":
        return "context"
    return "evidence"


def build_atomic_discovery_pack_questions(
    source_questions: Sequence[Mapping[str, Any]],
    entity_name: str,
    max_questions: int,
) -> List[Dict[str, Any]]:
    selected_questions = list(source_questions[: max(1, min(max_questions, len(source_questions)))])
    pack_questions: List[Dict[str, Any]] = []

    for index, item in enumerate(selected_questions, start=1):
        prompt = str(item.get("prompt") or item.get("question") or "").strip()
        section_title = str(item.get("section_title", "Unclassified"))
        bucket = str(item.get("final_goal_bucket") or "context_support")
        score = int(item.get("final_goal_score") or 0)
        rank = int(item.get("final_goal_rank") or index)
        services = _derive_services(prompt, section_title)
        evidence_focus = _derive_evidence_focus(prompt, section_title)
        promotion_target = _derive_promotion_target(section_title, evidence_focus)
        answer_kind = _derive_answer_kind(evidence_focus)

        pack_questions.append(
            {
                "question_id": f"frq_{index:03d}",
                "question": prompt,
                "pack_role": "discovery",
                "question_shape": "atomic",
                "evidence_focus": evidence_focus,
                "promotion_target": promotion_target,
                "answer_kind": answer_kind,
                "yp_service_fit": services,
                "budget_range": BUDGET_MAP.get(services[0], "£80K-£500K"),
                "yp_advantage": _derive_yp_advantage(services),
                "positioning_strategy": POSITIONING_MAP.get(bucket, "STRATEGIC_PARTNER"),
                "hypothesis_template": _derive_hypothesis_template(entity_name, prompt, bucket),
                "next_signals": _derive_next_signals(services, bucket),
                "hop_types": ["OFFICIAL_SITE", "PRESS_RELEASE", "CAREERS_PAGE", "PROCUREMENT_PAGE"],
                "accept_criteria": _derive_accept_criteria(prompt, bucket),
                "confidence_boost": round(min(0.30, score / 1000 + 0.10), 2),
                "final_goal_bucket": bucket,
                "final_goal_score": score,
                "final_goal_rank": rank,
                "section_title": section_title,
                "source_questions": list(item.get("source_questions", [])),
                "final_goal_rationale": str(item.get("final_goal_rationale", "")),
            }
        )

    return pack_questions

