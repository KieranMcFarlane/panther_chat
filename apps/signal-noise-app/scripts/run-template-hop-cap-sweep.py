#!/usr/bin/env python3
"""Run template x hop-cap sweep and collect metrics from run reports."""

from __future__ import annotations

import argparse
import json
import os
import re
import traceback
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parent.parent


def _load_templates(value: str) -> List[str]:
    if value.strip().lower() != "all":
        return [x.strip() for x in value.split(",") if x.strip()]
    sys.path.insert(0, str(ROOT))
    from backend.template_loader import TemplateLoader

    loader = TemplateLoader()
    return sorted({tid for tid in loader.get_all_templates().keys() if tid})


def _parse_caps(value: str) -> List[int]:
    caps = []
    for token in value.split(","):
        token = token.strip()
        if not token:
            continue
        caps.append(max(1, int(token)))
    return sorted(set(caps))


def _extract_run_report_rel(log_text: str) -> str | None:
    matches = re.findall(r"Run report saved:\s*(backend/data/dossiers/run_reports/[^\s]+\.json)", log_text)
    return matches[-1] if matches else None


def _read_json(path: Path) -> Dict[str, Any]:
    try:
        return json.loads(path.read_text())
    except Exception:
        return {}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--templates", default="all")
    parser.add_argument("--hop-caps", default="1,2,3,4,5")
    parser.add_argument("--entity-id", default="coventry-city-fc")
    parser.add_argument("--entity-name", default="Coventry City FC")
    parser.add_argument("--entity-type", default="CLUB")
    parser.add_argument("--timeout-seconds", type=int, default=1800)
    parser.add_argument("--out", required=True)
    parser.add_argument("--shadow-enabled", default="true")
    parser.add_argument("--max-workers", type=int, default=5)
    args = parser.parse_args()

    templates = _load_templates(args.templates)
    caps = _parse_caps(args.hop_caps)

    out_path = Path(args.out)
    if not out_path.is_absolute():
        out_path = ROOT / out_path
    out_path.parent.mkdir(parents=True, exist_ok=True)

    log_dir = ROOT / "tmp" / f"template-hop-cap-sweep-{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
    log_dir.mkdir(parents=True, exist_ok=True)

    jobs = []
    for template_id in templates:
        for cap in caps:
            jobs.append((template_id, cap))

    def _run_job(template_id: str, cap: int) -> Dict[str, Any]:
            cmd = [
                "python3",
                "run_fixed_dossier_pipeline.py",
                "--entity-id",
                args.entity_id,
                "--entity-name",
                args.entity_name,
                "--entity-type",
                args.entity_type,
                "--max-discovery-iterations",
                str(cap),
                "--template-id",
                template_id,
            ]
            env = os.environ.copy()
            env.setdefault("PIPELINE_USE_CANONICAL_ORCHESTRATOR", "false")
            env.setdefault("PIPELINE_FORCE_BRIGHTDATA", "true")
            env.setdefault("BRIGHTDATA_FORCE_ONLY", "true")
            env.setdefault("BRIGHTDATA_GENEROUS_RETRY", "true")
            env.setdefault("DOSSIER_USE_CACHE", "true")
            env.setdefault("DOSSIER_COLLECT_PARALLEL_LEADERSHIP", "false")
            env.setdefault("DOSSIER_PARALLEL_COLLECTION_TIMEOUT_SECONDS", "45")
            env.setdefault("DOSSIER_SECTION_GENERATION_TIMEOUT_SECONDS", "35")
            env.setdefault("DISCOVERY_EVALUATION_QUERY_TIMEOUT_SECONDS", "18")
            env.setdefault("DISCOVERY_EVALUATION_TIMEOUT_MAX_RETRIES", "1")
            env["PIPELINE_SHADOW_UNBOUNDED_ENABLED"] = str(args.shadow_enabled).lower()
            env.setdefault("PIPELINE_SHADOW_UNBOUNDED_PARALLEL", "true")
            env.setdefault("PIPELINE_SHADOW_UNBOUNDED_ITERATION_MULTIPLIER", "3.0")

            started = datetime.now(timezone.utc)
            proc_returncode = -1
            log_text = ""
            error: str | None = None
            try:
                proc = subprocess.run(
                    cmd,
                    cwd=str(ROOT),
                    env=env,
                    capture_output=True,
                    text=True,
                    timeout=max(60, args.timeout_seconds),
                )
                proc_returncode = proc.returncode
                log_text = (proc.stdout or "") + "\n" + (proc.stderr or "")
            except subprocess.TimeoutExpired as exc:
                proc_returncode = 124
                out = exc.stdout.decode(errors="ignore") if isinstance(exc.stdout, bytes) else (exc.stdout or "")
                err = exc.stderr.decode(errors="ignore") if isinstance(exc.stderr, bytes) else (exc.stderr or "")
                log_text = out + "\n" + err + f"\n[timeout] command exceeded {max(60, args.timeout_seconds)}s"
                error = f"timeout:{max(60, args.timeout_seconds)}s"
            except Exception as exc:  # noqa: BLE001
                proc_returncode = 1
                error = f"exception:{exc.__class__.__name__}"
                log_text = f"[exception] {exc}\n{traceback.format_exc()}"
            ended = datetime.now(timezone.utc)
            log_path = log_dir / f"{template_id}_cap{cap}.log"
            log_path.write_text(log_text)

            run_report_rel = _extract_run_report_rel(log_text)
            report = _read_json(ROOT / run_report_rel) if run_report_rel else {}
            metrics = report.get("metrics") or {}
            taxonomy = metrics.get("failure_taxonomy") or {}
            gate = report.get("acceptance_gate") or {}

            row = {
                "template_id": template_id,
                "hop_cap": cap,
                "exit_code": proc_returncode,
                "started_at": started.isoformat(),
                "ended_at": ended.isoformat(),
                "runtime_seconds": round((ended - started).total_seconds(), 3),
                "log_path": str(log_path.relative_to(ROOT)),
                "run_report_path": run_report_rel,
                "final_confidence": metrics.get("final_confidence"),
                "signals_discovered": metrics.get("signals_discovered"),
                "gate_passed": gate.get("passed"),
                "gate_reasons": gate.get("reasons") or [],
                "llm_last_status": metrics.get("llm_last_status"),
                "parse_path": metrics.get("parse_path"),
                "schema_gate_fallback": int(taxonomy.get("schema_gate_fallback") or 0),
                "low_signal_content": int(taxonomy.get("low_signal_content") or 0),
                "import_context_failure": int(taxonomy.get("import_context_failure") or 0),
                "url_timeout_hits": len(re.findall(r"URL resolution timed out", log_text)),
                "low_signal_hits": len(re.findall(r"Low-yield content detected", log_text)),
                "error": error,
            }
            return row

    rows: List[Dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=max(1, args.max_workers)) as pool:
        futures = [pool.submit(_run_job, template_id, cap) for template_id, cap in jobs]
        for future in as_completed(futures):
            try:
                row = future.result()
            except Exception as exc:  # noqa: BLE001
                row = {
                    "template_id": "unknown",
                    "hop_cap": -1,
                    "exit_code": 1,
                    "started_at": datetime.now(timezone.utc).isoformat(),
                    "ended_at": datetime.now(timezone.utc).isoformat(),
                    "runtime_seconds": 0.0,
                    "log_path": None,
                    "run_report_path": None,
                    "final_confidence": None,
                    "signals_discovered": None,
                    "gate_passed": False,
                    "gate_reasons": ["sweep_worker_exception"],
                    "llm_last_status": None,
                    "parse_path": None,
                    "schema_gate_fallback": 0,
                    "low_signal_content": 0,
                    "import_context_failure": 0,
                    "url_timeout_hits": 0,
                    "low_signal_hits": 0,
                    "error": f"future_exception:{exc.__class__.__name__}",
                }
            rows.append(row)
            print(
                f"[{row['template_id']} cap={row['hop_cap']}] exit={row['exit_code']} gate={row['gate_passed']} "
                f"conf={row['final_confidence']} signals={row['signals_discovered']}"
            )

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "entity_id": args.entity_id,
        "entity_name": args.entity_name,
        "entity_type": args.entity_type,
        "templates": templates,
        "hop_caps": caps,
        "rows": rows,
    }
    out_path.write_text(json.dumps(payload, indent=2))
    print(str(out_path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
