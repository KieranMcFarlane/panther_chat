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


def test_derive_question_first_batch_timeout_ms_scales_with_question_count():
    source_payload = {
        "questions": [
            {"question_id": "q1"},
            {"question_id": "q2"},
            {"question_id": "q3"},
        ]
    }

    timeout_ms = runner._derive_question_first_batch_timeout_ms(
        source_payload=source_payload,
        opencode_timeout_ms=1000,
    )

    assert timeout_ms > 1000
    assert timeout_ms >= 3000


def test_classify_question_first_batch_timeout_distinguishes_progress_states(tmp_path):
    state_path = tmp_path / "runner_state.json"
    state_path.write_text(json.dumps({"run_phase": "question_runner_enter", "active_question_id": "q3_leadership"}), encoding="utf-8")

    classification = runner._classify_question_first_batch_timeout(
        state_payload={"run_phase": "question_runner_enter", "active_question_id": "q3_leadership"},
        state_path=state_path,
        last_progress_mtime=state_path.stat().st_mtime,
        progress_window_seconds=30.0,
    )
    assert classification == "still_progressing"

    classification = runner._classify_question_first_batch_timeout(
        state_payload={"run_phase": "completed", "active_question_id": "q3_leadership"},
        state_path=state_path,
        last_progress_mtime=state_path.stat().st_mtime - 120,
        progress_window_seconds=30.0,
    )
    assert classification == "completed_not_harvested"

    classification = runner._classify_question_first_batch_timeout(
        state_payload={"run_phase": "question_runner_enter", "active_question_id": "q3_leadership"},
        state_path=state_path,
        last_progress_mtime=state_path.stat().st_mtime - 120,
        progress_window_seconds=30.0,
    )
    assert classification == "stalled"


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
    assert result["questions"][0]["answer"]["summary"] == "1919"
    assert result["questions"][0]["validation_state"] == "validated"

    json_report = output_dir / "leedsunited_question_first_dossier.json"
    txt_report = output_dir / "leedsunited_question_first_dossier.txt"
    assert json_report.exists()
    assert txt_report.exists()
    published_payload = json.loads(json_report.read_text(encoding="utf-8"))
    assert len(published_payload["questions"]) == 1
    assert published_payload["quality_state"] == "complete"
    assert published_payload["quality_summary"].startswith("Complete dossier:")
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
    assert result["questions"][0]["answer"]["summary"] == "1919"
    assert result["questions"][1]["answer"]["summary"] == "Chairman answer"
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


@pytest.mark.asyncio
async def test_launch_opencode_question_first_batch_raises_completed_without_artifact_error(tmp_path, monkeypatch):
    output_dir = tmp_path / "out"
    output_dir.mkdir(parents=True)

    class _FakeProcess:
        def poll(self):
            return 0

        def communicate(self, timeout=None):
            return "", ""

        def terminate(self):
            return None

        def kill(self):
            return None

    monkeypatch.setattr(runner.subprocess, "Popen", lambda *args, **kwargs: _FakeProcess())

    source_payload = {
        "entity_id": "arsenal",
        "entity_name": "Arsenal Football Club",
        "entity_type": "SPORT_CLUB",
        "questions": [
            {
                "question_id": "q1_foundation",
                "question_text": "When was Arsenal Football Club founded?",
            }
        ],
    }

    with pytest.raises(runner.CompletedWithoutArtifactError):
        await runner._launch_opencode_question_first_batch(
            source_payload=source_payload,
            output_dir=output_dir,
            preset="arsenal-atomic-matrix",
            worktree_root=tmp_path,
            opencode_timeout_ms=1000,
        )


@pytest.mark.asyncio
async def test_launch_opencode_question_first_batch_retries_with_resume_on_retryable_checkpoint(tmp_path, monkeypatch):
    output_dir = tmp_path / "out"
    output_dir.mkdir(parents=True)
    artifact_path = output_dir / "zimbabwe-cricket_opencode_batch_20260409_120000_question_first_run_v2.json"
    _write_question_first_run_artifact(
        artifact_path,
        entity_id="zimbabwe-cricket",
        entity_name="Zimbabwe Cricket",
        questions=[
            {
                "question_id": "q1_foundation",
                "section_id": "core_information",
                "question_text": "When was Zimbabwe Cricket founded?",
            }
        ],
        answers=[
            {
                "question_id": "q1_foundation",
                "section_id": "core_information",
                "question_text": "When was Zimbabwe Cricket founded?",
                "answer": "1981",
                "confidence": 0.91,
                "evidence_url": "https://en.wikipedia.org/wiki/Zimbabwe_Cricket",
                "validation_state": "validated",
                "signal_type": "FOUNDATION",
            }
        ],
        categories=[],
    )

    source_payload = {
        "entity_id": "zimbabwe-cricket",
        "entity_name": "Zimbabwe Cricket",
        "entity_type": "CRICKET_BOARD",
        "questions": [
            {
                "question_id": "q1_foundation",
                "question_text": "When was Zimbabwe Cricket founded?",
            }
        ],
    }
    state_path = runner._build_question_first_state_path(
        output_dir=output_dir,
        source_payload=source_payload,
        preset="zimbabwe-cricket-atomic-matrix",
    )
    state_path.write_text(
        json.dumps(
            {
                "run_phase": "retryable_failure",
                "retryable": True,
                "failure_category": "retryable_failure",
                "active_question_id": "q3_leadership",
            }
        ),
        encoding="utf-8",
    )

    popen_calls = []

    class _FirstProcess:
        def poll(self):
            return None

        def communicate(self, timeout=None):
            return "", ""

        def terminate(self):
            return None

        def kill(self):
            return None

    class _SecondProcess:
        def poll(self):
            return 0

        def communicate(self, timeout=None):
            return json.dumps({"question_first_run_path": str(artifact_path), "state_path": str(state_path)}), ""

        def terminate(self):
            return None

        def kill(self):
            return None

    processes = [_FirstProcess(), _SecondProcess()]

    def _fake_popen(command, *args, **kwargs):
        popen_calls.append(command)
        return processes.pop(0)

    monkeypatch.setattr(runner.subprocess, "Popen", _fake_popen)
    async def _fake_sleep(_delay):
        return None

    monkeypatch.setattr(runner.asyncio, "sleep", _fake_sleep)

    question_first_run_path, returned_state_path = await runner._launch_opencode_question_first_batch(
        source_payload=source_payload,
        output_dir=output_dir,
        preset="zimbabwe-cricket-atomic-matrix",
        worktree_root=tmp_path,
        opencode_timeout_ms=1,
        max_resume_attempts=1,
    )

    assert question_first_run_path == artifact_path
    assert returned_state_path == state_path
    assert len(popen_calls) == 2
    assert "--resume" not in popen_calls[0]
    assert "--resume" in popen_calls[1]


