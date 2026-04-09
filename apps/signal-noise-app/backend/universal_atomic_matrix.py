#!/usr/bin/env python3
"""Universal canonical question matrix for phased question-first runs."""

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


def _slugify(value: str) -> str:
    slug = "".join(ch.lower() if ch.isalnum() else "-" for ch in str(value or "").strip())
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug.strip("-") or "entity"


def _entity_type_key(entity_type: str) -> str:
    return _slugify(entity_type)


def _search_queries(entity_name: str, patterns: List[str]) -> List[str]:
    return [pattern.format(entity=entity_name) for pattern in patterns]


Q1_FOUNDATION_SEARCH_QUERIES = [
    '"{entity}" official website',
    '"{entity}" founded year',
    '"{entity}" headquarters',
    '"{entity}" venue',
    '"{entity}" wikipedia',
]

Q2_DIGITAL_STACK_SEARCH_QUERIES = [
    '"{entity}" official website',
    '"{entity}" technology stack',
    '"{entity}" tech stack',
    '"{entity}" digital stack',
    '"{entity}" CRM',
    '"{entity}" analytics platform',
    '"{entity}" ticketing platform',
    '"{entity}" mobile app',
    '"{entity}" technology partner',
    '"{entity}" digital partner',
]

Q3_LEADERSHIP_SEARCH_QUERIES = [
    '"{entity}" LinkedIn company profile',
    '"{entity}" leadership team',
    '"{entity}" executive team',
    '"{entity}" commercial team',
    '"{entity}" partnerships',
    '"{entity}" marketing',
    '"{entity}" digital',
    '"{entity}" technology',
    '"{entity}" strategy',
]

Q6_LAUNCH_SIGNAL_SEARCH_QUERIES = [
    '"{entity}" launch app',
    '"{entity}" digital platform launch',
    '"{entity}" fan engagement platform',
    '"{entity}" membership platform',
    '"{entity}" streaming platform',
    '"{entity}" ticketing launch',
]

Q7_PROCUREMENT_SIGNAL_SEARCH_QUERIES = [
    '"{entity}" official partner',
    '"{entity}" commercial partner',
    '"{entity}" sponsorship',
    '"{entity}" partnerships',
    '"{entity}" technology partner',
    '"{entity}" digital transformation',
    '"{entity}" procurement',
    '"{entity}" vendor',
]

Q8_EXPLICIT_RFP_SEARCH_QUERIES = [
    '"{entity}" RFP',
    '"{entity}" tender',
    '"{entity}" invitation to tender',
    '"{entity}" filetype:pdf tender',
]

Q9_NEWS_SIGNAL_SEARCH_QUERIES = [
    '"{entity}" news',
    '"{entity}" announcement',
    '"{entity}" partnership',
    '"{entity}" digital',
    '"{entity}" strategy',
]

Q10_HIRING_SIGNAL_SEARCH_QUERIES = [
    '"{entity}" jobs digital',
    '"{entity}" jobs CRM',
    '"{entity}" jobs partnerships',
    '"{entity}" jobs marketing',
    '"{entity}" jobs transformation',
]

Q4_PERFORMANCE_SEARCH_QUERIES = [
    '"{entity}" standings',
    '"{entity}" table',
    '"{entity}" results',
]

Q5_LEAGUE_CONTEXT_SEARCH_QUERIES = [
    '"{entity}" league competitors',
    '"{entity}" comparable clubs',
    '"{entity}" peer organisations',
]

Q11_DECISION_OWNER_SEARCH_QUERIES = [
    '"{entity}" LinkedIn company profile',
    '"{entity}" chief commercial officer',
    '"{entity}" commercial director',
    '"{entity}" head of partnerships',
    '"{entity}" marketing director',
    '"{entity}" chief digital officer',
    '"{entity}" strategy director',
]


