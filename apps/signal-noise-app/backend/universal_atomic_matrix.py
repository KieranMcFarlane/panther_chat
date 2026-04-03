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

DECISION_OWNER_SEARCH_QUERIES = [
    '"{entity}" LinkedIn company profile',
    '"{entity}" LinkedIn commercial',
    '"{entity}" LinkedIn partnerships',
    '"{entity}" LinkedIn sponsorship',
    '"{entity}" LinkedIn revenue',
    '"{entity}" LinkedIn business development',
    '"{entity}" LinkedIn marketing',
    '"{entity}" LinkedIn fan engagement',
    '"{entity}" LinkedIn digital',
    '"{entity}" LinkedIn innovation',
    '"{entity}" LinkedIn strategy',
    '"{entity}" LinkedIn transformation',
    '"{entity}" LinkedIn growth',
    '"{entity}" chief commercial officer',
    '"{entity}" partnerships director',
    '"{entity}" sponsorship director',
    '"{entity}" head of partnerships',
    '"{entity}" chief digital officer',
    '"{entity}" innovation director',
    '"{entity}" transformation director',
    '"{entity}" marketing director',
    '"{entity}" growth director',
    '"{entity}" CEO',
    '"{entity}" managing director',
]

RELATED_POIS_SEARCH_QUERIES = [
    '"{entity}" LinkedIn company profile',
    '"{entity}" LinkedIn commercial',
    '"{entity}" LinkedIn partnerships',
    '"{entity}" LinkedIn sponsorship',
    '"{entity}" LinkedIn revenue',
    '"{entity}" LinkedIn business development',
    '"{entity}" LinkedIn marketing',
    '"{entity}" LinkedIn digital',
    '"{entity}" LinkedIn innovation',
    '"{entity}" LinkedIn strategy',
    '"{entity}" LinkedIn transformation',
    '"{entity}" LinkedIn growth',
    '"{entity}" chief commercial officer',
    '"{entity}" commercial director',
    '"{entity}" partnerships director',
    '"{entity}" sponsorship director',
    '"{entity}" head of partnerships',
    '"{entity}" chief digital officer',
    '"{entity}" innovation director',
    '"{entity}" transformation director',
    '"{entity}" marketing director',
    '"{entity}" growth director',
    '"{entity}" CEO',
    '"{entity}" managing director',
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
        "evidence_focus": "entity_fact",
        "promotion_target": "profile",
        "answer_kind": "fact",
    },
    {
        "question_id": "q2_launch_signal",
        "question_family": "launch",
        "question_type": "launch",
        "question": "Is there evidence {entity} has launched or is replacing a public app, product, or digital platform?",
        "query": '"{entity}" app product platform launch',
        "hop_budget": HOP_BUDGET,
        "evidence_extension_budget": 2,
        "source_priority": [
            "google_serp",
            "news",
            "press_release",
            "linkedin_posts",
            "official_site",
        ],
        "evidence_focus": "opportunity_signal",
        "promotion_target": "opportunity_signals",
        "answer_kind": "signal",
    },
    {
        "question_id": "q3_procurement_signal",
        "question_family": "procurement",
        "question_type": "procurement",
        "question": "Is there evidence {entity} is running an RFP, tender, or procurement for a digital platform?",
        "query": '"{entity}" RFP tender procurement digital platform sponsor broadcast vendor',
        "hop_budget": HOP_BUDGET,
        "evidence_extension_budget": 2,
        "source_priority": [
            "google_serp",
            "linkedin_posts",
            "news",
            "press_release",
            "official_site",
        ],
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
            "search_queries": DECISION_OWNER_SEARCH_QUERIES,
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
            "search_queries": RELATED_POIS_SEARCH_QUERIES,
        },
        "evidence_focus": "decision_owner",
        "promotion_target": "decision_owners",
        "answer_kind": "people_list",
    },
]

MLC_ENTITY_ID = "major-league-cricket"
MLC_QUESTION_OVERRIDES: Dict[str, Dict[str, Any]] = {
    "q2_launch_signal": {
        "question": "Has {entity} launched a public app, product, or digital platform?",
        "search_strategy": {
            "search_queries": [
                '"{entity}" launched a public app',
                '"{entity}" launched a product',
                '"{entity}" launched a digital platform',
            ]
        },
    },
    "q3_procurement_signal": {
        "search_strategy": {
            "search_queries": [
                '"{entity}" RFP',
                '"{entity}" tender',
                '"{entity}" procurement',
                '"{entity}" vendor',
                '"{entity}" sponsor',
                '"{entity}" broadcast',
            ]
        },
    },
}


def _slugify(value: str) -> str:
    slug = "".join(ch.lower() if ch.isalnum() else "-" for ch in str(value or "").strip())
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug.strip("-") or "entity"


def _render_question_spec(spec: Dict[str, Any], entity_name: str, entity_id: str) -> Dict[str, Any]:
    rendered = deepcopy(spec)
    rendered["question"] = str(rendered["question"]).format(entity=entity_name)
    rendered["query"] = str(rendered["query"]).format(entity=entity_name)
    if "search_strategy" in rendered:
        rendered["search_strategy"] = {
            **deepcopy(rendered["search_strategy"]),
            "search_queries": [
                str(query).format(entity=entity_name)
                for query in rendered["search_strategy"].get("search_queries", [])
            ],
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
    questions = [_render_question_spec(spec, entity_name, entity_id) for spec in UNIVERSAL_ATOMIC_QUESTION_SPECS]
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
