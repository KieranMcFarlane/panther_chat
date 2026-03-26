#!/usr/bin/env python3
"""Two-entity v5 smoke for strict BrightData MCP + DeepSeek pipeline.

Direct hosted BrightData MCP is the default transport.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List, Optional

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(BACKEND))

from run_fixed_dossier_pipeline import FixedDossierFirstPipeline  # noqa: E402

# Make the strict v5 boundary explicit for the smoke.
os.environ.setdefault("PIPELINE_V5_STRICT_MCP", "true")
os.environ.setdefault("PIPELINE_USE_BRIGHTDATA_MCP", "true")
os.environ.setdefault("PIPELINE_USE_BRIGHTDATA_FASTMCP", "false")

DEFAULT_TWO_ENTITY_BATCH: List[Dict[str, Any]] = [
    {
        "entity_id": "major-league-cricket",
        "entity_name": "Major League Cricket",
        "entity_type": "SPORT_LEAGUE",
        "tier_score": 82,
        "max_discovery_iterations": 5,
    },
    {
        "entity_id": "international-canoe-federation",
        "entity_name": "International Canoe Federation",
        "entity_type": "SPORT_FEDERATION",
        "tier_score": 74,
        "max_discovery_iterations": 5,
    },
]


def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _bool_env(name: str, default: str = "false") -> bool:
    return str(os.getenv(name, default)).strip().lower() in {"1", "true", "yes", "on"}


def _coerce_int(value: Any) -> int:
    try:
        return int(value or 0)
    except Exception:
        return 0


def _coerce_float(value: Any) -> float:
    try:
        return float(value or 0.0)
    except Exception:
        return 0.0


def _extract_report_path(result: Dict[str, Any]) -> str | None:
    for key in ("run_report_path", "report_path", "output_path"):
        candidate = result.get(key)
        if candidate:
            return str(candidate)
    artifacts = result.get("artifacts")
    if isinstance(artifacts, dict):
        for key in ("run_report_path", "report_path", "output_path"):
            candidate = artifacts.get(key)
            if candidate:
                return str(candidate)
    return None


def _load_repo_envs() -> None:
    seen: set[Path] = set()
    for parent in Path(__file__).resolve().parents:
        for candidate in (
            parent / ".env",
            parent / "apps" / "signal-noise-app" / ".env",
            parent / "apps" / "signal-noise-app" / "backend" / ".env",
        ):
            if candidate in seen:
                continue
            seen.add(candidate)
            if candidate.exists():
                load_dotenv(candidate, override=False)


def _extract_acceptance_passed(result: Dict[str, Any]) -> bool:
    acceptance_gate = result.get("acceptance_gate")
    if isinstance(acceptance_gate, dict):
        return bool(acceptance_gate.get("passed", False))
    return bool(result.get("acceptance_gate_passed", False))


async def run_smoke(
    entities: Iterable[Dict[str, Any]],
    output_path: Path,
    *,
    pipeline_factory: Optional[Callable[[], Any]] = None,
) -> int:
    _load_repo_envs()

    if pipeline_factory is None:
        pipeline_factory = FixedDossierFirstPipeline

    pipeline = pipeline_factory()
    summary: Dict[str, Any] = {
        "run_at": _iso(),
        "strict_v5_mcp": bool(getattr(pipeline, "v5_strict_mcp", _bool_env("PIPELINE_V5_STRICT_MCP", "true"))),
        "transport": "mcp_only",
        "entities": [],
        "entities_total": 0,
        "entities_completed": 0,
        "entities_failed": 0,
        "entities_dual_write_ok": 0,
        "entities_with_validated_signals": 0,
        "entities_acceptance_passed": 0,
    }

    try:
        for entity in entities:
            entity_id = str(entity["entity_id"])
            entity_name = str(entity["entity_name"])
            entity_type = str(entity.get("entity_type") or "CLUB")
            tier_score = _coerce_int(entity.get("tier_score") or 75)
            max_discovery_iterations = _coerce_int(entity.get("max_discovery_iterations") or 5)
            started_at = _iso()

            try:
                result = await pipeline.run_pipeline(
                    entity_id=entity_id,
                    entity_name=entity_name,
                    entity_type=entity_type,
                    tier_score=tier_score,
                    max_discovery_iterations=max_discovery_iterations,
                )
                status = "completed"
                error = None
            except Exception as exc:  # noqa: BLE001
                result = {}
                status = "failed"
                error = str(exc)

            final_confidence = _coerce_float(result.get("final_confidence"))
            signals_validated_count = _coerce_int(
                result.get("signals_validated_count")
                or (result.get("performance_summary") or {}).get("signals_validated_count")
            )
            acceptance_passed = _extract_acceptance_passed(result)
            dual_write_ok = bool(
                result.get("dual_write_ok")
                or (result.get("persistence_status") or {}).get("dual_write_ok")
                or (result.get("artifacts") or {}).get("dual_write_ok")
            )

            entity_summary = {
                "entity_id": entity_id,
                "entity_name": entity_name,
                "entity_type": entity_type,
                "tier_score": tier_score,
                "max_discovery_iterations": max_discovery_iterations,
                "status": status,
                "started_at": started_at,
                "final_confidence": final_confidence,
                "signals_validated_count": signals_validated_count,
                "acceptance_passed": acceptance_passed,
                "dual_write_ok": dual_write_ok,
                "run_report_path": _extract_report_path(result),
            }
            if error is not None:
                entity_summary["error"] = error

            summary["entities"].append(entity_summary)
            summary["entities_total"] += 1
            if status == "completed":
                summary["entities_completed"] += 1
            else:
                summary["entities_failed"] += 1
            if dual_write_ok:
                summary["entities_dual_write_ok"] += 1
            if signals_validated_count > 0:
                summary["entities_with_validated_signals"] += 1
            if acceptance_passed:
                summary["entities_acceptance_passed"] += 1
    finally:
        close_fn = getattr(pipeline, "close", None)
        if callable(close_fn):
            await close_fn()

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(summary, indent=2, default=str), encoding="utf-8")

    md_path = output_path.with_suffix(".md")
    md_lines = [
        "# V5 Two-Entity Smoke",
        "",
        f"Run at: {summary['run_at']}",
        f"Strict MCP: {summary['strict_v5_mcp']}",
        f"Entities completed: {summary['entities_completed']}/{summary['entities_total']}",
        f"Validated signals: {summary['entities_with_validated_signals']}",
        f"Acceptance passed: {summary['entities_acceptance_passed']}",
        "",
    ]
    for entity in summary["entities"]:
        md_lines.extend(
            [
                f"## {entity['entity_name']}",
                f"- Entity ID: {entity['entity_id']}",
                f"- Status: {entity['status']}",
                f"- Final confidence: {entity['final_confidence']}",
                f"- Validated signals: {entity['signals_validated_count']}",
                f"- Acceptance passed: {entity['acceptance_passed']}",
                f"- Dual write ok: {entity['dual_write_ok']}",
                f"- Run report: {entity['run_report_path'] or 'n/a'}",
                "",
            ]
        )
    md_path.write_text("\n".join(md_lines).rstrip() + "\n", encoding="utf-8")

    print(str(output_path))
    print(str(md_path))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Run a two-entity strict v5 smoke")
    parser.add_argument("--output", default="")
    parser.add_argument(
        "--entity",
        action="append",
        nargs=4,
        metavar=("ENTITY_ID", "ENTITY_NAME", "ENTITY_TYPE", "TIER_SCORE"),
        help="Add an entity as: id name type tier_score",
    )
    args = parser.parse_args()

    if args.output:
        output = Path(args.output)
    else:
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        output = ROOT / "backend" / "data" / "v5_smokes" / f"v5_two_entity_smoke_{ts}.json"

    if args.entity:
        entities = [
            {
                "entity_id": entity_id,
                "entity_name": entity_name,
                "entity_type": entity_type,
                "tier_score": int(tier_score),
                "max_discovery_iterations": 5,
            }
            for entity_id, entity_name, entity_type, tier_score in args.entity
        ]
    else:
        entities = DEFAULT_TWO_ENTITY_BATCH

    return asyncio.run(run_smoke(entities, output))


if __name__ == "__main__":
    raise SystemExit(main())
