#!/usr/bin/env python3
"""Universal atomic question matrix for archetype and scale-out runs.

The atomic discovery pipeline uses one question family matrix across every
entity. Only the entity name/id/type change; the strategy stays fixed.
"""

from __future__ import annotations

import json
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


QUESTION_TIMEOUT_MS = 180000
HOP_TIMEOUT_MS = 180000
HOP_BUDGET = 8
EVIDENCE_EXTENSION_CONFIDENCE_THRESHOLD = 0.65

DECISION_OWNER_SOURCE_PRIORITY = [
    "linkedin_company_profile",
    "linkedin_people_search",
    "linkedin_person_profile",
    "google_serp",
    "official_site",
]

DECISION_OWNER_SOURCE_PRIORITY_BROAD = [
    "google_serp",
    "official_site",
    "news",
    "press_release",
    "linkedin_company_profile",
    "linkedin_people_search",
    "linkedin_person_profile",
]

DECISION_OWNER_SOURCE_PRIORITY_OFFICIAL_FIRST = [
    "official_site",
    "news",
    "press_release",
    "google_serp",
    "linkedin_company_profile",
    "linkedin_people_search",
    "linkedin_person_profile",
]

DECISION_OWNER_SOURCE_PRIORITY_OPERATIONS_FIRST = [
    "official_site",
    "google_serp",
    "news",
    "press_release",
    "linkedin_company_profile",
    "linkedin_people_search",
    "linkedin_person_profile",
]

DECISION_OWNER_SEARCH_QUERIES_CLUB = [
    '"{entity}" LinkedIn company profile',
    '"{entity}" front office staff',
    '"{entity}" leadership team',
    '"{entity}" commercial team',
    '"{entity}" partnerships',
    '"{entity}" sponsorship',
    '"{entity}" chief business officer',
    '"{entity}" chief commercial officer',
    '"{entity}" commercial director',
    '"{entity}" head of partnerships',
    '"{entity}" business development director',
    '"{entity}" CEO',
]

DECISION_OWNER_SEARCH_QUERIES_GLOBAL_ELITE_CLUB = [
    '"{entity}" official website leadership team',
    '"{entity}" executive committee',
    '"{entity}" commercial leadership',
    '"{entity}" partnerships team',
    '"{entity}" sponsorship team',
    '"{entity}" chief commercial officer',
    '"{entity}" chief business officer',
    '"{entity}" commercial director',
    '"{entity}" global partnerships',
    '"{entity}" business development director',
    '"{entity}" chief marketing officer',
    '"{entity}" LinkedIn company profile',
]

DECISION_OWNER_SEARCH_QUERIES_WEAKER_PUBLIC_SURFACE_CLUB = [
    '"{entity}" official website',
    '"{entity}" leadership team',
    '"{entity}" commercial team',
    '"{entity}" club partners',
    '"{entity}" partnerships manager',
    '"{entity}" sponsorship manager',
    '"{entity}" marketing director',
    '"{entity}" head of partnerships',
    '"{entity}" commercial director',
    '"{entity}" fan engagement',
    '"{entity}" business development director',
]

DECISION_OWNER_SEARCH_QUERIES_LEAGUE = [
    '"{entity}" LinkedIn company profile',
    '"{entity}" leadership team',
    '"{entity}" commercial team',
    '"{entity}" partnerships',
    '"{entity}" sponsorship',
    '"{entity}" chief business officer',
    '"{entity}" vice president commercial',
    '"{entity}" chief commercial officer',
    '"{entity}" commercial director',
    '"{entity}" head of partnerships',
    '"{entity}" business development director',
    '"{entity}" CEO',
]

DECISION_OWNER_SEARCH_QUERIES_TOP_COMMERCIAL_LEAGUE = [
    '"{entity}" official website leadership team',
    '"{entity}" management board',
    '"{entity}" commercial team',
    '"{entity}" partnerships',
    '"{entity}" media rights',
    '"{entity}" sponsorship',
    '"{entity}" chief commercial officer',
    '"{entity}" managing director commercial',
    '"{entity}" vice president commercial',
    '"{entity}" business development director',
    '"{entity}" head of partnerships',
]

DECISION_OWNER_SEARCH_QUERIES_DEVELOPING_LEAGUE = [
    '"{entity}" official website',
    '"{entity}" staff',
    '"{entity}" leadership team',
    '"{entity}" partnerships',
    '"{entity}" sponsorship',
    '"{entity}" business operations',
    '"{entity}" commissioner',
    '"{entity}" chief commercial officer',
    '"{entity}" head of partnerships',
    '"{entity}" business development',
    '"{entity}" commercial director',
]

