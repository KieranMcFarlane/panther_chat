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
            "timestamp": self.timestamp.isoformat(),
        }


class DiscoveryRuntimeV2:
    """Deterministic, evidence-first discovery runtime."""

    def __init__(self, claude_client: Any, brightdata_client: Any):
        self.claude_client = claude_client
        self.brightdata_client = brightdata_client

        # Balanced production defaults (locked in plan).
        self.max_hops = int(os.getenv("DISCOVERY_MAX_HOPS", "5"))
        self.max_evals_per_hop = int(os.getenv("DISCOVERY_MAX_EVALS_PER_HOP", "2"))
        self.per_iteration_timeout = float(os.getenv("DISCOVERY_PER_ITERATION_TIMEOUT_SECONDS", "30"))
        self.max_retries = int(os.getenv("DISCOVERY_MAX_RETRIES", "2"))
        self.max_same_domain_revisits = int(os.getenv("DISCOVERY_MAX_SAME_DOMAIN_REVISITS", "2"))
        self.num_results = int(os.getenv("DISCOVERY_SEARCH_RESULTS_PER_QUERY", "5"))
        self.evidence_first = _truthy(os.getenv("DISCOVERY_POLICY_EVIDENCE_FIRST", "true"))
        self.enable_llm_eval = _truthy(os.getenv("DISCOVERY_V2_LLM_EVAL_ENABLED", "true"))
        self.run_profile = os.getenv("PIPELINE_RUN_PROFILE", "bounded_balanced_v2")

        self._metrics: Dict[str, int] = {
            "synthetic_url_attempt_count": 0,
            "dead_end_event_count": 0,
            "fallback_accept_block_count": 0,
        }

    async def run_discovery(
        self,
        entity_id: str,
        entity_name: str,
        template_id: Optional[str] = None,
        max_iterations: int = 30,
        **_kwargs: Any,
    ) -> DiscoveryResultV2:
        dossier = {"metadata": {"template_id": template_id}} if template_id else {}
        return await self.run_discovery_with_dossier_context(
            entity_id=entity_id,
            entity_name=entity_name,
            dossier=dossier,
            template_id=template_id,
            max_iterations=max_iterations,
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
    ) -> DiscoveryResultV2:
        del template_id, entity_type  # Intent-only in v2.

        start = time.perf_counter()
        self._metrics = {
            "synthetic_url_attempt_count": 0,
            "dead_end_event_count": 0,
            "fallback_accept_block_count": 0,
        }

        iteration_budget = min(max(1, int(max_iterations or self.max_hops)), self.max_hops)
        official_domain = self._official_domain(entity_name=entity_name, dossier=dossier)
        state: Dict[str, Any] = {
            "visited_urls": set(),
            "visited_hashes": set(),
            "accepted_signatures": set(),
            "rejected_urls": set(),
            "domain_visits": {},
            "lane_failures": {},
            "lane_exhausted": set(),
            "trusted_corroboration_tokens": set(),
            "iterations_completed": 0,
        }
        hop_timings: List[Dict[str, Any]] = []
        signals: List[Dict[str, Any]] = []
        diagnostics: List[Dict[str, Any]] = []
        llm_last_status = "heuristic_only"
        parse_path = "discovery_v2_evidence_first"

        pass_a_validated = 0
        for lane in PASS_A_LANES:
            if state["iterations_completed"] >= iteration_budget:
                break
            lane_result = await self._run_lane(
                lane=lane,
                entity_name=entity_name,
                dossier=dossier,
                official_domain=official_domain,
                state=state,
            )
            hop_timings.append(lane_result["hop"])
            state["iterations_completed"] += 1
            if lane_result["signal"]:
                signals.append(lane_result["signal"])
                if lane_result["signal"].get("validation_state") == "validated":
                    pass_a_validated += 1
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

        pass_b_executed = False
        if pass_a_validated > 0 and state["iterations_completed"] < iteration_budget:
            pass_b_executed = True
            for lane in PASS_B_LANES:
                if state["iterations_completed"] >= iteration_budget:
                    break
                lane_result = await self._run_lane(
                    lane=lane,
                    entity_name=entity_name,
                    dossier=dossier,
                    official_domain=official_domain,
                    state=state,
                )
                hop_timings.append(lane_result["hop"])
                state["iterations_completed"] += 1
                if lane_result["signal"]:
                    signals.append(lane_result["signal"])
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
        if not validated_signals:
            diagnostics.append(
                {
                    "id": f"{entity_id}-no-signal",
                    "type": "NO_SIGNAL_FOUND",
                    "statement": "No validated discovery signals found within bounded budget",
                    "confidence": 0.0,
                    "url": None,
                    "source_tier": "tier_3",
                    "validation_state": "diagnostic",
                    "accept_guard_passed": False,
                    "accept_reject_reasons": ["no_validated_signals"],
                    "candidate_origin": "diagnostic",
                    "evidence_quality_score": 0.0,
                    "lane_exhausted": False,
                    "dead_end_reason": "budget_exhausted_no_validated_signals",
                    "content_hash": None,
                    "evidence_found": "",
                    "content": "",
                    "parse_path": "diagnostic_no_signal",
                    "llm_last_status": llm_last_status,
                }
            )

        all_events = [*signals, *diagnostics]
        entity_confidence = self._compute_entity_confidence(validated_signals, state, hop_timings)
        pipeline_confidence = self._compute_pipeline_confidence(
            iterations=state["iterations_completed"],
            budget=iteration_budget,
            hop_timings=hop_timings,
            state=state,
        )
        final_confidence = round(max(0.0, min(1.0, entity_confidence * 0.8 + pipeline_confidence * 0.2)), 3)

        elapsed = round(time.perf_counter() - start, 3)
        performance_summary = {
            "run_profile": self.run_profile,
            "engine": "v2",
            "evaluation_mode": "evidence_first",
            "parse_path": parse_path,
            "llm_last_status": llm_last_status,
            "entity_confidence": entity_confidence,
            "pipeline_confidence": pipeline_confidence,
            "hop_timings": hop_timings,
            "synthetic_url_attempt_count": int(self._metrics["synthetic_url_attempt_count"]),
            "dead_end_event_count": int(self._metrics["dead_end_event_count"]),
            "fallback_accept_block_count": int(self._metrics["fallback_accept_block_count"]),
            "two_pass": {
                "enabled": True,
                "pass_a": {
                    "iterations": min(len(PASS_A_LANES), iteration_budget),
                    "validated_signals": pass_a_validated,
                },
                "pass_b_executed": pass_b_executed,
                "selected_result": "pass_b" if pass_b_executed else "pass_a",
            },
            "duration_seconds": elapsed,
            "route_diversification_order": DIVERSIFIED_FALLBACK_ORDER,
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
            signals_discovered=all_events,
            raw_signals=all_events,
            hypothesis_states={},
            performance_summary=performance_summary,
            entity_confidence=entity_confidence,
            pipeline_confidence=pipeline_confidence,
            parse_path=parse_path,
            llm_last_status=llm_last_status,
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
    ) -> Dict[str, Any]:
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
        }
        signal: Optional[Dict[str, Any]] = None
        diagnostic: Optional[Dict[str, Any]] = None

        if lane in state["lane_exhausted"]:
            hop_record["lane_exhausted"] = True
            hop_record["dead_end_reason"] = "lane_already_exhausted"
            hop_record["evidence_type"] = "lane_exhaustion"
            hop_record["duration_ms"] = int((time.perf_counter() - started) * 1000)
            return {"hop": hop_record, "signal": None, "diagnostic": None}

        candidates = await self._discover_candidates(lane=lane, entity_name=entity_name, dossier=dossier)
        if not candidates:
            self._mark_lane_dead(lane, state, "no_discovered_candidates")
            hop_record["lane_exhausted"] = True
            hop_record["dead_end_reason"] = "no_discovered_candidates"
            hop_record["evidence_type"] = "discovery_dead_end"
            hop_record["duration_ms"] = int((time.perf_counter() - started) * 1000)
            return {"hop": hop_record, "signal": None, "diagnostic": None}

        for candidate in candidates[: max(1, self.max_evals_per_hop)]:
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
            if url in state["visited_urls"]:
                self._register_lane_failure(lane, state, "duplicate_url")
                continue

            host = (urlparse(url).hostname or "").lower()
            if host:
                revisit_count = int(state["domain_visits"].get(host, 0) or 0)
                if revisit_count >= self.max_same_domain_revisits:
                    self._register_lane_failure(lane, state, "same_domain_revisit_cap")
                    continue

            scraped = await self._scrape_with_budget(url)
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

            signature = self._evidence_signature(url=url, lane=lane, snippet=evidence_snippet)
            if signature in state["accepted_signatures"]:
                accept_reject_reasons.append("duplicate_evidence_signature")

            if source_tier == "tier_3" and not self._has_tier12_corroboration(state, evidence):
                accept_reject_reasons.append("tier3_without_corroboration")

            accept_guard_passed = len(accept_reject_reasons) == 0
            if accept_guard_passed:
                validation_state = "validated"
                state["accepted_signatures"].add(signature)
                for token in evidence.get("tokens", []):
                    state["trusted_corroboration_tokens"].add(token)
            else:
                if quality_score > 0.25 and evidence_snippet:
                    validation_state = "candidate"
                else:
                    validation_state = "diagnostic"
                if source_tier == "tier_3" and "tier3_without_corroboration" in accept_reject_reasons:
                    self._metrics["fallback_accept_block_count"] += 1

            llm_eval = await self._maybe_llm_evaluate(
                lane=lane,
                entity_name=entity_name,
                url=url,
                evidence=evidence,
            )
            if llm_eval.get("parse_path"):
                hop_record["parse_path"] = llm_eval["parse_path"]
            if llm_eval.get("llm_last_status"):
                hop_record["llm_last_status"] = llm_eval["llm_last_status"]
            if llm_eval.get("decision") == "ACCEPT" and not accept_guard_passed:
                # Hard block: fallback/invalid evidence cannot become ACCEPT.
                self._metrics["fallback_accept_block_count"] += 1

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
                "parse_path": hop_record["parse_path"],
                "llm_last_status": hop_record["llm_last_status"],
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
        return {"hop": hop_record, "signal": signal, "diagnostic": diagnostic}

    async def _discover_candidates(self, *, lane: str, entity_name: str, dossier: Dict[str, Any]) -> List[Dict[str, Any]]:
        queries = list(LANE_QUERIES.get(lane, ('"{entity}" digital procurement',)))
        discovered: List[Dict[str, Any]] = []
        seen: Set[str] = set()

        # Include known canonical source as discovered candidate, not synthetic.
        canonical = (dossier.get("metadata", {}) if isinstance(dossier, dict) else {}).get("canonical_sources", {})
        official = canonical.get("official_site") if isinstance(canonical, dict) else None
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

        for raw_query in queries[:1]:
            query = raw_query.format(entity=entity_name)
            try:
                response = await self.brightdata_client.search_engine(
                    query=query,
                    engine="google",
                    num_results=self.num_results,
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
                    }
                )

        ranked = sorted(
            discovered,
            key=lambda candidate: self._candidate_score(candidate, lane=lane, entity_name=entity_name),
            reverse=True,
        )
        return ranked

    async def _scrape_with_budget(self, url: str) -> Dict[str, Any]:
        last_error = None
        for _attempt in range(max(1, self.max_retries)):
            try:
                return await asyncio.wait_for(
                    self.brightdata_client.scrape_as_markdown(url),
                    timeout=self.per_iteration_timeout,
                )
            except Exception as scrape_error:  # noqa: BLE001
                last_error = scrape_error
        return {
            "status": "error",
            "url": url,
            "content": "",
            "metadata": {"error": str(last_error) if last_error else "scrape_failed"},
        }

    def _candidate_score(self, candidate: Dict[str, Any], *, lane: str, entity_name: str) -> float:
        score = 0.0
        url = str(candidate.get("url") or "").lower()
        title = str(candidate.get("title") or "").lower()
        snippet = str(candidate.get("snippet") or "").lower()
        text = f"{title} {snippet} {url}"

        if entity_name.lower() in text:
            score += 0.35
        for token in LANE_KEYWORDS.get(lane, ()):
            if token in text:
                score += 0.12
        if url.endswith(".pdf"):
            score += 0.08 if lane in {"annual_report", "governance_pdf"} else -0.05
        if "linkedin.com/jobs" in url and lane == "linkedin_jobs":
            score += 0.2
        if lane in {"press_release", "trusted_news"} and any(domain in url for domain in TRUSTED_NEWS_DOMAINS):
            score += 0.2
        return score

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
    ) -> Dict[str, Any]:
        if not self.enable_llm_eval:
            return {
                "decision": "WEAK_ACCEPT_CANDIDATE",
                "parse_path": "heuristic_only",
                "llm_last_status": "heuristic_only",
            }
        prompt = (
            "Return strict JSON with keys decision,reason.\n"
            "Allowed decision: ACCEPT|WEAK_ACCEPT_CANDIDATE|NO_PROGRESS|PIPELINE_DIAGNOSTIC|RETRY_DIFFERENT_HOP.\n"
            f"Entity: {entity_name}\nLane: {lane}\nURL: {url}\n"
            f"Evidence: {evidence.get('snippet')}\n"
        )
        try:
            response = await self.claude_client.query(prompt=prompt, model="haiku", max_tokens=180)
            payload = _extract_json_object((response or {}).get("content"))
            if not payload:
                return {
                    "decision": "WEAK_ACCEPT_CANDIDATE",
                    "parse_path": "schema_gate_fallback",
                    "llm_last_status": "empty_response",
                }
            decision = str(payload.get("decision") or "NO_PROGRESS").upper()
            if decision == "ACCEPT":
                # LLM may suggest ACCEPT; final ACCEPT gate still enforced externally.
                return {
                    "decision": "ACCEPT",
                    "parse_path": "llm_json",
                    "llm_last_status": "ok",
                }
            if decision not in {"WEAK_ACCEPT_CANDIDATE", "NO_PROGRESS", "PIPELINE_DIAGNOSTIC", "RETRY_DIFFERENT_HOP"}:
                decision = "NO_PROGRESS"
            return {
                "decision": decision,
                "parse_path": "llm_json",
                "llm_last_status": "ok",
            }
        except Exception:  # noqa: BLE001
            return {
                "decision": "WEAK_ACCEPT_CANDIDATE",
                "parse_path": "schema_gate_fallback",
                "llm_last_status": "timeout",
            }

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
        state: Dict[str, Any],
        hop_timings: List[Dict[str, Any]],
    ) -> float:
        if not validated_signals:
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
    ) -> float:
        completion_ratio = min(1.0, float(iterations) / float(max(1, budget)))
        dead_end_penalty = min(0.4, float(self._metrics["dead_end_event_count"]) * 0.08)
        timeout_penalty = 0.0
        for hop in hop_timings:
            if float(hop.get("duration_ms") or 0.0) > (self.per_iteration_timeout * 1000.0):
                timeout_penalty += 0.05
        score = 0.55 + completion_ratio * 0.35 - dead_end_penalty - min(0.2, timeout_penalty)
        if state.get("lane_exhausted"):
            score -= min(0.1, len(state["lane_exhausted"]) * 0.03)
        return round(max(0.0, min(0.99, score)), 3)
