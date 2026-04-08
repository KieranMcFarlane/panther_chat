from __future__ import annotations

import json
from pathlib import Path

import pytest


BACKEND_DIR = Path(__file__).resolve().parent.parent
QUESTION_SOURCE_DIR = BACKEND_DIR / "data" / "question_sources"

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


@pytest.mark.parametrize(
    "filename, entity_id, entity_name, entity_type, preset",
    [
        (
            "arsenal_atomic_matrix.json",
            "arsenal-fc",
            "Arsenal Football Club",
            "SPORT_CLUB",
            "arsenal-atomic-matrix",
        ),
        (
            "icf_atomic_matrix.json",
            "international-canoe-federation",
            "International Canoe Federation",
            "SPORT_FEDERATION",
            "icf-atomic-matrix",
        ),
        (
            "major_league_cricket_atomic_matrix.json",
            "major-league-cricket",
            "Major League Cricket",
            "SPORT_LEAGUE",
            "major-league-cricket-atomic-matrix",
        ),
    ],
)
def test_canonical_atomic_matrix_sources_are_fifteen_question_matrices(
    filename: str,
    entity_id: str,
    entity_name: str,
    entity_type: str,
    preset: str,
):
    source_path = QUESTION_SOURCE_DIR / filename
    assert source_path.exists(), f"Missing canonical atomic matrix source: {source_path}"

    payload = json.loads(source_path.read_text(encoding="utf-8"))

    assert payload["schema_version"] == "atomic_question_source_v1"
    assert payload["entity_id"] == entity_id
    assert payload["entity_name"] == entity_name
    assert payload["entity_type"] == entity_type
    assert payload["preset"] == preset
    assert payload["question_source_label"] == preset
    assert payload["question_shape"] == "atomic"
    assert payload["pack_role"] == "discovery"
    assert payload["pack_stage"] == "atomic_matrix"
    assert payload["rollout_strategy"] == "phased_core"
    assert payload["default_rollout_phase"] == "phase_1_core"
    assert payload["question_count"] == 15
    assert [question["question_id"] for question in payload["questions"]] == CANONICAL_QUESTION_IDS
    assert payload["questions"][0]["execution_class"] == "atomic_retrieval"
    assert payload["questions"][1]["execution_class"] == "deterministic_enrichment"
    assert payload["questions"][10]["structured_output_schema"] == "decision_owner_v1"
    assert payload["questions"][11]["graph_write_targets"] == ["connection_paths"]