DECISION_OWNER_SEARCH_QUERIES_FEDERATION = [
    '"{entity}" LinkedIn company profile',
    '"{entity}" LinkedIn commercial',
    '"{entity}" LinkedIn sponsorship',
    '"{entity}" LinkedIn marketing',
    '"{entity}" LinkedIn broadcast',
    '"{entity}" LinkedIn media rights',
    '"{entity}" head of commercial and sponsorship',
    '"{entity}" director of tv broadcast marketing',
    '"{entity}" broadcast marketing director',
    '"{entity}" marketing director',
    '"{entity}" secretary general',
]

DECISION_OWNER_SEARCH_QUERIES_COMMERCIAL_GLOBAL_FEDERATION = [
    '"{entity}" official website leadership team',
    '"{entity}" management team',
    '"{entity}" commercial and sponsorship',
    '"{entity}" partnerships',
    '"{entity}" media rights',
    '"{entity}" broadcast',
    '"{entity}" marketing director',
    '"{entity}" chief marketing officer',
    '"{entity}" head of partnerships',
    '"{entity}" commercial director',
    '"{entity}" secretary general',
]

DECISION_OWNER_SEARCH_QUERIES_TECHNICAL_TENDER_FEDERATION = [
    '"{entity}" official website leadership team',
    '"{entity}" secretariat',
    '"{entity}" marketing director',
    '"{entity}" communications director',
    '"{entity}" partnerships manager',
    '"{entity}" broadcast director',
    '"{entity}" media rights',
    '"{entity}" tv broadcast marketing',
    '"{entity}" commercial manager',
    '"{entity}" secretary general',
]

RELATED_POIS_SEARCH_QUERIES_CLUB = [
    '"{entity}" LinkedIn company profile',
    '"{entity}" LinkedIn commercial',
    '"{entity}" LinkedIn partnerships',
    '"{entity}" LinkedIn sponsorship',
    '"{entity}" LinkedIn business development',
    '"{entity}" LinkedIn marketing',
    '"{entity}" chief commercial officer',
    '"{entity}" commercial director',
    '"{entity}" partnerships director',
    '"{entity}" sponsorship director',
    '"{entity}" head of partnerships',
    '"{entity}" CEO',
]

RELATED_POIS_SEARCH_QUERIES_LEAGUE = [
    '"{entity}" LinkedIn company profile',
    '"{entity}" LinkedIn commercial',
    '"{entity}" LinkedIn sponsorship',
    '"{entity}" LinkedIn partnerships',
    '"{entity}" LinkedIn revenue',
    '"{entity}" LinkedIn marketing',
    '"{entity}" vice president commercial',
    '"{entity}" chief commercial officer',
    '"{entity}" partnerships director',
    '"{entity}" sponsorship director',
    '"{entity}" CEO',
]

RELATED_POIS_SEARCH_QUERIES_FEDERATION = [
    '"{entity}" LinkedIn company profile',
    '"{entity}" LinkedIn commercial',
    '"{entity}" LinkedIn sponsorship',
    '"{entity}" LinkedIn marketing',
    '"{entity}" LinkedIn broadcast',
    '"{entity}" LinkedIn media rights',
    '"{entity}" head of commercial and sponsorship',
    '"{entity}" director of tv broadcast marketing',
    '"{entity}" digital product owner',
    '"{entity}" marketing director',
    '"{entity}" secretary general',
]

Q2_DIGITAL_STACK_SEARCH_QUERIES_CLUB = [
    '"{entity}" technology stack',
    '"{entity}" tech stack',
    '"{entity}" digital stack',
    '"{entity}" official website',
    '"{entity}" digital experience',
    '"{entity}" case study',
    '"{entity}" official partner',
    '"{entity}" digital partner',
    '"{entity}" technology partner',
    '"{entity}" platform',
    '"{entity}" app',
    '"{entity}" mobile app',
    '"{entity}" CRM',
    '"{entity}" ticketing platform',
    '"{entity}" ecommerce',
    '"{entity}" analytics platform',
]

