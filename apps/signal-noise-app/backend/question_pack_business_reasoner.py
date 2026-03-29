#!/usr/bin/env python3
"""Generate a business-goal-ranked duplicate of the reasoned dossier pack.

This pack keeps the same question coverage as the reasoned dossier pack, but
reorders the questions so that the Ralph loop sees the highest-value Yellow
Panther questions first:

- direct procurement/RFP intent
- digital transformation and mobile/fan engagement fit
- budget, timeline, and vendor replacement signals
- decision-maker and outreach utility
- lower-value contextual/noisy questions last
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Sequence, Tuple, Union

try:
    from backend.question_pack_reasoner import build_question_reasoned_pack
except ImportError:  # pragma: no cover - fallback for direct module execution
    from question_pack_reasoner import build_question_reasoned_pack  # type: ignore


BUSINESS_PROFILE_GOALS = {
    "services": [
        "mobile apps",
        "digital transformation",
        "fan engagement",
        "analytics",
        "e-commerce",
        "ui/ux design",
    ],
    "opportunity_signals": [
        "procurement",
        "rfp",
        "tender",
        "vendor replacement",
        "vendor change",
        "budget",
        "timeline",
        "decision maker",
        "leadership",
        "contact",
        "outreach",
        "pilot",
    ],
    "noise_signals": [
        "current performance",
        "recent form",
        "compare to top competitors",
        "top competitors",
        "league position",
        "league context",
        "generic context",
    ],
    "sweet_spot_budget": "£80K-£500K",
}

SERVICE_WEIGHT = {
    "MOBILE_APPS": 18,
    "DIGITAL_TRANSFORMATION": 22,
    "FAN_ENGAGEMENT": 18,
    "ANALYTICS": 14,
    "ECOMMERCE": 16,
    "UI_UX_DESIGN": 10,
}

POSITIONING_WEIGHT = {
    "SOLUTION_PROVIDER": 8,
    "STRATEGIC_PARTNER": 7,
    "CAPABILITY_PARTNER": 6,
    "INNOVATION_PARTNER": 6,
    "TRUSTED_ADVISOR": 4,
}

SECTION_WEIGHT = {
    "core_information": 18,
    "digital_transformation": 24,
    "leadership": 16,
    "outreach_strategy": 16,
    "connections": 14,
    "strategic_opportunities": 18,
    "ai_reasoner_assessment": 14,
    "risk_assessment": 8,
    "recent_news": 8,
    "league_context": 4,
    "current_performance": 2,
    "unclassified": 12,
}

KEYWORD_WEIGHT = [
    ("procurement", 18),
    ("rfp", 18),
    ("tender", 18),
    ("budget", 12),
    ("timeline", 10),
    ("vendor replacement", 14),
    ("vendor change", 14),
    ("vendor", 8),
    ("digital transformation", 20),
    ("mobile app", 18),
    ("mobile", 12),
    ("fan engagement", 18),
    ("ticketing", 16),
    ("e-commerce", 16),
    ("commerce", 12),
    ("analytics", 14),
    ("data platform", 14),
    ("decision maker", 10),
    ("leadership", 10),
    ("contact", 8),
    ("outreach", 8),
    ("opportunity", 8),
    ("pilot", 8),
    ("website", 8),
    ("crm", 10),
    ("integration", 8),
    ("stadium", 8),
    ("venue", 8),
]

NEGATIVE_KEYWORD_WEIGHT = [
    ("current performance", -12),
    ("recent form", -10),
    ("compare to top competitors", -12),
    ("top competitors", -12),
    ("league position", -12),
    ("league context", -8),
    ("generic context", -8),
]

BUDGET_KEYWORDS = {
    "ideal": ["£80K-£500K", "£100K-£400K", "£150K-£300K", "£150K-£400K", "£80K-£150K"],
    "acceptable": ["£50K-£80K", "£500K-£1M", "£300K-£500K"],
}


def _load_reasoned_pack(source: Union[Path, str, Mapping[str, Any]]) -> Dict[str, Any]:
    if isinstance(source, Mapping):
        return dict(source)
    return build_question_reasoned_pack(source)


def _normalize(text: str) -> str:
    return " ".join(str(text).strip().split()).lower().rstrip(" .")


def _extract_section_id(item: Mapping[str, Any]) -> str:
    section_id = item.get("section_id")
    if section_id:
        return str(section_id)

    for source in item.get("sources", []):
        metadata = source.get("metadata") or {}
        if metadata.get("section_id"):
            return str(metadata["section_id"])

    section_title = str(item.get("section_title", "")).strip().lower().replace(" ", "_")
    return section_title or "unclassified"


def _extract_source_metadata(item: Mapping[str, Any]) -> List[Mapping[str, Any]]:
    return [source.get("metadata") or {} for source in item.get("sources", [])]


def _score_service_fit(metadata_items: Sequence[Mapping[str, Any]]) -> Tuple[int, List[str]]:
    score = 0
    signals: List[str] = []
    for metadata in metadata_items:
        for service in metadata.get("yp_service_fit", []):
            service_key = str(service).upper()
            service_weight = SERVICE_WEIGHT.get(service_key, 0)
            if service_weight:
                score += service_weight
                signals.append(service_key)
    return score, sorted(dict.fromkeys(signals))


def _score_budget_fit(metadata_items: Sequence[Mapping[str, Any]]) -> Tuple[int, List[str]]:
    scores = 0
    matched: List[str] = []
    for metadata in metadata_items:
        budget = str(metadata.get("budget_range", ""))
        if not budget:
            continue
        if any(candidate in budget for candidate in BUDGET_KEYWORDS["ideal"]):
            scores += 14
            matched.append(budget)
        elif any(candidate in budget for candidate in BUDGET_KEYWORDS["acceptable"]):
            scores += 8
            matched.append(budget)
    return scores, sorted(dict.fromkeys(matched))


def _score_positioning(metadata_items: Sequence[Mapping[str, Any]]) -> Tuple[int, List[str]]:
    score = 0
    matched: List[str] = []
    for metadata in metadata_items:
        positioning = str(metadata.get("positioning_strategy", "")).upper()
        if positioning in POSITIONING_WEIGHT:
            score += POSITIONING_WEIGHT[positioning]
            matched.append(positioning)
    return score, sorted(dict.fromkeys(matched))


def _score_keyword_signal(question_text: str) -> Tuple[int, List[str], List[str]]:
    normalized = _normalize(question_text)
    score = 0
    positives: List[str] = []
    negatives: List[str] = []

    for needle, weight in KEYWORD_WEIGHT:
        if needle in normalized:
            score += weight
            positives.append(needle)

    for needle, weight in NEGATIVE_KEYWORD_WEIGHT:
        if needle in normalized:
            score += weight
            negatives.append(needle)

    return score, positives, negatives


def _score_section(section_id: str) -> int:
    return SECTION_WEIGHT.get(section_id, SECTION_WEIGHT["unclassified"])


def _score_source_kind(primary_source_kind: str) -> int:
    if primary_source_kind == "entity_type_question":
        return 16
    if primary_source_kind == "tier_section_question":
        return 12
    if primary_source_kind == "artifact_question":
        return 4
    return 6


def _score_question(item: Mapping[str, Any], rank_index: int) -> Dict[str, Any]:
    section_id = _extract_section_id(item)
    metadata_items = _extract_source_metadata(item)
    primary_source_kind = str(item.get("primary_source_kind", "artifact_question"))
    question_text = str(item.get("question", ""))

    service_score, service_signals = _score_service_fit(metadata_items)
    budget_score, budget_signals = _score_budget_fit(metadata_items)
    positioning_score, positioning_signals = _score_positioning(metadata_items)
    keyword_score, positive_keywords, negative_keywords = _score_keyword_signal(question_text)

    source_bonus = _score_source_kind(primary_source_kind)
    section_bonus = _score_section(section_id)
    confidence_boost = 0.0
    for metadata in metadata_items:
        confidence_boost = max(confidence_boost, float(metadata.get("confidence_boost", 0.0) or 0.0))

    confidence_score = round(confidence_boost * 100)
    score = (
        section_bonus
        + service_score
        + budget_score
        + positioning_score
        + keyword_score
        + source_bonus
        + confidence_score
    )

    # Direct Yellow Panther fit questions should outrank generic context.
    bucket = "weak_signal"
    if score >= 80:
        bucket = "direct_revenue_signal"
    elif score >= 45:
        bucket = "high_signal"
    elif score >= 30:
        bucket = "context_support"

    rationale_parts: List[str] = []
    if service_signals:
        rationale_parts.append(f"service fit: {', '.join(service_signals)}")
    if budget_signals:
        rationale_parts.append(f"budget fit: {', '.join(budget_signals)}")
    if positioning_signals:
        rationale_parts.append(f"positioning: {', '.join(positioning_signals)}")
    if positive_keywords:
        rationale_parts.append(f"keywords: {', '.join(positive_keywords)}")
    if negative_keywords:
        rationale_parts.append(f"noise penalty: {', '.join(negative_keywords)}")
    if not rationale_parts:
        rationale_parts.append("fallback business profile ranking")

    rationale = "; ".join(rationale_parts)

    return {
        "question": question_text,
        "normalized_question": item.get("normalized_question") or _normalize(question_text),
        "optimized_question": item.get("optimized_question", question_text),
        "optimization_notes": item.get("optimization_notes", ""),
        "ralph_focus": item.get("ralph_focus", ""),
        "primary_source_kind": primary_source_kind,
        "source_kinds": item.get("source_kinds", []),
        "source_labels": item.get("source_labels", []),
        "section_id": section_id,
        "section_title": item.get("section_title", "Unclassified"),
        "preferred_sources": item.get("preferred_sources", []),
        "source_count": item.get("source_count", 0),
        "sources": item.get("sources", []),
        "recommendation": item.get("recommendation", "keep"),
        "business_goal_score": min(100, score),
        "business_goal_bucket": bucket,
        "business_goal_rank": rank_index,
        "business_goal_signals": {
            "services": service_signals,
            "budget_ranges": budget_signals,
            "positioning": positioning_signals,
            "keywords": positive_keywords,
            "noise": negative_keywords,
        },
        "business_goal_rationale": rationale,
    }


def build_business_goal_reasoned_pack(source: Union[Path, str, Mapping[str, Any]]) -> Dict[str, Any]:
    reasoned_pack = _load_reasoned_pack(source)
    original_questions = list(reasoned_pack.get("reasoned_dossier_pack", {}).get("questions", []))
    scored_questions = [
        _score_question(question, rank_index=index + 1)
        for index, question in enumerate(original_questions)
    ]

    scored_questions.sort(
        key=lambda item: (
            -int(item["business_goal_score"]),
            item["business_goal_bucket"] != "direct_revenue_signal",
            item["business_goal_bucket"] != "high_signal",
            item["business_goal_rank"],
        )
    )

    for index, item in enumerate(scored_questions, start=1):
        item["business_goal_rank"] = index

    sections = []
    for section in reasoned_pack.get("reasoned_sections_to_keep", []):
        section_id = str(section.get("section_id", "")).strip()
        section_title = str(section.get("section_title", "")).strip()
        section_name = section_title or section_id.replace("_", " ").title()
        section_weight = _score_section(section_id or section_name.lower().replace(" ", "_"))
        hint = section.get("optimization_hint", "")
        if section_weight >= 16:
            hint = (hint + " " if hint else "") + "Prioritize for direct revenue and procurement intent."
        elif section_weight >= 8:
            hint = (hint + " " if hint else "") + "Keep as supporting context for the Ralph loop."
        else:
            hint = (hint + " " if hint else "") + "Defer until higher-signal sections are complete."
        sections.append(
            {
                **section,
                "business_goal_weight": section_weight,
                "business_goal_hint": hint.strip(),
            }
        )

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "business_goal_question_count": len(scored_questions),
            "section_count": len(sections),
            "source_question_count": len(original_questions),
            "direct_revenue_signal_count": sum(1 for item in scored_questions if item["business_goal_bucket"] == "direct_revenue_signal"),
            "high_signal_count": sum(1 for item in scored_questions if item["business_goal_bucket"] == "high_signal"),
            "context_support_count": sum(1 for item in scored_questions if item["business_goal_bucket"] == "context_support"),
            "weak_signal_count": sum(1 for item in scored_questions if item["business_goal_bucket"] == "weak_signal"),
        },
        "business_goal_profile": BUSINESS_PROFILE_GOALS,
        "business_goal_reasoned_pack": {
            "description": "Business-goal-ranked duplicate of the reasoned dossier pack for Ralph-loop execution",
            "questions": scored_questions,
        },
        "business_goal_sections_to_keep": sections,
    }


def write_business_goal_reasoned_pack(output_path: Path, pack: Dict[str, Any]) -> Path:
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(pack, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return output_path


def build_and_write_default_business_goal_reasoned_pack(
    review_pack_source: Union[Path, str, Mapping[str, Any]]
) -> Path:
    pack = build_business_goal_reasoned_pack(review_pack_source)
    if isinstance(review_pack_source, Mapping):
        output_path = Path("dossier_question_business_reasoned_pack.json")
    else:
        output_path = Path(review_pack_source).with_name("dossier_question_business_reasoned_pack.json")
    return write_business_goal_reasoned_pack(output_path, pack)


if __name__ == "__main__":  # pragma: no cover - helper
    backend_dir = Path(__file__).resolve().parent
    source = backend_dir / "data" / "dossier_question_review_pack.json"
    print(build_and_write_default_business_goal_reasoned_pack(source))
