from __future__ import annotations

from pathlib import Path
import sys


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from universal_atomic_matrix import build_universal_atomic_question_source


CANONICAL_QUESTION_IDS = [
    "q1_foundation",
    "q2_digital_stack",
    "q3_leadership",
    "q6_launch_signal",
    "q7_procurement_signal",
    "q8_explicit_rfp",
    "q9_news_signal",
    "q10_hiring_signal",
    "q4_performance",
    "q5_league_context",
    "q11_decision_owner",
    "q12_connections",
    "q13_capability_gap",
    "q14_yp_fit",
    "q15_outreach_strategy",
]


def _question_index(payload: dict) -> dict[str, dict]:
    return {question["question_id"]: question for question in payload["questions"]}


def test_universal_atomic_matrix_builds_fifteen_question_canonical_sources():
    arsenal = build_universal_atomic_question_source(
        entity_type="SPORT_CLUB",
        entity_name="Arsenal Football Club",
        entity_id="arsenal-fc",
        preset="arsenal-atomic-matrix",
    )
    icf = build_universal_atomic_question_source(
        entity_type="SPORT_FEDERATION",
        entity_name="International Canoe Federation",
        entity_id="international-canoe-federation",
        preset="icf-atomic-matrix",
    )
    mlc = build_universal_atomic_question_source(
        entity_type="SPORT_LEAGUE",
        entity_name="Major League Cricket",
        entity_id="major-league-cricket",
        preset="major-league-cricket-atomic-matrix",
    )

    for payload, entity_name, entity_id, entity_type, preset in [
        (arsenal, "Arsenal Football Club", "arsenal-fc", "SPORT_CLUB", "arsenal-atomic-matrix"),
        (icf, "International Canoe Federation", "international-canoe-federation", "SPORT_FEDERATION", "icf-atomic-matrix"),
        (mlc, "Major League Cricket", "major-league-cricket", "SPORT_LEAGUE", "major-league-cricket-atomic-matrix"),
    ]:
        assert payload["schema_version"] == "atomic_question_source_v1"
        assert payload["entity_name"] == entity_name
        assert payload["entity_id"] == entity_id
        assert payload["entity_type"] == entity_type
        assert payload["preset"] == preset
        assert payload["question_shape"] == "atomic"
        assert payload["pack_role"] == "discovery"
        assert payload["pack_stage"] == "atomic_matrix"
        assert payload["rollout_strategy"] == "phased_core"
        assert payload["default_rollout_phase"] == "phase_1_core"
        assert payload["question_count"] == 15
        assert [question["question_id"] for question in payload["questions"]] == CANONICAL_QUESTION_IDS


