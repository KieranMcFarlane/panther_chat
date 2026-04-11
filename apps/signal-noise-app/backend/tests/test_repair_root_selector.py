import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from repair_root_selector import select_repair_root_question_id


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


def _question(question_id, terminal_state):
    return {
        "question_id": question_id,
        "terminal_state": terminal_state,
    }


def test_select_repair_root_question_id_prefers_people_chain_root():
    question_id = select_repair_root_question_id(
        source_payload=_source_payload(),
        canonical_dossier={
            "questions": [
                _question("q7_procurement_signal", "answered"),
                _question("q11_decision_owner", "no_signal"),
                _question("q12_connections", "blocked"),
                _question("q15_outreach_strategy", "no_signal"),
            ]
        },
        exhausted_question_ids=set(),
    )

    assert question_id == "q11_decision_owner"


def test_select_repair_root_question_id_prefers_procurement_chain_root():
    question_id = select_repair_root_question_id(
        source_payload=_source_payload(),
        canonical_dossier={
            "questions": [
                _question("q7_procurement_signal", "no_signal"),
                _question("q8_explicit_rfp", "no_signal"),
                _question("q11_decision_owner", "blocked"),
                _question("q13_capability_gap", "blocked"),
                _question("q14_yp_fit", "blocked"),
                _question("q15_outreach_strategy", "no_signal"),
            ]
        },
        exhausted_question_ids=set(),
    )

    assert question_id == "q7_procurement_signal"


def test_select_repair_root_question_id_skips_exhausted_roots():
    question_id = select_repair_root_question_id(
        source_payload=_source_payload(),
        canonical_dossier={
            "questions": [
                _question("q7_procurement_signal", "no_signal"),
                _question("q8_explicit_rfp", "no_signal"),
                _question("q11_decision_owner", "blocked"),
            ]
        },
        exhausted_question_ids={"q7_procurement_signal", "q11_decision_owner"},
    )

    assert question_id is None


def test_select_repair_root_question_id_reads_question_first_answers_shape():
    question_id = select_repair_root_question_id(
        source_payload=_source_payload(),
        canonical_dossier={
            "question_first": {
                "answers": [
                    {"question_id": "q7_procurement_signal", "status": "answered"},
                    {"question_id": "q11_decision_owner", "status": "no_signal"},
                    {"question_id": "q12_connections", "status": "blocked"},
                    {"question_id": "q15_outreach_strategy", "status": "no_signal"},
                ]
            }
        },
        exhausted_question_ids=set(),
    )

    assert question_id == "q11_decision_owner"


def test_select_repair_root_question_id_ignores_unrelated_foundation_failures_for_people_chain():
    question_id = select_repair_root_question_id(
        source_payload={
            "entity_id": "fc-porto-2027",
            "entity_name": "FC Porto",
            "questions": [
                {"question_id": "q1_foundation", "depends_on": []},
                {"question_id": "q3_leadership", "depends_on": []},
                {"question_id": "q7_procurement_signal", "depends_on": []},
                {"question_id": "q11_decision_owner", "depends_on": ["q3_leadership", "q7_procurement_signal"]},
                {"question_id": "q12_connections", "depends_on": ["q11_decision_owner"]},
                {"question_id": "q15_outreach_strategy", "depends_on": ["q11_decision_owner", "q12_connections"]},
            ],
        },
        canonical_dossier={
            "questions": [
                _question("q1_foundation", "no_signal"),
                _question("q3_leadership", "no_signal"),
                _question("q7_procurement_signal", "answered"),
                _question("q11_decision_owner", "no_signal"),
                _question("q12_connections", "blocked"),
                _question("q15_outreach_strategy", "no_signal"),
            ]
        },
        exhausted_question_ids=set(),
    )

    assert question_id == "q11_decision_owner"