def test_merge_question_first_run_artifact_backfills_terminal_context_for_timeout_salvage():
    artifact = {
        "schema_version": "question_first_run_v2",
        "generated_at": "2026-04-08T16:42:59.751Z",
        "run_started_at": "2026-04-08T16:33:56.363Z",
        "source": "opencode_agentic_batch",
        "status": "ready",
        "entity": {
            "entity_id": "arsenal",
            "entity_name": "Arsenal Football Club",
            "entity_type": "SPORT_CLUB",
        },
        "question_specs": [
            {
                "question_id": "q7_procurement_signal",
                "question_text": "Is there evidence Arsenal Football Club is buying, reshaping vendors, or changing its commercial or digital ecosystem?",
                "depends_on": [],
            }
        ],
        "answer_records": [
            {
                "question_id": "q7_procurement_signal",
                "question_type": "procurement_signal",
                "validation_state": "failed",
                "signal_type": "PROCUREMENT_SIGNAL",
                "notes": "",
                "answer": {
                    "kind": "summary",
                    "summary": None,
                    "value": None,
                    "raw_structured_output": None,
                },
                "timeout_salvage": {
                    "candidate_summary": "BrightData evidence retained during timeout, but no safe candidate summary was extracted.",
                    "candidate_evidence_urls": [
                        "https://www.arsenal.com/news/visit-rwanda-update",
                    ],
                },
            }
        ],
    }

    merged = runner.merge_question_first_run_artifact_into_dossier(dossier_payload={}, artifact=artifact)
    question = merged["questions"][0]

    assert question["terminal_state"] == "no_signal"
    assert "Evidence retained during timeout" in question["terminal_summary"]
    assert "Evidence retained during timeout" in question["answer"]["summary"]
    assert question["answer"]["raw_structured_output"]["sources"] == ["https://www.arsenal.com/news/visit-rwanda-update"]


@pytest.mark.asyncio
async def test_run_question_first_dossier_from_payload_stages_candidate_without_overwriting_better_published_dossier(tmp_path):
    output_dir = tmp_path / "out"
    output_dir.mkdir()
    questions = [
        {
            "question_id": f"q{index}_signal",
            "question_text": f"Question {index}?",
            "section_id": "core_information",
        }
        for index in range(1, 16)
    ]
    better_answers = [
        {
            "question_id": question["question_id"],
            "question_type": "foundation",
            "question_text": question["question_text"],
            "answer": f"Strong answer {index}",
            "confidence": 0.95,
            "validation_state": "validated",
            "signal_type": "FOUNDATION",
            "evidence_url": f"https://example.com/{index}",
        }
        for index, question in enumerate(questions, start=1)
    ]
    weaker_answers = [
        {
            "question_id": question["question_id"],
            "question_type": "foundation",
            "question_text": question["question_text"],
            "answer": f"Weaker answer {index}",
            "confidence": 0.2 if index > 10 else 0.9,
            "validation_state": "no_signal" if index > 10 else "validated",
            "signal_type": "FOUNDATION",
            "evidence_url": f"https://example.com/weaker/{index}",
        }
        for index, question in enumerate(questions, start=1)
    ]

    existing_artifact_path = output_dir / "zimbabwe-cricket_existing_question_first_run_v2.json"
    candidate_artifact_path = output_dir / "zimbabwe-cricket_candidate_question_first_run_v2.json"
    _write_question_first_run_artifact(
        existing_artifact_path,
        entity_id="zimbabwe-cricket",
        entity_name="Zimbabwe Cricket",
        questions=questions,
        answers=better_answers,
        categories=[],
    )
    _write_question_first_run_artifact(
        candidate_artifact_path,
        entity_id="zimbabwe-cricket",
        entity_name="Zimbabwe Cricket",
        questions=questions,
        answers=weaker_answers,
        categories=[],
    )

    existing = await runner.run_question_first_dossier_from_payload(
        source_payload={
            "entity_id": "zimbabwe-cricket",
            "entity_name": "Zimbabwe Cricket",
            "questions": questions,
        },
        question_first_run_path=existing_artifact_path,
        output_dir=output_dir,
    )
    published_path = output_dir / "zimbabwe-cricket_question_first_dossier.json"
    published_payload = json.loads(published_path.read_text(encoding="utf-8"))
    assert existing["question_first_report"]["publish_status"] == "published"
    assert published_payload["questions_answered"] == 15

    merged = await runner.run_question_first_dossier_from_payload(
        source_payload={
            "entity_id": "zimbabwe-cricket",
            "entity_name": "Zimbabwe Cricket",
            "questions": questions,
        },
        question_first_run_path=candidate_artifact_path,
        output_dir=output_dir,
    )

    staged_path = output_dir / "zimbabwe-cricket_question_first_dossier.staged.json"
    assert staged_path.exists()
    assert merged["question_first_report"]["publish_status"] == "staged"
    assert json.loads(published_path.read_text(encoding="utf-8"))["merged_dossier"]["question_first_run"]["answer_records"][0]["answer"]["summary"] == "Strong answer 1"


@pytest.mark.asyncio
async def test_run_question_first_dossier_from_payload_merges_single_question_repair_into_base_artifact(tmp_path):
    output_dir = tmp_path / "out"
    output_dir.mkdir()
    questions = [
        {
            "question_id": f"q{index}_signal",
            "question_text": f"Question {index}?",
            "section_id": "core_information",
        }
        for index in range(1, 16)
    ]
    base_answers = [
        {
            "question_id": question["question_id"],
            "question_type": "foundation",
            "question_text": question["question_text"],
            "answer": f"Base answer {index}",
            "confidence": 0.92,
            "validation_state": "validated",
            "signal_type": "FOUNDATION",
            "evidence_url": f"https://example.com/base/{index}",
        }
        for index, question in enumerate(questions, start=1)
    ]
    base_answers[10] = {
        "question_id": "q11_signal",
        "question_type": "decision_owner",
        "question_text": "Question 11?",
        "answer": "No answer found",
        "confidence": 0.0,
        "validation_state": "no_signal",
        "signal_type": "DECISION_OWNER",
        "evidence_url": None,
    }
    repaired_answers = [
        {
            "question_id": "q11_signal",
            "question_type": "decision_owner",
            "question_text": "Question 11?",
            "answer": "Wilfred Mukondiwa",
            "confidence": 0.77,
            "validation_state": "partially_validated",
            "signal_type": "DECISION_OWNER",
            "evidence_url": "https://example.com/repair/q11",
        }
    ]

    base_artifact_path = output_dir / "zimbabwe-cricket_base_question_first_run_v2.json"
    repair_artifact_path = output_dir / "zimbabwe-cricket_repair_question_first_run_v2.json"
    _write_question_first_run_artifact(
        base_artifact_path,
        entity_id="zimbabwe-cricket",
        entity_name="Zimbabwe Cricket",
        questions=questions,
        answers=base_answers,
        categories=[],
    )
    _write_question_first_run_artifact(
        repair_artifact_path,
        entity_id="zimbabwe-cricket",
        entity_name="Zimbabwe Cricket",
        questions=[questions[10]],
        answers=repaired_answers,
        categories=[],
    )

    merged = await runner.run_question_first_dossier_from_payload(
        source_payload={
            "entity_id": "zimbabwe-cricket",
            "entity_name": "Zimbabwe Cricket",
            "questions": questions,
            "metadata": {
                "question_first_repair": {
                    "mode": "question",
                    "question_id": "q11_signal",
                    "repaired_question_ids": ["q11_signal"],
                    "repair_source_run_path": str(base_artifact_path),
                    "repair_source_run_id": "base-run-1",
                }
            },
        },
        question_first_run_path=repair_artifact_path,
        output_dir=output_dir,
    )

    assert len(merged["questions"]) == 15
    repaired_question = next(question for question in merged["questions"] if question["question_id"] == "q11_signal")
    untouched_question = next(question for question in merged["questions"] if question["question_id"] == "q10_signal")
    assert repaired_question["answer"]["summary"] == "Wilfred Mukondiwa"
    assert repaired_question["validation_state"] == "partially_validated"
    assert untouched_question["answer"]["summary"] == "Base answer 10"
    assert merged["question_first_run"]["repair_run"]["repair_source_run_id"] == "base-run-1"
    assert merged["question_first_run"]["repair_run"]["repaired_question_ids"] == ["q11_signal"]
    assert merged["quality_state"] == "complete"


