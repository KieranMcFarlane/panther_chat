from __future__ import annotations

from pathlib import Path
import sys


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from question_answer_normalizer import normalize_upstream_answer


def test_q1_foundation_classifies_person_entity_without_generic_failure():
    normalized = normalize_upstream_answer(
        {
            "question_id": "q1_foundation",
            "entity_name": "Elliott Hillman",
            "entity_type": "PERSON",
            "validation_state": "failed",
            "confidence": 0,
            "answer": "Question execution failed.",
        }
    )

    assert normalized["validation_state"] == "not_applicable"
    assert normalized["applicability"]["status"] == "not_applicable"
    assert normalized["structured_signal"]["entity_classification"] == "person"
    assert normalized["confidence"] == 0


def test_q2_digital_stack_reuses_q6_launch_evidence_as_synthesis_only():
    normalized = normalize_upstream_answer(
        {
            "question_id": "q2_digital_stack",
            "validation_state": "failed",
            "confidence": 0,
            "answer": "No deterministic answer was produced.",
        },
        adjacent_answers={
            "q6_launch_signal": {
                "question_id": "q6_launch_signal",
                "validation_state": "validated",
                "confidence": 0.84,
                "answer": "The club launched a new mobile ticketing platform before the season.",
                "evidence_url": "https://example.com/ticketing-platform",
            }
        },
    )

    assert normalized["validation_state"] == "failed"
    assert normalized["confidence"] == 0
    assert normalized["structured_signal"]["digital_footprint_unknown"] is True
    assert normalized["structured_signal"]["adjacent_digital_hints"][0]["source_question_id"] == "q6_launch_signal"
    assert "mobile ticketing platform" in normalized["structured_signal"]["adjacent_digital_hints"][0]["summary"]


def test_q4_and_q5_return_not_applicable_for_person_entities():
    for question_id in ("q4_performance", "q5_league_context"):
        normalized = normalize_upstream_answer(
            {
                "question_id": question_id,
                "entity_name": "A Person",
                "entity_type": "PERSON",
                "validation_state": "failed",
                "confidence": 0,
                "answer": "No sporting context was found.",
            }
        )

        assert normalized["validation_state"] == "not_applicable"
        assert normalized["applicability"]["status"] == "not_applicable"
        assert normalized["checked_sources"]


def test_no_signal_upstream_answers_keep_checked_source_rationale():
    normalized = normalize_upstream_answer(
        {
            "question_id": "q7_procurement_signal",
            "validation_state": "no_signal",
            "confidence": 0,
            "answer": "Searches for tender and platform migration evidence returned no relevant results.",
        }
    )

    assert normalized["validation_state"] == "no_signal"
    assert normalized["structured_signal"]["status"] == "checked_absent"
    assert normalized["checked_sources"][0]["rationale"]
    assert normalized["commercial_implication"] == "No current buying-motion evidence found in checked sources."
