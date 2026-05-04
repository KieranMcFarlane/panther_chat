#!/usr/bin/env python3
"""Normalize question-first answer records into typed quality outputs."""

from __future__ import annotations

from typing import Any, Dict, Mapping


UPSTREAM_QUESTION_IDS = {
    "q1_foundation",
    "q2_digital_stack",
    "q3_leadership",
    "q4_performance",
    "q5_league_context",
    "q6_launch_signal",
    "q7_procurement_signal",
    "q8_explicit_rfp",
    "q9_news_signal",
    "q10_hiring_signal",
}

NON_SPORT_ENTITY_TYPES = {"person", "rfp", "non_current_entity", "non-current entity"}


def _to_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float, bool)):
        return str(value).strip()
    if isinstance(value, dict):
        for key in ("summary", "answer", "value", "name", "title"):
            text = _to_text(value.get(key))
            if text:
                return text
    return str(value).strip()


def _state(value: Any) -> str:
    return str(value or "").strip().lower() or "unknown"


def _question_text(record: Mapping[str, Any]) -> str:
    return _to_text(record.get("answer") or record.get("summary") or record.get("commercial_implication"))


def _checked_source(record: Mapping[str, Any], rationale: str) -> Dict[str, Any]:
    return {
        "source": _to_text(record.get("evidence_url")) or "bounded_question_retrieval",
        "rationale": rationale,
    }


def _base(record: Mapping[str, Any]) -> Dict[str, Any]:
    normalized = dict(record)
    normalized.setdefault("checked_sources", [])
    normalized.setdefault("commercial_implication", "")
    normalized.setdefault("applicability", {"status": "applicable"})
    normalized.setdefault("structured_signal", {})
    return normalized


def _entity_type(record: Mapping[str, Any]) -> str:
    return _to_text(record.get("entity_type")).lower().replace("-", "_")


def _is_no_signal(record: Mapping[str, Any]) -> bool:
    state = _state(record.get("validation_state"))
    text = _question_text(record).lower()
    return state in {"no_signal", "no signal"} or any(
        phrase in text
        for phrase in (
            "returned no relevant results",
            "returned no results",
            "no evidence",
            "no hiring leads found",
            "checked absence",
        )
    )


def _meaningful_adjacent_signal(record: Mapping[str, Any] | None) -> bool:
    if not isinstance(record, Mapping):
        return False
    if _state(record.get("validation_state")) not in {"validated", "confirmed", "provisional"}:
        return False
    try:
        if float(record.get("confidence") or 0) <= 0:
            return False
    except (TypeError, ValueError):
        return False
    text = _question_text(record)
    return bool(text and "no " not in text.lower()[:20])


def normalize_upstream_answer(
    record: Mapping[str, Any],
    *,
    adjacent_answers: Mapping[str, Mapping[str, Any]] | None = None,
) -> Dict[str, Any]:
    """Return a normalized copy of a q1-q10 answer without laundering raw status."""
    normalized = _base(record)
    question_id = _to_text(record.get("question_id") or record.get("id"))
    adjacent_answers = adjacent_answers or {}
    entity_type = _entity_type(record)

    if question_id not in UPSTREAM_QUESTION_IDS:
        return normalized

    if question_id == "q1_foundation" and entity_type in NON_SPORT_ENTITY_TYPES:
        classification = "person" if entity_type == "person" else entity_type
        normalized["validation_state"] = "not_applicable"
        normalized["confidence"] = 0
        normalized["applicability"] = {
            "status": "not_applicable",
            "reason": f"{classification} entities are not canonical organisation foundation targets.",
        }
        normalized["structured_signal"] = {
            **(normalized.get("structured_signal") if isinstance(normalized.get("structured_signal"), dict) else {}),
            "entity_classification": classification,
        }
        normalized["checked_sources"] = [_checked_source(record, normalized["applicability"]["reason"])]
        normalized["commercial_implication"] = "Entity is outside the canonical organisation dossier target shape."
        return normalized

    if question_id in {"q4_performance", "q5_league_context"} and entity_type in NON_SPORT_ENTITY_TYPES:
        normalized["validation_state"] = "not_applicable"
        normalized["confidence"] = 0
        normalized["applicability"] = {
            "status": "not_applicable",
            "reason": f"{question_id} applies to current sport organisations, not {entity_type or 'this entity type'}.",
        }
        normalized["structured_signal"] = {
            **(normalized.get("structured_signal") if isinstance(normalized.get("structured_signal"), dict) else {}),
            "status": "not_applicable",
        }
        normalized["checked_sources"] = [_checked_source(record, normalized["applicability"]["reason"])]
        normalized["commercial_implication"] = "Question not applicable to this entity type."
        return normalized

    if question_id == "q2_digital_stack":
        structured = normalized.get("structured_signal") if isinstance(normalized.get("structured_signal"), dict) else {}
        launch = adjacent_answers.get("q6_launch_signal")
        hints = []
        if _meaningful_adjacent_signal(launch):
            hints.append(
                {
                    "source_question_id": "q6_launch_signal",
                    "summary": _question_text(launch),
                    "evidence_url": _to_text(launch.get("evidence_url")),
                }
            )
        if hints:
            structured = {
                **structured,
                "digital_footprint_unknown": _state(record.get("validation_state")) in {"failed", "no_signal", "unknown"},
                "adjacent_digital_hints": hints,
            }
            normalized["structured_signal"] = structured
            normalized["commercial_implication"] = normalized.get("commercial_implication") or "Adjacent launch evidence suggests digital footprint worth verifying."

    if _is_no_signal(record):
        rationale = _question_text(record) or "Checked sources did not produce a relevant signal."
        normalized["validation_state"] = "no_signal"
        normalized["confidence"] = 0
        normalized["checked_sources"] = normalized.get("checked_sources") or [_checked_source(record, rationale)]
        normalized["structured_signal"] = {
            **(normalized.get("structured_signal") if isinstance(normalized.get("structured_signal"), dict) else {}),
            "status": "checked_absent",
            "checked_absence_rationale": rationale,
        }
        normalized["commercial_implication"] = (
            normalized.get("commercial_implication")
            or "No current buying-motion evidence found in checked sources."
        )

    return normalized


__all__ = ["UPSTREAM_QUESTION_IDS", "normalize_upstream_answer"]
