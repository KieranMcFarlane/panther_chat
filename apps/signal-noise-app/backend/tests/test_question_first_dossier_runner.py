import asyncio
import json
import os
import sys
import threading
import time
from pathlib import Path
from types import SimpleNamespace
from datetime import datetime

import pytest

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

import question_first_dossier_runner as runner


class _FakeBrightDataClient:
    def __init__(self):
        self.queries = []

    async def search_engine(self, query, engine="google", country="us", num_results=10, cursor=None):
        self.queries.append(query)
        if "Leeds United" in query:
            return {
                "status": "success",
                "results": [
                    {
                        "title": "Leeds United",
                        "url": "https://www.leedsunited.com/",
                        "snippet": "Leeds United official site",
                    }
                ],
            }
        return {"status": "success", "results": []}

    async def scrape_as_markdown(self, url):
        return {
            "status": "success",
            "url": url,
            "content": "Leeds United were founded in 1919 and play at Elland Road.",
            "metadata": {"word_count": 11, "source": "mcp_client"},
        }


class _FakeClaudeClient:
    async def query(self, **kwargs):
        return {
            "content": json.dumps(
                {
                    "answer": "1919",
                    "confidence": 0.91,
                    "evidence_url": "https://www.leedsunited.com/",
                }
            ),
            "structured_output": {
                "answer": "1919",
                "confidence": 0.91,
                "evidence_url": "https://www.leedsunited.com/",
            },
            "model_used": "deepseek-ai/DeepSeek-V3.2-TEE",
            "tokens_used": {"total_tokens": 10},
            "stop_reason": "stop",
            "provider": "chutes_openai",
        }