Q2_DIGITAL_STACK_SEARCH_QUERIES_LEAGUE = [
    '"{entity}" technology stack',
    '"{entity}" tech stack',
    '"{entity}" digital stack',
    '"{entity}" official website',
    '"{entity}" digital experience',
    '"{entity}" CRM',
    '"{entity}" analytics platform',
    '"{entity}" ticketing platform',
    '"{entity}" ecommerce',
    '"{entity}" mobile app',
    '"{entity}" technology partner',
    '"{entity}" digital partner',
    '"{entity}" official partner',
    '"{entity}" case study',
    '"{entity}" platform',
    '"{entity}" app',
]

Q2_DIGITAL_STACK_SEARCH_QUERIES_FEDERATION = [
    '"{entity}" technology stack',
    '"{entity}" tech stack',
    '"{entity}" digital stack',
    '"{entity}" official website',
    '"{entity}" digital experience',
    '"{entity}" events platform',
    '"{entity}" membership platform',
    '"{entity}" results platform',
    '"{entity}" rankings platform',
    '"{entity}" athlete app',
    '"{entity}" mobile app',
    '"{entity}" broadcast partner',
    '"{entity}" technology partner',
    '"{entity}" digital partner',
    '"{entity}" official partner',
    '"{entity}" case study',
    '"{entity}" platform',
    '"{entity}" app',
]

Q1_FOUNDATION_SEARCH_QUERIES_DEFAULT = [
    '"{entity}" founded year',
    '"{entity}" official website',
    '"{entity}" wikipedia',
]

Q1_FOUNDATION_SEARCH_QUERIES_CLUB = [
    '"{entity}" official website',
    '"{entity}" history',
    '"{entity}" founded year',
    '"{entity}" wikipedia',
]

Q3_PROCUREMENT_SEARCH_QUERIES_CLUB = [
    '"{entity}" official website',
    '"{entity}" partner',
    '"{entity}" sponsor',
    '"{entity}" official partner',
    '"{entity}" commercial partner',
    '"{entity}" digital partner',
    '"{entity}" technology partner',
    '"{entity}" partnership announcement',
    '"{entity}" sponsorship opportunities',
    '"{entity}" platform',
    '"{entity}" mobile app',
    '"{entity}" hiring digital',
    '"{entity}" hiring analytics',
    '"{entity}" analytics initiative',
    '"{entity}" broadcast partner',
    '"{entity}" vendor',
    '"{entity}" RFP',
    '"{entity}" tender',
    '"{entity}" procurement',
]

Q3_PROCUREMENT_SEARCH_QUERIES_LEAGUE = [
    '"{entity}" official website',
    '"{entity}" partner',
    '"{entity}" sponsor',
    '"{entity}" official partner',
    '"{entity}" broadcast partner',
    '"{entity}" broadcast rights',
    '"{entity}" media rights',
    '"{entity}" data partner',
    '"{entity}" analytics',
    '"{entity}" platform',
    '"{entity}" digital platform',
    '"{entity}" streaming platform',
    '"{entity}" mobile app',
    '"{entity}" digital transformation',
    '"{entity}" vendor',
    '"{entity}" procurement',
]

Q3_PROCUREMENT_SEARCH_QUERIES_FEDERATION = [
    '"{entity}" official website',
    '"{entity}" procurement',
    '"{entity}" tender',
    '"{entity}" request for proposal',
    '"{entity}" broadcast services',
    '"{entity}" OTT platform',
    '"{entity}" partner',
    '"{entity}" sponsor',
    '"{entity}" digital ecosystem',
    '"{entity}" digital platform',
    '"{entity}" analytics',
    '"{entity}" membership platform',
    '"{entity}" events platform',
    '"{entity}" results platform',
    '"{entity}" vendor',
]

Q3_PROCUREMENT_SOURCE_PRIORITY_CLUB = [
    "official_site",
    "press_release",
    "news",
    "google_serp",
    "linkedin_posts",
]

Q3_PROCUREMENT_SOURCE_PRIORITY_LEAGUE = [
    "official_site",
    "news",
    "press_release",
    "google_serp",
    "linkedin_posts",
]

Q3_PROCUREMENT_SOURCE_PRIORITY_FEDERATION = [
    "official_site",
    "press_release",
    "news",
    "google_serp",
]