def test_merge_question_first_run_artifact_marks_dependency_blocked_questions_explicitly():
    artifact = {
        "schema_version": "question_first_run_v2",
        "generated_at": "2026-04-08T16:42:59.751Z",
        "run_started_at": "2026-04-08T16:33:56.363Z",
        "source": "opencode_agentic_batch",
        "status": "ready",
        "entity": {
            "entity_id": "arsenal",
            "entity_name": "Arsenal Football Club",
            "entity_type": "SPORT_CLUB",
        },
        "question_specs": [
            {
                "question_id": "q8_explicit_rfp",
                "question_text": "Are there published RFPs, tenders, or formal procurement documents for Arsenal Football Club?",
                "depends_on": ["q7_procurement_signal"],
            }
        ],
        "answer_records": [
            {
                "question_id": "q8_explicit_rfp",
                "question_type": "tender_docs",
                "validation_state": "no_signal",
                "signal_type": "TENDER_DOCS",
                "notes": "Question conditions were not met for this entity or prior signal state.",
                "answer": {
                    "kind": "summary",
                    "summary": None,
                    "value": None,
                    "raw_structured_output": {
                        "context": "Question conditions were not met for this entity or prior signal state.",
                    },
                },
            }
        ],
    }

    merged = runner.merge_question_first_run_artifact_into_dossier(dossier_payload={}, artifact=artifact)
    question = merged["questions"][0]

    assert question["terminal_state"] == "blocked"
    assert question["blocked_by"] == ["q7_procurement_signal"]
    assert "Question conditions were not met" in question["terminal_summary"]


def test_merge_question_first_run_artifact_synthesizes_q14_from_q13_and_q7():
    artifact = {
        "schema_version": "question_first_run_v2",
        "generated_at": "2026-04-10T18:18:42Z",
        "run_started_at": "2026-04-10T18:18:00Z",
        "source": "opencode_agentic_batch",
        "status": "ready",
        "entity": {
            "entity_id": "fc-porto-2027",
            "entity_name": "FC Porto",
            "entity_type": "SPORT_CLUB",
        },
        "question_specs": [
            {
                "question_id": "q7_procurement_signal",
                "question_text": "Is there evidence FC Porto is buying, reshaping vendors, or changing its commercial or digital ecosystem?",
                "question_type": "procurement_signal",
                "depends_on": [],
            },
            {
                "question_id": "q13_capability_gap",
                "question_text": "What capability gaps or weaknesses are most relevant for FC Porto versus peers?",
                "question_type": "capability_gap",
                "depends_on": ["q7_procurement_signal"],
            },
            {
                "question_id": "q14_yp_fit",
                "question_text": "Where does Yellow Panther fit best for FC Porto?",
                "question_type": "yp_fit",
                "depends_on": ["q13_capability_gap", "q7_procurement_signal"],
            },
        ],
        "answer_records": [
            {
                "question_id": "q7_procurement_signal",
                "question_type": "procurement_signal",
                "validation_state": "validated",
                "signal_type": "PROCUREMENT_SIGNAL",
                "answer": {
                    "kind": "summary",
                    "summary": "FC Porto is actively reshaping its commercial and digital ecosystem.",
                    "raw_structured_output": {
                        "answer": "FC Porto is actively reshaping its commercial and digital ecosystem.",
                        "themes": [
                            "Digital transformation",
                            "New digital platforms",
                            "Vendor ecosystem change",
                        ],
                        "summary": "FC Porto is actively reshaping its commercial and digital ecosystem.",
                        "validation_state": "validated",
                    },
                },
            },
            {
                "question_id": "q13_capability_gap",
                "question_type": "capability_gap",
                "validation_state": "provisional",
                "signal_type": "CAPABILITY_GAP",
                "answer": {
                    "kind": "summary",
                    "summary": "Capability gaps inferred from digital_stack_maturity, vendor_change_motion",
                    "raw_structured_output": {
                        "answer": "Capability gaps inferred from digital_stack_maturity, vendor_change_motion",
                        "summary": "Capability gap scorecard derived from validated upstream commercial and digital signals.",
                        "top_gap": "digital_stack_maturity",
                        "themes": ["digital_stack_maturity", "vendor_change_motion"],
                        "recommendations": [
                            "Close digital stack maturity gap",
                            "Close vendor change motion gap",
                        ],
                        "gap_scorecard": [
                            {
                                "capability": "digital_stack_maturity",
                                "gap_score": 0.78,
                                "severity": "high",
                            }
                        ],
                        "validation_state": "provisional",
                    },
                },
            },
            {
                "question_id": "q14_yp_fit",
                "question_type": "yp_fit",
                "validation_state": "no_signal",
                "signal_type": "YP_FIT",
                "answer": {
                    "kind": "summary",
                    "summary": "No capability-gap inference is available yet for YP fit mapping.",
                    "raw_structured_output": {
                        "answer": "",
                        "summary": "No capability-gap inference is available yet for YP fit mapping.",
                        "notes": "No capability-gap inference is available yet for YP fit mapping.",
                        "context": "No capability-gap inference is available yet for YP fit mapping.",
                        "validation_state": "no_signal",
                    },
                },
            },
        ],
    }

    merged = runner.merge_question_first_run_artifact_into_dossier(dossier_payload={}, artifact=artifact)
    question = next(question for question in merged["questions"] if question["question_id"] == "q14_yp_fit")
    answer_record = next(answer for answer in merged["question_first_run"]["answer_records"] if answer["question_id"] == "q14_yp_fit")

    assert question["terminal_state"] == "answered"
    assert question["validation_state"] == "provisional"
    assert "No capability-gap inference is available yet" not in question["terminal_summary"]
    assert question["answer"]["raw_structured_output"]["best_service"]
    assert question["answer"]["raw_structured_output"]["service_alignment"]
    assert answer_record["validation_state"] == "provisional"
    assert answer_record["answer"]["raw_structured_output"]["best_service"]


