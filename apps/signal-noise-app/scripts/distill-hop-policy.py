#!/usr/bin/env python3
"""Distill deterministic hop policy from hop-trace artifacts."""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List


def _safe_list(value: Any) -> List[Dict[str, Any]]:
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    return []


def main() -> int:
    parser = argparse.ArgumentParser(description="Distill hop policy from shadow traces")
    parser.add_argument("--input-dir", default="backend/data/dossiers")
    parser.add_argument("--output", default="")
    parser.add_argument("--limit", type=int, default=50)
    args = parser.parse_args()

    input_dir = Path(args.input_dir)
    files = sorted(input_dir.glob("*_hop_trace_*.json"), reverse=True)[: max(1, args.limit)]

    grouped: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
        "runs": 0,
        "deterministic_hops": Counter(),
        "shadow_hops": Counter(),
        "deterministic_accept_hops": Counter(),
        "shadow_accept_hops": Counter(),
        "domains": Counter(),
    })

    for f in files:
        payload = json.loads(f.read_text())
        template_id = str(payload.get("template_id") or "unknown_template")
        group = grouped[template_id]
        group["runs"] += 1

        lanes = payload.get("lanes") if isinstance(payload.get("lanes"), dict) else {}
        det_hops = _safe_list(((lanes.get("deterministic") or {}).get("hop_timings")))
        sh_hops = _safe_list(((lanes.get("shadow_unbounded") or {}).get("hop_timings")))

        for hop in det_hops:
            hop_type = str(hop.get("hop_type") or "unknown")
            group["deterministic_hops"][hop_type] += 1
            if str(hop.get("decision") or "").upper() in {"ACCEPT", "WEAK_ACCEPT"}:
                group["deterministic_accept_hops"][hop_type] += 1
            domain = str(hop.get("selected_domain") or "").strip().lower()
            if domain:
                group["domains"][domain] += 1

        for hop in sh_hops:
            hop_type = str(hop.get("hop_type") or "unknown")
            group["shadow_hops"][hop_type] += 1
            if str(hop.get("decision") or "").upper() in {"ACCEPT", "WEAK_ACCEPT"}:
                group["shadow_accept_hops"][hop_type] += 1
            domain = str(hop.get("selected_domain") or "").strip().lower()
            if domain:
                group["domains"][domain] += 1

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_files": [str(f) for f in files],
        "templates": {},
    }

    for template_id, group in grouped.items():
        shadow_ranked = [k for k, _ in group["shadow_accept_hops"].most_common()]
        if not shadow_ranked:
            shadow_ranked = [k for k, _ in group["shadow_hops"].most_common()]

        output["templates"][template_id] = {
            "runs": group["runs"],
            "recommended_hop_sequence": shadow_ranked,
            "deterministic_hop_counts": dict(group["deterministic_hops"].most_common()),
            "shadow_hop_counts": dict(group["shadow_hops"].most_common()),
            "deterministic_accept_counts": dict(group["deterministic_accept_hops"].most_common()),
            "shadow_accept_counts": dict(group["shadow_accept_hops"].most_common()),
            "top_domains": dict(group["domains"].most_common(15)),
        }

    if args.output:
        out_path = Path(args.output)
    else:
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        out_path = input_dir / "run_reports" / f"distilled_hop_policy_{ts}.json"

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(str(out_path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
