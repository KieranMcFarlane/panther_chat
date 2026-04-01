from __future__ import annotations

import json
from pathlib import Path
import sys


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from universal_atomic_matrix import build_universal_atomic_question_source


def _load_source(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def test_universal_atomic_matrix_builds_consistent_four_question_sources():
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
        assert payload["question_count"] == 4
        assert [question["question_id"] for question in payload["questions"]] == [
            "q1_foundation",
            "q2_launch_signal",
            "q3_procurement_signal",
            "q4_decision_owner",
        ]
        assert [question["question_type"] for question in payload["questions"]] == [
            "foundation",
            "launch",
            "procurement",
            "decision_owner",
        ]
        assert all(question["question_shape"] == "atomic" for question in payload["questions"])
        assert payload["questions"][0]["source_priority"] == [
            "google_serp",
            "official_site",
            "wikipedia",
        ]
        assert payload["questions"][1]["source_priority"] == [
            "google_serp",
            "news",
            "press_release",
            "linkedin_posts",
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
            "google_serp",
            "linkedin_posts",
            "linkedin_people_search",
            "linkedin_person_profile",
            "linkedin_company_profile",
            "news",
            "official_site",
        ]
        assert all(question["hop_budget"] == 8 for question in payload["questions"])
        assert all(question["evidence_extension_confidence_threshold"] == 0.65 for question in payload["questions"])
        assert all(question["question_timeout_ms"] == 180000 for question in payload["questions"])
        assert all(question["hop_timeout_ms"] == 180000 for question in payload["questions"])

    assert arsenal["questions"][0]["question"] == "What year was Arsenal Football Club founded?"
    assert icf["questions"][0]["question"] == "What year was International Canoe Federation founded?"
    assert mlc["questions"][0]["question"] == "What year was Major League Cricket founded?"
    assert mlc["questions"][1]["question"] == (
        "Has Major League Cricket launched a public app, product, or digital platform?"
    )
    assert mlc["questions"][1]["search_strategy"]["search_queries"] == [
        '"Major League Cricket" launched a public app',
        '"Major League Cricket" launched a product',
        '"Major League Cricket" launched a digital platform',
    ]
    assert mlc["questions"][2]["search_strategy"]["search_queries"] == [
        '"Major League Cricket" RFP',
        '"Major League Cricket" tender',
        '"Major League Cricket" procurement',
        '"Major League Cricket" vendor',
        '"Major League Cricket" sponsor',
        '"Major League Cricket" broadcast',
    ]
    assert mlc["questions"][3]["search_strategy"]["search_queries"] == [
        '"Major League Cricket" business',
        '"Major League Cricket" commercial partnerships',
        '"Major League Cricket" business development',
        '"Major League Cricket" LinkedIn',
        '"Major League Cricket" leadership',
    ]


def test_universal_atomic_matrix_output_matches_canonical_files():
    backend_dir = Path(__file__).resolve().parent.parent
    sources = [
        (
            backend_dir / "data" / "question_sources" / "arsenal_atomic_matrix.json",
            "SPORT_CLUB",
            "Arsenal Football Club",
            "arsenal-fc",
            "arsenal-atomic-matrix",
        ),
        (
            backend_dir / "data" / "question_sources" / "icf_atomic_matrix.json",
            "SPORT_FEDERATION",
            "International Canoe Federation",
            "international-canoe-federation",
            "icf-atomic-matrix",
        ),
        (
            backend_dir / "data" / "question_sources" / "major_league_cricket_atomic_matrix.json",
            "SPORT_LEAGUE",
            "Major League Cricket",
            "major-league-cricket",
            "major-league-cricket-atomic-matrix",
        ),
    ]

    for path, entity_type, entity_name, entity_id, preset in sources:
        payload = _load_source(path)
        expected = build_universal_atomic_question_source(
            entity_type=entity_type,
            entity_name=entity_name,
            entity_id=entity_id,
            preset=preset,
        )
        assert payload["schema_version"] == expected["schema_version"]
        assert payload["entity_type"] == expected["entity_type"]
        assert payload["entity_name"] == expected["entity_name"]
        assert payload["entity_id"] == expected["entity_id"]
        assert payload["preset"] == expected["preset"]
        assert payload["question_shape"] == "atomic"
        assert payload["pack_role"] == "discovery"
        assert payload["pack_stage"] == "atomic_matrix"
        assert payload["question_count"] == 4
        if entity_id == "major-league-cricket":
            assert payload["questions"][1]["question"] == (
                "Has Major League Cricket launched a public app, product, or digital platform?"
            )
            assert payload["questions"][1]["search_strategy"]["search_queries"] == [
                '"Major League Cricket" launched a public app',
                '"Major League Cricket" launched a product',
                '"Major League Cricket" launched a digital platform',
            ]
            assert payload["questions"][2]["search_strategy"]["search_queries"] == [
                '"Major League Cricket" RFP',
                '"Major League Cricket" tender',
                '"Major League Cricket" procurement',
                '"Major League Cricket" vendor',
                '"Major League Cricket" sponsor',
                '"Major League Cricket" broadcast',
            ]
            assert payload["questions"][3]["search_strategy"]["search_queries"] == [
                '"Major League Cricket" business',
                '"Major League Cricket" commercial partnerships',
                '"Major League Cricket" business development',
                '"Major League Cricket" LinkedIn',
                '"Major League Cricket" leadership',
            ]
        assert payload["questions"] == expected["questions"]
