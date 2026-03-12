#!/usr/bin/env python3
"""Run deterministic single-pass discovery for multiple entities sequentially."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

from dotenv import load_dotenv

from run_single_pass_entity import _run as run_single_entity


def _sanitize(value: str) -> str:
    return "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in value.strip().lower()).strip("-")


def _load_entities(path: Path) -> List[Dict[str, Any]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError("Entity batch input must be a JSON list")
    entities: List[Dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        entity_id = str(item.get("entity_id") or "").strip()
        entity_name = str(item.get("entity_name") or "").strip()
        template_id = str(item.get("template_id") or "yellow_panther_agency").strip()
        if not entity_id or not entity_name:
            continue
        entities.append({
            "entity_id": entity_id,
            "entity_name": entity_name,
            "template_id": template_id,
        })
    return entities


async def _run_batch(input_path: Path, min_confidence: float) -> Dict[str, Any]:
    os.environ.setdefault("DISCOVERY_RUN_MODE", "single_pass")

    entities = _load_entities(input_path)
    results: List[Dict[str, Any]] = []

    for entity in entities:
        summary = await run_single_entity(
            entity_id=entity["entity_id"],
            entity_name=entity["entity_name"],
            template_id=entity["template_id"],
            min_confidence=min_confidence,
            strict_gate=True,
        )
        verdict = "PROMOTE_PHASE1_PLUS" if summary.get("promotion_gate_passed") else "HOLD_SINGLE_PASS"
        results.append({
            "entity_id": summary.get("entity_id"),
            "entity_name": summary.get("entity_name"),
            "status": "completed",
            "gate_verdict": verdict,
            "final_confidence": summary.get("final_confidence"),
            "evaluation_mode": summary.get("evaluation_mode"),
            "parse_path": summary.get("parse_path"),
            "run_profile": summary.get("run_profile"),
            "artifact_path": summary.get("artifact"),
            "promotion_gate_reasons": summary.get("promotion_gate_reasons") or [],
        })

    promoted = [item for item in results if item["gate_verdict"] == "PROMOTE_PHASE1_PLUS"]
    held = [item for item in results if item["gate_verdict"] == "HOLD_SINGLE_PASS"]

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    out_dir = Path("backend/data/dossiers")
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"single_pass_batch_index_{_sanitize(input_path.stem)}_{timestamp}.json"

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "run_mode": "single_pass",
        "strict_gate": True,
        "min_confidence": min_confidence,
        "total_entities": len(results),
        "promoted_count": len(promoted),
        "held_count": len(held),
        "results": results,
    }
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    return {
        "artifact": str(out_path),
        "total_entities": len(results),
        "promoted_count": len(promoted),
        "held_count": len(held),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to JSON list of entities")
    parser.add_argument(
        "--min-confidence",
        type=float,
        default=float(os.getenv("DISCOVERY_PROMOTION_MIN_CONFIDENCE", "0.55")),
    )
    args = parser.parse_args()

    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    summary = asyncio.run(_run_batch(Path(args.input), args.min_confidence))
    print("SINGLE_PASS_BATCH_SUMMARY=" + json.dumps(summary))


if __name__ == "__main__":
    main()
