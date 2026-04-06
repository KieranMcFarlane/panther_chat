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
    if entity_id == "international-canoe-federation":
        assert [question["question_type"] for question in payload["questions"]] == [
            "foundation",
            "digital_stack",
            "tender_docs",
            "decision_owner",
            "related_pois",
        ]
    else:
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
    if entity_id == "international-canoe-federation":
        assert payload["questions"][2]["source_priority"] == [
            "official_site",
            "google_serp",
            "press_release",
            "news",
        ]
    else:
        assert payload["questions"][2]["source_priority"] == [
            "google_serp",
            "linkedin_posts",
            "news",
            "press_release",
            "official_site",
        ]
    if entity_id == "international-canoe-federation":
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
    if entity_id == "international-canoe-federation":
        assert [question["hop_budget"] for question in payload["questions"]] == [8, 8, 8, 6, 8]
    else:
        assert all(question["hop_budget"] == 8 for question in payload["questions"])
    assert all(question["question_timeout_ms"] == 180000 for question in payload["questions"])
    assert all(question["hop_timeout_ms"] == 180000 for question in payload["questions"])
    assert all(question["evidence_extension_confidence_threshold"] == 0.65 for question in payload["questions"])
    if entity_id == "arsenal-fc":
        assert payload["questions"][0]["query"] == '"Arsenal Football Club" official website founded year'
        assert payload["questions"][0]["search_strategy"]["search_queries"] == [
            '"Arsenal Football Club" official website',
            '"Arsenal Football Club" history',
            '"Arsenal Football Club" founded year',
            '"Arsenal Football Club" wikipedia',
        ]
        assert payload["questions"][2]["search_strategy"]["search_queries"] == [
            '"Arsenal Football Club" partner',
            '"Arsenal Football Club" sponsor',
            '"Arsenal Football Club" official partner',
            '"Arsenal Football Club" digital partner',
            '"Arsenal Football Club" technology partner',
            '"Arsenal Football Club" platform',
            '"Arsenal Football Club" mobile app',
            '"Arsenal Football Club" hiring digital',
            '"Arsenal Football Club" hiring analytics',
            '"Arsenal Football Club" analytics initiative',
            '"Arsenal Football Club" broadcast partner',
            '"Arsenal Football Club" vendor',
            '"Arsenal Football Club" RFP',
            '"Arsenal Football Club" tender',
            '"Arsenal Football Club" procurement',
        ]
    if entity_id == "celtic-fc":
        assert payload["questions"][0]["query"] == '"Celtic Football Club" official website founded year'
        assert payload["questions"][0]["search_strategy"]["search_queries"] == [
            '"Celtic Football Club" official website',
            '"Celtic Football Club" history',
            '"Celtic Football Club" founded year',
            '"Celtic Football Club" wikipedia',
        ]
        assert payload["questions"][2]["question"] == (
            "Is there evidence Celtic Football Club is buying, launching, or reshaping its commercial or digital ecosystem through sponsorship, partnerships, hiring, or platform initiatives?"
        )
        assert payload["questions"][2]["query"] == '"Celtic Football Club" commercial partnership'
        assert payload["questions"][2]["source_priority"] == [
            "official_site",
            "press_release",
            "news",
            "google_serp",
        ]
        assert payload["questions"][2]["search_strategy"]["search_queries"] == [
            'site:celticfc.com/club/club-partners/ Celtic Football Club commercial partners',
            'site:celticfc.com/club/club-partners/ Celtic Football Club official partners',
            'site:cdn.celticfc.com/assets/Celtic_plc_Annual_Report_2025.pdf Celtic commercial partners',
            '"Celtic Football Club" official partner',
            '"Celtic Football Club" commercial partnership',
            '"Celtic Football Club" sponsorship',
            '"Celtic Football Club" sponsor',
            '"Celtic Football Club" partnership announcement',
            '"Celtic Football Club" commercial operations',
            '"Celtic Football Club" business development',
            '"Celtic Football Club" fan engagement',
            '"Celtic Football Club" digital platform',
            '"Celtic Football Club" app',
            '"Celtic Football Club" commercial partners',
            '"Celtic Football Club" sponsorship opportunities',
            '"Celtic Football Club" official website',
            '"Celtic Football Club" press release',
        ]
        assert payload["questions"][3]["search_strategy"]["search_queries"] == [
            '"Celtic Football Club" official website',
            '"Celtic Football Club" leadership team',
            '"Celtic Football Club" commercial team',
            '"Celtic Football Club" commercial director',
            '"Celtic Football Club" head of partnerships',
            '"Celtic Football Club" partnerships manager',
            '"Celtic Football Club" sponsorship manager',
            '"Celtic Football Club" marketing director',
            '"Celtic Football Club" chief commercial officer',
            '"Celtic Football Club" business development director',
        ]
        assert payload["questions"][4]["search_strategy"]["search_queries"] == [
            '"Celtic Football Club" official website',
            '"Celtic Football Club" leadership team',
            '"Celtic Football Club" commercial team',
            '"Celtic Football Club" commercial director',
            '"Celtic Football Club" partnerships manager',
            '"Celtic Football Club" sponsorship manager',
            '"Celtic Football Club" marketing director',
            '"Celtic Football Club" head of partnerships',
            '"Celtic Football Club" business development director',
            '"Celtic Football Club" fan engagement',
            '"Celtic Football Club" digital product',
            '"Celtic Football Club" operations director',
        ]
    if entity_id == "international-canoe-federation":
        assert payload["questions"][2]["question_family"] == "tender_docs"
        assert payload["questions"][2]["question_type"] == "tender_docs"
        assert payload["questions"][2]["question"] == (
            "Are there explicit tender documents or RFPs for digital or broadcast procurement at International Canoe Federation?"
        )
        assert payload["questions"][2]["query"] == '"International Canoe Federation" tenders'
        assert payload["questions"][2]["search_strategy"]["search_queries"] == [
            '"International Canoe Federation" tenders',
            '"International Canoe Federation" Paddle Worldwide digital ecosystem',
            '"International Canoe Federation" OTT platform',
            'site:canoeicf.com paddleworldwide_dxp_rfp.pdf',
            'site:canoeicf.com ott platform 2026 pdf',
            'site:canoeicf.com tenders',
        ]
        assert payload["questions"][3]["question"] == (
            "Who is the most suitable senior commercial owner for sponsorship, broadcast, media rights, or marketing at International Canoe Federation?"
        )
        assert payload["questions"][3]["search_strategy"]["search_queries"] == [
            '"International Canoe Federation" LinkedIn company profile',
            '"International Canoe Federation" commercial and sponsorship',
            '"International Canoe Federation" broadcast marketing',
            '"International Canoe Federation" media rights',
            '"International Canoe Federation" marketing director',
            '"International Canoe Federation" commercial manager',
            '"International Canoe Federation" sponsorship manager',
            '"International Canoe Federation" director of tv broadcast marketing',
        ]
    if entity_id == "major-league-cricket":
        assert payload["questions"][0]["query"] == '"Major League Cricket" official website founded year'
        assert payload["questions"][0]["search_strategy"]["search_queries"] == [
            '"Major League Cricket" official website',
            '"Major League Cricket" founded year',
            '"Major League Cricket" wikipedia',
        ]
        assert payload["questions"][1]["question"] == (
            "What visible technologies, platforms, or vendors does Major League Cricket use, and what do they imply commercially?"
        )
        assert payload["questions"][1]["query"] == '"Major League Cricket" official website'
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
        assert payload["questions"][3]["search_strategy"]["search_queries"] == [
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
        assert payload["questions"][4]["question"] == (
            "Which 3 to 5 people are the most relevant commercial, partnerships, or business development contacts at Major League Cricket?"
        )
        assert payload["questions"][4]["question_type"] == "related_pois"
        assert payload["questions"][4]["search_strategy"]["search_queries"] == [
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
