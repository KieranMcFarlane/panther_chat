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


def test_universal_atomic_matrix_builds_consistent_five_question_sources():
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
        if payload["entity_type"] == "SPORT_FEDERATION":
            assert payload["questions"][3]["source_priority"] == [
                "linkedin_company_profile",
                "linkedin_people_search",
                "linkedin_person_profile",
                "google_serp",
                "official_site",
            ]
        else:
            assert payload["questions"][3]["source_priority"] == [
                "google_serp",
                "official_site",
                "news",
                "press_release",
                "linkedin_company_profile",
                "linkedin_people_search",
                "linkedin_person_profile",
            ]
        assert payload["questions"][4]["source_priority"] == [
            "linkedin_company_profile",
            "linkedin_people_search",
            "linkedin_person_profile",
            "google_serp",
            "official_site",
        ]
        if payload["entity_type"] == "SPORT_FEDERATION":
            assert [question["hop_budget"] for question in payload["questions"]] == [8, 8, 8, 6, 8]
        else:
            assert all(question["hop_budget"] == 8 for question in payload["questions"])
        assert all(question["evidence_extension_confidence_threshold"] == 0.65 for question in payload["questions"])
        assert all(question["question_timeout_ms"] == 180000 for question in payload["questions"])
        assert all(question["hop_timeout_ms"] == 180000 for question in payload["questions"])

    assert arsenal["questions"][0]["question"] == "What year was Arsenal Football Club founded?"
    assert icf["questions"][0]["question"] == "What year was International Canoe Federation founded?"
    assert mlc["questions"][0]["question"] == "What year was Major League Cricket founded?"
    for payload, entity_name in [
        (arsenal, "Arsenal Football Club"),
        (icf, "International Canoe Federation"),
        (mlc, "Major League Cricket"),
    ]:
        if payload["entity_type"] == "SPORT_CLUB":
            q2_expected = [
                f'"{entity_name}" technology stack',
                f'"{entity_name}" tech stack',
                f'"{entity_name}" digital stack',
                f'"{entity_name}" official website',
                f'"{entity_name}" digital experience',
                f'"{entity_name}" case study',
                f'"{entity_name}" official partner',
                f'"{entity_name}" digital partner',
                f'"{entity_name}" technology partner',
                f'"{entity_name}" platform',
                f'"{entity_name}" app',
                f'"{entity_name}" mobile app',
                f'"{entity_name}" CRM',
                f'"{entity_name}" ticketing platform',
                f'"{entity_name}" ecommerce',
                f'"{entity_name}" analytics platform',
            ]
        elif payload["entity_type"] == "SPORT_FEDERATION":
            q2_expected = [
                f'"{entity_name}" technology stack',
                f'"{entity_name}" tech stack',
                f'"{entity_name}" digital stack',
                f'"{entity_name}" official website',
                f'"{entity_name}" digital experience',
                f'"{entity_name}" events platform',
                f'"{entity_name}" membership platform',
                f'"{entity_name}" results platform',
                f'"{entity_name}" rankings platform',
                f'"{entity_name}" athlete app',
                f'"{entity_name}" mobile app',
                f'"{entity_name}" broadcast partner',
                f'"{entity_name}" technology partner',
                f'"{entity_name}" digital partner',
                f'"{entity_name}" official partner',
                f'"{entity_name}" case study',
                f'"{entity_name}" platform',
                f'"{entity_name}" app',
            ]
        else:
            if entity_name == "Major League Cricket":
                q2_expected = [
                    f'"{entity_name}" official website',
                    f'"{entity_name}" technology stack',
                    f'"{entity_name}" tech stack',
                    f'"{entity_name}" digital stack',
                    f'"{entity_name}" digital experience',
                    f'"{entity_name}" CRM',
                    f'"{entity_name}" analytics platform',
                    f'"{entity_name}" ticketing platform',
                    f'"{entity_name}" ecommerce',
                    f'"{entity_name}" mobile app',
                    f'"{entity_name}" technology partner',
                    f'"{entity_name}" digital partner',
                    f'"{entity_name}" official partner',
                    f'"{entity_name}" case study',
                    f'"{entity_name}" platform',
                    f'"{entity_name}" app',
                ]
            else:
                q2_expected = [
                    f'"{entity_name}" technology stack',
                    f'"{entity_name}" tech stack',
                    f'"{entity_name}" digital stack',
                    f'"{entity_name}" official website',
                    f'"{entity_name}" digital experience',
                    f'"{entity_name}" CRM',
                    f'"{entity_name}" analytics platform',
                    f'"{entity_name}" ticketing platform',
                    f'"{entity_name}" ecommerce',
                    f'"{entity_name}" mobile app',
                    f'"{entity_name}" technology partner',
                    f'"{entity_name}" digital partner',
                    f'"{entity_name}" official partner',
                    f'"{entity_name}" case study',
                    f'"{entity_name}" platform',
                    f'"{entity_name}" app',
                ]
        assert payload["questions"][1]["question"] == (
            f"What visible technologies, platforms, or vendors does {entity_name} use, and what do they imply commercially?"
        )
        assert payload["questions"][1]["deterministic_tools"] == ["apify_techstack"]
        assert payload["questions"][1]["fallback_to_retrieval"] is True
        assert payload["questions"][1]["deterministic_input"] == {
            "source_question_id": "q1_foundation",
            "official_site_only": True,
        }
        assert payload["questions"][1]["search_strategy"]["search_queries"] == q2_expected
        assert payload["questions"][1]["question"] == (
            f"What visible technologies, platforms, or vendors does {entity_name} use, and what do they imply commercially?"
        )
    assert arsenal["questions"][2]["question"] == (
        "Is there evidence Arsenal Football Club is buying, launching, or reshaping its commercial or digital ecosystem through procurement, partnerships, hiring, or platform initiatives?"
    )
    assert arsenal["questions"][2]["search_strategy"]["search_queries"] == [
        '"Arsenal Football Club" RFP',
        '"Arsenal Football Club" tender',
        '"Arsenal Football Club" procurement',
        '"Arsenal Football Club" partner',
        '"Arsenal Football Club" sponsor',
        '"Arsenal Football Club" hiring digital',
        '"Arsenal Football Club" hiring analytics',
        '"Arsenal Football Club" platform',
        '"Arsenal Football Club" analytics initiative',
        '"Arsenal Football Club" broadcast partner',
        '"Arsenal Football Club" vendor',
    ]
    assert mlc["questions"][2]["search_strategy"]["search_queries"] == [
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
    assert mlc["questions"][0]["query"] == '"Major League Cricket" official website founded year'
    assert mlc["questions"][0]["search_strategy"]["search_queries"] == [
        '"Major League Cricket" official website',
        '"Major League Cricket" founded year',
        '"Major League Cricket" wikipedia',
    ]
    assert mlc["questions"][1]["query"] == '"Major League Cricket" official website'
    assert mlc["questions"][1]["search_strategy"]["search_queries"] == [
        '"Major League Cricket" official website',
        '"Major League Cricket" technology stack',
        '"Major League Cricket" tech stack',
        '"Major League Cricket" digital stack',
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
    assert arsenal["questions"][3]["query"] == '"Arsenal Football Club" LinkedIn company profile'
    assert arsenal["questions"][3]["search_strategy"]["search_queries"] == [
        '"Arsenal Football Club" LinkedIn company profile',
        '"Arsenal Football Club" front office staff',
        '"Arsenal Football Club" leadership team',
        '"Arsenal Football Club" commercial team',
        '"Arsenal Football Club" partnerships',
        '"Arsenal Football Club" sponsorship',
        '"Arsenal Football Club" chief business officer',
        '"Arsenal Football Club" chief commercial officer',
        '"Arsenal Football Club" commercial director',
        '"Arsenal Football Club" head of partnerships',
        '"Arsenal Football Club" business development director',
        '"Arsenal Football Club" CEO',
    ]
    assert arsenal["questions"][4]["search_strategy"]["search_queries"] == [
        '"Arsenal Football Club" LinkedIn company profile',
        '"Arsenal Football Club" LinkedIn commercial',
        '"Arsenal Football Club" LinkedIn partnerships',
        '"Arsenal Football Club" LinkedIn sponsorship',
        '"Arsenal Football Club" LinkedIn business development',
        '"Arsenal Football Club" LinkedIn marketing',
        '"Arsenal Football Club" chief commercial officer',
        '"Arsenal Football Club" commercial director',
        '"Arsenal Football Club" partnerships director',
        '"Arsenal Football Club" sponsorship director',
        '"Arsenal Football Club" head of partnerships',
        '"Arsenal Football Club" CEO',
    ]
    assert icf["questions"][3]["question"] == (
        "Who is the most suitable senior commercial owner for sponsorship, broadcast, media rights, or marketing at International Canoe Federation?"
    )
    assert icf["questions"][3]["search_strategy"]["search_queries"] == [
        '"International Canoe Federation" LinkedIn company profile',
        '"International Canoe Federation" commercial and sponsorship',
        '"International Canoe Federation" broadcast marketing',
        '"International Canoe Federation" media rights',
        '"International Canoe Federation" marketing director',
        '"International Canoe Federation" commercial manager',
        '"International Canoe Federation" sponsorship manager',
        '"International Canoe Federation" director of tv broadcast marketing',
    ]
    assert mlc["questions"][3]["search_strategy"]["search_queries"] == [
        '"Major League Cricket" LinkedIn company profile',
        '"Major League Cricket" leadership team',
        '"Major League Cricket" commercial team',
        '"Major League Cricket" partnerships',
        '"Major League Cricket" sponsorship',
        '"Major League Cricket" chief business officer',
        '"Major League Cricket" vice president commercial',
        '"Major League Cricket" chief commercial officer',
        '"Major League Cricket" commercial director',
        '"Major League Cricket" head of partnerships',
        '"Major League Cricket" business development director',
        '"Major League Cricket" CEO',
    ]
    assert mlc["questions"][3]["query"] == '"Major League Cricket" LinkedIn company profile'
    assert mlc["questions"][3]["search_strategy"]["search_queries"][0] == (
        '"Major League Cricket" LinkedIn company profile'
    )
    assert '"Major League Cricket" head of partnerships' in mlc["questions"][3]["search_strategy"]["search_queries"]
    assert mlc["questions"][4]["question"] == (
        "Which 3 to 5 people are the most relevant commercial, partnerships, or business development contacts at Major League Cricket?"
    )
    assert mlc["questions"][4]["question_type"] == "related_pois"
    assert mlc["questions"][4]["search_strategy"]["search_queries"] == [
        '"Major League Cricket" LinkedIn company profile',
        '"Major League Cricket" LinkedIn commercial',
        '"Major League Cricket" LinkedIn sponsorship',
        '"Major League Cricket" LinkedIn partnerships',
        '"Major League Cricket" LinkedIn revenue',
        '"Major League Cricket" LinkedIn marketing',
        '"Major League Cricket" vice president commercial',
        '"Major League Cricket" chief commercial officer',
        '"Major League Cricket" partnerships director',
        '"Major League Cricket" sponsorship director',
        '"Major League Cricket" CEO',
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
        assert payload["question_count"] == 5
        if entity_id == "major-league-cricket":
            assert payload["questions"][1]["question"] == (
                "What visible technologies, platforms, or vendors does Major League Cricket use, and what do they imply commercially?"
            )
            assert payload["questions"][1]["source_priority"] == [
                "apify_techstack",
                "google_serp",
                "news",
                "press_release",
                "official_site",
            ]
            assert payload["questions"][1]["deterministic_tools"] == ["apify_techstack"]
            assert payload["questions"][1]["fallback_to_retrieval"] is True
            assert payload["questions"][1]["deterministic_input"] == {
                "source_question_id": "q1_foundation",
                "official_site_only": True,
            }
            assert payload["questions"][1]["search_strategy"]["search_queries"] == [
                '"Major League Cricket" official website',
                '"Major League Cricket" technology stack',
                '"Major League Cricket" tech stack',
                '"Major League Cricket" digital stack',
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
            assert '"Major League Cricket" chief business officer' in payload["questions"][3]["search_strategy"]["search_queries"]
            assert '"Major League Cricket" head of partnerships' in payload["questions"][3]["search_strategy"]["search_queries"]
            assert payload["questions"][4]["question"] == (
                "Which 3 to 5 people are the most relevant commercial, partnerships, or business development contacts at Major League Cricket?"
            )
            assert payload["questions"][4]["question_type"] == "related_pois"
            assert payload["questions"][4]["search_strategy"]["search_queries"][0] == (
                '"Major League Cricket" LinkedIn company profile'
            )
        assert payload["questions"] == expected["questions"]