UNIVERSAL_ATOMIC_QUESTION_SPECS: List[Dict[str, Any]] = [
    {
        "question_id": "q1_foundation",
        "question_family": "foundation",
        "question_type": "foundation",
        "question": "What year was {entity} founded?",
        "query": '"{entity}" founded year',
        "hop_budget": HOP_BUDGET,
        "evidence_extension_budget": 1,
        "source_priority": [
            "google_serp",
            "official_site",
            "wikipedia",
        ],
        "search_strategy": {
            "search_queries": Q1_FOUNDATION_SEARCH_QUERIES_DEFAULT,
        },
        "evidence_focus": "entity_fact",
        "promotion_target": "profile",
        "answer_kind": "fact",
    },
    {
        "question_id": "q2_digital_stack",
        "question_family": "digital_stack",
        "question_type": "digital_stack",
        "question": "What visible technologies, platforms, or vendors does {entity} use, and what do they imply commercially?",
        "query": '"{entity}" technology stack',
        "hop_budget": HOP_BUDGET,
        "evidence_extension_budget": 2,
        "source_priority": [
            "apify_techstack",
            "google_serp",
            "news",
            "press_release",
            "official_site",
        ],
        "search_strategy": {
            "search_queries": [
                '"{entity}" technology stack',
                '"{entity}" tech stack',
                '"{entity}" digital stack',
                '"{entity}" CRM',
                '"{entity}" analytics platform',
                '"{entity}" ticketing platform',
                '"{entity}" ecommerce',
                '"{entity}" mobile app',
                '"{entity}" technology partner',
                '"{entity}" digital partner',
                '"{entity}" official partner',
                '"{entity}" case study',
                '"{entity}" platform',
                '"{entity}" app',
            ]
        },
        "deterministic_tools": ["apify_techstack"],
        "fallback_to_retrieval": True,
        "deterministic_input": {
            "source_question_id": "q1_foundation",
            "official_site_only": True,
        },
        "evidence_focus": "technology_stack",
        "promotion_target": "technology_stack",
        "answer_kind": "signal",
    },
    {
        "question_id": "q3_procurement_signal",
        "question_family": "procurement",
        "question_type": "procurement",
        "question": "Is there evidence {entity} is buying, launching, or reshaping its commercial or digital ecosystem through procurement, partnerships, hiring, or platform initiatives?",
        "query": '"{entity}" RFP tender procurement partner sponsor hiring platform analytics broadcast vendor',
        "hop_budget": HOP_BUDGET,
        "evidence_extension_budget": 2,
        "source_priority": [
            "google_serp",
            "linkedin_posts",
            "news",
            "press_release",
            "official_site",
        ],
        "search_strategy": {
            "search_queries": Q3_PROCUREMENT_SEARCH_QUERIES_CLUB,
        },
        "evidence_focus": "opportunity_signal",
        "promotion_target": "opportunity_signals",
        "answer_kind": "signal",
    },
    {
        "question_id": "q4_decision_owner",
        "question_family": "decision_owner",
        "question_type": "decision_owner",
        "question": "Who is the most suitable person for commercial partnerships or business development at {entity}?",
        "query": '"{entity}" LinkedIn company profile',
        "hop_budget": HOP_BUDGET,
        "evidence_extension_budget": 2,
        "source_priority": DECISION_OWNER_SOURCE_PRIORITY,
        "search_strategy": {
            "search_queries": DECISION_OWNER_SEARCH_QUERIES_CLUB,
        },
        "evidence_focus": "decision_owner",
        "promotion_target": "decision_owners",
        "answer_kind": "person",
    },
    {
        "question_id": "q5_related_pois",
        "question_family": "related_pois",
        "question_type": "related_pois",
        "question": "Which 3 to 5 people are the most relevant commercial, partnerships, or business development contacts at {entity}?",
        "query": '"{entity}" LinkedIn company profile',
        "hop_budget": HOP_BUDGET,
        "evidence_extension_budget": 2,
        "source_priority": DECISION_OWNER_SOURCE_PRIORITY,
        "search_strategy": {
            "search_queries": RELATED_POIS_SEARCH_QUERIES_CLUB,
        },
        "evidence_focus": "decision_owner",
        "promotion_target": "decision_owners",
        "answer_kind": "people_list",
    },
]

