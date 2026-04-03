#!/usr/bin/env python3
"""Question-first BrightData MCP batch runner with per-question judge JSON."""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from brightdata_mcp_client import BrightDataMCPClient  # noqa: E402
from judge_client_factory import build_deepseek_judge_client  # noqa: E402
from yellow_panther_catalog import (  # noqa: E402
    generate_hypothesis_batch,
    get_entity_aliases,
    get_questions_for_entity_type,
    get_yp_service_summary,
)

logger = logging.getLogger(__name__)


def _configure_logging(level: str = "INFO") -> None:
    root_logger = logging.getLogger()
    if not root_logger.handlers:
        logging.basicConfig(
            level=getattr(logging, level.upper(), logging.INFO),
            format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        )
    else:
        root_logger.setLevel(getattr(logging, level.upper(), logging.INFO))


def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", str(value or "").lower()).strip("-")
    return slug or "entity"


def _redact_token_in_url(url: str | None) -> str | None:
    if not url:
        return url
    return re.sub(r"(token=)[^&]+", r"\1***", url)


def _tokenize_query(text: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-z0-9]+", str(text or "").lower())
        if len(token) > 2
    }


def _normalize_match_phrase(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").lower())


def _score_search_result(
    query: str,
    item: Dict[str, Any],
    *,
    entity_name: Optional[str] = None,
    aliases: Optional[List[str]] = None,
) -> float:
    title = str(item.get("title") or "").lower()
    snippet = str(item.get("snippet") or "").lower()
    url = str(item.get("url") or "").lower()
    text = " ".join([title, snippet, url])
    tokens = _tokenize_query(query)
    score = 0.0
    normalized_text = _normalize_match_phrase(text)
    normalized_url = _normalize_match_phrase(url)
    normalized_entity_name = _normalize_match_phrase(entity_name or "")
    alias_list = [a for a in (aliases or []) if str(a or "").strip()]
    normalized_aliases = [_normalize_match_phrase(alias) for alias in alias_list]

    entity_terms = [normalized_entity_name] if normalized_entity_name else []
    entity_terms.extend([term for term in normalized_aliases if term])
    entity_hit = False

    for token in tokens:
        if token in text:
            score += 1.0

    procurement_terms = {
        "rfp": 2.0,
        "tender": 2.0,
        "procurement": 2.0,
        "request for proposal": 2.5,
        "digital transformation": 1.5,
        "procurement signal": 1.5,
        "request for tender": 2.0,
        "issued an rfp": 3.0,
    }
    for term, weight in procurement_terms.items():
        if term in text:
            score += weight

    if "linkedin.com" in url:
        score += 0.75
    if "linkedin.com/posts/" in url:
        score += 1.5
    if "linkedin.com/posts/majorleaguecricket" in url:
        score += 4.0
    if "linkedin.com/in/" in url:
        score -= 2.0
    if "majorleaguecricket" in url:
        score += 4.0
    if "major league cricket" in text:
        score += 4.0
    if "american cricket enterprises" in text:
        score += 2.5
    if "/news" in url or "/press" in url:
        score += 0.5
    if "official" in text or "press release" in text:
        score += 0.5
    if "developmentaid.org" in url and "majorleaguecricket" not in url:
        score -= 1.5

    if normalized_entity_name:
        if normalized_entity_name in normalized_text or normalized_entity_name in normalized_url:
            score += 6.0
            entity_hit = True
        compact_entity = normalized_entity_name.replace("the", "")
        if compact_entity and compact_entity in normalized_text:
            score += 2.0
            entity_hit = True

    for alias in normalized_aliases:
        if alias and (alias in normalized_text or alias in normalized_url):
            score += 4.0
            entity_hit = True

    if "majorleaguecricket" in normalized_url or "majorleaguecricket" in normalized_text:
        score += 6.0
        entity_hit = True
    if "americancricketenterprises" in normalized_text or "americancricketenterprises" in normalized_url:
        score += 5.0
        entity_hit = True
    if "ace" in normalized_text and "american cricket enterprises" in normalized_text:
        score += 3.0
        entity_hit = True

    if entity_name and not entity_hit:
        score -= 3.5
    if any(term in text for term in ("fifa", "coliseum", "development aid")) and not entity_hit:
        score -= 4.0
    if any(term in text for term in ("generic", "standard", "template")) and not entity_hit:
        score -= 1.0

    return score


def rank_search_results(
    query: str,
    results: List[Dict[str, Any]],
    *,
    entity_name: Optional[str] = None,
    aliases: Optional[List[str]] = None,
) -> Tuple[Dict[str, Any] | None, List[Dict[str, Any]]]:
    scored: List[Dict[str, Any]] = []
    for index, item in enumerate(results or []):
        candidate = dict(item or {})
        candidate["score"] = round(
            _score_search_result(query, candidate, entity_name=entity_name, aliases=aliases),
            3,
        )
        candidate["rank"] = index
        scored.append(candidate)
    scored.sort(key=lambda item: (item.get("score", 0.0), -int(item.get("rank", 0))), reverse=True)
    return (scored[0] if scored else None, scored)


def _normalize_question_text(question_text: str, entity_name: str) -> str:
    text = str(question_text or "").replace("{entity}", entity_name)
    text = re.sub(r"[^a-zA-Z0-9\s-]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    stop_phrases = [
        "what ",
        "which ",
        "is ",
        "are ",
        "does ",
        "do ",
        "will ",
        "would ",
        "is the ",
        "what is the ",
        "what are the ",
    ]
    lowered = text.lower()
    for prefix in stop_phrases:
        if lowered.startswith(prefix):
            text = text[len(prefix) :]
            break
    return text.strip()


def _build_broad_procurement_query(entity_name: str, question: Dict[str, Any]) -> Dict[str, Any]:
    base_terms = [
        f'"{entity_name}"',
        "RFP",
        "tender",
        "procurement",
    ]

    query = " ".join(base_terms).strip()
    return {
        "kind": "broad_procurement_question",
        "query": " ".join(query.split()),
        "priority": 0,
    }


def _build_recovery_query_plan(entity_name: str, question: Dict[str, Any], aliases: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    question_type = str(question.get("question_type") or "").lower()
    if question_type == "foundation":
        return []

    alias_list = [str(alias).strip() for alias in (aliases or []) if str(alias or "").strip()]
    if question_type == "poi":
        return [
            {
                "kind": "recovery_linkedin_profile_query",
                "query": f'"{entity_name}" site:linkedin.com/in/ OR site:linkedin.com/posts/',
                "priority": 1,
            },
            {
                "kind": "recovery_official_query",
                "query": f'"{entity_name}" official site leadership team',
                "priority": 2,
            },
        ]

    recovery_plan: List[Dict[str, Any]] = [
        {
            "kind": "recovery_linkedin_query",
            "query": f'"{entity_name}" RFP tender procurement LinkedIn',
            "priority": 1,
        }
    ]

    if any(_normalize_match_phrase(alias) == "americancricketenterprises" for alias in alias_list) or any(
        _normalize_match_phrase(alias) == "ace" for alias in alias_list
    ):
        recovery_plan.append(
            {
                "kind": "recovery_alias_query",
                "query": f'"{entity_name}" RFP tender procurement ACE',
                "priority": 2,
            }
        )
    else:
        recovery_plan.append(
            {
                "kind": "recovery_alias_query",
                "query": f'"{entity_name}" RFP tender procurement official site',
                "priority": 2,
            }
        )

    return recovery_plan


def _build_question_query(entity_name: str, question: Dict[str, Any]) -> Dict[str, Any]:
    question_type = str(question.get("question_type") or "").lower()
    if question_type == "foundation":
        return {
            "kind": "foundation_question",
            "query": f'"{entity_name}" founded',
            "priority": 0,
        }
    if question_type == "poi":
        return {
            "kind": "poi_question",
            "query": f'"{entity_name}" leadership team LinkedIn',
            "priority": 0,
        }
    return {
        "kind": "direct_question_query",
        "query": f'"{entity_name}" RFP tender procurement',
        "priority": 0,
    }


def _build_foundation_question_record(entity_name: str, entity_id: str, entity_type: str) -> Dict[str, Any]:
    question_text = f"When was {entity_name} founded?"
    return {
        "question_id": "entity_founded_year",
        "question_type": "foundation",
        "question_text": question_text,
        "question": question_text,
        "question_body": question_text,
        "aliases": get_entity_aliases(entity_id, entity_name),
        "yp_service_fit": [],
        "confidence_boost": 0.0,
        "query_plan": [
            {
                "kind": "foundation_question",
                "query": f'"{entity_name}" founded',
                "priority": 0,
            }
        ],
        "recovery_query_plan": [],
        "agentic_plan": {
            "source_priority": [
                "google_serp",
                "official_site",
                "wikipedia",
                "press_release",
                "news",
                "pdf_rfp",
            ],
            "stop_rule": "stop after the first direct pass unless agentic recovery is explicitly enabled",
        },
        "hypothesis": {
            "entity_type": entity_type,
            "metadata": {
                "yp_service_fit": [],
                "yp_services_summary": get_yp_service_summary(),
            },
        },
    }


def _build_poi_question_record(
    entity_name: str,
    entity_id: str,
    entity_type: str,
    *,
    question_id: str,
    question_text: str,
    query: str,
    yp_service_fit: Optional[List[str]] = None,
    query_plan: Optional[List[Dict[str, Any]]] = None,
    recovery_query_plan: Optional[List[Dict[str, Any]]] = None,
    source_priority: Optional[List[str]] = None,
) -> Dict[str, Any]:
    yp_service_fit = yp_service_fit or []
    return {
        "question_id": question_id,
        "question_type": "poi",
        "question_text": question_text,
        "question": question_text,
        "question_body": question_text,
        "aliases": get_entity_aliases(entity_id, entity_name),
        "yp_service_fit": yp_service_fit,
        "confidence_boost": 0.0,
        "query_plan": query_plan
        or [
            {
                "kind": "poi_question",
                "query": query,
                "priority": 0,
            }
        ],
        "recovery_query_plan": recovery_query_plan or [],
        "agentic_plan": {
            "source_priority": source_priority
            or [
                "google_serp",
                "linkedin_profiles",
                "linkedin_posts",
                "official_site",
                "press_release",
                "news",
            ],
            "stop_rule": "stop after the first direct pass unless agentic recovery is explicitly enabled",
        },
        "hypothesis": {
            "entity_type": entity_type,
            "metadata": {
                "yp_service_fit": yp_service_fit,
                "yp_services_summary": get_yp_service_summary(),
            },
        },
    }


def build_poi_question_records(
    entity_type: str,
    entity_name: str,
    entity_id: str,
    max_questions: Optional[int] = None,
) -> List[Dict[str, Any]]:
    specs = [
        {
            "question_id": "poi_commercial_partnerships_lead",
            "question_text": (
                f"Who is the most suitable person for commercial partnerships or business development at {entity_name}?"
            ),
            "query": f'"{entity_name}" LinkedIn company profile',
            "yp_service_fit": ["FAN_ENGAGEMENT"],
            "query_plan": [
                {
                    "kind": "poi_company_anchor",
                    "query": f'"{entity_name}" LinkedIn company profile',
                    "priority": 0,
                },
                {
                    "kind": "poi_candidate_pool",
                    "query": f'"{entity_name}" LinkedIn commercial partnerships business development',
                    "priority": 1,
                },
            ],
            "recovery_query_plan": [
                {"kind": "poi_title_fallback", "query": f'"{entity_name}" chief commercial officer', "priority": 2},
                {"kind": "poi_title_fallback", "query": f'"{entity_name}" partnerships director', "priority": 3},
                {"kind": "poi_title_fallback", "query": f'"{entity_name}" sponsorship director', "priority": 4},
                {"kind": "poi_title_fallback", "query": f'"{entity_name}" head of partnerships', "priority": 5},
                {"kind": "poi_title_fallback", "query": f'"{entity_name}" chief digital officer', "priority": 6},
                {"kind": "poi_title_fallback", "query": f'"{entity_name}" innovation director', "priority": 7},
                {"kind": "poi_title_fallback", "query": f'"{entity_name}" transformation director', "priority": 8},
                {"kind": "poi_title_fallback", "query": f'"{entity_name}" marketing director', "priority": 9},
                {"kind": "poi_title_fallback", "query": f'"{entity_name}" growth director', "priority": 10},
                {"kind": "poi_title_fallback", "query": f'"{entity_name}" CEO', "priority": 11},
                {"kind": "poi_title_fallback", "query": f'"{entity_name}" managing director', "priority": 12},
            ],
            "source_priority": [
                "linkedin_company_profile",
                "linkedin_people_search",
                "linkedin_person_profile",
                "google_serp",
                "official_site",
                "press_release",
                "news",
            ],
        },
        {
            "question_id": "poi_digital_product_lead",
            "question_text": f"Who leads digital product, web, or app initiatives at {entity_name}?",
            "query": f'"{entity_name}" digital product LinkedIn',
            "yp_service_fit": ["MOBILE_APPS", "DIGITAL_TRANSFORMATION"],
        },
        {
            "question_id": "poi_fan_engagement_lead",
            "question_text": f"Who leads fan engagement, CRM, or audience growth at {entity_name}?",
            "query": f'"{entity_name}" fan engagement LinkedIn',
            "yp_service_fit": ["FAN_ENGAGEMENT"],
        },
        {
            "question_id": "poi_marketing_comms_lead",
            "question_text": f"Who leads marketing or communications at {entity_name}?",
            "query": f'"{entity_name}" marketing communications LinkedIn',
            "yp_service_fit": ["FAN_ENGAGEMENT"],
        },
        {
            "question_id": "poi_operations_lead",
            "question_text": f"Who leads operations, strategy, or business operations at {entity_name}?",
            "query": f'"{entity_name}" operations LinkedIn',
            "yp_service_fit": ["DIGITAL_TRANSFORMATION", "ANALYTICS"],
        },
    ]
    limit = max_questions if max_questions is not None else len(specs)
    return [
        _build_poi_question_record(
            entity_name,
            entity_id,
            entity_type,
            question_id=spec["question_id"],
            question_text=spec["question_text"],
            query=spec["query"],
            yp_service_fit=spec.get("yp_service_fit"),
            query_plan=spec.get("query_plan"),
            recovery_query_plan=spec.get("recovery_query_plan"),
            source_priority=spec.get("source_priority"),
        )
        for spec in specs[:limit]
    ]


def build_preset_question_records(
    preset: str,
    entity_type: str,
    entity_name: str,
    entity_id: str,
    *,
    poi_question_count: int = 5,
    agentic_recovery: bool = False,
) -> List[Dict[str, Any]]:
    normalized_preset = _slugify(preset)
    if normalized_preset != "major-league-cricket":
        raise ValueError(f"Unsupported preset {preset!r}. Expected 'major-league-cricket'.")

    procurement_records = build_question_records(
        entity_type,
        entity_name,
        entity_id,
        max_questions=1,
        agentic_recovery=agentic_recovery,
    )
    foundation_record = _build_foundation_question_record(entity_name, entity_id, entity_type)
    poi_records = build_poi_question_records(
        entity_type,
        entity_name,
        entity_id,
        max_questions=poi_question_count,
    )
    return [foundation_record, *procurement_records[:1], *poi_records]


def _preset_defaults(preset: Optional[str]) -> Dict[str, str]:
    normalized_preset = _slugify(preset or "")
    if normalized_preset == "major-league-cricket":
        return {
            "entity_name": "Major League Cricket",
            "entity_id": "major-league-cricket",
            "entity_type": "SPORT_LEAGUE",
        }
    return {}


def build_question_records(
    entity_type: str,
    entity_name: str,
    entity_id: str,
    max_questions: Optional[int] = None,
    agentic_recovery: bool = False,
) -> List[Dict[str, Any]]:
    questions = get_questions_for_entity_type(entity_type, max_questions)
    hypotheses = generate_hypothesis_batch(entity_type, entity_name, entity_id, max_questions)
    aliases = get_entity_aliases(entity_id, entity_name)

    records: List[Dict[str, Any]] = []
    for question, hypothesis in zip(questions, hypotheses):
        question_text = question.question.format(entity=entity_name)
        question_dict = question.to_dict()
        question_dict["question_text"] = question_text
        question_dict["question_type"] = str(question_dict.get("question_type") or "procurement")
        question_dict["aliases"] = aliases
        question_dict["query_plan"] = [_build_question_query(entity_name, question_dict)]
        question_dict["recovery_query_plan"] = (
            _build_recovery_query_plan(entity_name, question_dict, aliases) if agentic_recovery else []
        )
        question_dict["agentic_plan"] = {
            "source_priority": (
                [
                    "google_serp",
                    "official_site",
                    "wikipedia",
                    "press_release",
                    "news",
                    "pdf_rfp",
                ]
                if str(question_dict.get("question_type") or "").lower() == "foundation"
                else [
                    "google_serp",
                    "linkedin_profiles",
                    "linkedin_posts",
                    "official_site",
                    "press_release",
                    "news",
                ]
                if str(question_dict.get("question_type") or "").lower() == "poi"
                else [
                    "google_serp",
                    "linkedin_posts",
                    "official_site",
                    "press_release",
                    "news",
                    "pdf_rfp",
                ]
            ),
            "stop_rule": (
                "stop after the first direct pass unless agentic recovery is explicitly enabled"
                if not agentic_recovery
                else "continue to recovery queries when the first pass is noisy or low-confidence"
            ),
        }
        question_dict["hypothesis"] = hypothesis
        records.append(question_dict)
    return records


def select_question_records(
    question_records: List[Dict[str, Any]],
    question_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    if not question_id:
        return question_records
    selected = [record for record in question_records if str(record.get("question_id")) == str(question_id)]
    if not selected:
        available = ", ".join(str(record.get("question_id")) for record in question_records)
        raise ValueError(f"Question id {question_id!r} not found in question records. Available: {available}")
    return selected


def build_reasoning_prompt(
    question_text: str,
    evidence_url: str,
    evidence_excerpt: str,
    *,
    service_fit: Optional[List[str]] = None,
    query_plan: Optional[List[Dict[str, Any]]] = None,
    evidence_bundle: Optional[Dict[str, Any]] = None,
) -> str:
    service_fit = service_fit or []
    query_plan = query_plan or []
    schema_keys = [
        "answer",
        "signal_type",
        "confidence",
        "validation_state",
        "evidence_url",
        "recommended_next_query",
        "notes",
    ]
    return (
        "You are judging procurement evidence from Bright Data MCP.\n"
        "Answer only in JSON with keys: "
        + ", ".join(schema_keys)
        + "\n"
        f"Question: {question_text}\n"
        f"Service fit: {', '.join(service_fit) if service_fit else 'unknown'}\n"
        f"Query plan: {json.dumps(query_plan, ensure_ascii=False)}\n"
        f"Evidence bundle: {json.dumps(evidence_bundle or {}, ensure_ascii=False)}\n"
        f"Evidence URL: {evidence_url}\n"
        f"Evidence excerpt: {evidence_excerpt[:4000]}\n"
    )


def _scrape_limit_for_question(question_record: Dict[str, Any]) -> int:
    if str(question_record.get("question_type") or "").lower() == "foundation":
        return 1
    return 3


def _should_scrape_top_k(
    question_record: Dict[str, Any],
    best_result: Dict[str, Any] | None,
    ranked_results: List[Dict[str, Any]],
    *,
    allow_top_k: bool = True,
) -> bool:
    if not allow_top_k:
        return False
    if not best_result or len(ranked_results) < 2:
        return False
    if str(question_record.get("question_type") or "").lower() == "foundation":
        return False

    best_score = float(best_result.get("score") or 0.0)
    runner_up_score = float(ranked_results[1].get("score") or 0.0)
    entity_terms = {
        _normalize_match_phrase(question_record.get("question_text") or ""),
        _normalize_match_phrase(question_record.get("question_id") or ""),
    }
    for alias in question_record.get("aliases") or []:
        entity_terms.add(_normalize_match_phrase(alias))

    best_text = _normalize_match_phrase(
        " ".join(
            [
                str(best_result.get("title") or ""),
                str(best_result.get("snippet") or ""),
                str(best_result.get("url") or ""),
            ]
        )
    )
    best_matches_entity = any(term and term in best_text for term in entity_terms)
    low_confidence = best_score < 10.0
    weak_margin = (best_score - runner_up_score) < 2.0
    if not best_matches_entity:
        return True
    return low_confidence or weak_margin


def _build_scrape_candidates(
    ranked_results: List[Dict[str, Any]],
    limit: int,
) -> List[str]:
    urls: List[str] = []
    for item in ranked_results[: max(1, limit)]:
        url = str(item.get("url") or "").strip()
        if url and url not in urls:
            urls.append(url)
    return urls


def _normalize_scrape_result(index: int, scrape: Dict[str, Any], fallback_url: str) -> Dict[str, Any]:
    content = scrape.get("content") or scrape.get("markdown") or scrape.get("text") or ""
    return {
        "index": index,
        "status": scrape.get("status"),
        "url": scrape.get("url") or fallback_url,
        "word_count": len(str(content).split()),
        "content_preview": str(content)[:1500],
    }


def _select_scrape_candidates(
    question_record: Dict[str, Any],
    ranked_results: List[Dict[str, Any]],
    *,
    allow_top_k: bool = True,
) -> List[str]:
    if not ranked_results:
        return []
    best_result = ranked_results[0]
    limit = 1
    if _should_scrape_top_k(question_record, best_result, ranked_results, allow_top_k=allow_top_k):
        limit = _scrape_limit_for_question(question_record)
    return _build_scrape_candidates(ranked_results, limit)


async def _search_and_scrape_question(
    brightdata: BrightDataMCPClient,
    judge: ClaudeClient,
    question_record: Dict[str, Any],
    entity_name: str,
    *,
    agentic_recovery: bool = False,
    allow_top_k: bool = False,
) -> Dict[str, Any]:
    query_attempts: List[Dict[str, Any]] = []
    all_ranked_results: List[Dict[str, Any]] = []
    chosen_attempt: Dict[str, Any] | None = None
    planned_queries = list(question_record.get("query_plan") or [])
    if agentic_recovery:
        planned_queries.extend(list(question_record.get("recovery_query_plan") or []))

    for query_item in planned_queries:
        query = str(query_item.get("query") or "").strip()
        if not query:
            continue

        logger.info(
            "question=%s query_start kind=%s query=%s",
            question_record.get("question_id"),
            query_item.get("kind"),
            query,
        )
        search = await brightdata.search_engine(query, engine="google")
        search_results = list(search.get("results", []))
        logger.info(
            "question=%s query_search status=%s result_count=%s",
            question_record.get("question_id"),
            search.get("status"),
            len(search_results),
        )
        best_for_query, ranked_results = rank_search_results(
            query,
            search_results,
            entity_name=entity_name,
            aliases=list(question_record.get("aliases") or []),
        )

        selected_result = None
        scrape_records: List[Dict[str, Any]] = []
        reasoning_prompt = ""
        reasoning: Dict[str, Any] = {}
        structured: Dict[str, Any] = {}
        validation_state = "no_signal"

        if best_for_query:
            selected_result = {
                "title": best_for_query.get("title"),
                "url": best_for_query.get("url"),
                "snippet": best_for_query.get("snippet"),
                "score": best_for_query.get("score"),
                "rank": best_for_query.get("rank"),
            }
            logger.info(
                "question=%s selected_result url=%s score=%s rank=%s",
                question_record.get("question_id"),
                selected_result.get("url"),
                selected_result.get("score"),
                selected_result.get("rank"),
            )
            scrape_candidates = _select_scrape_candidates(
                question_record,
                ranked_results,
                allow_top_k=allow_top_k,
            )
            logger.info(
                "question=%s scrape_candidates=%s",
                question_record.get("question_id"),
                scrape_candidates,
            )
            scrape_payload: Dict[str, Any] = {"status": "success", "results": []}
            if len(scrape_candidates) > 1 and hasattr(brightdata, "scrape_batch"):
                scrape_payload = await brightdata.scrape_batch(scrape_candidates)
                scrape_results = list(scrape_payload.get("results", []))
                for index, url in enumerate(scrape_candidates):
                    scrape_result = scrape_results[index] if index < len(scrape_results) else {}
                    scrape_records.append(_normalize_scrape_result(index, scrape_result, url))
            else:
                for index, url in enumerate(scrape_candidates[:1]):
                    scrape = await brightdata.scrape_as_markdown(url)
                    scrape_records.append(_normalize_scrape_result(index, scrape, url))
            if not scrape_records and selected_result:
                scrape = await brightdata.scrape_as_markdown(str(selected_result.get("url") or query))
                scrape_records.append(
                    _normalize_scrape_result(
                        0,
                        scrape,
                        str(selected_result.get("url") or query),
                    )
                )

            primary_scrape = scrape_records[0] if scrape_records else None
            evidence_url = primary_scrape["url"] if primary_scrape else str(selected_result.get("url") or "")
            evidence_excerpt = "\n\n".join(
                [
                    f"[{index}] {scrape.get('url')}\n{scrape.get('content_preview')}"
                    for index, scrape in enumerate(scrape_records)
                ]
            )
            evidence_bundle = {
                "search_query": query,
                "selected_result": selected_result,
                "search_results": ranked_results[:3],
                "scrape_candidates": scrape_candidates,
                "scrape_payload": scrape_payload,
                "scrapes": scrape_records,
            }
            reasoning_prompt = build_reasoning_prompt(
                question_text=question_record["question_text"],
                evidence_url=evidence_url,
                evidence_excerpt=evidence_excerpt,
                service_fit=list(question_record.get("yp_service_fit") or []),
                query_plan=question_record.get("query_plan") or [],
                evidence_bundle=evidence_bundle,
            )
            reasoning = await judge.query(
                prompt=reasoning_prompt,
                model="judge",
                max_tokens=400,
                json_mode=True,
            )
            structured = _parse_structured_output(reasoning)
            validation_state = structured.get("validation_state") or (
                "validated" if structured.get("signal_type") in {"RFP", "TENDER", "PROCUREMENT", "OPPORTUNITY"} else "provisional"
            )
            if not selected_result:
                validation_state = "no_signal"
            logger.info(
                "question=%s validation_state=%s signal_type=%s confidence=%s",
                question_record.get("question_id"),
                validation_state,
                structured.get("signal_type"),
                structured.get("confidence"),
            )

        attempt_record = {
            "query": query,
            "kind": query_item.get("kind"),
            "status": search.get("status"),
            "result_count": len(search_results),
            "serp_summary": " | ".join(
                f"{index + 1}. {str(item.get('title') or '').strip()}"
                for index, item in enumerate(search_results[:5])
            ),
            "raw_search_results": search_results,
            "ranked_search_results": ranked_results,
            "selected_result": selected_result,
            "scraped_results": scrape_records,
            "reasoning_prompt": reasoning_prompt,
            "reasoning": {
                "model_requested": "judge",
                "model_used": reasoning.get("model_used"),
                "content": reasoning.get("content"),
                "structured_output": structured,
                "tokens_used": reasoning.get("tokens_used"),
                "stop_reason": reasoning.get("stop_reason"),
                "provider": reasoning.get("provider"),
            },
            "validation_state": validation_state,
        }
        query_attempts.append(attempt_record)
        all_ranked_results.extend(
            [
                {
                    "query": query,
                    "title": item.get("title"),
                    "url": item.get("url"),
                    "snippet": item.get("snippet"),
                    "score": item.get("score"),
                    "rank": item.get("rank"),
                }
                for item in ranked_results
            ]
        )
        if validation_state == "validated":
            chosen_attempt = attempt_record
            break

    final_attempt = chosen_attempt or {
        "query": "",
        "kind": None,
        "status": "success",
        "result_count": 0,
        "selected_result": None,
        "scraped_results": [],
        "reasoning_prompt": build_reasoning_prompt(
            question_text=question_record["question_text"],
            evidence_url="",
            evidence_excerpt="",
            service_fit=list(question_record.get("yp_service_fit") or []),
            query_plan=question_record.get("query_plan") or [],
        ),
        "reasoning": {
            "model_requested": "judge",
            "model_used": None,
            "content": None,
            "structured_output": {},
            "tokens_used": None,
            "stop_reason": None,
            "provider": None,
        },
        "validation_state": "no_signal",
    }

    return {
        "question_id": question_record["question_id"],
        "question_text": question_record["question_text"],
        "hypothesis": question_record["hypothesis"],
        "aliases": question_record.get("aliases") or [],
        "query_plan": question_record.get("query_plan") or [],
        "recovery_query_plan": question_record.get("recovery_query_plan") or [],
        "agentic_plan": question_record.get("agentic_plan") or {},
        "search_attempts": query_attempts,
        "search_results": all_ranked_results[:10],
        "raw_search_results": [item for attempt in query_attempts for item in attempt.get("raw_search_results", [])][:10],
        "serp_summary": query_attempts[0].get("serp_summary") if query_attempts else "",
        "selected_result": final_attempt.get("selected_result"),
        "scraped_results": final_attempt.get("scraped_results") or [],
        "best_query": chosen_attempt.get("query") if chosen_attempt else query_attempts[0].get("query") if query_attempts else None,
        "scrape_source": "best_search_result" if final_attempt.get("selected_result") else None,
        "reasoning_prompt": final_attempt.get("reasoning_prompt") or "",
        "validation_state": final_attempt.get("validation_state") or "no_signal",
        "service_fit": list(question_record.get("yp_service_fit") or []),
        "entity_name": entity_name,
        "reasoning": final_attempt.get("reasoning") or {},
    }


def _parse_structured_output(reasoning: Dict[str, Any]) -> Dict[str, Any]:
    structured = reasoning.get("structured_output")
    if isinstance(structured, dict):
        return structured
    content = reasoning.get("content")
    if isinstance(content, str):
        try:
            parsed = json.loads(content)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            return {}
    return {}


def _render_transcript(result: Dict[str, Any], reasoning: Dict[str, Any]) -> str:
    structured = _parse_structured_output(reasoning)
    lines = [
        f"Question ID: {result['question_id']}",
        f"Question: {result['question_text']}",
        f"Validation state: {result.get('validation_state')}",
        f"Selected result: {json.dumps(result.get('selected_result'), ensure_ascii=False)}",
        f"Judge answer: {structured.get('answer')}",
        f"Signal type: {structured.get('signal_type')}",
        f"Confidence: {structured.get('confidence')}",
        f"Evidence URL: {structured.get('evidence_url')}",
        f"Recommended next query: {structured.get('recommended_next_query')}",
    ]
    return "\n".join(lines)


def _load_question_json(path: Path) -> Dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, dict) and "question" in payload and isinstance(payload["question"], dict):
        return payload["question"]
    if isinstance(payload, dict) and "questions" in payload and isinstance(payload["questions"], list):
        if payload["questions"]:
            return payload["questions"][0]
    return payload if isinstance(payload, dict) else {}


def merge_question_json_files(
    json_paths: List[Path],
    output_dir: Path,
    entity_name: str = "",
    entity_id: str = "",
    entity_type: str = "",
    run_started_at: Optional[str] = None,
) -> Dict[str, Any]:
    run_started_at = run_started_at or _iso()
    questions: List[Dict[str, Any]] = []
    transcripts: List[str] = []
    inferred_entity_name = entity_name
    inferred_entity_id = entity_id
    inferred_entity_type = entity_type
    for path in json_paths:
        payload = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(payload, dict):
            inferred_entity_name = inferred_entity_name or str(payload.get("entity_name") or "")
            inferred_entity_id = inferred_entity_id or str(payload.get("entity_id") or "")
            inferred_entity_type = inferred_entity_type or str(payload.get("entity_type") or "")
        question = _load_question_json(path)
        if not question:
            continue
        questions.append(question)
        transcripts.append(_render_transcript(question, question.get("reasoning") or {}))

    if not inferred_entity_name and questions:
        inferred_entity_name = str(questions[0].get("entity_name") or "")
    if not inferred_entity_id and questions:
        inferred_entity_id = str(questions[0].get("entity_id") or "")
    if not inferred_entity_type and questions:
        inferred_entity_type = str(questions[0].get("entity_type") or "")

    output_dir.mkdir(parents=True, exist_ok=True)
    slug = _slugify(inferred_entity_id or inferred_entity_name)
    stem = f"{slug}_question_batch_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
    meta_result_path = output_dir / f"{stem}_meta.json"
    transcript_path = output_dir / f"{stem}.txt"
    rollup_path = output_dir / f"{stem}_rollup.json"

    meta_result_payload = {
        "run_started_at": run_started_at,
        "entity_name": inferred_entity_name,
        "entity_id": inferred_entity_id,
        "entity_type": inferred_entity_type,
        "questions": questions,
        "source_question_json_paths": [str(path) for path in json_paths],
    }
    questions_validated = sum(1 for item in questions if item.get("validation_state") == "validated")
    questions_no_signal = sum(1 for item in questions if item.get("validation_state") == "no_signal")
    questions_provisional = sum(1 for item in questions if item.get("validation_state") == "provisional")

    rollup_payload = {
        "run_started_at": run_started_at,
        "entity_name": inferred_entity_name,
        "entity_id": inferred_entity_id,
        "entity_type": inferred_entity_type,
        "questions_total": len(questions),
        "questions_validated": questions_validated,
        "questions_no_signal": questions_no_signal,
        "questions_provisional": questions_provisional,
        "meta_result_path": str(meta_result_path),
        "question_result_paths": [str(path) for path in json_paths],
        "question_results_path": str(meta_result_path),
        "transcript_path": str(transcript_path),
    }

    meta_result_path.write_text(json.dumps(meta_result_payload, indent=2, default=str), encoding="utf-8")
    transcript_path.write_text("\n\n".join(transcripts), encoding="utf-8")
    rollup_path.write_text(json.dumps(rollup_payload, indent=2, default=str), encoding="utf-8")

    logger.info(
        "merge_complete entity=%s questions_total=%s validated=%s no_signal=%s meta=%s transcript=%s",
        inferred_entity_name,
        len(questions),
        questions_validated,
        questions_no_signal,
        meta_result_path,
        transcript_path,
    )

    return {
        **rollup_payload,
        "rollup_path": str(rollup_path),
        "meta_result_path": str(meta_result_path),
        "question_result_paths": [str(path) for path in json_paths],
        "question_results_path": str(meta_result_path),
        "transcript_path": str(transcript_path),
    }


async def run_question_batch(
    entity_type: str,
    entity_name: str,
    entity_id: str,
    output_dir: Path,
    max_questions: Optional[int] = None,
    mcp_timeout: float = 60.0,
    preset: Optional[str] = None,
    include_foundation_question: bool = False,
    include_poi_questions: bool = False,
    poi_question_count: int = 5,
    question_id: Optional[str] = None,
    agentic_recovery: bool = False,
    allow_top_k: bool = False,
    brightdata_client: Optional[BrightDataMCPClient] = None,
    judge_client: Optional[Any] = None,
) -> Dict[str, Any]:
    _configure_logging()
    load_dotenv(ROOT / ".env", override=False)
    load_dotenv(BACKEND / ".env", override=False)

    brightdata = brightdata_client or BrightDataMCPClient(timeout=mcp_timeout)
    judge = judge_client or build_deepseek_judge_client()

    run_started_at = _iso()
    if preset:
        question_records = build_preset_question_records(
            preset=preset,
            entity_type=entity_type,
            entity_name=entity_name,
            entity_id=entity_id,
            poi_question_count=poi_question_count,
            agentic_recovery=agentic_recovery,
        )
    else:
        question_records = build_question_records(
            entity_type,
            entity_name,
            entity_id,
            max_questions=max_questions,
            agentic_recovery=agentic_recovery,
        )
        if include_foundation_question:
            question_records = [_build_foundation_question_record(entity_name, entity_id, entity_type)] + question_records
        if include_poi_questions:
            question_records.extend(
                build_poi_question_records(
                    entity_type,
                    entity_name,
                    entity_id,
                    max_questions=poi_question_count,
                )
            )
    question_records = select_question_records(question_records, question_id=question_id)
    final_questions: List[Dict[str, Any]] = []
    transcript_parts: List[str] = []
    per_question_payloads: List[Dict[str, Any]] = []

    try:
        logger.info(
            "batch_start entity=%s entity_id=%s entity_type=%s questions=%s foundation=%s timeout=%s",
            entity_name,
            entity_id,
            entity_type,
            len(question_records),
            include_foundation_question,
            mcp_timeout,
        )
        await brightdata.prewarm(timeout=mcp_timeout)

        for index, question_record in enumerate(question_records, start=1):
            logger.info(
                "batch_question_start index=%s question_id=%s question_text=%s",
                index,
                question_record.get("question_id"),
                question_record.get("question_text"),
            )
            result = await _search_and_scrape_question(
                brightdata,
                judge,
                question_record,
                entity_name,
                agentic_recovery=agentic_recovery,
                allow_top_k=allow_top_k,
            )
            structured = _parse_structured_output(result.get("reasoning") or {})
            question_output = {
                **result,
                "answer": structured.get("answer"),
                "signal_type": structured.get("signal_type"),
                "confidence": structured.get("confidence"),
                "evidence_url": structured.get("evidence_url") or (result.get("selected_result") or {}).get("url"),
                "recommended_next_query": structured.get("recommended_next_query"),
                "notes": structured.get("notes"),
            }
            final_questions.append(question_output)
            per_question_payloads.append(
                {
                    "run_started_at": run_started_at,
                    "entity_name": entity_name,
                    "entity_id": entity_id,
                    "entity_type": entity_type,
                    "question": question_output,
                }
            )
            transcript_parts.append(_render_transcript(question_output, question_output.get("reasoning") or {}))
            logger.info(
                "batch_question_complete index=%s question_id=%s validation_state=%s best_query=%s",
                index,
                question_output.get("question_id"),
                question_output.get("validation_state"),
                question_output.get("best_query"),
            )

        output_dir.mkdir(parents=True, exist_ok=True)
        slug = _slugify(entity_id or entity_name)
        stem = f"{slug}_question_batch_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
        meta_result_path = output_dir / f"{stem}_meta.json"
        transcript_path = output_dir / f"{stem}.txt"
        rollup_path = output_dir / f"{stem}_rollup.json"
        question_result_paths: List[str] = []

        meta_result_payload = {
            "run_started_at": run_started_at,
            "entity_name": entity_name,
            "entity_id": entity_id,
            "entity_type": entity_type,
            "max_questions": max_questions,
            "questions": final_questions,
        }
        for index, payload in enumerate(per_question_payloads, start=1):
            question_result_path = output_dir / f"{stem}_question_{index:03d}.json"
            question_result_path.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
            question_result_paths.append(str(question_result_path))
        questions_validated = sum(1 for item in final_questions if item.get("validation_state") == "validated")
        questions_no_signal = sum(1 for item in final_questions if item.get("validation_state") == "no_signal")
        questions_provisional = sum(1 for item in final_questions if item.get("validation_state") == "provisional")

        rollup_payload = {
            "run_started_at": run_started_at,
            "entity_name": entity_name,
            "entity_id": entity_id,
            "entity_type": entity_type,
            "questions_total": len(final_questions),
            "questions_validated": questions_validated,
            "questions_no_signal": questions_no_signal,
            "questions_provisional": questions_provisional,
            "meta_result_path": str(meta_result_path),
            "question_result_paths": question_result_paths,
            "question_results_path": str(meta_result_path),
            "transcript_path": str(transcript_path),
        }

        meta_result_path.write_text(json.dumps(meta_result_payload, indent=2, default=str), encoding="utf-8")
        transcript_path.write_text("\n\n".join(transcript_parts), encoding="utf-8")
        rollup_path.write_text(json.dumps(rollup_payload, indent=2, default=str), encoding="utf-8")
        logger.info(
            "batch_complete entity=%s questions_total=%s validated=%s no_signal=%s meta=%s transcript=%s",
            entity_name,
            len(final_questions),
            questions_validated,
            questions_no_signal,
            meta_result_path,
            transcript_path,
        )

        return {
            **rollup_payload,
            "rollup_path": str(rollup_path),
            "meta_result_path": str(meta_result_path),
            "question_result_paths": question_result_paths,
            "question_results_path": str(meta_result_path),
            "transcript_path": str(transcript_path),
        }
    finally:
        if brightdata_client is None:
            await brightdata.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Question-first BrightData MCP procurement batch runner")
    parser.add_argument("--entity-name")
    parser.add_argument("--entity-id")
    parser.add_argument("--entity-type")
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--merge-jsons", nargs="+", help="Merge existing per-question JSON files into one meta JSON")
    parser.add_argument("--max-questions", type=int, default=None)
    parser.add_argument("--mcp-timeout", type=float, default=60.0)
    parser.add_argument("--preset", choices=["major-league-cricket"], help="Shortcut question bundle preset")
    parser.add_argument("--include-foundation-question", action="store_true")
    parser.add_argument("--include-poi-questions", action="store_true")
    parser.add_argument("--poi-question-count", type=int, default=5)
    parser.add_argument("--question-id")
    parser.add_argument("--agentic-recovery", action="store_true", help="Enable recovery query hops and top-K scraping")
    parser.add_argument("--log-level", default="INFO")
    args = parser.parse_args()

    _configure_logging(args.log_level)
    output_dir = Path(args.output_dir)
    if args.merge_jsons:
        json_paths = [Path(path) for path in args.merge_jsons]
        result = merge_question_json_files(
            json_paths=json_paths,
            output_dir=output_dir,
            entity_name=args.entity_name or "",
            entity_id=args.entity_id or "",
            entity_type=args.entity_type or "",
        )
    else:
        preset_defaults = _preset_defaults(args.preset)
        entity_name = args.entity_name or preset_defaults.get("entity_name")
        entity_id = args.entity_id or preset_defaults.get("entity_id")
        entity_type = args.entity_type or preset_defaults.get("entity_type")
        if not args.entity_name or not args.entity_id or not args.entity_type:
            if not args.preset:
                parser.error("the following arguments are required when not merging: --entity-name, --entity-id, --entity-type")
            if not entity_name or not entity_id or not entity_type:
                parser.error(f"preset {args.preset!r} does not provide defaults for entity args")
        result = asyncio.run(
            run_question_batch(
                entity_type=entity_type,
                entity_name=entity_name,
                entity_id=entity_id,
                output_dir=output_dir,
                max_questions=args.max_questions,
                mcp_timeout=args.mcp_timeout,
                preset=args.preset,
                include_foundation_question=args.include_foundation_question,
                include_poi_questions=args.include_poi_questions,
                poi_question_count=args.poi_question_count,
                question_id=args.question_id,
                agentic_recovery=args.agentic_recovery,
                allow_top_k=args.agentic_recovery,
            )
        )
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
