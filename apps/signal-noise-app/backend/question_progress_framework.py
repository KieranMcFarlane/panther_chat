#!/usr/bin/env python3
"""Shared question-centric live progress metadata."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional


_FRAMEWORK_PATH = Path(__file__).with_name("question_progress_framework.json")

DEFAULT_EXECUTION_STATE = "searching sources"

SUBSTEP_EXECUTION_STATE_LABELS: Dict[str, str] = {
    "dossier_request_preparing": "preparing question",
    "cache_lookup": "preparing question",
    "collect_entity_data": "preparing question",
    "connect_falkordb": "preparing question",
    "fetch_falkordb_metadata": "preparing question",
    "connect_brightdata": "searching sources",
    "brightdata_search_official": "searching sources",
    "brightdata_scrape_official": "reviewing evidence",
    "extract_entity_properties": "reviewing evidence",
    "generate_dossier_content": "synthesising answer",
    "persist_dossier": "finalising section",
    "finalize_response": "finalising section",
    "question_first_running": "searching sources",
    "question_first_completed": "finalising section",
    "discovery_running": "searching sources",
    "discovery_candidate_evaluation": "reviewing evidence",
    "ralph_validation_running": "validating answer",
    "temporal_persistence_running": "finalising section",
    "dashboard_scoring_running": "finalising section",
}


def _to_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


@lru_cache(maxsize=1)
def load_question_progress_framework() -> Dict[str, Any]:
    with _FRAMEWORK_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


@lru_cache(maxsize=1)
def _build_question_lookup() -> Dict[str, Dict[str, Any]]:
    framework = load_question_progress_framework()
    sections = framework.get("sections") or []
    questions = framework.get("questions") or {}
    section_order = [str(section.get("id") or "").strip() for section in sections if str(section.get("id") or "").strip()]
    section_labels = {
        str(section.get("id") or "").strip(): str(section.get("label") or "").strip()
        for section in sections
        if str(section.get("id") or "").strip()
    }
    section_question_ids: Dict[str, List[str]] = {section_id: [] for section_id in section_order}
    for question_id, config in questions.items():
        section_id = _to_text((config or {}).get("section_id"))
        if section_id and section_id in section_question_ids:
            section_question_ids[section_id].append(str(question_id))

    question_lookup: Dict[str, Dict[str, Any]] = {}
    for question_id, config in questions.items():
        section_id = _to_text((config or {}).get("section_id"))
        if not section_id:
            continue
        section_ids = section_question_ids.get(section_id) or []
        question_lookup[str(question_id)] = {
            "current_section_id": section_id,
            "current_section_label": section_labels.get(section_id) or section_id.replace("_", " ").title(),
            "current_section_index": section_order.index(section_id) + 1 if section_id in section_order else None,
            "current_section_total": len(section_order) or None,
            "current_question_index": section_ids.index(str(question_id)) + 1 if str(question_id) in section_ids else None,
            "current_question_total": len(section_ids) or None,
            "current_strategy_label": _to_text((config or {}).get("strategy_label")) or None,
            "current_source_order": list((config or {}).get("source_order") or []) or None,
        }
    return question_lookup


def get_question_progress_metadata(question_id: Optional[str]) -> Dict[str, Any]:
    if not question_id:
        return {}
    return dict(_build_question_lookup().get(str(question_id).strip(), {}))


def derive_execution_state(
    *,
    explicit_state: Optional[str] = None,
    current_substep: Optional[str] = None,
) -> Optional[str]:
    if _to_text(explicit_state):
        return _to_text(explicit_state)
    if _to_text(current_substep):
        return SUBSTEP_EXECUTION_STATE_LABELS.get(_to_text(current_substep))
    return None


def build_question_checkpoint_fields(
    *,
    question_id: Optional[str] = None,
    execution_state: Optional[str] = None,
    current_substep: Optional[str] = None,
    source_order: Optional[Iterable[str]] = None,
) -> Dict[str, Any]:
    metadata = get_question_progress_metadata(question_id)
    derived_execution_state = derive_execution_state(explicit_state=execution_state, current_substep=current_substep)
    if derived_execution_state:
        metadata["current_execution_state"] = derived_execution_state
    if source_order:
        normalized_source_order = [str(item).strip() for item in source_order if str(item).strip()]
        if normalized_source_order:
            metadata["current_source_order"] = normalized_source_order
    return metadata


def build_question_preparation_fields(questions: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
    first_question = next((question for question in questions if isinstance(question, dict)), None)
    if not first_question:
        return {}
    question_id = _to_text(first_question.get("question_id"))
    metadata = build_question_checkpoint_fields(
        question_id=question_id or None,
        execution_state="preparing question",
        current_substep="question_first_running",
        source_order=first_question.get("current_source_order") or first_question.get("source_priority") or None,
    )
    return metadata


def enrich_question_specs(questions: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    enriched_questions: List[Dict[str, Any]] = []
    for question in questions:
        if not isinstance(question, dict):
            continue
        question_copy = dict(question)
        checkpoint_fields = build_question_checkpoint_fields(
            question_id=_to_text(question_copy.get("question_id")) or None,
            execution_state=question_copy.get("current_execution_state"),
            current_substep=question_copy.get("current_substep"),
            source_order=question_copy.get("current_source_order") or question_copy.get("source_priority") or None,
        )
        for key, value in checkpoint_fields.items():
            if value is None:
                continue
            question_copy.setdefault(key, value)
        if not question_copy.get("current_execution_state") and question_copy.get("question_id"):
            question_copy["current_execution_state"] = DEFAULT_EXECUTION_STATE
        enriched_questions.append(question_copy)
    return enriched_questions