def test_merge_question_first_run_artifact_overwrites_stale_question_first_answers_with_synthesized_q14():
    stale_q14 = {
        "question_id": "q14_yp_fit",
        "question_type": "yp_fit",
        "validation_state": "no_signal",
        "answer": {
            "kind": "summary",
            "summary": "No capability-gap inference is available yet for YP fit mapping.",
            "raw_structured_output": {
                "summary": "No capability-gap inference is available yet for YP fit mapping.",
                "notes": "No capability-gap inference is available yet for YP fit mapping.",
                "context": "No capability-gap inference is available yet for YP fit mapping.",
                "validation_state": "no_signal",
            },
        },
    }
    artifact = {
        "schema_version": "question_first_run_v2",
        "generated_at": "2026-04-10T18:18:42Z",
        "run_started_at": "2026-04-10T18:18:00Z",
        "source": "opencode_agentic_batch",
        "status": "ready",
        "entity": {
            "entity_id": "fc-porto-2027",
            "entity_name": "FC Porto",
            "entity_type": "SPORT_CLUB",
        },
        "question_specs": [
            {
                "question_id": "q7_procurement_signal",
                "question_text": "Is there evidence FC Porto is buying, reshaping vendors, or changing its commercial or digital ecosystem?",
                "question_type": "procurement_signal",
                "depends_on": [],
            },
            {
                "question_id": "q13_capability_gap",
                "question_text": "What capability gaps or weaknesses are most relevant for FC Porto versus peers?",
                "question_type": "capability_gap",
                "depends_on": ["q7_procurement_signal"],
            },
            {
                "question_id": "q14_yp_fit",
                "question_text": "Where does Yellow Panther fit best for FC Porto?",
                "question_type": "yp_fit",
                "depends_on": ["q13_capability_gap", "q7_procurement_signal"],
            },
        ],
        "answer_records": [
            {
                "question_id": "q7_procurement_signal",
                "question_type": "procurement_signal",
                "validation_state": "validated",
                "signal_type": "PROCUREMENT_SIGNAL",
                "answer": {
                    "kind": "summary",
                    "summary": "FC Porto is actively reshaping its commercial and digital ecosystem.",
                    "raw_structured_output": {
                        "answer": "FC Porto is actively reshaping its commercial and digital ecosystem.",
                        "themes": ["Digital transformation"],
                        "summary": "FC Porto is actively reshaping its commercial and digital ecosystem.",
                        "validation_state": "validated",
                    },
                },
            },
            {
                "question_id": "q13_capability_gap",
                "question_type": "capability_gap",
                "validation_state": "provisional",
                "signal_type": "CAPABILITY_GAP",
                "answer": {
                    "kind": "summary",
                    "summary": "Capability gaps inferred from digital_stack_maturity, vendor_change_motion",
                    "raw_structured_output": {
                        "answer": "Capability gaps inferred from digital_stack_maturity, vendor_change_motion",
                        "summary": "Capability gap scorecard derived from validated upstream commercial and digital signals.",
                        "top_gap": "digital_stack_maturity",
                        "themes": ["digital_stack_maturity", "vendor_change_motion"],
                        "recommendations": ["Close digital stack maturity gap"],
                        "gap_scorecard": [
                            {
                                "capability": "digital_stack_maturity",
                                "gap_score": 0.78,
                                "severity": "high",
                            }
                        ],
                        "validation_state": "provisional",
                    },
                },
            },
            stale_q14,
        ],
    }
    dossier_payload = {
        "question_first": {
            "answers": [stale_q14],
        },
        "metadata": {
            "question_first": {
                "validation_by_question": {
                    "q14_yp_fit": {"validated": 0, "no_signal": 1, "provisional": 0, "pending": 0}
                }
            }
        },
    }

    merged = runner.merge_question_first_run_artifact_into_dossier(
        dossier_payload=dossier_payload,
        artifact=artifact,
    )

    q14_answer = next(answer for answer in merged["question_first"]["answers"] if answer["question_id"] == "q14_yp_fit")

    assert q14_answer["validation_state"] == "provisional"
    assert q14_answer["answer"]["raw_structured_output"]["best_service"]
    assert "No capability-gap inference is available yet" not in q14_answer["answer"]["summary"]


def test_merge_question_first_run_artifact_overwrites_stale_merged_dossier_with_synthesized_q14():
    stale_q14 = {
        "question_id": "q14_yp_fit",
        "question_type": "yp_fit",
        "validation_state": "no_signal",
        "terminal_state": "blocked",
        "terminal_summary": "No capability-gap inference is available yet for YP fit mapping.",
        "answer": {
            "kind": "summary",
            "summary": "No capability-gap inference is available yet for YP fit mapping.",
            "raw_structured_output": {
                "summary": "No capability-gap inference is available yet for YP fit mapping.",
                "notes": "No capability-gap inference is available yet for YP fit mapping.",
                "context": "No capability-gap inference is available yet for YP fit mapping.",
                "validation_state": "no_signal",
            },
        },
        "question_first_answer": {
            "terminal_state": "blocked",
            "terminal_summary": "No capability-gap inference is available yet for YP fit mapping.",
            "validation_state": "no_signal",
            "answer": {
                "summary": "No capability-gap inference is available yet for YP fit mapping.",
                "raw_structured_output": {
                    "validation_state": "no_signal",
                },
            },
        },
    }
    artifact = {
        "schema_version": "question_first_run_v2",
        "generated_at": "2026-04-10T18:18:42Z",
        "run_started_at": "2026-04-10T18:18:00Z",
        "source": "opencode_agentic_batch",
        "status": "ready",
        "entity": {
            "entity_id": "fc-porto-2027",
            "entity_name": "FC Porto",
            "entity_type": "SPORT_CLUB",
        },
        "question_specs": [
            {
                "question_id": "q7_procurement_signal",
                "question_text": "Is there evidence FC Porto is buying, reshaping vendors, or changing its commercial or digital ecosystem?",
                "question_type": "procurement_signal",
                "depends_on": [],
            },
            {
                "question_id": "q13_capability_gap",
                "question_text": "What capability gaps or weaknesses are most relevant for FC Porto versus peers?",
                "question_type": "capability_gap",
                "depends_on": ["q7_procurement_signal"],
            },
            {
                "question_id": "q14_yp_fit",
                "question_text": "Where does Yellow Panther fit best for FC Porto?",
                "question_type": "yp_fit",
                "depends_on": ["q13_capability_gap", "q7_procurement_signal"],
            },
        ],
        "answer_records": [
            {
                "question_id": "q7_procurement_signal",
                "question_type": "procurement_signal",
                "validation_state": "validated",
                "signal_type": "PROCUREMENT_SIGNAL",
                "answer": {
                    "kind": "summary",
                    "summary": "FC Porto is actively reshaping its commercial and digital ecosystem.",
                    "raw_structured_output": {
                        "answer": "FC Porto is actively reshaping its commercial and digital ecosystem.",
                        "themes": ["Digital transformation"],
                        "summary": "FC Porto is actively reshaping its commercial and digital ecosystem.",
                        "validation_state": "validated",
                    },
                },
            },
            {
                "question_id": "q13_capability_gap",
                "question_type": "capability_gap",
                "validation_state": "provisional",
                "signal_type": "CAPABILITY_GAP",
                "answer": {
                    "kind": "summary",
                    "summary": "Capability gaps inferred from digital_stack_maturity, vendor_change_motion",
                    "raw_structured_output": {
                        "answer": "Capability gaps inferred from digital_stack_maturity, vendor_change_motion",
                        "summary": "Capability gap scorecard derived from validated upstream commercial and digital signals.",
                        "top_gap": "digital_stack_maturity",
                        "themes": ["digital_stack_maturity", "vendor_change_motion"],
                        "recommendations": ["Close digital stack maturity gap"],
                        "gap_scorecard": [
                            {
                                "capability": "digital_stack_maturity",
                                "gap_score": 0.78,
                                "severity": "high",
                            }
                        ],
                        "validation_state": "provisional",
                    },
                },
            },
            {
                "question_id": "q14_yp_fit",
                "question_type": "yp_fit",
                "validation_state": "no_signal",
                "signal_type": "YP_FIT",
                "answer": {
                    "kind": "summary",
                    "summary": "No capability-gap inference is available yet for YP fit mapping.",
                    "raw_structured_output": {
                        "summary": "No capability-gap inference is available yet for YP fit mapping.",
                        "notes": "No capability-gap inference is available yet for YP fit mapping.",
                        "context": "No capability-gap inference is available yet for YP fit mapping.",
                        "validation_state": "no_signal",
                    },
                },
            },
        ],
    }
    dossier_payload = {
        "merged_dossier": {
            "question_first": {
                "answers": [stale_q14],
            },
            "questions": [stale_q14],
        }
    }

    merged = runner.merge_question_first_run_artifact_into_dossier(
        dossier_payload=dossier_payload,
        artifact=artifact,
    )

    nested_q14_answer = next(answer for answer in merged["merged_dossier"]["question_first"]["answers"] if answer["question_id"] == "q14_yp_fit")
    nested_q14_question = next(question for question in merged["merged_dossier"]["questions"] if question["question_id"] == "q14_yp_fit")

    assert nested_q14_answer["validation_state"] == "provisional"
    assert nested_q14_answer["answer"]["raw_structured_output"]["best_service"]
    assert nested_q14_question["terminal_state"] == "answered"


