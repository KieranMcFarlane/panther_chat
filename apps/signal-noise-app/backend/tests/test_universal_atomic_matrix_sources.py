from __future__ import annotations

import json
from pathlib import Path

import pytest


BACKEND_DIR = Path(__file__).resolve().parent.parent
QUESTION_SOURCE_DIR = BACKEND_DIR / "data" / "question_sources"


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
def test_canonical_atomic_matrix_sources_are_five_question_universal_matrices(
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
    assert payload["question_count"] == 5

    assert [question["question_id"] for question in payload["questions"]] == [
        "q1_foundation",
        "q2_digital_stack",
        "q3_procurement_signal",
        "q4_decision_owner",
        "q5_related_pois",
    ]
    assert [question["question_type"] for question in payload["questions"]] == [
        "foundation",
        "digital_stack",
        "procurement",
        "decision_owner",
        "related_pois",
    ]
    assert all(question["question_shape"] == "atomic" for question in payload["questions"])
    assert payload["questions"][0]["source_priority"] == [
        "google_serp",
        "official_site",
        "wikipedia",
    ]
    assert payload["questions"][1]["source_priority"] == [
        "apify_techstack",
        "google_serp",
        "news",
        "press_release",
        "official_site",
    ]
    assert payload["questions"][2]["source_priority"] == [
        "google_serp",
        "linkedin_posts",
        "news",
        "press_release",
        "official_site",
    ]
    assert payload["questions"][3]["source_priority"] == [
        "linkedin_company_profile",
        "linkedin_people_search",
        "linkedin_person_profile",
        "google_serp",
        "official_site",
    ]
    assert payload["questions"][4]["source_priority"] == [
        "linkedin_company_profile",
        "linkedin_people_search",
        "linkedin_person_profile",
        "google_serp",
        "official_site",
    ]
    assert all(question["hop_budget"] == 8 for question in payload["questions"])
    assert all(question["question_timeout_ms"] == 180000 for question in payload["questions"])
    assert all(question["hop_timeout_ms"] == 180000 for question in payload["questions"])
    assert all(question["evidence_extension_confidence_threshold"] == 0.65 for question in payload["questions"])
    if entity_id == "major-league-cricket":
        assert payload["questions"][1]["question"] == (
            "What visible technologies, platforms, or vendors does Major League Cricket use, and what do they imply commercially?"
        )
        assert payload["questions"][1]["deterministic_tools"] == ["apify_techstack"]
        assert payload["questions"][1]["fallback_to_retrieval"] is True
        assert payload["questions"][1]["deterministic_input"] == {
            "source_question_id": "q1_foundation",
            "official_site_only": True,
        }
        assert payload["questions"][1]["search_strategy"]["search_queries"] == [
            '"Major League Cricket" technology stack',
            '"Major League Cricket" tech stack',
            '"Major League Cricket" digital stack',
            '"Major League Cricket" official website',
            '"Major League Cricket" digital experience',
            '"Major League Cricket" CRM',
            '"Major League Cricket" analytics platform',
            '"Major League Cricket" ticketing platform',
            '"Major League Cricket" ecommerce',
            '"Major League Cricket" mobile app',
            '"Major League Cricket" technology partner',
            '"Major League Cricket" digital partner',
            '"Major League Cricket" official partner',
            '"Major League Cricket" case study',
            '"Major League Cricket" platform',
            '"Major League Cricket" app',
        ]
        assert payload["questions"][2]["search_strategy"]["search_queries"] == [
            '"Major League Cricket" RFP',
            '"Major League Cricket" tender',
            '"Major League Cricket" procurement',
            '"Major League Cricket" vendor',
            '"Major League Cricket" sponsor',
            '"Major League Cricket" broadcast',
            '"Major League Cricket" hiring digital',
            '"Major League Cricket" analytics',
            '"Major League Cricket" platform',
        ]
        assert payload["questions"][3]["query"] == '"Major League Cricket" LinkedIn company profile'
        assert payload["questions"][3]["search_strategy"]["search_queries"][0] == (
            '"Major League Cricket" LinkedIn company profile'
        )
        assert '"Major League Cricket" LinkedIn sponsorship' in payload["questions"][3]["search_strategy"]["search_queries"]
        assert '"Major League Cricket" chief digital officer' in payload["questions"][3]["search_strategy"]["search_queries"]
        assert payload["questions"][4]["question"] == (
            "Which 3 to 5 people are the most relevant commercial, partnerships, or business development contacts at Major League Cricket?"
        )
        assert payload["questions"][4]["question_type"] == "related_pois"
        assert payload["questions"][4]["search_strategy"]["search_queries"][0] == (
            '"Major League Cricket" LinkedIn company profile'
        )
