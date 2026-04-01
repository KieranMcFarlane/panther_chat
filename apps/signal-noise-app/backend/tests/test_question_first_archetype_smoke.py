import asyncio
import json
import sys
from pathlib import Path

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
        question_first_run_path = output_dir / f"{entity_id}_question_first_run_v1.json"
        dossier_report_path = output_dir / f"{entity_id}_question_first_dossier.json"
        question_first_run_path.write_text(
            json.dumps(
                {
                    "schema_version": "question_first_run_v1",
                    "generated_at": "2026-04-01T00:00:00+00:00",
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
                "schema_version": "question_first_run_v1",
                "run_rollup": {
                    "questions_total": 0,
                    "questions_validated": 0,
                    "questions_no_signal": 0,
                    "questions_provisional": 0,
                },
            },
            "question_first_report": {
                "json_report_path": str(dossier_report_path),
                "plain_text_path": str(output_dir / f"{entity_id}_question_first_dossier.txt"),
            },
            "question_first_run_path": str(question_first_run_path),
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
    assert summary["entities"][0]["entity_id"] == "arsenal"
    assert summary["entities"][1]["entity_id"] == "icf"
    assert summary["entities"][2]["entity_id"] == "major-league-cricket"
    assert (output_root / "question_first_archetype_smoke.json").exists()
    assert (output_root / "question_first_archetype_smoke.md").exists()
