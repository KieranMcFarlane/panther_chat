#!/usr/bin/env python3
"""Shared helpers for bounded question-first repair runs."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Dict, Iterable, List


def _slugify(value: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9]+", "-", str(value or "").strip().lower())
    return re.sub(r"-+", "-", value).strip("-") or "entity"


def load_question_source_payload(question_source_path: Path) -> Dict[str, Any]:
    payload = json.loads(Path(question_source_path).read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("Question source must be a JSON object")
    return payload


def derive_repair_question_ids(
    *,
    source_payload: Dict[str, Any],
    question_id: str,
    cascade_dependents: bool = True,
) -> List[str]:
    questions = source_payload.get("questions") if isinstance(source_payload.get("questions"), list) else []
    ordered_ids = [
        str(question.get("question_id") or "").strip()
        for question in questions
        if isinstance(question, dict) and str(question.get("question_id") or "").strip()
    ]
    if question_id not in ordered_ids:
        raise ValueError(f"Question id {question_id!r} not found in source payload")
    if not cascade_dependents:
        return [question_id]

    selected = {question_id}
    changed = True
    while changed:
        changed = False
        for question in questions:
            if not isinstance(question, dict):
                continue
            current_id = str(question.get("question_id") or "").strip()
            if not current_id or current_id in selected:
                continue
            depends_on = question.get("depends_on") if isinstance(question.get("depends_on"), list) else []
            normalized_depends_on = {str(value).strip() for value in depends_on if str(value or "").strip()}
            if normalized_depends_on.intersection(selected):
                selected.add(current_id)
                changed = True

    return [current_id for current_id in ordered_ids if current_id in selected]


def _bounded_question(question: Dict[str, Any], question_id: str, *, rerun_profile: str) -> Dict[str, Any]:
    bounded = dict(question)
    if question_id in {"q2_digital_stack", "q3_leadership", "q7_procurement_signal", "q11_decision_owner"}:
        max_question_timeout_ms = 120000 if rerun_profile == "bounded_single_question" else 300000
        max_hop_timeout_ms = 60000 if rerun_profile == "bounded_single_question" else 300000
        bounded["hop_budget"] = min(max(int(question.get("hop_budget") or 1), 1), 4)
        bounded["evidence_extension_budget"] = min(max(int(question.get("evidence_extension_budget") or 0), 0), 1)
        bounded["question_timeout_ms"] = min(max(int(question.get("question_timeout_ms") or max_question_timeout_ms), 1000), max_question_timeout_ms)
        bounded["hop_timeout_ms"] = min(max(int(question.get("hop_timeout_ms") or max_hop_timeout_ms), 1000), max_hop_timeout_ms)
    return bounded


def build_filtered_question_source_payload(
    *,
    source_payload: Dict[str, Any],
    question_ids: Iterable[str],
    rerun_profile: str = "bounded_question_repair",
) -> Dict[str, Any]:
    selected_ids = {str(question_id).strip() for question_id in question_ids if str(question_id or "").strip()}
    questions = source_payload.get("questions") if isinstance(source_payload.get("questions"), list) else []
    selected_questions = [
        _bounded_question(question, str(question.get("question_id") or "").strip(), rerun_profile=rerun_profile)
        for question in questions
        if isinstance(question, dict) and str(question.get("question_id") or "").strip() in selected_ids
    ]
    if not selected_questions:
        raise ValueError("No repair questions were selected for the filtered source payload")
    return {
        **source_payload,
        "questions": selected_questions,
        "question_count": len(selected_questions),
        "rerun_profile": rerun_profile,
    }


def write_filtered_question_source(
    *,
    source_path: Path,
    output_root: Path,
    entity_id: str,
    question_ids: Iterable[str],
    rerun_profile: str = "bounded_question_repair",
) -> Path:
    filtered_payload = build_filtered_question_source_payload(
        source_payload=load_question_source_payload(source_path),
        question_ids=question_ids,
        rerun_profile=rerun_profile,
    )
    rerun_dir = output_root / "_rerun_question_sources"
    rerun_dir.mkdir(parents=True, exist_ok=True)
    suffix = "-".join(_slugify(question_id) for question_id in question_ids)
    rerun_path = rerun_dir / f"{_slugify(entity_id)}_{suffix}.json"
    rerun_path.write_text(json.dumps(filtered_payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return rerun_path