@pytest.mark.asyncio
async def test_run_question_first_dossier_from_payload_tracks_synthesized_q14_in_validation_metrics(tmp_path):
    output_dir = tmp_path / "out"
    output_dir.mkdir()
    artifact_path = output_dir / "fc-porto_question_first_run_v2.json"
    artifact = {
        "schema_version": "question_first_run_v2",
        "generated_at": "2026-04-10T18:18:42Z",
        "run_started_at": "2026-04-10T18:18:00Z",
        "source": "opencode_agentic_batch",
        "status": "ready",
        "entity": {
            "entity_id": "fc-porto-2027",
            "entity_name": "FC Porto",
            "entity_type": "SPORT_CLUB",
        },
        "question_specs": [
            {
                "question_id": "q7_procurement_signal",
                "question_text": "Is there evidence FC Porto is buying, reshaping vendors, or changing its commercial or digital ecosystem?",
                "question_type": "procurement_signal",
                "depends_on": [],
            },
            {
                "question_id": "q13_capability_gap",
                "question_text": "What capability gaps or weaknesses are most relevant for FC Porto versus peers?",
                "question_type": "capability_gap",
                "depends_on": ["q7_procurement_signal"],
            },
            {
                "question_id": "q14_yp_fit",
                "question_text": "Where does Yellow Panther fit best for FC Porto?",
                "question_type": "yp_fit",
                "depends_on": ["q13_capability_gap", "q7_procurement_signal"],
            },
        ],
        "answer_records": [
            {
                "question_id": "q7_procurement_signal",
                "question_type": "procurement_signal",
                "validation_state": "validated",
                "signal_type": "PROCUREMENT_SIGNAL",
                "answer": {
                    "kind": "summary",
                    "summary": "FC Porto is actively reshaping its commercial and digital ecosystem.",
                    "raw_structured_output": {
                        "answer": "FC Porto is actively reshaping its commercial and digital ecosystem.",
                        "themes": ["Digital transformation"],
                        "summary": "FC Porto is actively reshaping its commercial and digital ecosystem.",
                        "validation_state": "validated",
                    },
                },
            },
            {
                "question_id": "q13_capability_gap",
                "question_type": "capability_gap",
                "validation_state": "provisional",
                "signal_type": "CAPABILITY_GAP",
                "answer": {
                    "kind": "summary",
                    "summary": "Capability gaps inferred from digital_stack_maturity, vendor_change_motion",
                    "raw_structured_output": {
                        "answer": "Capability gaps inferred from digital_stack_maturity, vendor_change_motion",
                        "summary": "Capability gap scorecard derived from validated upstream commercial and digital signals.",
                        "top_gap": "digital_stack_maturity",
                        "themes": ["digital_stack_maturity", "vendor_change_motion"],
                        "recommendations": ["Close digital stack maturity gap"],
                        "gap_scorecard": [
                            {
                                "capability": "digital_stack_maturity",
                                "gap_score": 0.78,
                                "severity": "high",
                            }
                        ],
                        "validation_state": "provisional",
                    },
                },
            },
            {
                "question_id": "q14_yp_fit",
                "question_type": "yp_fit",
                "validation_state": "no_signal",
                "signal_type": "YP_FIT",
                "answer": {
                    "kind": "summary",
                    "summary": "No capability-gap inference is available yet for YP fit mapping.",
                    "raw_structured_output": {
                        "summary": "No capability-gap inference is available yet for YP fit mapping.",
                        "notes": "No capability-gap inference is available yet for YP fit mapping.",
                        "context": "No capability-gap inference is available yet for YP fit mapping.",
                        "validation_state": "no_signal",
                    },
                },
            },
        ],
    }
    artifact_path.write_text(json.dumps(artifact, indent=2), encoding="utf-8")

    merged = await runner.run_question_first_dossier_from_payload(
        source_payload={
            "entity_id": "fc-porto-2027",
            "entity_name": "FC Porto",
            "entity_type": "SPORT_CLUB",
            "question_first": {
                "answers": [
                    {
                        "question_id": "q14_yp_fit",
                        "validation_state": "no_signal",
                        "answer": {"summary": "No capability-gap inference is available yet for YP fit mapping."},
                    }
                ]
            },
            "questions": artifact["question_specs"],
        },
        question_first_run_path=artifact_path,
        output_dir=output_dir,
    )

    assert merged["question_first"]["validation_by_question"]["q14_yp_fit"]["provisional"] == 1
    assert merged["question_first"]["validation_by_question"]["q14_yp_fit"]["no_signal"] == 0
    assert merged["validation_by_question"]["q14_yp_fit"]["provisional"] == 1
    assert merged["validation_by_question"]["q14_yp_fit"]["no_signal"] == 0
    q14_question = next(question for question in merged["questions"] if question["question_id"] == "q14_yp_fit")
    assert q14_question["terminal_state"] == "answered"
    published_payload = json.loads((output_dir / "fc-porto-2027_question_first_dossier.json").read_text(encoding="utf-8"))
    published_top_level_q14 = next(answer for answer in published_payload["answers"] if answer["question_id"] == "q14_yp_fit")
    published_q14 = next(answer for answer in published_payload["question_first"]["answers"] if answer["question_id"] == "q14_yp_fit")
    assert published_top_level_q14["validation_state"] == "provisional"
    assert published_q14["validation_state"] == "provisional"
    assert published_payload["validation_by_question"]["q14_yp_fit"]["provisional"] == 1
    assert published_payload["merged_dossier"]["question_first"]["validation_by_question"]["q14_yp_fit"]["provisional"] == 1


