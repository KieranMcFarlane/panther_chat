#!/usr/bin/env python3
"""Promote question-first evidence into dossier-facing summaries."""

from __future__ import annotations

from typing import Any, Dict, List


def _safe_float(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def build_question_first_promotions(
    *,
    answers: List[Dict[str, Any]] | None = None,
    evidence_items: List[Dict[str, Any]] | None = None,
    promotion_candidates: List[Dict[str, Any]] | None = None,
    min_confidence: float = 0.7,
) -> Dict[str, Any]:
    answers = [item for item in (answers or []) if isinstance(item, dict)]
    evidence_items = [item for item in (evidence_items or []) if isinstance(item, dict)]
    promotion_candidates = [item for item in (promotion_candidates or []) if isinstance(item, dict)]

    answer_by_question = {
        str(answer.get("question_id") or "").strip(): answer
        for answer in answers
        if str(answer.get("question_id") or "").strip()
    }
    evidence_by_question = {
        str(item.get("question_id") or "").strip(): item
        for item in evidence_items
        if str(item.get("question_id") or "").strip()
    }

    promoted: List[Dict[str, Any]] = []
    for candidate in promotion_candidates:
        if not candidate.get("promotion_candidate"):
            continue
        confidence = _safe_float(candidate.get("confidence"))
        if confidence < min_confidence:
            continue

        question_id = str(candidate.get("question_id") or "").strip()
        evidence = evidence_by_question.get(question_id, {})
        validation_state = str(evidence.get("validation_state") or "").strip().lower()
        evidence_url = str(evidence.get("evidence_url") or "").strip()
        if validation_state != "validated" or not evidence_url:
            continue

        answer = answer_by_question.get(question_id, {})
        promoted_item = {
            "candidate_id": str(candidate.get("candidate_id") or f"{question_id}:{candidate.get('promotion_target') or 'promotion'}"),
            "question_id": question_id,
            "question_text": str(answer.get("question_text") or answer.get("question") or ""),
            "promotion_target": str(candidate.get("promotion_target") or evidence.get("promotion_target") or "discovery_summary"),
            "signal_type": str(candidate.get("signal_type") or evidence.get("signal_type") or answer.get("signal_type") or ""),
            "answer": str(candidate.get("answer") or evidence.get("answer") or answer.get("answer") or "").strip(),
            "confidence": confidence,
            "evidence_url": evidence_url,
            "evidence_id": str(evidence.get("evidence_id") or ""),
            "evidence_focus": str(evidence.get("evidence_focus") or ""),
            "answer_kind": str(evidence.get("answer_kind") or ""),
            "validation_state": validation_state,
        }
        promoted.append(promoted_item)

    promoted.sort(key=lambda item: (item["confidence"], item["candidate_id"]), reverse=True)

    targets = sorted({item["promotion_target"] for item in promoted})
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for target in targets:
        grouped[target] = [item for item in promoted if item["promotion_target"] == target]

    discovery_summary: Dict[str, Any] = {
        "promoted_count": len(promoted),
        "supporting_evidence_count": len({item["evidence_id"] or item["candidate_id"] for item in promoted}),
        "promotion_targets": targets,
    }
    discovery_summary.update(grouped)

    return {
        "dossier_promotions": promoted,
        "discovery_summary": discovery_summary,
        "promotion_candidates": promotion_candidates,
    }
