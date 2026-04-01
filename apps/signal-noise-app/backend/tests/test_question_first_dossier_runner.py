import asyncio
import json
import sys
import threading
import time
from pathlib import Path

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


def _write_question_first_run_artifact(path, *, entity_id, entity_name, questions, answers, categories):
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
    payload = {
        "schema_version": "question_first_run_v1",
        "generated_at": "2026-03-30T00:00:00+00:00",
        "run_started_at": "2026-03-30T00:00:00+00:00",
        "source": "opencode_agentic_batch",
        "status": "ready",
        "warnings": [],
        "entity": {
            "entity_id": entity_id,
            "entity_name": entity_name,
            "entity_type": "SPORT_LEAGUE",
        },
        "preset": "major-league-cricket",
        "question_source_path": "backend/data/question_sources/major_league_cricket.json",
        "questions": questions,
        "answers": answers,
        "evidence_items": evidence_items,
        "promotion_candidates": promotion_candidates,
        "categories": categories,
        "run_rollup": {
            "questions_total": len(answers),
            "questions_validated": sum(1 for answer in answers if answer.get("validation_state") == "validated"),
            "questions_no_signal": sum(1 for answer in answers if answer.get("validation_state") == "no_signal"),
            "questions_provisional": sum(1 for answer in answers if answer.get("validation_state") == "provisional"),
            "entity_id": entity_id,
            "entity_name": entity_name,
            "entity_type": "SPORT_LEAGUE",
            "preset": "major-league-cricket",
        },
    }
    payload["merge_patch"] = {
        "metadata": {
            "question_first": {
                "enabled": True,
                "schema_version": "question_first_run_v1",
                "questions_answered": len(answers),
                "categories": categories,
                "question_source_path": "backend/data/question_sources/major_league_cricket.json",
                "generated_at": "2026-03-30T00:00:00+00:00",
                "run_rollup": payload["run_rollup"],
                "evidence_items": evidence_items,
                "promotion_candidates": promotion_candidates,
            }
        },
        "question_first": {
            "enabled": True,
            "schema_version": "question_first_run_v1",
            "questions_answered": len(answers),
            "categories": categories,
            "answers": answers,
            "evidence_items": evidence_items,
            "promotion_candidates": promotion_candidates,
            "run_rollup": payload["run_rollup"],
            "question_source_path": "backend/data/question_sources/major_league_cricket.json",
            "generated_at": "2026-03-30T00:00:00+00:00",
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
    artifact_path = output_dir / "leedsunited_question_first_run_v1.json"
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
    assert result["question_first"]["schema_version"] == "question_first_run_v1"
    assert result["question_first"]["questions_answered"] == 1
    assert result["question_first"]["evidence_items"][0]["promotion_target"] == "profile"
    assert result["question_first"]["promotion_candidates"][0]["promotion_candidate"] is True
    assert result["question_first"]["dossier_promotions"][0]["question_id"] == "q1"
    assert result["question_first"]["discovery_summary"]["promoted_count"] == 1
    assert result["question_first_run"]["schema_version"] == "question_first_run_v1"
    assert result["question_first_run"]["evidence_items"][0]["promotion_target"] == "profile"
    assert result["question_first_run"]["promotion_candidates"][0]["promotion_candidate"] is True
    assert result["dossier_promotions"][0]["question_id"] == "q1"
    assert result["discovery_summary"]["profile"][0]["candidate_id"] == "q1:profile"
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
