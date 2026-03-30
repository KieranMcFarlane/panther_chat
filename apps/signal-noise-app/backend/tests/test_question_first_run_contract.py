import json
import sys
from pathlib import Path

import pytest

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

import question_first_dossier_runner as runner


@pytest.mark.asyncio
async def test_question_first_runner_merges_canonical_artifact_without_brightdata_loop(tmp_path):
    artifact_path = tmp_path / "major_league_cricket_question_first_run.json"
    artifact_path.write_text(
        json.dumps(
            {
                "schema_version": "question_first_run_v1",
                "generated_at": "2026-03-30T00:00:00+00:00",
                "run_started_at": "2026-03-30T00:00:00+00:00",
                "source": "opencode_agentic_batch",
                "status": "ready",
                "entity": {
                    "entity_id": "major-league-cricket",
                    "entity_name": "Major League Cricket",
                    "entity_type": "SPORT_LEAGUE",
                },
                "preset": "major-league-cricket",
                "question_source_path": "backend/data/question_sources/major_league_cricket.json",
                "questions": [
                    {
                        "question_id": "q1",
                        "question_type": "foundation",
                        "question_text": "When was Major League Cricket founded?",
                        "query": '"Major League Cricket" founded',
                    }
                ],
                "answers": [
                    {
                        "question_id": "q1",
                        "question_type": "foundation",
                        "question_text": "When was Major League Cricket founded?",
                        "answer": "2023",
                        "confidence": 0.92,
                        "validation_state": "validated",
                        "evidence_url": "https://example.com",
                        "signal_type": "FOUNDATION",
                    }
                ],
                "categories": [
                    {
                        "category": "identity",
                        "question_count": 1,
                        "validated_count": 1,
                        "pending_count": 0,
                        "no_signal_count": 0,
                        "retry_count": 0,
                    }
                ],
                "run_rollup": {
                    "questions_total": 1,
                    "questions_validated": 1,
                    "questions_no_signal": 0,
                    "questions_provisional": 0,
                    "entity_id": "major-league-cricket",
                    "entity_name": "Major League Cricket",
                    "entity_type": "SPORT_LEAGUE",
                    "preset": "major-league-cricket",
                },
                "merge_patch": {
                    "metadata": {
                        "question_first": {
                            "enabled": True,
                            "schema_version": "question_first_run_v1",
                            "questions_answered": 1,
                            "question_source_path": "backend/data/question_sources/major_league_cricket.json",
                            "generated_at": "2026-03-30T00:00:00+00:00",
                        }
                    },
                    "question_first": {
                        "enabled": True,
                        "schema_version": "question_first_run_v1",
                        "questions_answered": 1,
                        "categories": [
                            {
                                "category": "identity",
                                "question_count": 1,
                                "validated_count": 1,
                                "pending_count": 0,
                                "no_signal_count": 0,
                                "retry_count": 0,
                            }
                        ],
                        "answers": [
                            {
                                "question_id": "q1",
                                "question_type": "foundation",
                                "question_text": "When was Major League Cricket founded?",
                                "answer": "2023",
                                "confidence": 0.92,
                                "validation_state": "validated",
                                "evidence_url": "https://example.com",
                                "signal_type": "FOUNDATION",
                            }
                        ],
                        "run_rollup": {
                            "questions_total": 1,
                            "questions_validated": 1,
                            "questions_no_signal": 0,
                            "questions_provisional": 0,
                            "entity_id": "major-league-cricket",
                            "entity_name": "Major League Cricket",
                            "entity_type": "SPORT_LEAGUE",
                            "preset": "major-league-cricket",
                        },
                    },
                    "questions": [
                        {
                            "question_id": "q1",
                            "question_type": "foundation",
                            "question_text": "When was Major League Cricket founded?",
                            "query": '"Major League Cricket" founded',
                            "answer": "2023",
                            "confidence": 0.92,
                            "validation_state": "validated",
                            "evidence_url": "https://example.com",
                            "question_first_answer": {
                                "question_id": "q1",
                                "question_type": "foundation",
                                "question_text": "When was Major League Cricket founded?",
                                "answer": "2023",
                                "confidence": 0.92,
                                "validation_state": "validated",
                                "evidence_url": "https://example.com",
                                "signal_type": "FOUNDATION",
                            },
                        }
                    ],
                },
            }
        ),
        encoding="utf-8",
    )

    dossier = {
        "entity_id": "major-league-cricket",
        "entity_name": "Major League Cricket",
        "entity_type": "SPORT_LEAGUE",
        "questions": [
            {
                "question_id": "q1",
                "question_type": "foundation",
                "question_text": "When was Major League Cricket founded?",
                "query": '"Major League Cricket" founded',
            }
        ],
        "question_first_run_path": str(artifact_path),
    }

    merged = await runner.run_question_first_dossier_from_payload(source_payload=dossier, output_dir=None)

    assert merged["question_first"]["schema_version"] == "question_first_run_v1"
    assert merged["question_first"]["questions_answered"] == 1
    assert merged["questions"][0]["question_first_answer"]["answer"] == "2023"
    assert merged["questions"][0]["validation_state"] == "validated"


@pytest.mark.asyncio
async def test_question_first_runner_rejects_malformed_canonical_artifact(tmp_path):
    artifact_path = tmp_path / "invalid_question_first_run.json"
    artifact_path.write_text(
        json.dumps(
            {
                "schema_version": "question_first_run_v1",
                "generated_at": "2026-03-30T00:00:00+00:00",
            }
        ),
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="Invalid question_first_run artifact"):
        await runner.run_question_first_dossier_from_payload(
            source_payload={
                "entity_id": "major-league-cricket",
                "entity_name": "Major League Cricket",
                "questions": [],
                "question_first_run_path": str(artifact_path),
            },
            output_dir=None,
        )
