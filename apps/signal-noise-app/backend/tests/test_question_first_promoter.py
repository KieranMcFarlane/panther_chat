import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from question_first_promoter import build_question_first_promotions


def test_build_question_first_promotions_emits_promoted_summary_and_filters_weak_candidates():
    result = build_question_first_promotions(
        answers=[
            {
                "question_id": "q1",
                "question_text": "Is there evidence of a ticketing rebuild?",
                "answer": "The league is replacing its ticketing platform in 2026.",
                "confidence": 0.88,
                "validation_state": "validated",
                "signal_type": "PROCUREMENT_SIGNAL",
            },
            {
                "question_id": "q2",
                "question_text": "Who is the current chairman?",
                "answer": "Unknown",
                "confidence": 0.55,
                "validation_state": "provisional",
                "signal_type": "FOUNDATION",
            },
        ],
        evidence_items=[
            {
                "evidence_id": "ev:q1",
                "question_id": "q1",
                "entity_id": "major-league-cricket",
                "signal_type": "PROCUREMENT_SIGNAL",
                "evidence_focus": "opportunity_signal",
                "promotion_target": "opportunity_signals",
                "answer_kind": "signal",
                "answer": "The league is replacing its ticketing platform in 2026.",
                "confidence": 0.88,
                "validation_state": "validated",
                "evidence_url": "https://example.com/ticketing",
            },
            {
                "evidence_id": "ev:q2",
                "question_id": "q2",
                "entity_id": "major-league-cricket",
                "signal_type": "FOUNDATION",
                "evidence_focus": "entity_fact",
                "promotion_target": "profile",
                "answer_kind": "fact",
                "answer": "Unknown",
                "confidence": 0.55,
                "validation_state": "provisional",
                "evidence_url": "",
            },
        ],
        promotion_candidates=[
            {
                "candidate_id": "q1:opportunity_signals",
                "question_id": "q1",
                "promotion_target": "opportunity_signals",
                "signal_type": "PROCUREMENT_SIGNAL",
                "answer": "The league is replacing its ticketing platform in 2026.",
                "confidence": 0.88,
                "promotion_candidate": True,
            },
            {
                "candidate_id": "q2:profile",
                "question_id": "q2",
                "promotion_target": "profile",
                "signal_type": "FOUNDATION",
                "answer": "Unknown",
                "confidence": 0.55,
                "promotion_candidate": True,
            },
        ],
    )

    assert result["dossier_promotions"][0]["question_id"] == "q1"
    assert result["dossier_promotions"][0]["promotion_target"] == "opportunity_signals"
    assert result["dossier_promotions"][0]["evidence_url"] == "https://example.com/ticketing"
    assert result["discovery_summary"]["promoted_count"] == 1
    assert result["discovery_summary"]["supporting_evidence_count"] == 1
    assert result["discovery_summary"]["promotion_targets"] == ["opportunity_signals"]
    assert result["discovery_summary"]["opportunity_signals"][0]["candidate_id"] == "q1:opportunity_signals"


def test_build_question_first_promotions_derives_evidence_from_validated_answers():
    result = build_question_first_promotions(
        answers=[
            {
                "question_id": "q_foundation",
                "question_text": "When was Arsenal Football Club founded?",
                "question_type": "foundation",
                "answer": "1886",
                "confidence": 0.95,
                "validation_state": "validated",
                "signal_type": "FOUNDATION",
                "evidence_url": "https://www.arsenal.com/history",
            },
            {
                "question_id": "q_procurement",
                "question_text": "Is there evidence of a ticketing rebuild?",
                "question_type": "procurement",
                "answer": "The league is replacing its ticketing platform in 2026.",
                "confidence": 0.86,
                "validation_state": "validated",
                "signal_type": "PROCUREMENT_SIGNAL",
                "evidence_url": "https://example.com/ticketing",
            },
        ],
        evidence_items=[],
        promotion_candidates=[],
    )

    assert result["discovery_summary"]["promoted_count"] == 2
    assert result["discovery_summary"]["supporting_evidence_count"] == 2
    assert result["discovery_summary"]["promotion_targets"] == ["opportunity_signals", "profile"]
    assert result["discovery_summary"]["profile"][0]["question_id"] == "q_foundation"
    assert result["discovery_summary"]["opportunity_signals"][0]["question_id"] == "q_procurement"


def test_build_question_first_promotions_supports_launch_and_decision_owner_questions():
    result = build_question_first_promotions(
        answers=[
            {
                "question_id": "q_launch",
                "question_text": "Is there evidence Arsenal Football Club has launched or is replacing a public app?",
                "question_type": "launch",
                "answer": "Arsenal launched a new app experience.",
                "confidence": 0.86,
                "validation_state": "validated",
                "signal_type": "LAUNCH_SIGNAL",
                "evidence_url": "https://example.com/arsenal-launch",
            },
            {
                "question_id": "q_owner",
                "question_text": "Who is the most suitable person for commercial partnerships or business development at Arsenal Football Club?",
                "question_type": "decision_owner",
                "answer": "Jane Doe",
                "confidence": 0.88,
                "validation_state": "validated",
                "signal_type": "DECISION_OWNER",
                "evidence_url": "https://example.com/jane-doe",
            },
        ],
        evidence_items=[],
        promotion_candidates=[],
    )

    assert result["discovery_summary"]["promotion_targets"] == ["decision_owners", "opportunity_signals"]
    assert result["discovery_summary"]["opportunity_signals"][0]["question_id"] == "q_launch"
    assert result["discovery_summary"]["decision_owners"][0]["question_id"] == "q_owner"
