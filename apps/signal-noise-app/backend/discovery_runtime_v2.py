#!/usr/bin/env python3
"""
Discovery Runtime v2

Policy:
- Open candidate generation (discovered provenance only)
- Strict execution budget
- Hard evidence gates
- Two-pass scheduler (grounding then investigative)
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import re
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Awaitable, Callable, Dict, List, Optional, Set, Tuple
from urllib.parse import urljoin, urlparse

import httpx

logger = logging.getLogger(__name__)
try:
    from backend.objective_profiles import get_objective_profile, normalize_run_objective
except ImportError:
    from objective_profiles import get_objective_profile, normalize_run_objective

ALLOWED_CANDIDATE_ORIGINS = {
    "search",
    "sitemap",
    "nav",
    "internal_search",
    "crawl",
    "known_doc_index",
}

PASS_A_LANES = ["official_site", "press_release", "careers", "trusted_news"]
PASS_B_LANES = ["annual_report", "rfp_procurement_tenders", "linkedin_jobs"]
DIVERSIFIED_FALLBACK_ORDER = [
    "rfp_procurement_tenders",
    "careers",
    "press_release",
    "partnership_commercial",
    "governance_pdf",
    "linkedin_jobs",
    "broader_press",
]

TRUSTED_NEWS_DOMAINS = {
    "bbc.com",
    "reuters.com",
    "ft.com",
    "theathletic.com",
    "apnews.com",
    "espn.com",
    "skysports.com",
    "theguardian.com",
    "coventrytelegraph.net",
    "coventryobserver.co.uk",
    "jobsinfootball.com",
    "sportsmintmedia.com",
    "e3mag.com",
    "bbc.com",
    "bbc.co.uk",
}

TIER_1_DOMAIN_HINTS = (
    ".gov",
    ".gov.uk",
    ".org",
    "sec.gov",
    "fifa.com",
    "uefa.com",
    "premierleague.com",
    "efl.com",
)

HIGH_PRIORITY_REFERENCE_DOMAINS = (
    "bbc.com",
    "bbc.co.uk",
)

LOW_AUTHORITY_DOMAIN_HINTS = (
    "facebook.com",
    "x.com",
    "twitter.com",
    "instagram.com",
    "tiktok.com",
    "pinterest.",
    "ziprecruiter.com",
    "scribd.com",
    "tendertiger.com",
)

PDF_BINARY_NOISE_MARKERS = (
    "/filter/flatedecode",
    "type/xref",
    " obj",
    "endobj",
    "xref",
    "startxref",
)

LANE_KEYWORDS: Dict[str, Tuple[str, ...]] = {
    "official_site": ("official", "about", "club", "federation"),
    "press_release": ("announces", "partnership", "agreement", "launch", "initiative"),
    "careers": ("careers", "job", "vacancy", "hiring", "recruit"),
    "trusted_news": ("reported", "announced", "deal", "partnership", "digital"),
    "annual_report": ("annual report", "financial", "report", "statement"),
    "rfp_procurement_tenders": ("rfp", "tender", "procurement", "supplier", "bid"),
    "linkedin_jobs": ("linkedin", "job", "hiring", "commercial", "digital"),
    "partnership_commercial": ("partnership", "commercial", "sponsor", "rights"),
    "governance_pdf": ("policy", "governance", "supplier", "code"),
    "broader_press": ("industry", "news", "report", "analysis"),
}

LANE_QUERIES: Dict[str, Tuple[str, ...]] = {
    "official_site": ('"{entity}" official site', '"{entity}" official website'),
    "press_release": (
        '"{entity}" press release partnership',
        '"{entity}" announcement commercial partnership',
    ),
    "careers": (
        '"{entity}" careers digital commercial',
        '"{entity}" jobs procurement technology',
    ),
    "trusted_news": (
        '"{entity}" digital transformation news',
        '"{entity}" supplier partnership announcement',
    ),
    "annual_report": ('"{entity}" annual report filetype:pdf', '"{entity}" annual report'),
    "rfp_procurement_tenders": (
        '"{entity}" procurement tender rfp',
        '"{entity}" supplier registration procurement',
    ),
    "linkedin_jobs": ('site:linkedin.com/jobs "{entity}" digital', 'site:linkedin.com/jobs "{entity}" procurement'),
    "partnership_commercial": ('"{entity}" commercial partner', '"{entity}" sponsorship partnership'),
    "governance_pdf": ('"{entity}" governance policy filetype:pdf', '"{entity}" supplier code filetype:pdf'),
    "broader_press": ('"{entity}" industry report', '"{entity}" modernization initiative'),
}

CONTROLLER_ACTION_TYPES = {
    "search_queries",
    "scrape_candidate",
    "same_domain_probe",
    "stop_lane",
    "stop_run",
}

CONTROLLER_ACTION_JSON_SCHEMA: Dict[str, Any] = {
    "name": "controller_action",
    "schema": {
        "type": "object",
        "additionalProperties": True,
        "properties": {
            "action": {
                "type": "string",
                "enum": sorted(list(CONTROLLER_ACTION_TYPES)),
            },
            "lane": {
                "type": "string",
                "enum": sorted(list(LANE_QUERIES.keys())),
            },
            "candidate_index": {"type": "integer", "minimum": 0},
            "queries": {"type": "array", "items": {"type": "string"}},
            "url": {"type": "string"},
            "reason": {"type": "string"},
        },
        "required": ["action"],
    },
}


def _truthy(value: Any) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def _safe_word_count(content: str) -> int:
    return len([part for part in re.split(r"\s+", content or "") if part.strip()])


def _normalize_url(url: str) -> str:
    parsed = urlparse(str(url or "").strip())
    if not parsed.scheme or not parsed.netloc:
        return ""
    host = parsed.netloc.lower()
    path = (parsed.path or "/").rstrip("/") or "/"
    query = f"?{parsed.query}" if parsed.query else ""
    return f"{parsed.scheme.lower()}://{host}{path}{query}"


def _extract_json_object(text: str) -> Optional[Dict[str, Any]]:
    raw = str(text or "").strip()
    if not raw:
        return None
    try:
        payload = json.loads(raw)
        if isinstance(payload, dict):
            return payload
    except Exception:
        pass
    match = re.search(r"\{.*\}", raw, flags=re.DOTALL)
    if not match:
        return None
    try:
        payload = json.loads(match.group(0))
        if isinstance(payload, dict):
            return payload
    except Exception:
        return None
    return None


def parse_controller_action(payload: Any) -> Optional[Dict[str, Any]]:
    """Parse a strict controller action contract.

    Accepts either a dict payload or a JSON object string. Prose, unknown
    actions, extra keys, and malformed field types are rejected deterministically.
    """

    if isinstance(payload, str):
        raw = payload.strip()
        if not raw:
            return None
        try:
            payload = json.loads(raw)
        except Exception:
            return None

    if not isinstance(payload, dict):
        return None

    action = str(payload.get("action") or "").strip()
    if action not in CONTROLLER_ACTION_TYPES:
        return None

    reason_value = payload.get("reason")
    reason = None
    if reason_value is not None:
        if not isinstance(reason_value, str):
            return None
        reason = reason_value.strip()
        if not reason:
            return None

    if action == "stop_run":
        allowed_keys = {"action", "reason"}
        if set(payload.keys()) - allowed_keys:
            return None
        result: Dict[str, Any] = {"action": action}
        if reason:
            result["reason"] = reason
        return result

    lane = str(payload.get("lane") or "").strip()
    if not lane or lane not in _controller_action_allowed_lanes():
        return None

    if action == "search_queries":
        allowed_keys = {"action", "lane", "queries", "reason"}
        if set(payload.keys()) - allowed_keys:
            return None
        queries = payload.get("queries")
        if not isinstance(queries, list) or not queries:
            return None
        normalized_queries: List[str] = []
        for query in queries:
            if not isinstance(query, str):
                return None
            normalized = query.strip()
            if not normalized:
                return None
            normalized_queries.append(normalized)
        result = {"action": action, "lane": lane, "queries": normalized_queries}
        if reason:
            result["reason"] = reason
        return result

    if action == "scrape_candidate":
        allowed_keys = {"action", "lane", "candidate_index", "reason"}
        if set(payload.keys()) - allowed_keys:
            return None
        candidate_index = payload.get("candidate_index")
        if not isinstance(candidate_index, int) or isinstance(candidate_index, bool) or candidate_index < 0:
            return None
        result = {"action": action, "lane": lane, "candidate_index": candidate_index}
        if reason:
            result["reason"] = reason
        return result

    if action == "same_domain_probe":
        allowed_keys = {"action", "lane", "url", "reason"}
        if set(payload.keys()) - allowed_keys:
            return None
        url = _normalize_url(str(payload.get("url") or ""))
        if not url:
            return None
        result = {"action": action, "lane": lane, "url": url}
        if reason:
            result["reason"] = reason
        return result

    if action == "stop_lane":
        allowed_keys = {"action", "lane", "reason"}
        if set(payload.keys()) - allowed_keys:
            return None
        result = {"action": action, "lane": lane}
        if reason:
            result["reason"] = reason
        return result

    return None


def _controller_action_allowed_lanes() -> Set[str]:
    """Resolve the current discovery lane set at call time.

    This keeps controller-action validation strict without freezing lane
    membership at import time if lane constants change later.
    """

    return set(PASS_A_LANES) | set(PASS_B_LANES) | set(DIVERSIFIED_FALLBACK_ORDER)


@dataclass
class DiscoveryResultV2:
    entity_id: str
    entity_name: str
    final_confidence: float
    confidence_band: str
    is_actionable: bool
    iterations_completed: int
    total_cost_usd: float
    hypotheses: List[Any]
    depth_stats: Dict[int, int]
    signals_discovered: List[Dict[str, Any]]
    raw_signals: List[Any] = field(default_factory=list)
    hypothesis_states: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    performance_summary: Dict[str, Any] = field(default_factory=dict)
    entity_confidence: float = 0.0
    pipeline_confidence: float = 0.0
    parse_path: str = "discovery_v2_evidence_first"
    llm_last_status: str = "heuristic_only"
    candidate_evaluations: List[Dict[str, Any]] = field(default_factory=list)
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "entity_id": self.entity_id,
            "entity_name": self.entity_name,
            "final_confidence": self.final_confidence,
            "confidence_band": self.confidence_band,
            "is_actionable": self.is_actionable,
            "iterations_completed": self.iterations_completed,
            "total_cost_usd": self.total_cost_usd,
            "hypotheses": self.hypotheses,
            "depth_stats": self.depth_stats,
            "signals_discovered": self.signals_discovered,
            "raw_signals_count": len(self.raw_signals),
            "hypothesis_states": self.hypothesis_states,
            "performance_summary": self.performance_summary,
            "entity_confidence": self.entity_confidence,
            "pipeline_confidence": self.pipeline_confidence,
            "parse_path": self.parse_path,
            "llm_last_status": self.llm_last_status,
            "candidate_evaluations": self.candidate_evaluations,
            "timestamp": self.timestamp.isoformat(),
        }


class DiscoveryRuntimeV2:
    """Deterministic, evidence-first discovery runtime."""

    @staticmethod
    def parse_controller_action(payload: Any) -> Optional[Dict[str, Any]]:
        return parse_controller_action(payload)

    def __init__(self, claude_client: Any, brightdata_client: Any):
        self.claude_client = claude_client
        self.brightdata_client = brightdata_client

        # Balanced production defaults (locked in plan).
        self.max_hops = int(os.getenv("DISCOVERY_MAX_HOPS", "5"))
        self.max_hops_override = max(0, int(os.getenv("DISCOVERY_MAX_HOPS_OVERRIDE", "0")))
        self.max_evals_per_hop = int(os.getenv("DISCOVERY_MAX_EVALS_PER_HOP", "2"))
        self.per_iteration_timeout = float(os.getenv("DISCOVERY_PER_ITERATION_TIMEOUT_SECONDS", "30"))
        self.max_retries = int(os.getenv("DISCOVERY_MAX_RETRIES", "2"))
        self.max_same_domain_revisits = int(os.getenv("DISCOVERY_MAX_SAME_DOMAIN_REVISITS", "2"))
        self.num_results = int(os.getenv("DISCOVERY_SEARCH_RESULTS_PER_QUERY", "5"))
        self.queries_per_lane = int(os.getenv("DISCOVERY_QUERIES_PER_LANE", "3"))
        self.serp_pages_per_query = int(os.getenv("DISCOVERY_SERP_PAGES_PER_QUERY", "5"))
        self.eval_max_tokens = int(os.getenv("DISCOVERY_EVAL_MAX_TOKENS", "192"))
        self.length_stop_circuit_threshold = max(1, int(os.getenv("DISCOVERY_LENGTH_STOP_CIRCUIT_THRESHOLD", "2")))
        self.evidence_first = _truthy(os.getenv("DISCOVERY_POLICY_EVIDENCE_FIRST", "true"))
        self.enable_llm_eval = _truthy(os.getenv("DISCOVERY_V2_LLM_EVAL_ENABLED", "true"))
        self.enable_llm_hop_selection = _truthy(os.getenv("DISCOVERY_V2_LLM_HOP_SELECTION_ENABLED", "true"))
        self.enable_agentic_router = _truthy(os.getenv("DISCOVERY_V2_AGENTIC_ROUTER_ENABLED", "true"))
        self.candidate_mode_trigger_hops = int(os.getenv("DISCOVERY_CANDIDATE_MODE_TRIGGER_HOPS", "5"))
        self.candidate_mode_extended_hops = int(os.getenv("DISCOVERY_CANDIDATE_MODE_MAX_HOPS", "9"))
        self.dynamic_hop_credits_enabled = _truthy(
            os.getenv("DISCOVERY_DYNAMIC_HOP_CREDITS_ENABLED", "true")
        )
        self.dynamic_hop_credit_per_signal = max(
            1,
            int(os.getenv("DISCOVERY_HOP_CREDIT_PER_SIGNAL", "5")),
        )
        self.dynamic_hop_credit_cap = max(
            1,
            int(os.getenv("DISCOVERY_HOP_CREDIT_CAP", "40")),
        )
        self.run_profile = os.getenv("PIPELINE_RUN_PROFILE", "bounded_balanced_v2")
        self.doc_index_cache_ttl_seconds = max(
            60,
            int(os.getenv("DISCOVERY_DOC_INDEX_TTL_SECONDS", "43200")),
        )
        self.doc_index_cache_max_urls = max(
            8,
            int(os.getenv("DISCOVERY_DOC_INDEX_MAX_URLS", "96")),
        )
        cache_dir_env = os.getenv("DISCOVERY_DOC_INDEX_CACHE_DIR", "backend/data/dossiers/doc_index")
        self.doc_index_cache_dir = Path(cache_dir_env)
        self.doc_index_cache_dir.mkdir(parents=True, exist_ok=True)

        self._metrics: Dict[str, int] = {
            "synthetic_url_attempt_count": 0,
            "dead_end_event_count": 0,
            "fallback_accept_block_count": 0,
            "llm_call_count": 0,
            "llm_fallback_count": 0,
            "length_stop_count": 0,
            "schema_fail_count": 0,
            "empty_content_count": 0,
            "llm_hop_selection_count": 0,
            "planner_action_applied_count": 0,
            "planner_action_parse_fail_count": 0,
            "planner_action_repair_retry_count": 0,
        }
        self._quality_metrics: Dict[str, Any] = {
            "entity_grounding_reject_count_by_lane": {},
            "pdf_binary_reject_count": 0,
            "non_english_source_reject_count": 0,
            "off_entity_validated_signals": 0,
        }
        self._strict_eval_model_stats: Dict[str, Dict[str, Any]] = {}
        self._planner_parse_fail_samples: List[Dict[str, Any]] = []
        self._llm_circuit_broken = False
        self._consecutive_length_stops = 0

    async def run_discovery(
        self,
        entity_id: str,
        entity_name: str,
        template_id: Optional[str] = None,
        max_iterations: int = 30,
        **_kwargs: Any,
    ) -> DiscoveryResultV2:
        dossier = {"metadata": {"template_id": template_id}} if template_id else {}
        run_objective = _kwargs.get("run_objective")
        return await self.run_discovery_with_dossier_context(
            entity_id=entity_id,
            entity_name=entity_name,
            dossier=dossier,
            template_id=template_id,
            max_iterations=max_iterations,
            run_objective=run_objective,
        )

    async def run_discovery_with_dossier_context(
        self,
        entity_id: str,
        entity_name: str,
        dossier: Dict[str, Any],
        template_id: Optional[str] = None,
        entity_type: Optional[str] = None,
        max_iterations: int = 30,
        progress_callback: Optional[Callable[[Dict[str, Any]], Awaitable[None]]] = None,
        run_objective: Optional[str] = None,
    ) -> DiscoveryResultV2:
        del template_id, entity_type  # Intent-only in v2.
        objective = normalize_run_objective(run_objective)
        objective_profile = get_objective_profile(objective)
        pass_a_lanes = list(objective_profile.get("pass_a_lanes") or PASS_A_LANES)
        pass_b_lanes = list(objective_profile.get("pass_b_lanes") or PASS_B_LANES)
        objective_budget = self._resolve_objective_budget(max_iterations=max_iterations, profile=objective_profile)

        start = time.perf_counter()
        self._metrics = {
            "synthetic_url_attempt_count": 0,
            "dead_end_event_count": 0,
            "fallback_accept_block_count": 0,
            "llm_call_count": 0,
            "llm_fallback_count": 0,
            "length_stop_count": 0,
            "schema_fail_count": 0,
            "empty_content_count": 0,
            "llm_hop_selection_count": 0,
            "planner_action_applied_count": 0,
            "planner_action_parse_fail_count": 0,
            "planner_action_repair_retry_count": 0,
        }
        self._quality_metrics = {
            "entity_grounding_reject_count_by_lane": {},
            "pdf_binary_reject_count": 0,
            "non_english_source_reject_count": 0,
            "off_entity_validated_signals": 0,
        }
        self._strict_eval_model_stats = {}
        self._planner_parse_fail_samples = []
        self._llm_circuit_broken = False
        self._consecutive_length_stops = 0

        iteration_budget = int(objective_budget["max_hops"])
        initial_iteration_budget = int(iteration_budget)
        hop_credit_cap = max(initial_iteration_budget, min(self.dynamic_hop_credit_cap, 200))
        hop_credit_events = 0
        hop_credits_earned = 0
        seen_validated_signal_ids: Set[str] = set()
        official_domain = self._official_domain(entity_name=entity_name, dossier=dossier)
        state: Dict[str, Any] = {
            "visited_urls": set(),
            "visited_hashes": set(),
            "accepted_signatures": set(),
            "rejected_urls": set(),
            "low_signal_urls": {},
            "rejected_domain_families": {},
            "domain_visits": {},
            "lane_failures": {},
            "lane_exhausted": set(),
            "trusted_corroboration_tokens": set(),
            "iterations_completed": 0,
        }
        hop_timings: List[Dict[str, Any]] = []
        signals: List[Dict[str, Any]] = []
        diagnostics: List[Dict[str, Any]] = []
        candidate_evaluations: List[Dict[str, Any]] = []
        validated_candidate_count_by_lane: Dict[str, int] = {}
        llm_last_status = "heuristic_only"
        parse_path = "discovery_v2_evidence_first"

        pass_a_validated = 0
        pass_a_candidates = 0
        procurement_validated = 0
        selected_pass_a_lanes = await self._choose_lane_order_with_llm(
            entity_name=entity_name,
            objective=objective,
            pass_name="A",
            available_lanes=pass_a_lanes,
            state=state,
        )
        for lane in selected_pass_a_lanes:
            if state["iterations_completed"] >= iteration_budget:
                break
            lane_result = await self._run_lane(
                lane=lane,
                entity_id=entity_id,
                entity_name=entity_name,
                dossier=dossier,
                official_domain=official_domain,
                state=state,
                budget=objective_budget,
                run_objective=objective,
            )
            hop_timings.append(lane_result["hop"])
            candidate_evaluations.extend(lane_result.get("candidate_evaluations") or [])
            state["iterations_completed"] += 1
            if lane_result["signal"]:
                signals.append(lane_result["signal"])
                signal_state = str(lane_result["signal"].get("validation_state") or "").lower()
                lane_name = str(lane_result["hop"].get("hop_type") or lane)
                if signal_state == "validated":
                    pass_a_validated += 1
                    validated_candidate_count_by_lane[lane_name] = (
                        int(validated_candidate_count_by_lane.get(lane_name, 0) or 0) + 1
                    )
                    signal_id = str(lane_result["signal"].get("id") or "").strip()
                    if (
                        self.dynamic_hop_credits_enabled
                        and signal_id
                        and signal_id not in seen_validated_signal_ids
                    ):
                        seen_validated_signal_ids.add(signal_id)
                        credit_delta = max(0, int(self.dynamic_hop_credit_per_signal))
                        if credit_delta > 0 and iteration_budget < hop_credit_cap:
                            new_budget = min(hop_credit_cap, iteration_budget + credit_delta)
                            granted = max(0, new_budget - iteration_budget)
                            if granted > 0:
                                iteration_budget = new_budget
                                objective_budget["max_hops"] = int(new_budget)
                                hop_credits_earned += granted
                                hop_credit_events += 1
                    if lane_name in {"rfp_procurement_tenders", "annual_report", "governance_pdf"}:
                        procurement_validated += 1
                elif signal_state == "candidate":
                    pass_a_candidates += 1
            if lane_result["diagnostic"]:
                diagnostics.append(lane_result["diagnostic"])
            llm_last_status = lane_result["hop"].get("llm_last_status", llm_last_status)
            parse_path = lane_result["hop"].get("parse_path", parse_path)
            if progress_callback:
                await progress_callback(
                    {
                        "status": "running",
                        "pass": "A",
                        "lane": lane,
                        "iterations_completed": state["iterations_completed"],
                        "signals_discovered": len(signals),
                    }
                )

        adaptive_extended = False
        adaptive_candidate_mode = False
        if (
            pass_a_validated >= 2
            and procurement_validated == 0
            and state["iterations_completed"] < iteration_budget
        ):
            adaptive_cap = min(
                7,
                max(
                    iteration_budget,
                    int(iteration_budget) + 2,
                ),
            )
            if adaptive_cap > iteration_budget:
                iteration_budget = adaptive_cap
                objective_budget["max_hops"] = adaptive_cap
                adaptive_extended = True

        if (
            self.enable_agentic_router
            and pass_a_validated == 0
            and pass_a_candidates > 0
            and state["iterations_completed"] >= max(1, min(self.candidate_mode_trigger_hops, len(pass_a_lanes)))
            and state["iterations_completed"] < max(iteration_budget, self.candidate_mode_extended_hops)
        ):
            candidate_cap = min(
                max(iteration_budget, self.candidate_mode_extended_hops),
                max(iteration_budget, objective_budget["max_hops"] + 2),
            )
            if candidate_cap > iteration_budget:
                iteration_budget = candidate_cap
                objective_budget["max_hops"] = candidate_cap
                adaptive_candidate_mode = True

        pass_b_executed = False
        selected_pass_b_lanes: List[str] = []
        if (
            (pass_a_validated > 0 or (adaptive_candidate_mode and pass_a_candidates > 0))
            and state["iterations_completed"] < iteration_budget
        ):
            pass_b_executed = True
            selected_pass_b_lanes = await self._choose_lane_order_with_llm(
                entity_name=entity_name,
                objective=objective,
                pass_name="B",
                available_lanes=pass_b_lanes,
                state=state,
            )
            for lane in selected_pass_b_lanes:
                if state["iterations_completed"] >= iteration_budget:
                    break
                lane_result = await self._run_lane(
                    lane=lane,
                    entity_id=entity_id,
                    entity_name=entity_name,
                    dossier=dossier,
                    official_domain=official_domain,
                    state=state,
                    budget=objective_budget,
                    run_objective=objective,
                )
                hop_timings.append(lane_result["hop"])
                candidate_evaluations.extend(lane_result.get("candidate_evaluations") or [])
                state["iterations_completed"] += 1
                if lane_result["signal"]:
                    signals.append(lane_result["signal"])
                    if lane_result["signal"].get("validation_state") == "validated":
                        lane_name = str(lane_result["hop"].get("hop_type") or lane)
                        validated_candidate_count_by_lane[lane_name] = (
                            int(validated_candidate_count_by_lane.get(lane_name, 0) or 0) + 1
                        )
                        signal_id = str(lane_result["signal"].get("id") or "").strip()
                        if (
                            self.dynamic_hop_credits_enabled
                            and signal_id
                            and signal_id not in seen_validated_signal_ids
                        ):
                            seen_validated_signal_ids.add(signal_id)
                            credit_delta = max(0, int(self.dynamic_hop_credit_per_signal))
                            if credit_delta > 0 and iteration_budget < hop_credit_cap:
                                new_budget = min(hop_credit_cap, iteration_budget + credit_delta)
                                granted = max(0, new_budget - iteration_budget)
                                if granted > 0:
                                    iteration_budget = new_budget
                                    objective_budget["max_hops"] = int(new_budget)
                                    hop_credits_earned += granted
                                    hop_credit_events += 1
                if lane_result["diagnostic"]:
                    diagnostics.append(lane_result["diagnostic"])
                llm_last_status = lane_result["hop"].get("llm_last_status", llm_last_status)
                parse_path = lane_result["hop"].get("parse_path", parse_path)
                if progress_callback:
                    await progress_callback(
                        {
                            "status": "running",
                            "pass": "B",
                            "lane": lane,
                            "iterations_completed": state["iterations_completed"],
                            "signals_discovered": len(signals),
                        }
                    )

        validated_signals = [
            signal
            for signal in signals
            if str(signal.get("validation_state") or "") == "validated"
        ]
        candidate_signals = [
            signal
            for signal in signals
            if str(signal.get("validation_state") or "") == "candidate"
        ]
        all_events = [*signals, *diagnostics]
        entity_confidence = self._compute_entity_confidence(
            validated_signals,
            candidate_signals,
            state,
            hop_timings,
            permissive_mode=adaptive_candidate_mode,
        )
        pipeline_confidence = self._compute_pipeline_confidence(
            iterations=state["iterations_completed"],
            budget=iteration_budget,
            hop_timings=hop_timings,
            state=state,
            per_iteration_timeout=float(objective_budget["per_iteration_timeout"]),
        )
        final_confidence = round(max(0.0, min(1.0, entity_confidence * 0.8 + pipeline_confidence * 0.2)), 3)

        elapsed = round(time.perf_counter() - start, 3)
        performance_summary = {
            "run_profile": self.run_profile,
            "engine": "v2",
            "evaluation_mode": "evidence_first",
            "run_objective": objective,
            "parse_path": parse_path,
            "llm_last_status": llm_last_status,
            "entity_confidence": entity_confidence,
            "pipeline_confidence": pipeline_confidence,
            "hop_timings": hop_timings,
            "synthetic_url_attempt_count": int(self._metrics["synthetic_url_attempt_count"]),
            "dead_end_event_count": int(self._metrics["dead_end_event_count"]),
            "fallback_accept_block_count": int(self._metrics["fallback_accept_block_count"]),
            "llm_call_count": int(self._metrics["llm_call_count"]),
            "llm_fallback_count": int(self._metrics["llm_fallback_count"]),
            "length_stop_count": int(self._metrics["length_stop_count"]),
            "schema_fail_count": int(self._metrics["schema_fail_count"]),
            "empty_content_count": int(self._metrics["empty_content_count"]),
            "llm_hop_selection_count": int(self._metrics["llm_hop_selection_count"]),
            "planner_action_applied_count": int(self._metrics["planner_action_applied_count"]),
            "planner_action_parse_fail_count": int(self._metrics["planner_action_parse_fail_count"]),
            "planner_action_repair_retry_count": int(self._metrics["planner_action_repair_retry_count"]),
            "planner_action_parse_fail_samples": list(self._planner_parse_fail_samples[:5]),
            "strict_eval_metrics_by_model": self._build_strict_eval_metrics_by_model(),
            "entity_grounding_reject_count_by_lane": dict(
                self._quality_metrics.get("entity_grounding_reject_count_by_lane") or {}
            ),
            "pdf_binary_reject_count": int(self._quality_metrics.get("pdf_binary_reject_count") or 0),
            "non_english_source_reject_count": int(self._quality_metrics.get("non_english_source_reject_count") or 0),
            "off_entity_validated_signals": int(self._quality_metrics.get("off_entity_validated_signals") or 0),
            "llm_circuit_broken": bool(self._llm_circuit_broken),
            "skipped_enrichment_reasons": [],
            "objective_stage_durations": {
                "source_acquisition_seconds": round(sum(float(h.get("duration_ms") or 0.0) for h in hop_timings) / 1000.0, 3),
                "normalization_seconds": 0.0,
                "cheap_filters_seconds": 0.0,
                "structured_extraction_seconds": 0.0,
                "objective_scoring_seconds": 0.0,
            },
            "budget": objective_budget,
            "hop_budget_initial": initial_iteration_budget,
            "hop_budget_final": int(iteration_budget),
            "hop_credits_earned": int(hop_credits_earned),
            "hop_credit_events": int(hop_credit_events),
            "dynamic_hop_credits_enabled": bool(self.dynamic_hop_credits_enabled),
            "adaptive_candidate_mode_applied": adaptive_candidate_mode,
            "signals_total_events": len(all_events),
            "signals_validated_count": len(validated_signals),
            "signals_candidate_count": len(candidate_signals),
            "signals_diagnostic_count": len(diagnostics),
            "candidate_signals_count": len(candidate_signals),
            "two_pass": {
                "enabled": True,
                "pass_a": {
                    "iterations": min(len(pass_a_lanes), state["iterations_completed"]),
                    "validated_signals": pass_a_validated,
                    "candidate_signals": pass_a_candidates,
                    "selected_lanes": selected_pass_a_lanes,
                },
                "pass_b_executed": pass_b_executed,
                "pass_b_selected_lanes": selected_pass_b_lanes if pass_b_executed else [],
                "selected_result": "pass_b" if pass_b_executed else "pass_a",
                "adaptive_hop_extension_applied": adaptive_extended,
            },
            "duration_seconds": elapsed,
            "route_diversification_order": DIVERSIFIED_FALLBACK_ORDER,
            "hop_selector": "llm" if self.enable_llm_hop_selection else "deterministic",
            "candidate_evaluations_count": len(candidate_evaluations),
            "validated_candidate_count_by_lane": validated_candidate_count_by_lane,
        }

        confidence_band = "HIGH" if final_confidence >= 0.7 else "MEDIUM" if final_confidence >= 0.55 else "LOW"
        result = DiscoveryResultV2(
            entity_id=entity_id,
            entity_name=entity_name,
            final_confidence=final_confidence,
            confidence_band=confidence_band,
            is_actionable=final_confidence >= 0.55 and len(validated_signals) >= 2,
            iterations_completed=state["iterations_completed"],
            total_cost_usd=0.0,
            hypotheses=[],
            depth_stats={0: state["iterations_completed"]},
            signals_discovered=validated_signals,
            raw_signals=all_events,
            hypothesis_states={},
            performance_summary=performance_summary,
            entity_confidence=entity_confidence,
            pipeline_confidence=pipeline_confidence,
            parse_path=parse_path,
            llm_last_status=llm_last_status,
            candidate_evaluations=candidate_evaluations,
        )
        return result

    async def _run_lane(
        self,
        *,
        lane: str,
        entity_id: str = "",
        entity_name: str,
        dossier: Dict[str, Any],
        official_domain: Optional[str],
        state: Dict[str, Any],
        budget: Optional[Dict[str, Any]] = None,
        run_objective: Optional[str] = None,
    ) -> Dict[str, Any]:
        effective_budget = budget or {
            "max_hops": self.max_hops,
            "max_evals_per_hop": self.max_evals_per_hop,
            "per_iteration_timeout": self.per_iteration_timeout,
            "max_retries": self.max_retries,
            "max_same_domain_revisits": self.max_same_domain_revisits,
        }
        objective = normalize_run_objective(run_objective)
        started = time.perf_counter()
        hop_record: Dict[str, Any] = {
            "hop_type": lane,
            "candidate_origin": None,
            "source_tier": None,
            "validation_state": "diagnostic",
            "accept_guard_passed": False,
            "accept_reject_reasons": [],
            "evidence_quality_score": 0.0,
            "lane_exhausted": False,
            "dead_end_reason": None,
            "content_hash": None,
            "grounding_score": 0.0,
            "entity_domain_match": False,
            "language_ok": True,
            "pdf_text_quality_ok": True,
            "parse_path": "discovery_v2_evidence_first",
            "llm_last_status": "heuristic_only",
            "evidence_type": "discovery",
            "duration_ms": 0,
            "candidate_evaluations": [],
        }
        signal: Optional[Dict[str, Any]] = None
        diagnostic: Optional[Dict[str, Any]] = None
        candidate_evaluations: List[Dict[str, Any]] = []

        if lane in state["lane_exhausted"]:
            hop_record["lane_exhausted"] = True
            hop_record["dead_end_reason"] = "lane_already_exhausted"
            hop_record["evidence_type"] = "lane_exhaustion"
            hop_record["duration_ms"] = int((time.perf_counter() - started) * 1000)
            return {"hop": hop_record, "signal": None, "diagnostic": None}

        candidates = await self._discover_candidates(
            lane=lane,
            entity_id=entity_id,
            entity_name=entity_name,
            dossier=dossier,
            state=state,
            objective=objective,
        )
        if not candidates:
            self._mark_lane_dead(lane, state, "no_discovered_candidates")
            hop_record["lane_exhausted"] = True
            hop_record["dead_end_reason"] = "no_discovered_candidates"
            hop_record["evidence_type"] = "discovery_dead_end"
            hop_record["duration_ms"] = int((time.perf_counter() - started) * 1000)
            return {"hop": hop_record, "signal": None, "diagnostic": None}

        max_evals = max(1, int(effective_budget.get("max_evals_per_hop", self.max_evals_per_hop)))
        planner_batch_size = max(max_evals, min(len(candidates), 8))
        planner_candidates = candidates[:planner_batch_size]
        candidate_batch = candidates[:max_evals]
        pre_scraped_by_url: Dict[str, Dict[str, Any]] = {}
        planner_action = await self._choose_candidate_action_from_batch(
            lane=lane,
            entity_name=entity_name,
            candidates=planner_candidates,
            state=state,
            objective=objective,
        )
        if planner_action:
            hop_record["planner_action"] = planner_action
            if planner_action.get("action") in {"stop_lane", "stop_run"}:
                self._mark_lane_dead(lane, state, str(planner_action.get("action") or "planner_stop"))
                hop_record["lane_exhausted"] = True
                hop_record["dead_end_reason"] = str(planner_action.get("action") or "planner_stop")
                hop_record["evidence_type"] = "planner_stop"
                hop_record["duration_ms"] = int((time.perf_counter() - started) * 1000)
                return {"hop": hop_record, "signal": None, "diagnostic": None}
            if planner_action.get("action") == "scrape_candidate":
                chosen_index = int(planner_action.get("candidate_index") or 0)
                if 0 <= chosen_index < len(planner_candidates):
                    prioritized = planner_candidates[chosen_index]
                    candidate_batch = [prioritized] + [
                        candidate
                        for candidate in candidate_batch
                        if _normalize_url(candidate.get("url") or "") != _normalize_url(prioritized.get("url") or "")
                    ]
            if planner_action.get("action") == "same_domain_probe":
                probe_url = _normalize_url(str(planner_action.get("url") or ""))
                recovered = await self._recover_same_domain_probe(url=probe_url, budget=effective_budget)
                recovered_url = _normalize_url(str(recovered.get("url") or probe_url)) if recovered else ""
                if recovered and recovered_url:
                    probe_candidate = {
                        "url": recovered_url,
                        "title": str((recovered.get("metadata") or {}).get("title") or ""),
                        "snippet": str((recovered.get("metadata") or {}).get("snippet") or ""),
                        "candidate_origin": "nav",
                    }
                    candidate_batch = [probe_candidate] + [
                        candidate
                        for candidate in candidate_batch
                        if _normalize_url(candidate.get("url") or "") != recovered_url
                    ]
                    pre_scraped_by_url[recovered_url] = recovered
            if planner_action.get("action") == "search_queries":
                refined_queries = [
                    str(query or "").strip()
                    for query in list(planner_action.get("queries") or [])
                    if str(query or "").strip()
                ]
                if refined_queries:
                    refined_candidates = await self._discover_candidates(
                        lane=lane,
                        entity_id=entity_id,
                        entity_name=entity_name,
                        dossier=dossier,
                        state=state,
                        objective=objective,
                        query_overrides=refined_queries,
                    )
                    if refined_candidates:
                        planner_candidates = refined_candidates[:planner_batch_size]
                        candidate_batch = refined_candidates[:max_evals]
                        hop_record["planner_search_queries"] = refined_queries

        for candidate in candidate_batch:
            origin = str(candidate.get("candidate_origin") or "").strip().lower()
            if origin not in ALLOWED_CANDIDATE_ORIGINS:
                if origin == "synthetic":
                    self._metrics["synthetic_url_attempt_count"] += 1
                continue

            url = _normalize_url(candidate.get("url") or "")
            if not url:
                continue
            if url in state.get("rejected_urls", set()):
                self._register_lane_failure(lane, state, "rejected_url_prior_low_signal")
                continue
            domain_family = self._domain_family(url)
            if domain_family and int((state.get("rejected_domain_families") or {}).get(domain_family, 0) or 0) >= 2:
                self._register_lane_failure(lane, state, "rejected_domain_family")
                continue
            if url in state["visited_urls"]:
                self._register_lane_failure(lane, state, "duplicate_url")
                continue

            grounding_score = self._entity_match_score(candidate=candidate, entity_name=entity_name)
            entity_domain_match = self._is_entity_domain_match(url=url, official_domain=official_domain)
            language_ok = self._candidate_language_ok(lane=lane, url=url)
            if not self._candidate_passes_entity_grounding(
                lane=lane,
                candidate=candidate,
                entity_name=entity_name,
                official_domain=official_domain,
                grounding_score=grounding_score,
                dossier=dossier,
                language_ok=language_ok,
                strict=False,
            ):
                self._register_lane_failure(lane, state, "off_entity_candidate_prefilter")
                self._increment_entity_grounding_reject(lane)
                if not language_ok:
                    self._quality_metrics["non_english_source_reject_count"] = int(
                        self._quality_metrics.get("non_english_source_reject_count") or 0
                    ) + 1
                state.setdefault("rejected_urls", set()).add(url)
                if domain_family:
                    rejected_families = state.setdefault("rejected_domain_families", {})
                    rejected_families[domain_family] = int(rejected_families.get(domain_family, 0) or 0) + 1
                if self._lane_failure_count(lane, state) >= 2:
                    self._mark_lane_dead(lane, state, "off_entity_candidate_prefilter")
                continue

            host = (urlparse(url).hostname or "").lower()
            if host:
                revisit_count = int(state["domain_visits"].get(host, 0) or 0)
                if revisit_count >= int(
                    effective_budget.get("max_same_domain_revisits", self.max_same_domain_revisits)
                ):
                    self._register_lane_failure(lane, state, "same_domain_revisit_cap")
                    continue

            scraped = pre_scraped_by_url.get(url)
            if not scraped:
                scraped = await self._scrape_with_budget(url, budget=effective_budget)
            content = str(scraped.get("content") or "")
            metadata = scraped.get("metadata") if isinstance(scraped.get("metadata"), dict) else {}
            content_hash = hashlib.sha1(content.encode("utf-8", errors="ignore")).hexdigest() if content else None
            pdf_text_quality_ok = self._pdf_text_quality_ok(content=content)
            if not pdf_text_quality_ok and lane in {"rfp_procurement_tenders", "annual_report", "governance_pdf"}:
                self._quality_metrics["pdf_binary_reject_count"] = int(
                    self._quality_metrics.get("pdf_binary_reject_count") or 0
                ) + 1
                self._register_lane_failure(lane, state, "pdf_binary_or_xref_text")
                if self._lane_failure_count(lane, state) >= 2:
                    self._mark_lane_dead(lane, state, "pdf_binary_or_xref_text")
                continue

            low_signal_reason = self._low_signal_reason(lane=lane, url=url, content=content, metadata=metadata)
            if content_hash and content_hash in state["visited_hashes"]:
                self._register_lane_failure(lane, state, "duplicate_content_hash")
                low_signal_reason = low_signal_reason or "duplicate_content_hash"

            # Pre-judge quality gate: attempt one rehydration via same-domain rendered probe before rejecting.
            if low_signal_reason and lane in {"official_site", "press_release", "trusted_news", "careers"}:
                recovered = await self._recover_same_domain_probe(url=url, budget=effective_budget)
                recovered_content = str((recovered or {}).get("content") or "")
                if recovered and recovered_content and _safe_word_count(recovered_content) > _safe_word_count(content):
                    content = recovered_content
                    metadata = recovered.get("metadata") if isinstance(recovered.get("metadata"), dict) else metadata
                    content_hash = hashlib.sha1(content.encode("utf-8", errors="ignore")).hexdigest() if content else None
                    low_signal_reason = self._low_signal_reason(lane=lane, url=url, content=content, metadata=metadata)

            if low_signal_reason:
                self._register_lane_failure(lane, state, low_signal_reason)
                state.setdefault("rejected_urls", set()).add(url)
                low_signal_urls = state.setdefault("low_signal_urls", {})
                low_signal_urls[url] = int(low_signal_urls.get(url, 0) or 0) + 1
                if domain_family:
                    rejected_families = state.setdefault("rejected_domain_families", {})
                    rejected_families[domain_family] = int(rejected_families.get(domain_family, 0) or 0) + 1
                if self._lane_failure_count(lane, state) >= 2:
                    self._mark_lane_dead(lane, state, low_signal_reason)
                continue

            source_tier = self._source_tier(url=url, official_domain=official_domain)
            evidence = self._extract_evidence(
                lane=lane,
                entity_name=entity_name,
                content=content,
                title=str(candidate.get("title") or ""),
                snippet=str(candidate.get("snippet") or ""),
            )
            quality_score = float(evidence.get("quality_score") or 0.0)
            freshness_score = self._freshness_score_from_text(
                " ".join(
                    [
                        str(candidate.get("title") or ""),
                        str(candidate.get("snippet") or ""),
                        str(evidence.get("content_item") or ""),
                    ]
                )
            )
            quality_score = max(0.0, min(1.0, quality_score + max(-0.08, min(0.12, freshness_score))))
            evidence_snippet = str(evidence.get("snippet") or "").strip()
            accept_reject_reasons: List[str] = []
            validation_state = "candidate"

            if not evidence_snippet:
                accept_reject_reasons.append("empty_evidence_snippet")
            if not str(evidence.get("content_item") or "").strip():
                accept_reject_reasons.append("empty_content_item")
            if quality_score < self._quality_threshold_for_lane(lane):
                accept_reject_reasons.append("evidence_quality_below_threshold")
            if not self._is_evidence_grounded_in_content(
                snippet=evidence_snippet,
                content_item=str(evidence.get("content_item") or ""),
                content=content,
            ):
                accept_reject_reasons.append("evidence_not_grounded_in_source_content")
            if lane in {"rfp_procurement_tenders", "annual_report", "governance_pdf"}:
                procurement_text = " ".join(
                    [
                        evidence_snippet,
                        str(evidence.get("content_item") or ""),
                        str(candidate.get("title") or ""),
                        str(candidate.get("snippet") or ""),
                    ]
                )
                if not self._has_procurement_lexicon(procurement_text):
                    accept_reject_reasons.append("missing_procurement_lexicon")

            composite_acceptance_score = self._composite_acceptance_score(
                source_tier=source_tier,
                quality_score=quality_score,
                grounding_score=grounding_score,
                freshness_score=freshness_score,
                snippet=evidence_snippet,
                entity_name=entity_name,
            )
            if composite_acceptance_score < 0.52:
                accept_reject_reasons.append("composite_acceptance_below_threshold")

            signature = self._evidence_signature(url=url, lane=lane, snippet=evidence_snippet)
            if signature in state["accepted_signatures"]:
                accept_reject_reasons.append("duplicate_evidence_signature")
            if grounding_score < 0.52:
                accept_reject_reasons.append("entity_match_score_below_threshold")
            if not language_ok:
                accept_reject_reasons.append("non_english_source")

            if source_tier == "tier_3" and not self._has_tier12_corroboration(state, evidence):
                accept_reject_reasons.append("tier3_without_corroboration")
            if (
                lane in {"rfp_procurement_tenders", "annual_report", "governance_pdf"}
                and self._is_federation_entity(dossier=dossier, entity_name=entity_name)
                and not self._federation_procurement_source_allowed(
                    url=url,
                    official_domain=official_domain,
                    grounding_score=grounding_score,
                )
            ):
                accept_reject_reasons.append("federation_procurement_source_mismatch")

            accept_guard_passed = len(accept_reject_reasons) == 0
            if not accept_guard_passed and source_tier == "tier_3" and "tier3_without_corroboration" in accept_reject_reasons:
                self._metrics["fallback_accept_block_count"] += 1

            llm_eval = await self._maybe_llm_evaluate(
                lane=lane,
                entity_name=entity_name,
                url=url,
                evidence=evidence,
                run_objective=objective,
            )
            if llm_eval.get("parse_path"):
                hop_record["parse_path"] = llm_eval["parse_path"]
            if llm_eval.get("llm_last_status"):
                hop_record["llm_last_status"] = llm_eval["llm_last_status"]
            if llm_eval.get("decision") == "ACCEPT" and not accept_guard_passed:
                # Hard block: fallback/invalid evidence cannot become ACCEPT.
                self._metrics["fallback_accept_block_count"] += 1
            llm_decision = str(llm_eval.get("decision") or "NO_PROGRESS").strip().upper()
            positive_decision = llm_decision in {"ACCEPT", "WEAK_ACCEPT_CANDIDATE", "WEAK_ACCEPT"}
            llm_schema_invalid = (
                not bool(llm_eval.get("schema_valid", False))
                or str(llm_eval.get("llm_last_status") or "").strip().lower() in {"length_stop", "empty_response", "timeout"}
            )
            if llm_schema_invalid:
                accept_guard_passed = False
                accept_reject_reasons.append("llm_schema_invalid_demoted")
                self._metrics["fallback_accept_block_count"] += 1
            if accept_guard_passed and not positive_decision:
                # Deterministic promotion path:
                # If strict evidence guard already passed on grounded tier-1/2 evidence,
                # promote NO_PROGRESS to weak accept to avoid candidate-only deadlock.
                can_promote = (
                    lane == "trusted_news"
                    and source_tier in {"tier_1", "tier_2"}
                    and quality_score >= max(0.55, self._quality_threshold_for_lane(lane))
                    and bool(evidence_snippet)
                    and str(llm_decision) == "NO_PROGRESS"
                )
                if can_promote:
                    llm_decision = "WEAK_ACCEPT_CANDIDATE"
                    llm_eval["decision"] = "WEAK_ACCEPT_CANDIDATE"
                    llm_eval["reason_code"] = str(llm_eval.get("reason_code") or "evidence_promoted")
                    llm_eval["confidence_delta_bucket"] = str(llm_eval.get("confidence_delta_bucket") or "UP_2")
                    positive_decision = True
                else:
                    accept_guard_passed = False
                    accept_reject_reasons.append("llm_no_progress")
                    self._metrics["fallback_accept_block_count"] += 1

            if accept_guard_passed:
                validation_state = "validated"
            elif quality_score > 0.25 and evidence_snippet:
                validation_state = "candidate"
            else:
                validation_state = "diagnostic"

            if validation_state == "validated" and accept_guard_passed:
                state["accepted_signatures"].add(signature)
                for token in evidence.get("tokens", []):
                    state["trusted_corroboration_tokens"].add(token)

            evidence_pointer_id = None
            if content_hash:
                evidence_pointer_id = f"ev:{content_hash[:16]}"
            candidate_eval = {
                "step_type": "discovery_candidate_eval",
                "step_id": f"{lane}:{hashlib.md5(f'{url}|{content_hash or ''}'.encode('utf-8')).hexdigest()[:12]}",
                "status": "completed" if validation_state == "validated" else "rejected",
                "reason_code": str(llm_eval.get("reason_code") or "accept_guard"),
                "source_url": url,
                "source_tier": source_tier,
                "candidate_origin": origin,
                "decision": str(llm_eval.get("decision") or "NO_PROGRESS"),
                "confidence_delta_bucket": str(llm_eval.get("confidence_delta_bucket") or "NONE"),
                "evidence_pointer_ids": [evidence_pointer_id] if evidence_pointer_id else [],
                "content_hash": content_hash,
                "parse_path": str(llm_eval.get("parse_path") or hop_record["parse_path"]),
                "model_used": str(llm_eval.get("model_used") or ""),
                "schema_valid": bool(llm_eval.get("schema_valid", False)),
                "accept_guard_passed": bool(accept_guard_passed),
                "accept_reject_reasons": list(accept_reject_reasons),
                "validation_state": validation_state,
                "evidence_quality_score": quality_score,
                "freshness_score": freshness_score,
                "composite_acceptance_score": composite_acceptance_score,
                "grounding_score": grounding_score,
                "entity_domain_match": bool(entity_domain_match),
                "language_ok": bool(language_ok),
                "pdf_text_quality_ok": bool(pdf_text_quality_ok),
            }
            candidate_evaluations.append(candidate_eval)

            state["visited_urls"].add(url)
            if content_hash:
                state["visited_hashes"].add(content_hash)
            if host:
                state["domain_visits"][host] = int(state["domain_visits"].get(host, 0) or 0) + 1

            hop_record.update(
                {
                    "candidate_origin": origin,
                    "source_tier": source_tier,
                    "validation_state": validation_state,
                    "accept_guard_passed": bool(accept_guard_passed),
                    "accept_reject_reasons": accept_reject_reasons,
                    "evidence_quality_score": quality_score,
                    "freshness_score": freshness_score,
                    "composite_acceptance_score": composite_acceptance_score,
                    "content_hash": content_hash,
                    "url": url,
                    "lane_exhausted": False,
                    "dead_end_reason": None,
                    "candidate_micro_eval": {
                        "decision": candidate_eval["decision"],
                        "reason_code": candidate_eval["reason_code"],
                        "confidence_delta_bucket": candidate_eval["confidence_delta_bucket"],
                    },
                    "grounding_score": grounding_score,
                    "entity_domain_match": bool(entity_domain_match),
                    "language_ok": bool(language_ok),
                    "pdf_text_quality_ok": bool(pdf_text_quality_ok),
                }
            )

            signal = {
                "id": f"{lane}:{hashlib.md5(signature.encode('utf-8')).hexdigest()[:10]}",
                "type": "DISCOVERY_SIGNAL",
                "subtype": lane.upper(),
                "statement": evidence.get("statement") or f"{entity_name} signal from {lane}",
                "text": evidence.get("statement") or f"{entity_name} signal from {lane}",
                "confidence": round(min(0.95, 0.35 + quality_score * 0.55), 3),
                "url": url,
                "candidate_origin": origin,
                "source_tier": source_tier,
                "validation_state": validation_state,
                "accept_guard_passed": bool(accept_guard_passed),
                "accept_reject_reasons": accept_reject_reasons,
                "evidence_quality_score": quality_score,
                "freshness_score": freshness_score,
                "composite_acceptance_score": composite_acceptance_score,
                "lane_exhausted": False,
                "dead_end_reason": None,
                "content_hash": content_hash,
                "evidence_found": evidence_snippet,
                "content": str(evidence.get("content_item") or ""),
                "evidence_pointer_ids": [evidence_pointer_id] if evidence_pointer_id else [],
                "parse_path": hop_record["parse_path"],
                "llm_last_status": hop_record["llm_last_status"],
                "reason_code": candidate_eval["reason_code"],
                "model_used": candidate_eval["model_used"],
                "schema_valid": candidate_eval["schema_valid"],
                "grounding_score": grounding_score,
                "entity_domain_match": bool(entity_domain_match),
                "language_ok": bool(language_ok),
                "pdf_text_quality_ok": bool(pdf_text_quality_ok),
            }
            if signal["validation_state"] == "diagnostic":
                diagnostic = signal
                signal = None
            if validation_state == "validated" and not self._candidate_passes_entity_grounding(
                lane=lane,
                candidate=candidate,
                entity_name=entity_name,
                official_domain=official_domain,
                grounding_score=grounding_score,
                dossier=dossier,
                language_ok=language_ok,
                strict=True,
            ):
                self._quality_metrics["off_entity_validated_signals"] = int(
                    self._quality_metrics.get("off_entity_validated_signals") or 0
                ) + 1
            break

        if signal is None and diagnostic is None and not hop_record.get("url"):
            if lane not in state["lane_exhausted"] and self._lane_failure_count(lane, state) >= 2:
                self._mark_lane_dead(lane, state, "no_progress_repeated")
            hop_record["lane_exhausted"] = lane in state["lane_exhausted"]
            hop_record["dead_end_reason"] = (
                "no_progress_repeated" if hop_record["lane_exhausted"] else "no_eligible_candidate"
            )
            hop_record["evidence_type"] = "discovery_dead_end"

        hop_record["duration_ms"] = int((time.perf_counter() - started) * 1000)
        hop_record["candidate_evaluations"] = candidate_evaluations
        return {
            "hop": hop_record,
            "signal": signal,
            "diagnostic": diagnostic,
            "candidate_evaluations": candidate_evaluations,
        }

    async def _discover_candidates(
        self,
        *,
        lane: str,
        entity_id: str = "",
        entity_name: str,
        dossier: Dict[str, Any],
        state: Dict[str, Any],
        objective: str,
        query_overrides: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        queries = await self._build_agentic_queries(
            lane=lane,
            entity_name=entity_name,
            dossier=dossier,
            objective=objective,
            query_overrides=query_overrides,
        )
        discovered: List[Dict[str, Any]] = []
        seen: Set[str] = set()

        # Include known canonical source as discovered candidate, not synthetic.
        canonical = (dossier.get("metadata", {}) if isinstance(dossier, dict) else {}).get("canonical_sources", {})
        official = canonical.get("official_site") if isinstance(canonical, dict) else None
        official_domain = (urlparse(str(official or "")).hostname or "").lower().lstrip("www.")
        if not official_domain:
            official_domain = None
        if lane == "official_site" and isinstance(official, str) and official.strip():
            normalized = _normalize_url(official.strip())
            if normalized:
                discovered.append(
                    {
                        "url": normalized,
                        "title": f"{entity_name} official site",
                        "snippet": "Known canonical source",
                        "candidate_origin": "known_doc_index",
                    }
                )
                seen.add(normalized)
            # Proactively add common high-yield same-domain paths for official-site discovery.
            for seeded_url in self._seed_same_domain_probe_urls(official_url=str(official or "")):
                normalized_seed = _normalize_url(seeded_url)
                if not normalized_seed or normalized_seed in seen:
                    continue
                seen.add(normalized_seed)
                discovered.append(
                    {
                        "url": normalized_seed,
                        "title": f"{entity_name} official section",
                        "snippet": "Seeded same-domain high-yield route",
                        "candidate_origin": "same_domain_seed",
                    }
                )
        if (
            objective == "rfp_pdf"
            and lane in {"governance_pdf", "annual_report", "rfp_procurement_tenders"}
            and official_domain
        ):
            indexed = await self._discover_official_pdf_candidates(
                entity_id=entity_id,
                entity_name=entity_name,
                official_url=str(official or ""),
                official_domain=official_domain,
                state=state,
            )
            for item in indexed:
                if not isinstance(item, dict):
                    continue
                normalized = _normalize_url(item.get("url") or "")
                if not normalized or normalized in seen:
                    continue
                seen.add(normalized)
                discovered.append(item)

        for raw_query in queries[: max(1, self.queries_per_lane)]:
            query = raw_query.format(entity=entity_name)
            try:
                response = await self.brightdata_client.search_engine(
                    query=query,
                    engine="google",
                    num_results=max(self.num_results, self.num_results * max(1, self.serp_pages_per_query)),
                )
            except Exception as search_error:  # noqa: BLE001
                logger.warning("Discovery v2 search failed (lane=%s query=%s): %s", lane, query, search_error)
                continue
            results = response.get("results") if isinstance(response, dict) else []
            if not isinstance(results, list):
                continue
            for item in results:
                if not isinstance(item, dict):
                    continue
                normalized = _normalize_url(item.get("url") or "")
                if not normalized or normalized in seen:
                    continue
                seen.add(normalized)
                discovered.append(
                    {
                        "url": normalized,
                        "title": str(item.get("title") or ""),
                        "snippet": str(item.get("snippet") or ""),
                        "candidate_origin": "search",
                        "query_used": query,
                    }
                )

        ranked = sorted(
            discovered,
            key=lambda candidate: (
                self._rfp_tier_priority(candidate=candidate, official_domain=official_domain)
                if lane == "rfp_procurement_tenders"
                else 0.0,
                self._candidate_score(
                    candidate,
                    lane=lane,
                    entity_name=entity_name,
                    official_domain=official_domain,
                    state=state,
                ),
            ),
            reverse=True,
        )
        return ranked

    async def _discover_official_pdf_candidates(
        self,
        *,
        entity_id: str = "",
        entity_name: str,
        official_url: str,
        official_domain: str,
        state: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        cache_key = f"pdf_index::{official_domain}"
        cached = state.get(cache_key)
        if isinstance(cached, list):
            return cached
        disk_cached = self._load_doc_index_cache(entity_id=entity_id, official_domain=official_domain)
        if disk_cached:
            state[cache_key] = disk_cached
            return disk_cached

        discovered: List[Dict[str, Any]] = []
        seen: Set[str] = set()
        base_url = self._canonical_official_base_url(official_url=official_url, official_domain=official_domain)

        sitemap_candidates = await self._discover_pdf_urls_from_sitemap(base_url=base_url, official_domain=official_domain)
        for url in sitemap_candidates:
            normalized = _normalize_url(url)
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            discovered.append(
                {
                    "url": normalized,
                    "title": f"{entity_name} sitemap document",
                    "snippet": "Official-domain sitemap indexed document candidate",
                    "candidate_origin": "sitemap",
                    "discovery_source": "official_doc_index",
                }
            )

        nav_candidates = await self._discover_pdf_urls_from_nav(base_url=base_url, official_domain=official_domain)
        for url in nav_candidates:
            normalized = _normalize_url(url)
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            discovered.append(
                {
                    "url": normalized,
                    "title": f"{entity_name} crawled document",
                    "snippet": "Official-domain navigational document candidate",
                    "candidate_origin": "crawl",
                    "discovery_source": "official_doc_index",
                }
            )

        truncated = discovered[: int(self.doc_index_cache_max_urls)]
        state[cache_key] = truncated
        self._save_doc_index_cache(
            entity_id=entity_id,
            official_domain=official_domain,
            items=truncated,
        )
        return truncated

    def _doc_index_cache_path(self, *, entity_id: str, official_domain: str) -> Path:
        safe_entity = re.sub(r"[^a-z0-9._-]+", "-", str(entity_id or "entity").strip().lower()).strip("-") or "entity"
        safe_domain = re.sub(r"[^a-z0-9._-]+", "-", str(official_domain or "domain").strip().lower()).strip("-") or "domain"
        return self.doc_index_cache_dir / f"{safe_entity}__{safe_domain}.json"

    def _load_doc_index_cache(self, *, entity_id: str, official_domain: str) -> List[Dict[str, Any]]:
        path = self._doc_index_cache_path(entity_id=entity_id, official_domain=official_domain)
        if not path.exists():
            return []
        try:
            payload = json.loads(path.read_text())
        except Exception:
            return []
        if not isinstance(payload, dict):
            return []
        created_at = float(payload.get("created_at") or 0.0)
        if created_at <= 0 or (time.time() - created_at) > float(self.doc_index_cache_ttl_seconds):
            return []
        items = payload.get("items")
        if not isinstance(items, list):
            return []
        valid: List[Dict[str, Any]] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            normalized = _normalize_url(item.get("url") or "")
            if not normalized:
                continue
            valid.append(
                {
                    "url": normalized,
                    "title": str(item.get("title") or "Cached official document"),
                    "snippet": str(item.get("snippet") or "Cached official-domain document candidate"),
                    "candidate_origin": str(item.get("candidate_origin") or "known_doc_index"),
                    "discovery_source": str(item.get("discovery_source") or "official_doc_index_cache"),
                }
            )
        return valid[: int(self.doc_index_cache_max_urls)]

    def _save_doc_index_cache(
        self,
        *,
        entity_id: str,
        official_domain: str,
        items: List[Dict[str, Any]],
    ) -> None:
        path = self._doc_index_cache_path(entity_id=entity_id, official_domain=official_domain)
        payload = {
            "entity_id": entity_id,
            "official_domain": official_domain,
            "created_at": time.time(),
            "items": items[: int(self.doc_index_cache_max_urls)],
        }
        try:
            path.write_text(json.dumps(payload, indent=2))
        except Exception:
            return

    @staticmethod
    def _canonical_official_base_url(*, official_url: str, official_domain: str) -> str:
        normalized = _normalize_url(official_url)
        if normalized:
            parsed = urlparse(normalized)
            return f"{parsed.scheme}://{parsed.netloc}"
        return f"https://{official_domain.lstrip('www.')}"

    @staticmethod
    def _seed_same_domain_probe_urls(*, official_url: str) -> List[str]:
        normalized = _normalize_url(official_url)
        if not normalized:
            return []
        parsed = urlparse(normalized)
        root = f"{parsed.scheme}://{parsed.netloc}/"
        seeded_paths = (
            "news",
            "commercial",
            "partners",
            "careers",
            "procurement",
            "tenders",
            "suppliers",
        )
        urls = [root.rstrip("/")]
        for path in seeded_paths:
            urls.append(urljoin(root, f"{path}/").rstrip("/"))
        return list(dict.fromkeys(urls))

    async def _discover_pdf_urls_from_sitemap(self, *, base_url: str, official_domain: str) -> List[str]:
        root = base_url.rstrip("/")
        sitemap_urls = [
            f"{root}/sitemap.xml",
            f"{root}/sitemap_index.xml",
            f"{root}/sitemap-index.xml",
            f"{root}/wp-sitemap.xml",
        ]
        discovered: Set[str] = set()
        pending = list(sitemap_urls)
        visited: Set[str] = set()
        max_sitemaps = 5

        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            while pending and len(visited) < max_sitemaps:
                sitemap_url = pending.pop(0)
                if sitemap_url in visited:
                    continue
                visited.add(sitemap_url)
                try:
                    response = await client.get(sitemap_url)
                except Exception:
                    continue
                if response.status_code != 200:
                    continue
                body = response.text or ""
                locs = re.findall(r"<loc>(.*?)</loc>", body, flags=re.IGNORECASE)
                for loc in locs:
                    candidate = _normalize_url(loc)
                    if not candidate:
                        continue
                    host = (urlparse(candidate).hostname or "").lower().lstrip("www.")
                    if not host.endswith(official_domain):
                        continue
                    lower = candidate.lower()
                    if lower.endswith(".xml") and len(visited) + len(pending) < max_sitemaps:
                        pending.append(candidate)
                        continue
                    if self._looks_like_pdf_signal_url(candidate):
                        discovered.add(candidate)

        return sorted(discovered)[:24]

    async def _discover_pdf_urls_from_nav(self, *, base_url: str, official_domain: str) -> List[str]:
        probe_urls = [
            base_url,
            f"{base_url.rstrip('/')}/procurement",
            f"{base_url.rstrip('/')}/tenders",
            f"{base_url.rstrip('/')}/documents",
        ]
        discovered: Set[str] = set()
        for page_url in probe_urls:
            html = await self._fetch_raw_html_for_indexing(page_url)
            if not html:
                continue
            for href in re.findall(r'href=[\"\']([^\"\']+)[\"\']', html, flags=re.IGNORECASE):
                resolved = _normalize_url(urljoin(page_url, href))
                if not resolved:
                    continue
                host = (urlparse(resolved).hostname or "").lower().lstrip("www.")
                if not host.endswith(official_domain):
                    continue
                if self._looks_like_pdf_signal_url(resolved):
                    discovered.add(resolved)
        return sorted(discovered)[:24]

    async def _fetch_raw_html_for_indexing(self, url: str) -> str:
        try:
            response = await self.brightdata_client.scrape_as_markdown(url)
        except Exception:
            response = None
        if isinstance(response, dict):
            raw_html = str(response.get("raw_html") or "")
            if raw_html:
                return raw_html
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                fallback = await client.get(url)
            if fallback.status_code == 200:
                return str(fallback.text or "")
        except Exception:
            return ""
        return ""

    @staticmethod
    def _looks_like_pdf_signal_url(url: str) -> bool:
        lower = str(url or "").lower()
        if not lower:
            return False
        if lower.endswith(".pdf"):
            return True
        return any(
            token in lower
            for token in (
                "procurement",
                "tender",
                "rfp",
                "supplier",
                "request-for-proposal",
                "invitation-to-tender",
            )
        )

    async def _build_agentic_queries(
        self,
        *,
        lane: str,
        entity_name: str,
        dossier: Dict[str, Any],
        objective: str,
        query_overrides: Optional[List[str]] = None,
    ) -> List[str]:
        base_queries = list(LANE_QUERIES.get(lane, ('"{entity}" digital procurement',)))
        metadata = dossier.get("metadata") if isinstance(dossier, dict) else {}
        canonical = metadata.get("canonical_sources") if isinstance(metadata, dict) else {}
        official = canonical.get("official_site") if isinstance(canonical, dict) else None
        if not official and isinstance(metadata, dict):
            official = (
                metadata.get("website")
                or metadata.get("entity_website")
                or metadata.get("official_site_url")
            )
        official_host = (urlparse(str(official or "")).hostname or "").lower().lstrip("www.")
        if not official_host:
            official_host = (self._official_domain(entity_name=entity_name, dossier=dossier) or "").lower().lstrip("www.")
        entity_aliases = self._entity_aliases(entity_name=entity_name, official_host=official_host)

        query_pool: List[str] = []
        if isinstance(query_overrides, list):
            for query in query_overrides:
                text = str(query or "").strip()
                if text:
                    query_pool.append(text)
        query_pool.extend(base_queries)
        if official_host:
            if lane == "official_site":
                query_pool.insert(0, f'site:{official_host} "{entity_name}" official')
            else:
                query_pool.append(
                    f'site:{official_host} "{entity_name}" {"procurement tender" if lane == "rfp_procurement_tenders" else "news jobs partnership"}'
                )
        if lane in {"rfp_procurement_tenders", "annual_report", "governance_pdf"}:
            query_pool.append(f'"{entity_name}" filetype:pdf procurement tender supplier')
            query_pool.append(f'"{entity_name}" filetype:pdf annual report governance')
            if official_host:
                query_pool.append(f'site:{official_host} filetype:pdf procurement tender supplier')
                query_pool.append(f'site:{official_host} filetype:pdf rfp tender')
                query_pool.append(f'site:{official_host} filetype:pdf procurement')
                query_pool.append(f'site:{official_host} filetype:pdf tender')
                query_pool.append(f'site:{official_host} "request for proposal" filetype:pdf')
                query_pool.append(f'site:{official_host} "invitation to tender" filetype:pdf')
                query_pool.append(f'site:{official_host} supplier procurement')
                query_pool.append(f'site:{official_host} tender procurement')
        if objective in {"rfp_web", "rfp_pdf"} and lane in {"press_release", "trusted_news", "careers"}:
            query_pool.append(f'"{entity_name}" CEO "head of digital" "commercial" linkedin')
            query_pool.append(f'"{entity_name}" NTT data partnership digital transformation')
            if objective == "rfp_pdf" and official_host:
                for alias in entity_aliases[:2]:
                    query_pool.append(f'site:{official_host} "{alias}" filetype:pdf tender')
                    query_pool.append(f'site:{official_host} "{alias}" filetype:pdf procurement')
                    query_pool.append(f'site:{official_host} "{alias}" "request for proposal"')
        if lane in {"official_site", "trusted_news"}:
            query_pool.append(f'"{entity_name}" bbc sport')
            query_pool.append(f'"{entity_name}" official club site')
        if lane in {"careers", "linkedin_jobs"}:
            query_pool.append(f'site:linkedin.com/in "{entity_name}" "Head of Digital"')
            query_pool.append(f'site:linkedin.com/in "{entity_name}" "Chief Executive Officer"')
            query_pool.append(f'site:linkedin.com/in "{entity_name}" "Marketing Director"')

        if self.enable_llm_hop_selection and not self._llm_circuit_broken:
            prompt = (
                "Return strict JSON only with key queries (array of search query strings).\n"
                f"Entity: {entity_name}\nObjective: {objective}\nLane: {lane}\n"
                f"Seed queries: {query_pool[:5]}\n"
                "Generate up to 3 concise, high-yield queries with strong entity grounding."
            )
            try:
                response = await self.claude_client.query(
                    prompt=prompt,
                    model="haiku",
                    max_tokens=180,
                    json_mode=False,
                    max_retries_override=0,
                    empty_retries_before_fallback_override=1,
                    fast_fail_on_length=False,
                )
                payload = None
                structured_output = (response or {}).get("structured_output")
                if isinstance(structured_output, dict):
                    payload = structured_output
                if not payload:
                    payload = self._extract_json_object_strict((response or {}).get("content"))
                llm_queries = payload.get("queries") if isinstance(payload, dict) else None
                if isinstance(llm_queries, list):
                    for query in llm_queries:
                        text = str(query or "").strip()
                        if text:
                            query_pool.insert(0, text)
            except Exception:  # noqa: BLE001
                pass

        # Force entity/domain anchoring in official/press lanes to avoid broad league/federation drift.
        if lane in {"official_site", "press_release", "trusted_news"}:
            anchored_pool: List[str] = []
            anchor_phrase = f"\"{entity_name}\""
            for query in query_pool:
                text = str(query or "").strip()
                if not text:
                    continue
                if anchor_phrase.lower() not in text.lower():
                    text = f"{anchor_phrase} {text}"
                if official_host and f"site:{official_host}" not in text.lower():
                    text = f"site:{official_host} {text}"
                anchored_pool.append(text)
            query_pool = anchored_pool or query_pool

        deduped: List[str] = []
        seen_queries: Set[str] = set()
        for query in query_pool:
            text = str(query or "").strip()
            if not text or text in seen_queries:
                continue
            seen_queries.add(text)
            deduped.append(text)
        return deduped

    async def _scrape_with_budget(self, url: str, *, budget: Dict[str, Any]) -> Dict[str, Any]:
        last_error = None
        max_retries = max(1, int(budget.get("max_retries", self.max_retries)))
        timeout_seconds = float(budget.get("per_iteration_timeout", self.per_iteration_timeout))
        for _attempt in range(max_retries):
            try:
                return await asyncio.wait_for(
                    self.brightdata_client.scrape_as_markdown(url),
                    timeout=timeout_seconds,
                )
            except Exception as scrape_error:  # noqa: BLE001
                last_error = scrape_error
        return {
            "status": "error",
            "url": url,
            "content": "",
            "metadata": {"error": str(last_error) if last_error else "scrape_failed"},
        }

    async def _recover_same_domain_probe(self, *, url: str, budget: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        recover = getattr(self.brightdata_client, "_recover_with_domain_probe", None)
        if not callable(recover):
            return None
        timeout_seconds = float(budget.get("per_iteration_timeout", self.per_iteration_timeout))
        try:
            recovered = await asyncio.wait_for(recover(url), timeout=timeout_seconds)
        except Exception:  # noqa: BLE001
            return None
        if not isinstance(recovered, dict):
            return None
        if str(recovered.get("status") or "").lower() != "success":
            return None
        if not str(recovered.get("content") or "").strip():
            return None
        recovered.setdefault("metadata", {})
        recovered["metadata"]["recovery_action"] = "same_domain_probe"
        recovered["metadata"]["probe_seed_url"] = url
        return recovered

    def _candidate_score(
        self,
        candidate: Dict[str, Any],
        *,
        lane: str,
        entity_name: str,
        official_domain: Optional[str] = None,
        state: Optional[Dict[str, Any]] = None,
    ) -> float:
        score = 0.0
        url = str(candidate.get("url") or "").lower()
        title = str(candidate.get("title") or "").lower()
        snippet = str(candidate.get("snippet") or "").lower()
        text = f"{title} {snippet} {url}"
        host = (urlparse(url).hostname or "").lower().lstrip("www.")
        source_tier = self._source_tier(url=url, official_domain=official_domain)

        if entity_name.lower() in text:
            score += 0.35
        for token in LANE_KEYWORDS.get(lane, ()):
            if token in text:
                score += 0.12
        if official_domain and (host == official_domain or host.endswith(f".{official_domain}")):
            score += 0.35
        if source_tier == "tier_1":
            score += 0.25
        elif source_tier == "tier_2":
            score += 0.12
        else:
            score -= 0.06
        if url.endswith(".pdf"):
            score += 0.08 if lane in {"annual_report", "governance_pdf"} else -0.05
        if "linkedin.com/jobs" in url and lane == "linkedin_jobs":
            score += 0.2
        if lane in {"press_release", "trusted_news"} and any(domain in url for domain in TRUSTED_NEWS_DOMAINS):
            score += 0.2
        if any(domain in url for domain in HIGH_PRIORITY_REFERENCE_DOMAINS):
            score += 0.1
        if lane in {"careers", "linkedin_jobs"} and "linkedin.com/in/" in url:
            score += 0.04
        if lane in {"official_site", "trusted_news"} and "wikipedia.org/wiki/" in url:
            score -= 0.1
        if lane == "trusted_news" and ("bbc.com/sport" in url or "bbc.co.uk/sport" in url):
            score += 0.16
        if lane in {"rfp_procurement_tenders", "annual_report", "governance_pdf", "careers", "linkedin_jobs"}:
            if any(domain in host for domain in LOW_AUTHORITY_DOMAIN_HINTS):
                score -= 0.5
            if any(marker in host for marker in ("edemocracy.", "charitycommission.", "gov.uk", "locality.org.uk")):
                score -= 0.35
        if lane == "rfp_procurement_tenders":
            source_tier = self._source_tier(url=url, official_domain=official_domain)
            origin = str(candidate.get("candidate_origin") or "").strip().lower()
            if source_tier == "tier_1":
                score += 0.45
            elif source_tier == "tier_2":
                score += 0.16
            else:
                score -= 0.22
            if origin in {"known_doc_index", "sitemap", "crawl"}:
                score += 0.35
            if origin == "search":
                score += 0.08
            if any(token in url for token in ("procurement", "tender", "rfp", "request-for-proposal", "supplier")):
                score += 0.24
            if url.endswith(".pdf"):
                score += 0.18
        if state:
            domain_visits = state.get("domain_visits", {})
            if host and int(domain_visits.get(host, 0) or 0) > 0:
                score -= 0.22
            domain_family = self._domain_family(url)
            if domain_family and int((state.get("rejected_domain_families") or {}).get(domain_family, 0) or 0) > 0:
                score -= 0.25
            rejected_urls = state.get("rejected_urls", set())
            normalized = _normalize_url(url)
            if isinstance(rejected_urls, set) and normalized and normalized in rejected_urls:
                score -= 0.5
            low_signal = state.get("low_signal_urls", {})
            low_signal_count = int((low_signal or {}).get(normalized, 0) or 0) if normalized else 0
            if low_signal_count > 0:
                score -= min(0.4, low_signal_count * 0.15)
        score += self._freshness_score_from_text(text)
        return score

    def _rfp_tier_priority(self, *, candidate: Dict[str, Any], official_domain: Optional[str]) -> float:
        url = str(candidate.get("url") or "").strip()
        origin = str(candidate.get("candidate_origin") or "").strip().lower()
        source_tier = self._source_tier(url=url, official_domain=official_domain)
        priority = 0.0
        if source_tier == "tier_1":
            priority += 2.0
        elif source_tier == "tier_2":
            priority += 1.0
        if origin in {"known_doc_index", "sitemap", "crawl"}:
            priority += 0.8
        elif origin == "search":
            priority += 0.2
        lowered = url.lower()
        if lowered.endswith(".pdf"):
            priority += 0.4
        if any(token in lowered for token in ("procurement", "tender", "rfp", "supplier")):
            priority += 0.4
        return priority

    @staticmethod
    def _domain_family(url: str) -> str:
        host = (urlparse(url).hostname or "").lower().lstrip("www.")
        if not host:
            return ""
        parts = host.split(".")
        if len(parts) < 2:
            return host
        # Keep a stable family key for common second-level domains.
        if parts[-2] in {"co", "org", "gov", "ac"} and len(parts) >= 3:
            return ".".join(parts[-3:])
        return ".".join(parts[-2:])

    @staticmethod
    def _freshness_score_from_text(text: str) -> float:
        value = str(text or "")
        if not value:
            return 0.0
        now_year = datetime.now(timezone.utc).year
        years = [int(match) for match in re.findall(r"\b(20\d{2})\b", value) if 2000 <= int(match) <= now_year + 1]
        if not years:
            return 0.0
        newest = max(years)
        age = max(0, now_year - newest)
        if age <= 1:
            return 0.12
        if age <= 3:
            return 0.06
        if age <= 5:
            return -0.03
        return -0.1

    def _extract_evidence(
        self,
        *,
        lane: str,
        entity_name: str,
        content: str,
        title: str,
        snippet: str,
    ) -> Dict[str, Any]:
        content_norm = self._normalize_extracted_text(str(content or ""))
        title_norm = self._normalize_extracted_text(str(title or ""))
        snippet_norm = self._normalize_extracted_text(str(snippet or ""))
        lower = content_norm.lower()
        keywords = LANE_KEYWORDS.get(lane, ())
        tokens: List[str] = []
        for keyword in keywords:
            if keyword in lower:
                tokens.append(keyword)
        if entity_name.lower() in lower:
            tokens.append(entity_name.lower())
        deterministic_hits = self._extract_deterministic_signal_hits(content_norm)
        if deterministic_hits:
            tokens.extend(deterministic_hits)

        lines = [line.strip() for line in content_norm.splitlines() if line.strip()]
        best_line = ""
        for line in lines:
            line_lower = line.lower()
            if any(token in line_lower for token in keywords):
                best_line = self._truncate_word_boundary(line, max_chars=360)
                break
        if not best_line:
            best_line = self._truncate_word_boundary((snippet_norm or title_norm or ""), max_chars=240)

        content_passages = self._extract_content_passages(
            content=content_norm,
            entity_name=entity_name,
            keywords=keywords,
        )
        content_item = best_line or (
            self._truncate_word_boundary(lines[0], max_chars=240) if lines else ""
        )
        quality_score = 0.0
        quality_score += min(0.45, len(tokens) * 0.12)
        quality_score += min(0.35, _safe_word_count(content_norm) / 1500.0)
        if best_line:
            quality_score += 0.2
        if deterministic_hits:
            quality_score += min(0.18, len(deterministic_hits) * 0.04)
        quality_score = max(0.0, min(1.0, quality_score))
        statement = f"{entity_name}: {best_line}" if best_line else f"{entity_name} {lane} signal"
        return {
            "snippet": best_line,
            "content_item": content_item,
            "content_passages": content_passages,
            "quality_score": quality_score,
            "statement": statement,
            "tokens": tokens,
            "deterministic_hits": deterministic_hits,
        }

    @staticmethod
    def _extract_deterministic_signal_hits(content: str) -> List[str]:
        text = str(content or "").lower()
        if not text:
            return []
        patterns = {
            "partnership": r"\b(partnership|principal partner|sponsorship)\b",
            "procurement": r"\b(procurement|tender|rfp|request for proposal|supplier)\b",
            "hiring": r"\b(careers|vacancies|hiring|job opening)\b",
            "leadership": r"\b(chief executive|ceo|head of|director)\b",
        }
        hits: List[str] = []
        for key, pattern in patterns.items():
            if re.search(pattern, text):
                hits.append(key)
        return hits

    def _extract_content_passages(
        self,
        *,
        content: str,
        entity_name: str,
        keywords: Tuple[str, ...],
    ) -> List[str]:
        normalized = self._normalize_extracted_text(content)
        if not normalized:
            return []

        raw_passages = [line.strip() for line in normalized.splitlines() if line.strip()]
        if len(raw_passages) <= 1:
            raw_passages = [segment.strip() for segment in re.split(r"(?<=[.!?])\s+", normalized) if segment.strip()]

        chosen: List[str] = []
        seen: Set[str] = set()
        entity_lower = entity_name.lower()
        for passage in raw_passages:
            lowered = passage.lower()
            if entity_lower not in lowered and not any(keyword in lowered for keyword in keywords):
                continue
            trimmed = self._truncate_word_boundary(passage, max_chars=280)
            key = trimmed.lower()
            if not trimmed or key in seen:
                continue
            seen.add(key)
            chosen.append(trimmed)
            if len(chosen) >= 4:
                break

        if chosen:
            return chosen
        fallback = self._truncate_word_boundary(normalized, max_chars=280)
        return [fallback] if fallback else []

    @staticmethod
    def _normalize_extracted_text(text: str) -> str:
        value = str(text or "").strip()
        if not value:
            return ""
        # Scrapes from JS-heavy pages often collapse boundaries; restore common breaks.
        value = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", value)
        value = re.sub(r"(?<=[A-Za-z])(?=[0-9])", " ", value)
        value = re.sub(r"(?<=[0-9])(?=[A-Za-z])", " ", value)
        value = " ".join(value.split())
        return value

    @staticmethod
    def _truncate_word_boundary(text: str, *, max_chars: int) -> str:
        value = str(text or "").strip()
        if max_chars <= 0:
            return ""
        if len(value) <= max_chars:
            return value
        cut = max(1, max_chars - 1)
        trimmed = value[:cut].rstrip()
        if " " in trimmed:
            trimmed = trimmed.rsplit(" ", 1)[0].rstrip()
        if not trimmed:
            trimmed = value[:cut].rstrip()
        return f"{trimmed}..."

    async def _maybe_llm_evaluate(
        self,
        *,
        lane: str,
        entity_name: str,
        url: str,
        evidence: Dict[str, Any],
        run_objective: Optional[str] = None,
    ) -> Dict[str, Any]:
        objective = normalize_run_objective(run_objective)
        if self._llm_circuit_broken:
            return {
                "decision": "NO_PROGRESS",
                "parse_path": "llm_circuit_open",
                "llm_last_status": "length_stop",
            }
        if not self.enable_llm_eval:
            return {
                "decision": "WEAK_ACCEPT_CANDIDATE",
                "parse_path": "heuristic_only",
                "llm_last_status": "heuristic_only",
            }
        evidence_snippet = " ".join(str(evidence.get("snippet") or "").split())[:140]
        content_item = self._truncate_word_boundary(str(evidence.get("content_item") or ""), max_chars=180)
        content_passages = [
            self._truncate_word_boundary(str(passage or ""), max_chars=220)
            for passage in list(evidence.get("content_passages") or [])[:3]
            if str(passage or "").strip()
        ]
        prompt_lines = [
            "Output one JSON object like {\"d\":\"N\",\"r\":\"ep\",\"c\":\"N\"}. No prose.",
            f"L={lane};U={url};S={evidence_snippet}",
        ]
        if content_item:
            prompt_lines.append(f"C={content_item}")
        if content_passages:
            prompt_lines.append(
                "P="
                + json.dumps(content_passages, separators=(",", ":"), ensure_ascii=True)
            )
        prompt = (
            "\n".join(prompt_lines)
            + "\n"
        )
        eval_started = time.perf_counter()
        eval_model_used = "haiku"
        try:
            self._metrics["llm_call_count"] += 1
            response = await self.claude_client.query(
                prompt=prompt,
                model="haiku",
                max_tokens=self.eval_max_tokens,
                json_mode=True,
                max_retries_override=0 if objective in {"rfp_pdf", "rfp_web"} else None,
                empty_retries_before_fallback_override=1 if objective in {"rfp_pdf", "rfp_web"} else None,
                fast_fail_on_length=True,
            )
            eval_model_used = str((response or {}).get("model_used") or "haiku")
            stop_reason = str((response or {}).get("stop_reason") or "").strip().lower()
            eval_latency_ms = round((time.perf_counter() - eval_started) * 1000.0, 2)
            structured_output = (response or {}).get("structured_output")
            raw_content = str((response or {}).get("content") or "").strip()
            empty_content = not raw_content and not isinstance(structured_output, dict)
            if empty_content:
                self._metrics["empty_content_count"] += 1
            if stop_reason == "length":
                self._metrics["length_stop_count"] += 1
                self._metrics["llm_fallback_count"] += 1
                self._consecutive_length_stops += 1
                if self._consecutive_length_stops >= self.length_stop_circuit_threshold:
                    self._llm_circuit_broken = True
                self._record_strict_eval_model_stat(
                    model=eval_model_used,
                    latency_ms=eval_latency_ms,
                    length_stop=True,
                    schema_fail=True,
                    empty_content=empty_content,
                )
                return {
                    "decision": "NO_PROGRESS",
                    "parse_path": "length_stop_hard_fail",
                    "llm_last_status": "length_stop",
                    "reason_code": "schema_reject",
                    "confidence_delta_bucket": "NONE",
                    "model_used": eval_model_used,
                    "schema_valid": False,
                }
            payload = None
            if isinstance(structured_output, dict):
                payload = structured_output
            if not payload:
                payload = self._extract_json_object_strict(raw_content)
            if not payload:
                self._metrics["schema_fail_count"] += 1
                self._record_strict_eval_model_stat(
                    model=eval_model_used,
                    latency_ms=eval_latency_ms,
                    length_stop=False,
                    schema_fail=True,
                    empty_content=empty_content,
                )
                return {
                    "decision": "NO_PROGRESS",
                    "parse_path": "schema_gate_hard_fail",
                    "llm_last_status": "empty_response",
                    "reason_code": "schema_reject",
                    "confidence_delta_bucket": "NONE",
                    "model_used": eval_model_used,
                    "schema_valid": False,
                }
            decision_raw = str(payload.get("decision") or payload.get("d") or "NO_PROGRESS").upper()
            decision_map = {
                "A": "ACCEPT",
                "W": "WEAK_ACCEPT_CANDIDATE",
                "N": "NO_PROGRESS",
                "P": "PIPELINE_DIAGNOSTIC",
                "R": "RETRY_DIFFERENT_HOP",
            }
            decision = decision_map.get(decision_raw, decision_raw)
            self._consecutive_length_stops = 0
            reason_raw = str(payload.get("reason_code") or payload.get("r") or "evidence_partial").strip().lower()
            reason_map = {
                "es": "evidence_strong",
                "ep": "evidence_partial",
                "ls": "low_signal",
                "oe": "off_entity",
                "sr": "schema_reject",
                "du": "duplicate",
                "tr": "tier_reject",
                "rh": "retry_other_lane",
            }
            reason_code = reason_map.get(reason_raw, reason_raw)
            if reason_code not in {
                "evidence_strong",
                "evidence_partial",
                "low_signal",
                "off_entity",
                "schema_reject",
                "duplicate",
                "tier_reject",
                "retry_other_lane",
            }:
                reason_code = "evidence_partial"
            delta_raw = str(payload.get("confidence_delta_bucket") or payload.get("c") or "NONE").strip().upper()
            delta_map = {"U2": "UP_2", "U5": "UP_5", "D2": "DOWN_2", "D5": "DOWN_5", "N": "NONE"}
            delta_bucket = delta_map.get(delta_raw, delta_raw)
            if delta_bucket not in {"UP_2", "UP_5", "DOWN_2", "DOWN_5", "NONE"}:
                delta_bucket = "NONE"
            if decision == "ACCEPT":
                # LLM may suggest ACCEPT; final ACCEPT gate still enforced externally.
                self._record_strict_eval_model_stat(
                    model=eval_model_used,
                    latency_ms=eval_latency_ms,
                    length_stop=False,
                    schema_fail=False,
                    empty_content=False,
                )
                return {
                    "decision": "ACCEPT",
                    "parse_path": "llm_json",
                    "llm_last_status": "ok",
                    "reason_code": reason_code,
                    "confidence_delta_bucket": delta_bucket,
                    "model_used": eval_model_used,
                    "schema_valid": True,
                }
            if decision not in {"WEAK_ACCEPT_CANDIDATE", "NO_PROGRESS", "PIPELINE_DIAGNOSTIC", "RETRY_DIFFERENT_HOP"}:
                decision = "NO_PROGRESS"
            self._record_strict_eval_model_stat(
                model=eval_model_used,
                latency_ms=eval_latency_ms,
                length_stop=False,
                schema_fail=False,
                empty_content=False,
            )
            return {
                "decision": decision,
                "parse_path": "llm_json",
                "llm_last_status": "ok",
                "reason_code": reason_code,
                "confidence_delta_bucket": delta_bucket,
                "model_used": eval_model_used,
                "schema_valid": True,
            }
        except Exception:  # noqa: BLE001
            self._metrics["llm_fallback_count"] += 1
            self._record_strict_eval_model_stat(
                model=eval_model_used,
                latency_ms=round((time.perf_counter() - eval_started) * 1000.0, 2),
                length_stop=False,
                schema_fail=True,
                empty_content=False,
            )
            return {
                "decision": "NO_PROGRESS",
                "parse_path": "schema_gate_hard_fail",
                "llm_last_status": "timeout",
                "reason_code": "schema_reject",
                "confidence_delta_bucket": "NONE",
                "model_used": eval_model_used,
                "schema_valid": False,
            }

    def _record_strict_eval_model_stat(
        self,
        *,
        model: str,
        latency_ms: float,
        length_stop: bool,
        schema_fail: bool,
        empty_content: bool,
    ) -> None:
        model_key = str(model or "unknown")
        stats = self._strict_eval_model_stats.setdefault(
            model_key,
            {
                "calls": 0,
                "length_stop_count": 0,
                "schema_fail_count": 0,
                "empty_content_count": 0,
                "latency_ms_samples": [],
            },
        )
        stats["calls"] += 1
        if length_stop:
            stats["length_stop_count"] += 1
        if schema_fail:
            stats["schema_fail_count"] += 1
        if empty_content:
            stats["empty_content_count"] += 1
        if isinstance(latency_ms, (int, float)) and latency_ms >= 0:
            samples = stats["latency_ms_samples"]
            samples.append(float(latency_ms))
            if len(samples) > 200:
                del samples[: len(samples) - 200]

    def _build_strict_eval_metrics_by_model(self) -> Dict[str, Dict[str, Any]]:
        metrics: Dict[str, Dict[str, Any]] = {}
        for model, stats in self._strict_eval_model_stats.items():
            calls = int(stats.get("calls") or 0)
            samples = list(stats.get("latency_ms_samples") or [])
            median_latency_ms = 0.0
            if samples:
                samples_sorted = sorted(float(sample) for sample in samples)
                mid = len(samples_sorted) // 2
                if len(samples_sorted) % 2 == 1:
                    median_latency_ms = round(samples_sorted[mid], 2)
                else:
                    median_latency_ms = round((samples_sorted[mid - 1] + samples_sorted[mid]) / 2.0, 2)
            metrics[model] = {
                "calls": calls,
                "length_stop_count": int(stats.get("length_stop_count") or 0),
                "schema_fail_count": int(stats.get("schema_fail_count") or 0),
                "empty_content_count": int(stats.get("empty_content_count") or 0),
                "median_eval_latency_ms": median_latency_ms,
            }
        return metrics

    @staticmethod
    def _extract_json_object_strict(text: Any) -> Optional[Dict[str, Any]]:
        raw = str(text or "").strip()
        if not raw:
            return None
        if "```" in raw:
            normalized = raw.replace("```json", "```").replace("```JSON", "```")
            candidates = [segment.strip() for segment in normalized.split("```") if segment.strip()]
            fenced = next((segment for segment in candidates if segment.startswith("{") and segment.endswith("}")), "")
            if fenced:
                raw = fenced
        if not raw.startswith("{"):
            start = raw.find("{")
            end = raw.rfind("}")
            if start >= 0 and end > start:
                raw = raw[start : end + 1]
        try:
            payload = json.loads(raw)
        except Exception:
            return None
        return payload if isinstance(payload, dict) else None

    @staticmethod
    def _is_evidence_grounded_in_content(*, snippet: str, content_item: str, content: str) -> bool:
        content_norm = " ".join(str(content or "").lower().split())
        if not content_norm:
            return False
        for candidate in (snippet, content_item):
            candidate_norm = " ".join(str(candidate or "").lower().split())
            if candidate_norm and candidate_norm in content_norm:
                return True
        return False

    def _resolve_objective_budget(self, *, max_iterations: int, profile: Dict[str, Any]) -> Dict[str, Any]:
        budget_overrides = profile.get("budget") if isinstance(profile.get("budget"), dict) else {}
        profile_cap = int(budget_overrides.get("max_hops", self.max_hops))
        effective_cap = self.max_hops_override if self.max_hops_override > 0 else profile_cap
        max_hops = min(max(1, int(max_iterations or self.max_hops)), int(effective_cap))
        return {
            "max_hops": max_hops,
            "max_evals_per_hop": int(budget_overrides.get("max_evals_per_hop", self.max_evals_per_hop)),
            "per_iteration_timeout": float(budget_overrides.get("per_iteration_timeout", self.per_iteration_timeout)),
            "max_retries": int(budget_overrides.get("max_retries", self.max_retries)),
            "max_same_domain_revisits": int(
                budget_overrides.get("max_same_domain_revisits", self.max_same_domain_revisits)
            ),
        }

    async def _choose_lane_order_with_llm(
        self,
        *,
        entity_name: str,
        objective: str,
        pass_name: str,
        available_lanes: List[str],
        state: Dict[str, Any],
    ) -> List[str]:
        if not available_lanes:
            return []
        if not self.enable_llm_hop_selection:
            return list(available_lanes)

        unexhausted = [lane for lane in available_lanes if lane not in state.get("lane_exhausted", set())]
        if not unexhausted:
            return list(available_lanes)

        prompt = (
            "Return strict JSON only with key ordered_lanes (array of lane strings).\n"
            "Rank lanes by expected evidence yield for this entity/objective.\n"
            f"Entity: {entity_name}\n"
            f"Objective: {objective}\n"
            f"Pass: {pass_name}\n"
            f"Available lanes: {', '.join(unexhausted)}\n"
            "Rules: prefer entity-grounded, higher-signal lanes first. No explanation."
        )
        try:
            self._metrics["llm_hop_selection_count"] += 1
            response = await self.claude_client.query(
                prompt=prompt,
                model="haiku",
                max_tokens=120,
                json_mode=False,
                max_retries_override=0,
                empty_retries_before_fallback_override=1,
                fast_fail_on_length=False,
            )
            payload = None
            structured_output = (response or {}).get("structured_output")
            if isinstance(structured_output, dict):
                payload = structured_output
            if not payload:
                payload = self._extract_json_object_strict((response or {}).get("content"))
            if not isinstance(payload, dict):
                return list(available_lanes)

            ranked = payload.get("ordered_lanes")
            if not isinstance(ranked, list):
                return list(available_lanes)

            selected: List[str] = []
            seen = set()
            allowed = set(available_lanes)
            for lane in ranked:
                lane_name = str(lane or "").strip()
                if lane_name and lane_name in allowed and lane_name not in seen:
                    selected.append(lane_name)
                    seen.add(lane_name)
            for lane in available_lanes:
                if lane not in seen:
                    selected.append(lane)
            return selected or list(available_lanes)
        except Exception:  # noqa: BLE001
            return list(available_lanes)

    async def _choose_candidate_action_from_batch(
        self,
        *,
        lane: str,
        entity_name: str,
        candidates: List[Dict[str, Any]],
        state: Dict[str, Any],
        objective: str,
    ) -> Optional[Dict[str, Any]]:
        if not candidates or not self.enable_llm_hop_selection or self._llm_circuit_broken:
            return None

        lane_dead = set(state.get("lane_exhausted", set()) or set())
        if lane in lane_dead:
            return {"action": "stop_lane", "lane": lane, "reason": "lane already exhausted"}

        serialized_candidates: List[Dict[str, Any]] = []
        for index, candidate in enumerate(candidates):
            serialized_candidates.append(
                {
                    "candidate_index": index,
                    "url": _normalize_url(candidate.get("url") or ""),
                    "title": str(candidate.get("title") or "").strip(),
                    "snippet": str(candidate.get("snippet") or "").strip(),
                    "candidate_origin": str(candidate.get("candidate_origin") or "").strip(),
                }
            )

        prompt = (
            "Return one strict JSON controller action. No prose.\n"
            "Valid actions: search_queries, scrape_candidate, same_domain_probe, stop_lane, stop_run.\n"
            f"Entity: {entity_name}\n"
            f"Objective: {objective}\n"
            f"Lane: {lane}\n"
            f"Candidate batch: {json.dumps(serialized_candidates, separators=(',', ':'))}\n"
            "Choose the highest-yield next action from this candidate batch."
        )
        try:
            self._metrics["llm_hop_selection_count"] += 1
            response = await self.claude_client.query(
                prompt=prompt,
                model="planner",
                max_tokens=220,
                json_mode=True,
                json_schema=CONTROLLER_ACTION_JSON_SCHEMA,
                stream=False,
                max_retries_override=0,
                empty_retries_before_fallback_override=1,
                fast_fail_on_length=True,
            )
            payload = None
            structured_output = (response or {}).get("structured_output")
            if isinstance(structured_output, dict):
                payload = structured_output
            if not payload:
                payload = self._extract_json_object_strict((response or {}).get("content"))
            action = parse_controller_action(payload)
            if not action:
                normalized_payload = self._normalize_planner_action_payload(
                    payload=payload,
                    lane=lane,
                    candidates=candidates,
                )
                action = parse_controller_action(normalized_payload)
            if not action:
                repaired_action = await self._repair_planner_action_payload(
                    lane=lane,
                    entity_name=entity_name,
                    objective=objective,
                    raw_content=str((response or {}).get("content") or ""),
                    candidates=candidates,
                )
                if repaired_action:
                    action = repaired_action
            if not action:
                self._metrics["planner_action_parse_fail_count"] += 1
                self._record_planner_parse_failure(
                    lane=lane,
                    reason="unparseable_action",
                    response=response,
                    payload=payload,
                    candidate_count=len(candidates),
                )
                return None
            if str(action.get("lane") or lane).strip() != lane:
                self._metrics["planner_action_parse_fail_count"] += 1
                self._record_planner_parse_failure(
                    lane=lane,
                    reason="lane_mismatch",
                    response=response,
                    payload=payload,
                    candidate_count=len(candidates),
                )
                return None
            if action.get("action") == "scrape_candidate":
                raw_index = action.get("candidate_index")
                candidate_index = int(raw_index) if raw_index is not None else -1
                if candidate_index < 0 or candidate_index >= len(candidates):
                    self._metrics["planner_action_parse_fail_count"] += 1
                    self._record_planner_parse_failure(
                        lane=lane,
                        reason="candidate_index_out_of_range",
                        response=response,
                        payload=payload,
                        candidate_count=len(candidates),
                    )
                    return None
            self._metrics["planner_action_applied_count"] += 1
            return action
        except Exception:  # noqa: BLE001
            return None

    async def _repair_planner_action_payload(
        self,
        *,
        lane: str,
        entity_name: str,
        objective: str,
        raw_content: str,
        candidates: List[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        if not raw_content.strip():
            return None
        prompt = (
            "Normalize this into one strict JSON controller action only.\n"
            "Valid actions: search_queries, scrape_candidate, same_domain_probe, stop_lane, stop_run.\n"
            f"Entity: {entity_name}\nObjective: {objective}\nLane: {lane}\n"
            f"Raw output: {self._truncate_word_boundary(raw_content, max_chars=700)}\n"
            "Return JSON with correct types. No prose."
        )
        try:
            self._metrics["planner_action_repair_retry_count"] += 1
            self._metrics["llm_hop_selection_count"] += 1
            repair_response = await self.claude_client.query(
                prompt=prompt,
                model="planner",
                max_tokens=160,
                json_mode=True,
                json_schema=CONTROLLER_ACTION_JSON_SCHEMA,
                stream=False,
                max_retries_override=0,
                empty_retries_before_fallback_override=1,
                fast_fail_on_length=True,
            )
            payload = None
            structured_output = (repair_response or {}).get("structured_output")
            if isinstance(structured_output, dict):
                payload = structured_output
            if not payload:
                payload = self._extract_json_object_strict((repair_response or {}).get("content"))
            action = parse_controller_action(payload)
            if action:
                return action
            normalized = self._normalize_planner_action_payload(
                payload=payload,
                lane=lane,
                candidates=candidates,
            )
            return parse_controller_action(normalized)
        except Exception:  # noqa: BLE001
            return None

    def _record_planner_parse_failure(
        self,
        *,
        lane: str,
        reason: str,
        response: Dict[str, Any],
        payload: Any,
        candidate_count: int,
    ) -> None:
        if len(self._planner_parse_fail_samples) >= 5:
            return
        content = str((response or {}).get("content") or "")
        structured = (response or {}).get("structured_output")
        model_used = str((response or {}).get("model_used") or "")
        stop_reason = str((response or {}).get("stop_reason") or "")
        sample = {
            "lane": lane,
            "reason": reason,
            "candidate_count": int(candidate_count),
            "model_used": model_used,
            "stop_reason": stop_reason,
            "content_prefix": self._truncate_word_boundary(content, max_chars=240),
            "payload_type": type(payload).__name__,
            "structured_type": type(structured).__name__ if structured is not None else None,
        }
        if isinstance(payload, dict):
            sample["payload_keys"] = sorted(list(payload.keys()))[:12]
        if isinstance(structured, dict):
            sample["structured_keys"] = sorted(list(structured.keys()))[:12]
        self._planner_parse_fail_samples.append(sample)

    @staticmethod
    def _normalize_planner_action_payload(
        *,
        payload: Any,
        lane: str,
        candidates: List[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        if not isinstance(payload, dict):
            return None
        normalized: Dict[str, Any] = dict(payload)
        parameters = normalized.get("parameters")
        parameters_dict = parameters if isinstance(parameters, dict) else {}

        action = str(
            normalized.get("action")
            or normalized.get("next_action")
            or normalized.get("action_type")
            or parameters_dict.get("action")
            or ""
        ).strip()
        if action not in CONTROLLER_ACTION_TYPES:
            return None

        reason = str(
            normalized.get("reason")
            or normalized.get("rationale")
            or normalized.get("explanation")
            or parameters_dict.get("reason")
            or ""
        ).strip()

        canonical: Dict[str, Any] = {"action": action}
        if action != "stop_run":
            canonical["lane"] = str(
                normalized.get("lane")
                or normalized.get("target_lane")
                or parameters_dict.get("lane")
                or lane
            ).strip()
        if reason:
            canonical["reason"] = reason

        if action == "scrape_candidate":
            candidate_index = (
                normalized.get("candidate_index")
                if normalized.get("candidate_index") is not None
                else normalized.get("target_candidate_index")
            )
            if candidate_index is None:
                candidate_index = (
                    parameters_dict.get("candidate_index")
                    if parameters_dict.get("candidate_index") is not None
                    else parameters_dict.get("target_candidate_index")
                )
            if isinstance(candidate_index, str) and candidate_index.strip().isdigit():
                candidate_index = int(candidate_index.strip())
            if candidate_index is None:
                candidate_url = _normalize_url(
                    str(
                        normalized.get("url")
                        or normalized.get("target_url")
                        or parameters_dict.get("url")
                        or parameters_dict.get("target_url")
                        or ""
                    )
                )
                if candidate_url:
                    for idx, candidate in enumerate(candidates):
                        if _normalize_url(candidate.get("url") or "") == candidate_url:
                            candidate_index = idx
                            break
            if isinstance(candidate_index, int):
                canonical["candidate_index"] = candidate_index
        elif action == "search_queries":
            queries = normalized.get("queries")
            if queries is None:
                queries = (
                    parameters_dict.get("queries")
                    if parameters_dict.get("queries") is not None
                    else parameters_dict.get("search_queries")
                )
            if queries is None:
                single_query = str(
                    normalized.get("query")
                    or normalized.get("search_query")
                    or parameters_dict.get("query")
                    or parameters_dict.get("search_query")
                    or ""
                ).strip()
                if single_query:
                    queries = [single_query]
            if isinstance(queries, str) and queries.strip():
                queries = [queries.strip()]
            if isinstance(queries, list):
                canonical["queries"] = [
                    str(query or "").strip() for query in queries if str(query or "").strip()
                ]
        elif action == "same_domain_probe":
            url = str(
                normalized.get("url")
                or normalized.get("target_url")
                or parameters_dict.get("url")
                or parameters_dict.get("target_url")
                or ""
            ).strip()
            if not url and candidates:
                url = str(candidates[0].get("url") or "").strip()
            canonical["url"] = url

        return canonical

    def _quality_threshold_for_lane(self, lane: str) -> float:
        if lane in {"official_site", "annual_report"}:
            return 0.38
        if lane in {"rfp_procurement_tenders", "linkedin_jobs"}:
            return 0.42
        if lane in {"press_release", "careers", "trusted_news"}:
            return 0.28
        return 0.34

    def _evidence_signature(self, *, url: str, lane: str, snippet: str) -> str:
        return f"{lane}|{url}|{snippet[:160].strip().lower()}"

    def _official_domain(self, *, entity_name: str, dossier: Dict[str, Any]) -> Optional[str]:
        metadata = dossier.get("metadata") if isinstance(dossier, dict) else {}
        if isinstance(metadata, dict):
            canonical = metadata.get("canonical_sources")
            if isinstance(canonical, dict):
                official = canonical.get("official_site")
                if isinstance(official, str):
                    host = (urlparse(official).hostname or "").lower()
                    if host:
                        return host.lstrip("www.")
            website = metadata.get("website")
            if isinstance(website, str):
                host = (urlparse(website).hostname or "").lower()
                if host:
                    return host.lstrip("www.")
        sections = dossier.get("sections") if isinstance(dossier, dict) else None
        if isinstance(sections, list):
            for section in sections:
                if not isinstance(section, dict):
                    continue
                if str(section.get("id") or "").strip().lower() != "core_information":
                    continue
                lines = section.get("content") if isinstance(section.get("content"), list) else []
                joined = " ".join(str(line or "") for line in lines)
                match = re.search(r"https?://[^\s)]+", joined)
                if match:
                    host = (urlparse(match.group(0)).hostname or "").lower()
                    if host:
                        return host.lstrip("www.")
                bare_match = re.search(
                    r"\b(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:/[a-z0-9._~:/?#@!$&'()*+,;=-]*)?\b",
                    joined,
                    flags=re.IGNORECASE,
                )
                if bare_match:
                    host = (urlparse(f"https://{bare_match.group(0)}").hostname or "").lower()
                    if host:
                        return host.lstrip("www.")
        return None

    @staticmethod
    def _entity_aliases(*, entity_name: str, official_host: str = "") -> List[str]:
        aliases: List[str] = []
        normalized_words = [w for w in re.findall(r"[a-z0-9]+", str(entity_name or "").lower()) if w]
        informative = [w for w in normalized_words if w not in {"fc", "f", "c", "football", "club", "the"}]
        if informative:
            acronym = "".join(part[0] for part in informative if part)
            if len(acronym) >= 2:
                aliases.append(acronym.upper())
            aliases.append(" ".join(informative))
        host_core = (official_host or "").split(".")[0].strip().lower()
        if host_core and host_core not in aliases:
            aliases.append(host_core)
        deduped: List[str] = []
        seen: Set[str] = set()
        for alias in aliases:
            item = str(alias or "").strip()
            if not item:
                continue
            key = item.lower()
            if key in seen:
                continue
            seen.add(key)
            deduped.append(item)
        return deduped

    def _source_tier(self, *, url: str, official_domain: Optional[str]) -> str:
        host = (urlparse(url).hostname or "").lower().lstrip("www.")
        if official_domain and (host == official_domain or host.endswith(f".{official_domain}")):
            return "tier_1"
        if any(host.endswith(domain) for domain in TRUSTED_NEWS_DOMAINS):
            return "tier_2"
        if any(host.endswith(hint) or hint in host for hint in TIER_1_DOMAIN_HINTS):
            return "tier_1"
        return "tier_3"

    def _candidate_passes_entity_grounding(
        self,
        *,
        lane: str,
        candidate: Dict[str, Any],
        entity_name: str,
        official_domain: Optional[str],
        grounding_score: Optional[float] = None,
        dossier: Optional[Dict[str, Any]] = None,
        language_ok: bool = True,
        strict: bool = False,
    ) -> bool:
        url = str(candidate.get("url") or "").strip()
        if not url:
            return False
        host = (urlparse(url).hostname or "").lower().lstrip("www.")
        if not language_ok:
            return False
        if official_domain and (host == official_domain or host.endswith(f".{official_domain}")):
            return True

        def _normalize_words(text: str) -> List[str]:
            return [part for part in re.findall(r"[a-z0-9]+", str(text or "").lower()) if part]

        entity_words = _normalize_words(entity_name)
        if not entity_words:
            return False
        score = float(grounding_score) if isinstance(grounding_score, (int, float)) else self._entity_match_score(
            candidate=candidate,
            entity_name=entity_name,
        )
        high_risk_lane = lane in {"rfp_procurement_tenders", "annual_report", "governance_pdf", "linkedin_jobs"}
        if strict and score < 0.52:
            return False
        if not strict and high_risk_lane and score < 0.25:
            return False

        full_entity_phrase = " ".join(entity_words)
        alias_words = [word for word in entity_words if word not in {"fc", "f", "c", "football", "club"}]
        alias_phrase = " ".join(alias_words).strip()

        searchable = " ".join(
            (
                str(candidate.get("url") or ""),
                str(candidate.get("title") or ""),
                str(candidate.get("snippet") or ""),
            )
        ).lower()
        has_exact_entity_phrase = full_entity_phrase in searchable
        if not has_exact_entity_phrase and alias_phrase:
            has_exact_entity_phrase = (
                alias_phrase in searchable
                and any(marker in searchable for marker in (" football", " fc", "f.c", "club"))
            )
        if has_exact_entity_phrase:
            if (
                lane in {"rfp_procurement_tenders", "annual_report", "governance_pdf"}
                and self._is_federation_entity(dossier=dossier or {}, entity_name=entity_name)
            ):
                return self._federation_procurement_source_allowed(
                    url=url,
                    official_domain=official_domain,
                    grounding_score=score,
                )
            return True

        if not strict and not high_risk_lane:
            # Let candidate evaluation inspect content, but keep strict gate for validated signals.
            return True

        if score >= 0.78 and lane in {
            "official_site",
            "press_release",
            "trusted_news",
            "careers",
            "partnership_commercial",
            "broader_press",
        }:
            return True

        if lane == "linkedin_jobs" and "linkedin.com" in host:
            return bool(alias_phrase and alias_phrase in searchable)

        return False

    def _entity_match_score(self, *, candidate: Dict[str, Any], entity_name: str) -> float:
        searchable = " ".join(
            (
                str(candidate.get("url") or ""),
                str(candidate.get("title") or ""),
                str(candidate.get("snippet") or ""),
            )
        ).lower()
        entity_words = [part for part in re.findall(r"[a-z0-9]+", entity_name.lower()) if part]
        if not entity_words:
            return 0.0
        informative = [word for word in entity_words if word not in {"fc", "f", "c", "football", "club"}]
        required = informative or entity_words
        matched = sum(1 for word in required if word in searchable)
        score = matched / max(1, len(required))
        if " ".join(required) in searchable:
            score = min(1.0, score + 0.2)
        acronym = "".join(part[0] for part in required if part)
        if len(acronym) >= 2 and re.search(rf"\b{re.escape(acronym)}\b", searchable, flags=re.IGNORECASE):
            score = max(score, 0.55)
        return round(float(score), 3)

    @staticmethod
    def _is_entity_domain_match(*, url: str, official_domain: Optional[str]) -> bool:
        if not official_domain:
            return False
        host = (urlparse(url).hostname or "").lower().lstrip("www.")
        return bool(host and (host == official_domain or host.endswith(f".{official_domain}")))

    def _candidate_language_ok(self, *, lane: str, url: str) -> bool:
        if lane != "official_site":
            return True
        parsed = urlparse(url)
        host = (parsed.hostname or "").lower()
        path = (parsed.path or "").lower()
        if "wikipedia.org" not in host:
            return True
        # Official-site lane should never validate through non-English Wikipedia mirrors.
        if host.startswith("en.wikipedia.org"):
            return True
        return False

    def _is_federation_entity(self, *, dossier: Dict[str, Any], entity_name: str) -> bool:
        metadata = dossier.get("metadata") if isinstance(dossier, dict) else {}
        if not isinstance(metadata, dict):
            metadata = {}
        fields = [
            str(metadata.get("entity_type") or ""),
            str(metadata.get("org_type") or ""),
            str(metadata.get("description") or ""),
            str(entity_name or ""),
        ]
        text = " ".join(fields).lower()
        return any(token in text for token in ("federation", "association", "confederation"))

    def _federation_procurement_source_allowed(
        self,
        *,
        url: str,
        official_domain: Optional[str],
        grounding_score: float,
    ) -> bool:
        host = (urlparse(url).hostname or "").lower().lstrip("www.")
        if official_domain and (host == official_domain or host.endswith(f".{official_domain}")):
            return True
        allowed_env = str(os.getenv("DISCOVERY_FEDERATION_PROCUREMENT_ALLOWED_DOMAINS", "") or "").strip()
        allowlist = [domain.strip().lower().lstrip("www.") for domain in allowed_env.split(",") if domain.strip()]
        if any(host == domain or host.endswith(f".{domain}") for domain in allowlist):
            return grounding_score >= 0.75
        return False

    def _has_tier12_corroboration(self, state: Dict[str, Any], evidence: Dict[str, Any]) -> bool:
        trusted_tokens = state.get("trusted_corroboration_tokens", set())
        if not trusted_tokens:
            return False
        current_tokens = set(evidence.get("tokens") or [])
        return bool(current_tokens.intersection(trusted_tokens))

    def _low_signal_reason(
        self,
        *,
        lane: str,
        url: str,
        content: str,
        metadata: Dict[str, Any],
    ) -> Optional[str]:
        low_signal_reason = str(metadata.get("low_signal_reason") or "").strip()
        if low_signal_reason:
            return low_signal_reason
        word_count = _safe_word_count(content)
        parsed = urlparse(url)
        leaf = (parsed.path.strip("/").split("/")[-1] if parsed.path else "").lower()
        if word_count < 80:
            return "low_word_count"
        if lane in {"rfp_procurement_tenders", "annual_report"} and word_count < 120:
            return "low_word_count_for_high_value_lane"
        if leaf in {"matches", "fixtures", "results", "news"} and word_count < 180:
            return "nav_shell_leaf"
        if self._looks_like_shell_content(content):
            return "boilerplate_shell_content"
        return None

    @staticmethod
    def _looks_like_shell_content(content: str) -> bool:
        text = str(content or "").lower()
        if not text:
            return True
        markers = (
            "accept all cookies",
            "privacy policy",
            "sign up",
            "log in",
            "fixtures",
            "results",
            "matches",
            "tickets",
            "shop",
        )
        marker_hits = sum(1 for marker in markers if marker in text)
        words = _safe_word_count(text)
        return marker_hits >= 3 and words < 240

    def _pdf_text_quality_ok(self, *, content: str) -> bool:
        body = str(content or "")
        if not body:
            return False
        lowered = body.lower()
        word_count = _safe_word_count(body)
        marker_hits = sum(1 for marker in PDF_BINARY_NOISE_MARKERS if marker in lowered)
        # Reject obvious binary/xref shells aggressively for procurement/pdf lanes.
        if marker_hits >= 1 and word_count < 80:
            return False
        if marker_hits >= 2 and word_count < 160:
            return False
        return True

    @staticmethod
    def _has_procurement_lexicon(text: str) -> bool:
        lowered = str(text or "").lower()
        return any(
            token in lowered
            for token in (
                "rfp",
                "request for proposal",
                "invitation to tender",
                "tender",
                "procurement",
                "supplier",
                "bid",
                "quotation",
                "rfq",
            )
        )

    @staticmethod
    def _entity_specificity_score(*, snippet: str, entity_name: str) -> float:
        snippet_norm = str(snippet or "").lower()
        entity_norm = str(entity_name or "").lower().strip()
        if not snippet_norm or not entity_norm:
            return 0.0
        if entity_norm in snippet_norm:
            return 1.0
        parts = [p for p in re.findall(r"[a-z0-9]+", entity_norm) if p not in {"fc", "f", "c", "football", "club"}]
        if not parts:
            return 0.0
        matched = sum(1 for p in parts if p in snippet_norm)
        return round(matched / max(1, len(parts)), 3)

    def _composite_acceptance_score(
        self,
        *,
        source_tier: str,
        quality_score: float,
        grounding_score: float,
        freshness_score: float,
        snippet: str,
        entity_name: str,
    ) -> float:
        tier_component = 1.0 if source_tier == "tier_1" else (0.7 if source_tier == "tier_2" else 0.35)
        freshness_component = max(0.0, min(1.0, 0.5 + freshness_score))
        specificity = self._entity_specificity_score(snippet=snippet, entity_name=entity_name)
        score = (
            0.30 * tier_component
            + 0.30 * max(0.0, min(1.0, quality_score))
            + 0.25 * max(0.0, min(1.0, grounding_score))
            + 0.10 * freshness_component
            + 0.05 * specificity
        )
        return round(max(0.0, min(1.0, score)), 3)

    def _increment_entity_grounding_reject(self, lane: str) -> None:
        by_lane = self._quality_metrics.setdefault("entity_grounding_reject_count_by_lane", {})
        by_lane[lane] = int(by_lane.get(lane, 0) or 0) + 1

    def _register_lane_failure(self, lane: str, state: Dict[str, Any], reason: str) -> None:
        failures = state.setdefault("lane_failures", {})
        lane_bucket = failures.setdefault(lane, {})
        lane_bucket[reason] = int(lane_bucket.get(reason, 0) or 0) + 1

    def _lane_failure_count(self, lane: str, state: Dict[str, Any]) -> int:
        failures = state.get("lane_failures", {}).get(lane, {})
        return sum(int(v or 0) for v in failures.values())

    def _mark_lane_dead(self, lane: str, state: Dict[str, Any], reason: str) -> None:
        exhausted: Set[str] = state.setdefault("lane_exhausted", set())
        exhausted.add(lane)
        self._metrics["dead_end_event_count"] += 1
        logger.info("Discovery v2 lane exhausted (lane=%s reason=%s)", lane, reason)

    def _compute_entity_confidence(
        self,
        validated_signals: List[Dict[str, Any]],
        candidate_signals: List[Dict[str, Any]],
        state: Dict[str, Any],
        hop_timings: List[Dict[str, Any]],
        permissive_mode: bool = False,
    ) -> float:
        if not validated_signals:
            if permissive_mode and candidate_signals:
                candidate_quality = sum(
                    float(signal.get("evidence_quality_score") or 0.0)
                    for signal in candidate_signals
                ) / max(1, len(candidate_signals))
                candidate_score = 0.35 + min(0.15, len(candidate_signals) * 0.03) + min(0.06, candidate_quality * 0.08)
                candidate_score -= min(0.08, self._metrics["dead_end_event_count"] * 0.02)
                return round(max(0.35, min(0.56, candidate_score)), 3)
            return 0.35
        quality_avg = sum(float(signal.get("evidence_quality_score") or 0.0) for signal in validated_signals) / max(
            len(validated_signals), 1
        )
        score = 0.35 + min(0.35, len(validated_signals) * 0.12) + min(0.2, quality_avg * 0.25)
        score -= min(0.12, self._metrics["dead_end_event_count"] * 0.03)
        score -= min(0.08, self._metrics["fallback_accept_block_count"] * 0.02)
        return round(max(0.0, min(0.95, score)), 3)

    def _compute_pipeline_confidence(
        self,
        *,
        iterations: int,
        budget: int,
        hop_timings: List[Dict[str, Any]],
        state: Dict[str, Any],
        per_iteration_timeout: float,
    ) -> float:
        completion_ratio = min(1.0, float(iterations) / float(max(1, budget)))
        dead_end_penalty = min(0.4, float(self._metrics["dead_end_event_count"]) * 0.08)
        timeout_penalty = 0.0
        for hop in hop_timings:
            if float(hop.get("duration_ms") or 0.0) > (per_iteration_timeout * 1000.0):
                timeout_penalty += 0.05
        score = 0.55 + completion_ratio * 0.35 - dead_end_penalty - min(0.2, timeout_penalty)
        if state.get("lane_exhausted"):
            score -= min(0.1, len(state["lane_exhausted"]) * 0.03)
        return round(max(0.0, min(0.99, score)), 3)
