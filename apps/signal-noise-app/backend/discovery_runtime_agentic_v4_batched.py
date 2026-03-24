#!/usr/bin/env python3
"""Batched agent-led discovery runtime v4.

v4 keeps Bright Data as the retrieval engine but moves planning to larger
evidence packs so Kimi can reason over multiple pages/results per cycle.
Determinism remains as memory, ranking, and safety rails.
"""

from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple
from urllib.parse import urljoin, urlparse

try:
    from backend.objective_profiles import get_objective_profile, normalize_run_objective
except ImportError:
    from objective_profiles import get_objective_profile, normalize_run_objective

from backend.discovery_runtime_agentic_v3 import (
    HIGH_SIGNAL_PATH_TERMS,
    LOW_SIGNAL_PATH_TERMS,
    PLANNER_ACTION_JSON_SCHEMA,
    DiscoveryRuntimeAgenticV3,
)

logger = logging.getLogger(__name__)

BATCH_PLANNER_JSON_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "missing_signals": {"type": "array", "items": {"type": "string"}},
        "next_batch_plan": {
            "type": "array",
            "items": PLANNER_ACTION_JSON_SCHEMA,
        },
        "stop_or_continue": {"type": "string", "enum": ["stop", "continue"]},
        "override_soft_skips": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["next_batch_plan", "stop_or_continue"],
}


@dataclass
class DiscoveryResultAgenticV4Batched:
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
    parse_path: str = "agentic_v4_batched"
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
    batch_trace: List[Dict[str, Any]] = field(default_factory=list)
    evidence_packs: List[Dict[str, Any]] = field(default_factory=list)
    prior_run_memory: Dict[str, Any] = field(default_factory=dict)
    sitemap_candidates: List[Dict[str, Any]] = field(default_factory=list)
    soft_skip_events: List[Dict[str, Any]] = field(default_factory=list)
    kimi_batch_outputs: List[Dict[str, Any]] = field(default_factory=list)
    deepseek_audits: List[Dict[str, Any]] = field(default_factory=list)
    batch_stop_reason: str = ""
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
            "batch_trace": self.batch_trace,
            "evidence_packs": self.evidence_packs,
            "prior_run_memory": self.prior_run_memory,
            "sitemap_candidates": self.sitemap_candidates,
            "soft_skip_events": self.soft_skip_events,
            "kimi_batch_outputs": self.kimi_batch_outputs,
            "deepseek_audits": self.deepseek_audits,
            "batch_stop_reason": self.batch_stop_reason,
            "timestamp": self.timestamp.isoformat(),
        }