@pytest.mark.asyncio
async def test_merge_question_first_run_artifact_preserves_skipped_questions(tmp_path):
    artifact_path = tmp_path / "skipped_q1.json"
    answers = [
        {
            "question_id": "q1_foundation",
            "question_type": "foundation",
            "validation_state": "skipped",
            "skip_reason": "retry_exhausted",
            "skip_note": "Schema error after three attempts",
            "signal_type": "FOUNDATION",
            "answer": {
                "kind": "summary",
                "summary": "Skipped due to repeated schema failures.",
                "raw_structured_output": {
                    "answer": None,
                    "validation_state": "skipped",
                },
            },
        }
    ]
    _write_question_first_run_artifact(
        artifact_path,
        entity_id="skipped-entity",
        entity_name="Skipped Entity",
        questions=[
            {
                "question_id": "q1_foundation",
                "question_text": "What is the canonical identity and grounding profile?",
                "question_type": "foundation",
                "depends_on": [],
            }
        ],
        answers=answers,
        categories=[],
        entity_type="SPORT_CLUB",
    )
    merged = await runner.run_question_first_dossier_from_payload(
        source_payload={
            "entity_id": "skipped-entity",
            "entity_name": "Skipped Entity",
            "entity_type": "SPORT_CLUB",
            "questions": [
                {
                    "question_id": "q1_foundation",
                    "question_text": "What is the canonical identity and grounding profile?",
                    "question_type": "foundation",
                    "depends_on": [],
                }
            ],
        },
        question_first_run_path=artifact_path,
        output_dir=tmp_path,
    )
    skipped_question = next(question for question in merged["questions"] if question["question_id"] == "q1_foundation")
    assert skipped_question["terminal_state"] == "skipped"
    assert skipped_question["terminal_summary"] == "Skipped due to repeated schema failures."

def test_merge_question_first_run_artifact_keeps_q14_blocked_when_q13_is_missing():
    artifact = {
        "schema_version": "question_first_run_v2",
        "generated_at": "2026-04-10T18:18:42Z",
        "run_started_at": "2026-04-10T18:18:00Z",
        "source": "opencode_agentic_batch",
        "status": "ready",
        "entity": {
            "entity_id": "fc-porto-2027",
            "entity_name": "FC Porto",
            "entity_type": "SPORT_CLUB",
        },
        "question_specs": [
            {
                "question_id": "q7_procurement_signal",
                "question_text": "Is there evidence FC Porto is buying, reshaping vendors, or changing its commercial or digital ecosystem?",
                "question_type": "procurement_signal",
                "depends_on": [],
            },
            {
                "question_id": "q13_capability_gap",
                "question_text": "What capability gaps or weaknesses are most relevant for FC Porto versus peers?",
                "question_type": "capability_gap",
                "depends_on": ["q7_procurement_signal"],
            },
            {
                "question_id": "q14_yp_fit",
                "question_text": "Where does Yellow Panther fit best for FC Porto?",
                "question_type": "yp_fit",
                "depends_on": ["q13_capability_gap", "q7_procurement_signal"],
            },
        ],
        "answer_records": [
            {
                "question_id": "q7_procurement_signal",
                "question_type": "procurement_signal",
                "validation_state": "validated",
                "signal_type": "PROCUREMENT_SIGNAL",
                "answer": {
                    "kind": "summary",
                    "summary": "FC Porto is actively reshaping its commercial and digital ecosystem.",
                    "raw_structured_output": {
                        "answer": "FC Porto is actively reshaping its commercial and digital ecosystem.",
                        "validation_state": "validated",
                    },
                },
            },
            {
                "question_id": "q13_capability_gap",
                "question_type": "capability_gap",
                "validation_state": "no_signal",
                "signal_type": "CAPABILITY_GAP",
                "answer": {
                    "kind": "summary",
                    "summary": "No capability gaps were inferred.",
                    "raw_structured_output": {
                        "summary": "No capability gaps were inferred.",
                        "validation_state": "no_signal",
                    },
                },
            },
            {
                "question_id": "q14_yp_fit",
                "question_type": "yp_fit",
                "validation_state": "no_signal",
                "signal_type": "YP_FIT",
                "answer": {
                    "kind": "summary",
                    "summary": "No capability-gap inference is available yet for YP fit mapping.",
                    "raw_structured_output": {
                        "answer": "",
                        "summary": "No capability-gap inference is available yet for YP fit mapping.",
                        "notes": "No capability-gap inference is available yet for YP fit mapping.",
                        "context": "No capability-gap inference is available yet for YP fit mapping.",
                        "validation_state": "no_signal",
                    },
                },
            },
        ],
    }

    merged = runner.merge_question_first_run_artifact_into_dossier(dossier_payload={}, artifact=artifact)
    question = next(question for question in merged["questions"] if question["question_id"] == "q14_yp_fit")

    assert question["terminal_state"] == "blocked"
    assert question["terminal_summary"] == "No capability-gap inference is available yet for YP fit mapping."


def test_normalize_answer_record_recovers_minimal_q3_leadership_answer_from_trusted_fallback_candidates():
    question = {
        "question_id": "q3_leadership",
        "question_text": "Who are the key leadership, commercial, partnerships, marketing, digital, technology, and strategy figures at Zimbabwe Cricket?",
        "question_type": "leadership",
        "depends_on": [],
    }
    answer = {
        "question_id": "q3_leadership",
        "question_type": "leadership",
        "validation_state": "failed",
        "signal_type": "LEADERSHIP",
        "notes": "",
        "answer": {
            "kind": "list",
            "summary": None,
            "value": None,
            "raw_structured_output": None,
        },
        "timeout_salvage": {
            "candidate_summary": "Leadership evidence was discovered but the model did not emit structured JSON.",
            "candidate_evidence_urls": [
                "https://en.wikipedia.org/wiki/Zimbabwe_Cricket",
                "https://www.zimcricket.org/",
            ],
            "fallback_candidates": [
                {
                    "name": "Tavengwa Mukuhlani",
                    "title": "Chairman",
                    "source_url": "https://en.wikipedia.org/wiki/Zimbabwe_Cricket",
                    "source_type": "wikipedia",
                },
                {
                    "name": "Wilfred Mukondiwa",
                    "title": "Chief Executive Officer",
                    "source_url": "https://en.wikipedia.org/wiki/Zimbabwe_Cricket",
                    "source_type": "wikipedia",
                },
            ],
        },
    }

    normalized = runner._normalize_answer_record(answer, question)

    assert normalized["terminal_state"] == "answered"
    assert normalized["validation_state"] == "partially_validated"
    assert normalized["answer"]["kind"] == "list"
    assert normalized["answer"]["value"] == [
        {
            "name": "Tavengwa Mukuhlani",
            "title": "Chairman",
            "source_url": "https://en.wikipedia.org/wiki/Zimbabwe_Cricket",
            "source_type": "wikipedia",
        },
        {
            "name": "Wilfred Mukondiwa",
            "title": "Chief Executive Officer",
            "source_url": "https://en.wikipedia.org/wiki/Zimbabwe_Cricket",
            "source_type": "wikipedia",
        },
    ]
    assert "Recovered 2 leadership candidates from trusted fallback sources." in normalized["terminal_summary"]
    assert normalized["answer"]["raw_structured_output"]["sources"] == [
        "https://en.wikipedia.org/wiki/Zimbabwe_Cricket",
        "https://www.zimcricket.org/",
    ]


