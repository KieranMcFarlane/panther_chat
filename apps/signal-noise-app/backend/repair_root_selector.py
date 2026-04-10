#!/usr/bin/env python3
"""Select the next retryable root question for bounded self-healing repairs."""

from __future__ import annotations

from typing import Any, Dict, Iterable, Optional

RETRYABLE_STATES = {"blocked", "no_signal", "failed"}
PROCUREMENT_CHAIN = (
    "q7_procurement_signal",
    "q8_explicit_rfp",
    "q11_decision_owner",
    "q12_connections",
    "q13_capability_gap",
    "q14_yp_fit",
    "q15_outreach_strategy",
)
PEOPLE_CHAIN = (
    "q11_decision_owner",
    "q12_connections",
    "q15_outreach_strategy",
)


def _to_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _get_question_state(question: Dict[str, Any]) -> str:
    return _to_text(
        question.get("status")
        or question.get("question_status")
        or question.get("terminal_state")
        or ((question.get("question_first_answer") or {}).get("terminal_state") if isinstance(question.get("question_first_answer"), dict) else None)
        or ((question.get("answer") or {}).get("terminal_state") if isinstance(question.get("answer"), dict) else None)
        or question.get("validation_state")
        or ((question.get("question_first_answer") or {}).get("validation_state") if isinstance(question.get("question_first_answer"), dict) else None)
    ).lower()


def _get_questions(payload: Dict[str, Any]) -> list[Dict[str, Any]]:
    direct_questions = payload.get("questions")
    if isinstance(direct_questions, list):
        return [question for question in direct_questions if isinstance(question, dict)]

    direct_answers = payload.get("answers")
    if isinstance(direct_answers, list):
        return [question for question in direct_answers if isinstance(question, dict)]

    question_first = payload.get("question_first")
    if isinstance(question_first, dict):
        question_first_answers = question_first.get("answers")
        if isinstance(question_first_answers, list):
            return [question for question in question_first_answers if isinstance(question, dict)]

    return []


def _is_retryable_state(state: str) -> bool:
    return state in RETRYABLE_STATES


def _select_chain_root(
    *,
    chain_root: str,
    chain_question_ids: tuple[str, ...],
    dossier_question_map: Dict[str, Dict[str, Any]],
    exhausted: set[str],
    allow_when: bool = True,
) -> Optional[str]:
    if not allow_when or chain_root in exhausted:
        return None
    root_question = dossier_question_map.get(chain_root)
    root_state = _get_question_state(root_question or {})
    if not _is_retryable_state(root_state):
        return None
    has_retryable_chain_step = any(
        _is_retryable_state(_get_question_state(dossier_question_map.get(question_id) or {}))
        for question_id in chain_question_ids
    )
    return chain_root if has_retryable_chain_step else None


def select_repair_root_question_id(
    *,
    source_payload: Dict[str, Any],
    canonical_dossier: Dict[str, Any],
    exhausted_question_ids: Iterable[str],
) -> Optional[str]:
    questions = _get_questions(source_payload)
    dossier_questions = _get_questions(canonical_dossier)
    exhausted = {_to_text(question_id) for question_id in exhausted_question_ids if _to_text(question_id)}
    source_question_map = {
        _to_text(question.get("question_id")): question
        for question in questions
        if isinstance(question, dict) and _to_text(question.get("question_id"))
    }
    dossier_question_map = {
        _to_text(question.get("question_id")): question
        for question in dossier_questions
        if isinstance(question, dict) and _to_text(question.get("question_id"))
    }
    procurement_state = _get_question_state(dossier_question_map.get("q7_procurement_signal") or {})

    procurement_root = _select_chain_root(
        chain_root="q7_procurement_signal",
        chain_question_ids=PROCUREMENT_CHAIN,
        dossier_question_map=dossier_question_map,
        exhausted=exhausted,
    )
    if procurement_root:
        return procurement_root

    people_root = _select_chain_root(
        chain_root="q11_decision_owner",
        chain_question_ids=PEOPLE_CHAIN,
        dossier_question_map=dossier_question_map,
        exhausted=exhausted,
        allow_when=not _is_retryable_state(procurement_state),
    )
    if people_root:
        return people_root

    for question in questions:
        if not isinstance(question, dict):
            continue
        question_id = _to_text(question.get("question_id"))
        if not question_id or question_id in exhausted:
            continue
        dossier_question = dossier_question_map.get(question_id)
        if not isinstance(dossier_question, dict):
            continue
        question_state = _get_question_state(dossier_question)
        if not _is_retryable_state(question_state):
            continue
        depends_on = question.get("depends_on") if isinstance(question.get("depends_on"), list) else []
        normalized_depends_on = [_to_text(dep) for dep in depends_on if _to_text(dep)]
        upstream_is_problematic = False
        for dependency_id in normalized_depends_on:
            if dependency_id in exhausted:
                upstream_is_problematic = True
                break
            dependency_question = dossier_question_map.get(dependency_id)
            if isinstance(dependency_question, dict) and _is_retryable_state(_get_question_state(dependency_question)):
                upstream_is_problematic = True
                break
            if dependency_id not in source_question_map:
                upstream_is_problematic = True
                break
        if not upstream_is_problematic:
            return question_id
    return None