UNIVERSAL_ATOMIC_QUESTION_SPECS: List[Dict[str, Any]] = [
    {
        "question_id": "q1_foundation",
        "question_family": "foundation",
        "question_type": "foundation",
        "question": "What is the canonical identity and grounding profile for {entity}?",
        "query": '"{entity}" official website founded year',
        "source_priority": ["google_serp", "official_site", "wikipedia"],
        "search_patterns": Q1_FOUNDATION_SEARCH_QUERIES,
        "execution_class": "atomic_retrieval",
        "rollout_phase": "phase_1_core",
        "conditional_on": [],
        "depends_on": [],
        "structured_output_schema": "foundation_v1",
        "graph_write_targets": ["entity_identity"],
        "evidence_focus": "entity_fact",
        "promotion_target": "profile",
        "answer_kind": "fact",
        "fallback_to_retrieval": True,
        "hop_budget": HOP_BUDGET,
        "evidence_extension_budget": 1,
    },
    {
        "question_id": "q2_digital_stack",
        "question_family": "digital_stack",
        "question_type": "digital_stack",
        "question": "What visible technologies, platforms, or vendors does {entity} use, and what do they imply commercially?",
        "query": '"{entity}" official website',
        "source_priority": ["apify_techstack", "google_serp", "news", "press_release", "official_site"],
        "search_patterns": Q2_DIGITAL_STACK_SEARCH_QUERIES,
        "execution_class": "deterministic_enrichment",
        "rollout_phase": "phase_1_core",
        "conditional_on": [],
        "depends_on": ["q1_foundation"],
        "structured_output_schema": "digital_stack_v1",
        "graph_write_targets": ["technology_signals"],
        "evidence_focus": "technology_stack",
        "promotion_target": "technology_stack",
        "answer_kind": "signal",
        "fallback_to_retrieval": True,
        "deterministic_tools": ["apify_techstack"],
        "deterministic_input": {"source_question_id": "q1_foundation", "official_site_only": True},
        "hop_budget": HOP_BUDGET,
        "evidence_extension_budget": 2,
    },
    {
        "question_id": "q3_leadership",
        "question_family": "leadership",
        "question_type": "leadership",
        "question": "Who are the key leadership, commercial, partnerships, marketing, digital, technology, and strategy figures at {entity}?",
        "query": '"{entity}" leadership team',
        "source_priority": [
            "wikipedia",
            "official_site",
            "linkedin_company_profile",
            "linkedin_people_search",
            "linkedin_person_profile",
            "google_serp",
            "news",
        ],
        "search_patterns": Q3_LEADERSHIP_SEARCH_QUERIES,
        "execution_class": "atomic_retrieval",
        "rollout_phase": "phase_1_core",
        "conditional_on": [],
        "depends_on": [],
        "structured_output_schema": "leadership_candidates_v1",
        "graph_write_targets": ["person_candidates"],
        "evidence_focus": "leadership_map",
        "promotion_target": "leadership",
        "answer_kind": "people_list",
        "fallback_to_retrieval": True,
        "hop_budget": HOP_BUDGET,
        "evidence_extension_budget": 2,
        "question_timeout_ms": 300000,
        "hop_timeout_ms": 300000,
    },
    {
        "question_id": "q6_launch_signal",
        "question_family": "launch_signal",
        "question_type": "launch_signal",
        "question": "What products, apps, platforms, or fan experiences has {entity} launched or announced?",
        "query": '"{entity}" launch app platform',
        "source_priority": ["official_site", "press_release", "news", "google_serp"],
        "search_patterns": Q6_LAUNCH_SIGNAL_SEARCH_QUERIES,
        "execution_class": "atomic_retrieval",
        "rollout_phase": "phase_1_core",
        "conditional_on": [],
        "depends_on": [],
        "structured_output_schema": "launch_signal_v1",
        "graph_write_targets": ["launch_signal_episodes"],
        "evidence_focus": "launch_signal",
        "promotion_target": "launch_signals",
        "answer_kind": "signal",
        "fallback_to_retrieval": True,
        "hop_budget": HOP_BUDGET,
        "evidence_extension_budget": 2,
    },
    {
        "question_id": "q7_procurement_signal",
        "question_family": "procurement_signal",
        "question_type": "procurement_signal",
        "question": "Is there evidence {entity} is buying, reshaping vendors, or changing its commercial or digital ecosystem?",
        "query": '"{entity}" official partner commercial partner platform',
        "source_priority": ["official_site", "press_release", "news", "google_serp", "linkedin_posts"],
        "search_patterns": Q7_PROCUREMENT_SIGNAL_SEARCH_QUERIES,
        "execution_class": "atomic_retrieval",
        "rollout_phase": "phase_1_core",
        "conditional_on": [],
        "depends_on": [],
        "structured_output_schema": "procurement_signal_v1",
        "graph_write_targets": ["procurement_signal_episodes"],
        "evidence_focus": "opportunity_signal",
        "promotion_target": "opportunity_signals",
        "answer_kind": "signal",
        "fallback_to_retrieval": True,
        "hop_budget": HOP_BUDGET,
        "evidence_extension_budget": 2,
    },
    {
        "question_id": "q8_explicit_rfp",
        "question_family": "explicit_rfp",
        "question_type": "tender_docs",
        "question": "Are there published RFPs, tenders, or formal procurement documents for {entity}?",
        "query": '"{entity}" tender RFP',
        "source_priority": ["official_site", "google_serp", "press_release", "news"],
        "search_patterns": Q8_EXPLICIT_RFP_SEARCH_QUERIES,
        "execution_class": "atomic_retrieval",
        "rollout_phase": "phase_2_conditional",
        "conditional_on": [{"type": "validated_question", "question_id": "q7_procurement_signal"}],
        "depends_on": ["q7_procurement_signal"],
        "structured_output_schema": "explicit_rfp_v1",
        "graph_write_targets": ["explicit_rfp_episodes"],
        "evidence_focus": "explicit_rfp",
        "promotion_target": "rfp_signals",
        "answer_kind": "signal",
        "fallback_to_retrieval": True,
        "hop_budget": HOP_BUDGET,
        "evidence_extension_budget": 1,
    },
    {
        "question_id": "q9_news_signal",
        "question_family": "news_signal",
        "question_type": "news_signal",
        "question": "What recent news, partnerships, and strategic themes are most relevant for {entity} right now?",
        "query": '"{entity}" news announcement partnership',
        "source_priority": ["news", "press_release", "official_site", "google_serp"],
        "search_patterns": Q9_NEWS_SIGNAL_SEARCH_QUERIES,
        "execution_class": "atomic_retrieval",
        "rollout_phase": "phase_1_core",
        "conditional_on": [],
        "depends_on": [],
        "structured_output_schema": "news_signal_v1",
        "graph_write_targets": ["news_signal_episodes"],
        "evidence_focus": "news_signal",
        "promotion_target": "news_signals",
        "answer_kind": "signal",
        "fallback_to_retrieval": True,
        "hop_budget": HOP_BUDGET,
        "evidence_extension_budget": 2,
    },
    {
        "question_id": "q10_hiring_signal",
        "question_family": "hiring_signal",
        "question_type": "hiring_signal",
        "question": "What hiring signals suggest current investment priorities for {entity}?",
        "query": '"{entity}" jobs digital marketing CRM',
        "source_priority": ["google_serp", "official_site", "linkedin_posts", "news"],
        "search_patterns": Q10_HIRING_SIGNAL_SEARCH_QUERIES,
        "execution_class": "atomic_retrieval",
        "rollout_phase": "phase_2_conditional",
        "conditional_on": [{"type": "question_phase_enabled", "question_id": "q9_news_signal"}],
        "depends_on": ["q9_news_signal"],
        "structured_output_schema": "hiring_signal_v1",
        "graph_write_targets": ["hiring_signal_episodes"],
        "evidence_focus": "hiring_signal",
        "promotion_target": "hiring_signals",
        "answer_kind": "signal",
        "fallback_to_retrieval": True,
        "hop_budget": HOP_BUDGET,
        "evidence_extension_budget": 1,
    },
    {
        "question_id": "q4_performance",
        "question_family": "performance",
        "question_type": "performance",
        "question": "What is the current sporting performance context for {entity}?",
        "query": '"{entity}" standings',
        "source_priority": ["sports_data", "official_site"],
        "search_patterns": Q4_PERFORMANCE_SEARCH_QUERIES,
        "execution_class": "deterministic_enrichment",
        "rollout_phase": "phase_2_conditional",
        "conditional_on": [{"type": "entity_type_in", "values": ["SPORT_CLUB", "SPORT_LEAGUE"]}],
        "depends_on": [],
        "structured_output_schema": "performance_context_v1",
        "graph_write_targets": ["performance_context"],
        "evidence_focus": "performance_context",
        "promotion_target": "performance_context",
        "answer_kind": "summary",
        "fallback_to_retrieval": False,
        "hop_budget": 0,
        "evidence_extension_budget": 0,
    },
    {
        "question_id": "q5_league_context",
        "question_family": "league_context",
        "question_type": "league_context",
        "question": "What peer and ecosystem context best frames {entity}?",
        "query": '"{entity}" league context',
        "source_priority": ["graphiti_context", "sports_data", "official_site"],
        "search_patterns": Q5_LEAGUE_CONTEXT_SEARCH_QUERIES,
        "execution_class": "deterministic_enrichment",
        "rollout_phase": "phase_2_conditional",
        "conditional_on": [{"type": "entity_type_in", "values": ["SPORT_CLUB", "SPORT_LEAGUE", "SPORT_FEDERATION"]}],
        "depends_on": [],
        "structured_output_schema": "league_context_v1",
        "graph_write_targets": ["peer_context"],
        "evidence_focus": "league_context",
        "promotion_target": "league_context",
        "answer_kind": "summary",
        "fallback_to_retrieval": False,
        "hop_budget": 0,
        "evidence_extension_budget": 0,
    },
    {
        "question_id": "q11_decision_owner",
        "question_family": "decision_owner",
        "question_type": "decision_owner",
        "question": "Who is the highest probability buyer at {entity} given the current commercial and product context?",
        "query": '"{entity}" commercial partnerships leadership',
        "source_priority": [
            "wikipedia",
            "official_site",
            "linkedin_company_profile",
            "linkedin_people_search",
            "linkedin_person_profile",
            "google_serp",
            "news",
            "linkedin_posts",
        ],
        "search_patterns": Q11_DECISION_OWNER_SEARCH_QUERIES,
        "execution_class": "atomic_retrieval",
        "rollout_phase": "phase_3_decision",
        "conditional_on": [],
        "depends_on": ["q3_leadership", "q6_launch_signal", "q7_procurement_signal", "q9_news_signal", "q10_hiring_signal"],
        "structured_output_schema": "decision_owner_v1",
        "graph_write_targets": ["decision_owner_rankings"],
        "evidence_focus": "decision_owner",
        "promotion_target": "decision_owners",
        "answer_kind": "person",
        "fallback_to_retrieval": True,
        "hop_budget": HOP_BUDGET,
        "evidence_extension_budget": 2,
        "question_timeout_ms": 300000,
        "hop_timeout_ms": 300000,
    },
    {
        "question_id": "q12_connections",
        "question_family": "connections",
        "question_type": "connections",
        "question": "What is the best Yellow Panther path to the ranked buying candidates at {entity}?",
        "query": '"{entity}" connections',
        "source_priority": ["graphiti_connections", "connections_graph", "linkedin_network"],
        "search_patterns": [],
        "execution_class": "deterministic_enrichment",
        "rollout_phase": "phase_3_decision",
        "conditional_on": [{"type": "validated_question", "question_id": "q11_decision_owner"}],
        "depends_on": ["q11_decision_owner"],
        "structured_output_schema": "connections_path_v1",
        "graph_write_targets": ["connection_paths"],
        "evidence_focus": "connections",
        "promotion_target": "connections",
        "answer_kind": "scorecard",
        "fallback_to_retrieval": False,
        "hop_budget": 0,
        "evidence_extension_budget": 0,
    },
    {
        "question_id": "q13_capability_gap",
        "question_family": "capability_gap",
        "question_type": "capability_gap",
        "question": "What capability gaps or weaknesses are most relevant for {entity} versus peers?",
        "query": '"{entity}" capability gap',
        "source_priority": [],
        "search_patterns": [],
        "execution_class": "derived_inference",
        "rollout_phase": "phase_3_decision",
        "conditional_on": [],
        "depends_on": ["q2_digital_stack", "q4_performance", "q5_league_context", "q6_launch_signal", "q7_procurement_signal", "q9_news_signal", "q10_hiring_signal"],
        "structured_output_schema": "capability_gap_v1",
        "graph_write_targets": ["capability_gap_episodes"],
        "evidence_focus": "capability_gap",
        "promotion_target": "capability_gap",
        "answer_kind": "scorecard",
        "fallback_to_retrieval": False,
        "hop_budget": 0,
        "evidence_extension_budget": 0,
    },
    {
        "question_id": "q14_yp_fit",
        "question_family": "yp_fit",
        "question_type": "yp_fit",
        "question": "Where does Yellow Panther fit best for {entity}?",
        "query": '"{entity}" Yellow Panther fit',
        "source_priority": [],
        "search_patterns": [],
        "execution_class": "derived_inference",
        "rollout_phase": "phase_3_decision",
        "conditional_on": [],
        "depends_on": ["q13_capability_gap", "q7_procurement_signal"],
        "structured_output_schema": "yp_fit_v1",
        "graph_write_targets": ["yp_fit_episodes"],
        "evidence_focus": "yp_fit",
        "promotion_target": "yp_fit",
        "answer_kind": "scorecard",
        "fallback_to_retrieval": False,
        "hop_budget": 0,
        "evidence_extension_budget": 0,
    },
    {
        "question_id": "q15_outreach_strategy",
        "question_family": "outreach_strategy",
        "question_type": "outreach_strategy",
        "question": "What is the best outreach strategy for Yellow Panther at {entity}?",
        "query": '"{entity}" outreach strategy',
        "source_priority": [],
        "search_patterns": [],
        "execution_class": "derived_inference",
        "rollout_phase": "phase_3_decision",
        "conditional_on": [],
        "depends_on": ["q11_decision_owner", "q12_connections", "q14_yp_fit"],
        "structured_output_schema": "outreach_strategy_v1",
        "graph_write_targets": ["outreach_strategy_episodes"],
        "evidence_focus": "outreach_strategy",
        "promotion_target": "outreach_strategy",
        "answer_kind": "scorecard",
        "fallback_to_retrieval": False,
        "hop_budget": 0,
        "evidence_extension_budget": 0,
    },
]