class DiscoveryRuntimeAgenticV4Batched(DiscoveryRuntimeAgenticV3):
    def __init__(self, claude_client: Any, brightdata_client: Any):
        super().__init__(claude_client=claude_client, brightdata_client=brightdata_client)
        self.batch_input_token_target = max(
            2000,
            int(os.getenv("AGENTIC_V4_BATCH_INPUT_TOKEN_TARGET", "12000")),
        )
        self.seed_batch_input_token_target = min(
            self.batch_input_token_target,
            max(1000, int(os.getenv("AGENTIC_V4_SEED_BATCH_INPUT_TOKEN_TARGET", "3500"))),
        )
        self.domain_batch_input_token_target = min(
            self.batch_input_token_target,
            max(1500, int(os.getenv("AGENTIC_V4_DOMAIN_BATCH_INPUT_TOKEN_TARGET", "5000"))),
        )
        self.discovery_batch_input_token_target = min(
            self.batch_input_token_target,
            max(2000, int(os.getenv("AGENTIC_V4_DISCOVERY_BATCH_INPUT_TOKEN_TARGET", "7000"))),
        )
        self.deepening_batch_input_token_target = min(
            self.batch_input_token_target,
            max(2000, int(os.getenv("AGENTIC_V4_DEEPENING_BATCH_INPUT_TOKEN_TARGET", "7000"))),
        )
        self.planner_max_tokens = max(256, int(os.getenv("AGENTIC_V4_PLANNER_MAX_TOKENS", "700")))
        self.seed_batch_size = max(3, int(os.getenv("AGENTIC_V4_SEED_BATCH_SIZE", "6")))
        self.domain_batch_size = max(3, int(os.getenv("AGENTIC_V4_DOMAIN_BATCH_SIZE", "8")))
        self.discovery_batch_size = max(3, int(os.getenv("AGENTIC_V4_DISCOVERY_BATCH_SIZE", "8")))
        self.deepening_batch_size = max(2, int(os.getenv("AGENTIC_V4_DEEPENING_BATCH_SIZE", "5")))
        self.max_batches_default = max(1, int(os.getenv("AGENTIC_V4_MAX_BATCHES", "4")))
        self.max_batches_premium = max(
            self.max_batches_default,
            int(os.getenv("AGENTIC_V4_MAX_BATCHES_PREMIUM", "6")),
        )
        self.soft_skip_enabled = str(
            os.getenv("AGENTIC_V4_SOFT_SKIP_ENABLED", "true")
        ).strip().lower() in {"1", "true", "yes", "on"}
        self.enforce_requested_iteration_cap = str(
            os.getenv("PIPELINE_ENFORCE_DISCOVERY_ITERATION_CAP", "false")
        ).strip().lower() in {"1", "true", "yes", "on"}
        self.discovery_memory_dir = Path(
            os.getenv(
                "AGENTIC_V4_MEMORY_DIR",
                str(Path(__file__).resolve().parent / "data" / "dossiers"),
            )
        )

    async def run_discovery(self, **kwargs) -> DiscoveryResultAgenticV4Batched:
        return await self.run_discovery_with_dossier_context(**kwargs)

    async def run_discovery_with_dossier_context(
        self,
        *,
        entity_id: str,
        entity_name: str,
        dossier: Optional[Dict[str, Any]] = None,
        max_iterations: int = 4,
        template_id: Optional[str] = None,
        entity_type: Optional[str] = None,
        **_kwargs: Any,
    ) -> DiscoveryResultAgenticV4Batched:
        del template_id, entity_type
        started = time.perf_counter()
        objective = normalize_run_objective(os.getenv("PIPELINE_RUN_OBJECTIVE", "dossier_core"))
        objective_profile = get_objective_profile(objective, default="dossier_core")
        dossier = dossier if isinstance(dossier, dict) else {}
        metadata = dossier.get("metadata") if isinstance(dossier.get("metadata"), dict) else {}
        official_site = self._extract_official_site(dossier)
        official_domains = self._official_domains(official_site)
        entity_tokens = self._entity_tokens(entity_name)
        tier = str(metadata.get("tier") or "STANDARD").strip().upper()
        requested_batches = max(1, int(max_iterations or self.max_batches_default))
        configured_batch_cap = min(
            requested_batches,
            self.max_batches_premium if tier == "PREMIUM" else self.max_batches_default,
        )
        max_batches = requested_batches if self.enforce_requested_iteration_cap else configured_batch_cap
        prior_run_memory = self._load_prior_run_memory(entity_id=entity_id)
        state: Dict[str, Any] = {
            "mission_brief": self._build_mission_brief(entity_name=entity_name, objective=objective),
            "entity_profile": self._build_entity_profile(entity_name=entity_name, dossier=dossier),
            "official_site_url": official_site,
            "official_domains": official_domains,
            "visited_urls": set(),
            "visited_queries": set(),
            "pending_candidates": [],
            "failed_urls": {},
            "failed_paths": {},
            "open_hypotheses": self._initial_hypotheses(entity_name=entity_name, objective_profile=objective_profile),
            "remaining_credits": max_batches,
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
            "batch_trace": [],
            "evidence_packs": [],
            "soft_skip_events": [],
            "kimi_batch_outputs": [],
            "deepseek_audits": [],
            "sitemap_candidates": [],
            "prior_run_memory": prior_run_memory,
        }
        self._metrics = {
            "planner_turn_count": 0,
            "planner_decision_parse_fail_count": 0,
            "planner_decision_applied_count": 0,
            "planner_repair_count": 0,
            "planner_branch_change_count": 0,
            "planner_block_reason_counts": {},
            "credits_spent": 0,
            "credits_earned": 0,
            "off_entity_reject_count": 0,
            "judge_fallback_count": 0,
            "schema_fail_count": 0,
            "llm_last_status": "ok",
            "batch_pages_processed": 0,
            "batch_searches_executed": 0,
            "soft_skip_override_count": 0,
            "audit_degraded_count": 0,
            "evidence_pack_token_estimate": 0,
        }

        current_items = await self._collect_seed_batch(
            entity_name=entity_name,
            entity_tokens=entity_tokens,
            official_site=official_site,
            official_domains=official_domains,
            state=state,
        )
        batch_stop_reason = "batch_cap_reached"
        last_batch_result: Dict[str, Any] = {"summary": "seed bootstrap"}

        while state["remaining_credits"] > 0 and len(state["batch_trace"]) < max_batches:
            batch_index = len(state["batch_trace"]) + 1
            batch_type = self._batch_type_for_index(batch_index)
            if not current_items and not state["pending_candidates"]:
                batch_stop_reason = "no_batch_items"
                break

            pack = self._build_evidence_pack(
                batch_index=batch_index,
                batch_type=batch_type,
                items=current_items,
                entity_tokens=entity_tokens,
                official_domains=official_domains,
                prior_run_memory=prior_run_memory,
            )
            state["evidence_packs"].append(pack)
            self._metrics["evidence_pack_token_estimate"] = max(
                int(self._metrics.get("evidence_pack_token_estimate") or 0),
                int(pack.get("token_estimate") or 0),
            )

            planner_output = await self._plan_batch(
                entity_name=entity_name,
                objective=objective,
                state=state,
                evidence_pack=pack,
                last_batch_result=last_batch_result,
                batch_type=batch_type,
            )
            state["kimi_batch_outputs"].append({"batch": batch_index, **planner_output})
            self._metrics["planner_turn_count"] += 1
            state["planner_decisions"].append(
                {
                    "batch": batch_index,
                    "batch_type": batch_type,
                    "next_batch_plan": planner_output.get("next_batch_plan") or [],
                    "stop_or_continue": planner_output.get("stop_or_continue"),
                    "override_soft_skips": planner_output.get("override_soft_skips") or [],
                }
            )

            audit_summary = await self._audit_batch_items(
                items=current_items,
                entity_name=entity_name,
                entity_tokens=entity_tokens,
                official_domains=official_domains,
                state=state,
            )
            signal_gain = int(audit_summary.get("validated_count") or 0) + int(audit_summary.get("provisional_count") or 0)

            state["remaining_credits"] -= 1
            self._metrics["credits_spent"] += 1
            credit_entry = {
                "batch": batch_index,
                "before": state["remaining_credits"] + 1,
                "spent": 1,
                "earned": 0,
                "after": state["remaining_credits"],
                "reason": batch_type,
            }

            normalized_actions = planner_output.get("next_batch_plan") or []
            executed_actions, next_items, soft_skip_events = await self._execute_batch_plan(
                actions=normalized_actions,
                entity_name=entity_name,
                entity_tokens=entity_tokens,
                official_domains=official_domains,
                state=state,
                override_urls=set(planner_output.get("override_soft_skips") or []),
            )
            state["soft_skip_events"].extend(soft_skip_events)
            state["executed_actions"].extend(executed_actions)
            state["sitemap_candidates"] = [
                {
                    "url": str(candidate.get("url") or "").strip(),
                    "title": str(candidate.get("title") or "").strip(),
                    "snippet": str(candidate.get("snippet") or "").strip(),
                }
                for candidate in (state.get("pending_candidates") or [])[: self.discovery_batch_size]
                if isinstance(candidate, dict)
            ]
            if executed_actions:
                self._metrics["planner_decision_applied_count"] += len(executed_actions)

            earned = 0
            if audit_summary.get("validated_count", 0) >= 1:
                earned += 1
            if audit_summary.get("provisional_count", 0) >= 2:
                earned += 1
            if earned:
                state["remaining_credits"] = min(max_batches, state["remaining_credits"] + earned)
                self._metrics["credits_earned"] += earned
                credit_entry["earned"] = earned
                credit_entry["after"] = state["remaining_credits"]
            state["credit_ledger"].append(credit_entry)

            batch_entry = {
                "batch": batch_index,
                "batch_type": batch_type,
                "retrieved_items": len(current_items),
                "planner_output": planner_output,
                "executed_actions": executed_actions,
                "audit_summary": audit_summary,
                "credit_delta": credit_entry,
                "soft_skip_events": soft_skip_events,
            }
            state["batch_trace"].append(batch_entry)
            state["turn_trace"].append(
                {
                    "turn": batch_index,
                    "planner_action": {"action": "batch_plan", "batch_type": batch_type},
                    "executed_action": {"action": "batch_execute", "count": len(executed_actions)},
                    "planner_status": "applied" if executed_actions else "blocked",
                    "planner_block_reason": None if executed_actions else "planner_action_provider_error",
                    "observation": {
                        "summary": planner_output.get("batch_assessment") or audit_summary.get("summary"),
                        "signals_found": signal_gain,
                    },
                    "credit_delta": credit_entry,
                }
            )

            last_batch_result = {
                "summary": planner_output.get("batch_assessment") or audit_summary.get("summary") or "batch complete",
                "validated": audit_summary.get("validated_count", 0),
                "provisional": audit_summary.get("provisional_count", 0),
                "candidate": audit_summary.get("candidate_count", 0),
            }
            should_stop = str(planner_output.get("stop_or_continue") or "continue").strip().lower() == "stop"
            if should_stop:
                batch_stop_reason = "planner_stop"
                break
            if signal_gain == 0 and not next_items and not state["pending_candidates"]:
                batch_stop_reason = "no_followup_batch_items"
                break
            current_items = next_items

        total_duration_ms = round((time.perf_counter() - started) * 1000.0, 2)
        validated_signals = list(state["validated_signals"])
        provisional_signals = list(state["provisional_signals"])
        candidate_evaluations = list(state["candidate_evaluations"])
        actionability_score = self._overall_actionability_score(
            validated_signals,
            provisional_signals,
            candidate_evaluations,
        )
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
        planner_turn_count = int(self._metrics.get("planner_turn_count") or 0)
        planner_applied = int(self._metrics.get("planner_decision_applied_count") or 0)
        planner_parse_fail = int(self._metrics.get("planner_decision_parse_fail_count") or 0)
        planner_applied_rate = round(planner_applied / max(1, planner_turn_count), 4)
        off_entity_reject_rate = round(
            float(self._metrics.get("off_entity_reject_count") or 0) / max(1, len(candidate_evaluations)),
            4,
        )
        artifact_consistency_issues = self._trace_consistency_issues(
            turn_trace=state["turn_trace"],
            planner_decisions=state["planner_decisions"],
            executed_actions=state["executed_actions"][: len(state["turn_trace"])],
            planner_turn_count=planner_turn_count,
            planner_applied_count=min(planner_applied, len(state["turn_trace"])),
        )
        controller_health_reasons = self._build_controller_health_reasons(
            planner_applied_rate=planner_applied_rate,
            planner_parse_fail_count=planner_parse_fail,
            validated_count=len(validated_signals),
            off_entity_reject_rate=off_entity_reject_rate,
            judge_fallback_count=int(self._metrics.get("judge_fallback_count") or 0),
            schema_fail_count=int(self._metrics.get("schema_fail_count") or 0),
            artifact_consistency_issues=artifact_consistency_issues,
        )
        performance_summary = {
            "runtime_mode": "agentic_v4_batched",
            "run_mode": "agentic_v4_batched",
            "total_duration_ms": total_duration_ms,
            "stop_reason": batch_stop_reason,
            "signals_validated_count": len(validated_signals),
            "signals_provisional_count": len(provisional_signals),
            "signals_candidate_events_count": len(candidate_evaluations),
            "planner_turn_count": planner_turn_count,
            "planner_decision_parse_fail_count": planner_parse_fail,
            "planner_decision_applied_count": planner_applied,
            "planner_decision_applied_rate": planner_applied_rate,
            "planner_repair_count": int(self._metrics.get("planner_repair_count") or 0),
            "planner_branch_change_count": int(self._metrics.get("planner_branch_change_count") or 0),
            "planner_block_reason_counts": dict(self._metrics.get("planner_block_reason_counts") or {}),
            "planner_llm_attempt_history": list(self._metrics.get("planner_llm_attempt_history") or []),
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
            "artifact_consistency_ok": len(artifact_consistency_issues) == 0,
            "artifact_consistency_issues": artifact_consistency_issues,
            "batch_count": len(state["batch_trace"]),
            "batch_pages_processed": int(self._metrics.get("batch_pages_processed") or 0),
            "batch_searches_executed": int(self._metrics.get("batch_searches_executed") or 0),
            "soft_skip_override_count": int(self._metrics.get("soft_skip_override_count") or 0),
            "audit_degraded_count": int(self._metrics.get("audit_degraded_count") or 0),
            "evidence_pack_token_estimate": int(self._metrics.get("evidence_pack_token_estimate") or 0),
            "hop_timings": [
                {
                    "turn": row.get("batch"),
                    "action": "batch",
                    "target": row.get("batch_type"),
                    "summary": ((row.get("planner_output") or {}).get("batch_assessment") if isinstance(row, dict) else None),
                    "planner_status": "applied" if row.get("executed_actions") else "blocked",
                    "planner_block_reason": None if row.get("executed_actions") else "planner_action_provider_error",
                }
                for row in state["batch_trace"]
                if isinstance(row, dict)
            ],
            "official_site_resolution_traces": [
                {
                    "official_site_url": official_site,
                    "official_domains": sorted(official_domains),
                    "lane_statuses": {},
                }
            ],
        }
        return DiscoveryResultAgenticV4Batched(
            entity_id=entity_id,
            entity_name=entity_name,
            final_confidence=final_confidence,
            confidence_band=confidence_band,
            is_actionable=actionability_score >= 60 and len(validated_signals) >= 1,
            iterations_completed=len(state["batch_trace"]),
            total_cost_usd=0.0,
            hypotheses=list(state["open_hypotheses"]),
            depth_stats={0: len(validated_signals), 1: len(provisional_signals)},
            signals_discovered=validated_signals,
            provisional_signals=provisional_signals,
            raw_signals=list(state["evidence_ledger"]),
            performance_summary=performance_summary,
            entity_confidence=round(min(0.95, 0.35 + (entity_grounded_signal_count * 0.08)), 3),
            pipeline_confidence=round(final_confidence, 3),
            parse_path="agentic_v4_batched",
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
            batch_trace=list(state["batch_trace"]),
            evidence_packs=list(state["evidence_packs"]),
            prior_run_memory=prior_run_memory,
            sitemap_candidates=list(state["sitemap_candidates"]),
            soft_skip_events=list(state["soft_skip_events"]),
            kimi_batch_outputs=list(state["kimi_batch_outputs"]),
            deepseek_audits=list(state["deepseek_audits"]),
            batch_stop_reason=batch_stop_reason,
        )

    async def _collect_seed_batch(
        self,
        *,
        entity_name: str,
        entity_tokens: List[str],
        official_site: Optional[str],
        official_domains: Set[str],
        state: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        items: List[Dict[str, Any]] = []
        if official_site:
            for url in [official_site, urljoin(official_site.rstrip("/") + "/", "news/")]:
                if len(items) >= self.seed_batch_size:
                    break
                retrieved = await self._retrieve_url_item(
                    url=url,
                    action_name="scrape_url",
                    official_domains=official_domains,
                )
                if retrieved:
                    items.append(retrieved)
        domain = sorted(official_domains)[0] if official_domains else ""
        seed_queries = [
            f'"{entity_name}" official site:{domain}' if domain else f'"{entity_name}" official',
            f'"{entity_name}" commercial partner site:{domain}' if domain else f'"{entity_name}" commercial partner',
            f'"{entity_name}" supplier OR procurement OR tender',
        ]
        for query in seed_queries[: max(1, self.seed_batch_size - len(items))]:
            search_rows = await self._retrieve_search_items(
                query=query,
                official_domains=official_domains,
                state=state,
            )
            items.extend(search_rows[: max(0, self.seed_batch_size - len(items))])
            if len(items) >= self.seed_batch_size:
                break
        return items[: self.seed_batch_size]

    async def _plan_batch(
        self,
        *,
        entity_name: str,
        objective: str,
        state: Dict[str, Any],
        evidence_pack: Dict[str, Any],
        last_batch_result: Dict[str, Any],
        batch_type: str,
    ) -> Dict[str, Any]:
        compact_memory = self._prior_run_memory_summary(state.get("prior_run_memory") or {})
        failed_branches = self._compact_failed_branch_summary(state.get("failed_paths") or {})
        missing_signals = self._compact_missing_signal_summary(last_batch_result=last_batch_result)
        prompt = (
            "Return strict JSON only. Plan the next Bright Data batch.\n"
            f"Mission: {state.get('mission_brief')}\n"
            f"Entity: {entity_name}\n"
            f"Objective: {objective}\n"
            f"Batch type: {batch_type}\n"
            f"Remaining credits: {int(state.get('remaining_credits') or 0)}\n"
            f"Known low-signal URLs: {json.dumps(compact_memory.get('low_signal_urls') or [], separators=(',', ':'))}\n"
            f"Recent successful URLs: {json.dumps(compact_memory.get('last_successful_evidence_urls') or [], separators=(',', ':'))}\n"
            f"Failed branches: {json.dumps(failed_branches, separators=(',', ':'))}\n"
            f"Still missing: {json.dumps(missing_signals, separators=(',', ':'))}\n"
            f"Evidence pack: {json.dumps(evidence_pack.get('packed_items') or [], separators=(',', ':'))}\n"
            "Return only JSON with next_batch_plan, stop_or_continue, optional missing_signals, and optional override_soft_skips. "
            "Keep actions concise and prioritize procurement need, future-RFP timing, leadership, or digital/commercial change signal."
        )
        response: Dict[str, Any] = {}
        try:
            response = await self.claude_client.query(
                prompt=prompt,
                model="planner",
                max_tokens=self.planner_max_tokens,
                json_mode=True,
                json_schema=BATCH_PLANNER_JSON_SCHEMA,
                stream=False,
                max_retries_override=0,
                empty_retries_before_fallback_override=1,
                fast_fail_on_length=True,
            )
        except Exception as planner_error:  # noqa: BLE001
            logger.warning("⚠️ Batched planner query failed: %s", planner_error)
            self._metrics["llm_last_status"] = "planner_query_error"
        planner_diag = getattr(self.claude_client, "get_runtime_diagnostics", lambda: {})() or {}
        self._metrics["planner_llm_attempt_history"] = list(planner_diag.get("llm_attempt_history") or [])
        payload = self._extract_json_payload(response)
        normalized = self._normalize_batch_plan_payload(payload=payload, state=state)
        if normalized:
            return normalized
        self._metrics["planner_decision_parse_fail_count"] += 1
        self._metrics["schema_fail_count"] += 1
        recovery = self._deterministic_recovery_batch_plan(state=state, entity_name=entity_name)
        self._metrics["planner_repair_count"] += 1
        self._metrics["llm_last_status"] = "planner_repaired"
        return recovery

    def _normalize_batch_plan_payload(
        self,
        *,
        payload: Any,
        state: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        if not isinstance(payload, dict):
            return None
        actions: List[Dict[str, Any]] = []
        raw_actions = payload.get("next_batch_plan")
        if not isinstance(raw_actions, list):
            return None
        for item in raw_actions:
            normalized_action = self._normalize_planner_action(payload=item, state=state)
            if normalized_action:
                actions.append(normalized_action)
        if not actions:
            return None
        stop_or_continue = str(payload.get("stop_or_continue") or "continue").strip().lower()
        if stop_or_continue not in {"stop", "continue"}:
            stop_or_continue = "continue"
        return {
            "missing_signals": payload.get("missing_signals") if isinstance(payload.get("missing_signals"), list) else [],
            "next_batch_plan": actions,
            "stop_or_continue": stop_or_continue,
            "override_soft_skips": payload.get("override_soft_skips") if isinstance(payload.get("override_soft_skips"), list) else [],
        }

    def _deterministic_recovery_batch_plan(self, *, state: Dict[str, Any], entity_name: str) -> Dict[str, Any]:
        pending_candidates = list(state.get("pending_candidates") or [])
        ranked, soft_skip_events = self._apply_soft_skip_memory(
            candidates=pending_candidates,
            prior_run_memory=state.get("prior_run_memory") or {},
            override_urls=set(),
        )
        if soft_skip_events:
            state["soft_skip_events"].extend(soft_skip_events)
        next_actions: List[Dict[str, Any]] = []
        if ranked:
            candidate = ranked[0]
            next_actions.append(
                {
                    "action": "scrape_url",
                    "target": str(candidate.get("url") or "").strip(),
                    "purpose": "deterministic_recovery_candidate",
                    "expected_signal_type": "entity_grounded_signal",
                    "confidence": 0.22,
                    "reason": "deterministic recovery using ranked candidate",
                }
            )
        elif state.get("official_domains"):
            domain = sorted(state.get("official_domains") or [])[0]
            next_actions.append(
                {
                    "action": "probe_same_domain",
                    "target": f'site:{domain} (news OR commercial OR partners OR supplier OR careers)',
                    "purpose": "deterministic_recovery_probe",
                    "expected_signal_type": "official_domain_signal",
                    "confidence": 0.18,
                    "reason": "deterministic recovery using official-domain probe",
                }
            )
        else:
            next_actions.append(
                {
                    "action": "search_web",
                    "target": f'"{entity_name}" procurement OR commercial lead',
                    "purpose": "deterministic_recovery_search",
                    "expected_signal_type": "web_signal",
                    "confidence": 0.15,
                    "reason": "deterministic recovery using web search",
                }
            )
        return {
            "missing_signals": [],
            "next_batch_plan": next_actions,
            "stop_or_continue": "continue",
            "override_soft_skips": [],
        }

    async def _audit_batch_items(
        self,
        *,
        items: List[Dict[str, Any]],
        entity_name: str,
        entity_tokens: List[str],
        official_domains: Set[str],
        state: Dict[str, Any],
    ) -> Dict[str, Any]:
        validated = 0
        provisional = 0
        candidate = 0
        for item in items:
            if not isinstance(item, dict):
                continue
            if item.get("kind") == "search_result":
                evidence = self._search_result_item_to_evidence(
                    item=item,
                    entity_tokens=entity_tokens,
                    official_domains=official_domains,
                )
                if evidence:
                    state["provisional_signals"].append(self._to_signal_record(evidence, "provisional"))
                    state["candidate_evaluations"].append(dict(evidence.get("candidate_evaluation") or {}))
                    state["deepseek_audits"].append(
                        {
                            "batch_item_url": evidence.get("url"),
                            "audit_mode": "search_result_heuristic",
                            "validation_state": "provisional",
                            "reason_code": evidence.get("reason_code"),
                        }
                    )
                    provisional += 1
                continue

            if item.get("kind") != "scrape":
                continue
            evidence = await self._evaluate_scrape(
                entity_name=entity_name,
                entity_tokens=entity_tokens,
                url=str(item.get("url") or "").strip(),
                scrape_result=item.get("scrape_result") or {},
                action=item.get("action") or {},
                official_domains=official_domains,
            )
            if not evidence:
                continue
            state["evidence_ledger"].append(evidence)
            state["deepseek_audits"].append(
                {
                    "batch_item_url": evidence.get("url"),
                    "audit_mode": "judge",
                    "validation_state": evidence.get("validation_state"),
                    "reason_code": evidence.get("reason_code"),
                }
            )
            candidate_eval = dict(evidence.get("candidate_evaluation") or {})
            if candidate_eval:
                state["candidate_evaluations"].append(candidate_eval)
            validation_state = str(evidence.get("validation_state") or "candidate").strip().lower()
            if validation_state == "validated":
                validated += 1
                state["validated_signals"].append(self._to_signal_record(evidence, "validated"))
            elif validation_state == "provisional":
                provisional += 1
                state["provisional_signals"].append(self._to_signal_record(evidence, "provisional"))
            else:
                candidate += 1
                if str(candidate_eval.get("reason_code") or "") == "off_entity":
                    self._metrics["off_entity_reject_count"] += 1
                if str((evidence.get("judge_verdict") or {}).get("reason_code") or "").strip().lower() == "judge_fallback_candidate":
                    self._metrics["audit_degraded_count"] += 1
            self._metrics["batch_pages_processed"] += 1
            if evidence.get("internal_links"):
                self._append_follow_links(
                    state=state,
                    links=evidence.get("internal_links") or [],
                    official_domains=official_domains,
                )
        return {
            "validated_count": validated,
            "provisional_count": provisional,
            "candidate_count": candidate,
            "summary": f"validated={validated} provisional={provisional} candidate={candidate}",
        }

    async def _execute_batch_plan(
        self,
        *,
        actions: List[Dict[str, Any]],
        entity_name: str,
        entity_tokens: List[str],
        official_domains: Set[str],
        state: Dict[str, Any],
        override_urls: Set[str],
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
        executed_actions: List[Dict[str, Any]] = []
        next_items: List[Dict[str, Any]] = []
        soft_skip_events: List[Dict[str, Any]] = []
        ranked_pending, pending_events = self._apply_soft_skip_memory(
            candidates=list(state.get("pending_candidates") or []),
            prior_run_memory=state.get("prior_run_memory") or {},
            override_urls=override_urls,
        )
        if pending_events:
            soft_skip_events.extend(pending_events)
        state["pending_candidates"] = ranked_pending
        self._metrics["soft_skip_override_count"] += len(override_urls)

        for action in actions[: self.discovery_batch_size]:
            action_name = str(action.get("action") or "").strip().lower()
            if action_name == "stop":
                executed_actions.append({"action": "stop", "target": action.get("target"), "purpose": action.get("purpose")})
                continue
            if action_name in {"search_web", "search_site", "probe_same_domain"}:
                query = self._resolve_search_query(action=action, entity_name=entity_name, official_domains=official_domains)
                search_items = await self._retrieve_search_items(query=query, official_domains=official_domains, state=state)
                next_items.extend(search_items)
                executed_actions.append({"action": action_name, "target": query, "purpose": action.get("purpose")})
                continue
            url = self._resolve_batch_action_url(action=action, state=state, override_urls=override_urls)
            if not url:
                continue
            retrieved = await self._retrieve_url_item(url=url, action_name=action_name, official_domains=official_domains)
            if retrieved:
                next_items.append(retrieved)
                executed_actions.append({"action": action_name, "target": url, "purpose": action.get("purpose")})
        return executed_actions, next_items, soft_skip_events

    async def _retrieve_search_items(
        self,
        *,
        query: str,
        official_domains: Set[str],
        state: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        if not query or query in state.get("visited_queries", set()):
            return []
        state["visited_queries"].add(query)
        try:
            search_result = await self.brightdata_client.search_engine(
                query=query,
                engine="google",
                num_results=self.max_search_results,
            )
        except Exception as search_error:  # noqa: BLE001
            logger.warning("⚠️ Batched search failed (%s): %s", query, search_error)
            self._register_lane_failure(state, "search", "search_provider_error")
            return []
        candidates = self._search_results_to_candidates(
            search_result=search_result,
            official_domains=official_domains,
            query=query,
            state=state,
        )
        state["pending_candidates"].extend(candidates)
        self._metrics["batch_searches_executed"] += 1
        items: List[Dict[str, Any]] = []
        for candidate in candidates[: self.discovery_batch_size]:
            items.append(
                {
                    "kind": "search_result",
                    "url": str(candidate.get("url") or "").strip(),
                    "host": str(candidate.get("host") or "").strip(),
                    "title": str(candidate.get("title") or "").strip(),
                    "snippet": str(candidate.get("snippet") or "").strip(),
                    "raw_text": "",
                    "normalized_text": self._normalize_text(
                        " ".join([str(candidate.get("title") or ""), str(candidate.get("snippet") or "")]).strip()
                    ),
                    "source_tier": self._source_tier(
                        source_host=str(candidate.get("host") or "").strip(),
                        official_domains=official_domains,
                    ),
                    "retrieval_mode": "search_result",
                    "word_count": len(
                        self._normalize_text(
                            " ".join([str(candidate.get("title") or ""), str(candidate.get("snippet") or "")]).strip()
                        ).split()
                    ),
                    "candidate_links": [],
                    "position": int(candidate.get("position") or 0),
                }
            )
        return items

    async def _retrieve_url_item(
        self,
        *,
        url: str,
        action_name: str,
        official_domains: Set[str],
    ) -> Optional[Dict[str, Any]]:
        normalized_url = self._normalize_url(url)
        if not normalized_url:
            return None
        try:
            scrape_result = await self._scrape_for_action(action_name=action_name, url=normalized_url)
        except Exception as scrape_error:  # noqa: BLE001
            logger.warning("⚠️ Batched scrape failed (%s): %s", normalized_url, scrape_error)
            return None
        content = str(scrape_result.get("content") or "")
        raw_html = str(scrape_result.get("raw_html") or "")
        host = (urlparse(normalized_url).hostname or "").lower().lstrip("www.")
        candidate_links = self._extract_internal_links(
            raw_html=raw_html,
            base_url=normalized_url,
            official_domains=official_domains,
        )
        return {
            "kind": "scrape",
            "url": normalized_url,
            "host": host,
            "title": "",
            "snippet": "",
            "raw_text": content,
            "normalized_text": self._normalize_text(content),
            "source_tier": self._source_tier(source_host=host, official_domains=official_domains),
            "retrieval_mode": str(((scrape_result.get("metadata") or {}).get("request_type") or action_name)).strip(),
            "word_count": int(((scrape_result.get("metadata") or {}).get("word_count") or len(self._normalize_text(content).split()))),
            "quality_score": self._quality_score(
                word_count=int(((scrape_result.get("metadata") or {}).get("word_count") or len(self._normalize_text(content).split()))),
                text=self._normalize_text(content),
            ),
            "candidate_links": candidate_links,
            "scrape_result": scrape_result,
            "action": {"action": action_name, "purpose": "batch_scrape"},
        }

    def _search_result_item_to_evidence(
        self,
        *,
        item: Dict[str, Any],
        entity_tokens: List[str],
        official_domains: Set[str],
    ) -> Optional[Dict[str, Any]]:
        candidate = {
            "url": str(item.get("url") or "").strip(),
            "title": str(item.get("title") or "").strip(),
            "snippet": str(item.get("snippet") or "").strip(),
            "host": str(item.get("host") or "").strip(),
            "position": int(item.get("position") or 1),
            "same_domain": str(item.get("host") or "").strip() in official_domains,
            "candidate_origin": "search_batch",
        }
        provisional = self._search_candidates_to_provisional_evidence(
            candidates=[candidate],
            entity_tokens=entity_tokens,
        )
        return provisional[0] if provisional else None

    def _build_evidence_pack(
        self,
        *,
        batch_index: int,
        batch_type: str,
        items: List[Dict[str, Any]],
        entity_tokens: List[str],
        official_domains: Set[str],
        prior_run_memory: Dict[str, Any],
    ) -> Dict[str, Any]:
        packed_items: List[Dict[str, Any]] = []
        token_estimate = 0
        token_target = self._batch_input_token_target_for_type(batch_type)
        sorted_items = sorted(
            [item for item in items if isinstance(item, dict)],
            key=lambda row: (
                0 if str(row.get("source_tier") or "") == "tier_1" else 1,
                -float(row.get("quality_score") or 0.0),
                -self._entity_grounding_score(
                    entity_tokens=entity_tokens,
                    text=" ".join(
                        [
                            str(row.get("title") or ""),
                            str(row.get("snippet") or ""),
                            str(row.get("normalized_text") or ""),
                            str(row.get("url") or ""),
                        ]
                    ),
                ),
            ),
        )
        for item in sorted_items:
            excerpt = self._pack_excerpt(item=item)
            packed = {
                "url": str(item.get("url") or "").strip(),
                "host": str(item.get("host") or "").strip(),
                "title": str(item.get("title") or "").strip(),
                "snippet": str(item.get("snippet") or "").strip(),
                "retrieval_mode": str(item.get("retrieval_mode") or "").strip(),
                "source_tier": str(item.get("source_tier") or "").strip(),
                "word_count": int(item.get("word_count") or 0),
                "quality_score": round(float(item.get("quality_score") or 0.0), 3),
                "entity_grounding_score": self._entity_grounding_score(
                    entity_tokens=entity_tokens,
                    text=" ".join(
                        [
                            str(item.get("title") or ""),
                            str(item.get("snippet") or ""),
                            str(item.get("normalized_text") or ""),
                            str(item.get("url") or ""),
                        ]
                    ),
                ),
                "prior_run_score": float(
                    (
                        (prior_run_memory.get("url_outcomes") or {}).get(str(item.get("url") or ""), {}) or {}
                    ).get("success_count")
                    or 0.0
                ),
                "prior_failure_reason": str(
                    (
                        (prior_run_memory.get("url_outcomes") or {}).get(str(item.get("url") or ""), {}) or {}
                    ).get("last_reason")
                    or ""
                ).strip(),
                "candidate_links": list(item.get("candidate_links") or [])[:6],
                "excerpt": excerpt,
            }
            token_estimate += max(1, len(excerpt.split()) // 0.75) if excerpt else 20
            packed_items.append(packed)
            if token_estimate >= token_target:
                break
        return {
            "batch": batch_index,
            "batch_type": batch_type,
            "packed_items": packed_items,
            "token_estimate": token_estimate,
        }

    def _batch_input_token_target_for_type(self, batch_type: str) -> int:
        normalized = str(batch_type or "").strip().lower()
        if normalized == "seed_batch":
            return self.seed_batch_input_token_target
        if normalized == "official_domain_map_batch":
            return self.domain_batch_input_token_target
        if normalized == "targeted_discovery_batch":
            return self.discovery_batch_input_token_target
        if normalized == "deepening_batch":
            return self.deepening_batch_input_token_target
        return self.batch_input_token_target

    def _pack_excerpt(self, *, item: Dict[str, Any]) -> str:
        title = str(item.get("title") or "").strip()
        snippet = str(item.get("snippet") or "").strip()
        normalized_text = str(item.get("normalized_text") or "").strip()
        if normalized_text:
            chunks = [chunk.strip() for chunk in normalized_text.split(".") if chunk.strip()]
            priority_chunks = []
            for chunk in chunks:
                lower = chunk.lower()
                if any(
                    term in lower
                    for term in ("procurement", "supplier", "commercial", "partner", "director", "chief", "head of", "digital", "hiring")
                ):
                    priority_chunks.append(chunk)
            selected = priority_chunks[:4] if priority_chunks else chunks[:4]
            excerpt = ". ".join(selected).strip()
            if excerpt:
                return self._truncate_word_boundary(excerpt, 600)
        return self._truncate_word_boundary(" ".join([title, snippet]).strip(), 280)

    def _load_prior_run_memory(self, *, entity_id: str) -> Dict[str, Any]:
        memory = {
            "url_outcomes": {},
            "branch_outcomes": {},
            "last_successful_evidence_urls": [],
        }
        if not self.discovery_memory_dir.exists():
            return memory
        discovery_files = sorted(
            list(self.discovery_memory_dir.glob(f"{entity_id}_discovery_*.json"))
            + list(self.discovery_memory_dir.glob(f"{entity_id}_discovery_agentic_v3_*.json"))
            + list(self.discovery_memory_dir.glob(f"{entity_id}_discovery_agentic_v4_batched_*.json")),
            key=lambda path: path.stat().st_mtime,
            reverse=True,
        )[:6]
        for path in discovery_files:
            try:
                payload = json.loads(path.read_text())
            except Exception:
                continue
            for item in payload.get("candidate_evaluations") or []:
                if not isinstance(item, dict):
                    continue
                url = str(item.get("source_url") or "").strip()
                if not url:
                    continue
                row = memory["url_outcomes"].setdefault(
                    url,
                    {
                        "low_signal_count": 0,
                        "empty_render_count": 0,
                        "success_count": 0,
                        "last_reason": "",
                    },
                )
                reason = str(item.get("reason_code") or "").strip().lower()
                row["last_reason"] = reason
                if reason in {"low_signal", "no_procurement_signal"}:
                    row["low_signal_count"] += 1
                if reason in {"low_signal_rendered", "empty_render"}:
                    row["empty_render_count"] += 1
                if str(item.get("validation_state") or "").strip().lower() in {"validated", "provisional"}:
                    row["success_count"] += 1
            for signal in payload.get("signals_discovered") or []:
                if not isinstance(signal, dict):
                    continue
                url = str(signal.get("url") or "").strip()
                if url and url not in memory["last_successful_evidence_urls"]:
                    memory["last_successful_evidence_urls"].append(url)
        return memory

    def _prior_run_memory_summary(self, prior_run_memory: Dict[str, Any]) -> Dict[str, Any]:
        url_outcomes = prior_run_memory.get("url_outcomes") if isinstance(prior_run_memory.get("url_outcomes"), dict) else {}
        low_signal_urls = [
            url
            for url, row in url_outcomes.items()
            if isinstance(row, dict) and int(row.get("low_signal_count") or 0) >= 2
        ][:6]
        successful = list(prior_run_memory.get("last_successful_evidence_urls") or [])[:6]
        return {
            "low_signal_urls": low_signal_urls,
            "last_successful_evidence_urls": successful,
        }

    @staticmethod
    def _compact_failed_branch_summary(failed_paths: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(failed_paths, dict):
            return {}
        compact: Dict[str, Any] = {}
        for key, value in list(failed_paths.items())[:6]:
            compact[str(key)] = value
        return compact

    @staticmethod
    def _compact_missing_signal_summary(*, last_batch_result: Dict[str, Any]) -> List[str]:
        if not isinstance(last_batch_result, dict):
            return []
        missing = last_batch_result.get("missing_signals")
        if isinstance(missing, list):
            return [str(item).strip() for item in missing[:6] if str(item).strip()]
        return []

    def _apply_soft_skip_memory(
        self,
        *,
        candidates: List[Dict[str, Any]],
        prior_run_memory: Dict[str, Any],
        override_urls: Set[str],
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        if not self.soft_skip_enabled:
            return list(candidates or []), []
        events: List[Dict[str, Any]] = []
        url_outcomes = prior_run_memory.get("url_outcomes") if isinstance(prior_run_memory.get("url_outcomes"), dict) else {}
        ranked: List[Dict[str, Any]] = []
        for candidate in candidates or []:
            if not isinstance(candidate, dict):
                continue
            url = str(candidate.get("url") or "").strip()
            outcome = url_outcomes.get(url) if isinstance(url_outcomes, dict) else None
            low_signal_count = int((outcome or {}).get("low_signal_count") or 0) if isinstance(outcome, dict) else 0
            empty_render_count = int((outcome or {}).get("empty_render_count") or 0) if isinstance(outcome, dict) else 0
            last_reason = str((outcome or {}).get("last_reason") or "").strip().lower() if isinstance(outcome, dict) else ""
            if empty_render_count >= 2 and url not in override_urls:
                events.append({"event": "hard_skip_empty_render", "url": url, "reason": last_reason or "empty_render"})
                continue
            memory_penalty = 0
            if low_signal_count >= 2 and url not in override_urls:
                memory_penalty = 10
                events.append({"event": "soft_skip_downrank", "url": url, "reason": last_reason or "low_signal"})
            elif url in override_urls:
                events.append({"event": "soft_skip_override", "url": url})
            ranked.append(
                {
                    **candidate,
                    "_memory_penalty": memory_penalty,
                }
            )
        ranked.sort(
            key=lambda row: (
                int(row.get("_memory_penalty") or 0),
                0 if bool(row.get("same_domain")) else 1,
                self._candidate_path_priority(str(row.get("url") or "")),
                int(row.get("position") or 0),
            )
        )
        for row in ranked:
            row.pop("_memory_penalty", None)
        return ranked, events

    def _resolve_batch_action_url(
        self,
        *,
        action: Dict[str, Any],
        state: Dict[str, Any],
        override_urls: Set[str],
    ) -> Optional[str]:
        target = self._normalize_url(action.get("target"))
        if target:
            return target
        pending = list(state.get("pending_candidates") or [])
        ranked, events = self._apply_soft_skip_memory(
            candidates=pending,
            prior_run_memory=state.get("prior_run_memory") or {},
            override_urls=override_urls,
        )
        if events:
            state["soft_skip_events"].extend(events)
        if not ranked:
            return state.get("official_site_url")
        selected = ranked[0]
        chosen_url = self._normalize_url(selected.get("url"))
        state["pending_candidates"] = [item for item in ranked[1:]]
        return chosen_url

    @staticmethod
    def _batch_type_for_index(index: int) -> str:
        if index == 1:
            return "seed_batch"
        if index == 2:
            return "official_domain_map_batch"
        if index == 3:
            return "targeted_discovery_batch"
        return "deepening_batch"