MLC_ENTITY_ID = "major-league-cricket"
ICF_ENTITY_ID = "international-canoe-federation"
CELTIC_ENTITY_ID = "celtic-fc"
GLOBAL_ELITE_CLUB_ENTITY_IDS = {
    "arsenal",
    "arsenal-fc",
    "bayern-munich",
    "fc-barcelona",
    "inter-miami-cf",
    "juventus",
    "manchester-city",
    "psg",
    "real-madrid-cf",
}
WEAKER_PUBLIC_SURFACE_CLUB_ENTITY_IDS = {
    "celtic-fc",
    "leeds-united",
}
TOP_COMMERCIAL_LEAGUE_ENTITY_IDS = {
    "bundesliga",
    "formula-1",
    "premier-league",
}
DEVELOPING_OR_FRAGMENTED_LEAGUE_ENTITY_IDS = {
    "major-league-cricket",
    "mls",
    "nwsl",
    "wsl",
}
COMMERCIAL_GLOBAL_FEDERATION_ENTITY_IDS = {
    "ecb",
    "fiba",
    "fifa",
    "uefa",
    "world-athletics",
    "world-rugby",
}
TECHNICAL_TENDER_FEDERATION_ENTITY_IDS = {
    "fis",
    "icf",
    ICF_ENTITY_ID,
}
MLC_QUESTION_OVERRIDES: Dict[str, Dict[str, Any]] = {
    "q1_foundation": {
        "query": '"{entity}" official website founded year',
        "search_strategy": {
            "search_queries": [
                '"{entity}" official website',
                '"{entity}" founded year',
                '"{entity}" wikipedia',
            ]
        },
    },
    "q2_digital_stack": {
        "query": '"{entity}" official website',
        "search_strategy": {
            "search_queries": [
                '"{entity}" official website',
                '"{entity}" technology stack',
                '"{entity}" tech stack',
                '"{entity}" digital stack',
                '"{entity}" digital experience',
                '"{entity}" CRM',
                '"{entity}" analytics platform',
                '"{entity}" ticketing platform',
                '"{entity}" ecommerce',
                '"{entity}" mobile app',
                '"{entity}" technology partner',
                '"{entity}" digital partner',
                '"{entity}" official partner',
                '"{entity}" case study',
                '"{entity}" platform',
                '"{entity}" app',
            ]
        },
    },
    "q3_procurement_signal": {
        "query": '"{entity}" official partner broadcast rights media rights data platform',
        "source_priority": Q3_PROCUREMENT_SOURCE_PRIORITY_LEAGUE,
        "search_strategy": {
            "search_queries": [
                '"{entity}" official website',
                '"{entity}" partner',
                '"{entity}" sponsor',
                '"{entity}" official partner',
                '"{entity}" broadcast partner',
                '"{entity}" broadcast rights',
                '"{entity}" media rights',
                '"{entity}" data partner',
                '"{entity}" analytics',
                '"{entity}" platform',
                '"{entity}" digital platform',
                '"{entity}" streaming platform',
                '"{entity}" mobile app',
                '"{entity}" digital transformation',
                '"{entity}" vendor',
                '"{entity}" procurement',
            ]
        },
    },
}

ICF_QUESTION_OVERRIDES: Dict[str, Dict[str, Any]] = {
    "q3_procurement_signal": {
        "question_family": "tender_docs",
        "question_type": "tender_docs",
        "question": "Are there explicit tender documents or RFPs for digital or broadcast procurement at {entity}?",
        "query": '"{entity}" tenders',
        "source_priority": [
            "official_site",
            "google_serp",
            "press_release",
            "news",
        ],
        "search_strategy": {
            "search_queries": [
                '"{entity}" tenders',
                '"{entity}" Paddle Worldwide digital ecosystem',
                '"{entity}" OTT platform',
                'site:canoeicf.com paddleworldwide_dxp_rfp.pdf',
                'site:canoeicf.com ott platform 2026 pdf',
                'site:canoeicf.com tenders',
            ]
        },
    },
    "q4_decision_owner": {
        "question": "Who is the most suitable senior commercial owner for sponsorship, broadcast, media rights, or marketing at {entity}?",
        "hop_budget": 6,
        "evidence_extension_budget": 1,
        "search_strategy": {
            "search_queries": [
                '"{entity}" LinkedIn company profile',
                '"{entity}" commercial and sponsorship',
                '"{entity}" broadcast marketing',
                '"{entity}" media rights',
                '"{entity}" marketing director',
                '"{entity}" commercial manager',
                '"{entity}" sponsorship manager',
                '"{entity}" director of tv broadcast marketing',
            ]
        },
    },
}