def test_normalize_answer_record_flattens_existing_q3_candidate_source_urls():
    question = {
        "question_id": "q3_leadership",
        "question_text": "Who are the key leadership figures at Zimbabwe Cricket?",
        "question_type": "leadership",
        "depends_on": [],
    }
    answer = {
        "question_id": "q3_leadership",
        "question_type": "leadership",
        "validation_state": "partially_validated",
        "signal_type": "LEADERSHIP",
        "answer": {
            "kind": "list",
            "summary": "Tavengwa Mukuhlani - Chairman, Wilfred Mukondiwa - Chief Executive Officer",
            "value": None,
            "raw_structured_output": {
                "candidates": [
                    {
                        "name": "Tavengwa Mukuhlani",
                        "title": "Chairman",
                        "source_url": {"url": "https://en.wikipedia.org/wiki/Zimbabwe_Cricket"},
                    },
                    {
                        "name": "Wilfred Mukondiwa",
                        "title": "Chief Executive Officer",
                        "source_url": {"href": "https://www.zimcricket.org/"},
                    },
                ]
            },
        },
        "candidates": [
            {
                "name": "Tavengwa Mukuhlani",
                "title": "Chairman",
                "source_url": {"url": "https://en.wikipedia.org/wiki/Zimbabwe_Cricket"},
            },
            {
                "name": "Wilfred Mukondiwa",
                "title": "Chief Executive Officer",
                "source_url": {"href": "https://www.zimcricket.org/"},
            },
        ],
    }

    normalized = runner._normalize_answer_record(answer, question)

    assert normalized["candidates"][0]["source_url"] == "https://en.wikipedia.org/wiki/Zimbabwe_Cricket"
    assert normalized["candidates"][1]["source_url"] == "https://www.zimcricket.org/"
    assert normalized["answer"]["raw_structured_output"]["candidates"][0]["source_url"] == "https://en.wikipedia.org/wiki/Zimbabwe_Cricket"


def test_normalize_answer_record_leaves_q3_as_no_signal_when_fallback_sources_are_low_trust_only():
    question = {
        "question_id": "q3_leadership",
        "question_text": "Who are the key leadership, commercial, partnerships, marketing, digital, technology, and strategy figures at Zimbabwe Cricket?",
        "question_type": "leadership",
        "depends_on": [],
    }
    answer = {
        "question_id": "q3_leadership",
        "question_type": "leadership",
        "validation_state": "failed",
        "signal_type": "LEADERSHIP",
        "notes": "",
        "answer": {
            "kind": "list",
            "summary": None,
            "value": None,
            "raw_structured_output": None,
        },
        "timeout_salvage": {
            "candidate_summary": "Leadership evidence was discovered but only generic commercial databases were available.",
            "candidate_evidence_urls": [
                "https://www.datanyze.com/companies/zimbabwe-cricket/347630736",
                "https://www.zippia.com/zimbabwe-cricket-careers-1526687/executives/",
            ],
            "fallback_candidates": [
                {
                    "name": "Unknown Executive",
                    "title": "Executive",
                    "source_url": "https://www.datanyze.com/companies/zimbabwe-cricket/347630736",
                    "source_type": "commercial_database",
                },
            ],
        },
    }

    normalized = runner._normalize_answer_record(answer, question)

    assert normalized["terminal_state"] == "no_signal"
    assert normalized["validation_state"] == "no_signal"
    assert normalized["answer"]["value"] is None
    assert "Evidence retained during timeout" not in normalized["terminal_summary"]
    assert "No trusted leadership candidates could be recovered from fallback sources." in normalized["terminal_summary"]


def test_normalize_answer_record_preserves_enriched_poi_fields():
    question = {
        "question_id": "q11_decision_owner",
        "question_text": "Who is the highest probability buyer at Arsenal Football Club given the current commercial and product context?",
        "question_type": "decision_owner",
        "depends_on": [],
    }
    answer = {
        "question_id": "q11_decision_owner",
        "question_type": "decision_owner",
        "validation_state": "validated",
        "signal_type": "DECISION_OWNER",
        "primary_owner": {
            "name": "Juliet Slot",
            "title": "Chief Commercial Officer",
            "linkedin_url": "https://www.linkedin.com/in/juliet-slot/",
            "email": "juliet.slot@arsenal.com",
            "bio": "Chief Commercial Officer leading partnerships, growth, and fan revenue strategy at Arsenal.",
            "recent_post_summary": "Recent LinkedIn activity emphasizes supporter experience, global partnerships, and digital commercial growth.",
            "recent_post_urls": [
                "https://www.linkedin.com/posts/juliet-slot_example-post-1",
            ],
        },
        "supporting_candidates": [
            {
                "name": "Tom Fox",
                "title": "Commercial Director",
                "linkedin_url": "https://www.linkedin.com/in/tom-fox/",
                "bio": "Commercial operator with prior leadership across partnerships and business growth.",
            }
        ],
        "answer": {
            "kind": "summary",
            "summary": "Juliet Slot",
            "value": "Juliet Slot",
            "raw_structured_output": {
                "answer": "Juliet Slot",
                "sources": ["https://www.arsenal.com/"],
            },
        },
        "confidence": 0.95,
    }

    normalized = runner._normalize_answer_record(answer, question)

    assert normalized["primary_owner"]["email"] == "juliet.slot@arsenal.com"
    assert normalized["primary_owner"]["linkedin_url"] == "https://www.linkedin.com/in/juliet-slot/"
    assert "fan revenue strategy" in normalized["primary_owner"]["bio"]
    assert normalized["primary_owner"]["recent_post_urls"] == [
        "https://www.linkedin.com/posts/juliet-slot_example-post-1",
    ]
    assert normalized["supporting_candidates"][0]["linkedin_url"] == "https://www.linkedin.com/in/tom-fox/"


