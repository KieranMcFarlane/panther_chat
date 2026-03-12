#!/usr/bin/env python3
"""Run deterministic single-pass discovery for one entity with strict promotion gating."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List

from dotenv import load_dotenv

try:
    from backend.brightdata_sdk_client import BrightDataSDKClient
    from backend.claude_client import ClaudeClient
    from backend.hypothesis_driven_discovery import HopType, HypothesisDrivenDiscovery
except ImportError:
    from brightdata_sdk_client import BrightDataSDKClient
    from claude_client import ClaudeClient
    from hypothesis_driven_discovery import HopType, HypothesisDrivenDiscovery


FOCUSED_RECOVERY_HOPS = [HopType.OFFICIAL_SITE, HopType.PRESS_RELEASE, HopType.CAREERS_PAGE]
TRUSTED_SOURCE_TOKENS = (
    "official",
    "press",
    "career",
    "annual",
    "procurement",
    "tender",
)


def _sanitize(value: str) -> str:
    return "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in value.strip().lower()).strip("-")


def _to_payload(result: Any) -> Dict[str, Any]:
    if hasattr(result, "to_dict"):
        return result.to_dict()
    return {
        "entity_id": getattr(result, "entity_id", ""),
        "entity_name": getattr(result, "entity_name", ""),
        "final_confidence": getattr(result, "final_confidence", 0.0),
        "iterations_completed": getattr(result, "iterations_completed", 0),
        "signals_discovered": getattr(result, "signals_discovered", []),
        "performance_summary": getattr(result, "performance_summary", {}),
    }


def _has_trusted_source_signal(signals: Iterable[Dict[str, Any]]) -> bool:
    for signal in signals or []:
        haystack = " ".join(
            str(signal.get(key, ""))
            for key in ("source", "url", "type", "text", "description")
            if isinstance(signal, dict)
        ).lower()
        if any(token in haystack for token in TRUSTED_SOURCE_TOKENS):
            return True
    return False


def _promotion_gate(payload: Dict[str, Any], *, min_confidence: float) -> Dict[str, Any]:
    perf = payload.get("performance_summary") or {}
    decision = "NO_PROGRESS"
    hop_timings = perf.get("hop_timings") or []
    if hop_timings and isinstance(hop_timings[-1], dict):
        decision = str(hop_timings[-1].get("decision") or "NO_PROGRESS")

    evaluation_mode = str(perf.get("evaluation_mode") or "heuristic")
    confidence = float(payload.get("final_confidence") or 0.0)
    trusted_signal = _has_trusted_source_signal(payload.get("signals_discovered") or [])

    reasons: List[str] = []
    if evaluation_mode != "llm":
        reasons.append("evaluation_mode_not_llm")
    if decision == "NO_PROGRESS":
        reasons.append("decision_no_progress")
    if not trusted_signal:
        reasons.append("missing_trusted_source_signal")
    if confidence < min_confidence:
        reasons.append(f"confidence_below_threshold:{confidence:.2f}<{min_confidence:.2f}")

    return {
        "promotion_gate_passed": not reasons,
        "promotion_gate_reasons": reasons,
        "decision": decision,
        "evaluation_mode": evaluation_mode,
        "trusted_source_signal": trusted_signal,
        "min_confidence": min_confidence,
    }


async def _run_with_hop_sequence(
    discovery: HypothesisDrivenDiscovery,
    *,
    entity_id: str,
    entity_name: str,
    template_id: str,
    hop_sequence: List[HopType],
    max_depth: int,
) -> Any:
    original_choose = discovery._choose_next_hop
    index = {"i": 0}

    def _forced_choose(_hypothesis: Any, _state: Any) -> HopType:
        hop = hop_sequence[min(index["i"], len(hop_sequence) - 1)]
        index["i"] += 1
        return hop

    discovery._choose_next_hop = _forced_choose
    try:
        return await discovery.run_discovery(
            entity_id=entity_id,
            entity_name=entity_name,
            template_id=template_id,
            max_iterations=len(hop_sequence),
            max_depth=max_depth,
        )
    finally:
        discovery._choose_next_hop = original_choose


async def _run(entity_id: str, entity_name: str, template_id: str, min_confidence: float, strict_gate: bool) -> dict:
    os.environ.setdefault("DISCOVERY_RUN_MODE", "single_pass")

    claude = ClaudeClient()
    brightdata = BrightDataSDKClient()
    discovery = HypothesisDrivenDiscovery(claude, brightdata)

    try:
        initial_result = await discovery.run_discovery(
            entity_id=entity_id,
            entity_name=entity_name,
            template_id=template_id,
            max_iterations=1,
            max_depth=1,
        )
        payload = _to_payload(initial_result)
        gate = _promotion_gate(payload, min_confidence=min_confidence)
        payload.update(gate)
        payload["run_profile"] = (payload.get("performance_summary") or {}).get("run_profile")
        payload["parse_path"] = (payload.get("performance_summary") or {}).get("parse_path")
        payload["run_mode"] = "single_pass"

        recovery_payload = None
        if strict_gate and not gate["promotion_gate_passed"]:
            recovery_result = await _run_with_hop_sequence(
                discovery,
                entity_id=entity_id,
                entity_name=entity_name,
                template_id=template_id,
                hop_sequence=FOCUSED_RECOVERY_HOPS,
                max_depth=1,
            )
            recovery_payload = _to_payload(recovery_result)
            recovery_gate = _promotion_gate(recovery_payload, min_confidence=min_confidence)
            recovery_payload.update(recovery_gate)
            recovery_payload["run_profile"] = (recovery_payload.get("performance_summary") or {}).get("run_profile")
            recovery_payload["parse_path"] = (recovery_payload.get("performance_summary") or {}).get("parse_path")
            recovery_payload["run_mode"] = "single_pass"
            recovery_payload["recovery_hops"] = [hop.value for hop in FOCUSED_RECOVERY_HOPS]

            payload["recovery_attempted"] = True
            payload["recovery_summary"] = {
                "promotion_gate_passed": recovery_gate["promotion_gate_passed"],
                "promotion_gate_reasons": recovery_gate["promotion_gate_reasons"],
                "final_confidence": recovery_payload.get("final_confidence"),
                "artifact_mode": "recovery",
            }
            if recovery_gate["promotion_gate_passed"]:
                payload = recovery_payload
                payload["recovered_from_hold"] = True
            else:
                payload["hold_status"] = "HOLD_SINGLE_PASS"

        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        out_dir = Path("backend/data/dossiers")
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"{_sanitize(entity_id)}_single_pass_{timestamp}.json"
        out_path.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")

        perf = payload.get("performance_summary") or {}
        summary = {
            "entity_id": payload.get("entity_id"),
            "entity_name": payload.get("entity_name"),
            "final_confidence": payload.get("final_confidence"),
            "iterations_completed": payload.get("iterations_completed"),
            "signals_count": len(payload.get("signals_discovered") or []),
            "llm_provider": perf.get("llm_provider"),
            "llm_retry_attempts": perf.get("llm_retry_attempts"),
            "llm_last_status": perf.get("llm_last_status"),
            "evaluation_mode": perf.get("evaluation_mode"),
            "parse_path": perf.get("parse_path"),
            "run_profile": perf.get("run_profile"),
            "promotion_gate_passed": payload.get("promotion_gate_passed"),
            "promotion_gate_reasons": payload.get("promotion_gate_reasons") or [],
            "artifact": str(out_path),
        }
        if recovery_payload is not None:
            summary["recovery_attempted"] = True
        return summary
    finally:
        close_fn = getattr(brightdata, "close", None)
        if callable(close_fn):
            await close_fn()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--entity-id", required=True)
    parser.add_argument("--entity-name", required=True)
    parser.add_argument("--template-id", default="yellow_panther_agency")
    parser.add_argument("--min-confidence", type=float, default=float(os.getenv("DISCOVERY_PROMOTION_MIN_CONFIDENCE", "0.55")))
    parser.add_argument("--strict-gate", action="store_true", default=True)
    parser.add_argument("--no-strict-gate", action="store_false", dest="strict_gate")
    args = parser.parse_args()

    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    summary = asyncio.run(
        _run(
            entity_id=args.entity_id,
            entity_name=args.entity_name,
            template_id=args.template_id,
            min_confidence=args.min_confidence,
            strict_gate=args.strict_gate,
        )
    )
    print("SINGLE_PASS_SUMMARY=" + json.dumps(summary))


if __name__ == "__main__":
    main()