def _render_question_spec(spec: Dict[str, Any], entity_name: str, entity_id: str, entity_type: str) -> Dict[str, Any]:
    rendered = deepcopy(spec)
    rendered["question"] = str(rendered["question"]).format(entity=entity_name)
    rendered["query"] = str(rendered["query"]).format(entity=entity_name)
    rendered["search_strategy"] = {
        "search_queries": _search_queries(entity_name, list(rendered.pop("search_patterns", []))),
    }
    rendered["question_shape"] = "atomic"
    rendered["question_timeout_ms"] = int(rendered.get("question_timeout_ms") or QUESTION_TIMEOUT_MS)
    rendered["hop_timeout_ms"] = int(rendered.get("hop_timeout_ms") or HOP_TIMEOUT_MS)
    rendered["evidence_extension_confidence_threshold"] = EVIDENCE_EXTENSION_CONFIDENCE_THRESHOLD
    rendered["entity_name"] = entity_name
    rendered["entity_id"] = entity_id
    rendered["entity_type"] = entity_type
    rendered["pack_role"] = "discovery"
    return rendered


def build_universal_atomic_question_source(
    entity_type: str,
    entity_name: str,
    entity_id: str,
    *,
    preset: Optional[str] = None,
    question_source_label: Optional[str] = None,
    default_rollout_phase: Optional[str] = None,
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
        "rollout_strategy": "phased_core",
        "default_rollout_phase": str(default_rollout_phase or "phase_1_core").strip() or "phase_1_core",
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
    default_rollout_phase: Optional[str] = None,
) -> Path:
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    payload = build_universal_atomic_question_source(
        entity_type=entity_type,
        entity_name=entity_name,
        entity_id=entity_id,
        preset=preset,
        question_source_label=question_source_label,
        default_rollout_phase=default_rollout_phase,
    )
    output_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
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
