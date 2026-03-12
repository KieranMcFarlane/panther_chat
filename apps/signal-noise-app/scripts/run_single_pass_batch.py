#!/usr/bin/env python3
"""Run single-pass discovery for multiple entities sequentially."""

from __future__ import annotations

import argparse
import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List


SCRIPT_PATH = Path(__file__).resolve()
APP_ROOT = SCRIPT_PATH.parents[1]
REPO_ROOT = SCRIPT_PATH.parents[3]
BACKEND_DOSSIERS = APP_ROOT / "backend" / "data" / "dossiers"

import sys

for p in (REPO_ROOT, APP_ROOT, APP_ROOT / "backend"):
    p_str = str(p)
    if p_str not in sys.path:
        sys.path.insert(0, p_str)
scripts_path = str(SCRIPT_PATH.parent)
if scripts_path not in sys.path:
    sys.path.insert(0, scripts_path)


from run_single_pass_entity import run_single_pass, _build_parser as _entity_parser  # type: ignore


def _load_entities(path: Path) -> List[Dict[str, str]]:
    if not path.exists():
        raise FileNotFoundError(f"Entities file not found: {path}")

    suffix = path.suffix.lower()
    if suffix in {".json", ".jsonl"}:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict) and isinstance(data.get("entities"), list):
            data = data["entities"]
        if not isinstance(data, list):
            raise ValueError("JSON entity input must be a list or {\"entities\": [...]} object")
        entities = []
        for row in data:
            if not isinstance(row, dict) or "entity_id" not in row:
                raise ValueError("Each JSON entity row must include entity_id")
            entities.append({"entity_id": str(row["entity_id"]), "entity_name": str(row.get("entity_name") or "")})
        return entities

    entities = []
    for line in path.read_text(encoding="utf-8").splitlines():
        raw = line.strip()
        if not raw or raw.startswith("#"):
            continue
        parts = [p.strip() for p in raw.split(",", 1)]
        entity_id = parts[0]
        entity_name = parts[1] if len(parts) > 1 else ""
        entities.append({"entity_id": entity_id, "entity_name": entity_name})
    return entities


async def _run_batch(args: argparse.Namespace) -> Dict[str, Any]:
    entities = _load_entities(Path(args.entities_file))
    if args.limit and args.limit > 0:
        entities = entities[: args.limit]

    parser = _entity_parser()
    results: List[Dict[str, Any]] = []

    for entity in entities:
        cli_args = [
            "--entity-id", entity["entity_id"],
            "--profile", args.profile,
            "--template-id", args.template_id,
            "--output-dir", args.output_dir,
            "--min-confidence", str(args.min_confidence),
            "--strict-gate", "true" if args.strict_gate else "false",
            "--fetch-timeout-seconds", str(args.fetch_timeout_seconds),
        ]
        if entity.get("entity_name"):
            cli_args.extend(["--entity-name", entity["entity_name"]])

        entity_args = parser.parse_args(cli_args)
        try:
            summary = await run_single_pass(entity_args)
            results.append(summary)
        except Exception as exc:
            results.append(
                {
                    "entity_id": entity["entity_id"],
                    "entity_name": entity.get("entity_name") or entity["entity_id"],
                    "artifact": None,
                    "final_confidence": 0.0,
                    "evaluation_mode": "unknown",
                    "last_decision": "NO_PROGRESS",
                    "signals_count": 0,
                    "promotion_gate_passed": False,
                    "promotion_gate_reasons": [f"execution_error:{exc.__class__.__name__}"],
                    "parse_path": "not_started",
                    "run_profile": args.profile,
                }
            )

    promoted = [r for r in results if r.get("promotion_gate_passed")]
    held = [r for r in results if not r.get("promotion_gate_passed")]

    summary_doc = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "run_mode": "single_pass",
        "strict_gate": bool(args.strict_gate),
        "min_confidence": float(args.min_confidence),
        "total_entities": len(results),
        "promoted_count": len(promoted),
        "held_count": len(held),
        "results": results,
    }

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    entities_stem = Path(args.entities_file).stem
    out_path = Path(args.output_dir) / f"single_pass_batch_index_{entities_stem}_{stamp}.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(summary_doc, indent=2), encoding="utf-8")

    summary_doc["artifact"] = str(out_path.relative_to(REPO_ROOT)) if out_path.is_absolute() else str(out_path)
    return summary_doc


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run single-pass discovery batch sequentially")
    parser.add_argument("--entities-file", required=True, help=".txt/.csv/.json entity list")
    parser.add_argument("--profile", choices=["continuous", "test"], default="test")
    parser.add_argument("--template-id", default="yellow_panther_agency")
    parser.add_argument("--output-dir", default=str(BACKEND_DOSSIERS))
    parser.add_argument("--min-confidence", type=float, default=0.55)
    parser.add_argument(
        "--strict-gate",
        type=lambda v: str(v).strip().lower() in {"1", "true", "yes", "on"},
        default=True,
    )
    parser.add_argument("--fetch-timeout-seconds", type=float, default=8.0)
    parser.add_argument("--limit", type=int, default=0)
    return parser


def main() -> None:
    args = _build_parser().parse_args()
    summary = asyncio.run(_run_batch(args))
    print(json.dumps({
        "artifact": summary.get("artifact"),
        "total_entities": summary.get("total_entities"),
        "promoted_count": summary.get("promoted_count"),
        "held_count": summary.get("held_count"),
    }, indent=2))


if __name__ == "__main__":
    main()
