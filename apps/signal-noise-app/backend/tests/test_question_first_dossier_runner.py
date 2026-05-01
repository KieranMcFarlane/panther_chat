import asyncio
import json
import sys
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
            "tracker_path": str(path.with_name("major-league-cricket_tracker.json")),
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
                "tracker_path": payload["run_rollup"]["tracker_path"],
            }
        },
        "question_first": {
            "enabled": True,
            "schema_version": "question_first_run_v1",
            "questions_answered": len(answers),
            "categories": categories,
            "answers": answers,
            "run_rollup": payload["run_rollup"],
            "question_source_path": "backend/data/question_sources/major_league_cricket.json",
            "tracker_path": payload["run_rollup"]["tracker_path"],
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


def test_find_latest_question_first_run_artifact_picks_timestamped_artifact(tmp_path):
    older = tmp_path / "major-league-cricket_opencode_batch_20260330_150000_question_first_run_v1.json"
    newer = tmp_path / "major-league-cricket_opencode_batch_20260330_150956_question_first_run_v1.json"
    older.write_text("{}", encoding="utf-8")
    newer.write_text("{}", encoding="utf-8")

    found = runner._find_latest_question_first_run_artifact(tmp_path)

    assert found == newer


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
    assert result["question_first"]["tracker_path"].endswith("major-league-cricket_tracker.json")
    assert result["question_first_run"]["schema_version"] == "question_first_run_v1"
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
async def test_run_question_first_dossier_from_payload_uses_launch_source_payload_for_opencode(tmp_path, monkeypatch):
    artifact_path = tmp_path / "question_first_run.json"
    _write_question_first_run_artifact(
        artifact_path,
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        questions=[{"question_id": "q1", "question_text": "Foundation question"}],
        answers=[],
        categories=[],
    )

    captured = {}

    class _FakeStream:
        def __init__(self, lines):
            self._lines = [line.encode("utf-8") for line in lines]

        async def readline(self):
            if not self._lines:
                return b""
            return self._lines.pop(0)

    class _FakeProcess:
        stdout = _FakeStream([json.dumps({"question_first_run_path": str(artifact_path)}) + "\n"])
        stderr = _FakeStream([])
        returncode = 0

        async def wait(self):
            return self.returncode

    async def fake_create_subprocess_exec(*args, **kwargs):
        source_path = Path(args[args.index("--question-source") + 1])
        captured["launched_source"] = json.loads(source_path.read_text(encoding="utf-8"))
        return _FakeProcess()

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    source_payload = {
        "entity_id": "arsenal-fc",
        "entity_name": "Arsenal FC",
        "questions": [
            {"question_id": "q1", "question_text": "Foundation question"},
            {"question_id": "q2", "question_text": "Commercial question"},
        ],
    }
    launch_source_payload = {
        **source_payload,
        "questions": [{"question_id": "q1", "question_text": "Foundation question"}],
    }

    await runner.run_question_first_dossier_from_payload(
        source_payload=source_payload,
        launch_source_payload=launch_source_payload,
        output_dir=tmp_path,
    )

    assert [question["question_id"] for question in captured["launched_source"]["questions"]] == ["q1"]


@pytest.mark.asyncio
async def test_run_question_first_dossier_from_payload_passes_checkpoint_and_resume_flag(tmp_path, monkeypatch):
    artifact_path = tmp_path / "question_first_run.json"
    _write_question_first_run_artifact(
        artifact_path,
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        questions=[{"question_id": "q2", "question_text": "Digital question"}],
        answers=[],
        categories=[],
    )

    captured = {}

    class _FakeStream:
        def __init__(self, lines):
            self._lines = [line.encode("utf-8") for line in lines]

        async def readline(self):
            if not self._lines:
                return b""
            return self._lines.pop(0)

    class _FakeProcess:
        stdout = _FakeStream([json.dumps({"question_first_run_path": str(artifact_path)}) + "\n"])
        stderr = _FakeStream([])
        returncode = 0

        async def wait(self):
            return self.returncode

    async def fake_create_subprocess_exec(*args, **kwargs):
        source_path = Path(args[args.index("--question-source") + 1])
        captured["args"] = list(args)
        captured["launched_source"] = json.loads(source_path.read_text(encoding="utf-8"))
        return _FakeProcess()

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    checkpoint = {
        "questions_total": 15,
        "questions_answered": 1,
        "last_completed_question_id": "q1_identity",
        "next_question_id": "q2_digital_stack",
        "answer_records": [
            {
                "question_id": "q1_identity",
                "validation_state": "validated",
                "status": "answered",
            }
        ],
    }
    source_payload = {
        "entity_id": "arsenal-fc",
        "entity_name": "Arsenal FC",
        "questions": [
            {"question_id": "q1_identity", "question_text": "Identity question"},
            {"question_id": "q2_digital_stack", "question_text": "Digital question"},
        ],
    }

    await runner.run_question_first_dossier_from_payload(
        source_payload=source_payload,
        output_dir=tmp_path,
        question_first_checkpoint=checkpoint,
        resume=True,
    )

    assert "--resume" in captured["args"]
    assert captured["launched_source"]["question_first_checkpoint"] == checkpoint
    assert captured["launched_source"]["metadata"]["question_first_checkpoint"] == checkpoint


@pytest.mark.asyncio
async def test_question_first_runner_streams_opencode_progress_events(tmp_path, monkeypatch):
    artifact_path = tmp_path / "major-league-cricket_question_first_run_v1.json"
    _write_question_first_run_artifact(
        artifact_path,
        entity_id="major-league-cricket",
        entity_name="Major League Cricket",
        questions=[
            {
                "question_id": "q1",
                "section_id": "core_information",
                "question_text": "When was Major League Cricket founded?",
            }
        ],
        answers=[
            {
                "question_id": "q1",
                "section_id": "core_information",
                "question_text": "When was Major League Cricket founded?",
                "search_query": '"Major League Cricket" founded',
                "search_hit": True,
                "search_results_count": 1,
                "scrape_url": "https://www.majorleaguecricket.com/",
                "answer": "2023",
                "confidence": 0.91,
                "evidence_url": "https://www.majorleaguecricket.com/",
                "reasoning_model_used": "opencode",
                "retry_count": 0,
                "category": "identity",
                "search_queries": ['"Major League Cricket" founded'],
                "search_attempts": [{"query": '"Major League Cricket" founded', "status": "success", "result_count": 1}],
                "validation_state": "validated",
                "signal_type": "FOUNDATION",
                "evidence_grade": "strong",
                "structured_signal": {
                    "named_entities": [
                        {
                            "name": "Major League Cricket",
                            "evidence_url": "https://www.majorleaguecricket.com/",
                            "evidence_kind": "official_site",
                            "summary": "Official site confirms the entity profile.",
                        }
                    ]
                },
                "procurement_model": "unknown",
                "commercial_implication": "Official grounding supports commercial targeting.",
                "signal_density": 0.66,
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
        "entity_id": "major-league-cricket",
        "entity_name": "Major League Cricket",
        "entity_type": "SPORT_LEAGUE",
        "questions": [
            {
                "question_id": "q1",
                "question_text": "When was Major League Cricket founded?",
            }
        ],
    }

    class _FakeStream:
        def __init__(self, lines):
            self._lines = [line.encode("utf-8") for line in lines]

        async def readline(self):
            if not self._lines:
                return b""
            return self._lines.pop(0)

    class _FakeProcess:
        def __init__(self, stdout_lines):
            self.stdout = _FakeStream(stdout_lines)
            self.stderr = _FakeStream([])
            self.returncode = 0

        async def wait(self):
            return self.returncode

    stdout_lines = [
        '{"event_type":"question_progress","phase":"dossier_generation","current_substep":"question_first_running","current_substep_label":"Question-first running","current_question_id":"q1","current_question_text":"When was Major League Cricket founded?","questions_answered":1,"questions_total":1,"current_substep_progress":"1/1 questions"}\n',
        json.dumps({"question_first_run_path": str(artifact_path)}) + "\n",
    ]

    async def fake_create_subprocess_exec(*args, **kwargs):
        return _FakeProcess(stdout_lines)

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    events = []

    async def progress_callback(event):
        events.append(event)

    result = await runner.run_question_first_dossier_from_payload(
        source_payload=source_payload,
        output_dir=tmp_path,
        progress_callback=progress_callback,
    )

    assert result["question_first"]["questions_answered"] == 1
    assert events
    assert events[0]["current_question_id"] == "q1"
    assert events[0]["current_question_text"] == "When was Major League Cricket founded?"
    assert events[0]["current_execution_state"] == "searching sources"
    assert events[0]["current_substep_progress"] == "1/1 questions"
    assert result["questions"][0]["question_first_answer"]["evidence_grade"] == "strong"
    assert result["questions"][0]["question_first_answer"]["commercial_implication"] == "Official grounding supports commercial targeting."
    assert result["questions"][0]["question_first_answer"]["signal_density"] == 0.66
