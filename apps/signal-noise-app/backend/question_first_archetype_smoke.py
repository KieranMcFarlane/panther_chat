#!/usr/bin/env python3
"""Serial archetype smoke for the question-first runner.

Runs Arsenal, ICF, and MLC one after the other through the public
question-first dossier runner, waiting for each run to reach terminal
completed state before moving on.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Awaitable, Callable, Dict, Iterable, List, Optional

from dotenv import load_dotenv

from question_first_dossier_runner import run_question_first_dossier

logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parent.parent

DEFAULT_ARCHETYPE_BATCH: List[Dict[str, Any]] = [
    {
        "entity_id": "arsenal",
        "entity_name": "Arsenal Football Club",
        "entity_type": "SPORT_CLUB",
        "question_source_path": ROOT / "backend" / "data" / "question_sources" / "arsenal_atomic_matrix.json",
    },
    {
        "entity_id": "icf",
        "entity_name": "International Canoe Federation",
        "entity_type": "SPORT_FEDERATION",
        "question_source_path": ROOT / "backend" / "data" / "question_sources" / "icf_atomic_matrix.json",
    },
    {
        "entity_id": "major-league-cricket",
        "entity_name": "Major League Cricket",
        "entity_type": "SPORT_LEAGUE",
        "question_source_path": ROOT / "backend" / "data" / "question_sources" / "major_league_cricket_atomic_matrix.json",
    },
]


def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slugify(value: str) -> str:
    import re

    slug = re.sub(r"[^a-z0-9]+", "-", str(value or "").lower()).strip("-")
    return slug or "entity"


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


async def run_smoke(
    archetypes: Iterable[Dict[str, Any]],
    output_root: Path,
    *,
    question_first_runner: Callable[..., Awaitable[Dict[str, Any]]] = run_question_first_dossier,
    opencode_timeout_ms: int = 180000,
) -> Dict[str, Any]:
    _load_repo_envs()
    output_root.mkdir(parents=True, exist_ok=True)

    summary: Dict[str, Any] = {
        "run_at": _iso(),
        "opencode_timeout_ms": opencode_timeout_ms,
        "entities": [],
        "entities_total": 0,
        "entities_completed": 0,
        "entities_failed": 0,
        "entities_with_validated_questions": 0,
    }

    for archetype in archetypes:
        entity_id = str(archetype["entity_id"])
        entity_name = str(archetype["entity_name"])
        question_source_path = Path(archetype["question_source_path"])
        entity_output_dir = output_root / _slugify(entity_id)
        started_at = _iso()

        try:
            merged = await question_first_runner(
                question_source_path=question_source_path,
                output_dir=entity_output_dir,
                opencode_timeout_ms=opencode_timeout_ms,
            )
            status = "completed"
            error = None
        except Exception as exc:  # noqa: BLE001
            merged = {}
            status = "failed"
            error = str(exc)

        question_first_run = merged.get("question_first_run") if isinstance(merged, dict) else {}
        run_rollup = question_first_run.get("run_rollup") if isinstance(question_first_run, dict) else {}
        questions_validated = int(run_rollup.get("questions_validated") or 0)
        questions_no_signal = int(run_rollup.get("questions_no_signal") or 0)
        question_first_report = merged.get("question_first_report") if isinstance(merged, dict) else {}
        question_first_run_path = next(entity_output_dir.glob("*_question_first_run_v1.json"), None)
        question_first_dossier_path = next(entity_output_dir.glob("*_question_first_dossier.json"), None)

        entity_summary = {
            "entity_id": entity_id,
            "entity_name": entity_name,
            "entity_type": archetype.get("entity_type"),
            "question_source_path": str(question_source_path),
            "output_dir": str(entity_output_dir),
            "status": status,
            "started_at": started_at,
            "questions_validated": questions_validated,
            "questions_no_signal": questions_no_signal,
            "question_first_run_path": str(question_first_run_path) if question_first_run_path else None,
            "question_first_dossier_path": str(question_first_dossier_path) if question_first_dossier_path else None,
            "question_first_report_path": question_first_report.get("json_report_path") if isinstance(question_first_report, dict) else None,
        }
        if error is not None:
            entity_summary["error"] = error

        summary["entities"].append(entity_summary)
        summary["entities_total"] += 1
        if status == "completed":
            summary["entities_completed"] += 1
        else:
            summary["entities_failed"] += 1
        if questions_validated > 0:
            summary["entities_with_validated_questions"] += 1

    summary_path = output_root / "question_first_archetype_smoke.json"
    md_path = output_root / "question_first_archetype_smoke.md"
    summary_path.write_text(json.dumps(summary, indent=2, default=str), encoding="utf-8")

    md_lines = [
        "# Question-First Archetype Smoke",
        "",
        f"Run at: {summary['run_at']}",
        f"OpenCode timeout ms: {summary['opencode_timeout_ms']}",
        f"Entities completed: {summary['entities_completed']}/{summary['entities_total']}",
        f"Validated questions: {summary['entities_with_validated_questions']}",
        "",
    ]
    for entity in summary["entities"]:
        md_lines.extend(
            [
                f"## {entity['entity_name']}",
                f"- Entity ID: {entity['entity_id']}",
                f"- Status: {entity['status']}",
                f"- Questions validated: {entity['questions_validated']}",
                f"- Questions no signal: {entity['questions_no_signal']}",
                f"- Question-first report: {entity['question_first_report_path'] or 'n/a'}",
                "",
            ]
        )
    md_path.write_text("\n".join(md_lines).rstrip() + "\n", encoding="utf-8")

    logger.info("Question-first archetype smoke summary written to %s", summary_path)
    print(str(summary_path))
    print(str(md_path))
    return summary


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Run the serial question-first archetype smoke")
    parser.add_argument(
        "--output-root",
        default="",
        help="Directory for the smoke outputs (default: backend/data/question_first_archetype_smokes/<timestamp>)",
    )
    parser.add_argument(
        "--opencode-timeout-ms",
        type=int,
        default=180000,
        help="Per-question OpenCode timeout in milliseconds",
    )
    args = parser.parse_args(argv)

    if args.output_root:
        output_root = Path(args.output_root)
    else:
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        output_root = ROOT / "backend" / "data" / "question_first_archetype_smokes" / f"question_first_archetype_smoke_{ts}"

    asyncio.run(
        run_smoke(
            DEFAULT_ARCHETYPE_BATCH,
            output_root=output_root,
            opencode_timeout_ms=args.opencode_timeout_ms,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
