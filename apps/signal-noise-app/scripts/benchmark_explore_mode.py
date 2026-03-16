#!/usr/bin/env python3
"""Run repeated explore-mode pipeline runs and enforce acceptance gates."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List
from urllib.parse import urlparse

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


def _normalize_domain(candidate: str | None) -> str:
    value = str(candidate or "").strip().lower()
    if not value:
        return ""
    if value.startswith(("http://", "https://")):
        host = urlparse(value).netloc.lower()
    else:
        host = value.split("/", 1)[0].lower()
    if host.startswith("www."):
        host = host[4:]
    return host


def evaluate_explore_mode_gate(
    run_summary: Dict[str, Any],
    *,
    baseline_confidence: float,
    target_confidence: float,
    expected_domain: str,
) -> Dict[str, Any]:
    confidence = float(run_summary.get("discovery_confidence") or 0.0)
    selected_url = str(run_summary.get("official_site_selected_url") or "").strip()
    selected_domain = _normalize_domain(selected_url)
    expected_domain_norm = _normalize_domain(expected_domain)
    domain_match = bool(selected_domain and expected_domain_norm and selected_domain.endswith(expected_domain_norm))

    dead_end = bool(run_summary.get("official_site_dead_end", False))
    no_progress_chain = int(run_summary.get("official_site_no_progress_chain") or 0)

    reasons: List[str] = []
    if confidence < float(baseline_confidence):
        reasons.append(f"confidence_below_baseline:{confidence:.3f}<{baseline_confidence:.3f}")
    if confidence < float(target_confidence):
        reasons.append(f"confidence_below_target:{confidence:.3f}<{target_confidence:.3f}")
    if not domain_match:
        reasons.append(f"official_site_domain_mismatch:{selected_domain or 'missing'}!={expected_domain_norm}")
    if dead_end:
        reasons.append("official_site_dead_end_detected")

    return {
        "passed": len(reasons) == 0,
        "reasons": reasons,
        "confidence": confidence,
        "baseline_confidence": float(baseline_confidence),
        "target_confidence": float(target_confidence),
        "selected_url": selected_url,
        "selected_domain": selected_domain,
        "expected_domain": expected_domain_norm,
        "domain_match": domain_match,
        "official_site_dead_end": dead_end,
        "official_site_no_progress_chain": no_progress_chain,
    }


async def _run_benchmark_once(
    *,
    entity_id: str,
    entity_name: str,
    expected_domain: str,
    baseline_confidence: float,
    target_confidence: float,
    max_iterations: int,
    template_id: str,
) -> Dict[str, Any]:
    from run_fixed_dossier_pipeline import FixedDossierFirstPipeline

    pipeline = FixedDossierFirstPipeline()
    try:
        summary = await pipeline.run_pipeline(
            entity_id=entity_id,
            entity_name=entity_name,
            tier_score=75,
            max_discovery_iterations=max_iterations,
            template_id=template_id,
        )
    finally:
        await pipeline.close()

    gate = evaluate_explore_mode_gate(
        summary,
        baseline_confidence=baseline_confidence,
        target_confidence=target_confidence,
        expected_domain=expected_domain,
    )

    lane_statuses = summary.get("official_site_lane_statuses") or {}
    if not isinstance(lane_statuses, dict):
        lane_statuses = {}

    return {
        "entity": entity_id,
        "discovery_confidence": float(summary.get("discovery_confidence") or 0.0),
        "official_site_selected_url": summary.get("official_site_selected_url"),
        "official_site_lane_statuses": lane_statuses,
        "official_site_dead_end": bool(summary.get("official_site_dead_end", False)),
        "official_site_no_progress_chain": int(summary.get("official_site_no_progress_chain") or 0),
        "gate": gate,
    }


async def _run_benchmark(args: argparse.Namespace) -> int:
    os.environ["DISCOVERY_RUN_MODE"] = "explore"

    reports: List[Dict[str, Any]] = []
    for run_idx in range(1, args.runs + 1):
        report = await _run_benchmark_once(
            entity_id=args.entity,
            entity_name=args.entity_name,
            expected_domain=args.expected_domain,
            baseline_confidence=args.baseline_confidence,
            target_confidence=args.target_confidence,
            max_iterations=args.max_iterations,
            template_id=args.template_id,
        )
        report["run"] = run_idx
        reports.append(report)

    gate_pass_count = sum(1 for report in reports if report.get("gate", {}).get("passed"))
    aggregate = {
        "entity": args.entity,
        "runs": args.runs,
        "passes": gate_pass_count,
        "failures": args.runs - gate_pass_count,
        "all_passed": gate_pass_count == args.runs,
        "reports": reports,
    }

    output = json.dumps(aggregate, indent=2)
    print(output)

    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(output + "\n")

    return 0 if aggregate["all_passed"] else 1


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Benchmark explore-mode discovery acceptance gates")
    parser.add_argument("--entity", default="coventry-city-fc")
    parser.add_argument("--entity-name", default="Coventry City FC")
    parser.add_argument("--expected-domain", default="ccfc.co.uk")
    parser.add_argument("--runs", type=int, default=3)
    parser.add_argument("--baseline-confidence", type=float, default=0.50)
    parser.add_argument("--target-confidence", type=float, default=0.65)
    parser.add_argument("--max-iterations", type=int, default=15)
    parser.add_argument("--template-id", default="yellow_panther_agency")
    parser.add_argument("--output", default="")
    return parser


def main() -> None:
    parser = _build_parser()
    args = parser.parse_args()
    if args.runs < 1:
        raise SystemExit("--runs must be >= 1")
    raise SystemExit(asyncio.run(_run_benchmark(args)))


if __name__ == "__main__":
    main()
