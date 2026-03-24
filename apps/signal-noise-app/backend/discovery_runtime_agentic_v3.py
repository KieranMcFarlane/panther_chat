#!/usr/bin/env python3
"""Planner-led discovery runtime v3.

Agentic v3 keeps Bright Data and Chutes as the execution stack but moves the
controller to a planner-led turn loop. Deterministic logic is used only for
safety rails, evidence normalization, and scoring.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.parse import urljoin, urlparse

try:
    from backend.objective_profiles import get_objective_profile, normalize_run_objective
except ImportError:
    from objective_profiles import get_objective_profile, normalize_run_objective

logger = logging.getLogger(__name__)

TRUSTED_NEWS_DOMAINS = {
    "bbc.com",
    "bbc.co.uk",
    "reuters.com",
    "ft.com",
    "theguardian.com",
    "apnews.com",
    "espn.com",
    "skysports.com",
    "theathletic.com",
    "coventrytelegraph.net",
    "coventryobserver.co.uk",
    "jobsinfootball.com",
}

PLANNER_ACTION_JSON_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "action": {
            "type": "string",
            "enum": [
                "search_web",
                "search_site",
                "scrape_url",
                "render_url",
                "follow_link",
                "probe_same_domain",
                "fetch_pdf",
                "stop",
            ],
        },
        "target": {"type": "string"},
        "candidate_index": {"type": "integer", "minimum": 0},
        "purpose": {"type": "string"},
        "expected_signal_type": {"type": "string"},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        "reason": {"type": "string"},
    },
    "required": ["action"],
}

JUDGE_JSON_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "validation_state": {"type": "string", "enum": ["validated", "provisional", "candidate", "rejected"]},
        "evidence_type": {"type": "string"},
        "entity_grounding": {"type": "number", "minimum": 0, "maximum": 1},
        "yellow_panther_relevance": {"type": "number", "minimum": 0, "maximum": 1},
        "confidence_contribution": {"type": "number", "minimum": -0.2, "maximum": 0.3},
        "reason_code": {"type": "string"},
        "actionability_score": {"type": "number", "minimum": 0, "maximum": 100},
    },
    "required": ["validation_state", "reason_code"],
}


@dataclass
class DiscoveryResultAgenticV3:
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
    provisional_signals: List[Dict[str, Any]] = field(default_factory=list)
    raw_signals: List[Any] = field(default_factory=list)
    hypothesis_states: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    performance_summary: Dict[str, Any] = field(default_factory=dict)
    entity_confidence: float = 0.0
    pipeline_confidence: float = 0.0
    parse_path: str = "agentic_v3_planner_led"
    llm_last_status: str = "ok"
    candidate_evaluations: List[Dict[str, Any]] = field(default_factory=list)
    candidate_events_summary: Dict[str, Any] = field(default_factory=dict)
    lane_failures: Dict[str, Any] = field(default_factory=dict)
    controller_health_reasons: List[str] = field(default_factory=list)
    turn_trace: List[Dict[str, Any]] = field(default_factory=list)
    planner_decisions: List[Dict[str, Any]] = field(default_factory=list)
    executed_actions: List[Dict[str, Any]] = field(default_factory=list)
    credit_ledger: List[Dict[str, Any]] = field(default_factory=list)
    evidence_ledger: List[Dict[str, Any]] = field(default_factory=list)
    actionability_score: float = 0.0
    entity_grounded_signal_count: int = 0
    winner_metadata: Dict[str, Any] = field(default_factory=dict)
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
            "provisional_signals": self.provisional_signals,
            "raw_signals_count": len(self.raw_signals),
            "hypothesis_states": self.hypothesis_states,
            "performance_summary": self.performance_summary,
            "entity_confidence": self.entity_confidence,
            "pipeline_confidence": self.pipeline_confidence,
            "parse_path": self.parse_path,
            "llm_last_status": self.llm_last_status,
            "candidate_evaluations": self.candidate_evaluations,
            "candidate_events_summary": self.candidate_events_summary,
            "lane_failures": self.lane_failures,
            "controller_health_reasons": self.controller_health_reasons,
            "turn_trace": self.turn_trace,
            "planner_decisions": self.planner_decisions,
            "executed_actions": self.executed_actions,
            "credit_ledger": self.credit_ledger,
            "evidence_ledger": self.evidence_ledger,
            "actionability_score": self.actionability_score,
            "entity_grounded_signal_count": self.entity_grounded_signal_count,
            "winner_metadata": self.winner_metadata,
            "timestamp": self.timestamp.isoformat(),
        }


class DiscoveryRuntimeAgenticV3:
    def __init__(self, claude_client: Any, brightdata_client: Any):
        self.claude_client = claude_client
        self.brightdata_client = brightdata_client
        self.current_official_site_url: Optional[str] = None
        self.default_credit_budget = max(1, int(os.getenv("AGENTIC_V3_START_CREDITS", "10")))
        self.credit_cap = max(self.default_credit_budget, int(os.getenv("AGENTIC_V3_CREDIT_CAP", "30")))
        self.max_no_progress_turns = max(1, int(os.getenv("AGENTIC_V3_MAX_NO_PROGRESS_TURNS", "3")))
        self.max_search_results = max(3, int(os.getenv("AGENTIC_V3_MAX_SEARCH_RESULTS", "6")))
        self.max_candidates_preview = max(3, int(os.getenv("AGENTIC_V3_MAX_CANDIDATES_PREVIEW", "5")))
        self.max_internal_links = max(4, int(os.getenv("AGENTIC_V3_MAX_INTERNAL_LINKS", "8")))
        self.render_word_floor = max(30, int(os.getenv("AGENTIC_V3_RENDER_WORD_FLOOR", "60")))
        self._metrics: Dict[str, Any] = {}

    async def run_discovery(self, **kwargs) -> DiscoveryResultAgenticV3:
        return await self.run_discovery_with_dossier_context(**kwargs)

    async def run_discovery_with_dossier_context(
        self,
        *,
        entity_id: str,
        entity_name: str,
        dossier: Optional[Dict[str, Any]] = None,
        max_iterations: int = 10,
        template_id: Optional[str] = None,
        entity_type: Optional[str] = None,
        **_kwargs: Any,
    ) -> DiscoveryResultAgenticV3:
        del template_id, entity_type
        started = time.perf_counter()
        objective = normalize_run_objective(os.getenv("PIPELINE_RUN_OBJECTIVE", "dossier_core"))
        objective_profile = get_objective_profile(objective, default="dossier_core")
        dossier = dossier if isinstance(dossier, dict) else {}
        official_site = self._extract_official_site(dossier)
        official_domains = self._official_domains(official_site)
        entity_tokens = self._entity_tokens(entity_name)
        requested_iterations = int(max_iterations or 0)
        if requested_iterations <= 0:
            requested_iterations = self.default_credit_budget
        starting_credits = min(max(1, requested_iterations), self.credit_cap)
        state: Dict[str, Any] = {
            "mission_brief": self._build_mission_brief(entity_name=entity_name, objective=objective),
            "entity_profile": self._build_entity_profile(entity_name=entity_name, dossier=dossier),
            "official_site_url": official_site,
            "official_domains": official_domains,
            "visited_urls": set(),
            "visited_queries": set(),
            "pending_candidates": [],
            "failed_paths": {},
            "open_hypotheses": self._initial_hypotheses(entity_name=entity_name, objective_profile=objective_profile),
            "remaining_credits": starting_credits,
            "current_confidence": 0.35,
            "consecutive_no_signal": 0,
            "consecutive_low_signal_by_branch": {},
            "turn_trace": [],
            "planner_decisions": [],
            "executed_actions": [],
            "credit_ledger": [],
            "evidence_ledger": [],
            "validated_signals": [],
            "provisional_signals": [],
            "candidate_evaluations": [],
            "lane_failures": {},
        }
        self._metrics = {
            "planner_turn_count": 0,
            "planner_decision_parse_fail_count": 0,
            "planner_decision_applied_count": 0,
            "planner_branch_change_count": 0,
            "credits_spent": 0,
            "credits_earned": 0,
            "off_entity_reject_count": 0,
            "judge_fallback_count": 0,
            "schema_fail_count": 0,
            "llm_last_status": "ok",
        }

        last_observation: Dict[str, Any] = {
            "summary": "bootstrap",
            "candidate_count": 0,
        }
        previous_purpose = "bootstrap"
        stop_reason = "credit_exhausted"

        while state["remaining_credits"] > 0:
            turn_index = len(state["turn_trace"]) + 1
            if turn_index > self.credit_cap:
                stop_reason = "hard_cap_reached"
                break
            planner_action = await self._choose_next_action(
                entity_name=entity_name,
                objective=objective,
                state=state,
                last_observation=last_observation,
                entity_tokens=entity_tokens,
            )
            if not planner_action:
                stop_reason = "planner_schema_failed"
                break
            self._metrics["planner_turn_count"] += 1
            self._metrics["planner_decision_applied_count"] += 1
            current_purpose = str(planner_action.get("purpose") or planner_action.get("action") or "unknown")
            if current_purpose != previous_purpose:
                self._metrics["planner_branch_change_count"] += 1
            previous_purpose = current_purpose
            state["planner_decisions"].append({"turn": turn_index, **planner_action})

            state["remaining_credits"] -= 1
            self._metrics["credits_spent"] += 1
            credit_entry = {
                "turn": turn_index,
                "before": state["remaining_credits"] + 1,
                "spent": 1,
                "earned": 0,
                "after": state["remaining_credits"],
                "reason": current_purpose,
            }
            execution = await self._execute_action(
                action=planner_action,
                entity_name=entity_name,
                state=state,
                entity_tokens=entity_tokens,
                official_domains=official_domains,
            )
            state["executed_actions"].append(execution.get("executed_action") or {"turn": turn_index, **planner_action})
            branch_key = str(execution.get("branch") or planner_action.get("purpose") or planner_action.get("action") or "general")
            signals_found = 0

            if execution.get("kind") == "stop":
                stop_reason = str(execution.get("reason") or "planner_stop")
                state["turn_trace"].append(
                    {
                        "turn": turn_index,
                        "planner_action": planner_action,
                        "executed_action": execution.get("executed_action"),
                        "judge_verdict": None,
                        "credit_delta": credit_entry,
                        "stop_reason": stop_reason,
                    }
                )
                state["credit_ledger"].append(credit_entry)
                break

            if execution.get("kind") == "search":
                candidates = execution.get("candidates") or []
                state["pending_candidates"].extend(candidates)
                last_observation = {
                    "summary": execution.get("summary") or f"search returned {len(candidates)} candidates",
                    "candidate_count": len(candidates),
                    "candidates": candidates[: self.max_candidates_preview],
                }
                if not candidates:
                    self._register_lane_failure(state, branch_key, "search_no_results")
                    state["consecutive_no_signal"] += 1
                else:
                    state["consecutive_no_signal"] = 0
            elif execution.get("kind") == "scrape":
                evidence = execution.get("evidence")
                if evidence:
                    state["evidence_ledger"].append(evidence)
                    judge_verdict = evidence.get("judge_verdict") or {}
                    validation_state = str(evidence.get("validation_state") or "candidate").lower()
                    candidate_eval = dict(evidence.get("candidate_evaluation") or {})
                    if candidate_eval:
                        state["candidate_evaluations"].append(candidate_eval)
                    if validation_state == "validated":
                        state["validated_signals"].append(self._to_signal_record(evidence, validation_state))
                        signals_found = 1
                    elif validation_state == "provisional":
                        state["provisional_signals"].append(self._to_signal_record(evidence, validation_state))
                    else:
                        state["candidate_evaluations"].append(candidate_eval or self._candidate_eval_from_evidence(evidence))
                    if validation_state in {"validated", "provisional"}:
                        state["current_confidence"] = min(0.95, state["current_confidence"] + float(judge_verdict.get("confidence_contribution") or 0.05))
                        state["consecutive_no_signal"] = 0
                    else:
                        state["consecutive_no_signal"] += 1
                    if str(candidate_eval.get("reason_code") or "") == "off_entity":
                        self._metrics["off_entity_reject_count"] += 1
                else:
                    self._register_lane_failure(state, branch_key, str(execution.get("reason") or "scrape_no_evidence"))
                    state["consecutive_no_signal"] += 1
                last_observation = execution.get("observation") or {"summary": execution.get("summary") or "scrape executed"}

            earned = self._adjust_credit_budget(state=state, branch_key=branch_key, execution=execution)
            if earned:
                state["remaining_credits"] = min(self.credit_cap, state["remaining_credits"] + earned)
                self._metrics["credits_earned"] += earned
                credit_entry["earned"] = earned
                credit_entry["after"] = state["remaining_credits"]

            state["credit_ledger"].append(credit_entry)
            state["turn_trace"].append(
                {
                    "turn": turn_index,
                    "planner_action": planner_action,
                    "executed_action": execution.get("executed_action"),
                    "observation": last_observation,
                    "judge_verdict": (execution.get("evidence") or {}).get("judge_verdict") if execution.get("evidence") else None,
                    "credit_delta": credit_entry,
                    "stop_reason": execution.get("stop_reason"),
                }
            )

            if signals_found:
                stop_reason = "validated_signal_found"
            if state["consecutive_no_signal"] >= self.max_no_progress_turns:
                stop_reason = "no_progress_budget_stop"
                break

        total_duration_ms = round((time.perf_counter() - started) * 1000.0, 2)
        validated_signals = list(state["validated_signals"])
        provisional_signals = list(state["provisional_signals"])
        candidate_evaluations = list(state["candidate_evaluations"])
        actionability_score = self._overall_actionability_score(validated_signals, provisional_signals, candidate_evaluations)
        entity_grounded_signal_count = sum(
            1
            for item in [*validated_signals, *provisional_signals]
            if float(item.get("entity_grounding") or 0.0) >= 0.45
        )
        final_confidence = self._compute_final_confidence(
            validated_signals=validated_signals,
            provisional_signals=provisional_signals,
            actionability_score=actionability_score,
        )
        confidence_band = self._confidence_band(final_confidence)
        candidate_summary = self._summarize_candidate_events(candidate_evaluations)
        off_entity_reject_rate = round(
            float(self._metrics.get("off_entity_reject_count") or 0) / max(1, len(candidate_evaluations)),
            4,
        )
        planner_turn_count = int(self._metrics.get("planner_turn_count") or 0)
        planner_applied = int(self._metrics.get("planner_decision_applied_count") or 0)
        planner_parse_fail = int(self._metrics.get("planner_decision_parse_fail_count") or 0)
        planner_applied_rate = round(planner_applied / max(1, planner_turn_count + planner_parse_fail), 4)
        controller_health_reasons = self._build_controller_health_reasons(
            planner_applied_rate=planner_applied_rate,
            planner_parse_fail_count=planner_parse_fail,
            validated_count=len(validated_signals),
            off_entity_reject_rate=off_entity_reject_rate,
            judge_fallback_count=int(self._metrics.get("judge_fallback_count") or 0),
            schema_fail_count=int(self._metrics.get("schema_fail_count") or 0),
        )
        performance_summary = {
            "runtime_mode": "agentic_v3",
            "run_mode": "agentic_v3_planner_led",
            "total_duration_ms": total_duration_ms,
            "stop_reason": stop_reason,
            "signals_validated_count": len(validated_signals),
            "signals_provisional_count": len(provisional_signals),
            "signals_candidate_events_count": len(candidate_evaluations),
            "planner_turn_count": planner_turn_count,
            "planner_decision_parse_fail_count": planner_parse_fail,
            "planner_decision_applied_count": planner_applied,
            "planner_decision_applied_rate": planner_applied_rate,
            "planner_branch_change_count": int(self._metrics.get("planner_branch_change_count") or 0),
            "credits_spent": int(self._metrics.get("credits_spent") or 0),
            "credits_earned": int(self._metrics.get("credits_earned") or 0),
            "judge_fallback_count": int(self._metrics.get("judge_fallback_count") or 0),
            "entity_grounded_signal_count": entity_grounded_signal_count,
            "actionability_score": actionability_score,
            "off_entity_reject_rate": off_entity_reject_rate,
            "candidate_events_summary": candidate_summary,
            "lane_failures": state["lane_failures"],
            "controller_health_reasons": controller_health_reasons,
            "llm_last_status": str(self._metrics.get("llm_last_status") or "ok"),
            "official_site_resolution_traces": [
                {
                    "official_site_url": official_site,
                    "official_domains": sorted(official_domains),
                    "lane_statuses": {},
                }
            ],
            "hop_timings": [
                {
                    "turn": row.get("turn"),
                    "action": ((row.get("executed_action") or {}).get("action") if isinstance(row, dict) else None),
                    "target": ((row.get("executed_action") or {}).get("target") if isinstance(row, dict) else None),
                    "summary": ((row.get("observation") or {}).get("summary") if isinstance(row, dict) else None),
                }
                for row in state["turn_trace"]
                if isinstance(row, dict)
            ],
        }
        return DiscoveryResultAgenticV3(
            entity_id=entity_id,
            entity_name=entity_name,
            final_confidence=final_confidence,
            confidence_band=confidence_band,
            is_actionable=actionability_score >= 60 and len(validated_signals) >= 1,
            iterations_completed=len(state["turn_trace"]),
            total_cost_usd=0.0,
            hypotheses=list(state["open_hypotheses"]),
            depth_stats={0: len(validated_signals), 1: len(provisional_signals)},
            signals_discovered=validated_signals,
            provisional_signals=provisional_signals,
            raw_signals=list(state["evidence_ledger"]),
            hypothesis_states={},
            performance_summary=performance_summary,
            entity_confidence=round(min(0.95, 0.35 + (entity_grounded_signal_count * 0.08)), 3),
            pipeline_confidence=round(final_confidence, 3),
            parse_path="agentic_v3_planner_led",
            llm_last_status=str(self._metrics.get("llm_last_status") or "ok"),
            candidate_evaluations=candidate_evaluations,
            candidate_events_summary=candidate_summary,
            lane_failures=state["lane_failures"],
            controller_health_reasons=controller_health_reasons,
            turn_trace=list(state["turn_trace"]),
            planner_decisions=list(state["planner_decisions"]),
            executed_actions=list(state["executed_actions"]),
            credit_ledger=list(state["credit_ledger"]),
            evidence_ledger=list(state["evidence_ledger"]),
            actionability_score=actionability_score,
            entity_grounded_signal_count=entity_grounded_signal_count,
        )

    def _extract_official_site(self, dossier: Dict[str, Any]) -> Optional[str]:
        metadata = dossier.get("metadata") if isinstance(dossier.get("metadata"), dict) else {}
        canonical = metadata.get("canonical_sources") if isinstance(metadata, dict) and isinstance(metadata.get("canonical_sources"), dict) else {}
        candidates = [
            canonical.get("official_site") if isinstance(canonical, dict) else None,
            metadata.get("website") if isinstance(metadata, dict) else None,
            dossier.get("official_site_url"),
            self.current_official_site_url,
        ]
        for candidate in candidates:
            normalized = self._normalize_url(candidate)
            if normalized:
                self.current_official_site_url = normalized
                return normalized
        return None

    def _build_mission_brief(self, *, entity_name: str, objective: str) -> str:
        return (
            f"Find real procurement need, future-RFP timing, and decision-maker targets for Yellow Panther services "
            f"for {entity_name}. Objective={objective}. Prefer official-domain and entity-grounded evidence."
        )

    def _build_entity_profile(self, *, entity_name: str, dossier: Dict[str, Any]) -> Dict[str, Any]:
        metadata = dossier.get("metadata") if isinstance(dossier.get("metadata"), dict) else {}
        return {
            "entity_name": entity_name,
            "sport": metadata.get("sport"),
            "country": metadata.get("country"),
            "league_or_competition": metadata.get("league_or_competition"),
            "website": metadata.get("website"),
        }

    def _initial_hypotheses(self, *, entity_name: str, objective_profile: Dict[str, Any]) -> List[str]:
        objective_name = str(objective_profile.get("objective") or objective_profile.get("name") or "dossier_core")
        return [
            f"{entity_name} shows active procurement or supplier intent",
            f"{entity_name} shows future digital or commercial change timing",
            f"{entity_name} exposes named decision makers relevant to Yellow Panther",
            f"Objective profile: {objective_name}",
        ]

    async def _choose_next_action(
        self,
        *,
        entity_name: str,
        objective: str,
        state: Dict[str, Any],
        last_observation: Dict[str, Any],
        entity_tokens: List[str],
    ) -> Optional[Dict[str, Any]]:
        pending = state.get("pending_candidates") or []
        preview = []
        for index, candidate in enumerate(pending[: self.max_candidates_preview]):
            if not isinstance(candidate, dict):
                continue
            preview.append(
                {
                    "candidate_index": index,
                    "url": candidate.get("url"),
                    "title": candidate.get("title"),
                    "snippet": candidate.get("snippet"),
                    "host": candidate.get("host"),
                }
            )
        prompt = (
            "Return strict JSON only. Choose exactly one next action.\n"
            f"Mission: {state.get('mission_brief')}\n"
            f"Entity: {entity_name}\n"
            f"Entity grounding tokens: {json.dumps(entity_tokens, separators=(',', ':'))}\n"
            f"Objective: {objective}\n"
            f"Official domains: {json.dumps(sorted(state.get('official_domains') or []), separators=(',', ':'))}\n"
            f"Remaining credits: {int(state.get('remaining_credits') or 0)}\n"
            f"Failed paths: {json.dumps(state.get('failed_paths') or {}, separators=(',', ':'))}\n"
            f"Evidence ledger summary: {self._planner_evidence_summary(state)}\n"
            f"Last observation: {json.dumps(last_observation or {}, separators=(',', ':'))}\n"
            f"Candidate options: {json.dumps(preview, separators=(',', ':'))}\n"
            "Pick the move that most increases confidence of procurement need, future-RFP timing, or named decision-maker discovery."
        )
        response: Dict[str, Any] = {}
        try:
            response = await self.claude_client.query(
                prompt=prompt,
                model="planner",
                max_tokens=220,
                json_mode=True,
                json_schema=PLANNER_ACTION_JSON_SCHEMA,
                stream=False,
                max_retries_override=0,
                empty_retries_before_fallback_override=1,
                fast_fail_on_length=True,
            )
        except Exception as planner_error:  # noqa: BLE001
            logger.warning("⚠️ Planner query failed: %s", planner_error)
            self._metrics["llm_last_status"] = "planner_query_error"
        payload = self._extract_json_payload(response)
        action = self._normalize_planner_action(payload=payload, state=state)
        if action:
            return action
        raw = str((response or {}).get("content") or "").strip()
        if raw:
            try:
                repair = await self.claude_client.query(
                    prompt=(
                        "Normalize this into one strict JSON planner action only.\n"
                        f"Raw output: {raw[:900]}"
                    ),
                    model="planner",
                    max_tokens=180,
                    json_mode=True,
                    json_schema=PLANNER_ACTION_JSON_SCHEMA,
                    stream=False,
                    max_retries_override=0,
                    empty_retries_before_fallback_override=1,
                    fast_fail_on_length=True,
                )
            except Exception as repair_error:  # noqa: BLE001
                logger.warning("⚠️ Planner repair query failed: %s", repair_error)
                repair = {}
            payload = self._extract_json_payload(repair)
            action = self._normalize_planner_action(payload=payload, state=state)
            if action:
                return action
        self._metrics["planner_decision_parse_fail_count"] += 1
        self._metrics["schema_fail_count"] += 1
        self._metrics["llm_last_status"] = "planner_schema_fail"
        return None

    async def _execute_action(
        self,
        *,
        action: Dict[str, Any],
        entity_name: str,
        state: Dict[str, Any],
        entity_tokens: List[str],
        official_domains: Set[str],
    ) -> Dict[str, Any]:
        action_name = str(action.get("action") or "stop").strip().lower()
        executed_action = {"action": action_name, "target": action.get("target"), "purpose": action.get("purpose")}
        if action_name == "stop":
            return {"kind": "stop", "reason": str(action.get("reason") or "planner_stop"), "executed_action": executed_action, "branch": "stop"}

        if action_name in {"search_web", "search_site", "probe_same_domain"}:
            query = self._resolve_search_query(action=action, entity_name=entity_name, official_domains=official_domains)
            if query in state["visited_queries"]:
                return {
                    "kind": "search",
                    "summary": f"duplicate query skipped: {query}",
                    "candidates": [],
                    "executed_action": {**executed_action, "target": query},
                    "branch": str(action.get("purpose") or action_name),
                }
            state["visited_queries"].add(query)
            try:
                search_result = await self.brightdata_client.search_engine(
                    query=query,
                    engine="google",
                    num_results=self.max_search_results,
                )
            except Exception as search_error:  # noqa: BLE001
                logger.warning("⚠️ Search action failed (query=%s): %s", query, search_error)
                search_result = {"status": "error", "results": [], "error": str(search_error)}
            candidates = self._search_results_to_candidates(search_result=search_result, official_domains=official_domains, query=query, state=state)
            return {
                "kind": "search",
                "summary": f"search query={query} results={len(candidates)}",
                "candidates": candidates,
                "executed_action": {**executed_action, "target": query, "request_type": "search_engine"},
                "branch": str(action.get("purpose") or action_name),
            }

        url = self._resolve_action_url(action=action, state=state)
        if not url:
            return {
                "kind": "scrape",
                "reason": "missing_target_url",
                "summary": "planner selected scrape without URL",
                "executed_action": executed_action,
                "branch": str(action.get("purpose") or action_name),
            }
        if url in state["visited_urls"]:
            return {
                "kind": "scrape",
                "reason": "duplicate_url",
                "summary": f"duplicate url skipped: {url}",
                "executed_action": {**executed_action, "target": url},
                "branch": str(action.get("purpose") or action_name),
            }
        state["visited_urls"].add(url)
        try:
            scrape_result = await self._scrape_for_action(action_name=action_name, url=url)
        except Exception as scrape_error:  # noqa: BLE001
            logger.warning("⚠️ Scrape action failed (action=%s url=%s): %s", action_name, url, scrape_error)
            return {
                "kind": "scrape",
                "reason": "scrape_action_exception",
                "summary": f"scrape action failed: {url}",
                "executed_action": {**executed_action, "target": url},
                "branch": str(action.get("purpose") or action_name),
            }
        evidence = await self._evaluate_scrape(
            entity_name=entity_name,
            entity_tokens=entity_tokens,
            url=url,
            scrape_result=scrape_result,
            action=action,
            official_domains=official_domains,
        )
        if evidence and evidence.get("internal_links"):
            self._append_follow_links(state=state, links=evidence.get("internal_links") or [], official_domains=official_domains)
        return {
            "kind": "scrape",
            "summary": f"scrape action={action_name} url={url}",
            "evidence": evidence,
            "observation": {
                "summary": (evidence or {}).get("observation_summary") or f"scraped {url}",
                "word_count": int(((scrape_result or {}).get("metadata") or {}).get("word_count") or 0),
                "url": url,
            },
            "executed_action": {
                **executed_action,
                "target": url,
                "request_type": "rendered_request" if action_name == "render_url" else "scrape_markdown",
            },
            "branch": str(action.get("purpose") or action_name),
            "reason": (evidence or {}).get("reason_code"),
        }

    async def _scrape_for_action(self, *, action_name: str, url: str) -> Dict[str, Any]:
        if action_name == "render_url":
            browser_fn = getattr(self.brightdata_client, "_scrape_with_browser_request_api", None)
            if callable(browser_fn):
                result = await browser_fn(url, insecure_ssl_used=False)
                if isinstance(result, dict) and result.get("status") == "success":
                    result.setdefault("metadata", {})["request_type"] = "rendered_request"
                    return result
        result = await self.brightdata_client.scrape_as_markdown(url)
        if action_name == "scrape_url":
            low_signal = str(((result or {}).get("metadata") or {}).get("low_signal_reason") or "").strip()
            words = int(((result or {}).get("metadata") or {}).get("word_count") or 0)
            if low_signal or words < self.render_word_floor:
                browser_fn = getattr(self.brightdata_client, "_scrape_with_browser_request_api", None)
                if callable(browser_fn):
                    rendered = await browser_fn(url, insecure_ssl_used=False)
                    if isinstance(rendered, dict) and rendered.get("status") == "success":
                        rendered_words = int(((rendered or {}).get("metadata") or {}).get("word_count") or 0)
                        if rendered_words >= words:
                            rendered.setdefault("metadata", {})["request_type"] = "rendered_retry"
                            return rendered
        result.setdefault("metadata", {})["request_type"] = result.get("metadata", {}).get("request_type") or "scrape_markdown"
        return result

    async def _evaluate_scrape(
        self,
        *,
        entity_name: str,
        entity_tokens: List[str],
        url: str,
        scrape_result: Dict[str, Any],
        action: Dict[str, Any],
        official_domains: Set[str],
    ) -> Optional[Dict[str, Any]]:
        if not isinstance(scrape_result, dict) or scrape_result.get("status") != "success":
            return None
        raw_text = str(scrape_result.get("content") or "").strip()
        raw_html = str(scrape_result.get("raw_html") or "")
        normalized_text = self._normalize_text(raw_text)
        word_count = int(((scrape_result.get("metadata") or {}).get("word_count") or len(normalized_text.split())))
        source_host = (urlparse(url).hostname or "").lower().lstrip("www.")
        if not normalized_text or self._is_hard_blocked(content=normalized_text, scrape_result=scrape_result):
            return self._build_rejected_evidence(
                url=url,
                source_host=source_host,
                reason_code="low_signal",
                request_type=((scrape_result.get("metadata") or {}).get("request_type") or "scrape_markdown"),
                official_domains=official_domains,
            )

        grounding_score = self._entity_grounding_score(entity_tokens=entity_tokens, text=f"{url} {normalized_text}")
        source_tier = self._source_tier(source_host=source_host, official_domains=official_domains)
        quality_score = self._quality_score(word_count=word_count, text=normalized_text)
        freshness_score = self._freshness_score(normalized_text)
        evidence_type = self._classify_evidence_type(normalized_text, url=url)
        actionability_score = self._item_actionability_score(
            evidence_type=evidence_type,
            grounding_score=grounding_score,
            quality_score=quality_score,
            source_tier=source_tier,
            text=normalized_text,
        )
        hard_reason = self._hard_block_reason(grounding_score=grounding_score, text=normalized_text, source_tier=source_tier)
        if hard_reason:
            return self._build_rejected_evidence(
                url=url,
                source_host=source_host,
                reason_code=hard_reason,
                request_type=((scrape_result.get("metadata") or {}).get("request_type") or "scrape_markdown"),
                grounding_score=grounding_score,
                official_domains=official_domains,
            )

        internal_links = self._extract_internal_links(raw_html=raw_html, base_url=url, official_domains=official_domains)
        judge_verdict = await self._judge_evidence(
            entity_name=entity_name,
            url=url,
            text=normalized_text,
            evidence_type=evidence_type,
            grounding_score=grounding_score,
            source_tier=source_tier,
            actionability_score=actionability_score,
        )
        validation_state = str(judge_verdict.get("validation_state") or "candidate").strip().lower()
        if validation_state == "rejected":
            validation_state = "candidate"
        statement = self._truncate_word_boundary(normalized_text, 360)
        reason_code = str(judge_verdict.get("reason_code") or evidence_type or "candidate").strip().lower()
        candidate_eval = {
            "source_url": url,
            "source_host": source_host,
            "source_tier": source_tier,
            "validation_state": validation_state,
            "reason_code": reason_code,
            "step_type": str(action.get("purpose") or action.get("action") or "unknown"),
            "evidence_snippet": self._truncate_word_boundary(normalized_text, 220),
            "evidence_statement": statement,
            "evidence_content_item": self._truncate_word_boundary(normalized_text, 420),
            "evidence_content_passages": self._content_passages(normalized_text),
            "entity_grounding": grounding_score,
            "evidence_quality_score": quality_score,
            "freshness_score": freshness_score,
            "actionability_score": actionability_score,
            "evidence_type": evidence_type,
        }
        return {
            "url": url,
            "source_host": source_host,
            "source_tier": source_tier,
            "validation_state": validation_state,
            "reason_code": reason_code,
            "text": statement,
            "content": normalized_text,
            "statement": statement,
            "subtype": evidence_type,
            "rank": self._signal_rank(validation_state),
            "entity_grounding": grounding_score,
            "yellow_panther_relevance": float(judge_verdict.get("yellow_panther_relevance") or 0.0),
            "actionability_score": actionability_score,
            "judge_verdict": judge_verdict,
            "candidate_evaluation": candidate_eval,
            "internal_links": internal_links,
            "observation_summary": f"{evidence_type} evidence from {source_host} ({validation_state})",
        }

    async def _judge_evidence(
        self,
        *,
        entity_name: str,
        url: str,
        text: str,
        evidence_type: str,
        grounding_score: float,
        source_tier: str,
        actionability_score: float,
    ) -> Dict[str, Any]:
        prompt = (
            "Return strict JSON only. Evaluate whether this evidence is useful for Yellow Panther procurement discovery.\n"
            f"Entity: {entity_name}\n"
            f"URL: {url}\n"
            f"Evidence type: {evidence_type}\n"
            f"Source tier: {source_tier}\n"
            f"Entity grounding heuristic: {grounding_score:.3f}\n"
            f"Actionability heuristic: {actionability_score:.1f}\n"
            f"Text: {self._truncate_word_boundary(text, 900)}"
        )
        try:
            response = await self.claude_client.query(
                prompt=prompt,
                model="judge",
                max_tokens=220,
                json_mode=True,
                json_schema=JUDGE_JSON_SCHEMA,
                stream=False,
                max_retries_override=0,
                empty_retries_before_fallback_override=1,
                fast_fail_on_length=True,
            )
            payload = self._extract_json_payload(response)
            normalized = self._normalize_judge_payload(payload)
            if normalized:
                self._metrics["llm_last_status"] = "judge_ok"
                return normalized
        except Exception:
            pass
        self._metrics["schema_fail_count"] += 1
        self._metrics["judge_fallback_count"] += 1
        self._metrics["llm_last_status"] = "judge_fallback"
        return self._deterministic_judge_fallback(
            evidence_type=evidence_type,
            grounding_score=grounding_score,
            source_tier=source_tier,
            actionability_score=actionability_score,
            allow_promotion=False,
        )

    def _normalize_planner_action(self, *, payload: Any, state: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if not isinstance(payload, dict):
            return None
        raw_action = str(payload.get("action") or payload.get("next_action") or "").strip().lower()
        alias_map = {
            "search": "search_web",
            "search_query": "search_web",
            "search_queries": "search_web",
            "site_search": "search_site",
            "scrape": "scrape_url",
            "scrape_candidate": "scrape_url",
            "render": "render_url",
            "render_page": "render_url",
            "same_domain_probe": "probe_same_domain",
            "probe": "probe_same_domain",
            "pdf": "fetch_pdf",
            "stop_run": "stop",
            "stop_lane": "stop",
        }
        action = alias_map.get(raw_action, raw_action)
        if action not in {"search_web", "search_site", "scrape_url", "render_url", "follow_link", "probe_same_domain", "fetch_pdf", "stop"}:
            return None
        candidate_index = payload.get("candidate_index")
        if candidate_index is None and isinstance(payload.get("parameters"), dict):
            candidate_index = payload["parameters"].get("candidate_index") or payload["parameters"].get("target_candidate_index")
        try:
            candidate_index = int(candidate_index) if candidate_index is not None else None
        except (TypeError, ValueError):
            candidate_index = None
        target = str(payload.get("target") or payload.get("url") or payload.get("query") or "").strip()
        if not target and candidate_index is not None:
            pending = state.get("pending_candidates") or []
            if 0 <= candidate_index < len(pending):
                target = str((pending[candidate_index] or {}).get("url") or "").strip()
        try:
            confidence_value = float(payload.get("confidence"))
        except (TypeError, ValueError):
            confidence_value = 0.5
        confidence_value = max(0.0, min(1.0, confidence_value))
        return {
            "action": action,
            "target": target,
            "candidate_index": candidate_index,
            "purpose": str(payload.get("purpose") or payload.get("lane") or payload.get("reason") or action).strip()[:120],
            "expected_signal_type": str(payload.get("expected_signal_type") or payload.get("signal_type") or action).strip()[:80],
            "confidence": confidence_value,
            "reason": str(payload.get("reason") or "planner_selected").strip()[:240],
        }

    def _normalize_judge_payload(self, payload: Any) -> Optional[Dict[str, Any]]:
        if not isinstance(payload, dict):
            return None
        validation_state = str(payload.get("validation_state") or "candidate").strip().lower()
        if validation_state not in {"validated", "provisional", "candidate", "rejected"}:
            return None
        return {
            "validation_state": validation_state,
            "evidence_type": str(payload.get("evidence_type") or "operational_signal").strip().lower(),
            "entity_grounding": float(payload.get("entity_grounding") or 0.0),
            "yellow_panther_relevance": float(payload.get("yellow_panther_relevance") or 0.0),
            "confidence_contribution": float(payload.get("confidence_contribution") or 0.0),
            "reason_code": str(payload.get("reason_code") or validation_state).strip().lower(),
            "actionability_score": float(payload.get("actionability_score") or 0.0),
        }

    def _deterministic_judge_fallback(
        self,
        *,
        evidence_type: str,
        grounding_score: float,
        source_tier: str,
        actionability_score: float,
        allow_promotion: bool = True,
    ) -> Dict[str, Any]:
        if not allow_promotion:
            return {
                "validation_state": "candidate",
                "evidence_type": evidence_type,
                "entity_grounding": grounding_score,
                "yellow_panther_relevance": min(1.0, actionability_score / 100.0),
                "confidence_contribution": 0.0,
                "reason_code": "judge_fallback_candidate",
                "actionability_score": actionability_score,
            }
        if grounding_score >= 0.65 and source_tier in {"tier_1", "tier_2"} and actionability_score >= 72:
            validation_state = "validated"
            contribution = 0.12
            reason_code = evidence_type or "validated"
        elif grounding_score >= 0.45 and actionability_score >= 55:
            validation_state = "provisional"
            contribution = 0.05
            reason_code = f"{evidence_type}_provisional"
        else:
            validation_state = "candidate"
            contribution = 0.0
            reason_code = "llm_fallback_candidate"
        return {
            "validation_state": validation_state,
            "evidence_type": evidence_type,
            "entity_grounding": grounding_score,
            "yellow_panther_relevance": min(1.0, actionability_score / 100.0),
            "confidence_contribution": contribution,
            "reason_code": reason_code,
            "actionability_score": actionability_score,
        }

    def _resolve_search_query(self, *, action: Dict[str, Any], entity_name: str, official_domains: Set[str]) -> str:
        target = str(action.get("target") or "").strip()
        if target:
            if str(action.get("action") or "") in {"search_site", "probe_same_domain"} and official_domains:
                domain = sorted(official_domains)[0]
                if f"site:{domain}" not in target:
                    target = f"{target} site:{domain}"
            return target
        action_name = str(action.get("action") or "search_web")
        if action_name == "search_site" and official_domains:
            domain = sorted(official_domains)[0]
            return f'"{entity_name}" (news OR commercial OR partner OR careers OR procurement OR tender OR supplier) site:{domain}'
        if action_name == "probe_same_domain" and official_domains:
            domain = sorted(official_domains)[0]
            return f'site:{domain} (news OR partners OR commercial OR careers OR procurement OR tenders OR supplier)'
        return f'"{entity_name}" (procurement OR tender OR rfp OR digital partner OR commercial lead OR careers)'

    def _search_results_to_candidates(
        self,
        *,
        search_result: Dict[str, Any],
        official_domains: Set[str],
        query: str,
        state: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        results = search_result.get("results") if isinstance(search_result, dict) else []
        candidates: List[Dict[str, Any]] = []
        for item in results if isinstance(results, list) else []:
            if not isinstance(item, dict):
                continue
            url = self._normalize_url(item.get("url"))
            if not url or url in state.get("visited_urls", set()):
                continue
            host = (urlparse(url).hostname or "").lower().lstrip("www.")
            candidates.append(
                {
                    "url": url,
                    "title": str(item.get("title") or "").strip(),
                    "snippet": str(item.get("snippet") or "").strip(),
                    "host": host,
                    "position": int(item.get("position") or len(candidates) + 1),
                    "candidate_origin": "search",
                    "same_domain": host in official_domains,
                    "query": query,
                }
            )
        return candidates

    def _resolve_action_url(self, *, action: Dict[str, Any], state: Dict[str, Any]) -> Optional[str]:
        target = self._normalize_url(action.get("target"))
        pending = state.get("pending_candidates") or []
        candidate_index = action.get("candidate_index")
        if target:
            if isinstance(candidate_index, int) and 0 <= candidate_index < len(pending):
                candidate_url = self._normalize_url((pending[candidate_index] or {}).get("url"))
                if candidate_url == target:
                    pending.pop(candidate_index)
            return target
        if isinstance(candidate_index, int) and 0 <= candidate_index < len(pending):
            candidate = pending.pop(candidate_index)
            return self._normalize_url(candidate.get("url"))
        if pending:
            candidate = pending.pop(0)
            return self._normalize_url(candidate.get("url"))
        return state.get("official_site_url")

    def _append_follow_links(self, *, state: Dict[str, Any], links: List[Dict[str, Any]], official_domains: Set[str]) -> None:
        pending = state.setdefault("pending_candidates", [])
        known = {str(item.get("url") or "") for item in pending if isinstance(item, dict)}
        for item in links:
            if not isinstance(item, dict):
                continue
            url = str(item.get("url") or "").strip()
            if not url or url in known or url in state.get("visited_urls", set()):
                continue
            host = (urlparse(url).hostname or "").lower().lstrip("www.")
            pending.append(
                {
                    "url": url,
                    "title": str(item.get("text") or "").strip(),
                    "snippet": str(item.get("text") or "").strip(),
                    "host": host,
                    "position": len(pending) + 1,
                    "candidate_origin": "internal_link",
                    "same_domain": host in official_domains,
                }
            )
            known.add(url)

    def _adjust_credit_budget(self, *, state: Dict[str, Any], branch_key: str, execution: Dict[str, Any]) -> int:
        evidence = execution.get("evidence") if isinstance(execution, dict) else None
        if not isinstance(evidence, dict):
            state["consecutive_low_signal_by_branch"][branch_key] = int(state["consecutive_low_signal_by_branch"].get(branch_key, 0) or 0) + 1
            return 0
        validation_state = str(evidence.get("validation_state") or "candidate").lower()
        actionability_score = float(evidence.get("actionability_score") or 0.0)
        source_tier = str(evidence.get("source_tier") or "tier_3")
        if validation_state == "validated" and actionability_score >= 75:
            state["consecutive_low_signal_by_branch"][branch_key] = 0
            return 5
        if validation_state == "provisional" and actionability_score >= 65 and source_tier in {"tier_1", "tier_2"}:
            branch_hits = state.setdefault("branch_provisional_hits", {})
            branch_hits[branch_key] = int(branch_hits.get(branch_key, 0) or 0) + 1
            state["consecutive_low_signal_by_branch"][branch_key] = 0
            return 5 if branch_hits[branch_key] >= 2 else 0
        if evidence.get("source_tier") == "tier_1" and "/" in str(evidence.get("url") or "").rstrip("/"):
            state["consecutive_low_signal_by_branch"][branch_key] = 0
            return 2 if actionability_score >= 60 else 0
        state["consecutive_low_signal_by_branch"][branch_key] = int(state["consecutive_low_signal_by_branch"].get(branch_key, 0) or 0) + 1
        return 0

    def _planner_evidence_summary(self, state: Dict[str, Any]) -> str:
        validated = len(state.get("validated_signals") or [])
        provisional = len(state.get("provisional_signals") or [])
        evidence = state.get("evidence_ledger") or []
        top_types: List[str] = []
        for item in evidence[-3:]:
            if not isinstance(item, dict):
                continue
            evidence_type = str(item.get("subtype") or item.get("reason_code") or "").strip()
            if evidence_type:
                top_types.append(evidence_type)
        return json.dumps({"validated": validated, "provisional": provisional, "recent_types": top_types}, separators=(",", ":"))

    def _build_rejected_evidence(
        self,
        *,
        url: str,
        source_host: str,
        reason_code: str,
        request_type: str,
        grounding_score: float = 0.0,
        official_domains: Optional[Set[str]] = None,
    ) -> Dict[str, Any]:
        source_tier = self._source_tier(source_host=source_host, official_domains=set(official_domains or set()))
        return {
            "url": url,
            "source_host": source_host,
            "source_tier": source_tier,
            "validation_state": "candidate",
            "reason_code": reason_code,
            "text": "",
            "content": "",
            "statement": "",
            "subtype": "low_signal",
            "rank": 1,
            "entity_grounding": grounding_score,
            "yellow_panther_relevance": 0.0,
            "actionability_score": 0.0,
            "judge_verdict": {
                "validation_state": "candidate",
                "reason_code": reason_code,
                "yellow_panther_relevance": 0.0,
                "confidence_contribution": 0.0,
                "actionability_score": 0.0,
            },
            "candidate_evaluation": {
                "source_url": url,
                "source_host": source_host,
                "source_tier": source_tier,
                "validation_state": "candidate",
                "reason_code": reason_code,
                "step_type": request_type,
                "entity_grounding": grounding_score,
                "evidence_quality_score": 0.0,
                "actionability_score": 0.0,
            },
            "observation_summary": f"rejected {reason_code} from {source_host}",
            "internal_links": [],
        }

    def _candidate_eval_from_evidence(self, evidence: Dict[str, Any]) -> Dict[str, Any]:
        return dict(evidence.get("candidate_evaluation") or {})

    def _to_signal_record(self, evidence: Dict[str, Any], validation_state: str) -> Dict[str, Any]:
        return {
            "url": evidence.get("url"),
            "text": evidence.get("text"),
            "content": evidence.get("content"),
            "statement": evidence.get("statement"),
            "subtype": evidence.get("subtype"),
            "rank": evidence.get("rank"),
            "validation_state": validation_state,
            "entity_grounding": evidence.get("entity_grounding"),
            "yellow_panther_relevance": evidence.get("yellow_panther_relevance"),
            "actionability_score": evidence.get("actionability_score"),
            "source_tier": evidence.get("source_tier"),
            "reason_code": evidence.get("reason_code"),
        }

    def _overall_actionability_score(
        self,
        validated_signals: List[Dict[str, Any]],
        provisional_signals: List[Dict[str, Any]],
        candidate_evaluations: List[Dict[str, Any]],
    ) -> float:
        validated_scores = [float(item.get("actionability_score") or 0.0) for item in validated_signals]
        provisional_scores = [float(item.get("actionability_score") or 0.0) * 0.7 for item in provisional_signals]
        candidate_scores = [float(item.get("actionability_score") or 0.0) * 0.1 for item in candidate_evaluations[:3]]
        weighted = validated_scores + provisional_scores + candidate_scores
        if not weighted and not validated_scores:
            return 0.0
        weighted_average = sum(weighted) / max(1, len(weighted))
        validated_floor = max(validated_scores) if validated_scores else 0.0
        return round(max(weighted_average, validated_floor), 2)

    def _compute_final_confidence(
        self,
        *,
        validated_signals: List[Dict[str, Any]],
        provisional_signals: List[Dict[str, Any]],
        actionability_score: float,
    ) -> float:
        score = 0.32
        score += min(0.36, len(validated_signals) * 0.14)
        score += min(0.15, len(provisional_signals) * 0.04)
        score += min(0.15, max(0.0, actionability_score / 100.0) * 0.18)
        return round(max(0.0, min(0.96, score)), 3)

    @staticmethod
    def _confidence_band(confidence: float) -> str:
        if confidence >= 0.8:
            return "HIGH"
        if confidence >= 0.6:
            return "MEDIUM"
        if confidence >= 0.45:
            return "EXPLORATORY"
        return "LOW"

    @staticmethod
    def _summarize_candidate_events(candidate_evaluations: List[Dict[str, Any]]) -> Dict[str, Any]:
        summary = {
            "total": 0,
            "by_validation_state": {},
            "by_reason_code": {},
            "by_evidence_type": {},
        }
        for item in candidate_evaluations or []:
            if not isinstance(item, dict):
                continue
            summary["total"] += 1
            state = str(item.get("validation_state") or "candidate").strip().lower()
            reason = str(item.get("reason_code") or "unknown").strip().lower()
            evidence_type = str(item.get("evidence_type") or item.get("step_type") or "unknown").strip().lower()
            summary["by_validation_state"][state] = int(summary["by_validation_state"].get(state, 0) or 0) + 1
            summary["by_reason_code"][reason] = int(summary["by_reason_code"].get(reason, 0) or 0) + 1
            summary["by_evidence_type"][evidence_type] = int(summary["by_evidence_type"].get(evidence_type, 0) or 0) + 1
        return summary

    @staticmethod
    def _build_controller_health_reasons(
        *,
        planner_applied_rate: float,
        planner_parse_fail_count: int,
        validated_count: int,
        off_entity_reject_rate: float,
        judge_fallback_count: int,
        schema_fail_count: int,
    ) -> List[str]:
        reasons: List[str] = []
        if planner_applied_rate <= 0.0:
            reasons.append("no_planner_actions_applied")
        if planner_parse_fail_count > 0:
            reasons.append("planner_action_parse_failures")
        if judge_fallback_count > 0:
            reasons.append("judge_fallback_used")
        if schema_fail_count > 0:
            reasons.append("schema_gate_failures")
        if off_entity_reject_rate > 0.25:
            reasons.append("high_off_entity_reject_rate")
        if validated_count == 0:
            reasons.append("no_validated_signals")
        if not reasons:
            reasons.append("healthy")
        return reasons

    @staticmethod
    def _signal_rank(validation_state: str) -> int:
        return {"validated": 3, "provisional": 2, "candidate": 1}.get(str(validation_state or "candidate").lower(), 1)

    @staticmethod
    def _normalize_url(value: Any) -> Optional[str]:
        if not isinstance(value, str):
            return None
        candidate = value.strip()
        if not candidate:
            return None
        if not candidate.startswith(("http://", "https://")):
            if candidate.startswith("www.") or "." in candidate:
                candidate = f"https://{candidate.lstrip('/')}"
            else:
                return None
        parsed = urlparse(candidate)
        if not parsed.netloc:
            return None
        return f"{parsed.scheme}://{parsed.netloc}{parsed.path or ''}"

    @staticmethod
    def _official_domains(official_site: Optional[str]) -> Set[str]:
        if not official_site:
            return set()
        host = (urlparse(official_site).hostname or "").lower().lstrip("www.")
        return {host} if host else set()

    @staticmethod
    def _entity_tokens(entity_name: str) -> List[str]:
        return [token for token in re.findall(r"[a-z0-9]+", str(entity_name or "").lower()) if token not in {"fc", "football", "club", "the"}]

    @staticmethod
    def _normalize_text(value: str) -> str:
        text = str(value or "").strip()
        if not text:
            return ""
        text = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", text)
        text = re.sub(r"(?<=[A-Za-z])(?=[0-9])", " ", text)
        text = re.sub(r"(?<=[0-9])(?=[A-Za-z])", " ", text)
        return " ".join(text.split())

    @staticmethod
    def _truncate_word_boundary(text: str, max_chars: int) -> str:
        value = str(text or "").strip()
        if len(value) <= max_chars:
            return value
        cut = max(1, max_chars - 1)
        trimmed = value[:cut].rstrip()
        if " " in trimmed:
            trimmed = trimmed.rsplit(" ", 1)[0].rstrip()
        return f"{trimmed}..."

    def _extract_json_payload(self, response: Dict[str, Any]) -> Any:
        structured = response.get("structured_output") if isinstance(response, dict) else None
        if isinstance(structured, dict):
            return structured
        if isinstance(structured, list) and structured and isinstance(structured[0], dict):
            return structured[0]
        raw = str((response or {}).get("content") or "").strip()
        if not raw:
            return None
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list) and parsed and isinstance(parsed[0], dict):
                return parsed[0]
            return parsed
        except Exception:
            match = re.search(r"\{[\s\S]*\}", raw)
            if not match:
                return None
            try:
                return json.loads(match.group(0))
            except Exception:
                return None

    def _extract_internal_links(self, *, raw_html: str, base_url: str, official_domains: Set[str]) -> List[Dict[str, Any]]:
        base_host = (urlparse(base_url).hostname or "").lower().lstrip("www.")
        results: List[Dict[str, Any]] = []
        seen: Set[str] = set()
        for href, text in re.findall(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', raw_html or "", flags=re.I | re.S):
            absolute = self._normalize_url(urljoin(base_url, href))
            if not absolute:
                continue
            host = (urlparse(absolute).hostname or "").lower().lstrip("www.")
            if host not in official_domains and host != base_host:
                continue
            if absolute in seen:
                continue
            seen.add(absolute)
            label = self._normalize_text(re.sub(r"<[^>]+>", " ", text or ""))
            results.append({"url": absolute, "text": label[:120]})
            if len(results) >= self.max_internal_links:
                break
        return results

    @staticmethod
    def _entity_grounding_score(*, entity_tokens: List[str], text: str) -> float:
        haystack = str(text or "").lower()
        if not entity_tokens:
            return 0.0
        hits = sum(1 for token in entity_tokens if token in haystack)
        return round(hits / max(1, min(3, len(entity_tokens))), 3)

    @staticmethod
    def _source_tier(*, source_host: str, official_domains: Set[str]) -> str:
        host = str(source_host or "").lower().lstrip("www.")
        if host in official_domains:
            return "tier_1"
        if host in TRUSTED_NEWS_DOMAINS:
            return "tier_2"
        if any(host.endswith(suffix) for suffix in (".gov", ".gov.uk", ".org")):
            return "tier_2"
        return "tier_3"

    @staticmethod
    def _quality_score(*, word_count: int, text: str) -> float:
        score = min(1.0, word_count / 250.0)
        if any(token in text.lower() for token in ("procurement", "tender", "rfp", "partner", "chief", "director", "head of")):
            score = min(1.0, score + 0.1)
        return round(score, 3)

    @staticmethod
    def _freshness_score(text: str) -> float:
        if re.search(r"\b(202[4-9]|20[3-9][0-9])\b", text):
            return 0.9
        if re.search(r"\b(202[0-3])\b", text):
            return 0.6
        return 0.3

    @staticmethod
    def _classify_evidence_type(text: str, *, url: str) -> str:
        lowered = f"{text} {url}".lower()
        if any(token in lowered for token in ("rfp", "request for proposal", "tender", "procurement", "supplier")):
            return "procurement_signal"
        if any(token in lowered for token in ("chief executive", "ceo", "chief commercial", "head of", "director", "chief digital", "chief technology")):
            return "leadership_signal"
        if any(token in lowered for token in ("career", "vacancy", "hiring", "job opening", "recruit")):
            return "hiring_signal"
        if any(token in lowered for token in ("partner", "partnership", "commercial", "sponsor", "rights")):
            return "commercial_signal"
        if any(token in lowered for token in ("platform", "crm", "data", "analytics", "technology", "digital")):
            return "digital_change_signal"
        return "operational_signal"

    @staticmethod
    def _item_actionability_score(
        *,
        evidence_type: str,
        grounding_score: float,
        quality_score: float,
        source_tier: str,
        text: str,
    ) -> float:
        tier_component = 1.0 if source_tier == "tier_1" else 0.8 if source_tier == "tier_2" else 0.45
        evidence_bonus = {
            "procurement_signal": 0.28,
            "leadership_signal": 0.22,
            "commercial_signal": 0.18,
            "digital_change_signal": 0.16,
            "hiring_signal": 0.14,
            "operational_signal": 0.1,
        }.get(evidence_type, 0.08)
        timing_bonus = 0.08 if any(token in text.lower() for token in ("2026", "2025", "launch", "appoint", "tender closes", "deadline")) else 0.0
        score = (grounding_score * 0.34) + (quality_score * 0.2) + (tier_component * 0.18) + evidence_bonus + timing_bonus
        return round(max(0.0, min(100.0, score * 100.0)), 2)

    def _hard_block_reason(self, *, grounding_score: float, text: str, source_tier: str) -> Optional[str]:
        lowered = text.lower()
        if grounding_score < 0.25 and source_tier == "tier_3":
            return "off_entity"
        if any(token in lowered for token in ("captcha", "access denied", "sign in to continue")):
            return "blocked_shell"
        return None

    def _is_hard_blocked(self, *, content: str, scrape_result: Dict[str, Any]) -> bool:
        lowered = str(content or "").lower()
        if len(content.split()) < 20:
            return True
        if any(token in lowered for token in ("enable javascript", "sign in", "access denied", "captcha")):
            return True
        low_signal_reason = str(((scrape_result.get("metadata") or {}).get("low_signal_reason") or "")).strip()
        if low_signal_reason in {"repeated_rendered_shell", "cached_repeated_low_signal_url"}:
            return True
        return False

    @staticmethod
    def _content_passages(text: str) -> List[str]:
        passages = [segment.strip() for segment in re.split(r"(?<=[.!?])\s+", text) if segment.strip()]
        return passages[:3]

    def _register_lane_failure(self, state: Dict[str, Any], lane: str, reason: str) -> None:
        failures = state.setdefault("lane_failures", {})
        lane_bucket = failures.setdefault(str(lane), {})
        lane_bucket[str(reason)] = int(lane_bucket.get(str(reason), 0) or 0) + 1
        failed_paths = state.setdefault("failed_paths", {})
        failed_paths[str(lane)] = lane_bucket
