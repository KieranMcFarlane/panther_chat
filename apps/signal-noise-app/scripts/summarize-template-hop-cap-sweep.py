#!/usr/bin/env python3
"""Summarize hop-cap sweep and generate per-template recommendations."""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

import sys
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from template_hop_optimizer import CapThresholds, compute_objective_score, select_recommended_cap


def _avg(values: List[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--in", dest="in_path", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--md-out", default="")
    parser.add_argument("--min-confidence", type=float, default=0.55)
    parser.add_argument("--min-signals", type=int, default=2)
    args = parser.parse_args()

    in_path = Path(args.in_path)
    if not in_path.is_absolute():
        in_path = ROOT / in_path
    payload = json.loads(in_path.read_text())
    rows = payload.get("rows") or []

    grouped: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for row in rows:
        grouped[str(row.get("template_id") or "unknown")].append(dict(row))

    thresholds = CapThresholds(min_confidence=args.min_confidence, min_signals=args.min_signals)
    recommendations = []

    for template_id, template_rows in sorted(grouped.items()):
        for row in template_rows:
            row["objective_score"] = compute_objective_score(row)
        rec = select_recommended_cap(template_rows, thresholds=thresholds)
        scores = [float(r.get("objective_score") or 0.0) for r in template_rows]
        gate_rate = _avg([1.0 if r.get("gate_passed") else 0.0 for r in template_rows])
        recommendations.append(
            {
                "template_id": template_id,
                "recommended_cap": rec.get("recommended_cap"),
                "needs_tuning": rec.get("needs_tuning"),
                "reason": rec.get("reason"),
                "best_row": rec.get("best_row"),
                "sweep_summary": {
                    "rows": len(template_rows),
                    "gate_pass_rate": round(gate_rate, 3),
                    "avg_objective_score": round(_avg(scores), 3),
                    "max_objective_score": round(max(scores) if scores else 0.0, 3),
                },
            }
        )

    out = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_sweep": str(in_path),
        "thresholds": {
            "min_confidence": thresholds.min_confidence,
            "min_signals": thresholds.min_signals,
        },
        "recommendations": recommendations,
    }

    out_path = Path(args.out)
    if not out_path.is_absolute():
        out_path = ROOT / out_path
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, indent=2))
    print(str(out_path))

    md_out = args.md_out.strip()
    if md_out:
        md_path = Path(md_out)
        if not md_path.is_absolute():
            md_path = ROOT / md_path
        lines = [
            "# Template Hop Cap Recommendations",
            "",
            f"Generated: {out['generated_at']}",
            "",
            "| Template | Recommended Cap | Needs Tuning | Gate Pass Rate | Best Score | Reason |",
            "|---|---:|---:|---:|---:|---|",
        ]
        for rec in recommendations:
            best = rec.get("best_row") or {}
            lines.append(
                "| {template} | {cap} | {tune} | {rate:.3f} | {score:.3f} | {reason} |".format(
                    template=rec["template_id"],
                    cap=rec.get("recommended_cap"),
                    tune="yes" if rec.get("needs_tuning") else "no",
                    rate=float((rec.get("sweep_summary") or {}).get("gate_pass_rate") or 0.0),
                    score=float(best.get("objective_score") or 0.0),
                    reason=rec.get("reason") or "",
                )
            )
        md_path.parent.mkdir(parents=True, exist_ok=True)
        md_path.write_text("\n".join(lines) + "\n")
        print(str(md_path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
