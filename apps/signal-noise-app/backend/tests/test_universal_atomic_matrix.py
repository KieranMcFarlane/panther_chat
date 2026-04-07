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
    celtic = build_universal_atomic_question_source(
        entity_type="SPORT_CLUB",
        entity_name="Celtic FC",
        entity_id="celtic-fc",
        preset="celtic-fc-atomic-matrix",
    )

    for payload, entity_name, entity_id, entity_type, preset in [
        (arsenal, "Arsenal Football Club", "arsenal-fc", "SPORT_CLUB", "arsenal-atomic-matrix"),
        (icf, "International Canoe Federation", "international-canoe-federation", "SPORT_FEDERATION", "icf-atomic-matrix"),
        (mlc, "Major League Cricket", "major-league-cricket", "SPORT_LEAGUE", "major-league-cricket-atomic-matrix"),
        (celtic, "Celtic FC", "celtic-fc", "SPORT_CLUB", "celtic-fc-atomic-matrix"),
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
        if payload["entity_id"] == "international-canoe-federation":
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
        if payload["entity_id"] == "international-canoe-federation":
            assert payload["questions"][2]["source_priority"] == [
                "official_site",
                "google_serp",
                "press_release",
                "news",
            ]
        elif payload["entity_id"] == "celtic-fc":
            assert payload["questions"][2]["source_priority"] == [
                "official_site",
                "press_release",
                "news",
                "google_serp",
            ]
        elif payload["entity_type"] == "SPORT_CLUB":
            assert payload["questions"][2]["source_priority"] == [
                "official_site",
                "press_release",
                "news",
                "google_serp",
                "linkedin_posts",
            ]
        elif payload["entity_type"] == "SPORT_LEAGUE":
            assert payload["questions"][2]["source_priority"] == [
                "official_site",
                "news",
                "press_release",
                "google_serp",
                "linkedin_posts",
            ]
        else:
            assert payload["questions"][2]["source_priority"] == [
                "official_site",
                "press_release",
                "news",
                "google_serp",
            ]
        if payload["entity_id"] in {"arsenal-fc", "international-canoe-federation"}:
            assert payload["questions"][3]["source_priority"] == [
                "official_site",
                "news",
                "press_release",
                "google_serp",
                "linkedin_company_profile",
                "linkedin_people_search",
                "linkedin_person_profile",
            ]
        elif payload["entity_id"] in {"celtic-fc", "major-league-cricket"}:
            assert payload["questions"][3]["source_priority"] == [
                "official_site",
                "google_serp",
                "news",
                "press_release",
                "linkedin_company_profile",
                "linkedin_people_search",
                "linkedin_person_profile",
            ]
        else:
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
        if payload["entity_id"] == "international-canoe-federation":
            assert payload["questions"][2]["question"] == (
                "Are there explicit tender documents or RFPs for digital or broadcast procurement at International Canoe Federation?"
            )
            assert payload["questions"][2]["search_strategy"]["search_queries"] == [
                '"International Canoe Federation" tenders',
                '"International Canoe Federation" Paddle Worldwide digital ecosystem',
                '"International Canoe Federation" OTT platform',
                'site:canoeicf.com paddleworldwide_dxp_rfp.pdf',
                'site:canoeicf.com ott platform 2026 pdf',
                'site:canoeicf.com tenders',
            ]
        else:
            if payload["entity_id"] == "arsenal-fc":
                q3_expected = [
                    f'"{entity_name}" official website',
                    f'"{entity_name}" official partner',
                    f'"{entity_name}" commercial partner',
                    f'"{entity_name}" global partner',
                    f'"{entity_name}" sponsorship',
                    f'"{entity_name}" partnerships',
                    f'"{entity_name}" technology partner',
                    f'"{entity_name}" digital partner',
                    f'"{entity_name}" fan engagement platform',
                    f'"{entity_name}" data partner',
                    f'"{entity_name}" mobile app',
                    f'"{entity_name}" analytics initiative',
                    f'"{entity_name}" broadcast partner',
                    f'"{entity_name}" media rights',
                    f'"{entity_name}" digital transformation',
                    f'"{entity_name}" procurement',
                ]
            elif payload["entity_type"] == "SPORT_LEAGUE":
                q3_expected = [
                    f'"{entity_name}" official website',
                    f'"{entity_name}" partner',
                    f'"{entity_name}" sponsor',
                    f'"{entity_name}" official partner',
                    f'"{entity_name}" broadcast partner',
                    f'"{entity_name}" broadcast rights',
                    f'"{entity_name}" media rights',
                    f'"{entity_name}" data partner',
                    f'"{entity_name}" analytics',
                    f'"{entity_name}" platform',
                    f'"{entity_name}" digital platform',
                    f'"{entity_name}" streaming platform',
                    f'"{entity_name}" mobile app',
                    f'"{entity_name}" digital transformation',
                    f'"{entity_name}" vendor',
                    f'"{entity_name}" procurement',
                ]
            elif payload["entity_type"] == "SPORT_FEDERATION":
                q3_expected = [
                    f'"{entity_name}" official website',
                    f'"{entity_name}" partner',
                    f'"{entity_name}" sponsor',
                    f'"{entity_name}" commercial and sponsorship',
                    f'"{entity_name}" broadcast rights',
                    f'"{entity_name}" media rights',
                    f'"{entity_name}" digital partner',
                    f'"{entity_name}" technology partner',
                    f'"{entity_name}" platform',
                    f'"{entity_name}" digital platform',
                    f'"{entity_name}" membership platform',
                    f'"{entity_name}" events platform',
                    f'"{entity_name}" analytics',
                    f'"{entity_name}" digital transformation',
                    f'"{entity_name}" vendor',
                ]
            else:
                q3_expected = [
                    f'"{entity_name}" official website',
                    f'"{entity_name}" partner',
                    f'"{entity_name}" sponsor',
                    f'"{entity_name}" official partner',
                    f'"{entity_name}" broadcast partner',
                    f'"{entity_name}" broadcast rights',
                    f'"{entity_name}" media rights',
                    f'"{entity_name}" data partner',
                    f'"{entity_name}" analytics',
                    f'"{entity_name}" platform',
                    f'"{entity_name}" digital platform',
                    f'"{entity_name}" streaming platform',
                    f'"{entity_name}" mobile app',
                    f'"{entity_name}" digital transformation',
                    f'"{entity_name}" vendor',
                    f'"{entity_name}" procurement',
                ]
            assert payload["questions"][2]["question"] == (
                f"Is there evidence {entity_name} is buying, launching, or reshaping its commercial or digital ecosystem through procurement, partnerships, hiring, or platform initiatives?"
            )
            assert payload["questions"][2]["search_strategy"]["search_queries"] == q3_expected
        if payload["entity_id"] == "celtic-fc":
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
    if payload["entity_id"] == "international-canoe-federation":
        assert payload["questions"][2]["question_family"] == "tender_docs"
        assert payload["questions"][2]["question_type"] == "tender_docs"
        assert payload["questions"][2]["question"] == (
            "Are there explicit tender documents or RFPs for digital or broadcast procurement at International Canoe Federation?"
        )
        assert payload["questions"][2]["search_strategy"]["search_queries"] == [
            '"International Canoe Federation" tenders',
            '"International Canoe Federation" Paddle Worldwide digital ecosystem',
            '"International Canoe Federation" OTT platform',
            'site:canoeicf.com paddleworldwide_dxp_rfp.pdf',
            'site:canoeicf.com ott platform 2026 pdf',
            'site:canoeicf.com tenders',
        ]
    assert mlc["questions"][2]["query"] == '"Major League Cricket" official partner broadcast rights media rights data platform'
    assert mlc["questions"][2]["source_priority"] == [
        "official_site",
        "news",
        "press_release",
        "google_serp",
        "linkedin_posts",
    ]
    assert mlc["questions"][2]["search_strategy"]["search_queries"] == [
        '"Major League Cricket" official website',
        '"Major League Cricket" partner',
        '"Major League Cricket" sponsor',
        '"Major League Cricket" official partner',
        '"Major League Cricket" broadcast partner',
        '"Major League Cricket" broadcast rights',
        '"Major League Cricket" media rights',
        '"Major League Cricket" data partner',
        '"Major League Cricket" analytics',
        '"Major League Cricket" platform',
        '"Major League Cricket" digital platform',
        '"Major League Cricket" streaming platform',
        '"Major League Cricket" mobile app',
        '"Major League Cricket" digital transformation',
        '"Major League Cricket" vendor',
        '"Major League Cricket" procurement',
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
    assert arsenal["questions"][0]["query"] == '"Arsenal Football Club" official website founded year'
    assert arsenal["questions"][0]["search_strategy"]["search_queries"] == [
        '"Arsenal Football Club" official website',
        '"Arsenal Football Club" history',
        '"Arsenal Football Club" founded year',
        '"Arsenal Football Club" wikipedia',
    ]
    assert arsenal["questions"][2]["query"] == '"Arsenal Football Club" official partner commercial partner platform'
    assert arsenal["questions"][2]["source_priority"] == [
        "official_site",
        "press_release",
        "news",
        "google_serp",
        "linkedin_posts",
    ]
    assert arsenal["questions"][2]["search_strategy"]["search_queries"] == [
        '"Arsenal Football Club" official website',
        '"Arsenal Football Club" official partner',
        '"Arsenal Football Club" commercial partner',
        '"Arsenal Football Club" global partner',
        '"Arsenal Football Club" sponsorship',
        '"Arsenal Football Club" partnerships',
        '"Arsenal Football Club" technology partner',
        '"Arsenal Football Club" digital partner',
        '"Arsenal Football Club" fan engagement platform',
        '"Arsenal Football Club" data partner',
        '"Arsenal Football Club" mobile app',
        '"Arsenal Football Club" analytics initiative',
        '"Arsenal Football Club" broadcast partner',
        '"Arsenal Football Club" media rights',
        '"Arsenal Football Club" digital transformation',
        '"Arsenal Football Club" procurement',
    ]
    assert arsenal["questions"][3]["query"] == '"Arsenal Football Club" LinkedIn company profile'
    assert arsenal["questions"][3]["search_strategy"]["search_queries"] == [
        '"Arsenal Football Club" official website leadership team',
        '"Arsenal Football Club" executive committee',
        '"Arsenal Football Club" commercial leadership',
        '"Arsenal Football Club" partnerships team',
        '"Arsenal Football Club" sponsorship team',
        '"Arsenal Football Club" chief commercial officer',
        '"Arsenal Football Club" chief business officer',
        '"Arsenal Football Club" commercial director',
        '"Arsenal Football Club" global partnerships',
        '"Arsenal Football Club" business development director',
        '"Arsenal Football Club" chief marketing officer',
        '"Arsenal Football Club" LinkedIn company profile',
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
    assert icf["questions"][2]["query"] == '"International Canoe Federation" tenders'
    assert icf["questions"][2]["question_family"] == "tender_docs"
    assert icf["questions"][2]["question_type"] == "tender_docs"
    assert icf["questions"][2]["question"] == (
        "Are there explicit tender documents or RFPs for digital or broadcast procurement at International Canoe Federation?"
    )
    assert icf["questions"][2]["source_priority"] == [
        "official_site",
        "google_serp",
        "press_release",
        "news",
    ]
    assert icf["questions"][2]["search_strategy"]["search_queries"] == [
        '"International Canoe Federation" tenders',
        '"International Canoe Federation" Paddle Worldwide digital ecosystem',
        '"International Canoe Federation" OTT platform',
        'site:canoeicf.com paddleworldwide_dxp_rfp.pdf',
        'site:canoeicf.com ott platform 2026 pdf',
        'site:canoeicf.com tenders',
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
        '"Major League Cricket" official website',
        '"Major League Cricket" staff',
        '"Major League Cricket" leadership team',
        '"Major League Cricket" partnerships',
        '"Major League Cricket" sponsorship',
        '"Major League Cricket" business operations',
        '"Major League Cricket" commissioner',
        '"Major League Cricket" chief commercial officer',
        '"Major League Cricket" head of partnerships',
        '"Major League Cricket" business development',
        '"Major League Cricket" commercial director',
    ]
    assert mlc["questions"][3]["query"] == '"Major League Cricket" LinkedIn company profile'
    assert mlc["questions"][3]["search_strategy"]["search_queries"][0] == (
        '"Major League Cricket" official website'
    )
    assert '"Major League Cricket" head of partnerships' in mlc["questions"][3]["search_strategy"]["search_queries"]
    assert mlc["questions"][4]["question"] == (
        "Which 3 to 5 people are the most relevant commercial, partnerships, or business development contacts at Major League Cricket?"
    )
    assert mlc["questions"][4]["question_type"] == "related_pois"
    premier = build_universal_atomic_question_source(
        entity_type="SPORT_LEAGUE",
        entity_name="Premier League",
        entity_id="premier-league",
        preset="premier-league-atomic-matrix",
    )
    nwsl = build_universal_atomic_question_source(
        entity_type="SPORT_LEAGUE",
        entity_name="National Women's Soccer League",
        entity_id="nwsl",
        preset="nwsl-atomic-matrix",
    )
    assert premier["questions"][2]["search_strategy"]["search_queries"] == [
        '"Premier League" official website',
        '"Premier League" official partner',
        '"Premier League" sponsor',
        '"Premier League" broadcast partner',
        '"Premier League" broadcast rights',
        '"Premier League" media rights',
        '"Premier League" data partner',
        '"Premier League" analytics partner',
        '"Premier League" technology partner',
        '"Premier League" streaming platform',
        '"Premier League" digital platform',
        '"Premier League" mobile app',
        '"Premier League" digital transformation',
        '"Premier League" vendor',
        '"Premier League" procurement',
    ]
    assert nwsl["questions"][2]["search_strategy"]["search_queries"] == [
        "\"National Women's Soccer League\" official website",
        "\"National Women's Soccer League\" partner",
        "\"National Women's Soccer League\" official partner",
        "\"National Women's Soccer League\" sponsorship",
        "\"National Women's Soccer League\" business operations",
        "\"National Women's Soccer League\" fan engagement",
        "\"National Women's Soccer League\" digital platform",
        "\"National Women's Soccer League\" streaming platform",
        "\"National Women's Soccer League\" mobile app",
        "\"National Women's Soccer League\" data platform",
        "\"National Women's Soccer League\" analytics",
        "\"National Women's Soccer League\" technology partner",
        "\"National Women's Soccer League\" digital transformation",
        "\"National Women's Soccer League\" vendor",
        "\"National Women's Soccer League\" procurement",
    ]
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


def test_q4_decision_owner_uses_surface_specific_queries_and_priorities():
    barcelona = build_universal_atomic_question_source(
        entity_type="SPORT_CLUB",
        entity_name="FC Barcelona",
        entity_id="fc-barcelona",
        preset="fc-barcelona-atomic-matrix",
    )
    celtic = build_universal_atomic_question_source(
        entity_type="SPORT_CLUB",
        entity_name="Celtic FC",
        entity_id="celtic-fc",
        preset="celtic-fc-atomic-matrix",
    )
    bundesliga = build_universal_atomic_question_source(
        entity_type="SPORT_LEAGUE",
        entity_name="Bundesliga",
        entity_id="bundesliga",
        preset="bundesliga-atomic-matrix",
    )
    mls = build_universal_atomic_question_source(
        entity_type="SPORT_LEAGUE",
        entity_name="Major League Soccer",
        entity_id="mls",
        preset="mls-atomic-matrix",
    )
    fifa = build_universal_atomic_question_source(
        entity_type="SPORT_FEDERATION",
        entity_name="FIFA",
        entity_id="fifa",
        preset="fifa-atomic-matrix",
    )
    fis = build_universal_atomic_question_source(
        entity_type="SPORT_FEDERATION",
        entity_name="International Ski and Snowboard Federation",
        entity_id="fis",
        preset="fis-atomic-matrix",
    )

    def q4(payload: dict) -> dict:
        return next(question for question in payload["questions"] if question["question_id"] == "q4_decision_owner")

    assert q4(barcelona)["source_priority"] == [
        "official_site",
        "news",
        "press_release",
        "google_serp",
        "linkedin_company_profile",
        "linkedin_people_search",
        "linkedin_person_profile",
    ]
    assert q4(barcelona)["search_strategy"]["search_queries"] == [
        '"FC Barcelona" official website leadership team',
        '"FC Barcelona" executive committee',
        '"FC Barcelona" commercial leadership',
        '"FC Barcelona" partnerships team',
        '"FC Barcelona" sponsorship team',
        '"FC Barcelona" chief commercial officer',
        '"FC Barcelona" chief business officer',
        '"FC Barcelona" commercial director',
        '"FC Barcelona" global partnerships',
        '"FC Barcelona" business development director',
        '"FC Barcelona" chief marketing officer',
        '"FC Barcelona" LinkedIn company profile',
    ]

    assert q4(celtic)["search_strategy"]["search_queries"] == [
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

    assert q4(bundesliga)["search_strategy"]["search_queries"] == [
        '"Bundesliga" official website leadership team',
        '"Bundesliga" management board',
        '"Bundesliga" commercial team',
        '"Bundesliga" partnerships',
        '"Bundesliga" media rights',
        '"Bundesliga" sponsorship',
        '"Bundesliga" chief commercial officer',
        '"Bundesliga" managing director commercial',
        '"Bundesliga" vice president commercial',
        '"Bundesliga" business development director',
        '"Bundesliga" head of partnerships',
    ]

    assert q4(mls)["source_priority"] == [
        "official_site",
        "google_serp",
        "news",
        "press_release",
        "linkedin_company_profile",
        "linkedin_people_search",
        "linkedin_person_profile",
    ]
    assert q4(mls)["search_strategy"]["search_queries"] == [
        '"Major League Soccer" official website',
        '"Major League Soccer" staff',
        '"Major League Soccer" leadership team',
        '"Major League Soccer" partnerships',
        '"Major League Soccer" sponsorship',
        '"Major League Soccer" business operations',
        '"Major League Soccer" commissioner',
        '"Major League Soccer" chief commercial officer',
        '"Major League Soccer" head of partnerships',
        '"Major League Soccer" business development',
        '"Major League Soccer" commercial director',
    ]

    assert q4(fifa)["search_strategy"]["search_queries"] == [
        '"FIFA" official website leadership team',
        '"FIFA" management team',
        '"FIFA" commercial and sponsorship',
        '"FIFA" partnerships',
        '"FIFA" media rights',
        '"FIFA" broadcast',
        '"FIFA" marketing director',
        '"FIFA" chief marketing officer',
        '"FIFA" head of partnerships',
        '"FIFA" commercial director',
        '"FIFA" secretary general',
    ]

    assert q4(fis)["search_strategy"]["search_queries"] == [
        '"International Ski and Snowboard Federation" official website leadership team',
        '"International Ski and Snowboard Federation" secretariat',
        '"International Ski and Snowboard Federation" marketing director',
        '"International Ski and Snowboard Federation" communications director',
        '"International Ski and Snowboard Federation" partnerships manager',
        '"International Ski and Snowboard Federation" broadcast director',
        '"International Ski and Snowboard Federation" media rights',
        '"International Ski and Snowboard Federation" tv broadcast marketing',
        '"International Ski and Snowboard Federation" commercial manager',
        '"International Ski and Snowboard Federation" secretary general',
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
                '"Major League Cricket" official website',
                '"Major League Cricket" partner',
                '"Major League Cricket" sponsor',
                '"Major League Cricket" official partner',
                '"Major League Cricket" broadcast partner',
                '"Major League Cricket" broadcast rights',
                '"Major League Cricket" media rights',
                '"Major League Cricket" data partner',
                '"Major League Cricket" analytics',
                '"Major League Cricket" platform',
                '"Major League Cricket" digital platform',
                '"Major League Cricket" streaming platform',
                '"Major League Cricket" mobile app',
                '"Major League Cricket" digital transformation',
                '"Major League Cricket" vendor',
                '"Major League Cricket" procurement',
            ]
            assert payload["questions"][3]["query"] == '"Major League Cricket" LinkedIn company profile'
            assert payload["questions"][3]["search_strategy"]["search_queries"][0] == (
                '"Major League Cricket" official website'
            )
            assert '"Major League Cricket" chief commercial officer' in payload["questions"][3]["search_strategy"]["search_queries"]
            assert '"Major League Cricket" head of partnerships' in payload["questions"][3]["search_strategy"]["search_queries"]
            assert payload["questions"][4]["question"] == (
                "Which 3 to 5 people are the most relevant commercial, partnerships, or business development contacts at Major League Cricket?"
            )
            assert payload["questions"][4]["question_type"] == "related_pois"
            assert payload["questions"][4]["search_strategy"]["search_queries"][0] == (
                '"Major League Cricket" LinkedIn company profile'
            )
        assert payload["questions"] == expected["questions"]
