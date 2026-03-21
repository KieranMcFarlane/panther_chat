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
from typing import Any, Awaitable, Callable, Dict, List, Optional, Set, Tuple
from urllib.parse import urlparse

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
    "linkedin.com",
    "wikipedia.org",
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
    "wikipedia.org",
    "bbc.com",
    "bbc.co.uk",
    "linkedin.com",
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
        self.run_profile = os.getenv("PIPELINE_RUN_PROFILE", "bounded_balanced_v2")

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
        }
        self._strict_eval_model_stats: Dict[str, Dict[str, Any]] = {}
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
        }
        self._strict_eval_model_stats = {}
        self._llm_circuit_broken = False
        self._consecutive_length_stops = 0

        iteration_budget = int(objective_budget["max_hops"])
        official_domain = self._official_domain(entity_name=entity_name, dossier=dossier)
        state: Dict[str, Any] = {
            "visited_urls": set(),
            "visited_hashes": set(),
            "accepted_signatures": set(),
            "rejected_urls": set(),
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
            "strict_eval_metrics_by_model": self._build_strict_eval_metrics_by_model(),
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

        for candidate in candidates[: max(1, int(effective_budget.get("max_evals_per_hop", self.max_evals_per_hop)))]:
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

            if not self._candidate_passes_entity_grounding(
                lane=lane,
                candidate=candidate,
                entity_name=entity_name,
                official_domain=official_domain,
            ):
                self._register_lane_failure(lane, state, "off_entity_candidate_prefilter")
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

            scraped = await self._scrape_with_budget(url, budget=effective_budget)
            content = str(scraped.get("content") or "")
            metadata = scraped.get("metadata") if isinstance(scraped.get("metadata"), dict) else {}
            content_hash = hashlib.sha1(content.encode("utf-8", errors="ignore")).hexdigest() if content else None

            low_signal_reason = self._low_signal_reason(lane=lane, url=url, content=content, metadata=metadata)
            if content_hash and content_hash in state["visited_hashes"]:
                self._register_lane_failure(lane, state, "duplicate_content_hash")
                low_signal_reason = low_signal_reason or "duplicate_content_hash"
            if low_signal_reason:
                self._register_lane_failure(lane, state, low_signal_reason)
                state.setdefault("rejected_urls", set()).add(url)
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

            signature = self._evidence_signature(url=url, lane=lane, snippet=evidence_snippet)
            if signature in state["accepted_signatures"]:
                accept_reject_reasons.append("duplicate_evidence_signature")

            if source_tier == "tier_3" and not self._has_tier12_corroboration(state, evidence):
                accept_reject_reasons.append("tier3_without_corroboration")

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
                    source_tier in {"tier_1", "tier_2"}
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
                    "content_hash": content_hash,
                    "url": url,
                    "lane_exhausted": False,
                    "dead_end_reason": None,
                    "candidate_micro_eval": {
                        "decision": candidate_eval["decision"],
                        "reason_code": candidate_eval["reason_code"],
                        "confidence_delta_bucket": candidate_eval["confidence_delta_bucket"],
                    },
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
            }
            if signal["validation_state"] == "diagnostic":
                diagnostic = signal
                signal = None
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
        entity_name: str,
        dossier: Dict[str, Any],
        state: Dict[str, Any],
        objective: str,
    ) -> List[Dict[str, Any]]:
        queries = await self._build_agentic_queries(
            lane=lane,
            entity_name=entity_name,
            dossier=dossier,
            objective=objective,
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
            key=lambda candidate: self._candidate_score(
                candidate,
                lane=lane,
                entity_name=entity_name,
                official_domain=official_domain,
                state=state,
            ),
            reverse=True,
        )
        return ranked

    async def _build_agentic_queries(
        self,
        *,
        lane: str,
        entity_name: str,
        dossier: Dict[str, Any],
        objective: str,
    ) -> List[str]:
        base_queries = list(LANE_QUERIES.get(lane, ('"{entity}" digital procurement',)))
        metadata = dossier.get("metadata") if isinstance(dossier, dict) else {}
        canonical = metadata.get("canonical_sources") if isinstance(metadata, dict) else {}
        official = canonical.get("official_site") if isinstance(canonical, dict) else None
        official_host = (urlparse(str(official or "")).hostname or "").lower().lstrip("www.")

        query_pool: List[str] = []
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
        if objective in {"rfp_web", "rfp_pdf"} and lane in {"press_release", "trusted_news", "careers"}:
            query_pool.append(f'"{entity_name}" CEO "head of digital" "commercial" linkedin')
            query_pool.append(f'"{entity_name}" NTT data partnership digital transformation')
        if lane in {"official_site", "trusted_news"}:
            query_pool.append(f'"{entity_name}" wikipedia')
            query_pool.append(f'"{entity_name}" bbc sport')
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

        if entity_name.lower() in text:
            score += 0.35
        for token in LANE_KEYWORDS.get(lane, ()):
            if token in text:
                score += 0.12
        if official_domain and (host == official_domain or host.endswith(f".{official_domain}")):
            score += 0.35
        if url.endswith(".pdf"):
            score += 0.08 if lane in {"annual_report", "governance_pdf"} else -0.05
        if "linkedin.com/jobs" in url and lane == "linkedin_jobs":
            score += 0.2
        if lane in {"press_release", "trusted_news"} and any(domain in url for domain in TRUSTED_NEWS_DOMAINS):
            score += 0.2
        if any(domain in url for domain in HIGH_PRIORITY_REFERENCE_DOMAINS):
            score += 0.1
        if lane in {"careers", "linkedin_jobs"} and "linkedin.com/in/" in url:
            score += 0.18
        if lane in {"official_site", "trusted_news"} and "wikipedia.org/wiki/" in url:
            score += 0.12
        if lane == "trusted_news" and ("bbc.com/sport" in url or "bbc.co.uk/sport" in url):
            score += 0.16
        if lane in {"rfp_procurement_tenders", "annual_report", "governance_pdf", "careers", "linkedin_jobs"}:
            if any(domain in host for domain in LOW_AUTHORITY_DOMAIN_HINTS):
                score -= 0.5
            if any(marker in host for marker in ("edemocracy.", "charitycommission.", "gov.uk", "locality.org.uk")):
                score -= 0.35
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
        return score

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

    def _extract_evidence(
        self,
        *,
        lane: str,
        entity_name: str,
        content: str,
        title: str,
        snippet: str,
    ) -> Dict[str, Any]:
        content_norm = str(content or "")
        lower = content_norm.lower()
        keywords = LANE_KEYWORDS.get(lane, ())
        tokens: List[str] = []
        for keyword in keywords:
            if keyword in lower:
                tokens.append(keyword)
        if entity_name.lower() in lower:
            tokens.append(entity_name.lower())

        lines = [line.strip() for line in content_norm.splitlines() if line.strip()]
        best_line = ""
        for line in lines:
            line_lower = line.lower()
            if any(token in line_lower for token in keywords):
                best_line = line[:360]
                break
        if not best_line:
            best_line = (snippet or title or "")[:240]

        content_item = best_line or (lines[0][:240] if lines else "")
        quality_score = 0.0
        quality_score += min(0.45, len(tokens) * 0.12)
        quality_score += min(0.35, _safe_word_count(content_norm) / 1500.0)
        if best_line:
            quality_score += 0.2
        quality_score = max(0.0, min(1.0, quality_score))
        statement = f"{entity_name}: {best_line}" if best_line else f"{entity_name} {lane} signal"
        return {
            "snippet": best_line,
            "content_item": content_item,
            "quality_score": quality_score,
            "statement": statement,
            "tokens": tokens,
        }

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
        prompt = (
            "Output one JSON object like {\"d\":\"N\",\"r\":\"ep\",\"c\":\"N\"}. No prose.\n"
            f"L={lane};S={evidence_snippet}\n"
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
        guessed = re.sub(r"[^a-z0-9]+", "", entity_name.lower())
        return f"{guessed}.com" if guessed else None

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
    ) -> bool:
        url = str(candidate.get("url") or "").strip()
        if not url:
            return False
        host = (urlparse(url).hostname or "").lower().lstrip("www.")
        if official_domain and (host == official_domain or host.endswith(f".{official_domain}")):
            return True

        lane_requires_strict_grounding = lane in {
            "rfp_procurement_tenders",
            "annual_report",
            "governance_pdf",
            "linkedin_jobs",
        }
        if not lane_requires_strict_grounding:
            return True

        def _normalize_words(text: str) -> List[str]:
            return [part for part in re.findall(r"[a-z0-9]+", str(text or "").lower()) if part]

        entity_words = _normalize_words(entity_name)
        if not entity_words:
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
            if lane in {"rfp_procurement_tenders", "annual_report", "governance_pdf"}:
                is_sports_entity = any(word in {"fc", "football", "club"} for word in entity_words)
                if is_sports_entity:
                    sports_context_markers = (
                        " football",
                        "football club",
                        " fc",
                        "f.c",
                        " stadium",
                        " sport",
                        " efl",
                        " premier league",
                    )
                    council_markers = ("city council", "borough council", "county council", "local authority")
                    has_sports_context = any(marker in searchable for marker in sports_context_markers)
                    has_council_context = any(marker in searchable for marker in council_markers)
                    if any(marker in host for marker in ("edemocracy.", "gov.uk", "charitycommission.")) and not (
                        official_domain and (host == official_domain or host.endswith(f".{official_domain}"))
                    ):
                        return False
                    return bool(has_sports_context and not has_council_context)
            return True

        if lane == "linkedin_jobs" and "linkedin.com" in host:
            return bool(alias_phrase and alias_phrase in searchable)

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
        return None

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
