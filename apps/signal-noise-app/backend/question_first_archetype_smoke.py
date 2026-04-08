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
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Awaitable, Callable, Dict, Iterable, List, Optional

from dotenv import load_dotenv

from question_first_dossier_runner import (
    has_complete_question_first_artifacts,
    run_question_first_dossier,
)
from universal_atomic_matrix import build_universal_atomic_question_source

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


def load_archetypes_from_manifest(manifest_path: Path, *, output_root: Path) -> List[Dict[str, Any]]:
    payload = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
    entities = payload.get("entities") if isinstance(payload, dict) else None
    if not isinstance(entities, list) or not entities:
        raise ValueError("Batch manifest must contain a non-empty entities list")

    generated_source_dir = output_root / "_generated_question_sources"
    generated_source_dir.mkdir(parents=True, exist_ok=True)

    archetypes: List[Dict[str, Any]] = []
    for entity in entities:
        if not isinstance(entity, dict):
            continue
        entity_id = str(entity.get("entity_id") or "").strip()
        entity_name = str(entity.get("entity_name") or "").strip()
        entity_type = str(entity.get("entity_type") or "").strip()
        if not entity_id or not entity_name or not entity_type:
            raise ValueError("Each manifest entity must include entity_id, entity_name, and entity_type")

        provided_source_path = str(entity.get("question_source_path") or "").strip()
        if provided_source_path:
            question_source_path = Path(provided_source_path)
            if not question_source_path.is_absolute():
                question_source_path = ROOT.parent / question_source_path
        else:
            generated_path = generated_source_dir / f"{_slugify(entity_id)}_atomic_matrix.json"
            generated_path.write_text(
                json.dumps(
                    build_universal_atomic_question_source(
                        entity_type=entity_type,
                        entity_name=entity_name,
                        entity_id=entity_id,
                        preset=f"{_slugify(entity_id)}-atomic-matrix",
                        question_source_label=f"{_slugify(entity_id)}-atomic-matrix",
                    ),
                    indent=2,
                )
                + "\n",
                encoding="utf-8",
            )
            question_source_path = generated_path

        archetypes.append(
            {
                "entity_id": entity_id,
                "entity_name": entity_name,
                "entity_type": entity_type,
                "question_source_path": question_source_path,
            }
        )
    return archetypes


