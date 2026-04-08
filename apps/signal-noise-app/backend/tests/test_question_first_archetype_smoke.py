import asyncio
import json
import os
import sys
from pathlib import Path
from datetime import datetime, timezone

import pytest

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

import question_first_archetype_smoke as smoke


class _FakeRunner:
    def __init__(self):
        self.events = []

    async def __call__(self, *, question_source_path, output_dir, opencode_timeout_ms):
        entity_id = Path(question_source_path).stem.replace("_atomic_matrix", "").replace("_", "-")
        self.events.append(("start", entity_id))
        await asyncio.sleep(0)
        self.events.append(("end", entity_id))

        output_dir.mkdir(parents=True, exist_ok=True)
        question_first_run_path = output_dir / f"{entity_id}_question_first_run_v2.json"
        dossier_report_path = output_dir / f"{entity_id}_question_first_dossier.json"
        questions = [
            {
                "question_id": "q1_foundation",
                "question_type": "foundation",
                "question_text": "What year was Arsenal Football Club founded?",
                "deterministic_tools": [],
                "fallback_to_retrieval": False,
            },
            {
                "question_id": "q2_digital_stack",
                "question_type": "digital_stack",
                "question_text": "What is Arsenal Football Club's digital stack and what does it imply commercially?",
                "deterministic_tools": ["apify_techstack"],
                "fallback_to_retrieval": True,
            },
            {
                "question_id": "q3_procurement_signal",
                "question_type": "procurement_signal",
                "question_text": "Is there evidence of procurement, partnership, or platform change?",
                "deterministic_tools": [],
                "fallback_to_retrieval": True,
            },
        ]
        answers = [
            {
                "question_id": "q1_foundation",
                "question_type": "foundation",
                "question_text": "What year was Arsenal Football Club founded?",
                "answer": "1886",
                "confidence": 0.96,
                "validation_state": "validated",
                "signal_type": "FOUNDATION",
                "evidence_url": "https://www.arsenal.com/",
            },
            {
                "question_id": "q2_digital_stack",
                "question_type": "digital_stack",
                "question_text": "What is Arsenal Football Club's digital stack and what does it imply commercially?",
                "answer": "Modern web stack with legacy frontend signals",
                "confidence": 0.91,
                "validation_state": "validated",
                "signal_type": "DIGITAL_STACK",
                "evidence_url": "https://www.arsenal.com/",
            },
            {
                "question_id": "q3_procurement_signal",
                "question_type": "procurement_signal",
                "question_text": "Is there evidence of procurement, partnership, or platform change?",
                "answer": "No answer found",
                "confidence": 0.0,
                "validation_state": "no_signal",
                "signal_type": "PROCUREMENT",
                "evidence_url": None,
            },
        ]
        question_start = int(datetime.fromisoformat("2026-04-01T00:00:00+00:00").timestamp())
        for index, question in enumerate(questions, start=1):
            question_path = output_dir / f"{entity_id}_opencode_batch_20260401_question_{index:03d}.json"
            question_path.write_text(
                json.dumps(
                    {
                        "run_started_at": "2026-04-01T00:00:00+00:00",
                        "entity_name": entity_id.replace("-", " ").title(),
                        "entity_id": entity_id,
                        "entity_type": "SPORT_LEAGUE",
                        "preset": entity_id,
                        "question": question,
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )
            os.utime(question_path, (question_start + index * 5, question_start + index * 5))
        question_first_run_path.write_text(
            json.dumps(
                {
                    "schema_version": "question_first_run_v2",
                    "generated_at": "2026-04-01T00:00:30+00:00",
                    "run_started_at": "2026-04-01T00:00:00+00:00",
                    "source": "opencode_agentic_batch",
                    "status": "ready",
                    "entity": {
                        "entity_id": entity_id,
                        "entity_name": entity_id.replace("-", " ").title(),
                        "entity_type": "SPORT_LEAGUE",
                    },
                    "preset": entity_id,
                    "question_source_path": str(question_source_path),
                    "questions": questions,
                    "answers": answers,
                    "evidence_items": [],
                    "promotion_candidates": [],
                    "categories": [],
                    "run_rollup": {
                        "questions_total": len(answers),
                        "questions_validated": 2,
                        "questions_no_signal": 1,
                        "questions_provisional": 0,
                        "entity_id": entity_id,
                        "entity_name": entity_id.replace("-", " ").title(),
                        "entity_type": "SPORT_LEAGUE",
                        "preset": entity_id,
                    },
                    "merge_patch": {},
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        dossier_report_path.write_text("{}", encoding="utf-8")
        return {
            "question_first_run": {
                "schema_version": "question_first_run_v2",
                "generated_at": "2026-04-01T00:00:30+00:00",
                "run_started_at": "2026-04-01T00:00:00+00:00",
                "run_rollup": {
                    "questions_total": len(answers),
                    "questions_validated": 2,
                    "questions_no_signal": 1,
                    "questions_provisional": 0,
                },
            },
            "question_first": {
                "connections_graph_enrichment_enabled": False,
                "connections_graph_enrichment_status": "optional",
                "entity_runtime_seconds": 30.0,
                "question_runtime_seconds": {
                    "q1_foundation": 5.0,
                    "q2_digital_stack": 5.0,
                    "q3_procurement_signal": 5.0,
                },
                "validation_by_question": {
                    "q1_foundation": {"validated": 1, "no_signal": 0, "provisional": 0, "pending": 0},
                    "q2_digital_stack": {"validated": 1, "no_signal": 0, "provisional": 0, "pending": 0},
                    "q3_procurement_signal": {"validated": 0, "no_signal": 1, "provisional": 0, "pending": 0},
                },
                "validation_by_entity_type": {
                    "SPORT_LEAGUE": {"validated": 2, "no_signal": 1, "provisional": 0, "pending": 0}
                },
                "deterministic_path_counts": {"q2_digital_stack": 1},
                "retrieval_path_counts": {"q1_foundation": 1, "q3_procurement_signal": 1},
                "baseline_features": {
                    "enrichment_enabled": False,
                    "connections_graph_enrichment_enabled": False,
                    "connections_graph_enrichment_status": "optional",
                    "question_first_enabled": True,
                },
            },
            "question_first_report": {
                "json_report_path": str(dossier_report_path),
                "plain_text_path": str(output_dir / f"{entity_id}_question_first_dossier.txt"),
                "connections_graph_enrichment_enabled": False,
                "connections_graph_enrichment_status": "optional",
                "entity_runtime_seconds": 30.0,
                "question_runtime_seconds": {
                    "q1_foundation": 5.0,
                    "q2_digital_stack": 5.0,
                    "q3_procurement_signal": 5.0,
                },
                "validation_by_question": {
                    "q1_foundation": {"validated": 1, "no_signal": 0, "provisional": 0, "pending": 0},
                    "q2_digital_stack": {"validated": 1, "no_signal": 0, "provisional": 0, "pending": 0},
                    "q3_procurement_signal": {"validated": 0, "no_signal": 1, "provisional": 0, "pending": 0},
                },
                "validation_by_entity_type": {
                    "SPORT_LEAGUE": {"validated": 2, "no_signal": 1, "provisional": 0, "pending": 0}
                },
                "deterministic_path_counts": {"q2_digital_stack": 1},
                "retrieval_path_counts": {"q1_foundation": 1, "q3_procurement_signal": 1},
                "baseline_features": {
                    "enrichment_enabled": False,
                    "connections_graph_enrichment_enabled": False,
                    "connections_graph_enrichment_status": "optional",
                    "question_first_enabled": True,
                },
            },
            "question_first_run_path": str(question_first_run_path),
            "question_first_metadata": {
                "connections_graph_enrichment_enabled": False,
                "connections_graph_enrichment_status": "optional",
            },
        }


@pytest.mark.asyncio
async def test_archetype_smoke_runs_serially_and_writes_summary(tmp_path):
    runner = _FakeRunner()
    output_root = tmp_path / "smoke"

    summary = await smoke.run_smoke(
        smoke.DEFAULT_ARCHETYPE_BATCH,
        output_root=output_root,
        question_first_runner=runner,
        opencode_timeout_ms=180000,
    )

    assert runner.events == [
        ("start", "arsenal"),
        ("end", "arsenal"),
        ("start", "icf"),
        ("end", "icf"),
        ("start", "major-league-cricket"),
        ("end", "major-league-cricket"),
    ]
    assert summary["entities_total"] == 3
    assert summary["entities_completed"] == 3
    assert summary["entities_failed"] == 0
    assert summary["entity_runtime_seconds"]["arsenal"] == 30.0
    assert summary["question_runtime_seconds"]["arsenal"]["q1_foundation"] == 5.0
    assert summary["question_runtime_seconds"]["arsenal"]["q2_digital_stack"] == 5.0
    assert summary["validation_by_question"]["q1_foundation"]["validated"] == 3
    assert summary["validation_by_question"]["q3_procurement_signal"]["no_signal"] == 3
    assert summary["validation_by_entity_type"]["SPORT_CLUB"]["validated"] == 2
    assert summary["validation_by_entity_type"]["SPORT_CLUB"]["no_signal"] == 1
    assert summary["deterministic_path_counts"]["q2_digital_stack"] == 3
    assert summary["retrieval_path_counts"]["q3_procurement_signal"] == 3
    assert summary["baseline_features"]["enrichment_enabled"] is False
    assert summary["entities"][0]["entity_id"] == "arsenal"
    assert summary["entities"][1]["entity_id"] == "icf"
    assert summary["entities"][2]["entity_id"] == "major-league-cricket"
    assert summary["entities"][0]["optional_enrichments"]["connections_graph"]["enabled"] is False
    assert summary["entities"][0]["optional_enrichments"]["connections_graph"]["status"] == "optional"
    assert (output_root / "question_first_archetype_smoke.json").exists()
    assert (output_root / "question_first_archetype_smoke.md").exists()


def test_load_archetypes_from_manifest_materializes_missing_question_sources(tmp_path):
    manifest_path = tmp_path / "batch.json"
    manifest_path.write_text(
        json.dumps(
            {
                "schema_version": "question_first_scale_batch_v1",
                "entities": [
                    {
                        "entity_id": "arsenal",
                        "entity_name": "Arsenal Football Club",
                        "entity_type": "SPORT_CLUB",
                        "question_source_path": "apps/signal-noise-app/backend/data/question_sources/arsenal_atomic_matrix.json",
                    },
                    {
                        "entity_id": "world-rugby",
                        "entity_name": "World Rugby",
                        "entity_type": "SPORT_FEDERATION",
                    },
                ],
            }
        ),
        encoding="utf-8",
    )

    archetypes = smoke.load_archetypes_from_manifest(manifest_path, output_root=tmp_path / "out")

    assert len(archetypes) == 2
    assert archetypes[0]["question_source_path"].name == "arsenal_atomic_matrix.json"
    generated_path = archetypes[1]["question_source_path"]
    assert generated_path.exists()
    payload = json.loads(generated_path.read_text(encoding="utf-8"))
    assert payload["entity_id"] == "world-rugby"
    assert payload["entity_name"] == "World Rugby"
    assert payload["entity_type"] == "SPORT_FEDERATION"


def test_load_archetypes_from_manifest_preserves_default_rollout_phase_override(tmp_path):
    manifest_path = tmp_path / "batch.json"
    manifest_path.write_text(
        json.dumps(
            {
                "schema_version": "question_first_scale_batch_v1",
                "entities": [
                    {
                        "entity_id": "arsenal",
                        "entity_name": "Arsenal Football Club",
                        "entity_type": "SPORT_CLUB",
                        "default_rollout_phase": "phase_3_decision",
                    }
                ],
            }
        ),
        encoding="utf-8",
    )

    archetypes = smoke.load_archetypes_from_manifest(manifest_path, output_root=tmp_path / "out")

    payload = json.loads(archetypes[0]["question_source_path"].read_text(encoding="utf-8"))

    assert payload["default_rollout_phase"] == "phase_3_decision"


def test_build_rerun_archetypes_filters_failed_entities_and_failed_question(tmp_path):
    output_root = tmp_path / "smoke"
    summary_path = output_root / "question_first_archetype_smoke.json"
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    summary_path.write_text(
        json.dumps(
            {
                "entities": [
                    {
                        "entity_id": "arsenal",
                        "entity_name": "Arsenal Football Club",
                        "entity_type": "SPORT_CLUB",
                        "status": "completed",
                        "question_source_path": "apps/signal-noise-app/backend/data/question_sources/arsenal_atomic_matrix.json",
                        "question_first_run_path": str(output_root / "arsenal" / "arsenal-fc_question_first_run_v2.json"),
                        "question_first_dossier_path": str(output_root / "arsenal" / "arsenal-fc_question_first_dossier.json"),
                    },
                    {
                        "entity_id": "icf",
                        "entity_name": "International Canoe Federation",
                        "entity_type": "SPORT_FEDERATION",
                        "status": "failed",
                        "question_source_path": "apps/signal-noise-app/backend/data/question_sources/icf_atomic_matrix.json",
                        "question_first_run_path": str(output_root / "icf" / "international-canoe-federation_question_first_run_v2.json"),
                        "question_first_dossier_path": None,
                        "failed_questions": ["q2_digital_stack"],
                    },
                ]
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    selected = smoke.build_rerun_archetypes(
        smoke.DEFAULT_ARCHETYPE_BATCH,
        summary_path=summary_path,
        output_root=output_root,
        rerun_failed_from=summary_path,
        rerun_entity="icf",
        rerun_question="q2_digital_stack",
        skip_complete=True,
    )

    assert [item["entity_id"] for item in selected] == ["icf"]
    rerun_source_path = selected[0]["question_source_path"]
    assert rerun_source_path.exists()
    rerun_payload = json.loads(rerun_source_path.read_text(encoding="utf-8"))
    assert [question["question_id"] for question in rerun_payload["questions"]] == ["q2_digital_stack"]
    assert rerun_payload["rerun_profile"] == "bounded_single_question"
    assert rerun_payload["questions"][0]["hop_budget"] == 4
    assert rerun_payload["questions"][0]["question_timeout_ms"] == 120000
    assert rerun_payload["questions"][0]["hop_timeout_ms"] == 60000


def test_skip_complete_skips_entities_with_fresh_artifacts(tmp_path):
    output_root = tmp_path / "smoke"
    entity_dir = output_root / "arsenal"
    entity_dir.mkdir(parents=True, exist_ok=True)
    (entity_dir / "arsenal-fc_question_first_run_v2.json").write_text("{}", encoding="utf-8")
    (entity_dir / "arsenal-fc_question_first_dossier.json").write_text("{}", encoding="utf-8")

    selected = smoke.build_rerun_archetypes(
        smoke.DEFAULT_ARCHETYPE_BATCH,
        output_root=output_root,
        skip_complete=True,
    )

    assert all(item["entity_id"] != "arsenal" for item in selected)


@pytest.mark.asyncio
async def test_backfill_dossiers_from_summary_uses_existing_run_artifact_without_rerunning(tmp_path):
    output_root = tmp_path / "smoke"
    entity_dir = output_root / "icf"
    entity_dir.mkdir(parents=True, exist_ok=True)
    question_first_run_path = entity_dir / "international-canoe-federation_question_first_run_v2.json"
    question_first_run_path.write_text(
        json.dumps(
            {
                "schema_version": "question_first_run_v2",
                "generated_at": "2026-04-01T00:00:30+00:00",
                "run_started_at": "2026-04-01T00:00:00+00:00",
                "source": "opencode_agentic_batch",
                "status": "ready",
                "entity": {
                    "entity_id": "international-canoe-federation",
                    "entity_name": "International Canoe Federation",
                    "entity_type": "SPORT_FEDERATION",
                },
                "preset": "icf-atomic-matrix",
                "question_source_path": "apps/signal-noise-app/backend/data/question_sources/icf_atomic_matrix.json",
                "questions": [],
                "answers": [],
                "evidence_items": [],
                "promotion_candidates": [],
                "categories": [],
                "run_rollup": {
                    "questions_total": 0,
                    "questions_validated": 0,
                    "questions_no_signal": 0,
                    "questions_provisional": 0,
                    "entity_id": "international-canoe-federation",
                    "entity_name": "International Canoe Federation",
                    "entity_type": "SPORT_FEDERATION",
                    "preset": "icf-atomic-matrix",
                },
                "merge_patch": {},
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    summary_path = output_root / "question_first_archetype_smoke.json"
    summary_path.write_text(
        json.dumps(
            {
                "entities": [
                    {
                        "entity_id": "icf",
                        "entity_name": "International Canoe Federation",
                        "entity_type": "SPORT_FEDERATION",
                        "status": "completed",
                        "question_source_path": "apps/signal-noise-app/backend/data/question_sources/icf_atomic_matrix.json",
                        "question_first_run_path": str(question_first_run_path),
                        "question_first_dossier_path": None,
                    }
                ]
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    calls = []

    async def fake_runner(*, question_source_path, output_dir, question_first_run_path, opencode_timeout_ms):
        calls.append(
            {
                "question_source_path": str(question_source_path),
                "output_dir": str(output_dir),
                "question_first_run_path": str(question_first_run_path),
                "opencode_timeout_ms": opencode_timeout_ms,
            }
        )
        dossier_path = output_dir / "international-canoe-federation_question_first_dossier.json"
        dossier_path.write_text("{}", encoding="utf-8")
        return {
            "question_first_run": {
                "schema_version": "question_first_run_v2",
                "generated_at": "2026-04-01T00:00:30+00:00",
                "run_started_at": "2026-04-01T00:00:00+00:00",
                "run_rollup": {
                    "questions_total": 0,
                    "questions_validated": 0,
                    "questions_no_signal": 0,
                    "questions_provisional": 0,
                },
            },
            "question_first_report": {
                "json_report_path": str(dossier_path),
                "plain_text_path": str(output_dir / "international-canoe-federation_question_first_dossier.txt"),
            },
        }

    result = await smoke.backfill_dossiers_from_summary(
        summary_path=summary_path,
        output_root=output_root,
        question_first_runner=fake_runner,
        opencode_timeout_ms=180000,
    )

    assert len(calls) == 1
    assert calls[0]["question_first_run_path"] == str(question_first_run_path)
    assert result["entities_backfilled"] == 1
    assert (entity_dir / "international-canoe-federation_question_first_dossier.json").exists()