def _write_question_first_run_artifact(path, *, entity_id, entity_name, questions, answers, categories, entity_type="SPORT_LEAGUE"):
    evidence_items = [
        {
            "evidence_id": f"{answer.get('question_id')}:evidence",
            "question_id": answer.get("question_id"),
            "entity_id": entity_id,
            "signal_type": answer.get("signal_type"),
            "evidence_focus": "entity_fact" if answer.get("signal_type") == "FOUNDATION" else "opportunity_signal",
            "promotion_target": "profile" if answer.get("signal_type") == "FOUNDATION" else "opportunity_signals",
            "answer_kind": "fact" if answer.get("signal_type") == "FOUNDATION" else "signal",
            "answer": answer.get("answer"),
            "confidence": answer.get("confidence"),
            "validation_state": answer.get("validation_state"),
            "evidence_url": answer.get("evidence_url"),
        }
        for answer in answers
    ]
    promotion_candidates = [
        {
            "candidate_id": f"{answer.get('question_id')}:{'profile' if answer.get('signal_type') == 'FOUNDATION' else 'opportunity_signals'}",
            "question_id": answer.get("question_id"),
            "promotion_target": "profile" if answer.get("signal_type") == "FOUNDATION" else "opportunity_signals",
            "signal_type": answer.get("signal_type"),
            "answer": answer.get("answer"),
            "confidence": answer.get("confidence"),
            "promotion_candidate": answer.get("validation_state") == "validated",
        }
        for answer in answers
    ]
    poi_graph = {
        "schema_version": "poi_graph_v1",
        "entity_id": entity_id,
        "entity_name": entity_name,
        "nodes": [
            {
                "node_id": entity_id,
                "node_type": "entity",
                "entity_id": entity_id,
                "name": entity_name,
            }
        ],
        "edges": [],
    }
    payload = {
        "schema_version": "question_first_run_v2",
        "generated_at": "2026-03-30T00:00:30+00:00",
        "run_started_at": "2026-03-30T00:00:00+00:00",
        "source": "opencode_agentic_batch",
        "status": "ready",
        "warnings": [],
        "entity": {
            "entity_id": entity_id,
            "entity_name": entity_name,
            "entity_type": entity_type,
        },
        "preset": "major-league-cricket",
        "question_source_path": "backend/data/question_sources/major_league_cricket.json",
        "questions": questions,
        "answers": answers,
        "question_timings": {
            answer.get("question_id"): {
                "started_at": "2026-03-30T00:00:00+00:00",
                "completed_at": "2026-03-30T00:00:05+00:00",
                "duration_seconds": 5.0,
            }
            for answer in answers
            if answer.get("question_id")
        },
        "evidence_items": evidence_items,
        "promotion_candidates": promotion_candidates,
        "poi_graph": poi_graph,
        "categories": categories,
        "run_rollup": {
            "questions_total": len(answers),
            "questions_validated": sum(1 for answer in answers if answer.get("validation_state") == "validated"),
            "questions_no_signal": sum(1 for answer in answers if answer.get("validation_state") == "no_signal"),
            "questions_provisional": sum(1 for answer in answers if answer.get("validation_state") == "provisional"),
            "entity_id": entity_id,
            "entity_name": entity_name,
            "entity_type": entity_type,
            "preset": "major-league-cricket",
        },
    }
    for index, question in enumerate(questions, start=1):
        question_path = path.parent / f"{entity_id}_opencode_batch_20260401_question_{index:03d}.json"
        question_path.write_text(
            json.dumps(
                {
                    "run_started_at": "2026-03-30T00:00:00+00:00",
                    "entity_name": entity_name,
                    "entity_id": entity_id,
                    "entity_type": entity_type,
                    "preset": "major-league-cricket",
                    "question": question,
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        question_start = int(datetime.fromisoformat("2026-03-30T00:00:00+00:00").timestamp())
        os.utime(question_path, (question_start + index * 5, question_start + index * 5))

    payload["merge_patch"] = {
        "metadata": {
            "question_first": {
                "enabled": True,
                "schema_version": "question_first_run_v2",
                "questions_answered": len(answers),
                "categories": categories,
                "question_source_path": "backend/data/question_sources/major_league_cricket.json",
                "generated_at": "2026-03-30T00:00:30+00:00",
                "run_rollup": payload["run_rollup"],
                "evidence_items": evidence_items,
                "promotion_candidates": promotion_candidates,
                "poi_graph": poi_graph,
            }
        },
        "question_first": {
            "enabled": True,
            "schema_version": "question_first_run_v2",
            "questions_answered": len(answers),
            "categories": categories,
            "answers": answers,
            "evidence_items": evidence_items,
            "promotion_candidates": promotion_candidates,
            "poi_graph": poi_graph,
            "run_rollup": payload["run_rollup"],
            "question_source_path": "backend/data/question_sources/major_league_cricket.json",
            "generated_at": "2026-03-30T00:00:30+00:00",
            "warnings": [],
        },
        "questions": [
            {
                **question,
                **{
                    "answer": answer.get("answer"),
                    "confidence": answer.get("confidence"),
                    "validation_state": answer.get("validation_state"),
                    "evidence_url": answer.get("evidence_url"),
                    "question_first_answer": answer,
                },
            }
            for question, answer in zip(questions, answers, strict=False)
        ],
    }
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def _write_question_first_run_artifact_with_timings(
    path,
    *,
    entity_id,
    entity_name,
    questions,
    answers,
    categories,
    question_timings,
    entity_type="SPORT_LEAGUE",
):
    payload_path = _write_question_first_run_artifact(
        path,
        entity_id=entity_id,
        entity_name=entity_name,
        questions=questions,
        answers=answers,
        categories=categories,
        entity_type=entity_type,
    )
    payload = json.loads(payload_path.read_text(encoding="utf-8"))
    payload["question_timings"] = question_timings
    payload["questions"] = [
        {
            **question,
            **question_timings.get(question.get("question_id"), {}),
        }
        for question in payload["questions"]
    ]
    payload["answers"] = [
        {
            **answer,
            **question_timings.get(answer.get("question_id"), {}),
        }
        for answer in payload["answers"]
    ]
    if isinstance(payload.get("merge_patch"), dict):
        payload["merge_patch"].setdefault("metadata", {}).setdefault("question_first", {})["question_timings"] = question_timings
        payload["merge_patch"].setdefault("question_first", {})["question_timings"] = question_timings
        payload["merge_patch"]["questions"] = [
            {
                **question,
                **question_timings.get(question.get("question_id"), {}),
                "question_first_answer": payload["answers"][index],
            }
            for index, question in enumerate(payload["questions"])
        ]
    payload_path.write_text(json.dumps(payload), encoding="utf-8")
    return payload_path


def test_resolve_question_first_worktree_root_prefers_dedicated_worktree(tmp_path, monkeypatch):
    repo_root = tmp_path / "repo"
    worktree_root = repo_root / ".worktrees" / "opencode-question-first-ssot"
    worktree_root.mkdir(parents=True)

    monkeypatch.setattr(runner.Path, "resolve", lambda self: repo_root / "apps" / "signal-noise-app" / "backend" / "question_first_dossier_runner.py")

    resolved = runner._resolve_question_first_worktree_root()

    assert resolved == worktree_root


def test_resolve_question_first_worktree_root_honors_explicit_root(tmp_path):
    explicit = tmp_path / "explicit-root"
    explicit.mkdir()

    assert runner._resolve_question_first_worktree_root(explicit) == explicit


@pytest.mark.asyncio
async def test_run_question_first_dossier_from_payload_seeds_explicit_bridge_contacts(tmp_path):
    output_dir = tmp_path / "out"
    output_dir.mkdir()
    artifact_path = output_dir / "celtic-fc_question_first_run_v2.json"
    _write_question_first_run_artifact(
        artifact_path,
        entity_id="celtic-fc",
        entity_name="Celtic FC",
        questions=[
            {
                "question_id": "q4_decision_owner",
                "question_text": "Who is the most suitable person for commercial partnerships?",
                "section_id": "connections",
            }
        ],
        answers=[
            {
                "question_id": "q4_decision_owner",
                "question_type": "decision_owner",
                "question_text": "Who is the most suitable person for commercial partnerships?",
                "answer": "Michael Nicholson",
                "confidence": 0.92,
                "validation_state": "validated",
                "signal_type": "DECISION_OWNER",
                "evidence_url": "https://example.com/michael-nicholson",
                "entity_id": "celtic-fc",
                "entity_name": "Celtic FC",
                "primary_owner": {
                    "name": "Michael Nicholson",
                    "title": "Chief Executive",
                    "organization": "Celtic FC",
                },
            }
        ],
        categories=[],
    )

    merged = await runner.run_question_first_dossier_from_payload(
        source_payload={
            "entity_id": "celtic-fc",
            "entity_name": "Celtic FC",
            "bridge_contacts": [
                {
                    "contact_name": "David Eames",
                    "relationship_to_yp": "Stuart Cope",
                    "network_reach": "Sports marketing",
                    "introduction_capability": "Warm commercial intro",
                    "linkedin_url": "https://www.linkedin.com/in/david-eames/",
                    "target_connections_count": 2,
                }
            ],
        },
        question_first_run_path=artifact_path,
    )

    graph = merged["connections_graph"]
    assert any(node["node_type"] == "bridge_contact" and node["name"] == "David Eames" for node in graph["nodes"])
    assert any(
        edge["from_id"] == "Stuart Cope" and edge["edge_type"] == "bridge_connection" and edge["to_id"] == "bridge:david-eames"
        for edge in graph["edges"]
    )


@pytest.mark.asyncio
async def test_run_question_first_dossier_from_payload_marks_connections_enrichment_as_optional_metadata(tmp_path, monkeypatch):
    output_dir = tmp_path / "out"
    output_dir.mkdir()
    artifact_path = output_dir / "arsenal_question_first_run_v2.json"
    _write_question_first_run_artifact(
        artifact_path,
        entity_id="arsenal",
        entity_name="Arsenal FC",
        questions=[
            {
                "question_id": "q1_foundation",
                "question_text": "When was Arsenal founded?",
                "section_id": "core_information",
            }
        ],
        answers=[
            {
                "question_id": "q1_foundation",
                "question_type": "foundation",
                "question_text": "When was Arsenal founded?",
                "answer": "1886",
                "confidence": 0.97,
                "validation_state": "validated",
                "signal_type": "FOUNDATION",
                "evidence_url": "https://www.arsenal.com/",
                "entity_id": "arsenal",
                "entity_name": "Arsenal FC",
            }
        ],
        categories=[],
    )

    monkeypatch.setattr(runner, "connections_enrichment_enabled_by_default", lambda: False)
    monkeypatch.setattr(runner, "build_default_connections_graph_enricher", lambda *_args, **_kwargs: pytest.fail("baseline should not build a default connections enricher"))

    merged = await runner.run_question_first_dossier_from_payload(
        source_payload={
            "entity_id": "arsenal",
            "entity_name": "Arsenal FC",
            "questions": [
                {
                    "question_id": "q1_foundation",
                    "question_text": "When was Arsenal founded?",
                    "section_id": "core_information",
                }
            ],
        },
        question_first_run_path=artifact_path,
        output_dir=output_dir,
    )

    assert merged["question_first"]["connections_graph_enrichment_enabled"] is False
    assert merged["question_first"]["connections_graph_enrichment_status"] == "optional"
    assert merged["question_first_report"]["connections_graph_enrichment_enabled"] is False
    assert merged["question_first_report"]["connections_graph_enrichment_status"] == "optional"


@pytest.mark.asyncio
async def test_run_question_first_dossier_from_payload_adds_durable_batch_metrics(tmp_path, monkeypatch):
    output_dir = tmp_path / "out"
    output_dir.mkdir()
    artifact_path = output_dir / "arsenal_question_first_run_v2.json"
    _write_question_first_run_artifact(
        artifact_path,
        entity_id="arsenal",
        entity_name="Arsenal FC",
        entity_type="SPORT_CLUB",
        questions=[
            {
                "question_id": "q1_foundation",
                "question_text": "When was Arsenal founded?",
                "section_id": "core_information",
                "deterministic_tools": [],
                "fallback_to_retrieval": False,
            },
            {
                "question_id": "q2_digital_stack",
                "question_text": "What is Arsenal's digital stack and what does it imply commercially?",
                "section_id": "digital_maturity",
                "deterministic_tools": ["apify_techstack"],
                "fallback_to_retrieval": True,
            },
            {
                "question_id": "q3_procurement_signal",
                "question_text": "Is there evidence of procurement, partnership, or platform change?",
                "section_id": "quick_actions",
                "deterministic_tools": [],
                "fallback_to_retrieval": True,
            },
        ],
        answers=[
            {
                "question_id": "q1_foundation",
                "question_type": "foundation",
                "question_text": "When was Arsenal founded?",
                "answer": "1886",
                "confidence": 0.95,
                "validation_state": "validated",
                "signal_type": "FOUNDATION",
                "evidence_url": "https://www.arsenal.com/",
            },
            {
                "question_id": "q2_digital_stack",
                "question_type": "digital_stack",
                "question_text": "What is Arsenal's digital stack and what does it imply commercially?",
                "answer": "Modern stack with legacy and commerce signals",
                "confidence": 0.9,
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
        ],
        categories=[],
    )

    merged = await runner.run_question_first_dossier_from_payload(
        source_payload={
            "entity_id": "arsenal",
            "entity_name": "Arsenal FC",
            "entity_type": "SPORT_CLUB",
            "questions": [
                {
                    "question_id": "q1_foundation",
                    "question_text": "When was Arsenal founded?",
                    "section_id": "core_information",
                }
            ],
        },
        question_first_run_path=artifact_path,
        output_dir=output_dir,
    )

    question_first = merged["question_first"]
    report = merged["question_first_report"]

    assert question_first["entity_runtime_seconds"] == 30.0
    assert question_first["question_runtime_seconds"]["q1_foundation"] == 5.0
    assert question_first["question_runtime_seconds"]["q2_digital_stack"] == 5.0
    assert question_first["validation_by_question"]["q2_digital_stack"]["validated"] == 1
    assert question_first["validation_by_question"]["q3_procurement_signal"]["no_signal"] == 1
    assert question_first["validation_by_entity_type"]["SPORT_CLUB"]["validated"] == 2
    assert question_first["validation_by_entity_type"]["SPORT_CLUB"]["no_signal"] == 1
    assert question_first["deterministic_path_counts"]["q2_digital_stack"] == 1
    assert question_first["retrieval_path_counts"]["q3_procurement_signal"] == 1
    assert question_first["baseline_features"]["enrichment_enabled"] is False
    assert report["entity_runtime_seconds"] == 30.0
    assert report["question_runtime_seconds"]["q1_foundation"] == 5.0
    assert report["validation_by_question"]["q1_foundation"]["validated"] == 1
    assert report["baseline_features"]["enrichment_enabled"] is False


@pytest.mark.asyncio
async def test_run_question_first_dossier_prefers_contract_question_timings_over_mtimes(tmp_path):
    output_dir = tmp_path / "out"
    output_dir.mkdir()
    artifact_path = output_dir / "arsenal_question_first_run_v2.json"
    _write_question_first_run_artifact_with_timings(
        artifact_path,
        entity_id="arsenal",
        entity_name="Arsenal FC",
        entity_type="SPORT_CLUB",
        questions=[
            {
                "question_id": "q1_foundation",
                "question_text": "When was Arsenal founded?",
                "section_id": "core_information",
            },
            {
                "question_id": "q2_digital_stack",
                "question_text": "What is Arsenal's digital stack and what does it imply commercially?",
                "section_id": "digital_maturity",
            },
        ],
        answers=[
            {
                "question_id": "q1_foundation",
                "question_type": "foundation",
                "question_text": "When was Arsenal founded?",
                "answer": "1886",
                "confidence": 0.95,
                "validation_state": "validated",
                "signal_type": "FOUNDATION",
                "evidence_url": "https://www.arsenal.com/",
            },
            {
                "question_id": "q2_digital_stack",
                "question_type": "digital_stack",
                "question_text": "What is Arsenal's digital stack and what does it imply commercially?",
                "answer": "Modern stack with legacy and commerce signals",
                "confidence": 0.9,
                "validation_state": "validated",
                "signal_type": "DIGITAL_STACK",
                "evidence_url": "https://www.arsenal.com/",
            },
        ],
        categories=[],
        question_timings={
            "q1_foundation": {
                "started_at": "2026-03-30T00:00:02+00:00",
                "completed_at": "2026-03-30T00:00:10+00:00",
                "duration_seconds": 8.0,
            },
            "q2_digital_stack": {
                "started_at": "2026-03-30T00:00:10+00:00",
                "completed_at": "2026-03-30T00:00:17+00:00",
                "duration_seconds": 7.0,
            },
        },
    )

    question_start = int(datetime.fromisoformat("2026-03-30T00:00:00+00:00").timestamp())
    for index, question in enumerate([
        {
            "question_id": "q1_foundation",
            "question_text": "When was Arsenal founded?",
            "section_id": "core_information",
        },
        {
            "question_id": "q2_digital_stack",
            "question_text": "What is Arsenal's digital stack and what does it imply commercially?",
            "section_id": "digital_maturity",
        },
    ], start=1):
        question_path = output_dir / f"arsenal_opencode_batch_20260330_question_{index:03d}.json"
        question_path.write_text(json.dumps({"question": question}, indent=2), encoding="utf-8")
        os.utime(question_path, (question_start + index * 3, question_start + index * 3))

    merged = await runner.run_question_first_dossier_from_payload(
        source_payload={
            "entity_id": "arsenal",
            "entity_name": "Arsenal FC",
            "entity_type": "SPORT_CLUB",
            "questions": [
                {
                    "question_id": "q1_foundation",
                    "question_text": "When was Arsenal founded?",
                    "section_id": "core_information",
                },
                {
                    "question_id": "q2_digital_stack",
                    "question_text": "What is Arsenal's digital stack and what does it imply commercially?",
                    "section_id": "digital_maturity",
                },
            ],
        },
        question_first_run_path=artifact_path,
        output_dir=output_dir,
    )

    question_first = merged["question_first"]
    report = merged["question_first_report"]

    assert question_first["question_runtime_seconds"]["q1_foundation"] == 8.0
    assert question_first["question_runtime_seconds"]["q2_digital_stack"] == 7.0
    assert report["question_runtime_seconds"]["q1_foundation"] == 8.0
    assert report["question_runtime_seconds"]["q2_digital_stack"] == 7.0
    assert merged["question_first_run"]["question_timings"]["q1_foundation"]["duration_seconds"] == 8.0


def test_question_first_launch_lock_serializes_across_callers(tmp_path):
    lock_root = tmp_path / "worktree-root"
    lock_root.mkdir()
    second_entered = threading.Event()

    def contender():
        with runner._acquire_question_first_launch_lock(lock_root):
            second_entered.set()

    with runner._acquire_question_first_launch_lock(lock_root):
        thread = threading.Thread(target=contender, daemon=True)
        thread.start()
        time.sleep(0.1)
        assert second_entered.is_set() is False

    thread.join(timeout=1.0)
    assert second_entered.is_set() is True


@pytest.mark.asyncio
async def test_question_first_runner_waits_for_completed_state_before_merging(tmp_path, monkeypatch):
    output_dir = tmp_path / "out"
    output_dir.mkdir()
    source_payload = {
        "entity_id": "leedsunited",
        "entity_name": "Leeds United",
        "preset": "leeds-united-atomic-matrix",
        "questions": [
            {
                "question_id": "q1",
                "section_id": "core_information",
                "question_text": "When was Leeds United founded?",
                "search_strategy": {"search_queries": ['"Leeds United" founded']},
            }
        ],
    }
    state_path = runner._build_question_first_state_path(
        output_dir=output_dir,
        source_payload=source_payload,
        preset=source_payload["preset"],
    )
    artifact_path = output_dir / "leedsunited_question_first_run_v2.json"
    _write_question_first_run_artifact(
        artifact_path,
        entity_id="leedsunited",
        entity_name="Leeds United",
        questions=source_payload["questions"],
        answers=[
            {
                "question_id": "q1",
                "section_id": "core_information",
                "question_text": "When was Leeds United founded?",
                "search_query": '"Leeds United" founded',
                "search_hit": True,
                "search_results_count": 1,
                "scrape_url": "https://www.leedsunited.com/",
                "answer": "1919",
                "confidence": 0.91,
                "evidence_url": "https://www.leedsunited.com/",
                "reasoning_model_used": "opencode",
                "retry_count": 0,
                "category": "identity",
                "search_queries": ['"Leeds United" founded'],
                "search_attempts": [{"query": '"Leeds United" founded', "status": "success", "result_count": 1}],
                "validation_state": "validated",
                "signal_type": "FOUNDATION",
            }
        ],
        categories=[
            {
                "category": "identity",
                "question_count": 1,
                "validated_count": 1,
                "pending_count": 0,
                "no_signal_count": 0,
                "retry_count": 0,
            }
        ],
    )
    state_path.write_text(json.dumps({"run_phase": "question_runner_enter"}), encoding="utf-8")

    async def fake_launch(**_kwargs):
        return artifact_path, state_path

    sleep_calls = {"count": 0}

    async def fake_sleep(_delay):
        sleep_calls["count"] += 1
        if sleep_calls["count"] == 1:
            state_path.write_text(json.dumps({"run_phase": "completed"}), encoding="utf-8")

    monkeypatch.setattr(runner, "_launch_opencode_question_first_batch", fake_launch)
    monkeypatch.setattr(runner.asyncio, "sleep", fake_sleep)

    merged = await runner.run_question_first_dossier_from_payload(
        source_payload=source_payload,
        output_dir=output_dir,
        preset=source_payload["preset"],
    )

    assert sleep_calls["count"] >= 1
    assert json.loads(state_path.read_text(encoding="utf-8"))["run_phase"] == "completed"
    assert merged["question_first_run"]["run_rollup"]["questions_validated"] == 1
    assert merged["questions"][0]["validation_state"] == "validated"


@pytest.mark.asyncio
async def test_question_first_runner_uses_saved_questions_and_writes_plain_text_report(tmp_path):
    dossier_path = tmp_path / "leeds_dossier.json"
    artifact_path = tmp_path / "leedsunited_question_first_run.json"
    _write_question_first_run_artifact(
        artifact_path,
        entity_id="leedsunited",
        entity_name="Leeds United",
        questions=[
            {
                "question_id": "q1",
                "section_id": "core_information",
                "question_text": "When was Leeds United founded?",
                "search_strategy": {
                    "search_queries": ["\"Leeds United\" founded"],
                },
            }
        ],
        answers=[
            {
                "question_id": "q1",
                "section_id": "core_information",
                "question_text": "When was Leeds United founded?",
                "search_query": '"Leeds United" founded',
                "search_hit": True,
                "search_results_count": 1,
                "scrape_url": "https://www.leedsunited.com/",
                "answer": "1919",
                "confidence": 0.91,
                "evidence_url": "https://www.leedsunited.com/",
                "reasoning_model_used": "opencode",
                "retry_count": 0,
                "category": "identity",
                "search_queries": ['"Leeds United" founded'],
                "search_attempts": [{"query": '"Leeds United" founded', "status": "success", "result_count": 1}],
                "validation_state": "validated",
                "signal_type": "FOUNDATION",
            }
        ],
        categories=[
            {
                "category": "identity",
                "question_count": 1,
                "validated_count": 1,
                "pending_count": 0,
                "no_signal_count": 0,
                "retry_count": 0,
            }
        ],
    )
    dossier_path.write_text(
        json.dumps(
            {
                "entity_id": "leedsunited",
                "entity_name": "Leeds United",
                "tier": "PREMIUM",
                "questions": [
                    {
                        "question_id": "q1",
                        "section_id": "core_information",
                        "question_text": "When was Leeds United founded?",
                        "search_strategy": {
                            "search_queries": ["\"Leeds United\" founded"],
                        },
                    }
                ],
                "question_first_run_path": str(artifact_path),
            }
        ),
        encoding="utf-8",
    )
    output_dir = tmp_path / "out"

    result = await runner.run_question_first_dossier(question_source_path=dossier_path, output_dir=output_dir)

    assert result["entity_name"] == "Leeds United"
    assert result["question_first"]["schema_version"] == "question_first_run_v2"
    assert result["question_first"]["questions_answered"] == 1
    assert result["question_first"]["evidence_items"][0]["promotion_target"] == "profile"
    assert result["question_first"]["promotion_candidates"][0]["promotion_candidate"] is True
    assert result["question_first"]["dossier_promotions"][0]["question_id"] == "q1"
    assert result["question_first"]["discovery_summary"]["promoted_count"] == 1
    assert result["question_first"]["poi_graph"]["schema_version"] == "poi_graph_v1"
    assert result["question_first"]["connections_graph"]["schema_version"] == "connections_graph_v1"
    assert result["question_first_run"]["schema_version"] == "question_first_run_v2"
    assert result["question_first_run"]["poi_graph"]["schema_version"] == "poi_graph_v1"
    assert result["question_first_run"]["evidence_items"][0]["promotion_target"] == "profile"
    assert result["question_first_run"]["promotion_candidates"][0]["promotion_candidate"] is True
    assert result["dossier_promotions"][0]["question_id"] == "q1"
    assert result["discovery_summary"]["profile"][0]["candidate_id"] == "q1:profile"
    assert result["poi_graph"]["schema_version"] == "poi_graph_v1"
    assert result["connections_graph"]["schema_version"] == "connections_graph_v1"
    assert result["questions"][0]["answer"] == "1919"
    assert result["questions"][0]["validation_state"] == "validated"

    json_report = output_dir / "leedsunited_question_first_dossier.json"
    txt_report = output_dir / "leedsunited_question_first_dossier.txt"
    assert json_report.exists()
    assert txt_report.exists()
    assert "When was Leeds United founded?" in txt_report.read_text()
    assert "1919" in txt_report.read_text()


@pytest.mark.asyncio
async def test_question_first_runner_groups_by_category_and_retries_on_empty_search(tmp_path):
    dossier_path = tmp_path / "leeds_dossier.json"
    artifact_path = tmp_path / "leedsunited_question_first_run.json"
    _write_question_first_run_artifact(
        artifact_path,
        entity_id="leedsunited",
        entity_name="Leeds United",
        questions=[
            {
                "question_id": "q1",
                "section_id": "core_information",
                "question_text": "When was Leeds United founded?",
                "search_strategy": {"search_queries": ["\"Leeds United\" founded"]},
            },
            {
                "question_id": "q2",
                "section_id": "leadership",
                "question_text": "Who is the current chairman of Leeds United?",
                "search_strategy": {"search_queries": ["\"Leeds United\" chairman"]},
            },
        ],
        answers=[
            {
                "question_id": "q1",
                "section_id": "core_information",
                "question_text": "When was Leeds United founded?",
                "search_query": '"Leeds United" founded',
                "search_hit": True,
                "search_results_count": 1,
                "scrape_url": "https://www.leedsunited.com/",
                "answer": "1919",
                "confidence": 0.91,
                "evidence_url": "https://www.leedsunited.com/",
                "reasoning_model_used": "opencode",
                "retry_count": 0,
                "category": "identity",
                "search_queries": ['"Leeds United" founded'],
                "search_attempts": [{"query": '"Leeds United" founded', "status": "success", "result_count": 1}],
                "validation_state": "validated",
                "signal_type": "FOUNDATION",
            },
            {
                "question_id": "q2",
                "section_id": "leadership",
                "question_text": "Who is the current chairman of Leeds United?",
                "search_query": '"Leeds United" chairman',
                "search_hit": True,
                "search_results_count": 1,
                "scrape_url": "https://www.leedsunited.com/",
                "answer": "Chairman answer",
                "confidence": 0.88,
                "evidence_url": "https://www.leedsunited.com/",
                "reasoning_model_used": "opencode",
                "retry_count": 1,
                "category": "leadership",
                "search_queries": ['"Leeds United" chairman'],
                "search_attempts": [{"query": '"Leeds United" chairman', "status": "success", "result_count": 1, "retry": True}],
                "validation_state": "validated",
                "signal_type": "LEADERSHIP",
            },
        ],
        categories=[
            {
                "category": "identity",
                "question_count": 1,
                "validated_count": 1,
                "pending_count": 0,
                "no_signal_count": 0,
                "retry_count": 0,
            },
            {
                "category": "leadership",
                "question_count": 1,
                "validated_count": 1,
                "pending_count": 0,
                "no_signal_count": 0,
                "retry_count": 1,
            },
        ],
    )
    output_dir = tmp_path / "out"

    dossier_path.write_text(
        json.dumps(
            {
                "entity_id": "leedsunited",
                "entity_name": "Leeds United",
                "tier": "PREMIUM",
                "questions": [
                    {
                        "question_id": "q1",
                        "section_id": "core_information",
                        "question_text": "When was Leeds United founded?",
                        "search_strategy": {"search_queries": ["\"Leeds United\" founded"]},
                    },
                    {
                        "question_id": "q2",
                        "section_id": "leadership",
                        "question_text": "Who is the current chairman of Leeds United?",
                        "search_strategy": {"search_queries": ["\"Leeds United\" chairman"]},
                    },
                ],
                "question_first_run_path": str(artifact_path),
            }
        ),
        encoding="utf-8",
    )

    result = await runner.run_question_first_dossier(question_source_path=dossier_path, output_dir=output_dir)

    assert result["question_first"]["categories"][0]["category"] == "identity"
    assert any(cat["category"] == "leadership" for cat in result["question_first"]["categories"])
    assert len(result["question_first"]["answers"][0]["search_attempts"]) == 1
    assert result["questions"][0]["answer"] == "1919"
    assert result["questions"][1]["answer"] == "Chairman answer"
    assert result["questions"][1]["validation_state"] == "validated"


@pytest.mark.asyncio
async def test_launch_opencode_question_first_batch_falls_back_to_timestamped_artifact_when_stdout_is_not_json(tmp_path, monkeypatch):
    output_dir = tmp_path / "out"
    output_dir.mkdir(parents=True)
    artifact_path = output_dir / "leedsunited_opencode_batch_20260406_120000_question_first_run_v2.json"
    _write_question_first_run_artifact(
        artifact_path,
        entity_id="leedsunited",
        entity_name="Leeds United",
        questions=[
            {
                "question_id": "q1",
                "section_id": "core_information",
                "question_text": "When was Leeds United founded?",
            }
        ],
        answers=[
            {
                "question_id": "q1",
                "section_id": "core_information",
                "question_text": "When was Leeds United founded?",
                "answer": "1919",
                "confidence": 0.91,
                "evidence_url": "https://www.leedsunited.com/",
                "validation_state": "validated",
                "signal_type": "FOUNDATION",
            }
        ],
        categories=[
            {
                "category": "identity",
                "question_count": 1,
                "validated_count": 1,
                "pending_count": 0,
                "no_signal_count": 0,
                "retry_count": 0,
            }
        ],
    )

    class _FakeProcess:
        def __init__(self):
            self.returncode = 0
            self._stdout = "[dotenv] loaded env\nnot-json\n"
            self._stderr = ""

        def poll(self):
            return 0

        def communicate(self, timeout=None):
            return self._stdout, self._stderr

        def terminate(self):
            return None

        def kill(self):
            return None

    monkeypatch.setattr(runner.subprocess, "Popen", lambda *args, **kwargs: _FakeProcess())

    source_payload = {
        "entity_id": "leedsunited",
        "entity_name": "Leeds United",
        "entity_type": "SPORT_CLUB",
        "questions": [
            {
                "question_id": "q1",
                "question_text": "When was Leeds United founded?",
            }
        ],
    }

    question_first_run_path, state_path = await runner._launch_opencode_question_first_batch(
        source_payload=source_payload,
        output_dir=output_dir,
        preset="leedsunited-atomic-matrix",
        worktree_root=tmp_path,
        opencode_timeout_ms=1000,
    )

    assert question_first_run_path == artifact_path
    assert state_path.name.endswith("_state.json")


@pytest.mark.asyncio
async def test_launch_opencode_question_first_batch_returns_after_terminal_state_even_if_child_lingers(tmp_path, monkeypatch):
    output_dir = tmp_path / "out"
    output_dir.mkdir(parents=True)
    artifact_path = output_dir / "bundesliga_opencode_batch_20260407_120000_question_first_run_v2.json"
    _write_question_first_run_artifact(
        artifact_path,
        entity_id="bundesliga",
        entity_name="Bundesliga",
        entity_type="SPORT_LEAGUE",
        questions=[
            {
                "question_id": "q1_foundation",
                "section_id": "core_information",
                "question_text": "When was Bundesliga founded?",
            }
        ],
        answers=[
            {
                "question_id": "q1_foundation",
                "section_id": "core_information",
                "question_text": "When was Bundesliga founded?",
                "answer": "1963",
                "confidence": 0.95,
                "evidence_url": "https://www.bundesliga.com/",
                "validation_state": "validated",
                "signal_type": "FOUNDATION",
            }
        ],
        categories=[
            {
                "category": "identity",
                "question_count": 1,
                "validated_count": 1,
                "pending_count": 0,
                "no_signal_count": 0,
                "retry_count": 0,
            }
        ],
    )
    source_payload = {
        "entity_id": "bundesliga",
        "entity_name": "Bundesliga",
        "entity_type": "SPORT_LEAGUE",
        "questions": [
            {
                "question_id": "q1_foundation",
                "question_text": "When was Bundesliga founded?",
            }
        ],
    }
    state_path = runner._build_question_first_state_path(
        output_dir=output_dir,
        source_payload=source_payload,
        preset="bundesliga-atomic-matrix",
    )
    state_path.write_text(
        json.dumps(
            {
                "run_phase": "completed",
                "question_first_run_path": str(artifact_path),
            }
        ),
        encoding="utf-8",
    )

    class _LingeringProcess:
        def __init__(self):
            self.returncode = None
            self.terminated = False

        def poll(self):
            return None if not self.terminated else 0

        def communicate(self, timeout=None):
            if timeout is not None and not self.terminated:
                raise runner.subprocess.TimeoutExpired(cmd="node", timeout=timeout)
            return (
                json.dumps(
                    {
                        "question_first_run_path": str(artifact_path),
                        "state_path": str(state_path),
                    }
                )
                + "\n",
                "",
            )

        def terminate(self):
            self.terminated = True
            self.returncode = 0

        def kill(self):
            self.terminated = True
            self.returncode = 0

    process = _LingeringProcess()
    monkeypatch.setattr(runner.subprocess, "Popen", lambda *args, **kwargs: process)

    question_first_run_path, returned_state_path = await runner._launch_opencode_question_first_batch(
        source_payload=source_payload,
        output_dir=output_dir,
        preset="bundesliga-atomic-matrix",
        worktree_root=tmp_path,
        opencode_timeout_ms=1000,
    )

    assert question_first_run_path == artifact_path
    assert returned_state_path == state_path
    assert process.terminated is True