def load_smoke_summary(summary_path: Path) -> Dict[str, Any]:
    payload = json.loads(Path(summary_path).read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("Smoke summary must be a JSON object")
    return payload


def _resolve_repo_relative_path(value: Any) -> Path:
    path = Path(str(value or "").strip())
    if path.is_absolute():
        return path
    return ROOT.parent / path


def _entity_summary_map(summary_payload: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    entities = summary_payload.get("entities") if isinstance(summary_payload, dict) else None
    if not isinstance(entities, list):
        return {}
    result: Dict[str, Dict[str, Any]] = {}
    for entity in entities:
        if not isinstance(entity, dict):
            continue
        entity_id = str(entity.get("entity_id") or "").strip()
        if entity_id:
            result[entity_id] = entity
    return result


def _load_question_source_payload(question_source_path: Path) -> Dict[str, Any]:
    payload = json.loads(Path(question_source_path).read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("Question source must be a JSON object")
    return payload


def _write_filtered_question_source(
    *,
    source_path: Path,
    output_root: Path,
    entity_id: str,
    question_id: str,
) -> Path:
    payload = _load_question_source_payload(source_path)
    questions = payload.get("questions") if isinstance(payload.get("questions"), list) else []
    selected_questions = [question for question in questions if isinstance(question, dict) and str(question.get("question_id") or "").strip() == question_id]
    if not selected_questions:
        raise ValueError(f"Question id {question_id!r} not found in {source_path}")
    bounded_questions = []
    for question in selected_questions:
        bounded_question = dict(question)
        if question_id in {"q11_decision_owner", "q7_procurement_signal", "q2_digital_stack"}:
            bounded_question["hop_budget"] = min(max(int(question.get("hop_budget") or 1), 1), 4)
            bounded_question["evidence_extension_budget"] = min(max(int(question.get("evidence_extension_budget") or 0), 0), 1)
            if question.get("question_timeout_ms") is not None:
                bounded_question["question_timeout_ms"] = min(max(int(question.get("question_timeout_ms") or 1000), 1000), 120000)
            else:
                bounded_question["question_timeout_ms"] = 120000
            if question.get("hop_timeout_ms") is not None:
                bounded_question["hop_timeout_ms"] = min(max(int(question.get("hop_timeout_ms") or 1000), 1000), 60000)
            else:
                bounded_question["hop_timeout_ms"] = 60000
        bounded_questions.append(bounded_question)

    filtered = {
        **payload,
        "questions": bounded_questions,
        "question_count": len(bounded_questions),
        "rerun_profile": "bounded_single_question",
    }
    rerun_dir = output_root / "_rerun_question_sources"
    rerun_dir.mkdir(parents=True, exist_ok=True)
    rerun_path = rerun_dir / f"{_slugify(entity_id)}_{_slugify(question_id)}.json"
    rerun_path.write_text(json.dumps(filtered, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return rerun_path


def build_rerun_archetypes(
    archetypes: Iterable[Dict[str, Any]],
    *,
    output_root: Path,
    summary_path: Optional[Path] = None,
    rerun_failed_from: Optional[Path] = None,
    rerun_entity: Optional[str] = None,
    rerun_question: Optional[str] = None,
    skip_complete: bool = False,
) -> List[Dict[str, Any]]:
    summary_payload = None
    summary_source = rerun_failed_from or summary_path
    if summary_source is not None:
        summary_payload = load_smoke_summary(Path(summary_source))
    entity_summaries = _entity_summary_map(summary_payload or {})
    selected: List[Dict[str, Any]] = []

    for archetype in archetypes:
        entity_id = str(archetype.get("entity_id") or "").strip()
        if not entity_id:
            continue
        if rerun_entity and entity_id != rerun_entity:
            continue

        source_entry = entity_summaries.get(entity_id)
        if summary_payload is not None and rerun_failed_from is not None:
            if not source_entry or str(source_entry.get("status") or "").strip() != "failed":
                continue

        question_source_path = Path(archetype.get("question_source_path") or "")
        if not question_source_path.is_absolute():
            question_source_path = _resolve_repo_relative_path(question_source_path)

        if skip_complete:
            source_payload = {
                "entity_id": entity_id,
                "entity_name": archetype.get("entity_name"),
                "preset": archetype.get("preset"),
                "question_source_label": archetype.get("question_source_label"),
            }
            if has_complete_question_first_artifacts(output_dir=Path(output_root) / _slugify(entity_id), source_payload=source_payload):
                continue

        if rerun_question:
            allowed_questions = None
            if source_entry:
                for key in ("failed_questions", "questions_failed", "rerun_questions"):
                    values = source_entry.get(key)
                    if isinstance(values, list) and values:
                        allowed_questions = {str(value).strip() for value in values if str(value or "").strip()}
                        break
                if allowed_questions is not None and rerun_question not in allowed_questions:
                    continue
            question_source_path = _write_filtered_question_source(
                source_path=question_source_path,
                output_root=Path(output_root),
                entity_id=entity_id,
                question_id=rerun_question,
            )

        selected.append({
            **dict(archetype),
            "question_source_path": question_source_path,
        })

    return selected


async def backfill_dossiers_from_summary(
    *,
    summary_path: Path,
    output_root: Path,
    question_first_runner: Callable[..., Awaitable[Dict[str, Any]]] = run_question_first_dossier,
    opencode_timeout_ms: int = 180000,
) -> Dict[str, Any]:
    summary_payload = load_smoke_summary(summary_path)
    backfilled = 0
    skipped = 0
    errors: List[Dict[str, Any]] = []
    for entity in summary_payload.get("entities") if isinstance(summary_payload, dict) else []:
        if not isinstance(entity, dict):
            continue
        question_first_run_path = entity.get("question_first_run_path")
        question_first_dossier_path = entity.get("question_first_dossier_path")
        if not question_first_run_path:
            skipped += 1
            continue
        entity_id = str(entity.get("entity_id") or "").strip()
        entity_name = str(entity.get("entity_name") or entity_id or "entity").strip()
        question_source_path = _resolve_repo_relative_path(entity.get("question_source_path") or "")
        entity_output_dir = Path(output_root) / _slugify(entity_id or entity_name)
        dossier_path = next(entity_output_dir.glob("*_question_first_dossier.json"), None)
        if question_first_dossier_path and Path(str(question_first_dossier_path)).exists():
            skipped += 1
            continue
        if dossier_path and dossier_path.exists():
            skipped += 1
            continue
        await question_first_runner(
            question_source_path=question_source_path,
            output_dir=entity_output_dir,
            question_first_run_path=Path(str(question_first_run_path)),
            opencode_timeout_ms=opencode_timeout_ms,
        )
        backfilled += 1
    return {
        "summary_path": str(summary_path),
        "output_root": str(output_root),
        "entities_backfilled": backfilled,
        "entities_skipped": skipped,
        "errors": errors,
    }


def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slugify(value: str) -> str:
    import re

    slug = re.sub(r"[^a-z0-9]+", "-", str(value or "").lower()).strip("-")
    return slug or "entity"


def _empty_validation_buckets() -> Dict[str, int]:
    return {"validated": 0, "no_signal": 0, "provisional": 0, "pending": 0}


def _merge_validation_totals(target: Dict[str, Dict[str, int]], source: Dict[str, Dict[str, int]]) -> None:
    for key, counts in (source or {}).items():
        bucket = target.setdefault(str(key), _empty_validation_buckets())
        for state, value in (counts or {}).items():
            bucket[state] = int(bucket.get(state, 0)) + int(value or 0)


def _merge_path_counts(target: Dict[str, int], source: Dict[str, int]) -> None:
    for key, value in (source or {}).items():
        target[str(key)] = int(target.get(str(key), 0)) + int(value or 0)


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
        "entity_runtime_seconds": {},
        "question_runtime_seconds": {},
        "validation_by_question": {},
        "validation_by_entity_type": {},
        "deterministic_path_counts": {},
        "retrieval_path_counts": {},
        "baseline_features": {
            "enrichment_enabled": False,
            "connections_graph_enrichment_enabled": False,
        },
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
        question_first_meta = merged.get("question_first") if isinstance(merged, dict) else {}
        connections_graph_enrichment_enabled = bool(
            question_first_meta.get("connections_graph_enrichment_enabled") if isinstance(question_first_meta, dict) else False
        )
        connections_graph_enrichment_status = (
            str(question_first_meta.get("connections_graph_enrichment_status") or "").strip()
            if isinstance(question_first_meta, dict)
            else ""
        ) or ("enabled" if connections_graph_enrichment_enabled else "optional")
        question_first_report = merged.get("question_first_report") if isinstance(merged, dict) else {}
        durable_batch_metrics = question_first_meta if isinstance(question_first_meta, dict) else {}
        entity_runtime_seconds = float(durable_batch_metrics.get("entity_runtime_seconds") or 0.0)
        question_runtime_seconds = durable_batch_metrics.get("question_runtime_seconds") if isinstance(durable_batch_metrics, dict) else {}
        validation_by_question = durable_batch_metrics.get("validation_by_question") if isinstance(durable_batch_metrics, dict) else {}
        validation_by_entity_type = durable_batch_metrics.get("validation_by_entity_type") if isinstance(durable_batch_metrics, dict) else {}
        deterministic_path_counts = durable_batch_metrics.get("deterministic_path_counts") if isinstance(durable_batch_metrics, dict) else {}
        retrieval_path_counts = durable_batch_metrics.get("retrieval_path_counts") if isinstance(durable_batch_metrics, dict) else {}
        baseline_features = durable_batch_metrics.get("baseline_features") if isinstance(durable_batch_metrics, dict) else {}
        baseline_features = baseline_features if isinstance(baseline_features, dict) else {}
        question_first_run_path = next(entity_output_dir.glob("*_question_first_run_v2.json"), None)
        if question_first_run_path is None:
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
            "entity_runtime_seconds": entity_runtime_seconds,
            "question_runtime_seconds": question_runtime_seconds,
            "validation_by_question": validation_by_question,
            "validation_by_entity_type": validation_by_entity_type,
            "deterministic_path_counts": deterministic_path_counts,
            "retrieval_path_counts": retrieval_path_counts,
            "baseline_features": baseline_features,
            "questions_validated": questions_validated,
            "questions_no_signal": questions_no_signal,
            "question_first_run_path": str(question_first_run_path) if question_first_run_path else None,
            "question_first_dossier_path": str(question_first_dossier_path) if question_first_dossier_path else None,
            "question_first_report_path": question_first_report.get("json_report_path") if isinstance(question_first_report, dict) else None,
            "optional_enrichments": {
                "connections_graph": {
                    "enabled": connections_graph_enrichment_enabled,
                    "status": connections_graph_enrichment_status,
                }
            },
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
        if entity_runtime_seconds:
            summary["entity_runtime_seconds"][entity_id] = entity_runtime_seconds
        if isinstance(question_runtime_seconds, dict) and question_runtime_seconds:
            summary["question_runtime_seconds"][entity_id] = question_runtime_seconds
        _merge_validation_totals(summary["validation_by_question"], validation_by_question if isinstance(validation_by_question, dict) else {})
        entity_type_counts: Dict[str, Dict[str, int]] = {}
        if isinstance(validation_by_entity_type, dict) and validation_by_entity_type:
            merged_entity_type_counts = _empty_validation_buckets()
            for counts in validation_by_entity_type.values():
                for state, value in (counts or {}).items():
                    merged_entity_type_counts[state] = int(merged_entity_type_counts.get(state, 0)) + int(value or 0)
            entity_type_counts[str(archetype.get("entity_type") or entity_summary["entity_type"] or "unknown")] = merged_entity_type_counts
        _merge_validation_totals(summary["validation_by_entity_type"], entity_type_counts)
        _merge_path_counts(summary["deterministic_path_counts"], deterministic_path_counts if isinstance(deterministic_path_counts, dict) else {})
        _merge_path_counts(summary["retrieval_path_counts"], retrieval_path_counts if isinstance(retrieval_path_counts, dict) else {})
        summary["baseline_features"]["enrichment_enabled"] = bool(summary["baseline_features"].get("enrichment_enabled")) or bool(baseline_features.get("enrichment_enabled"))
        summary["baseline_features"]["connections_graph_enrichment_enabled"] = bool(summary["baseline_features"].get("connections_graph_enrichment_enabled")) or bool(
            baseline_features.get("connections_graph_enrichment_enabled")
        )

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
                f"- Entity runtime seconds: {entity['entity_runtime_seconds']}",
                f"- Questions validated: {entity['questions_validated']}",
                f"- Questions no signal: {entity['questions_no_signal']}",
                f"- Enrichment enabled: {entity['baseline_features'].get('enrichment_enabled', False)}",
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
        "--batch-manifest",
        default="",
        help="Path to a question-first scale batch manifest JSON",
    )
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
    parser.add_argument(
        "--rerun-failed-from",
        default="",
        help="Path to a prior question_first_archetype_smoke.json summary for failed-entity reruns",
    )
    parser.add_argument(
        "--rerun-entity",
        default="",
        help="Only rerun the entity with this id",
    )
    parser.add_argument(
        "--rerun-question",
        default="",
        help="Only rerun the specified question id for the selected entity",
    )
    parser.add_argument(
        "--backfill-dossiers-from",
        default="",
        help="Backfill missing dossier artifacts using a prior smoke summary",
    )
    parser.add_argument(
        "--skip-complete",
        action="store_true",
        help="Skip entities that already have complete question-first artifacts",
    )
    args = parser.parse_args(argv)

    if args.output_root:
        output_root = Path(args.output_root)
    else:
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        output_root = ROOT / "backend" / "data" / "question_first_archetype_smokes" / f"question_first_archetype_smoke_{ts}"

    if args.batch_manifest:
        archetypes = load_archetypes_from_manifest(Path(args.batch_manifest), output_root=output_root)
    else:
        archetypes = DEFAULT_ARCHETYPE_BATCH

    if args.backfill_dossiers_from:
        asyncio.run(
            backfill_dossiers_from_summary(
                summary_path=Path(args.backfill_dossiers_from),
                output_root=output_root,
                opencode_timeout_ms=args.opencode_timeout_ms,
            )
        )
        return 0

    rerun_summary = Path(args.rerun_failed_from) if args.rerun_failed_from else None
    selected_archetypes = build_rerun_archetypes(
        archetypes,
        output_root=output_root,
        summary_path=rerun_summary,
        rerun_failed_from=rerun_summary,
        rerun_entity=args.rerun_entity or None,
        rerun_question=args.rerun_question or None,
        skip_complete=bool(args.skip_complete),
    )

    asyncio.run(
        run_smoke(
            selected_archetypes,
            output_root=output_root,
            opencode_timeout_ms=args.opencode_timeout_ms,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