def test_normalize_answer_record_recovers_minimal_q11_decision_owner_answer_from_trusted_fallback_candidates():
    question = {
        "question_id": "q11_decision_owner",
        "question_text": "Who is the highest probability buyer at Zimbabwe Cricket given the current commercial and product context?",
        "question_type": "decision_owner",
        "depends_on": ["q3_leadership", "q6_launch_signal"],
    }
    answer = {
        "question_id": "q11_decision_owner",
        "question_type": "decision_owner",
        "validation_state": "failed",
        "signal_type": "DECISION_OWNER",
        "notes": "",
        "answer": {
            "kind": "list",
            "summary": None,
            "value": None,
            "raw_structured_output": None,
        },
        "timeout_salvage": {
            "candidate_summary": "Decision-owner evidence was discovered but the model did not emit structured JSON.",
            "candidate_evidence_urls": [
                "https://www.linkedin.com/company/zimbabwe-cricket/",
                "https://en.wikipedia.org/wiki/Zimbabwe_Cricket",
            ],
            "fallback_candidates": [
                {
                    "name": "Wilfred Mukondiwa",
                    "title": "Chief Executive Officer",
                    "source_url": "https://en.wikipedia.org/wiki/Zimbabwe_Cricket",
                    "source_type": "wikipedia",
                },
                {
                    "name": "Tavengwa Mukuhlani",
                    "title": "Chairman",
                    "source_url": "https://en.wikipedia.org/wiki/Zimbabwe_Cricket",
                    "source_type": "wikipedia",
                },
            ],
        },
    }

    normalized = runner._normalize_answer_record(answer, question)

    assert normalized["terminal_state"] == "answered"
    assert normalized["validation_state"] == "partially_validated"
    assert normalized["primary_owner"]["name"] == "Wilfred Mukondiwa"
    assert normalized["primary_owner"]["title"] == "Chief Executive Officer"
    assert normalized["supporting_candidates"][0]["name"] == "Tavengwa Mukuhlani"
    assert "Recovered 2 decision-owner candidates from trusted fallback sources." in normalized["terminal_summary"]


def test_normalize_answer_record_prefers_operating_buyer_over_governance_chair_for_q11_fallback():
    question = {
        "question_id": "q11_decision_owner",
        "question_text": "Who is the highest probability buyer at Zimbabwe Cricket given the current commercial and product context?",
        "question_type": "decision_owner",
        "depends_on": ["q3_leadership", "q6_launch_signal"],
    }
    answer = {
        "question_id": "q11_decision_owner",
        "question_type": "decision_owner",
        "validation_state": "failed",
        "signal_type": "DECISION_OWNER",
        "notes": "",
        "answer": {
            "kind": "list",
            "summary": None,
            "value": None,
            "raw_structured_output": None,
        },
        "timeout_salvage": {
            "candidate_summary": "Leadership evidence was discovered but the model did not emit structured JSON.",
            "candidate_evidence_urls": [
                {"url": "https://www.heraldonline.co.zw/mukuhlani-re-elected-zc-chairman/"},
                {"url": "https://en.wikipedia.org/wiki/Zimbabwe_Cricket"},
            ],
            "fallback_candidates": [
                {
                    "name": "Tavengwa Mukuhlani",
                    "title": "Chairman",
                    "source_url": {"url": "https://www.heraldonline.co.zw/mukuhlani-re-elected-zc-chairman/"},
                    "source_type": "news",
                },
                {
                    "name": "Wilfred Mukondiwa",
                    "title": "Chief Executive Officer",
                    "source_url": {"url": "https://en.wikipedia.org/wiki/Zimbabwe_Cricket"},
                    "source_type": "wikipedia",
                },
            ],
        },
    }

    normalized = runner._normalize_answer_record(answer, question)

    assert normalized["primary_owner"]["name"] == "Wilfred Mukondiwa"
    assert normalized["primary_owner"]["source_url"] == "https://en.wikipedia.org/wiki/Zimbabwe_Cricket"
    assert normalized["supporting_candidates"][0]["name"] == "Tavengwa Mukuhlani"


def test_normalize_answer_record_leaves_q11_as_no_signal_when_fallback_sources_are_low_trust_only():
    question = {
        "question_id": "q11_decision_owner",
        "question_text": "Who is the highest probability buyer at Zimbabwe Cricket given the current commercial and product context?",
        "question_type": "decision_owner",
        "depends_on": ["q3_leadership", "q6_launch_signal"],
    }
    answer = {
        "question_id": "q11_decision_owner",
        "question_type": "decision_owner",
        "validation_state": "failed",
        "signal_type": "DECISION_OWNER",
        "notes": "",
        "answer": {
            "kind": "list",
            "summary": None,
            "value": None,
            "raw_structured_output": None,
        },
        "timeout_salvage": {
            "candidate_summary": "Only generic commercial database evidence was available.",
            "candidate_evidence_urls": [
                "https://www.datanyze.com/companies/zimbabwe-cricket/347630736",
            ],
            "fallback_candidates": [
                {
                    "name": "Unknown Executive",
                    "title": "Executive",
                    "source_url": "https://www.datanyze.com/companies/zimbabwe-cricket/347630736",
                    "source_type": "commercial_database",
                },
            ],
        },
    }

    normalized = runner._normalize_answer_record(answer, question)

    assert normalized["terminal_state"] == "no_signal"
    assert normalized["validation_state"] == "no_signal"


def test_derive_dossier_quality_summary_ignores_entity_type_inapplicable_blockers():
    merged_dossier = {
        "questions": [
            {
                "question_id": "q1_foundation",
                "terminal_state": "answered",
                "question_first_answer": {"terminal_state": "answered"},
            },
            {
                "question_id": "q8_explicit_rfp",
                "terminal_state": "blocked",
                "terminal_summary": "Question conditions were not met: entity type SPORT_FEDERATION is outside SPORT_CLUB, SPORT_LEAGUE.",
                "question_first_answer": {
                    "terminal_state": "blocked",
                    "terminal_summary": "Question conditions were not met: entity type SPORT_FEDERATION is outside SPORT_CLUB, SPORT_LEAGUE.",
                },
            },
        ]
    }

    summary = runner._derive_dossier_quality_summary(merged_dossier=merged_dossier, expected_question_count=2)

    assert summary["quality_state"] == "complete"
    assert summary["quality_blockers"] == []


def test_publish_question_first_dossier_reports_rejects_checkpoint_inconsistent_candidate(tmp_path):
    output_dir = tmp_path / "out"
    output_dir.mkdir(parents=True, exist_ok=True)

    staged_payload = {
        "entity_id": "zimbabwe-cricket",
        "entity_name": "Zimbabwe Cricket",
        "questions_answered": 15,
        "generated_at": "2026-04-09T13:07:09.474Z",
        "merged_dossier": {
            "quality_state": "blocked",
            "question_first": {
                "questions_answered": 15,
                "checkpoint_consistent": False,
                "non_terminal_question_ids": ["q3_leadership"],
                "publish_status": "draft",
            },
            "question_first_run": {
                "answer_records": [
                    {"question_id": "q1_foundation", "validation_state": "validated", "answer": "1981"},
                    {"question_id": "q3_leadership", "validation_state": "validated", "answer": "Tavengwa Mukuhlani"},
                ]
            },
        },
        "run_rollup": {
            "questions_validated": 10,
            "questions_no_signal": 2,
        },
    }

    publish = runner._publish_question_first_dossier_reports(
        output_dir=output_dir,
        entity_id="zimbabwe-cricket",
        json_payload=staged_payload,
        plain_text_report="checkpoint inconsistent",
        min_question_count=15,
    )

    assert publish["publish_status"] == "staged"
    assert Path(publish["json_report_path"]).name.endswith(".staged.json")
    assert not (output_dir / "zimbabwe-cricket_question_first_dossier.json").exists()