def test_universal_atomic_matrix_adds_execution_class_phase_and_schema_metadata():
    payload = build_universal_atomic_question_source(
        entity_type="SPORT_CLUB",
        entity_name="Arsenal Football Club",
        entity_id="arsenal-fc",
        preset="arsenal-atomic-matrix",
    )
    questions = _question_index(payload)

    assert questions["q1_foundation"]["execution_class"] == "atomic_retrieval"
    assert questions["q3_leadership"]["execution_class"] == "atomic_retrieval"
    assert questions["q8_explicit_rfp"]["execution_class"] == "atomic_retrieval"
    assert questions["q2_digital_stack"]["execution_class"] == "deterministic_enrichment"
    assert questions["q4_performance"]["execution_class"] == "deterministic_enrichment"
    assert questions["q12_connections"]["execution_class"] == "deterministic_enrichment"
    assert questions["q13_capability_gap"]["execution_class"] == "derived_inference"
    assert questions["q15_outreach_strategy"]["execution_class"] == "derived_inference"

    assert questions["q1_foundation"]["rollout_phase"] == "phase_1_core"
    assert questions["q9_news_signal"]["rollout_phase"] == "phase_1_core"
    assert questions["q8_explicit_rfp"]["rollout_phase"] == "phase_2_conditional"
    assert questions["q4_performance"]["rollout_phase"] == "phase_2_conditional"
    assert questions["q11_decision_owner"]["rollout_phase"] == "phase_3_decision"
    assert questions["q15_outreach_strategy"]["rollout_phase"] == "phase_3_decision"

    assert questions["q11_decision_owner"]["depends_on"] == [
        "q3_leadership",
        "q6_launch_signal",
        "q7_procurement_signal",
        "q9_news_signal",
        "q10_hiring_signal",
    ]
    assert questions["q12_connections"]["depends_on"] == ["q11_decision_owner"]
    assert questions["q13_capability_gap"]["depends_on"] == [
        "q2_digital_stack",
        "q4_performance",
        "q5_league_context",
        "q6_launch_signal",
        "q7_procurement_signal",
        "q9_news_signal",
        "q10_hiring_signal",
    ]
    assert questions["q14_yp_fit"]["depends_on"] == ["q13_capability_gap", "q7_procurement_signal"]
    assert questions["q15_outreach_strategy"]["depends_on"] == [
        "q11_decision_owner",
        "q12_connections",
        "q14_yp_fit",
    ]

    assert questions["q11_decision_owner"]["structured_output_schema"] == "decision_owner_v1"
    assert questions["q12_connections"]["structured_output_schema"] == "connections_path_v1"
    assert questions["q15_outreach_strategy"]["structured_output_schema"] == "outreach_strategy_v1"
    assert questions["q3_leadership"]["graph_write_targets"] == ["person_candidates"]
    assert questions["q11_decision_owner"]["graph_write_targets"] == ["decision_owner_rankings"]
    assert questions["q12_connections"]["graph_write_targets"] == ["connection_paths"]
    assert questions["q13_capability_gap"]["graph_write_targets"] == ["capability_gap_episodes"]


def test_universal_atomic_matrix_marks_conditional_questions_explicitly():
    payload = build_universal_atomic_question_source(
        entity_type="SPORT_LEAGUE",
        entity_name="Major League Cricket",
        entity_id="major-league-cricket",
        preset="major-league-cricket-atomic-matrix",
    )
    questions = _question_index(payload)

    assert questions["q8_explicit_rfp"]["conditional_on"] == [
        {"type": "validated_question", "question_id": "q7_procurement_signal"}
    ]
    assert questions["q10_hiring_signal"]["conditional_on"] == [
        {"type": "question_phase_enabled", "question_id": "q9_news_signal"}
    ]
    assert questions["q4_performance"]["conditional_on"] == [
        {"type": "entity_type_in", "values": ["SPORT_CLUB", "SPORT_LEAGUE"]}
    ]
    assert questions["q5_league_context"]["conditional_on"] == [
        {"type": "entity_type_in", "values": ["SPORT_CLUB", "SPORT_LEAGUE", "SPORT_FEDERATION"]}
    ]
    assert questions["q12_connections"]["conditional_on"] == [
        {"type": "validated_question", "question_id": "q11_decision_owner"}
    ]


def test_universal_atomic_matrix_keeps_deterministic_and_derived_questions_out_of_retrieval_fallback():
    payload = build_universal_atomic_question_source(
        entity_type="SPORT_FEDERATION",
        entity_name="International Canoe Federation",
        entity_id="international-canoe-federation",
        preset="icf-atomic-matrix",
    )
    questions = _question_index(payload)

    assert questions["q2_digital_stack"]["deterministic_tools"] == ["apify_techstack"]
    assert questions["q2_digital_stack"]["fallback_to_retrieval"] is True
    assert questions["q4_performance"]["fallback_to_retrieval"] is False
    assert questions["q5_league_context"]["fallback_to_retrieval"] is False
    assert questions["q12_connections"]["fallback_to_retrieval"] is False
    assert questions["q13_capability_gap"]["fallback_to_retrieval"] is False
    assert questions["q14_yp_fit"]["fallback_to_retrieval"] is False
    assert questions["q15_outreach_strategy"]["fallback_to_retrieval"] is False
