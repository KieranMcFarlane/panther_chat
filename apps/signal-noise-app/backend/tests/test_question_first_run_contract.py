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
                "schema_version": "question_first_run_v2",
                "run_id": "mlc_run_001",
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
                "question_specs": [
                    {
                        "question_id": "q1",
                        "question_family": "foundation",
                        "question_type": "foundation",
                        "question_text": "When was Major League Cricket founded?",
                        "query": '"Major League Cricket" founded',
                        "hop_budget": 1,
                        "evidence_extension_budget": 0,
                        "source_priority": ["google_serp"],
                        "evidence_focus": "entity_fact",
                        "promotion_target": "profile",
                        "answer_kind": "fact",
                        "question_shape": "atomic",
                        "question_timeout_ms": 1000,
                        "hop_timeout_ms": 1000,
                        "evidence_extension_confidence_threshold": 0.65,
                        "entity_name": "Major League Cricket",
                        "entity_id": "major-league-cricket",
                        "entity_type": "SPORT_LEAGUE",
                        "preset": "major-league-cricket",
                        "pack_role": "discovery",
                    }
                ],
                "answer_records": [
                    {
                        "question_id": "q1",
                        "question_type": "foundation",
                        "status": "answered",
                        "confidence": 0.92,
                        "validation_state": "validated",
                        "signal_type": "FOUNDATION",
                        "answer": {"kind": "fact", "value": "2023"},
                        "evidence_refs": ["q1:foundation"],
                        "trace_ref": "trace:q1",
                        "started_at": "2026-03-30T00:00:00+00:00",
                        "completed_at": "2026-03-30T00:00:05+00:00",
                        "duration_seconds": 5.0,
                    }
                ],
                "evidence_items": [
                    {
                        "evidence_id": "q1:foundation",
                        "question_id": "q1",
                        "source_type": "official_site",
                        "url": "https://example.com",
                        "title": "Example",
                        "snippet": "Founded in 2023",
                        "captured_at": "2026-03-30T00:00:03+00:00",
                        "relevance": 0.92,
                        "confidence": 0.92,
                        "supports": ["2023"],
                        "raw_ref": "official_site",
                    }
                ],
                "trace_index": [
                    {
                        "trace_id": "trace:q1",
                        "question_id": "q1",
                        "trace_type": "debug_bundle",
                        "path": "/tmp/q1.debug.json",
                        "inline": None,
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
                            "schema_version": "question_first_run_v2",
                            "questions_answered": 1,
                            "question_source_path": "backend/data/question_sources/major_league_cricket.json",
                            "generated_at": "2026-03-30T00:00:00+00:00",
                        },
                    },
                    "question_first": {
                        "enabled": True,
                        "schema_version": "question_first_run_v2",
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
                                "answer": {"kind": "fact", "value": "2023"},
                                "confidence": 0.92,
                                "validation_state": "validated",
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

    assert merged["question_first"]["schema_version"] == "question_first_run_v2"
    assert merged["question_first"]["questions_answered"] == 1
    assert merged["question_first"]["evidence_items"][0]["url"] == "https://example.com"
    assert merged["question_first_run"]["evidence_items"][0]["url"] == "https://example.com"
    assert merged["questions"][0]["question_first_answer"]["answer"]["value"] == "2023"
    assert merged["questions"][0]["validation_state"] == "validated"


@pytest.mark.asyncio
async def test_question_first_runner_rejects_malformed_canonical_artifact(tmp_path):
    artifact_path = tmp_path / "invalid_question_first_run.json"
    artifact_path.write_text(
        json.dumps(
            {
                "schema_version": "question_first_run_v2",
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
