#!/usr/bin/env python3
"""Run deterministic + shadow-unbounded pipeline calibration across templates."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any


def _load_template_ids() -> list[str]:
    root = Path(__file__).resolve().parent.parent
    sys.path.insert(0, str(root))
    from backend.template_loader import TemplateLoader

    loader = TemplateLoader()
    template_ids = sorted({tid for tid in loader.get_all_templates().keys() if tid})
    return template_ids or ["yellow_panther_agency"]


def _tail_text(value: Any, lines: int = 30) -> str:
    if value is None:
        return ""
    if isinstance(value, bytes):
        text = value.decode("utf-8", errors="replace")
    else:
        text = str(value)
    return "\n".join(text.splitlines()[-lines:])


def main() -> int:
    parser = argparse.ArgumentParser(description="Run shadow calibration per template")
    parser.add_argument("--entity-id", default="coventry-city-fc")
    parser.add_argument("--entity-name", default="Coventry City FC")
    parser.add_argument("--entity-type", default="CLUB")
    parser.add_argument("--templates", default="all", help="comma list or 'all'")
    parser.add_argument("--max-iterations", type=int, default=6)
    parser.add_argument("--shadow-multiplier", type=float, default=3.0)
    parser.add_argument("--per-run-timeout-seconds", type=int, default=1200)
    parser.add_argument("--out", default="")
    args = parser.parse_args()

    root = Path(__file__).resolve().parent.parent
    if args.templates.strip().lower() == "all":
        templates = _load_template_ids()
    else:
        templates = [t.strip() for t in args.templates.split(",") if t.strip()]

    env = os.environ.copy()
    env["PIPELINE_USE_CANONICAL_ORCHESTRATOR"] = "false"
    env["PIPELINE_SHADOW_UNBOUNDED_ENABLED"] = "true"
    env["PIPELINE_SHADOW_UNBOUNDED_PARALLEL"] = "true"
    env["PIPELINE_SHADOW_UNBOUNDED_ITERATION_MULTIPLIER"] = str(args.shadow_multiplier)
    env["PIPELINE_FORCE_BRIGHTDATA"] = "true"
    env["BRIGHTDATA_FORCE_ONLY"] = "true"
    env["BRIGHTDATA_GENEROUS_RETRY"] = "true"

    summary: Dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "entity_id": args.entity_id,
        "entity_name": args.entity_name,
        "entity_type": args.entity_type,
        "max_iterations": args.max_iterations,
        "shadow_multiplier": args.shadow_multiplier,
        "runs": [],
    }

    run_script = root / "run_fixed_dossier_pipeline.py"

    for template_id in templates:
        cmd = [
            "python3",
            str(run_script),
            "--entity-id", args.entity_id,
            "--entity-name", args.entity_name,
            "--entity-type", args.entity_type,
            "--max-discovery-iterations", str(args.max_iterations),
            "--template-id", template_id,
        ]
        try:
            proc = subprocess.run(
                cmd,
                cwd=str(root),
                env=env,
                capture_output=True,
                text=True,
                timeout=max(60, int(args.per_run_timeout_seconds)),
            )
            returncode = proc.returncode
            stdout_tail = _tail_text(proc.stdout, lines=30)
            stderr_tail = _tail_text(proc.stderr, lines=30)
        except subprocess.TimeoutExpired as timeout_error:
            returncode = 124
            stdout_tail = _tail_text(timeout_error.stdout, lines=30)
            stderr_tail = _tail_text(timeout_error.stderr, lines=30)
        run_row = {
            "template_id": template_id,
            "returncode": returncode,
            "stdout_tail": stdout_tail,
            "stderr_tail": stderr_tail,
        }
        summary["runs"].append(run_row)

    if args.out:
        out_path = Path(args.out)
    else:
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        out_path = root / "backend" / "data" / "dossiers" / "run_reports" / f"template_shadow_calibration_{ts}.json"

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(str(out_path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
