import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from question_first_repair import build_filtered_question_source_payload, derive_repair_question_ids


def _source_payload():
    return {
        "entity_id": "fc-porto-2027",
        "entity_name": "FC Porto",
        "questions": [
            {"question_id": "q3_leadership", "depends_on": []},
            {"question_id": "q7_procurement_signal", "depends_on": []},
            {"question_id": "q8_explicit_rfp", "depends_on": ["q7_procurement_signal"]},
            {"question_id": "q11_decision_owner", "depends_on": ["q3_leadership", "q7_procurement_signal"]},
            {"question_id": "q12_connections", "depends_on": ["q11_decision_owner"]},
            {"question_id": "q13_capability_gap", "depends_on": ["q7_procurement_signal"]},
            {"question_id": "q14_yp_fit", "depends_on": ["q13_capability_gap", "q7_procurement_signal"]},
            {"question_id": "q15_outreach_strategy", "depends_on": ["q11_decision_owner", "q12_connections", "q14_yp_fit"]},
        ],
    }


def test_derive_repair_question_ids_cascades_people_chain_in_question_order():
    question_ids = derive_repair_question_ids(
        source_payload=_source_payload(),
        question_id="q11_decision_owner",
        cascade_dependents=True,
    )

    assert question_ids == ["q11_decision_owner", "q12_connections", "q15_outreach_strategy"]


def test_derive_repair_question_ids_cascades_procurement_chain_in_question_order():
    question_ids = derive_repair_question_ids(
        source_payload=_source_payload(),
        question_id="q7_procurement_signal",
        cascade_dependents=True,
    )

    assert question_ids == [
        "q7_procurement_signal",
        "q8_explicit_rfp",
        "q11_decision_owner",
        "q12_connections",
        "q13_capability_gap",
        "q14_yp_fit",
        "q15_outreach_strategy",
    ]


def test_build_filtered_question_source_payload_bounds_selected_repair_questions():
    filtered = build_filtered_question_source_payload(
        source_payload={
            "entity_id": "zimbabwe-cricket",
            "questions": [
                {"question_id": "q1_foundation"},
                {"question_id": "q11_decision_owner", "question_timeout_ms": 600000, "hop_timeout_ms": 600000, "hop_budget": 7},
            ],
        },
        question_ids=["q11_decision_owner"],
    )

    assert [question["question_id"] for question in filtered["questions"]] == ["q11_decision_owner"]
    assert filtered["questions"][0]["question_timeout_ms"] == 300000
    assert filtered["questions"][0]["hop_timeout_ms"] == 300000
    assert filtered["questions"][0]["hop_budget"] == 4