CELTIC_QUESTION_OVERRIDES: Dict[str, Dict[str, Any]] = {
    "q1_foundation": {
        "query": '"Celtic Football Club" official website founded year',
        "search_strategy": {
            "search_queries": [
                '"Celtic Football Club" official website',
                '"Celtic Football Club" history',
                '"Celtic Football Club" founded year',
                '"Celtic Football Club" wikipedia',
            ]
        },
    },
    "q3_procurement_signal": {
        "question": "Is there evidence Celtic Football Club is buying, launching, or reshaping its commercial or digital ecosystem through sponsorship, partnerships, hiring, or platform initiatives?",
        "query": '"Celtic Football Club" commercial partnership',
        "source_priority": [
            "official_site",
            "press_release",
            "news",
            "google_serp",
        ],
        "search_strategy": {
            "search_queries": [
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
        },
    },
    "q4_decision_owner": {
        "question": "Who is the most suitable person for commercial partnerships or business development at {entity}?",
        "query": '"Celtic Football Club" leadership team',
        "search_strategy": {
            "search_queries": [
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
        },
    },
    "q5_related_pois": {
        "query": '"Celtic Football Club" leadership team',
        "search_strategy": {
            "search_queries": [
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
        },
    },
}


def _slugify(value: str) -> str:
    slug = "".join(ch.lower() if ch.isalnum() else "-" for ch in str(value or "").strip())
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug.strip("-") or "entity"


def _decision_owner_surface(entity_type: str, entity_id: str) -> str:
    entity_type_key = _slugify(entity_type)
    entity_id_key = _slugify(entity_id)
    if entity_id_key in GLOBAL_ELITE_CLUB_ENTITY_IDS:
        return "global_elite_club"
    if entity_id_key in WEAKER_PUBLIC_SURFACE_CLUB_ENTITY_IDS:
        return "weaker_public_surface_club"
    if entity_id_key in TOP_COMMERCIAL_LEAGUE_ENTITY_IDS:
        return "top_commercial_league"
    if entity_id_key in DEVELOPING_OR_FRAGMENTED_LEAGUE_ENTITY_IDS:
        return "developing_or_fragmented_league"
    if entity_id_key in COMMERCIAL_GLOBAL_FEDERATION_ENTITY_IDS:
        return "commercial_global_federation"
    if entity_id_key in TECHNICAL_TENDER_FEDERATION_ENTITY_IDS:
        return "technical_tender_federation"
    if entity_type_key == "sport-club":
        return "global_elite_club"
    if entity_type_key == "sport-league":
        return "top_commercial_league"
    if entity_type_key == "sport-federation":
        return "commercial_global_federation"
    return "generic"


def _render_question_spec(spec: Dict[str, Any], entity_name: str, entity_id: str, entity_type: str) -> Dict[str, Any]:
    rendered = deepcopy(spec)
    rendered["question"] = str(rendered["question"]).format(entity=entity_name)
    rendered["query"] = str(rendered["query"]).format(entity=entity_name)
    if "search_strategy" in rendered:
        search_strategy = deepcopy(rendered["search_strategy"])
        search_queries = [
            str(query).format(entity=entity_name)
            for query in search_strategy.get("search_queries", [])
        ]
        if rendered.get("question_id") == "q1_foundation":
            entity_type_key = _slugify(entity_type)
            if entity_type_key == "sport-club":
                rendered["query"] = f'"{entity_name}" official website founded year'
                search_queries = [
                    str(query).format(entity=entity_name)
                    for query in Q1_FOUNDATION_SEARCH_QUERIES_CLUB
                ]
        if rendered.get("question_id") == "q2_digital_stack":
            entity_type_key = _slugify(entity_type)
            if entity_type_key == "sport-club":
                search_queries = [
                    str(query).format(entity=entity_name)
                    for query in Q2_DIGITAL_STACK_SEARCH_QUERIES_CLUB
                ]
            elif entity_type_key == "sport-league":
                search_queries = [
                    str(query).format(entity=entity_name)
                    for query in Q2_DIGITAL_STACK_SEARCH_QUERIES_LEAGUE
                ]
            elif entity_type_key == "sport-federation":
                search_queries = [
                    str(query).format(entity=entity_name)
                    for query in Q2_DIGITAL_STACK_SEARCH_QUERIES_FEDERATION
                ]
        if rendered.get("question_id") == "q3_procurement_signal":
            entity_type_key = _slugify(entity_type)
            if entity_type_key == "sport-club":
                rendered["query"] = f'"{entity_name}" official partner commercial partner platform'
                rendered["source_priority"] = Q3_PROCUREMENT_SOURCE_PRIORITY_CLUB
                search_queries = [
                    str(query).format(entity=entity_name)
                    for query in Q3_PROCUREMENT_SEARCH_QUERIES_CLUB
                ]
            elif entity_type_key == "sport-league":
                rendered["query"] = f'"{entity_name}" official partner broadcast rights media rights data platform'
                rendered["source_priority"] = Q3_PROCUREMENT_SOURCE_PRIORITY_LEAGUE
                search_queries = [
                    str(query).format(entity=entity_name)
                    for query in Q3_PROCUREMENT_SEARCH_QUERIES_LEAGUE
                ]
            elif entity_type_key == "sport-federation":
                rendered["query"] = f'"{entity_name}" procurement tender request for proposal digital ecosystem platform'
                rendered["source_priority"] = Q3_PROCUREMENT_SOURCE_PRIORITY_FEDERATION
                search_queries = [
                    str(query).format(entity=entity_name)
                    for query in Q3_PROCUREMENT_SEARCH_QUERIES_FEDERATION
                ]
        if rendered.get("question_id") in {"q4_decision_owner", "q5_related_pois"}:
            entity_type_key = _slugify(entity_type)
            decision_owner_surface = _decision_owner_surface(entity_type, entity_id)
            if rendered.get("question_id") == "q4_decision_owner":
                if decision_owner_surface == "global_elite_club":
                    rendered["source_priority"] = DECISION_OWNER_SOURCE_PRIORITY_OFFICIAL_FIRST
                    query_set = DECISION_OWNER_SEARCH_QUERIES_GLOBAL_ELITE_CLUB
                elif decision_owner_surface == "weaker_public_surface_club":
                    rendered["source_priority"] = DECISION_OWNER_SOURCE_PRIORITY_OPERATIONS_FIRST
                    query_set = DECISION_OWNER_SEARCH_QUERIES_WEAKER_PUBLIC_SURFACE_CLUB
                elif decision_owner_surface == "top_commercial_league":
                    rendered["source_priority"] = DECISION_OWNER_SOURCE_PRIORITY_OFFICIAL_FIRST
                    query_set = DECISION_OWNER_SEARCH_QUERIES_TOP_COMMERCIAL_LEAGUE
                elif decision_owner_surface == "developing_or_fragmented_league":
                    rendered["source_priority"] = DECISION_OWNER_SOURCE_PRIORITY_OPERATIONS_FIRST
                    query_set = DECISION_OWNER_SEARCH_QUERIES_DEVELOPING_LEAGUE
                elif decision_owner_surface == "commercial_global_federation":
                    rendered["source_priority"] = DECISION_OWNER_SOURCE_PRIORITY_OFFICIAL_FIRST
                    query_set = DECISION_OWNER_SEARCH_QUERIES_COMMERCIAL_GLOBAL_FEDERATION
                elif decision_owner_surface == "technical_tender_federation":
                    rendered["source_priority"] = DECISION_OWNER_SOURCE_PRIORITY_OFFICIAL_FIRST
                    query_set = DECISION_OWNER_SEARCH_QUERIES_TECHNICAL_TENDER_FEDERATION
                elif entity_type_key == "sport-club":
                    rendered["source_priority"] = DECISION_OWNER_SOURCE_PRIORITY_BROAD
                    query_set = DECISION_OWNER_SEARCH_QUERIES_CLUB
                elif entity_type_key == "sport-league":
                    rendered["source_priority"] = DECISION_OWNER_SOURCE_PRIORITY_BROAD
                    query_set = DECISION_OWNER_SEARCH_QUERIES_LEAGUE
                elif entity_type_key == "sport-federation":
                    query_set = DECISION_OWNER_SEARCH_QUERIES_FEDERATION
                else:
                    query_set = DECISION_OWNER_SEARCH_QUERIES_CLUB
            else:
                if entity_type_key == "sport-club":
                    query_set = RELATED_POIS_SEARCH_QUERIES_CLUB
                elif entity_type_key == "sport-league":
                    query_set = RELATED_POIS_SEARCH_QUERIES_LEAGUE
                elif entity_type_key == "sport-federation":
                    query_set = RELATED_POIS_SEARCH_QUERIES_FEDERATION
                else:
                    query_set = RELATED_POIS_SEARCH_QUERIES_CLUB
            search_queries = [
                str(query).format(entity=entity_name)
                for query in query_set
            ]
        rendered["search_strategy"] = {
            **search_strategy,
            "search_queries": search_queries,
        }
    rendered["question_shape"] = "atomic"
    rendered["question_timeout_ms"] = QUESTION_TIMEOUT_MS
    rendered["hop_timeout_ms"] = HOP_TIMEOUT_MS
    rendered["evidence_extension_confidence_threshold"] = EVIDENCE_EXTENSION_CONFIDENCE_THRESHOLD
    if _slugify(entity_id) == MLC_ENTITY_ID:
        overrides = MLC_QUESTION_OVERRIDES.get(str(rendered.get("question_id") or "").strip(), {})
        if overrides:
            rendered.update(deepcopy(overrides))
            if "question" in overrides:
                rendered["question"] = str(rendered["question"]).format(entity=entity_name)
            if "query" in overrides:
                rendered["query"] = str(rendered["query"]).format(entity=entity_name)
            if "search_strategy" in overrides:
                rendered["search_strategy"] = {
                    **deepcopy(overrides["search_strategy"]),
                    "search_queries": [
                        str(query).format(entity=entity_name) for query in overrides["search_strategy"].get("search_queries", [])
                    ],
                }
    if _slugify(entity_id) == ICF_ENTITY_ID:
        overrides = ICF_QUESTION_OVERRIDES.get(str(rendered.get("question_id") or "").strip(), {})
        if overrides:
            rendered.update(deepcopy(overrides))
            if "question" in overrides:
                rendered["question"] = str(rendered["question"]).format(entity=entity_name)
            if "query" in overrides:
                rendered["query"] = str(rendered["query"]).format(entity=entity_name)
            if "search_strategy" in overrides:
                rendered["search_strategy"] = {
                    **deepcopy(overrides["search_strategy"]),
                    "search_queries": [
                        str(query).format(entity=entity_name) for query in overrides["search_strategy"].get("search_queries", [])
                    ],
                }
    if _slugify(entity_id) == CELTIC_ENTITY_ID:
        overrides = CELTIC_QUESTION_OVERRIDES.get(str(rendered.get("question_id") or "").strip(), {})
        if overrides:
            rendered.update(deepcopy(overrides))
            if "question" in overrides:
                rendered["question"] = str(rendered["question"]).format(entity=entity_name)
            if "query" in overrides:
                rendered["query"] = str(rendered["query"]).format(entity=entity_name)
            if "search_strategy" in overrides:
                rendered["search_strategy"] = {
                    **deepcopy(overrides["search_strategy"]),
                    "search_queries": [
                        str(query).format(entity=entity_name) for query in overrides["search_strategy"].get("search_queries", [])
                    ],
                }
    return rendered


def build_universal_atomic_question_source(
    entity_type: str,
    entity_name: str,
    entity_id: str,
    *,
    preset: Optional[str] = None,
    question_source_label: Optional[str] = None,
) -> Dict[str, Any]:
    resolved_preset = str(preset or f"{_slugify(entity_name)}-atomic-matrix").strip()
    source_label = str(question_source_label or resolved_preset).strip()
    questions = [_render_question_spec(spec, entity_name, entity_id, entity_type) for spec in UNIVERSAL_ATOMIC_QUESTION_SPECS]
    return {
        "schema_version": "atomic_question_source_v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "entity_id": entity_id,
        "entity_name": entity_name,
        "entity_type": entity_type,
        "preset": resolved_preset,
        "question_source_label": source_label,
        "question_shape": "atomic",
        "pack_role": "discovery",
        "pack_stage": "atomic_matrix",
        "question_count": len(questions),
        "questions": questions,
    }


def write_universal_atomic_question_source(
    output_path: Path,
    entity_type: str,
    entity_name: str,
    entity_id: str,
    *,
    preset: Optional[str] = None,
    question_source_label: Optional[str] = None,
) -> Path:
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    payload = build_universal_atomic_question_source(
        entity_type=entity_type,
        entity_name=entity_name,
        entity_id=entity_id,
        preset=preset,
        question_source_label=question_source_label,
    )
    output_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return output_path


__all__ = [
    "EVIDENCE_EXTENSION_CONFIDENCE_THRESHOLD",
    "HOP_BUDGET",
    "HOP_TIMEOUT_MS",
    "QUESTION_TIMEOUT_MS",
    "UNIVERSAL_ATOMIC_QUESTION_SPECS",
    "build_universal_atomic_question_source",
    "write_universal_atomic_question_source",
]
