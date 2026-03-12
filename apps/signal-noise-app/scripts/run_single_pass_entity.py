#!/usr/bin/env python3
"""Run a deterministic single-pass discovery for one entity."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterator, Optional


SCRIPT_PATH = Path(__file__).resolve()
APP_ROOT = SCRIPT_PATH.parents[1]
REPO_ROOT = SCRIPT_PATH.parents[3]
BACKEND_ROOT = APP_ROOT / "backend"
TEMPLATE_DIR = BACKEND_ROOT / "bootstrapped_templates"

import sys

for p in (REPO_ROOT, APP_ROOT, BACKEND_ROOT):
    p_str = str(p)
    if p_str not in sys.path:
        sys.path.insert(0, p_str)

try:
    from dotenv import load_dotenv
except Exception:  # noqa: BLE001
    load_dotenv = None

if load_dotenv is not None:
    env_path = APP_ROOT / ".env"
    if env_path.exists():
        load_dotenv(env_path, override=False)


from backend.claude_client import ClaudeClient
from backend.brightdata_sdk_client import BrightDataSDKClient
from backend.hypothesis_driven_discovery import HypothesisDrivenDiscovery
from backend.run_entity_discovery import fetch_entity_from_falkordb


def _bool_env(value: str) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _set_single_pass_runtime(profile: str, strict_gate: bool, min_confidence: float) -> None:
    os.environ["DISCOVERY_RUN_MODE"] = "single_pass"
    os.environ["DISCOVERY_PROFILE"] = profile
    os.environ["DISCOVERY_STRICT_PROMOTION_GATE"] = "true" if strict_gate else "false"
    os.environ["DISCOVERY_PROMOTION_MIN_CONFIDENCE"] = f"{min_confidence:.2f}"
    os.environ["LLM_PROVIDER"] = os.getenv("LLM_PROVIDER", "chutes_openai")
    os.environ.setdefault("CHUTES_BASE_URL", "https://llm.chutes.ai/v1")
    os.environ.setdefault("DISCOVERY_HEURISTIC_FALLBACK_ON_LLM_UNAVAILABLE", "true")
    os.environ.setdefault("DISCOVERY_JSON_REPAIR_ATTEMPT", "true")


def _recovery_overrides() -> Dict[str, str]:
    return {
        "DISCOVERY_CONTENT_MIN_TEXT_CHARS": "120",
        "DISCOVERY_CONTENT_MIN_KEYWORD_SENTENCES": "0",
        "DISCOVERY_URL_RESOLUTION_MAX_FALLBACK_QUERIES_SINGLE_PASS": "2",
        "DISCOVERY_URL_RESOLUTION_MAX_SITE_SPECIFIC_QUERIES_SINGLE_PASS": "4",
        "DISCOVERY_DOSSIER_CONTEXT_TARGETED_SEARCH_ENABLED": "true",
        "DISCOVERY_DOSSIER_CONTEXT_MAX_TARGETED_QUERIES_SINGLE_PASS": "2",
        "DISCOVERY_FORCED_HOP_SEQUENCE": "official_site,press_release,careers_page",
    }


def _template_exists(template_id: str) -> bool:
    return bool(template_id) and (TEMPLATE_DIR / f"{template_id}.json").exists()


def _resolve_single_pass_template(requested_template_id: str, entity_name: str) -> str:
    requested = str(requested_template_id or "").strip()
    if requested and requested != "yellow_panther_agency":
        return requested

    forced = str(os.getenv("DISCOVERY_SINGLE_PASS_TEMPLATE_DEFAULT", "")).strip()
    if forced and _template_exists(forced):
        return forced

    name = str(entity_name or "").lower()
    if any(token in name for token in (" fc", "football club", " club")) and _template_exists(
        "tier_1_club_centralized_procurement"
    ):
        return "tier_1_club_centralized_procurement"
    if any(token in name for token in ("federation", "association")) and _template_exists(
        "federation_governing_body"
    ):
        return "federation_governing_body"

    return "yellow_panther_agency"


@contextmanager
def _temporary_env(overrides: Dict[str, str]) -> Iterator[None]:
    previous: Dict[str, Optional[str]] = {}
    for key, value in overrides.items():
        previous[key] = os.environ.get(key)
        os.environ[key] = value
    try:
        yield
    finally:
        for key, value in previous.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value


def _trusted_source_signal(result: Dict[str, Any]) -> bool:
    trusted = {"official_site", "press_release", "careers_page", "annual_report"}
    for signal in result.get("signals_discovered", []):
        source = str(signal.get("source_type") or signal.get("source") or "").strip().lower()
        hop = str(signal.get("hop_type") or "").strip().lower()
        if source in trusted or hop in trusted:
            return True
    return False


def _has_deterministic_trusted_evidence(result: Dict[str, Any]) -> bool:
    for signal in result.get("signals_discovered", []):
        evidence_type = str(signal.get("evidence_type") or "").strip().lower()
        hop = str(signal.get("hop_type") or "").strip().lower()
        if evidence_type.startswith("deterministic_") and hop in {"official_site", "press_release", "careers_page", "annual_report"}:
            return True
    return False


def _extract_last_decision(result: Dict[str, Any]) -> str:
    hop_timings = (result.get("performance_summary") or {}).get("hop_timings") or []
    if hop_timings:
        decision = hop_timings[-1].get("decision")
        if isinstance(decision, str) and decision.strip():
            return decision.strip().upper()
    return "NO_PROGRESS"


def _extract_parse_path(result: Dict[str, Any]) -> str:
    status_map = {
        "ok": "json_direct",
        "ok_fenced_json": "json_fenced",
        "partial_json_recovered": "partial_json_recovered",
        "text_decision_recovered": "text_decision_recovered",
        "text_no_progress_recovered": "text_no_progress_recovered",
        "json_repair_recovered": "json_repair_recovered",
        "heuristic_fallback": "heuristic_fallback",
    }

    parse_path = result.get("parse_path")
    if isinstance(parse_path, str) and parse_path.strip():
        return parse_path
    hop_timings = (result.get("performance_summary") or {}).get("hop_timings") or []
    if hop_timings:
        hp = hop_timings[-1].get("parse_path")
        if isinstance(hp, str) and hp.strip():
            return hp
    llm_status = str((result.get("performance_summary") or {}).get("llm_last_status") or "").strip().lower()
    if llm_status in status_map:
        return status_map[llm_status]
    return "not_started"


def _evaluate_gate(
    result: Dict[str, Any],
    min_confidence: float,
    strict_gate: bool,
) -> Dict[str, Any]:
    evaluation_mode = str(result.get("evaluation_mode") or ((result.get("performance_summary") or {}).get("evaluation_mode") or "unknown")).strip().lower()
    last_decision = str(result.get("decision") or _extract_last_decision(result)).strip().upper()
    confidence = float(result.get("final_confidence") or 0.0)
    trusted = _trusted_source_signal(result)
    deterministic_trusted = _has_deterministic_trusted_evidence(result)
    heuristic_trusted_signal = trusted and last_decision != "NO_PROGRESS" and len(result.get("signals_discovered") or []) > 0

    reasons = []
    if strict_gate and evaluation_mode != "llm" and not (deterministic_trusted or heuristic_trusted_signal):
        reasons.append("evaluation_mode_not_llm")
    if last_decision == "NO_PROGRESS":
        reasons.append("last_decision_no_progress")
    if not trusted:
        reasons.append("no_trusted_source_signal")
    if confidence < min_confidence:
        reasons.append("confidence_below_min")

    return {
        "promotion_gate_passed": len(reasons) == 0,
        "promotion_gate_reasons": reasons,
        "trusted_source_signal": trusted,
        "deterministic_trusted_evidence": deterministic_trusted,
        "heuristic_trusted_signal": heuristic_trusted_signal,
        "evaluation_mode": evaluation_mode,
        "last_decision": last_decision,
    }


def _should_run_recovery(gate: Dict[str, Any], strict_gate: bool) -> bool:
    if not strict_gate:
        return False
    if gate.get("promotion_gate_passed"):
        return False
    reasons = set(gate.get("promotion_gate_reasons") or [])
    return "last_decision_no_progress" in reasons


def _result_score(result: Dict[str, Any]) -> tuple:
    return (
        1 if result.get("promotion_gate_passed") else 0,
        1 if result.get("trusted_source_signal") else 0,
        float(result.get("final_confidence") or 0.0),
        len(result.get("signals_discovered") or []),
    )


def _artifact_path_string(path: Path) -> str:
    if not path.is_absolute():
        return str(path)
    try:
        return str(path.relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


async def _resolve_entity(
    entity_id: str,
    entity_name: Optional[str],
    fetch_timeout_seconds: float,
) -> str:
    if entity_name:
        return entity_name

    entity = await asyncio.wait_for(fetch_entity_from_falkordb(entity_id), timeout=fetch_timeout_seconds)
    if not entity:
        raise RuntimeError(f"Entity '{entity_id}' not found in FalkorDB and no --entity-name provided")
    return entity.name


async def _run_discovery_attempt(
    *,
    entity_id: str,
    entity_name: str,
    template_id: str,
    profile: str,
    min_confidence: float,
    strict_gate: bool,
    max_iterations: int,
    max_depth: int,
    attempt_label: str,
) -> Dict[str, Any]:
    claude = ClaudeClient()
    brightdata = BrightDataSDKClient()
    discovery = HypothesisDrivenDiscovery(claude_client=claude, brightdata_client=brightdata)
    try:
        result_obj = await discovery.run_discovery(
            entity_id=entity_id,
            entity_name=entity_name,
            template_id=template_id,
            max_iterations=max_iterations,
            max_depth=max_depth,
        )
    finally:
        close_fn = getattr(brightdata, "close", None)
        if callable(close_fn):
            await close_fn()

    result = result_obj.to_dict() if hasattr(result_obj, "to_dict") else dict(result_obj)
    result["run_mode"] = "single_pass"
    result["run_profile"] = profile
    result["attempt_label"] = attempt_label
    result["parse_path"] = _extract_parse_path(result)

    gate = _evaluate_gate(result, min_confidence, strict_gate)
    result.update(gate)
    result["decision"] = gate["last_decision"]
    result["min_confidence"] = min_confidence
    result["hold_status"] = "READY_FOR_PHASE1_PLUS" if gate["promotion_gate_passed"] else "HOLD_SINGLE_PASS"
    return result


async def run_single_pass(args: argparse.Namespace) -> Dict[str, Any]:
    _set_single_pass_runtime(args.profile, args.strict_gate, args.min_confidence)

    resolved_name = await _resolve_entity(
        entity_id=args.entity_id,
        entity_name=args.entity_name,
        fetch_timeout_seconds=args.fetch_timeout_seconds,
    )
    template_id = _resolve_single_pass_template(args.template_id, resolved_name)

    primary_result = await _run_discovery_attempt(
        entity_id=args.entity_id,
        entity_name=resolved_name,
        template_id=template_id,
        profile=args.profile,
        min_confidence=args.min_confidence,
        strict_gate=args.strict_gate,
        max_iterations=1,
        max_depth=1,
        attempt_label="primary",
    )

    attempts = [primary_result]
    recovery_attempted = False
    if _should_run_recovery(primary_result, bool(args.strict_gate)):
        recovery_attempted = True
        with _temporary_env(_recovery_overrides()):
            recovery_result = await _run_discovery_attempt(
                entity_id=args.entity_id,
                entity_name=resolved_name,
                template_id=template_id,
                profile=args.profile,
                min_confidence=args.min_confidence,
                strict_gate=args.strict_gate,
                max_iterations=3,
                max_depth=3,
                attempt_label="targeted_recovery",
            )
        attempts.append(recovery_result)

    result = max(attempts, key=_result_score)
    result["recovery_attempted"] = recovery_attempted
    result["recovery_attempts"] = [
        {
            "attempt_label": attempt.get("attempt_label"),
            "evaluation_mode": attempt.get("evaluation_mode"),
            "decision": attempt.get("decision"),
            "final_confidence": attempt.get("final_confidence"),
            "signals_count": len(attempt.get("signals_discovered") or []),
            "parse_path": attempt.get("parse_path"),
            "promotion_gate_passed": bool(attempt.get("promotion_gate_passed")),
        }
        for attempt in attempts
    ]

    slug = args.entity_id
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    out_path = output_dir / f"{slug}_single_pass_{ts}.json"
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    summary = {
        "entity_id": args.entity_id,
        "entity_name": resolved_name,
        "template_id": template_id,
        "artifact": _artifact_path_string(out_path),
        "final_confidence": float(result.get("final_confidence") or 0.0),
        "evaluation_mode": result.get("evaluation_mode"),
        "last_decision": result.get("decision"),
        "signals_count": len(result.get("signals_discovered") or []),
        "promotion_gate_passed": bool(result.get("promotion_gate_passed")),
        "promotion_gate_reasons": result.get("promotion_gate_reasons") or [],
        "parse_path": result.get("parse_path"),
        "run_profile": result.get("run_profile"),
        "recovery_attempted": bool(result.get("recovery_attempted")),
    }
    return summary


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run a deterministic single-pass discovery for one entity")
    parser.add_argument("--entity-id", required=True, help="Entity slug/id")
    parser.add_argument("--entity-name", default=None, help="Optional entity display name (skips FalkorDB lookup)")
    parser.add_argument("--template-id", default="yellow_panther_agency", help="Hypothesis template id")
    parser.add_argument("--profile", choices=["continuous", "test"], default=os.getenv("DISCOVERY_PROFILE", "test"), help="Runtime profile for pacing/diagnostics")
    parser.add_argument("--output-dir", default=str(BACKEND_ROOT / "data" / "dossiers"), help="Where to write single-pass artifact")
    parser.add_argument("--min-confidence", type=float, default=float(os.getenv("DISCOVERY_PROMOTION_MIN_CONFIDENCE", "0.55")), help="Promotion gate confidence floor")
    parser.add_argument("--strict-gate", type=_bool_env, default=_bool_env(os.getenv("DISCOVERY_STRICT_PROMOTION_GATE", "true")), help="Require strict promotion gate")
    parser.add_argument("--fetch-timeout-seconds", type=float, default=8.0, help="Max wait for FalkorDB entity lookup when entity name is not provided")
    return parser


def main() -> None:
    parser = _build_parser()
    args = parser.parse_args()
    summary = asyncio.run(run_single_pass(args))
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
