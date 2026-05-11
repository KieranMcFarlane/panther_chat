import json
import os
import sys
from pathlib import Path
from types import SimpleNamespace
import time
from datetime import datetime, timedelta, timezone

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import entity_pipeline_worker as worker_module
from entity_pipeline_worker import (
    build_batch_claim_metadata,
    build_batch_heartbeat_metadata,
    build_batch_retry_update,
    build_batch_completed_update,
    build_batch_failed_update,
    build_batch_running_update,
    build_run_start_metadata,
    build_run_success_metadata,
    build_run_exhausted_retry_metadata,
    build_run_retry_metadata,
    choose_supabase_key,
    build_run_detail_url,
    should_defer_retry_for_fresh_backend_heartbeat,
    load_worker_environment,
    merge_pipeline_run_metadata,
    merge_cached_entity_properties,
    derive_discovery_context,
    derive_monitoring_summary,
    normalize_pipeline_control_state_for_worker_start,
    build_post_batch_idle_control_state,
    should_skip_manifest_auto_advance_for_batch_metadata,
    _mark_recovery_state,
    resolve_pipeline_timeout,
    resolve_fastapi_url,
    read_pipeline_control_state,
    write_pipeline_control_state,
    should_process_in_process,
    EntityPipelineWorker,
    merge_question_repair_result_into_persisted_dossier,
    select_question_repair_merge_base,
)


def test_entity_pipeline_worker_prefers_local_postgres_when_database_url_is_set(monkeypatch):
    fake_client = SimpleNamespace(source="local-postgres")
    remote_calls = []

    monkeypatch.setenv("DATABASE_URL", "postgresql://localhost/signal_noise_app")
    monkeypatch.setenv("SUPABASE_URL", "https://hosted.supabase.co")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "remote-anon")
    monkeypatch.delenv("PYTHON_PERSISTENCE_BACKEND", raising=False)
    monkeypatch.setattr(worker_module, "create_local_pg_client", lambda: fake_client, raising=False)
    monkeypatch.setattr(
        worker_module,
        "create_client",
        lambda *_args, **_kwargs: remote_calls.append(_args) or SimpleNamespace(source="remote"),
        raising=False,
    )

    worker = EntityPipelineWorker()

    assert worker.supabase is fake_client
    assert remote_calls == []


def test_should_process_in_process_defaults_to_durable_worker_mode():
    assert should_process_in_process(None) is False
    assert should_process_in_process("in_process") is True


def test_merge_question_repair_result_into_persisted_dossier_preserves_full_questions():
    existing = {
        "entity_id": "exeter-city",
        "question_first": {
            "answers": [
                {"question_id": "q1_foundation", "answer": "Exeter City", "validation_state": "validated"},
                {"question_id": "q3_leadership", "answer": "stale", "validation_state": "failed"},
            ],
            "questions_answered": 2,
        },
        "questions": [
            {"question_id": "q1_foundation", "answer": "Exeter City", "validation_state": "validated"},
            {"question_id": "q2_digital_stack", "answer": "site", "validation_state": "validated"},
            {"question_id": "q3_leadership", "answer": "stale", "validation_state": "failed"},
        ],
    }
    repair = {
        "question_first": {
            "answers": [
                {
                    "question_id": "q3_leadership",
                    "answer": "Matt Kimberley is Head of Commercial.",
                    "validation_state": "validated",
                    "confidence": 0.9,
                    "primary_owner": {"name": "Matt Kimberley", "title": "Head of Commercial"},
                }
            ],
            "repair_run": {"mode": "question", "question_id": "q3_leadership"},
        },
        "questions": [
            {
                "question_id": "q3_leadership",
                "answer": "Matt Kimberley is Head of Commercial.",
                "validation_state": "validated",
                "confidence": 0.9,
            }
        ],
    }

    merged = merge_question_repair_result_into_persisted_dossier(
        existing_dossier=existing,
        repair_dossier=repair,
        question_id="q3_leadership",
    )

    assert len(merged["questions"]) == 3
    answers_by_id = {answer["question_id"]: answer for answer in merged["question_first"]["answers"]}
    questions_by_id = {question["question_id"]: question for question in merged["questions"]}
    assert answers_by_id["q1_foundation"]["answer"] == "Exeter City"
    assert answers_by_id["q3_leadership"]["validation_state"] == "validated"
    assert answers_by_id["q3_leadership"]["primary_owner"]["name"] == "Matt Kimberley"
    assert questions_by_id["q2_digital_stack"]["answer"] == "site"
    assert questions_by_id["q3_leadership"]["validation_state"] == "validated"
    assert should_process_in_process("durable_worker") is False


def test_merge_question_repair_result_rehydrates_answers_from_question_shells():
    existing = {
        "entity_id": "swiss-cricket",
        "question_first": {
            "answers": [
                {"question_id": "q9_news_signal", "answer": "old one-question answer", "validation_state": "failed"},
            ],
            "questions_answered": 1,
        },
        "questions": [
            {
                "question_id": f"q{i}_test",
                "question_first_answer": {
                    "question_id": f"q{i}_test",
                    "answer": f"answer {i}",
                    "validation_state": "failed",
                    "confidence": 0,
                },
            }
            for i in range(1, 15)
        ] + [
            {
                "question_id": "q9_news_signal",
                "question_first_answer": {
                    "question_id": "q9_news_signal",
                    "answer": "old q9",
                    "validation_state": "failed",
                    "confidence": 0,
                },
            }
        ],
    }
    repair = {
        "question_first": {
            "answers": [
                {
                    "question_id": "q9_news_signal",
                    "answer": "checked no current commercial news",
                    "validation_state": "no_signal",
                    "confidence": 0,
                    "structured_signal": {"status": "source_prefetch_empty"},
                }
            ],
        },
        "questions": [
            {
                "question_id": "q9_news_signal",
                "answer": "checked no current commercial news",
                "validation_state": "no_signal",
                "confidence": 0,
            }
        ],
    }

    merged = merge_question_repair_result_into_persisted_dossier(
        existing_dossier=existing,
        repair_dossier=repair,
        question_id="q9_news_signal",
    )

    answers_by_id = {answer["question_id"]: answer for answer in merged["question_first"]["answers"]}
    assert len(answers_by_id) == 15
    assert merged["question_first"]["questions_answered"] == 15
    assert answers_by_id["q1_test"]["answer"] == "answer 1"
    assert answers_by_id["q9_news_signal"]["validation_state"] == "no_signal"
    assert answers_by_id["q9_news_signal"]["structured_signal"]["status"] == "source_prefetch_empty"


def test_select_question_repair_merge_base_prefers_richer_repair_source_snapshot():
    persisted_after_one_question_overwrite = {
        "entity_id": "swiss-cricket",
        "question_first": {
            "answers": [
                {"question_id": "q9_news_signal", "answer": "new q9 only", "validation_state": "no_signal"},
            ],
            "questions_answered": 1,
        },
        "questions": [{"question_id": f"q{i}_test"} for i in range(1, 16)],
    }
    repair_source_snapshot = {
        "entity_id": "swiss-cricket",
        "question_first": {
            "answers": [
                {
                    "question_id": f"q{i}_test",
                    "answer": f"full-pack answer {i}",
                    "validation_state": "validated",
                }
                for i in range(1, 16)
            ],
            "questions_answered": 15,
        },
        "questions": [{"question_id": f"q{i}_test"} for i in range(1, 16)],
    }

    selected = select_question_repair_merge_base(
        existing_dossier=persisted_after_one_question_overwrite,
        repair_source_dossier=repair_source_snapshot,
    )

    assert selected is repair_source_snapshot
    assert len(selected["question_first"]["answers"]) == 15


def test_build_run_detail_url_points_to_import_run_detail_page():
    assert (
        build_run_detail_url("batch-1", "entity-1")
        == "/entity-import/batch-1/entity-1"
    )


def test_mark_recovery_state_preserves_last_self_heal_fields_when_not_overridden():
    payload = {
        "state": "recovering",
        "health_class": "recovering",
        "recovery_source": "provider_auto_resume",
        "last_self_heal_action": "provider_auto_resume",
        "last_self_heal_reason": "provider preflight recovered",
        "last_self_heal_at": "2026-05-03T12:00:00+00:00",
    }

    updated = _mark_recovery_state(
        payload,
        state="healthy",
        health_class="healthy",
        recovery_source="queued_claim",
    )

    assert updated["state"] == "healthy"
    assert updated["health_class"] == "healthy"
    assert updated["recovery_source"] == "queued_claim"
    assert updated["last_self_heal_action"] == "provider_auto_resume"
    assert updated["last_self_heal_reason"] == "provider preflight recovered"
    assert updated["last_self_heal_at"] == "2026-05-03T12:00:00+00:00"


def test_should_defer_retry_for_fresh_backend_heartbeat_on_client_timeout():
    now_iso = datetime.now(timezone.utc).isoformat()

    assert should_defer_retry_for_fresh_backend_heartbeat(
        error_type="timeout",
        metadata={
            "backend_run_token": "backend-run-1",
            "backend_heartbeat_at": now_iso,
        },
        now_iso=now_iso,
        stale_seconds=300,
    ) is True


def test_should_not_defer_retry_without_fresh_backend_heartbeat():
    now_iso = datetime.now(timezone.utc).isoformat()
    stale_iso = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()

    assert should_defer_retry_for_fresh_backend_heartbeat(
        error_type="timeout",
        metadata={
            "backend_run_token": "backend-run-1",
            "backend_heartbeat_at": stale_iso,
        },
        now_iso=now_iso,
        stale_seconds=300,
    ) is False
    assert should_defer_retry_for_fresh_backend_heartbeat(
        error_type="value_error",
        metadata={
            "backend_run_token": "backend-run-1",
            "backend_heartbeat_at": now_iso,
        },
        now_iso=now_iso,
        stale_seconds=300,
    ) is False


def test_merge_cached_entity_properties_persists_pipeline_status_fields():
    merged = merge_cached_entity_properties(
        {"name": "International Canoe Federation"},
        batch_id="batch-1",
        entity_id="icf",
        status="completed",
        sales_readiness="MONITOR",
        rfp_count=2,
        dossier={"entity_id": "icf"},
    )

    assert merged["last_pipeline_batch_id"] == "batch-1"
    assert merged["last_pipeline_run_detail_url"] == "/entity-import/batch-1/icf"
    assert merged["last_pipeline_status"] == "completed"
    assert merged["rfp_count"] == 2
    assert merged["sales_readiness"] == "MONITOR"
    assert merged["dossier_data"] is not None


def test_sync_cached_entity_uses_source_lookup_when_entity_id_is_not_uuid(monkeypatch):
    calls = []

    class _FakeQuery:
        def __init__(self):
            self.action = None

        def select(self, *_args, **_kwargs):
            calls.append(("select", _args))
            return self

        def eq(self, column, value):
            calls.append(("eq", column, value))
            if value == "arsenal-fc":
                raise AssertionError("sync_cached_entity should not query canonical_entities.id with a slug entity_id")
            return self

        def contains(self, column, value):
            calls.append(("contains", column, value))
            return self

        def limit(self, *_args, **_kwargs):
            return self

        def execute(self):
            if calls and calls[-1][0] == "contains":
                return SimpleNamespace(data=[{"id": "11111111-1111-1111-1111-111111111111", "properties": {}}])
            return SimpleNamespace(data=[])

        def update(self, *_args, **_kwargs):
            calls.append(("update", _args))
            return self

    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker.supabase = SimpleNamespace(table=lambda _name: _FakeQuery())
    worker._safe_execute = lambda operation, context: operation() or True

    worker.sync_cached_entity(
        "batch-1",
        {"entity_id": "arsenal-fc", "metadata": {}},
        {"sales_readiness": "MONITOR", "rfp_count": 0, "artifacts": {"dossier": {"entity_id": "arsenal-fc"}}},
        "completed",
    )

    assert any(call[0] == "contains" for call in calls)
    assert not any(call[0] == "eq" and call[2] == "arsenal-fc" for call in calls)


def test_choose_supabase_key_prefers_anon_key_when_service_role_missing():
    assert choose_supabase_key(
        service_role_key=None,
        anon_key="anon-key",
        public_anon_key="public-anon-key",
    ) == "anon-key"


def test_load_manifest_entities_ignores_live_scale_manifest_for_worker_order(monkeypatch):
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)

    class _FakeQuery:
        def select(self, *_args, **_kwargs):
            return self

        def range(self, *_args, **_kwargs):
            return self

        def execute(self):
            return SimpleNamespace(
                data=[
                    {"id": "entity-b", "name": "Entity B", "entity_type": "CLUB", "properties": {}, "source_neo4j_ids": []},
                    {"id": "entity-a", "name": "Entity A", "entity_type": "LEAGUE", "properties": {}, "source_neo4j_ids": []},
                ]
            )

    worker.supabase = SimpleNamespace(table=lambda _name: _FakeQuery())

    manifest_payload = {
        "entities": [
            {"entity_id": "entity-b", "entity_name": "Entity B", "entity_type": "CLUB"},
            {"entity_id": "entity-a", "entity_name": "Entity A", "entity_type": "LEAGUE"},
        ]
    }

    monkeypatch.setattr(
        worker_module.Path,
        "exists",
        lambda self: str(self).endswith("question_first_scale_batch_3000_live.json"),
    )
    monkeypatch.setattr(
        worker_module.Path,
        "read_text",
        lambda self, encoding="utf-8": json.dumps(manifest_payload),
    )

    entities = worker._load_manifest_entities()

    assert [entity["entity_id"] for entity in entities] == ["entity-a", "entity-b"]
    assert [entity["canonical_entity_id"] for entity in entities] == ["entity-a", "entity-b"]


def test_load_manifest_entities_sorts_canonical_entities_by_id_when_manifest_missing(monkeypatch):
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)

    class _FakeQuery:
        def select(self, *_args, **_kwargs):
            return self

        def range(self, *_args, **_kwargs):
            return self

        def execute(self):
            return SimpleNamespace(
                data=[
                    {"id": "entity-b", "name": "Entity B", "entity_type": "CLUB", "properties": {}, "source_neo4j_ids": []},
                    {"id": "entity-a", "name": "Entity A", "entity_type": "LEAGUE", "properties": {}, "source_neo4j_ids": []},
                ]
            )

    worker.supabase = SimpleNamespace(table=lambda _name: _FakeQuery())

    monkeypatch.setattr(worker_module.Path, "exists", lambda self: False)

    entities = worker._load_manifest_entities()

    assert [entity["entity_id"] for entity in entities] == ["entity-a", "entity-b"]


def test_resolve_fastapi_url_prefers_ipv4_loopback_default():
    assert resolve_fastapi_url(None, None) == "http://127.0.0.1:8000"
    assert resolve_fastapi_url("http://localhost:8000", None) == "http://127.0.0.1:8000"


def test_worker_module_uses_longer_default_pipeline_timeout():
    import entity_pipeline_worker as worker_module

    assert worker_module.PIPELINE_TIMEOUT_SECONDS == 1800
    assert worker_module.MAX_RUN_ATTEMPTS == 3
    assert worker_module.STALE_MINUTES == 5


def test_resolve_pipeline_timeout_supports_no_timeout_mode():
    assert resolve_pipeline_timeout(1800) == 1800
    assert resolve_pipeline_timeout(1) == 1
    assert resolve_pipeline_timeout(0) is None
    assert resolve_pipeline_timeout(-1) is None


def test_load_worker_environment_reads_local_dotenv(tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text("ENTITY_IMPORT_QUEUE_MODE=durable_worker\nSUPABASE_ANON_KEY=anon-key\n", encoding="utf-8")

    monkeypatch.delenv("ENTITY_IMPORT_QUEUE_MODE", raising=False)
    monkeypatch.delenv("SUPABASE_ANON_KEY", raising=False)

    load_worker_environment(env_file)

    assert os.environ["ENTITY_IMPORT_QUEUE_MODE"] == "durable_worker"
    assert os.environ["SUPABASE_ANON_KEY"] == "anon-key"


def test_read_pipeline_control_state_defaults_to_running_when_missing(tmp_path, monkeypatch):
    monkeypatch.setattr("entity_pipeline_worker.PIPELINE_CONTROL_STATE_PATH", tmp_path / "missing.json")
    monkeypatch.setattr("entity_pipeline_worker.should_use_local_pg", lambda: False)

    assert read_pipeline_control_state()["is_paused"] is False


def test_read_pipeline_control_state_ignores_legacy_manual_pause_file(tmp_path, monkeypatch):
    control_path = tmp_path / "pipeline-control-state.json"
    control_path.write_text('{"is_paused": true, "pause_reason": "Paused from Live Ops", "requested_state": "paused", "observed_state": "paused", "transition_state": "paused"}', encoding="utf-8")
    monkeypatch.setattr("entity_pipeline_worker.PIPELINE_CONTROL_STATE_PATH", control_path)
    monkeypatch.setattr("entity_pipeline_worker.should_use_local_pg", lambda: False)

    state = read_pipeline_control_state()

    assert state["is_paused"] is False
    assert state["pause_reason"] is None
    assert state["requested_state"] == "running"
    assert state["observed_state"] == "running"
    assert state["transition_state"] == "running"


def test_read_pipeline_control_state_preserves_worker_stop_pause_file(tmp_path, monkeypatch):
    control_path = tmp_path / "pipeline-control-state.json"
    control_path.write_text(
        json.dumps(
            {
                "is_paused": True,
                "pause_reason": "orchestrator unhealthy",
                "stop_reason": "orchestrator_unhealthy",
                "requested_state": "paused",
                "observed_state": "paused",
                "transition_state": "paused",
                "desired_state": "paused",
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr("entity_pipeline_worker.PIPELINE_CONTROL_STATE_PATH", control_path)
    monkeypatch.setattr("entity_pipeline_worker.should_use_local_pg", lambda: False)

    state = read_pipeline_control_state()

    assert state["is_paused"] is False
    assert state["pause_reason"] is None
    assert state["stop_reason"] is None
    assert state["requested_state"] == "running"


def test_read_pipeline_control_state_exposes_ignition_transition_fields(tmp_path, monkeypatch):
    control_path = tmp_path / "pipeline-control-state.json"
    control_path.write_text(
        json.dumps(
            {
                "is_paused": False,
                "pause_reason": None,
                "updated_at": "2026-04-11T09:00:00+00:00",
                "requested_state": "running",
                "observed_state": "starting",
                "transition_state": "starting",
                "desired_state": "running",
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr("entity_pipeline_worker.PIPELINE_CONTROL_STATE_PATH", control_path)
    monkeypatch.setattr("entity_pipeline_worker.should_use_local_pg", lambda: False)

    state = read_pipeline_control_state()

    assert state["requested_state"] == "running"
    assert state["observed_state"] == "running"
    assert state["transition_state"] == "running"
    assert state["desired_state"] == "running"


def test_post_batch_idle_control_state_preserves_operator_pause():
    state = build_post_batch_idle_control_state(
        {
            "is_paused": True,
            "pause_reason": "maintenance window",
            "requested_state": "paused",
            "observed_state": "running",
            "transition_state": "running",
            "desired_state": "paused",
            "current_batch_id": "batch-1",
            "current_entity_id": "entity-1",
            "current_entity_name": "Paused Entity",
            "current_action": "dossier_generation",
            "current_phase": "dossier_generation",
        },
        now_iso="2026-05-04T21:40:00+00:00",
    )

    assert state["is_paused"] is True
    assert state["pause_reason"] == "maintenance window"
    assert state["requested_state"] == "paused"
    assert state["observed_state"] == "paused"
    assert state["transition_state"] == "paused"
    assert state["current_batch_id"] is None
    assert state["current_entity_id"] is None
    assert state["current_action"] is None


def test_repair_batches_do_not_manifest_auto_advance():
    assert should_skip_manifest_auto_advance_for_batch_metadata({"question_id": "q2_digital_stack"}) is True
    assert should_skip_manifest_auto_advance_for_batch_metadata({"rerun_mode": "question"}) is True
    assert should_skip_manifest_auto_advance_for_batch_metadata({"source": "self_healing_repair"}) is True
    assert should_skip_manifest_auto_advance_for_batch_metadata({"queue_mode": "durable_worker"}) is False


def test_queue_manifest_auto_advance_suppressed_by_supervised_drain_control(monkeypatch):
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker._find_next_manifest_entity = lambda **_kwargs: (_ for _ in ()).throw(
        AssertionError("supervised drain must suppress manifest lookup before selecting next entity")
    )
    monkeypatch.setattr(
        "entity_pipeline_worker.read_pipeline_control_state",
        lambda: {
            "requested_state": "running",
            "observed_state": "running",
            "supervised_drain_enabled": True,
            "supervised_drain_disable_manifest_auto_advance": True,
        },
    )

    queued = worker._queue_manifest_auto_advance(
        batch_id="batch-1",
        source_run={"entity_id": "entity-1", "metadata": {}},
        batch_metadata={"source": "manifest_auto_advance"},
    )

    assert queued is None


def test_read_pipeline_control_state_exposes_cursor_fields(tmp_path, monkeypatch):
    control_path = tmp_path / "pipeline-control-state.json"
    control_path.write_text(
        json.dumps(
            {
                "is_paused": False,
                "pause_reason": None,
                "requested_state": "running",
                "observed_state": "running",
                "transition_state": "running",
                "desired_state": "running",
                "current_batch_id": "batch-1",
                "current_entity_id": "entity-1",
                "current_canonical_entity_id": "entity-1",
                "current_entity_name": "Entity 1",
                "current_question_id": "q1_foundation",
                "current_question_text": "Question text",
                "current_action": "entity_registration",
                "current_phase": "dossier_generation",
                "current_started_at": "2026-04-27T00:00:00+00:00",
                "current_activity_at": "2026-04-27T00:01:00+00:00",
                "cursor_source": "manifest_next_claim",
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr("entity_pipeline_worker.PIPELINE_CONTROL_STATE_PATH", control_path)
    monkeypatch.setattr("entity_pipeline_worker.should_use_local_pg", lambda: False)

    state = read_pipeline_control_state()

    assert state["current_batch_id"] is None
    assert state["current_entity_id"] is None
    assert state["current_canonical_entity_id"] is None
    assert state["current_entity_name"] is None
    assert state["current_question_id"] is None
    assert state["cursor_source"] is None


def test_read_pipeline_control_state_prefers_postgres_singleton_row(monkeypatch):
    monkeypatch.setattr(
        "entity_pipeline_worker._read_pipeline_control_state_from_store",
        lambda: {
            "is_paused": False,
            "pause_reason": None,
            "stop_reason": None,
            "stop_details": None,
            "updated_at": "2026-04-27T12:00:00+00:00",
            "desired_state": "running",
            "requested_state": "running",
            "observed_state": "running",
            "transition_state": "running",
            "current_batch_id": "batch-db",
            "current_entity_id": "entity-db",
            "current_canonical_entity_id": "canonical-db",
            "current_entity_name": "Entity DB",
            "current_question_id": "q11_decision_owner",
            "current_action": "q11_decision_owner",
            "current_phase": "question_first",
            "current_activity_at": "2026-04-27T12:00:00+00:00",
            "cursor_source": "manifest_next_claim",
        },
    )

    state = read_pipeline_control_state()

    assert state["current_batch_id"] == "batch-db"
    assert state["current_entity_id"] == "entity-db"
    assert state["current_canonical_entity_id"] == "canonical-db"
    assert state["current_entity_name"] == "Entity DB"
    assert state["cursor_source"] == "manifest_next_claim"


def test_write_pipeline_control_state_persists_cursor_to_postgres_singleton_row(tmp_path, monkeypatch):
    captured = {}

    class _FakeQuery:
        def select(self, *_args, **_kwargs):
            return self

        def eq(self, *_args, **_kwargs):
            return self

        def maybe_single(self):
            return self

        def upsert(self, payload, on_conflict=None):
            captured["payload"] = payload
            captured["on_conflict"] = on_conflict
            return self

        def execute(self):
            return SimpleNamespace(data=[captured.get("payload")])

    class _FakeClient:
        def table(self, _name):
            return _FakeQuery()

    monkeypatch.setattr("entity_pipeline_worker.should_use_local_pg", lambda: True)
    monkeypatch.setattr("entity_pipeline_worker.create_local_pg_client", lambda: _FakeClient())
    control_path = tmp_path / "pipeline-control-state.json"
    monkeypatch.setattr("entity_pipeline_worker.PIPELINE_CONTROL_STATE_PATH", control_path)
    monkeypatch.setattr(
        "entity_pipeline_worker.read_pipeline_control_state",
        lambda: {
            "is_paused": False,
            "pause_reason": None,
            "stop_reason": None,
            "stop_details": None,
            "updated_at": "2026-04-27T12:00:00+00:00",
            "desired_state": "running",
            "requested_state": "running",
            "observed_state": "running",
            "transition_state": "running",
            "current_batch_id": "batch-old",
            "current_entity_id": "entity-old",
            "current_canonical_entity_id": "canonical-old",
            "current_entity_name": "Entity Old",
            "current_question_id": "q1_foundation",
            "current_question_text": "What is this?",
            "current_action": "q1_foundation",
            "current_phase": "question_first",
            "current_started_at": "2026-04-27T11:55:00+00:00",
            "current_activity_at": "2026-04-27T11:59:00+00:00",
            "cursor_source": "queued_claim",
        },
    )

    state = write_pipeline_control_state({
        "current_batch_id": "batch-new",
        "current_entity_id": "entity-new",
        "current_canonical_entity_id": "canonical-new",
        "current_entity_name": "Entity New",
        "current_question_id": "q11_decision_owner",
        "current_question_text": "Who owns this?",
        "cursor_source": "manifest_next_claim",
    })

    assert captured["on_conflict"] == "id"
    assert captured["payload"]["id"] == "pipeline"
    assert captured["payload"]["state"]["current_batch_id"] == "batch-new"
    assert captured["payload"]["state"]["current_entity_id"] == "entity-new"
    assert captured["payload"]["state"]["current_canonical_entity_id"] == "canonical-new"
    assert captured["payload"]["state"]["cursor_source"] == "manifest_next_claim"
    assert json.loads(control_path.read_text(encoding="utf-8"))["current_batch_id"] == "batch-new"
    assert state["current_entity_name"] == "Entity New"


def test_persist_pipeline_cursor_state_prefers_live_question_first_checkpoint_over_stale_batch_metadata(monkeypatch):
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    writes = []

    monkeypatch.setattr(
        "entity_pipeline_worker.read_pipeline_control_state",
        lambda: {
            "current_batch_id": None,
            "current_entity_id": None,
            "current_canonical_entity_id": None,
            "current_entity_name": None,
            "current_question_id": None,
            "current_question_text": None,
            "current_action": None,
            "current_phase": None,
            "current_started_at": None,
            "current_activity_at": None,
            "cursor_source": None,
            "state": "healthy",
            "health_class": "healthy",
        },
    )
    monkeypatch.setattr("entity_pipeline_worker.write_pipeline_control_state", lambda payload: writes.append(payload) or payload)

    batch = {
        "id": "batch-live",
        "entity_id": "entity-live",
        "canonical_entity_id": "entity-live",
        "entity_name": "Entity Live",
        "phase": "dossier_generation",
        "started_at": "2026-05-03T14:00:00+00:00",
        "metadata": {
            "question_id": "q11_decision_owner",
            "current_question_id": "q11_decision_owner",
            "current_question_text": "Who is the buyer?",
            "phase_details_by_phase": {
                "dossier_generation": {
                    "current_question_id": "q15_outreach_strategy",
                    "current_question_text": "What is the best outreach strategy?",
                    "current_action": "q15_outreach_strategy",
                }
            },
            "question_first_checkpoint": {
                "current_question_id": "q15_outreach_strategy",
                "current_question_text": "What is the best outreach strategy?",
            },
        },
    }

    worker._persist_pipeline_cursor_state(batch, cursor_source="queued_claim")

    assert writes
    written = writes[-1]
    assert written["current_question_id"] == "q15_outreach_strategy"
    assert written["current_question_text"] == "What is the best outreach strategy?"
    assert written["current_action"] == "q15_outreach_strategy"
    assert written["current_phase"] == "dossier_generation"
    assert written["current_entity_name"] == "Entity Live"


def test_normalize_pipeline_control_state_for_worker_start_clears_saved_safety_stop(tmp_path, monkeypatch):
    control_path = tmp_path / "pipeline-control-state.json"
    control_path.write_text(
        json.dumps(
            {
                "is_paused": True,
                "pause_reason": "question retry exhausted",
                "stop_reason": "question_retry_exhausted",
                "stop_details": {
                    "entity_name": "FC Porto",
                    "question_id": "q11_decision_owner",
                    "error_type": "http_404",
                    "error_message": "HTTP Error 404: Not Found",
                    "attempts": 2,
                },
                "requested_state": "paused",
                "observed_state": "paused",
                "transition_state": "paused",
                "desired_state": "paused",
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr("entity_pipeline_worker.PIPELINE_CONTROL_STATE_PATH", control_path)
    monkeypatch.setattr("entity_pipeline_worker.should_use_local_pg", lambda: False)

    state = normalize_pipeline_control_state_for_worker_start("2026-04-24T02:40:00+00:00")

    assert state["is_paused"] is False
    assert state["pause_reason"] is None
    assert state["stop_reason"] is None
    assert state["stop_details"] is None
    assert state["desired_state"] == "running"
    assert state["requested_state"] == "running"
    assert state["observed_state"] == "running"
    assert state["transition_state"] == "running"
    assert state["updated_at"] == "2026-04-24T02:40:00+00:00"


def test_normalize_pipeline_control_state_for_worker_start_preserves_provider_pause(tmp_path, monkeypatch):
    existing_state = {
        "is_paused": True,
        "pause_reason": "provider infrastructure failure: OpenCode insufficient balance",
        "stop_reason": "provider_infrastructure_failure",
        "stop_details": {"reason": "OpenCodeProviderInsufficientBalanceError"},
        "requested_state": "paused",
        "observed_state": "paused",
        "transition_state": "paused",
        "desired_state": "paused",
        "current_entity_name": "Boston Celtics",
    }
    monkeypatch.setattr("entity_pipeline_worker.read_pipeline_control_state", lambda: existing_state)
    writes = []
    monkeypatch.setattr(
        "entity_pipeline_worker.write_pipeline_control_state",
        lambda payload: writes.append(payload) or payload,
    )

    state = normalize_pipeline_control_state_for_worker_start("2026-05-01T20:45:00+01:00")

    assert state["is_paused"] is True
    assert state["pause_reason"] == "provider infrastructure failure: OpenCode insufficient balance"
    assert state["stop_reason"] == "provider_infrastructure_failure"
    assert state["stop_details"] == {"reason": "OpenCodeProviderInsufficientBalanceError"}
    assert state["desired_state"] == "paused"
    assert state["requested_state"] == "paused"
    assert state["observed_state"] == "paused"
    assert state["transition_state"] == "paused"
    assert state["current_entity_name"] == "Boston Celtics"
    assert writes[-1]["updated_at"] == "2026-05-01T20:45:00+01:00"


def test_claim_next_batch_self_heals_provider_pause_when_backend_and_provider_are_healthy(monkeypatch):
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker.recover_stale_batches = lambda: None
    worker.worker_id = "worker-1"
    worker.lease_seconds = 60
    writes = []

    class FakeRpcQuery:
        def execute(self):
            return SimpleNamespace(data=[{"id": "batch-1", "metadata": {}}])

    class FakeSupabase:
        def rpc(self, name, params):
            assert name == "claim_next_entity_import_batch"
            assert params["worker_id"] == "worker-1"
            return FakeRpcQuery()

            def table(self, *_args, **_kwargs):
                class FakeTableQuery:
                    def select(self, *_args, **_kwargs):
                        return self

                    def in_(self, *_args, **_kwargs):
                        return self

                    def eq(self, *_args, **_kwargs):
                        return self

                    def limit(self, *_args, **_kwargs):
                        return self

                def execute(self):
                    return SimpleNamespace(data=[])

            return FakeTableQuery()

    worker.supabase = FakeSupabase()
    worker._resolve_batch_cursor_identity = lambda batch: {
        "current_entity_id": "entity-1",
        "current_canonical_entity_id": "entity-1",
        "current_entity_name": "Entity One",
    }
    monkeypatch.setattr(
        "entity_pipeline_worker.read_pipeline_control_state",
        lambda: {
            "is_paused": True,
            "pause_reason": "provider infrastructure failure: OpenCode insufficient balance",
            "stop_reason": "provider_infrastructure_failure",
            "requested_state": "paused",
            "observed_state": "paused",
            "transition_state": "paused",
        },
    )
    monkeypatch.setattr(
        "entity_pipeline_worker.write_pipeline_control_state",
        lambda payload: writes.append(payload) or payload,
    )
    monkeypatch.setattr("entity_pipeline_worker._heartbeat_supervisor_state", lambda: None)
    worker._backend_preflight = lambda: (True, "")
    worker._provider_preflight = lambda: (True, "")

    claimed = worker.claim_next_batch()

    assert claimed["id"] == "batch-1"
    assert writes[-1]["is_paused"] is False
    assert writes[-1]["stop_reason"] is None
    assert writes[-1]["pause_reason"] is None
    assert writes[-1]["requested_state"] == "running"
    assert any(write.get("recovery_source") == "provider_auto_resume" for write in writes)
    assert any(write.get("last_self_heal_action") == "provider_auto_resume" for write in writes)
    assert any(write.get("state") == "recovering" for write in writes)
    assert any(write.get("health_class") == "recovering" for write in writes)


def test_claim_next_batch_keeps_provider_pause_when_provider_preflight_fails(monkeypatch):
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker.recover_stale_batches = lambda: None
    worker.worker_id = "worker-1"
    worker.lease_seconds = 60

    worker.supabase = SimpleNamespace(
        rpc=lambda *_args, **_kwargs: SimpleNamespace(data=[]),
    )
    monkeypatch.setattr(
        "entity_pipeline_worker.read_pipeline_control_state",
        lambda: {
            "is_paused": True,
            "pause_reason": "provider infrastructure failure: OpenCode insufficient balance",
            "stop_reason": "provider_infrastructure_failure",
            "requested_state": "paused",
            "observed_state": "paused",
            "transition_state": "paused",
        },
    )
    monkeypatch.setattr("entity_pipeline_worker._heartbeat_supervisor_state", lambda: None)
    worker._backend_preflight = lambda: (True, "")
    worker._provider_preflight = lambda: (False, "provider_infrastructure_failure")

    claimed = worker.claim_next_batch()

    assert claimed is None


def test_main_clears_saved_safety_stop_before_entering_worker_loop(tmp_path, monkeypatch):
    control_path = tmp_path / "pipeline-control-state.json"
    control_path.write_text(
        json.dumps(
            {
                "is_paused": True,
                "pause_reason": "question retry exhausted",
                "stop_reason": "question_retry_exhausted",
                "stop_details": {
                    "entity_name": "FC Porto",
                    "question_id": "q11_decision_owner",
                    "attempts": 2,
                },
                "requested_state": "paused",
                "observed_state": "paused",
                "transition_state": "paused",
                "desired_state": "paused",
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr("entity_pipeline_worker.PIPELINE_CONTROL_STATE_PATH", control_path)
    monkeypatch.setattr("entity_pipeline_worker.should_use_local_pg", lambda: False)
    monkeypatch.setattr(worker_module, "QUEUE_MODE", "durable_worker")

    supervisor_states = []

    def fake_write_supervisor_state(status, error=None, stopped_at=None):
        supervisor_states.append((status, error, stopped_at))

    class FakeWorker:
        def run_forever(self):
            raise SystemExit("stop after bootstrap")

    monkeypatch.setattr(worker_module, "_write_supervisor_state", fake_write_supervisor_state)
    monkeypatch.setattr(worker_module, "EntityPipelineWorker", FakeWorker)

    with pytest.raises(SystemExit, match="stop after bootstrap"):
        worker_module.main()

    state = read_pipeline_control_state()

    assert state["is_paused"] is False
    assert state["pause_reason"] is None
    assert state["stop_reason"] is None
    assert state["stop_details"] is None
    assert state["requested_state"] == "running"
    assert state["observed_state"] == "running"
    assert state["transition_state"] == "running"
    assert supervisor_states[0][0] == "running"
    assert supervisor_states[-1][0] == "stopped"


def test_supervisor_state_persists_current_worker_activity(tmp_path, monkeypatch):
    state_path = tmp_path / "entity-pipeline-worker-state.json"
    pid_path = tmp_path / "entity-pipeline-worker.pid"
    monkeypatch.setattr(worker_module, "WORKER_STATE_PATH", state_path)
    monkeypatch.setattr(worker_module, "WORKER_PID_PATH", pid_path)
    monkeypatch.setattr(worker_module, "WORKER_STARTED_AT", None)
    worker_module.WORKER_ACTIVITY.clear()

    worker_module._write_supervisor_state("running")
    worker_module._set_supervisor_activity(
        current_batch_id="batch-1",
        current_entity_id="andy-reid",
        current_canonical_entity_id="andy-reid",
        current_entity_name="Andy Reid",
        current_question_id="q11_decision_owner",
        current_question_text="Who is the highest probability buyer?",
        current_action="entity_registration",
        current_phase="dossier_generation",
        current_started_at="2026-04-24T06:30:00+00:00",
        current_activity_at="2026-04-24T06:30:01+00:00",
    )

    state = json.loads(state_path.read_text(encoding="utf-8"))

    assert state["worker_process_state"] == "running"
    assert state["current_entity_id"] == "andy-reid"
    assert state["current_entity_name"] == "Andy Reid"
    assert state["current_question_id"] == "q11_decision_owner"
    assert state["current_action"] == "entity_registration"

    worker_module._clear_supervisor_activity()
    cleared = json.loads(state_path.read_text(encoding="utf-8"))

    assert "current_entity_id" not in cleared
    assert "current_entity_name" not in cleared


def test_refresh_batch_heartbeat_preserves_supervisor_activity_and_refreshes_timestamp(tmp_path, monkeypatch):
    state_path = tmp_path / "entity-pipeline-worker-state.json"
    pid_path = tmp_path / "entity-pipeline-worker.pid"
    monkeypatch.setattr(worker_module, "WORKER_STATE_PATH", state_path)
    monkeypatch.setattr(worker_module, "WORKER_PID_PATH", pid_path)
    monkeypatch.setattr(worker_module, "WORKER_STARTED_AT", None)
    worker_module.WORKER_ACTIVITY.clear()

    refresh_times = iter(["2026-04-24T06:30:05+00:00"])
    monkeypatch.setattr(worker_module.EntityPipelineWorker, "_now_iso", lambda self: next(refresh_times))

    class _RpcResult:
        data = []

        def execute(self):
            return self

    class _RunsResult:
        def __init__(self):
            self.data = [{"id": "run-1", "metadata": {}}]

        def execute(self):
            return self

    class _RunsTable:
        def select(self, *_args, **_kwargs):
            return self

        def eq(self, *_args, **_kwargs):
            return self

        def in_(self, *_args, **_kwargs):
            return _RunsResult()

        def update(self, *_args, **_kwargs):
            return self

        def execute(self):
            return self

    class _Supabase:
        def rpc(self, *_args, **_kwargs):
            return _RpcResult()

        def table(self, *_args, **_kwargs):
            return _RunsTable()

    worker = worker_module.EntityPipelineWorker.__new__(worker_module.EntityPipelineWorker)
    worker.supabase = _Supabase()
    worker.worker_id = "worker-1"
    worker.lease_seconds = 90
    worker._safe_execute = lambda operation, **_kwargs: (operation() or True)

    worker_module._write_supervisor_state("running")
    worker_module._set_supervisor_activity(
        current_batch_id="batch-1",
        current_entity_id="fc-porto",
        current_canonical_entity_id="fc-porto",
        current_entity_name="FC Porto",
        current_question_id="q11_decision_owner",
        current_question_text="Who is the highest probability buyer?",
        current_action="entity_registration",
        current_phase="dossier_generation",
        current_started_at="2026-04-24T06:30:00+00:00",
        current_activity_at="2026-04-24T06:30:00+00:00",
    )

    worker.refresh_batch_heartbeat("batch-1", {})

    state = json.loads(state_path.read_text(encoding="utf-8"))

    assert state["current_entity_name"] == "FC Porto"
    assert state["current_question_id"] == "q11_decision_owner"
    assert state["current_activity_at"] == "2026-04-24T06:30:05+00:00"


def test_build_batch_claim_metadata_sets_worker_and_heartbeat_fields():
    metadata = build_batch_claim_metadata({"source": "single_entity_trigger"}, worker_id="worker-1", now_iso="2026-03-02T15:00:00+00:00")

    assert metadata["worker_id"] == "worker-1"
    assert metadata["claimed_at"] == "2026-03-02T15:00:00+00:00"
    assert metadata["heartbeat_at"] == "2026-03-02T15:00:00+00:00"
    assert metadata["queue_mode"] == "durable_worker"
    assert metadata["attempt_count"] == 1
    assert metadata["lease_expires_at"] is not None


def test_build_run_retry_metadata_increments_attempt_count_and_flags_retryable():
    metadata = build_run_retry_metadata(
        {"attempt_count": 1},
        retryable=True,
        error_type="transport",
        error_message="temporary timeout",
        now_iso="2026-03-02T15:01:00+00:00",
    )

    assert metadata["attempt_count"] == 2
    assert metadata["retryable"] is True
    assert metadata["last_error_type"] == "transport"
    assert metadata["last_error"] == "temporary timeout"
    assert metadata["last_error_at"] == "2026-03-02T15:01:00+00:00"
    assert metadata["retry_state"] == "retrying"


def test_build_run_start_metadata_sets_lease_state():
    metadata = build_run_start_metadata(
        {"attempt_count": 1},
        worker_id="worker-1",
        now_iso="2026-03-02T15:01:00+00:00",
        lease_seconds=60,
    )

    assert metadata["lease_owner"] == "worker-1"
    assert metadata["lease_expires_at"] is not None
    assert metadata["retry_state"] == "running"
    assert metadata["attempt_count"] == 2


def test_build_run_start_metadata_clears_terminal_failure_markers():
    metadata = build_run_start_metadata(
        {
            "attempt_count": 1,
            "failure_class": "infrastructure_disk_full",
            "infrastructure_failure": True,
            "continue_pipeline_on_failure": True,
            "stop_reason": "infrastructure_disk_full",
            "stop_details": {"reason": "infrastructure_disk_full"},
            "last_error": "no space left on device",
            "last_error_type": "http_500",
            "last_error_at": "2026-03-02T15:00:00+00:00",
        },
        worker_id="worker-1",
        now_iso="2026-03-02T15:01:00+00:00",
        lease_seconds=60,
    )

    assert metadata["retry_state"] == "running"
    assert metadata["attempt_count"] == 2
    assert "failure_class" not in metadata
    assert "infrastructure_failure" not in metadata
    assert "continue_pipeline_on_failure" not in metadata
    assert "stop_reason" not in metadata
    assert "stop_details" not in metadata
    assert metadata["last_error"] is None
    assert metadata["last_error_type"] is None
    assert metadata["last_error_at"] is None


def test_build_run_success_metadata_clears_retry_error_fields():
    metadata = build_run_success_metadata(
        {
            "retryable": True,
            "retry_state": "retrying",
            "last_error": "timed out",
            "last_error_type": "timeout",
            "last_error_at": "2026-03-02T15:01:00+00:00",
        }
    )

    assert metadata["retryable"] is False
    assert metadata["retry_state"] == "completed"
    assert metadata["last_error"] is None
    assert metadata["last_error_type"] is None


def test_build_run_exhausted_retry_metadata_marks_run_as_failed():
    metadata = build_run_exhausted_retry_metadata(
        {
            "attempt_count": 2,
            "retryable": True,
            "retry_state": "retrying",
            "last_error": "timed out",
            "last_error_type": "timeout",
        },
        now_iso="2026-03-04T12:00:00+00:00",
    )

    assert metadata["retryable"] is False
    assert metadata["retry_state"] == "failed"
    assert metadata["last_error"] == "timed out"
    assert metadata["last_error_type"] == "timeout"
    assert metadata["last_error_at"] == "2026-03-04T12:00:00+00:00"


def test_build_batch_heartbeat_metadata_preserves_existing_claim_data():
    metadata = build_batch_heartbeat_metadata(
        {
            "worker_id": "worker-1",
            "claimed_at": "2026-03-02T15:00:00+00:00",
            "queue_mode": "durable_worker",
        },
        now_iso="2026-03-02T15:01:00+00:00",
    )

    assert metadata["worker_id"] == "worker-1"
    assert metadata["claimed_at"] == "2026-03-02T15:00:00+00:00"
    assert metadata["heartbeat_at"] == "2026-03-02T15:01:00+00:00"


def test_build_batch_running_update_keeps_batch_in_running_state():
    update = build_batch_running_update(
        {
            "worker_id": "worker-1",
            "claimed_at": "2026-03-02T15:00:00+00:00",
            "queue_mode": "durable_worker",
        },
        now_iso="2026-03-02T15:01:00+00:00",
    )

    assert update["status"] == "running"
    assert update["metadata"]["heartbeat_at"] == "2026-03-02T15:01:00+00:00"


def test_build_batch_retry_update_requeues_batch_and_records_error():
    update = build_batch_retry_update(
        {"worker_id": "worker-1", "attempt_count": 2},
        now_iso="2026-03-02T15:02:00+00:00",
        error_message="Retrying one or more pipeline runs",
    )

    assert update["status"] == "queued"
    assert update["metadata"]["retry_state"] == "retrying"
    assert update["metadata"]["last_error"] == "Retrying one or more pipeline runs"
    assert update["metadata"]["lease_expires_at"] is None


def test_build_batch_completed_update_clears_lease_and_sets_completed_state():
    update = build_batch_completed_update(
        {"retry_state": "running", "lease_expires_at": "2026-03-02T15:10:00+00:00"},
        worker_id="worker-1",
        now_iso="2026-03-02T15:11:00+00:00",
    )

    assert update["status"] == "completed"
    assert update["metadata"]["completed_at"] == "2026-03-02T15:11:00+00:00"
    assert update["metadata"]["retry_state"] == "completed"
    assert update["metadata"]["lease_expires_at"] is None


def test_build_batch_failed_update_clears_lease_and_sets_failed_state():
    update = build_batch_failed_update(
        {"retry_state": "running", "lease_expires_at": "2026-03-02T15:10:00+00:00"},
        now_iso="2026-03-02T15:11:00+00:00",
    )

    assert update["status"] == "failed"
    assert update["metadata"]["retry_state"] == "failed"
    assert update["metadata"]["lease_expires_at"] is None


def test_call_pipeline_forwards_run_and_repair_metadata(monkeypatch):
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    payloads = {}

    class _Response:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self):
            return b'{"status":"ok"}'

    def fake_urlopen(request, timeout=None):
        payloads["timeout"] = timeout
        payloads["url"] = request.full_url
        payloads["body"] = request.data.decode("utf-8")
        return _Response()

    monkeypatch.setattr("entity_pipeline_worker.urlopen", fake_urlopen)

    run = {
        "entity_id": "fc-porto-2027",
        "entity_name": "FC Porto",
        "phase": "entity_registration",
        "metadata": {
            "entity_type": "SPORT_CLUB",
            "priority_score": 88,
            "run_objective": "leadership_enrichment",
            "rerun_mode": "question",
            "question_id": "q11_decision_owner",
            "cascade_dependents": True,
            "repair_source_run_id": "run-base-1",
        },
    }
    batch_id = "batch-123"

    result = worker.call_pipeline(run, batch_id)

    assert result["status"] == "ok"
    assert payloads["url"].endswith("/api/pipeline/run-entity")
    body = payloads["body"]
    assert '"entity_id": "fc-porto-2027"' in body
    assert '"metadata"' in body
    assert '"rerun_mode": "question"' in body
    assert '"question_id": "q11_decision_owner"' in body
    assert '"cascade_dependents": true' in body
    assert '"repair_source_run_id": "run-base-1"' in body


def test_provider_preflight_uses_certifi_ssl_context(monkeypatch):
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    captured = {}
    fake_context = object()

    class _Response:
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

    def fake_urlopen(request, timeout=None, context=None):
        captured["url"] = request.full_url
        captured["timeout"] = timeout
        captured["context"] = context
        captured["headers"] = dict(request.header_items())
        captured["body"] = request.data.decode("utf-8")
        return _Response()

    monkeypatch.setenv("ANTHROPIC_BASE_URL", "https://api.z.ai/api/anthropic/v1")
    monkeypatch.setenv("ZAI_API_KEY", "zai-test-key")
    monkeypatch.setenv("ANTHROPIC_DEFAULT_SONNET_MODEL", "GLM-5.1")
    monkeypatch.setattr("entity_pipeline_worker._provider_preflight_ssl_context", lambda: fake_context)
    monkeypatch.setattr("entity_pipeline_worker.urlopen", fake_urlopen)

    ok, reason = worker._provider_preflight()

    assert ok is True
    assert reason == ""
    assert captured["url"] == "https://api.z.ai/api/anthropic/v1/messages"
    assert captured["timeout"] == 10
    assert captured["context"] is fake_context
    assert captured["headers"]["X-api-key"] == "zai-test-key"
    assert '"model": "GLM-5.1"' in captured["body"]


def test_merge_pipeline_run_metadata_preserves_phase_details_and_adds_scores():
    merged = merge_pipeline_run_metadata(
        {"phase_details": {"status": "running", "iteration": 2}},
        phases={"discovery": {"status": "completed"}},
        phase_details_by_phase={"discovery": {"status": "completed"}},
        scores={"sales_readiness": "MONITOR"},
        monitoring_summary={"pages_fetched": 3, "candidate_count": 1},
        escalation_reason="baseline_monitoring_ambiguous",
        performance_summary={"slowest_hop": {"hop_type": "rfp_page"}},
        acceptance_gate={"passed": True, "reasons": []},
        failure_taxonomy={"schema_gate_fallback": 1},
        run_profile="bounded_production",
        degraded_mode=False,
        persistence_status={"dual_write_ok": True, "supabase": {"ok": True}, "falkordb": {"ok": True}},
        promoted_rfp_ids=["rfp-1"],
        completed_at="2026-03-02T15:10:00+00:00",
    )

    assert merged["phase_details"]["iteration"] == 2
    assert merged["phases"]["discovery"]["status"] == "completed"
    assert merged["phase_details_by_phase"]["discovery"]["status"] == "completed"
    assert merged["scores"]["sales_readiness"] == "MONITOR"
    assert merged["monitoring_summary"]["pages_fetched"] == 3
    assert merged["escalation_reason"] == "baseline_monitoring_ambiguous"
    assert merged["performance_summary"]["slowest_hop"]["hop_type"] == "rfp_page"
    assert merged["acceptance_gate"]["passed"] is True
    assert merged["failure_taxonomy"]["schema_gate_fallback"] == 1
    assert merged["run_profile"] == "bounded_production"
    assert merged["degraded_mode"] is False
    assert merged["persistence"]["dual_write_ok"] is True
    assert merged["promoted_rfp_ids"] == ["rfp-1"]


def test_derive_monitoring_summary_extracts_monitoring_counts():
    summary = derive_monitoring_summary(
        {
            "artifacts": {
                "monitoring_result": {
                    "pages_fetched": 4,
                    "pages_changed": 1,
                    "pages_unchanged": 3,
                    "candidate_count": 2,
                    "snapshots": [{}, {}],
                }
            }
        }
    )

    assert summary["pages_fetched"] == 4
    assert summary["pages_changed"] == 1
    assert summary["pages_unchanged"] == 3
    assert summary["candidate_count"] == 2
    assert summary["snapshot_count"] == 2
    assert summary["candidate_types"]["social_signal"] == 1
    assert summary["candidate_types"]["hiring_signal"] == 1
    assert summary["validated_candidate_types"]["social_signal"] == 1
    assert summary["validated_candidate_types"]["hiring_signal"] == 1
    assert summary["llm_validated_count"] == 2
    assert summary["escalation_recommended_count"] == 1


def test_persist_monitoring_outputs_keeps_validation_result_in_candidate_metadata():
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker._now_iso = lambda: "2026-03-04T10:00:00+00:00"

    recorded_operations = []

    class FakeExecute:
        def __init__(self, table_name, action, payload):
            self.table_name = table_name
            self.action = action
            self.payload = payload

        def execute(self):
            recorded_operations.append(
                {
                    "table": self.table_name,
                    "action": self.action,
                    "payload": self.payload,
                }
            )
            return SimpleNamespace(data=[])

    class FakeTable:
        def __init__(self, table_name):
            self.table_name = table_name

        def upsert(self, payload, on_conflict=None):
            return FakeExecute(self.table_name, "upsert", payload)

        def insert(self, payload):
            return FakeExecute(self.table_name, "insert", payload)

    worker.supabase = SimpleNamespace(table=lambda name: FakeTable(name))
    worker._safe_execute = lambda operation, **_kwargs: (operation(), True)[1]

    run = {
        "entity_id": "international-canoe-federation",
        "id": "batch-1_international-canoe-federation",
    }
    result = {
        "artifacts": {
            "dossier": {"metadata": {"canonical_sources": {}}},
            "monitoring_result": {
                "snapshots": [],
                "candidates": [
                    {
                        "entity_id": "international-canoe-federation",
                        "batch_id": "batch-1",
                        "run_id": "batch-1_international-canoe-federation",
                        "page_class": "linkedin_posts",
                        "url": "https://www.linkedin.com/company/international-canoe-federation/posts",
                        "content_hash": "hash-social",
                        "candidate_type": "social_signal",
                        "score": 0.73,
                        "evidence_excerpt": "Potential procurement activity",
                        "metadata": {
                            "validation_result": {
                                "verdict": "interesting",
                                "confidence": 0.68,
                                "should_escalate": True,
                            }
                        },
                    }
                ],
            },
        }
    }

    worker.persist_monitoring_outputs("batch-1", run, result)

    candidate_op = next(op for op in recorded_operations if op["table"] == "entity_monitoring_candidates")
    validation_result = candidate_op["payload"][0]["metadata"]["validation_result"]
    assert validation_result["verdict"] == "interesting"
    assert validation_result["should_escalate"] is True


def test_derive_discovery_context_extracts_template_and_hypothesis_summary():
    context = derive_discovery_context(
        {
            "artifacts": {
                "discovery_result": {
                    "hypotheses": [
                        {
                            "hypothesis_id": "international-canoe-federation_digital_leadership_hire",
                            "confidence": 0.58,
                            "metadata": {
                                "template_id": "federation_governing_body",
                                "pattern_name": "Digital Leadership Hire",
                            },
                        }
                    ],
                    "performance_summary": {
                        "slowest_iteration": {
                            "hypothesis_id": "international-canoe-federation_digital_leadership_hire",
                            "hop_type": "official_site",
                        }
                    },
                }
            }
        }
    )

    assert context["template_id"] == "federation_governing_body"
    assert context["lead_hypothesis_id"] == "international-canoe-federation_digital_leadership_hire"
    assert context["lead_pattern_name"] == "Digital Leadership Hire"
    assert context["slowest_hop_type"] == "official_site"


def test_refresh_batch_heartbeat_tolerates_transient_supabase_failure():
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)

    class FailingQuery:
        def eq(self, *_args, **_kwargs):
            return self
        def execute(self):
            raise OSError("No route to host")

    class FakeTable:
        def update(self, *_args, **_kwargs):
            return FailingQuery()

    worker.supabase = SimpleNamespace(table=lambda _name: FakeTable())
    worker._now_iso = lambda: "2026-03-03T02:15:00+00:00"

    metadata = worker.refresh_batch_heartbeat(
        "batch-1",
        {"worker_id": "worker-1", "claimed_at": "2026-03-03T02:00:00+00:00"},
    )

    assert metadata["heartbeat_at"] == "2026-03-03T02:15:00+00:00"
    assert metadata["worker_id"] == "worker-1"


def test_refresh_batch_heartbeat_updates_active_run_metadata():
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker._now_iso = lambda: "2026-04-12T11:30:00+00:00"
    recorded = {"rpc": [], "updates": []}

    class FakeQuery:
        def __init__(self, action, table_name):
            self.action = action
            self.table_name = table_name
            self.payload = None
            self.filters = []

        def eq(self, *args, **_kwargs):
            self.filters.append(("eq", args))
            return self

        def in_(self, *args, **_kwargs):
            self.filters.append(("in", args))
            return self

        def update(self, payload):
            self.action = "update"
            self.payload = payload
            return self

        def execute(self):
            if self.action == "select":
                return SimpleNamespace(
                    data=[
                        {
                            "id": "run-1",
                            "metadata": {
                                "existing": "value",
                                "heartbeat_at": "2026-04-12T10:00:00+00:00",
                            },
                        }
                    ]
                )
            if self.action == "update":
                recorded["updates"].append((self.table_name, self.payload, list(self.filters)))
            return SimpleNamespace(data=[])

    class FakeTable:
        def __init__(self, table_name):
            self.table_name = table_name

        def select(self, *_args, **_kwargs):
            return FakeQuery("select", self.table_name)

        def update(self, payload):
            query = FakeQuery("update", self.table_name)
            query.payload = payload
            return query

    class FakeSupabase:
        def rpc(self, name, params):
            recorded["rpc"].append((name, params))

            class RpcQuery:
                def execute(self_inner):
                    return SimpleNamespace(data=[])

            return RpcQuery()

        def table(self, table_name):
            return FakeTable(table_name)

    worker.supabase = FakeSupabase()
    worker.worker_id = "worker-1"

    metadata = worker.refresh_batch_heartbeat(
        "batch-1",
        {"worker_id": "worker-1", "claimed_at": "2026-04-12T10:00:00+00:00"},
    )

    assert metadata["heartbeat_at"] == "2026-04-12T11:30:00+00:00"
    assert recorded["rpc"][0][0] == "renew_entity_import_batch_lease"
    assert recorded["updates"][0][0] == "entity_pipeline_runs"
    assert recorded["updates"][0][1]["metadata"]["heartbeat_at"] == "2026-04-12T11:30:00+00:00"
    assert recorded["updates"][0][1]["metadata"]["existing"] == "value"
    assert recorded["updates"][0][1]["metadata"]["worker_id"] == "worker-1"


def test_run_forever_recovers_from_claim_error(monkeypatch):
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    calls = {"claim": 0, "process": 0, "sleep": 0}

    def fake_claim_next_batch():
        calls["claim"] += 1
        if calls["claim"] == 1:
            raise OSError("temporary network issue")
        return {"id": "batch-1"}

    def fake_process_batch(batch):
        calls["process"] += 1
        raise KeyboardInterrupt()

    def fake_sleep(_seconds):
        calls["sleep"] += 1

    worker.claim_next_batch = fake_claim_next_batch
    worker.process_batch = fake_process_batch
    monkeypatch.setattr(time, "sleep", fake_sleep)

    try:
        worker.run_forever()
    except KeyboardInterrupt:
        pass

    assert calls["claim"] >= 2
    assert calls["sleep"] >= 1
    assert calls["process"] == 1


def test_claim_next_batch_uses_rpc_claim_function(monkeypatch):
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)

    class FakeRpcQuery:
        def execute(self):
            return SimpleNamespace(data=[{"id": "batch-1", "status": "running", "metadata": {"worker_id": "worker-1"}}])

    class FakeSupabase:
        def rpc(self, name, params):
            assert name == "claim_next_entity_import_batch"
            assert params["worker_id"] == "worker-1"
            assert params["lease_seconds"] > 0
            return FakeRpcQuery()

    worker.supabase = FakeSupabase()
    worker.worker_id = "worker-1"
    worker.recover_stale_batches = lambda: None
    worker.lease_seconds = 60
    worker._select_next_entity_cursor_candidate = lambda **kwargs: None
    monkeypatch.setattr("entity_pipeline_worker.read_pipeline_control_state", lambda: {"is_paused": False})
    monkeypatch.setattr("entity_pipeline_worker.write_pipeline_control_state", lambda payload: payload)

    claimed = worker.claim_next_batch()

    assert claimed["id"] == "batch-1"


def test_claim_next_batch_returns_none_when_pipeline_is_paused(monkeypatch):
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker.recover_stale_batches = lambda: None
    worker.worker_id = "worker-1"
    worker.lease_seconds = 60
    worker.supabase = SimpleNamespace(
        rpc=lambda *_args, **_kwargs: SimpleNamespace(data=[]),
    )
    monkeypatch.setattr(
        "entity_pipeline_worker.read_pipeline_control_state",
        lambda: {"is_paused": True, "pause_reason": "manual stop", "stop_reason": "manual_stop"},
    )

    claimed = worker.claim_next_batch()

    assert claimed is None


def test_claim_next_batch_self_heals_orchestrator_pause_when_backend_is_healthy(monkeypatch):
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker.recover_stale_batches = lambda: None
    worker.worker_id = "worker-1"
    worker.lease_seconds = 60
    writes = []

    class FakeRpcQuery:
        def execute(self):
            return SimpleNamespace(data=[{"id": "batch-1", "metadata": {}}])

    class FakeSupabase:
        def rpc(self, name, params):
            assert name == "claim_next_entity_import_batch"
            assert params["worker_id"] == "worker-1"
            return FakeRpcQuery()

        def table(self, *_args, **_kwargs):
            class FakeTableQuery:
                def select(self, *_args, **_kwargs):
                    return self

                def eq(self, *_args, **_kwargs):
                    return self

                def limit(self, *_args, **_kwargs):
                    return self

                def execute(self):
                    return SimpleNamespace(data=[])

            return FakeTableQuery()

    worker.supabase = FakeSupabase()
    worker._resolve_batch_cursor_identity = lambda batch: {
        "current_entity_id": "entity-1",
        "current_canonical_entity_id": "entity-1",
        "current_entity_name": "Entity One",
    }
    monkeypatch.setattr(
        "entity_pipeline_worker.read_pipeline_control_state",
        lambda: {
            "is_paused": True,
            "pause_reason": "orchestrator unhealthy",
            "stop_reason": "orchestrator_unhealthy",
            "requested_state": "paused",
            "observed_state": "paused",
            "transition_state": "paused",
        },
    )
    monkeypatch.setattr(
        "entity_pipeline_worker.write_pipeline_control_state",
        lambda payload: writes.append(payload) or payload,
    )
    monkeypatch.setattr("entity_pipeline_worker._heartbeat_supervisor_state", lambda: None)
    worker._backend_preflight = lambda: (True, "")
    worker._provider_preflight = lambda: (True, "")

    claimed = worker.claim_next_batch()

    assert claimed["id"] == "batch-1"
    assert writes[-1]["is_paused"] is False
    assert writes[-1]["stop_reason"] is None
    assert writes[-1]["requested_state"] == "running"


def test_claim_next_batch_self_heals_backend_route_pause_when_backend_is_healthy(monkeypatch):
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker.recover_stale_batches = lambda: None
    worker.worker_id = "worker-1"
    worker.lease_seconds = 60
    writes = []

    class FakeRpcQuery:
        def execute(self):
            return SimpleNamespace(data=[{"id": "batch-1", "metadata": {}}])

    class FakeSupabase:
        def rpc(self, name, params):
            assert name == "claim_next_entity_import_batch"
            assert params["worker_id"] == "worker-1"
            return FakeRpcQuery()

        def table(self, *_args, **_kwargs):
            class FakeTableQuery:
                def select(self, *_args, **_kwargs):
                    return self

                def in_(self, *_args, **_kwargs):
                    return self

                def eq(self, *_args, **_kwargs):
                    return self

                def limit(self, *_args, **_kwargs):
                    return self

                def execute(self):
                    return SimpleNamespace(data=[])

            return FakeTableQuery()

    worker.supabase = FakeSupabase()
    worker._resolve_batch_cursor_identity = lambda batch: {
        "current_entity_id": "entity-1",
        "current_canonical_entity_id": "entity-1",
        "current_entity_name": "Entity One",
    }
    monkeypatch.setattr(
        "entity_pipeline_worker.read_pipeline_control_state",
        lambda: {
            "is_paused": True,
            "pause_reason": "backend pipeline route missing",
            "stop_reason": "backend_route_missing",
            "requested_state": "paused",
            "observed_state": "paused",
            "transition_state": "paused",
        },
    )
    monkeypatch.setattr(
        "entity_pipeline_worker.write_pipeline_control_state",
        lambda payload: writes.append(payload) or payload,
    )
    monkeypatch.setattr("entity_pipeline_worker._heartbeat_supervisor_state", lambda: None)
    worker._backend_preflight = lambda: (True, "")
    worker._provider_preflight = lambda: (True, "")

    claimed = worker.claim_next_batch()

    assert claimed["id"] == "batch-1"
    assert writes[-1]["is_paused"] is False
    assert writes[-1]["stop_reason"] is None
    assert writes[-1]["pause_reason"] is None
    assert writes[-1]["requested_state"] == "running"
    assert any(write.get("state") == "recovering" for write in writes)
    assert any(write.get("recovery_source") == "provider_auto_resume" for write in writes)


def test_claim_next_batch_marks_control_running_when_queue_is_idle(monkeypatch):
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker.recover_stale_batches = lambda: None
    worker.worker_id = "worker-1"
    worker.lease_seconds = 60
    writes = []

    class FakeRpcQuery:
        def execute(self):
            return SimpleNamespace(data=[])

    class FakeSupabase:
        def rpc(self, name, params):
            assert name == "claim_next_entity_import_batch"
            assert params["worker_id"] == "worker-1"
            return FakeRpcQuery()

    worker.supabase = FakeSupabase()
    worker._select_next_entity_cursor_candidate = lambda **kwargs: None
    monkeypatch.setattr(
        "entity_pipeline_worker.read_pipeline_control_state",
        lambda: {
            "is_paused": False,
            "pause_reason": None,
            "requested_state": "running",
            "observed_state": "starting",
            "transition_state": "starting",
            "desired_state": "running",
        },
    )
    monkeypatch.setattr("entity_pipeline_worker.write_pipeline_control_state", lambda payload: writes.append(payload) or payload)

    claimed = worker.claim_next_batch()

    assert claimed is None
    assert writes[-1]["requested_state"] == "running"
    assert writes[-1]["observed_state"] == "running"
    assert writes[-1]["transition_state"] == "running"


def test_claim_next_batch_does_not_try_resumable_lookup_without_cursor(monkeypatch):
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker.recover_stale_batches = lambda: None
    worker.worker_id = "worker-1"
    worker.lease_seconds = 60
    select_calls = []

    class FakeRpcQuery:
        def execute(self):
            return SimpleNamespace(data=[])

    class FakeSupabase:
        def rpc(self, name, params):
            assert name == "claim_next_entity_import_batch"
            assert params["worker_id"] == "worker-1"
            return FakeRpcQuery()

        def table(self, *_args, **_kwargs):
            raise AssertionError("table() should not be used when no cursor and no queue batch exist")

    worker.supabase = FakeSupabase()
    worker._select_next_entity_cursor_candidate = lambda **kwargs: select_calls.append(kwargs) or None
    monkeypatch.setattr(
        "entity_pipeline_worker.read_pipeline_control_state",
        lambda: {
            "is_paused": False,
            "pause_reason": None,
            "requested_state": "running",
            "observed_state": "running",
            "transition_state": "running",
            "desired_state": "running",
        },
    )
    monkeypatch.setattr("entity_pipeline_worker.write_pipeline_control_state", lambda payload: payload)

    claimed = worker.claim_next_batch()

    assert claimed is None
    assert len(select_calls) == 1
    assert select_calls[0]["include_manifest_fallback"] is True
    assert select_calls[0]["current_entity_id"] == ""
    assert select_calls[0]["current_canonical_entity_id"] is None


def test_claim_next_batch_stops_after_scoped_pilot_batch_without_resume_claim(monkeypatch):
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker.reconcile_stale_pipeline_state = lambda: None
    worker.recover_stale_batches = lambda: None
    worker.worker_id = "worker-1"
    worker.lease_seconds = 60
    worker._now_iso = lambda: "2026-05-05T00:10:00+01:00"
    worker._backend_preflight = lambda: (True, None)
    worker._get_batch_record = lambda batch_id: {
        "id": batch_id,
        "status": "completed",
        "metadata": {
            "targeted_pilot": True,
            "suppress_cursor_resume_after_batch": True,
        },
    }

    class FakeRpcQuery:
        def execute(self):
            return SimpleNamespace(data=[])

    class FakeSupabase:
        def rpc(self, name, params):
            assert name == "claim_next_entity_import_batch"
            return FakeRpcQuery()

    worker.supabase = FakeSupabase()
    worker._select_next_entity_cursor_candidate = lambda **_kwargs: (_ for _ in ()).throw(
        AssertionError("scoped pilot batches must not fall through to resume cursor selection")
    )
    monkeypatch.setattr(
        "entity_pipeline_worker.read_pipeline_control_state",
        lambda: {
            "is_paused": False,
            "pause_reason": None,
            "requested_state": "running",
            "observed_state": "running",
            "transition_state": "running",
            "desired_state": "running",
            "current_batch_id": "targeted_answer_quality_pilot_1",
            "current_entity_id": "entity-1",
            "current_canonical_entity_id": "entity-1",
        },
    )
    monkeypatch.setattr("entity_pipeline_worker.write_pipeline_control_state", lambda payload: payload)

    claimed = worker.claim_next_batch()

    assert claimed is None


def test_claim_next_batch_processes_allowed_supervised_drain_batch(monkeypatch):
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker.reconcile_stale_pipeline_state = lambda: None
    worker.recover_stale_batches = lambda: None
    worker.worker_id = "worker-1"
    worker.lease_seconds = 60
    worker._backend_preflight = lambda: (True, None)
    worker._now_iso = lambda: "2026-05-07T17:30:00+01:00"
    writes = []

    class FakeSupabase:
        def rpc(self, name, params):
            raise AssertionError("supervised drain must not use generic claim RPC")

    worker.supabase = FakeSupabase()
    worker._claim_supervised_drain_allowed_batch = lambda control_state: {
        "id": "batch-allowed",
        "entity_id": "entity-allowed",
        "canonical_entity_id": "entity-allowed",
        "entity_name": "Allowed Entity",
        "phase": "dossier_generation",
        "status": "running",
        "metadata": {},
    }
    monkeypatch.setattr(
        "entity_pipeline_worker.read_pipeline_control_state",
        lambda: {
            "is_paused": False,
            "requested_state": "running",
            "observed_state": "running",
            "transition_state": "running",
            "desired_state": "running",
            "supervised_drain_enabled": True,
            "supervised_drain_allowed_batch_ids": ["batch-allowed"],
            "supervised_drain_disable_manifest_auto_advance": True,
            "supervised_drain_pause_when_exhausted": True,
        },
    )
    monkeypatch.setattr("entity_pipeline_worker.write_pipeline_control_state", lambda payload: writes.append(payload) or payload)

    claimed = worker.claim_next_batch()

    assert claimed["id"] == "batch-allowed"
    assert writes[-1]["current_batch_id"] == "batch-allowed"


def test_claim_next_batch_pauses_supervised_drain_without_generic_rpc_when_allowlist_empty(monkeypatch):
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker.reconcile_stale_pipeline_state = lambda: None
    worker.recover_stale_batches = lambda: None
    worker.worker_id = "worker-1"
    worker.lease_seconds = 60
    worker._backend_preflight = lambda: (True, None)
    worker._now_iso = lambda: "2026-05-07T17:30:00+01:00"
    writes = []

    class FakeSupabase:
        def rpc(self, name, params):
            raise AssertionError("supervised drain must not use generic claim RPC")

    worker.supabase = FakeSupabase()
    worker._claim_supervised_drain_allowed_batch = lambda control_state: None
    worker._select_next_entity_cursor_candidate = lambda **_kwargs: (_ for _ in ()).throw(
        AssertionError("supervised drain must not fall through to cursor or manifest selection")
    )
    monkeypatch.setattr(
        "entity_pipeline_worker.read_pipeline_control_state",
        lambda: {
            "is_paused": False,
            "requested_state": "running",
            "observed_state": "running",
            "transition_state": "running",
            "desired_state": "running",
            "supervised_drain_enabled": True,
            "supervised_drain_allowed_batch_ids": ["batch-allowed"],
            "supervised_drain_disable_manifest_auto_advance": True,
            "supervised_drain_pause_when_exhausted": True,
        },
    )
    monkeypatch.setattr("entity_pipeline_worker.write_pipeline_control_state", lambda payload: writes.append(payload) or payload)

    claimed = worker.claim_next_batch()

    assert claimed is None
    assert writes[-1]["is_paused"] is True
    assert writes[-1]["pause_reason"] == "supervised_drain_exhausted"


def test_claim_next_batch_pauses_supervised_drain_without_manifest_fallback_when_queue_empty(monkeypatch):
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker.reconcile_stale_pipeline_state = lambda: None
    worker.recover_stale_batches = lambda: None
    worker.worker_id = "worker-1"
    worker.lease_seconds = 60
    worker._backend_preflight = lambda: (True, None)
    worker._now_iso = lambda: "2026-05-07T17:30:00+01:00"
    writes = []

    class FakeSupabase:
        def rpc(self, name, params):
            raise AssertionError("supervised drain must not use generic claim RPC")

    worker.supabase = FakeSupabase()
    worker._claim_supervised_drain_allowed_batch = lambda control_state: None
    worker._select_next_entity_cursor_candidate = lambda **_kwargs: (_ for _ in ()).throw(
        AssertionError("supervised drain exhaustion must not fall through to manifest fallback")
    )
    monkeypatch.setattr(
        "entity_pipeline_worker.read_pipeline_control_state",
        lambda: {
            "is_paused": False,
            "requested_state": "running",
            "observed_state": "running",
            "transition_state": "running",
            "desired_state": "running",
            "supervised_drain_enabled": True,
            "supervised_drain_allowed_batch_ids": ["batch-allowed"],
            "supervised_drain_disable_manifest_auto_advance": True,
            "supervised_drain_pause_when_exhausted": True,
        },
    )
    monkeypatch.setattr("entity_pipeline_worker.write_pipeline_control_state", lambda payload: writes.append(payload) or payload)

    claimed = worker.claim_next_batch()

    assert claimed is None
    assert writes[-1]["is_paused"] is True
    assert writes[-1]["pause_reason"] == "supervised_drain_exhausted"
    assert writes[-1]["supervised_drain_enabled"] is False


def test_claim_next_batch_does_not_manifest_fallback_after_paused_checkpoint_auto_resume(monkeypatch):
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker.reconcile_stale_pipeline_state = lambda: None
    worker.recover_stale_batches = lambda: None
    worker.worker_id = "worker-1"
    worker.lease_seconds = 60
    worker._now_iso = lambda: "2026-05-05T00:10:00+01:00"
    worker._backend_preflight = lambda: (True, None)
    worker._get_batch_record = lambda _batch_id: {}

    class FakeRpcQuery:
        def execute(self):
            return SimpleNamespace(data=[])

    class FakeSupabase:
        def rpc(self, name, params):
            assert name == "claim_next_entity_import_batch"
            return FakeRpcQuery()

    worker.supabase = FakeSupabase()
    worker._select_next_entity_cursor_candidate = lambda **_kwargs: (_ for _ in ()).throw(
        AssertionError("paused checkpoint auto-resume must not fall through to manifest fallback")
    )
    monkeypatch.setattr(
        "entity_pipeline_worker.read_pipeline_control_state",
        lambda: {
            "is_paused": False,
            "pause_reason": None,
            "requested_state": "running",
            "observed_state": "running",
            "transition_state": "running",
            "desired_state": "running",
            "current_batch_id": None,
            "current_entity_id": None,
            "current_canonical_entity_id": None,
            "last_self_heal_action": "paused_checkpoint_auto_resume",
        },
    )
    monkeypatch.setattr("entity_pipeline_worker.write_pipeline_control_state", lambda payload: payload)

    claimed = worker.claim_next_batch()

    assert claimed is None


def test_claim_next_batch_does_not_recover_queued_run_under_completed_batch(monkeypatch):
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker.recover_stale_batches = lambda: None
    worker.worker_id = "worker-1"
    worker.lease_seconds = 60
    rpc_calls = []
    stranded_rows = [
        {
            "batch_id": "batch-completed",
            "batch_status": "completed",
            "entity_id": "arsenal-fc",
            "status": "queued",
            "metadata": {
                "current_question_id": "q7_procurement_signal",
                "next_repair_question_id": "q11_decision_owner",
            },
        }
    ]
    table_selects = []

    class FakeRpcQuery:
        def execute(self):
            # Current queue-first behavior depends entirely on the claim RPC. If the
            # database will not surface a queued run because its parent batch is already
            # completed, the worker returns idle here and does not recover the stranded run.
            return SimpleNamespace(data=[])

    class FakeTableQuery:
        def __init__(self, table_name):
            self.table_name = table_name
            self.filters = []

        def select(self, *_args, **_kwargs):
            return self

        def eq(self, column, value):
            self.filters.append(("eq", column, value))
            return self

        def execute(self):
            table_selects.append((self.table_name, tuple(self.filters)))
            if self.table_name == "entity_pipeline_runs":
                return SimpleNamespace(data=stranded_rows)
            if self.table_name == "entity_import_batches":
                return SimpleNamespace(data=[{"id": "batch-completed", "status": "completed"}])
            return SimpleNamespace(data=[])

    class FakeSupabase:
        def rpc(self, name, params):
            rpc_calls.append((name, params))
            return FakeRpcQuery()

        def table(self, name):
            return FakeTableQuery(name)

    worker.supabase = FakeSupabase()
    worker._select_next_entity_cursor_candidate = lambda **kwargs: None
    monkeypatch.setattr(
        "entity_pipeline_worker.read_pipeline_control_state",
        lambda: {"is_paused": False, "requested_state": "running", "observed_state": "running"},
    )
    monkeypatch.setattr("entity_pipeline_worker.write_pipeline_control_state", lambda payload: payload)

    claimed = worker.claim_next_batch()

    assert claimed is None
    assert rpc_calls == [("claim_next_entity_import_batch", {"worker_id": "worker-1", "lease_seconds": 60})]
    assert stranded_rows[0]["status"] == "queued"
    assert stranded_rows[0]["batch_status"] == "completed"
    assert table_selects == []


def test_select_next_entity_cursor_candidate_prefers_resumable_entity(monkeypatch):
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)

    candidate = {
        "candidate_kind": "resume_entity",
        "entity_id": "entity-b",
        "canonical_entity_id": "entity-b",
        "entity_name": "Entity B",
        "entity_type": "CLUB",
        "current_question_id": "q7_procurement_signal",
        "next_repair_question_id": None,
        "question_id": None,
    }

    class FakeRpcQuery:
        def execute(self):
            return SimpleNamespace(data=[candidate])

    worker.supabase = SimpleNamespace(
        rpc=lambda name, params: (
            FakeRpcQuery()
            if name == "select_next_entity_cursor_candidate" and params == {
                "current_entity_id": "entity-c",
                "current_canonical_entity_id": "entity-c",
            }
            else None
        )
    )

    selected = worker._select_next_entity_cursor_candidate(
        current_entity_id="entity-c",
        current_canonical_entity_id="entity-c",
    )

    assert selected == candidate


def test_select_next_entity_cursor_candidate_falls_back_to_manifest_when_no_resumable_work(monkeypatch):
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker.supabase = SimpleNamespace(
        rpc=lambda name, params: SimpleNamespace(execute=lambda: SimpleNamespace(data=[]))
    )
    worker._find_next_manifest_entity = lambda **kwargs: {
        "entity_id": "entity-d",
        "canonical_entity_id": "entity-d",
        "entity_name": "Entity D",
        "entity_type": "CLUB",
        "properties": {"priority_score": 91},
    }

    selected = worker._select_next_entity_cursor_candidate(
        current_entity_id="entity-c",
        current_canonical_entity_id="entity-c",
    )

    assert selected["candidate_kind"] == "next_entity"
    assert selected["entity_id"] == "entity-d"
    assert selected["canonical_entity_id"] == "entity-d"
    assert selected["entity_type"] == "CLUB"
    assert selected["question_id"] is None


def test_find_next_manifest_entity_seeds_from_manifest_start_when_cursor_empty():
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker._load_manifest_entities = lambda: [
        {"entity_id": "entity-a", "canonical_entity_id": "entity-a", "entity_name": "Entity A", "entity_type": "CLUB", "properties": {}},
        {"entity_id": "entity-b", "canonical_entity_id": "entity-b", "entity_name": "Entity B", "entity_type": "CLUB", "properties": {}},
        {"entity_id": "entity-c", "canonical_entity_id": "entity-c", "entity_name": "Entity C", "entity_type": "CLUB", "properties": {}},
    ]
    worker._has_active_pipeline_run = lambda *_args, **_kwargs: False

    next_entity = worker._find_next_manifest_entity(
        current_entity_id="",
        current_canonical_entity_id=None,
    )

    assert next_entity["entity_id"] == "entity-a"


def test_find_next_manifest_entity_wraps_to_manifest_start_after_last_entity():
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker._load_manifest_entities = lambda: [
        {"entity_id": "entity-a", "canonical_entity_id": "entity-a", "entity_name": "Entity A", "entity_type": "CLUB", "properties": {}},
        {"entity_id": "entity-b", "canonical_entity_id": "entity-b", "entity_name": "Entity B", "entity_type": "CLUB", "properties": {}},
        {"entity_id": "entity-c", "canonical_entity_id": "entity-c", "entity_name": "Entity C", "entity_type": "CLUB", "properties": {}},
    ]
    worker._has_active_pipeline_run = lambda *_args, **_kwargs: False

    next_entity = worker._find_next_manifest_entity(
        current_entity_id="entity-c",
        current_canonical_entity_id="entity-c",
    )

    assert next_entity["entity_id"] == "entity-a"


def test_has_active_pipeline_run_ignores_stale_expired_running_rows():
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)

    stale_row = {
        "id": "run-stale",
        "status": "running",
        "started_at": "2026-04-19T19:57:47.536831+00:00",
        "metadata": {
            "heartbeat_at": "2026-04-19T20:08:23.772982+00:00",
            "lease_expires_at": "2026-04-19T20:09:53.772982+00:00",
        },
    }

    class FakeQuery:
        def select(self, *_args, **_kwargs):
            return self

        def eq(self, *_args, **_kwargs):
            return self

        def in_(self, *_args, **_kwargs):
            return self

        def limit(self, *_args, **_kwargs):
            return self

        def execute(self):
            return SimpleNamespace(data=[stale_row])

    worker.supabase = SimpleNamespace(table=lambda _name: FakeQuery())

    assert worker._has_active_pipeline_run("entity-a", "entity-a") is False


def test_claim_next_batch_materializes_resumable_candidate_when_queue_is_idle(monkeypatch):
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker.recover_stale_batches = lambda: None
    worker.worker_id = "worker-1"
    worker.lease_seconds = 60
    worker._build_follow_on_repair_batch_id = lambda: "batch-resume"
    worker._select_next_entity_cursor_candidate = lambda **kwargs: {
        "candidate_kind": "resume_repair",
        "entity_id": "entity-b",
        "canonical_entity_id": "entity-b",
        "entity_name": "Entity B",
        "entity_type": "CLUB",
        "question_id": "q11_decision_owner",
        "current_question_id": "q7_procurement_signal",
        "next_repair_question_id": "q11_decision_owner",
    }
    inserted_batches = []
    inserted_runs = []
    rpc_calls = []

    class FakeRpcQuery:
        def __init__(self, rows):
            self.rows = rows

        def execute(self):
            return SimpleNamespace(data=self.rows)

    class FakeTableQuery:
        def __init__(self, table_name):
            self.table_name = table_name
            self.payload = None
            self.filters = {}
            self.action = None

        def select(self, *_args, **_kwargs):
            self.action = "select"
            return self

        def eq(self, key, value):
            self.filters[key] = value
            return self

        def limit(self, *_args, **_kwargs):
            return self

        def insert(self, payload):
            self.payload = payload
            return self

        def execute(self):
            if self.table_name == "entity_import_batches":
                inserted_batches.append(self.payload)
                return SimpleNamespace(data=[self.payload])
            if self.table_name == "entity_pipeline_runs":
                if self.payload is not None:
                    inserted_runs.append(self.payload)
                    return SimpleNamespace(data=self.payload)
                return SimpleNamespace(data=[{
                    "entity_id": "entity-c",
                    "entity_name": "Entity C",
                    "canonical_entity_id": "canonical-c",
                }])
            return SimpleNamespace(data=[])

    class FakeSupabase:
        def rpc(self, name, params):
            rpc_calls.append((name, params))
            if len(rpc_calls) == 1:
                return FakeRpcQuery([])
            return FakeRpcQuery([{"id": "batch-resume", "status": "running", "entity_id": "entity-b"}])

        def table(self, table_name):
            return FakeTableQuery(table_name)

    worker.supabase = FakeSupabase()
    monkeypatch.setattr(
        "entity_pipeline_worker.read_pipeline_control_state",
        lambda: {
            "is_paused": False,
            "pause_reason": None,
            "requested_state": "running",
            "observed_state": "running",
            "transition_state": "running",
            "desired_state": "running",
        },
    )
    monkeypatch.setattr("entity_pipeline_worker.write_pipeline_control_state", lambda payload: payload)

    claimed = worker.claim_next_batch()

    assert claimed["id"] == "batch-resume"
    assert len(rpc_calls) == 2
    assert inserted_batches[-1]["metadata"]["source"] == "entity_cursor_resume"
    assert inserted_batches[-1]["metadata"]["cascade_dependents"] is False
    assert inserted_runs[-1][0]["metadata"]["rerun_mode"] == "question"
    assert inserted_runs[-1][0]["metadata"]["cascade_dependents"] is False
    assert inserted_runs[-1][0]["metadata"]["question_id"] == "q11_decision_owner"


def test_restart_matrix_manual_stop_mid_question_resumes_as_bounded_question_repair(monkeypatch):
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker.recover_stale_batches = lambda: None
    worker.worker_id = "worker-manual-stop"
    worker.lease_seconds = 60
    worker._build_follow_on_repair_batch_id = lambda: "batch-manual-stop-resume"
    worker._select_next_entity_cursor_candidate = lambda **kwargs: {
        "candidate_kind": "resume_repair",
        "entity_id": "entity-b",
        "canonical_entity_id": "entity-b",
        "entity_name": "Entity B",
        "entity_type": "CLUB",
        "question_id": "q11_decision_owner",
        "current_question_id": "q7_procurement_signal",
        "next_repair_question_id": "q11_decision_owner",
    }
    inserted_batches = []
    inserted_runs = []

    class FakeRpcQuery:
        def __init__(self, rows):
            self.rows = rows

        def execute(self):
            return SimpleNamespace(data=self.rows)

    class FakeTableQuery:
        def __init__(self, table_name):
            self.table_name = table_name
            self.payload = None
            self.filters = {}

        def select(self, *_args, **_kwargs):
            return self

        def eq(self, key, value):
            self.filters[key] = value
            return self

        def limit(self, *_args, **_kwargs):
            return self

        def insert(self, payload):
            self.payload = payload
            return self

        def execute(self):
            if self.table_name == "entity_import_batches":
                inserted_batches.append(self.payload)
                return SimpleNamespace(data=[self.payload])
            if self.table_name == "entity_pipeline_runs":
                if self.payload is not None:
                    inserted_runs.append(self.payload)
                    return SimpleNamespace(data=self.payload)
                return SimpleNamespace(data=[{
                    "entity_id": "entity-c",
                    "entity_name": "Entity C",
                    "canonical_entity_id": "canonical-c",
                }])
            return SimpleNamespace(data=[])

    class FakeSupabase:
        def __init__(self):
            self.calls = 0

        def rpc(self, _name, _params):
            self.calls += 1
            if self.calls == 1:
                return FakeRpcQuery([])
            return FakeRpcQuery([{"id": "batch-manual-stop-resume", "status": "running", "entity_id": "entity-b"}])

        def table(self, table_name):
            return FakeTableQuery(table_name)

    worker.supabase = FakeSupabase()
    monkeypatch.setattr(
        "entity_pipeline_worker.read_pipeline_control_state",
        lambda: {
            "is_paused": False,
            "pause_reason": "manual stop",
            "requested_state": "running",
            "observed_state": "running",
            "transition_state": "running",
            "desired_state": "running",
        },
    )
    monkeypatch.setattr("entity_pipeline_worker.write_pipeline_control_state", lambda payload: payload)

    claimed = worker.claim_next_batch()

    assert claimed["id"] == "batch-manual-stop-resume"
    assert inserted_batches[-1]["metadata"]["rerun_mode"] == "question"
    assert inserted_batches[-1]["metadata"]["cascade_dependents"] is False
    assert inserted_runs[-1][0]["metadata"]["question_id"] == "q11_decision_owner"
    assert inserted_runs[-1][0]["metadata"]["rerun_mode"] == "question"
    assert inserted_runs[-1][0]["metadata"]["cascade_dependents"] is False


def test_restart_matrix_worker_crash_mid_question_prefers_unfinished_repair_checkpoint(monkeypatch):
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)

    candidate = {
        "candidate_kind": "resume_repair",
        "entity_id": "entity-b",
        "canonical_entity_id": "entity-b",
        "entity_name": "Entity B",
        "entity_type": "CLUB",
        "current_question_id": "q7_procurement_signal",
        "next_repair_question_id": "q11_decision_owner",
        "question_id": "q11_decision_owner",
    }

    class FakeRpcQuery:
        def execute(self):
            return SimpleNamespace(data=[candidate])

    worker.supabase = SimpleNamespace(
        rpc=lambda name, params: (
            FakeRpcQuery()
            if name == "select_next_entity_cursor_candidate" and params == {
                "current_entity_id": "entity-c",
                "current_canonical_entity_id": "entity-c",
            }
            else None
        )
    )
    worker._find_next_manifest_entity = lambda **kwargs: {
        "entity_id": "entity-d",
        "canonical_entity_id": "entity-d",
        "entity_name": "Entity D",
        "entity_type": "CLUB",
    }

    selected = worker._select_next_entity_cursor_candidate(
        current_entity_id="entity-c",
        current_canonical_entity_id="entity-c",
    )

    assert selected["candidate_kind"] == "resume_repair"
    assert selected["question_id"] == "q11_decision_owner"
    assert selected["entity_id"] == "entity-b"


def test_restart_matrix_completed_batch_with_resumable_metadata_resumes_from_run_checkpoint(monkeypatch):
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker.recover_stale_batches = lambda: None
    worker.worker_id = "worker-completed-batch"
    worker.lease_seconds = 60
    worker._build_follow_on_repair_batch_id = lambda: "batch-completed-resume"
    worker._select_next_entity_cursor_candidate = lambda **kwargs: {
        "candidate_kind": "resume_repair",
        "entity_id": "entity-b",
        "canonical_entity_id": "entity-b",
        "entity_name": "Entity B",
        "entity_type": "CLUB",
        "question_id": "q11_decision_owner",
        "current_question_id": "q7_procurement_signal",
        "next_repair_question_id": "q11_decision_owner",
    }
    inserted_runs = []

    class FakeRpcQuery:
        def __init__(self, rows):
            self.rows = rows

        def execute(self):
            return SimpleNamespace(data=self.rows)

    class FakeTableQuery:
        def __init__(self, table_name):
            self.table_name = table_name
            self.payload = None
            self.filters = {}

        def select(self, *_args, **_kwargs):
            return self

        def eq(self, key, value):
            self.filters[key] = value
            return self

        def limit(self, *_args, **_kwargs):
            return self

        def insert(self, payload):
            self.action = "insert"
            self.payload = payload
            return self

        def execute(self):
            if self.table_name == "entity_pipeline_runs" and self.action == "insert":
                inserted_runs.append(self.payload)
                return SimpleNamespace(data=self.payload)
            return SimpleNamespace(data=[self.payload] if self.payload is not None else [])

    class FakeSupabase:
        def __init__(self):
            self.calls = 0

        def rpc(self, _name, _params):
            self.calls += 1
            if self.calls == 1:
                return FakeRpcQuery([])
            return FakeRpcQuery([{"id": "batch-completed-resume", "status": "running", "entity_id": "entity-b"}])

        def table(self, table_name):
            return FakeTableQuery(table_name)

    worker.supabase = FakeSupabase()
    monkeypatch.setattr(
        "entity_pipeline_worker.read_pipeline_control_state",
        lambda: {"is_paused": False, "requested_state": "running", "observed_state": "running"},
    )
    monkeypatch.setattr("entity_pipeline_worker.write_pipeline_control_state", lambda payload: payload)

    claimed = worker.claim_next_batch()

    assert claimed["id"] == "batch-completed-resume"
    assert inserted_runs[-1][0]["metadata"]["source"] == "entity_cursor_resume"
    assert inserted_runs[-1][0]["metadata"]["question_id"] == "q11_decision_owner"
    assert inserted_runs[-1][0]["metadata"]["rerun_mode"] == "question"


def test_restart_matrix_partial_checkpoint_metadata_falls_back_to_current_question_resume(monkeypatch):
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker._build_follow_on_repair_batch_id = lambda: "batch-partial"
    worker._now_iso = lambda: "2026-04-23T12:00:00+00:00"
    inserted_batches = []
    inserted_runs = []

    class FakeTableQuery:
        def __init__(self, table_name):
            self.table_name = table_name
            self.payload = None
            self.filters = {}

        def select(self, *_args, **_kwargs):
            return self

        def eq(self, key, value):
            self.filters[key] = value
            return self

        def limit(self, *_args, **_kwargs):
            return self

        def insert(self, payload):
            self.payload = payload
            return self

        def execute(self):
            if self.table_name == "entity_import_batches":
                inserted_batches.append(self.payload)
                return SimpleNamespace(data=[self.payload])
            if self.table_name == "entity_pipeline_runs":
                if self.payload is not None:
                    inserted_runs.append(self.payload)
                    return SimpleNamespace(data=self.payload)
                return SimpleNamespace(data=[{
                    "entity_id": "entity-c",
                    "entity_name": "Entity C",
                    "canonical_entity_id": "canonical-c",
                }])
            return SimpleNamespace(data=[])

    worker.supabase = SimpleNamespace(table=lambda table_name: FakeTableQuery(table_name))
    worker._safe_execute = lambda operation, context=None: operation()

    batch_id = worker._materialize_entity_cursor_candidate(
        {
            "candidate_kind": "resume_repair",
            "entity_id": "entity-b",
            "canonical_entity_id": "entity-b",
            "entity_name": "Entity B",
            "entity_type": "CLUB",
            "question_id": None,
            "current_question_id": "q7_procurement_signal",
            "next_repair_question_id": None,
        },
        queue_mode="durable_worker",
    )

    assert batch_id == "batch-partial"
    assert inserted_batches[-1]["metadata"]["rerun_mode"] == "question"
    assert inserted_batches[-1]["metadata"]["question_id"] == "q7_procurement_signal"
    assert inserted_runs[-1][0]["metadata"]["question_id"] == "q7_procurement_signal"
    assert inserted_runs[-1][0]["metadata"]["cascade_dependents"] is False


def test_claim_next_batch_prefers_existing_queued_batch_over_resumable_candidate(monkeypatch):
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker.recover_stale_batches = lambda: None
    worker.worker_id = "worker-1"
    worker.lease_seconds = 60
    worker._build_follow_on_repair_batch_id = lambda: "batch-resume"
    select_calls = []

    def _select_next_entity_cursor_candidate(**kwargs):
        select_calls.append(kwargs)
        return {
            "candidate_kind": "resume_repair",
            "entity_id": "entity-b",
            "canonical_entity_id": "entity-b",
            "entity_name": "Entity B",
            "entity_type": "CLUB",
            "question_id": "q7_procurement_signal",
            "current_question_id": "q7_procurement_signal",
            "next_repair_question_id": None,
        }

    worker._select_next_entity_cursor_candidate = _select_next_entity_cursor_candidate
    inserted_batches = []
    inserted_runs = []
    rpc_calls = []

    class FakeRpcQuery:
        def __init__(self, rows):
            self.rows = rows

        def execute(self):
            return SimpleNamespace(data=self.rows)

    class FakeTableQuery:
        def __init__(self, table_name):
            self.table_name = table_name
            self.payload = None
            self.filters = {}

        def select(self, *_args, **_kwargs):
            return self

        def eq(self, key, value):
            self.filters[key] = value
            return self

        def limit(self, *_args, **_kwargs):
            return self

        def insert(self, payload):
            self.payload = payload
            return self

        def execute(self):
            if self.table_name == "entity_import_batches":
                inserted_batches.append(self.payload)
                return SimpleNamespace(data=[self.payload])
            if self.table_name == "entity_pipeline_runs":
                if self.payload is not None:
                    inserted_runs.append(self.payload)
                    return SimpleNamespace(data=self.payload)
                return SimpleNamespace(data=[{
                    "entity_id": "entity-c",
                    "entity_name": "Entity C",
                    "canonical_entity_id": "canonical-c",
                }])
            return SimpleNamespace(data=[])

    class FakeSupabase:
        def rpc(self, name, params):
            rpc_calls.append((name, params))
            return FakeRpcQuery(
                [
                    {
                        "id": "batch-resume",
                        "status": "running",
                        "entity_id": "entity-b",
                        "entity_name": "Entity B",
                        "phase": "dossier_generation",
                    }
                ]
            )

        def table(self, table_name):
            return FakeTableQuery(table_name)

    worker.supabase = FakeSupabase()
    monkeypatch.setattr(
        "entity_pipeline_worker.read_pipeline_control_state",
        lambda: {
            "is_paused": False,
            "pause_reason": None,
            "requested_state": "running",
            "observed_state": "running",
            "transition_state": "running",
            "desired_state": "running",
        },
    )
    monkeypatch.setattr("entity_pipeline_worker.write_pipeline_control_state", lambda payload: payload)

    claimed = worker.claim_next_batch()

    assert claimed["id"] == "batch-resume"
    assert rpc_calls == [("claim_next_entity_import_batch", {"worker_id": "worker-1", "lease_seconds": 60})]
    assert select_calls == []
    assert inserted_batches == []
    assert inserted_runs == []


def test_claim_next_batch_uses_control_state_cursor_for_manifest_fallback(monkeypatch):
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker.recover_stale_batches = lambda: None
    worker.worker_id = "worker-1"
    worker.lease_seconds = 60
    worker._build_follow_on_repair_batch_id = lambda: "batch-manifest"
    select_calls = []

    def _select_next_entity_cursor_candidate(**kwargs):
        select_calls.append(kwargs)
        if kwargs.get("include_manifest_fallback") is False:
            return None
        return {
            "candidate_kind": "next_entity",
            "entity_id": "entity-c",
            "canonical_entity_id": "entity-c",
            "entity_name": "Entity C",
            "entity_type": "CLUB",
        }

    worker._select_next_entity_cursor_candidate = _select_next_entity_cursor_candidate
    worker._materialize_entity_cursor_candidate = lambda candidate, queue_mode=None: "batch-manifest"
    inserted_batches = []
    inserted_runs = []
    rpc_calls = []

    class FakeRpcQuery:
        def __init__(self, rows):
            self.rows = rows

        def execute(self):
            return SimpleNamespace(data=self.rows)

    class FakeTableQuery:
        def __init__(self, table_name):
            self.table_name = table_name
            self.payload = None
            self.filters = {}

        def select(self, *_args, **_kwargs):
            return self

        def eq(self, key, value):
            self.filters[key] = value
            return self

        def limit(self, *_args, **_kwargs):
            return self

        def insert(self, payload):
            self.payload = payload
            return self

        def execute(self):
            if self.table_name == "entity_import_batches":
                inserted_batches.append(self.payload)
                return SimpleNamespace(data=[self.payload])
            if self.table_name == "entity_pipeline_runs":
                if self.payload is not None:
                    inserted_runs.append(self.payload)
                    return SimpleNamespace(data=self.payload)
                return SimpleNamespace(data=[{
                    "entity_id": "entity-c",
                    "entity_name": "Entity C",
                    "canonical_entity_id": "canonical-c",
                }])
            return SimpleNamespace(data=[])

    class FakeSupabase:
        def rpc(self, name, params):
            rpc_calls.append((name, params))
            if len(rpc_calls) == 1:
                return FakeRpcQuery([])
            return FakeRpcQuery([{"id": "batch-manifest", "status": "running", "entity_id": "entity-c"}])

        def table(self, table_name):
            return FakeTableQuery(table_name)

    worker.supabase = FakeSupabase()
    monkeypatch.setattr(
        "entity_pipeline_worker.read_pipeline_control_state",
        lambda: {
            "is_paused": False,
            "pause_reason": None,
            "requested_state": "running",
            "observed_state": "running",
            "transition_state": "running",
            "desired_state": "running",
            "current_entity_id": "entity-b",
            "current_canonical_entity_id": "entity-b",
            "current_entity_name": "Entity B",
            "current_batch_id": "batch-prev",
            "cursor_source": "resume_claim",
        },
    )
    writes = []
    monkeypatch.setattr("entity_pipeline_worker.write_pipeline_control_state", lambda payload: writes.append(payload) or payload)

    claimed = worker.claim_next_batch()

    assert claimed["id"] == "batch-manifest"
    assert select_calls[0]["current_entity_id"] == "entity-b"
    assert select_calls[0]["current_canonical_entity_id"] == "entity-b"
    assert select_calls[0]["include_manifest_fallback"] is False
    assert select_calls[1]["current_entity_id"] == "entity-b"
    assert select_calls[1]["current_canonical_entity_id"] == "entity-b"
    assert select_calls[1]["include_manifest_fallback"] is True
    assert writes[-1]["cursor_source"] == "manifest_next_claim"
    assert writes[-1]["current_entity_id"] == "entity-c"
    assert writes[-1]["current_entity_name"] == "Entity C"
    assert writes[-1]["current_canonical_entity_id"] == "canonical-c"


def test_claim_next_batch_backend_preflight_failure_pauses_before_claim(monkeypatch):
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker.worker_id = "worker-preflight"
    worker.lease_seconds = 60
    worker._now_iso = lambda: "2026-04-24T03:00:00+00:00"
    worker._backend_preflight = lambda: (False, "backend_route_missing")
    worker.supabase = SimpleNamespace(
        rpc=lambda name, params: (_ for _ in ()).throw(AssertionError("should not claim when backend preflight fails"))
    )

    writes = []
    monkeypatch.setattr(
        "entity_pipeline_worker.read_pipeline_control_state",
        lambda: {"requested_state": "running", "observed_state": "running", "is_paused": False},
    )
    monkeypatch.setattr("entity_pipeline_worker.write_pipeline_control_state", lambda payload: writes.append(payload) or payload)

    claimed = worker.claim_next_batch()

    assert claimed is None
    assert writes[-1]["is_paused"] is True
    assert writes[-1]["stop_reason"] == "backend_route_missing"
    assert writes[-1]["observed_state"] == "paused"


def test_recover_stale_batches_uses_rpc_requeue():
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    captured = {}

    class FakeRpcQuery:
        def execute(self):
            captured["executed"] = True
            return SimpleNamespace(data=[{"id": "batch-1"}])

    class FakeSupabase:
        def rpc(self, name, params):
            captured["name"] = name
            captured["params"] = params
            return FakeRpcQuery()

    worker.supabase = FakeSupabase()

    worker.recover_stale_batches()

    assert captured["name"] == "requeue_stale_entity_import_batches"
    assert "stale_before" in captured["params"]


def test_reconcile_stale_pipeline_state_quarantines_stale_runs_and_clears_stale_control_state(monkeypatch):
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker.worker_id = "worker-1"
    worker._now_iso = lambda: "2026-05-03T12:00:00+00:00"
    stale_runs = [
        {
            "id": "run-stale",
            "batch_id": "batch-stale",
            "entity_id": "entity-stale",
            "canonical_entity_id": "entity-stale",
            "entity_name": "Entity Stale",
            "status": "running",
            "phase": "dossier_generation",
            "started_at": "2026-05-03T10:00:00+00:00",
            "metadata": {
                "heartbeat_at": "2026-05-03T10:01:00+00:00",
                "lease_expires_at": "2026-05-03T10:02:00+00:00",
                "retry_state": "running",
            },
        }
    ]
    updated_runs = []
    control_writes = []

    class FakeQuery:
        def __init__(self, table_name):
            self.table_name = table_name

        def select(self, *_args, **_kwargs):
            return self

        def in_(self, *_args, **_kwargs):
            return self

        def order(self, *_args, **_kwargs):
            return self

        def limit(self, *_args, **_kwargs):
            return self

        def execute(self):
            if self.table_name == "entity_pipeline_runs":
                return SimpleNamespace(data=stale_runs)
            return SimpleNamespace(data=[])

    worker.supabase = SimpleNamespace(table=lambda name: FakeQuery(name))
    worker.update_run = lambda batch_id, entity_id, payload: updated_runs.append((batch_id, entity_id, payload))
    monkeypatch.setattr(
        "entity_pipeline_worker.read_pipeline_control_state",
        lambda: {
            "is_paused": False,
            "pause_reason": None,
            "stop_reason": None,
            "stop_details": None,
            "desired_state": "running",
            "requested_state": "running",
            "observed_state": "running",
            "transition_state": "running",
            "current_batch_id": "batch-stale",
            "current_entity_id": "entity-stale",
            "current_canonical_entity_id": "entity-stale",
            "current_entity_name": "Entity Stale",
            "current_question_id": "q11_decision_owner",
            "current_question_text": "Who owns this?",
            "current_action": "q11_decision_owner",
            "current_phase": "dossier_generation",
            "current_started_at": "2026-05-03T10:00:00+00:00",
            "current_activity_at": "2026-05-03T10:01:00+00:00",
            "cursor_source": "resume_claim",
        },
    )
    monkeypatch.setattr(
        "entity_pipeline_worker.write_pipeline_control_state",
        lambda payload: control_writes.append(payload) or payload,
    )

    reconciled = worker.reconcile_stale_pipeline_state()

    assert reconciled["quarantined_runs"] == 1
    assert reconciled["cleared_current_pointer"] is True
    assert updated_runs[-1][0] == "batch-stale"
    assert updated_runs[-1][1] == "entity-stale"
    metadata = updated_runs[-1][2]["metadata"]
    assert updated_runs[-1][2]["status"] == "failed"
    assert metadata["failure_class"] == "stale_pipeline_run_quarantined"
    assert metadata["continue_pipeline_on_failure"] is True
    assert metadata["retry_state"] == "failed"
    assert metadata["recovery_source"] == "stale_run_quarantine"
    assert control_writes[-1]["current_batch_id"] is None
    assert control_writes[-1]["current_entity_id"] is None
    assert control_writes[-1]["current_question_id"] is None
    assert control_writes[-1]["cursor_source"] is None
    assert control_writes[-1]["state"] == "stale_state_repair"
    assert control_writes[-1]["health_class"] == "stale_state_repair"
    assert control_writes[-1]["last_self_heal_action"] == "stale_run_quarantine"


def test_claim_next_batch_reconciles_stale_runs_before_claiming_next_batch(monkeypatch):
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker.worker_id = "worker-1"
    worker.lease_seconds = 60
    calls = {"reconcile": 0, "recover": 0}
    writes = []

    class FakeRpcQuery:
        def execute(self):
            return SimpleNamespace(data=[{"id": "batch-next", "entity_id": "entity-next", "entity_name": "Entity Next", "metadata": {}}])

    class FakeSupabase:
        def rpc(self, name, params):
            assert name == "claim_next_entity_import_batch"
            assert params["worker_id"] == "worker-1"
            return FakeRpcQuery()

    worker.supabase = FakeSupabase()
    worker._backend_preflight = lambda: (True, "")
    worker._resolve_batch_cursor_identity = lambda batch: {
        "current_entity_id": batch["entity_id"],
        "current_canonical_entity_id": batch["entity_id"],
        "current_entity_name": batch["entity_name"],
    }
    worker.reconcile_stale_pipeline_state = lambda: calls.__setitem__("reconcile", calls["reconcile"] + 1) or {
        "quarantined_runs": 1,
        "cleared_current_pointer": True,
    }
    worker.recover_stale_batches = lambda: calls.__setitem__("recover", calls["recover"] + 1)
    monkeypatch.setattr(
        "entity_pipeline_worker.read_pipeline_control_state",
        lambda: {
            "is_paused": False,
            "requested_state": "running",
            "observed_state": "running",
            "transition_state": "running",
        },
    )
    monkeypatch.setattr("entity_pipeline_worker.write_pipeline_control_state", lambda payload: writes.append(payload) or payload)
    monkeypatch.setattr("entity_pipeline_worker._heartbeat_supervisor_state", lambda: None)

    claimed = worker.claim_next_batch()

    assert calls["reconcile"] == 1
    assert calls["recover"] == 1
    assert claimed["id"] == "batch-next"
    assert writes[-1]["current_batch_id"] == "batch-next"


def test_process_batch_persists_discovery_context(monkeypatch):
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker._now_iso = lambda: "2026-03-03T03:30:00+00:00"
    worker._batch_metadata = lambda batch: batch.get("metadata", {})
    worker.refresh_batch_heartbeat = lambda batch_id, metadata=None: {**(metadata or {}), "heartbeat_at": "2026-03-03T03:30:00+00:00"}
    worker._start_batch_heartbeat = lambda batch_id, metadata=None: (SimpleNamespace(set=lambda: None), SimpleNamespace(join=lambda timeout=1: None))

    run = {
        "entity_id": "international-canoe-federation",
        "entity_name": "International Canoe Federation",
        "status": "queued",
        "phase": "entity_registration",
        "id": "batch-1_international-canoe-federation",
        "metadata": {"entity_type": "FEDERATION"},
    }
    worker.get_batch_runs = lambda batch_id: [run]
    worker.sync_cached_entity = lambda batch_id, run, result, status: None
    persisted_monitoring = []
    worker.persist_monitoring_outputs = lambda batch_id, run, result: persisted_monitoring.append((batch_id, run, result))
    worker._queue_manifest_auto_advance = lambda **_kwargs: None

    updates = []
    worker.update_run = lambda batch_id, entity_id, payload: updates.append((batch_id, entity_id, payload))

    class FakeSelectQuery:
        def __init__(self, data):
            self.data = data
        def eq(self, *_args, **_kwargs):
            return self
        def limit(self, *_args, **_kwargs):
            return self
        def execute(self):
            return SimpleNamespace(data=self.data)

    class FakeUpdateQuery:
        def eq(self, *_args, **_kwargs):
            return self
        def execute(self):
            return SimpleNamespace(data=[])

    class FakeTable:
        def select(self, _fields):
            return FakeSelectQuery([{"metadata": {"phase_details": {"status": "running"}}}])
        def update(self, _payload):
            return FakeUpdateQuery()

    worker.supabase = SimpleNamespace(table=lambda _name: FakeTable())
    worker.call_pipeline = lambda run, batch_id: {
        "sales_readiness": "MONITOR",
        "rfp_count": 0,
        "completed_at": "2026-03-03T03:29:00+00:00",
        "phases": {
            "discovery": {"status": "completed"},
            "dashboard_scoring": {"status": "completed"},
        },
        "artifacts": {
            "dossier_id": "international-canoe-federation",
            "dossier": {
                "metadata": {
                    "canonical_sources": {
                        "official_site": "https://www.canoeicf.com",
                        "press_release": "https://www.canoeicf.com/news",
                    }
                }
            },
            "scores": {"sales_readiness": "MONITOR"},
            "monitoring_result": {
                "pages_fetched": 2,
                "pages_changed": 1,
                "pages_unchanged": 1,
                "candidate_count": 1,
                "snapshots": [
                    {
                        "entity_id": "international-canoe-federation",
                        "page_class": "official_site",
                        "url": "https://www.canoeicf.com",
                        "content_hash": "hash-1",
                        "fetched_at": "2026-03-03T03:20:00+00:00",
                        "changed": True,
                        "metadata": {"content_length": 500},
                    }
                ],
                "candidates": [
                    {
                        "entity_id": "international-canoe-federation",
                        "batch_id": "batch-1",
                        "run_id": "batch-1_international-canoe-federation",
                        "page_class": "official_site",
                        "url": "https://www.canoeicf.com",
                        "content_hash": "hash-1",
                        "candidate_type": "procurement_signal",
                        "score": 0.82,
                        "evidence_excerpt": "Confirmed procurement activity",
                        "metadata": {},
                    }
                ],
            },
            "discovery_result": {
                "performance_summary": {
                    "slowest_iteration": {
                        "hypothesis_id": "international-canoe-federation_digital_leadership_hire",
                        "hop_type": "official_site",
                    }
                },
                "hypotheses": [
                    {
                        "hypothesis_id": "international-canoe-federation_federation_procurement_programme",
                        "confidence": 0.78,
                        "metadata": {
                            "template_id": "federation_governing_body",
                            "pattern_name": "Federation Procurement Programme",
                        },
                    },
                    {
                        "hypothesis_id": "international-canoe-federation_digital_leadership_hire",
                        "confidence": 0.58,
                        "metadata": {
                            "template_id": "federation_governing_body",
                            "pattern_name": "Digital Leadership Hire",
                        },
                    },
                ],
            },
        },
    }

    batch = {"id": "batch-1", "metadata": {"queue_mode": "durable_worker"}}
    worker.process_batch(batch)

    completed_update = updates[-1][2]
    discovery_context = completed_update["metadata"]["discovery_context"]
    assert discovery_context["template_id"] == "federation_governing_body"
    assert discovery_context["lead_hypothesis_id"] == "international-canoe-federation_federation_procurement_programme"
    assert discovery_context["slowest_hypothesis_id"] == "international-canoe-federation_digital_leadership_hire"
    assert completed_update["metadata"]["monitoring_summary"]["pages_fetched"] == 2
    assert persisted_monitoring and persisted_monitoring[0][0] == "batch-1"


def test_process_batch_auto_queues_next_manifest_entity_after_completion(monkeypatch):
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker._now_iso = lambda: "2026-04-11T14:00:00+00:00"
    worker._batch_metadata = lambda batch: batch.get("metadata", {})
    worker.refresh_batch_heartbeat = lambda batch_id, metadata=None: {
        **(metadata or {}),
        "heartbeat_at": "2026-04-11T14:00:00+00:00",
    }
    worker._start_batch_heartbeat = lambda batch_id, metadata=None: (
        SimpleNamespace(set=lambda: None),
        SimpleNamespace(join=lambda timeout=1: None),
    )

    worker.get_batch_runs = lambda batch_id: [
        {
            "entity_id": "fc-porto-2027",
            "entity_name": "FC Porto",
            "status": "queued",
            "phase": "entity_registration",
            "id": "batch-1_fc-porto-2027",
            "metadata": {
                "entity_type": "SPORT_CLUB",
                "queue_mode": "durable_worker",
            },
        },
    ]
    worker._get_batch_record = lambda batch_id: {"id": batch_id, "status": "running", "metadata": {"queue_mode": "durable_worker"}}
    worker._get_batch_metadata = lambda batch_id: {"queue_mode": "durable_worker"}
    worker.sync_cached_entity = lambda batch_id, run, result, status: None
    worker.persist_monitoring_outputs = lambda batch_id, run, result: None
    worker._load_manifest_entities = lambda: [
        {
            "entity_id": "fc-porto-2027",
            "canonical_entity_id": "fc-porto-2027",
            "entity_name": "FC Porto",
            "entity_type": "SPORT_CLUB",
            "properties": {
                "name": "FC Porto",
                "type": "SPORT_CLUB",
                "sport": "Football",
                "country": "Portugal",
                "website": "https://fcporto.pt",
                "league": "Primeira Liga",
                "priority_score": 80,
            },
        },
        {
            "entity_id": "fifa",
            "canonical_entity_id": "fifa",
            "entity_name": "FIFA",
            "entity_type": "SPORT_FEDERATION",
            "properties": {
                "name": "FIFA",
                "type": "SPORT_FEDERATION",
                "sport": "Football",
                "country": "Switzerland",
                "website": "https://fifa.com",
                "league": None,
                "priority_score": 90,
            },
        },
    ]
    worker._has_active_pipeline_run = lambda *_args, **_kwargs: False

    updates = []
    worker.update_run = lambda batch_id, entity_id, payload: updates.append((batch_id, entity_id, payload))

    inserted_batches = []
    inserted_runs = []

    class FakeQuery:
        def __init__(self, table_name):
            self.table_name = table_name
            self.payload = None
            self.action = None

        def insert(self, payload):
            self.action = "insert"
            self.payload = payload
            return self

        def update(self, payload):
            self.action = "update"
            self.payload = payload
            return self

        def select(self, *_args, **_kwargs):
            return self

        def eq(self, *_args, **_kwargs):
            return self

        def in_(self, *_args, **_kwargs):
            return self

        def order(self, *_args, **_kwargs):
            return self

        def limit(self, *_args, **_kwargs):
            return self

        def range(self, *_args, **_kwargs):
            return self

        def execute(self):
            if self.table_name == "entity_import_batches" and self.action == "insert":
                inserted_batches.append(self.payload)
            if self.table_name == "entity_pipeline_runs" and self.action == "insert":
                inserted_runs.append(self.payload)
            return SimpleNamespace(data=[])

    worker.supabase = SimpleNamespace(table=lambda name: FakeQuery(name), rpc=lambda *_args, **_kwargs: SimpleNamespace(execute=lambda: SimpleNamespace(data=[])))
    worker.call_pipeline = lambda run, batch_id: {
        "sales_readiness": "MONITOR",
        "rfp_count": 0,
        "completed_at": "2026-04-11T14:05:00+00:00",
        "phases": {
            "discovery": {"status": "completed"},
            "dashboard_scoring": {"status": "completed"},
        },
        "artifacts": {
            "dossier_id": "fc-porto-2027",
            "dossier": {
                "quality_state": "client_ready",
                "metadata": {},
            },
        },
        "publication_status": "published",
        "dual_write_ok": True,
    }
    monkeypatch.setattr(
        "entity_pipeline_worker.read_pipeline_control_state",
        lambda: {
            "is_paused": False,
            "pause_reason": None,
            "requested_state": "running",
            "observed_state": "running",
            "transition_state": "running",
            "desired_state": "running",
        },
    )

    batch = {"id": "batch-1", "metadata": {"queue_mode": "durable_worker"}}
    worker.process_batch(batch)

    assert inserted_batches, "expected the next manifest entity batch to be queued automatically"
    assert inserted_batches[-1]["metadata"]["source"] == "manifest_auto_advance"
    assert inserted_batches[-1]["metadata"]["auto_advance_from_batch_id"] == "batch-1"
    assert inserted_runs, "expected a follow-on run to be inserted for the next entity"
    assert inserted_runs[-1][0]["entity_id"] == "fifa"
    assert inserted_runs[-1][0]["metadata"]["source"] == "manifest_auto_advance"


def test_persist_monitoring_outputs_upserts_expanded_source_registry_entries():
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker._now_iso = lambda: "2026-03-04T10:00:00+00:00"

    recorded_operations = []

    class FakeExecute:
        def __init__(self, table_name, action, payload, conflict=None):
            self.table_name = table_name
            self.action = action
            self.payload = payload
            self.conflict = conflict

        def execute(self):
            recorded_operations.append(
                {
                    "table": self.table_name,
                    "action": self.action,
                    "payload": self.payload,
                    "conflict": self.conflict,
                }
            )
            return SimpleNamespace(data=[])

    class FakeTable:
        def __init__(self, table_name):
            self.table_name = table_name

        def upsert(self, payload, on_conflict=None):
            return FakeExecute(self.table_name, "upsert", payload, on_conflict)

        def insert(self, payload):
            return FakeExecute(self.table_name, "insert", payload)

    worker.supabase = SimpleNamespace(table=lambda name: FakeTable(name))
    worker._safe_execute = lambda operation, **_kwargs: (operation(), True)[1]

    run = {
        "entity_id": "international-canoe-federation",
        "id": "batch-1_international-canoe-federation",
    }
    result = {
        "artifacts": {
            "dossier": {
                "metadata": {
                    "canonical_sources": {
                        "official_site": "https://www.canoeicf.com",
                        "jobs_board": "https://jobs.example.com/icf",
                        "linkedin_company": "https://www.linkedin.com/company/international-canoe-federation",
                        "linkedin_posts": "https://www.linkedin.com/company/international-canoe-federation/posts",
                    }
                }
            },
            "monitoring_result": {
                "snapshots": [
                    {
                        "entity_id": "international-canoe-federation",
                        "page_class": "linkedin_posts",
                        "url": "https://www.linkedin.com/company/international-canoe-federation/posts",
                        "content_hash": "hash-social",
                        "fetched_at": "2026-03-04T09:58:00+00:00",
                        "changed": True,
                        "metadata": {"content_length": 120},
                    }
                ],
                "candidates": [
                    {
                        "entity_id": "international-canoe-federation",
                        "batch_id": "batch-1",
                        "run_id": "batch-1_international-canoe-federation",
                        "page_class": "jobs_board",
                        "url": "https://jobs.example.com/icf",
                        "content_hash": "hash-jobs",
                        "candidate_type": "hiring_signal",
                        "score": 0.77,
                        "evidence_excerpt": "Head of Procurement role opened",
                        "metadata": {"matched_keywords": ["head of procurement"]},
                    }
                ],
            },
        }
    }

    worker.persist_monitoring_outputs("batch-1", run, result)

    registry_op = next(op for op in recorded_operations if op["table"] == "entity_source_registry")
    snapshot_op = next(op for op in recorded_operations if op["table"] == "entity_source_snapshots")
    candidate_op = next(op for op in recorded_operations if op["table"] == "entity_monitoring_candidates")

    registry_classes = {row["page_class"] for row in registry_op["payload"]}
    assert registry_op["action"] == "upsert"
    assert registry_op["conflict"] == "entity_id,page_class,url"
    assert {"official_site", "jobs_board", "linkedin_company", "linkedin_posts"} <= registry_classes

    assert snapshot_op["action"] == "insert"
    assert snapshot_op["payload"][0]["page_class"] == "linkedin_posts"

    assert candidate_op["action"] == "insert"
    assert candidate_op["payload"][0]["page_class"] == "jobs_board"
    assert candidate_op["payload"][0]["candidate_type"] == "hiring_signal"


def test_process_batch_requeues_batch_when_run_is_retryable():
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker._now_iso = lambda: "2026-03-03T04:00:00+00:00"
    worker._batch_metadata = lambda batch: batch.get("metadata", {})
    worker.refresh_batch_heartbeat = lambda batch_id, metadata=None: {**(metadata or {}), "heartbeat_at": "2026-03-03T04:00:00+00:00"}
    worker._start_batch_heartbeat = lambda batch_id, metadata=None: (SimpleNamespace(set=lambda: None), SimpleNamespace(join=lambda timeout=1: None))
    worker.worker_id = "worker-1"
    worker.lease_seconds = 60
    worker.max_run_attempts = 2

    run = {
        "entity_id": "international-canoe-federation",
        "entity_name": "International Canoe Federation",
        "status": "queued",
        "phase": "entity_registration",
        "metadata": {"entity_type": "FEDERATION", "attempt_count": 0},
    }
    worker.sync_cached_entity = lambda *args, **kwargs: None
    worker.call_pipeline = lambda run, batch_id: (_ for _ in ()).throw(TimeoutError("temporary timeout"))
    worker._get_run_metadata = lambda batch_id, entity_id: {"attempt_count": 0}
    worker._get_batch_record = lambda batch_id: {"id": batch_id, "status": "running", "metadata": {}}

    run_updates = []
    worker.update_run = lambda batch_id, entity_id, payload: run_updates.append(payload)

    batch_updates = []

    class FakeRpcQuery:
        def execute(self):
            return SimpleNamespace(data=[])

    class FakeUpdateQuery:
        def __init__(self, payload):
            self.payload = payload
        def eq(self, *_args, **_kwargs):
            return self
        def execute(self):
            batch_updates.append(self.payload)
            return SimpleNamespace(data=[])

    class FakeTable:
        def update(self, payload):
            return FakeUpdateQuery(payload)

    class FakeSupabase:
        def table(self, _name):
            return FakeTable()
        def rpc(self, *_args, **_kwargs):
            return FakeRpcQuery()

    worker.supabase = FakeSupabase()
    states = [[run], [{"entity_id": "international-canoe-federation", "status": "retrying"}]]
    worker.get_batch_runs = lambda batch_id: states.pop(0)

    batch = {"id": "batch-1", "metadata": {"queue_mode": "durable_worker"}}
    worker.process_batch(batch)

    assert run_updates[-1]["status"] == "retrying"
    assert batch_updates[-1]["status"] == "queued"
    assert batch_updates[-1]["metadata"]["retry_state"] == "retrying"


def test_process_batch_marks_batch_completed_after_successful_retry():
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker._now_iso = lambda: "2026-03-03T04:10:00+00:00"
    worker._batch_metadata = lambda batch: batch.get("metadata", {})
    worker.refresh_batch_heartbeat = lambda batch_id, metadata=None: {**(metadata or {}), "heartbeat_at": "2026-03-03T04:10:00+00:00"}
    worker._start_batch_heartbeat = lambda batch_id, metadata=None: (SimpleNamespace(set=lambda: None), SimpleNamespace(join=lambda timeout=1: None))
    worker.worker_id = "worker-1"
    worker.lease_seconds = 60
    worker.max_run_attempts = 2

    run = {
        "entity_id": "fiba",
        "entity_name": "FIBA",
        "status": "retrying",
        "phase": "discovery",
        "metadata": {"entity_type": "FEDERATION", "attempt_count": 1, "retryable": True, "retry_state": "retrying"},
    }
    worker.sync_cached_entity = lambda *args, **kwargs: None
    worker._queue_manifest_auto_advance = lambda **kwargs: None
    worker.call_pipeline = lambda run, batch_id: {
        "sales_readiness": "MONITOR",
        "rfp_count": 0,
        "completed_at": "2026-03-03T04:09:00+00:00",
        "phases": {
            "discovery": {"status": "completed"},
            "dashboard_scoring": {"status": "completed"},
        },
        "artifacts": {"scores": {"sales_readiness": "MONITOR"}, "discovery_result": {"performance_summary": {}}, "dossier_id": "fiba"},
    }

    run_updates = []
    worker.update_run = lambda batch_id, entity_id, payload: run_updates.append(payload)
    worker._get_run_metadata = lambda batch_id, entity_id: {"attempt_count": 2, "retryable": True, "retry_state": "retrying", "last_error": "timed out"}

    batch_updates = []
    complete_calls = []

    class FakeRpcQuery:
        def __init__(self, name, params):
            self.name = name
            self.params = params
        def execute(self):
            if self.name == "complete_entity_import_batch":
                complete_calls.append(self.params)
            return SimpleNamespace(data=[])

    class FakeSupabase:
        def rpc(self, name, params):
            return FakeRpcQuery(name, params)
        def table(self, _name):
            class FakeTable:
                def select(self, _fields):
                    class FakeSelect:
                        def eq(self, *_args, **_kwargs):
                            return self
                        def limit(self, *_args, **_kwargs):
                            return self
                        def execute(self):
                            return SimpleNamespace(data=[{
                                "metadata": {
                                    "queue_mode": "durable_worker",
                                    "worker_id": "worker-1",
                                    "attempt_count": 1,
                                    "retry_state": "running",
                                    "lease_expires_at": "2026-03-03T04:11:00+00:00",
                                }
                            }])
                    return FakeSelect()
                def update(self, payload):
                    batch_updates.append(payload)
                    return self
                def eq(self, *_args, **_kwargs):
                    return self
                def execute(self):
                    return SimpleNamespace(data=[])
            return FakeTable()

    states = [[run], [{"entity_id": "fiba", "status": "completed"}]]
    worker.get_batch_runs = lambda batch_id: states.pop(0)
    worker.supabase = FakeSupabase()

    batch = {"id": "batch-1", "metadata": {"queue_mode": "durable_worker"}}
    worker.process_batch(batch)

    assert run_updates[-1]["status"] == "completed"
    assert run_updates[-1]["metadata"]["retry_state"] == "completed"
    assert run_updates[-1]["metadata"]["last_error"] is None
    assert complete_calls[-1]["batch_id"] == "batch-1"
    assert batch_updates[-1]["status"] == "completed"
    assert batch_updates[-1]["metadata"]["retry_state"] == "completed"
    assert batch_updates[-1]["metadata"]["lease_expires_at"] is None


def test_process_batch_marks_exhausted_timeout_run_failed_and_continues_pipeline(monkeypatch, tmp_path):
    control_path = tmp_path / "pipeline-control-state.json"
    monkeypatch.setattr("entity_pipeline_worker.PIPELINE_CONTROL_STATE_PATH", control_path)
    monkeypatch.setattr("entity_pipeline_worker.should_use_local_pg", lambda: False)
    monkeypatch.setattr(
        "entity_pipeline_worker.read_pipeline_control_state",
        lambda: {"requested_state": "running", "observed_state": "running", "is_paused": False},
    )
    control_writes = []
    monkeypatch.setattr(
        "entity_pipeline_worker.write_pipeline_control_state",
        lambda payload: control_writes.append(payload) or payload,
    )

    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker._now_iso = lambda: "2026-03-04T12:10:00+00:00"
    worker._batch_metadata = lambda batch: batch.get("metadata", {})
    worker.refresh_batch_heartbeat = lambda batch_id, metadata=None: {
        **(metadata or {}),
        "heartbeat_at": "2026-03-04T12:10:00+00:00",
    }
    worker._start_batch_heartbeat = lambda batch_id, metadata=None: (
        SimpleNamespace(set=lambda: None),
        SimpleNamespace(join=lambda timeout=1: None),
    )
    worker.worker_id = "worker-1"
    worker.lease_seconds = 60
    worker.max_run_attempts = 2

    run = {
        "entity_id": "icf",
        "entity_name": "International Canoe Federation",
        "status": "retrying",
        "phase": "entity_registration",
        "metadata": {
            "entity_type": "FEDERATION",
            "attempt_count": 2,
            "retryable": True,
            "retry_state": "retrying",
            "last_error": "timed out",
            "last_error_type": "timeout",
        },
    }

    run_updates = []
    worker.update_run = lambda batch_id, entity_id, payload: run_updates.append(payload)
    sync_calls = []
    worker.sync_cached_entity = lambda *args, **kwargs: sync_calls.append((args, kwargs))
    worker._get_run_metadata = lambda batch_id, entity_id: run["metadata"]
    worker._get_batch_record = lambda batch_id: {"id": batch_id, "status": "running", "metadata": {}}
    worker._get_batch_metadata = lambda batch_id: {"queue_mode": "durable_worker"}
    worker._has_active_pipeline_run = lambda *_args, **_kwargs: False
    worker._load_manifest_entities = lambda: [
        {
            "entity_id": "icf",
            "canonical_entity_id": "icf",
            "entity_name": "International Canoe Federation",
            "entity_type": "FEDERATION",
            "properties": {},
        },
        {
            "entity_id": "fifa",
            "canonical_entity_id": "fifa",
            "entity_name": "FIFA",
            "entity_type": "FEDERATION",
            "properties": {},
        },
    ]

    batch_updates = []
    inserted_batches = []
    inserted_runs = []

    class FakeRpcQuery:
        def __init__(self, name, params):
            self.name = name
            self.params = params

        def execute(self):
            return SimpleNamespace(data=[])

    class FakeTable:
        def insert(self, payload):
            if self._table_name == "entity_import_batches":
                inserted_batches.append(payload)
            elif self._table_name == "entity_pipeline_runs":
                inserted_runs.append(payload)
            return self

        def update(self, payload):
            batch_updates.append(payload)
            return self

        def eq(self, *_args, **_kwargs):
            return self

        def execute(self):
            return SimpleNamespace(data=[])

        def __init__(self, table_name):
            self._table_name = table_name

    class FakeSupabase:
        def rpc(self, name, params):
            return FakeRpcQuery(name, params)

        def table(self, _name):
            return FakeTable(_name)

    worker.supabase = FakeSupabase()
    failed_run_snapshot = {
        "entity_id": "icf",
        "status": "failed",
        "metadata": {
            **run["metadata"],
            "retry_state": "failed",
            "continue_pipeline_on_failure": True,
            "failure_class": "entity_pipeline_timeout",
            "stop_reason": "entity_pipeline_timeout",
        },
    }
    states = [[run], [failed_run_snapshot]]
    worker.get_batch_runs = lambda batch_id: states.pop(0)

    batch = {"id": "batch-1", "metadata": {"queue_mode": "durable_worker"}}
    worker.process_batch(batch)

    assert run_updates[-1]["status"] == "failed"
    assert run_updates[-1]["metadata"]["retry_state"] == "failed"
    assert run_updates[-1]["metadata"]["continue_pipeline_on_failure"] is True
    assert run_updates[-1]["metadata"]["failure_class"] == "entity_pipeline_timeout"
    assert run_updates[-1]["metadata"]["stop_reason"] == "entity_pipeline_timeout"
    assert run_updates[-1]["error_message"] == "timed out"
    assert sync_calls, "expected failed cached-entity sync for exhausted retry"
    assert any(update.get("status") == "failed" for update in batch_updates)
    assert any(update.get("metadata", {}).get("retry_state") == "failed" for update in batch_updates)
    assert any(update.get("metadata", {}).get("auto_advance_next_entity_id") == "fifa" for update in batch_updates)
    assert not any(state.get("is_paused") for state in control_writes)
    assert inserted_batches, "expected manifest auto-advance batch to be queued"
    assert inserted_runs, "expected manifest auto-advance run to be queued"
    assert inserted_runs[-1][0]["entity_id"] == "fifa"


def test_process_batch_queues_question_first_continuation_before_manifest_advance(monkeypatch, tmp_path):
    control_path = tmp_path / "pipeline-control-state.json"
    monkeypatch.setattr("entity_pipeline_worker.PIPELINE_CONTROL_STATE_PATH", control_path)
    monkeypatch.setattr("entity_pipeline_worker.should_use_local_pg", lambda: False)
    monkeypatch.setattr(
        "entity_pipeline_worker.read_pipeline_control_state",
        lambda: {"requested_state": "running", "observed_state": "running", "is_paused": False},
    )

    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker._now_iso = lambda: "2026-04-30T04:10:00+01:00"
    worker._batch_metadata = lambda batch: batch.get("metadata", {})
    worker.refresh_batch_heartbeat = lambda batch_id, metadata=None: {
        **(metadata or {}),
        "heartbeat_at": "2026-04-30T04:10:00+01:00",
    }
    worker._start_batch_heartbeat = lambda batch_id, metadata=None: (
        SimpleNamespace(set=lambda: None),
        SimpleNamespace(join=lambda timeout=1: None),
    )
    worker.worker_id = "worker-1"
    worker.lease_seconds = 60
    worker.max_run_attempts = 2
    worker.max_question_first_continuation_attempts = 2
    worker._build_follow_on_repair_batch_id = lambda: "batch-continuation"
    worker._has_active_pipeline_run = lambda *_args, **_kwargs: False
    worker._get_batch_record = lambda batch_id: {"id": batch_id, "status": "running", "metadata": {"queue_mode": "durable_worker"}}
    worker._get_batch_metadata = lambda batch_id: {"queue_mode": "durable_worker"}
    worker._load_persisted_question_first_checkpoint = lambda *, entity_id, canonical_entity_id: {
        "schema_version": "question_first_checkpoint_v1",
        "questions_answered": 7,
        "questions_total": 15,
        "last_completed_question_id": "q9_news_signal",
        "current_question_id": "q9_news_signal",
        "next_question_id": "q10_hiring_signal",
        "answer_records": [{"question_id": f"q{i}"} for i in range(1, 8)],
    }

    run = {
        "id": "batch-1_icf",
        "batch_id": "batch-1",
        "entity_id": "icf",
        "canonical_entity_id": "canonical-icf",
        "entity_name": "International Canoe Federation",
        "status": "retrying",
        "phase": "dossier_generation",
        "metadata": {
            "entity_type": "FEDERATION",
            "attempt_count": 2,
            "retryable": True,
            "retry_state": "retrying",
            "last_error": "timed out",
            "last_error_type": "timeout",
            "question_first_checkpoint": {
                "questions_answered": 6,
                "questions_total": 15,
                "last_completed_question_id": "q8_explicit_rfp",
                "next_question_id": "q9_news_signal",
            },
        },
    }

    run_updates = []
    batch_updates = []
    inserted_batches = []
    inserted_runs = []
    worker.update_run = lambda batch_id, entity_id, payload: run_updates.append(payload)
    worker.sync_cached_entity = lambda *args, **kwargs: None
    worker._get_run_metadata = lambda batch_id, entity_id: run["metadata"]

    class FakeTable:
        def __init__(self, table_name):
            self.table_name = table_name
            self.payload = None
            self.action = None

        def insert(self, payload):
            self.action = "insert"
            self.payload = payload
            return self

        def update(self, payload):
            self.action = "update"
            self.payload = payload
            return self

        def eq(self, *_args, **_kwargs):
            return self

        def execute(self):
            if self.table_name == "entity_import_batches" and self.action == "insert":
                inserted_batches.append(self.payload)
            if self.table_name == "entity_pipeline_runs" and self.action == "insert":
                inserted_runs.append(self.payload)
            if self.table_name == "entity_import_batches" and self.action == "update":
                batch_updates.append(self.payload)
            return SimpleNamespace(data=[])

    worker.supabase = SimpleNamespace(
        table=lambda name: FakeTable(name),
        rpc=lambda *_args, **_kwargs: SimpleNamespace(execute=lambda: SimpleNamespace(data=[])),
    )

    failed_run_snapshot = {
        **run,
        "status": "failed",
        "metadata": {
            **run["metadata"],
            "retry_state": "failed",
            "continue_pipeline_on_failure": True,
            "failure_class": "entity_pipeline_timeout",
            "stop_reason": "entity_pipeline_timeout",
        },
    }
    states = [[run], [failed_run_snapshot]]
    worker.get_batch_runs = lambda batch_id: states.pop(0)

    worker.process_batch({"id": "batch-1", "metadata": {"queue_mode": "durable_worker"}})

    assert run_updates[-1]["status"] == "failed"
    assert inserted_batches, "expected same-entity continuation batch to be queued"
    assert inserted_batches[-1]["metadata"]["source"] == "question_first_timeout_continuation"
    assert inserted_batches[-1]["metadata"]["entity_id"] == "icf"
    assert inserted_batches[-1]["metadata"]["question_first_resume_from_question_id"] == "q10_hiring_signal"
    assert inserted_runs, "expected same-entity continuation run to be queued"
    continuation_run = inserted_runs[-1][0]
    assert continuation_run["entity_id"] == "icf"
    assert continuation_run["metadata"]["source"] == "question_first_timeout_continuation"
    assert continuation_run["metadata"]["question_first_checkpoint"]["questions_answered"] == 7
    assert continuation_run["metadata"]["question_first_resume_from_question_id"] == "q10_hiring_signal"
    assert any(
        update.get("metadata", {}).get("question_first_continuation_next_entity_id") == "icf"
        for update in batch_updates
    )
    assert not any(
        update.get("metadata", {}).get("auto_advance_next_entity_id") == "fifa"
        for update in batch_updates
    )


@pytest.mark.parametrize(
    ("status_code", "error_type"),
    [
        (403, "http_403"),
        (422, "http_422"),
    ],
)
def test_process_batch_nonblocking_http_client_failure_keeps_pipeline_running_and_auto_advances(monkeypatch, tmp_path, status_code, error_type):
    control_path = tmp_path / "pipeline-control-state.json"
    monkeypatch.setattr("entity_pipeline_worker.PIPELINE_CONTROL_STATE_PATH", control_path)
    monkeypatch.setattr("entity_pipeline_worker.should_use_local_pg", lambda: False)

    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker._now_iso = lambda: "2026-04-24T03:00:00+00:00"
    worker._batch_metadata = lambda batch: batch.get("metadata", {})
    worker._get_batch_metadata = lambda batch_id: {"queue_mode": "durable_worker"}
    worker.refresh_batch_heartbeat = lambda batch_id, metadata=None: {
        **(metadata or {}),
        "heartbeat_at": "2026-04-24T03:00:00+00:00",
    }
    worker._start_batch_heartbeat = lambda batch_id, metadata=None: (
        SimpleNamespace(set=lambda: None),
        SimpleNamespace(join=lambda timeout=1: None),
    )
    worker.worker_id = "worker-404"
    worker.lease_seconds = 60
    worker.max_run_attempts = 1
    worker.sync_cached_entity = lambda *args, **kwargs: None
    worker._has_active_pipeline_run = lambda *_args, **_kwargs: False
    worker._backend_preflight = lambda: (True, "")
    worker._load_manifest_entities = lambda: [
        {
            "entity_id": "fc-porto",
            "canonical_entity_id": "fc-porto",
            "entity_name": "FC Porto",
            "entity_type": "SPORT_CLUB",
            "properties": {"name": "FC Porto"},
        },
        {
            "entity_id": "fifa",
            "canonical_entity_id": "fifa",
            "entity_name": "FIFA",
            "entity_type": "SPORT_FEDERATION",
            "properties": {"name": "FIFA"},
        },
    ]

    error = worker_module.HTTPError(
        url="http://127.0.0.1:8000/api/pipeline/run-entity",
        code=status_code,
        msg="Not Found",
        hdrs=None,
        fp=None,
    )
    worker.call_pipeline = lambda run, batch_id: (_ for _ in ()).throw(error)
    worker._get_run_metadata = lambda batch_id, entity_id: {
        "attempt_count": 0,
        "rerun_mode": "question",
        "question_id": "q11_decision_owner",
        "canonical_entity_id": "fc-porto",
    }
    worker._get_batch_record = lambda batch_id: {"id": batch_id, "status": "running", "metadata": {"queue_mode": "durable_worker"}}

    run_updates = []
    worker.update_run = lambda batch_id, entity_id, payload: run_updates.append(payload)

    inserted_batches = []
    inserted_runs = []
    batch_updates = []
    rpc_calls = []

    class FakeRpcQuery:
        def __init__(self, name, params):
            self.name = name
            self.params = params

        def execute(self):
            rpc_calls.append((self.name, self.params))
            return SimpleNamespace(data=[])

    class FakeQuery:
        def __init__(self, table_name):
            self.table_name = table_name
            self.payload = None
            self.action = None

        def insert(self, payload):
            self.action = "insert"
            self.payload = payload
            return self

        def update(self, payload):
            self.action = "update"
            self.payload = payload
            return self

        def select(self, *_args, **_kwargs):
            return self

        def eq(self, *_args, **_kwargs):
            return self

        def in_(self, *_args, **_kwargs):
            return self

        def limit(self, *_args, **_kwargs):
            return self

        def execute(self):
            if self.table_name == "entity_import_batches" and self.action == "insert":
                inserted_batches.append(self.payload)
            elif self.table_name == "entity_pipeline_runs" and self.action == "insert":
                inserted_runs.append(self.payload)
            elif self.table_name == "entity_import_batches" and self.action == "update":
                batch_updates.append(self.payload)
            return SimpleNamespace(data=[])

    worker.supabase = SimpleNamespace(
        table=lambda name: FakeQuery(name),
        rpc=lambda name, params: FakeRpcQuery(name, params),
    )

    run = {
        "batch_id": "batch-404",
        "entity_id": "fc-porto",
        "canonical_entity_id": "fc-porto",
        "entity_name": "FC Porto",
        "status": "running",
        "phase": "entity_registration",
        "metadata": {
            "rerun_mode": "question",
            "question_id": "q11_decision_owner",
            "canonical_entity_id": "fc-porto",
        },
    }
    states = [[run], [{"entity_id": "fc-porto", "status": "failed", "metadata": {"continue_pipeline_on_failure": True}}]]
    worker.get_batch_runs = lambda batch_id: states.pop(0)

    batch = {"id": "batch-404", "metadata": {"queue_mode": "durable_worker"}}
    worker.process_batch(batch)

    control_state = read_pipeline_control_state()

    assert run_updates[-1]["status"] == "failed"
    assert run_updates[-1]["metadata"]["retry_state"] == "failed"
    assert run_updates[-1]["metadata"]["continue_pipeline_on_failure"] is True
    assert run_updates[-1]["metadata"]["last_error_type"] == error_type
    assert control_state["is_paused"] is False
    assert control_state["stop_reason"] is None
    assert inserted_batches, "expected next manifest entity to be queued after non-blocking 404 failure"
    assert inserted_batches[-1]["metadata"]["source"] == "manifest_auto_advance"
    assert inserted_batches[-1]["metadata"]["auto_advance_from_entity_id"] == "fc-porto"
    assert inserted_runs[-1][0]["entity_id"] == "fifa"
    assert any(call[0] == "fail_entity_pipeline_run" for call in rpc_calls)
    assert any(update.get("metadata", {}).get("auto_advance_next_entity_id") == "fifa" for update in batch_updates)


def test_process_batch_provider_infrastructure_failure_pauses_without_auto_advance(monkeypatch, tmp_path):
    control_path = tmp_path / "pipeline-control-state.json"
    monkeypatch.setattr("entity_pipeline_worker.PIPELINE_CONTROL_STATE_PATH", control_path)
    monkeypatch.setattr("entity_pipeline_worker.should_use_local_pg", lambda: False)
    control_writes = []
    monkeypatch.setattr(
        "entity_pipeline_worker.write_pipeline_control_state",
        lambda payload: control_writes.append(payload) or payload,
    )

    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker._now_iso = lambda: "2026-04-30T03:00:00+00:00"
    worker._batch_metadata = lambda batch: batch.get("metadata", {})
    worker._get_batch_metadata = lambda batch_id: {"queue_mode": "durable_worker"}
    worker.refresh_batch_heartbeat = lambda batch_id, metadata=None: {
        **(metadata or {}),
        "heartbeat_at": "2026-04-30T03:00:00+00:00",
    }
    worker._start_batch_heartbeat = lambda batch_id, metadata=None: (
        SimpleNamespace(set=lambda: None),
        SimpleNamespace(join=lambda timeout=1: None),
    )
    worker.worker_id = "worker-provider-failure"
    worker.lease_seconds = 60
    worker.max_run_attempts = 1
    worker.sync_cached_entity = lambda *args, **kwargs: None
    worker.persist_monitoring_outputs = lambda *args, **kwargs: None
    worker._derive_follow_on_repair_metadata = lambda **_kwargs: {}
    worker._get_batch_record = lambda batch_id: {"id": batch_id, "status": "running", "metadata": {"queue_mode": "durable_worker"}}
    worker._get_run_metadata = lambda batch_id, entity_id: {
        "attempt_count": 0,
        "canonical_entity_id": "boston-celtics",
        "question_first_checkpoint": {
            "answer_records": [
                {
                    "question_id": "q11_decision_owner",
                    "error_type": "provider_infrastructure_failure",
                    "failure_name": "OpenCodeProviderInsufficientBalanceError",
                    "answer": {"summary": "Question execution failed before a safe answer could be produced."},
                }
            ]
        },
    }
    worker.call_pipeline = lambda run, batch_id: {
        "status": "failed",
        "publication_status": "failed",
        "dual_write_ok": False,
        "phases": {"dossier_generation": {"status": "failed"}},
        "phase_details_by_phase": {
            "dossier_generation": {
                "status": "provider_infrastructure_failure",
                "failure_class": "provider_infrastructure_failure",
            }
        },
        "failure_taxonomy": {"failure_class": "provider_infrastructure_failure"},
        "persistence_status": {"reconcile_required": False},
    }

    run_updates = []
    batch_updates = []
    inserted_batches = []
    inserted_runs = []
    worker.update_run = lambda batch_id, entity_id, payload: run_updates.append(payload)

    class FakeQuery:
        def __init__(self, table_name):
            self.table_name = table_name
            self.action = None
            self.payload = None

        def insert(self, payload):
            self.action = "insert"
            self.payload = payload
            return self

        def update(self, payload):
            self.action = "update"
            self.payload = payload
            return self

        def select(self, *_args, **_kwargs):
            return self

        def eq(self, *_args, **_kwargs):
            return self

        def in_(self, *_args, **_kwargs):
            return self

        def limit(self, *_args, **_kwargs):
            return self

        def execute(self):
            if self.table_name == "entity_import_batches" and self.action == "update":
                batch_updates.append(self.payload)
            if self.table_name == "entity_import_batches" and self.action == "insert":
                inserted_batches.append(self.payload)
            if self.table_name == "entity_pipeline_runs" and self.action == "insert":
                inserted_runs.append(self.payload)
            return SimpleNamespace(data=[])

    worker.supabase = SimpleNamespace(
        table=lambda name: FakeQuery(name),
        rpc=lambda *_args, **_kwargs: SimpleNamespace(execute=lambda: SimpleNamespace(data=[])),
    )

    run = {
        "batch_id": "batch-provider-failure",
        "entity_id": "boston-celtics",
        "canonical_entity_id": "boston-celtics",
        "entity_name": "Boston Celtics",
        "status": "running",
        "phase": "dossier_generation",
        "metadata": {"canonical_entity_id": "boston-celtics"},
    }
    failed_run_snapshot = {
        **run,
        "status": "failed",
        "metadata": {
            "failure_class": "provider_infrastructure_failure",
            "retry_state": "failed",
        },
    }
    states = [[run], [failed_run_snapshot]]
    worker.get_batch_runs = lambda batch_id: states.pop(0)

    worker.process_batch({"id": "batch-provider-failure", "metadata": {"queue_mode": "durable_worker"}})

    assert run_updates[-1]["status"] == "failed"
    assert run_updates[-1]["metadata"]["failure_class"] == "provider_infrastructure_failure"
    assert run_updates[-1]["metadata"]["retry_state"] == "failed"
    assert run_updates[-1]["metadata"].get("continue_pipeline_on_failure") is not True
    assert control_writes[-1]["is_paused"] is True
    assert control_writes[-1]["stop_reason"] == "provider_infrastructure_failure"
    assert not inserted_batches
    assert not inserted_runs
    assert not any(
        update.get("metadata", {}).get("auto_advance_next_entity_id")
        for update in batch_updates
    )


def test_process_batch_ignores_historical_provider_failure_metadata_when_current_run_succeeds(monkeypatch, tmp_path):
    control_path = tmp_path / "pipeline-control-state.json"
    monkeypatch.setattr("entity_pipeline_worker.PIPELINE_CONTROL_STATE_PATH", control_path)
    monkeypatch.setattr("entity_pipeline_worker.should_use_local_pg", lambda: False)
    control_writes = []
    monkeypatch.setattr(
        "entity_pipeline_worker.write_pipeline_control_state",
        lambda payload: control_writes.append(payload) or payload,
    )

    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker._now_iso = lambda: "2026-05-03T09:00:00+00:00"
    worker._batch_metadata = lambda batch: batch.get("metadata", {})
    worker._get_batch_metadata = lambda batch_id: {"queue_mode": "durable_worker"}
    worker.refresh_batch_heartbeat = lambda batch_id, metadata=None: {
        **(metadata or {}),
        "heartbeat_at": "2026-05-03T09:00:00+00:00",
    }
    worker._start_batch_heartbeat = lambda batch_id, metadata=None: (
        SimpleNamespace(set=lambda: None),
        SimpleNamespace(join=lambda timeout=1: None),
    )
    worker.worker_id = "worker-provider-history"
    worker.lease_seconds = 60
    worker.max_run_attempts = 1
    worker.sync_cached_entity = lambda *args, **kwargs: None
    worker.persist_monitoring_outputs = lambda *args, **kwargs: None
    worker._derive_follow_on_repair_metadata = lambda **_kwargs: {}
    worker._get_batch_record = lambda batch_id: {"id": batch_id, "status": "running", "metadata": {"queue_mode": "durable_worker"}}
    worker._queue_manifest_auto_advance = lambda **_kwargs: None
    worker._get_run_metadata = lambda batch_id, entity_id: {
        "attempt_count": 0,
        "canonical_entity_id": "david-gale",
        "question_first_checkpoint": {
            "answer_records": [
                {
                    "question_id": "q11_decision_owner",
                    "error_type": "provider_infrastructure_failure",
                    "failure_name": "OpenCodeProviderInsufficientBalanceError",
                    "answer": {"summary": "Question execution failed before a safe answer could be produced."},
                }
            ]
        },
    }
    worker.call_pipeline = lambda run, batch_id: {
        "status": "completed",
        "publication_status": "published_partial",
        "dual_write_ok": True,
        "phases": {"dashboard_scoring": {"status": "completed"}},
        "phase_details_by_phase": {
            "dashboard_scoring": {
                "status": "completed",
            }
        },
        "failure_taxonomy": {"failure_class": None},
        "persistence_status": {"reconcile_required": False},
        "artifacts": {"dossier_id": "dossier-david-gale"},
        "sales_readiness": "partial",
        "rfp_count": 0,
    }

    run_updates = []
    worker.update_run = lambda batch_id, entity_id, payload: run_updates.append(payload)

    class FakeQuery:
        def __init__(self, table_name):
            self.table_name = table_name
            self.action = None
            self.payload = None

        def insert(self, payload):
            self.action = "insert"
            self.payload = payload
            return self

        def update(self, payload):
            self.action = "update"
            self.payload = payload
            return self

        def select(self, *_args, **_kwargs):
            return self

        def eq(self, *_args, **_kwargs):
            return self

        def in_(self, *_args, **_kwargs):
            return self

        def limit(self, *_args, **_kwargs):
            return self

        def execute(self):
            return SimpleNamespace(data=[])

    worker.supabase = SimpleNamespace(
        table=lambda name: FakeQuery(name),
        rpc=lambda *_args, **_kwargs: SimpleNamespace(execute=lambda: SimpleNamespace(data=[])),
    )

    run = {
        "batch_id": "batch-provider-history",
        "entity_id": "david-gale",
        "canonical_entity_id": "david-gale",
        "entity_name": "David Gale",
        "status": "running",
        "phase": "dashboard_scoring",
        "metadata": {"canonical_entity_id": "david-gale"},
    }
    completed_run_snapshot = {
        **run,
        "status": "completed",
        "metadata": {},
    }
    states = [[run], [completed_run_snapshot]]
    worker.get_batch_runs = lambda batch_id: states.pop(0)

    worker.process_batch({"id": "batch-provider-history", "metadata": {"queue_mode": "durable_worker"}})

    assert run_updates[-1]["status"] == "completed"
    assert run_updates[-1]["error_message"] is None
    assert run_updates[-1]["metadata"].get("failure_class") != "provider_infrastructure_failure"
    assert not any(write.get("stop_reason") == "provider_infrastructure_failure" for write in control_writes)
    assert not any(write.get("is_paused") is True for write in control_writes)


def test_process_batch_pipeline_route_404_pauses_without_failing_entity(monkeypatch, tmp_path):
    control_path = tmp_path / "pipeline-control-state.json"
    monkeypatch.setattr("entity_pipeline_worker.PIPELINE_CONTROL_STATE_PATH", control_path)
    monkeypatch.setattr("entity_pipeline_worker.should_use_local_pg", lambda: False)
    control_writes = []
    monkeypatch.setattr(
        "entity_pipeline_worker.write_pipeline_control_state",
        lambda payload: control_writes.append(payload) or payload,
    )

    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker._now_iso = lambda: "2026-04-24T03:00:00+00:00"
    worker._batch_metadata = lambda batch: batch.get("metadata", {})
    worker._get_batch_metadata = lambda batch_id: {"queue_mode": "durable_worker"}
    worker.refresh_batch_heartbeat = lambda batch_id, metadata=None: {
        **(metadata or {}),
        "heartbeat_at": "2026-04-24T03:00:00+00:00",
    }
    worker._start_batch_heartbeat = lambda batch_id, metadata=None: (
        SimpleNamespace(set=lambda: None),
        SimpleNamespace(join=lambda timeout=1: None),
    )
    worker.worker_id = "worker-backend-missing"
    worker.lease_seconds = 60
    worker.max_run_attempts = 1
    worker.sync_cached_entity = lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("should not sync entity failure"))
    worker._get_run_metadata = lambda batch_id, entity_id: {
        "attempt_count": 0,
        "canonical_entity_id": "fc-porto",
    }
    worker._get_batch_record = lambda batch_id: {"id": batch_id, "status": "running", "metadata": {"queue_mode": "durable_worker"}}
    worker.call_pipeline = lambda run, batch_id: (_ for _ in ()).throw(
        worker_module.HTTPError(
            url="http://127.0.0.1:8000/api/pipeline/run-entity",
            code=404,
            msg="Not Found",
            hdrs=None,
            fp=None,
        )
    )

    run_updates = []
    batch_updates = []
    rpc_calls = []

    class FakeRpcQuery:
        def __init__(self, name, params):
            self.name = name
            self.params = params

        def execute(self):
            rpc_calls.append((self.name, self.params))
            return SimpleNamespace(data=[])

    class FakeQuery:
        def __init__(self, table_name):
            self.table_name = table_name
            self.action = None
            self.payload = None

        def update(self, payload):
            self.action = "update"
            self.payload = payload
            return self

        def select(self, *_args, **_kwargs):
            return self

        def eq(self, *_args, **_kwargs):
            return self

        def limit(self, *_args, **_kwargs):
            return self

        def execute(self):
            if self.table_name == "entity_import_batches" and self.action == "update":
                batch_updates.append(self.payload)
            return SimpleNamespace(data=[])

    worker.supabase = SimpleNamespace(
        table=lambda name: FakeQuery(name),
        rpc=lambda name, params: FakeRpcQuery(name, params),
    )
    worker.update_run = lambda batch_id, entity_id, payload: run_updates.append(payload)
    worker.get_batch_runs = lambda batch_id: [
        {
            "batch_id": "batch-404",
            "entity_id": "fc-porto",
            "canonical_entity_id": "fc-porto",
            "entity_name": "FC Porto",
            "status": "running",
            "phase": "entity_registration",
            "metadata": {"canonical_entity_id": "fc-porto"},
        }
    ]

    worker.process_batch({"id": "batch-404", "metadata": {"queue_mode": "durable_worker"}})

    control_state = control_writes[-1]
    assert control_state["is_paused"] is True
    assert control_state["stop_reason"] == "backend_route_missing"
    assert run_updates[-1]["status"] == "queued"
    assert run_updates[-1]["error_message"] == "backend_route_missing"
    assert run_updates[-1]["metadata"]["infrastructure_failure"] is True
    assert run_updates[-1]["metadata"]["failure_class"] == "backend_route_missing"
    assert batch_updates[-1]["status"] == "queued"
    assert batch_updates[-1]["metadata"]["blocked_by_infrastructure"] is True
    assert not any(call[0] == "fail_entity_pipeline_run" for call in rpc_calls)


def test_process_batch_marks_run_completed_when_supabase_publishes_but_falkordb_requires_reconciliation():
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker._now_iso = lambda: "2026-03-04T12:10:00+00:00"
    worker._batch_metadata = lambda batch: batch.get("metadata", {})
    worker.refresh_batch_heartbeat = lambda batch_id, metadata=None: {
        **(metadata or {}),
        "heartbeat_at": "2026-03-04T12:10:00+00:00",
    }
    worker._start_batch_heartbeat = lambda batch_id, metadata=None: (
        SimpleNamespace(set=lambda: None),
        SimpleNamespace(join=lambda timeout=1: None),
    )
    worker.worker_id = "worker-1"
    worker.lease_seconds = 60
    worker.max_run_attempts = 2
    worker._get_run_metadata = lambda batch_id, entity_id: {
        "rerun_mode": "question",
        "question_id": "q11_decision_owner",
    }
    worker._get_batch_record = lambda batch_id: {"id": batch_id, "status": "running", "metadata": {}}

    run = {
        "entity_id": "fc-porto-2027",
        "entity_name": "FC Porto",
        "status": "queued",
        "phase": "entity_registration",
        "metadata": {
            "entity_type": "CLUB",
            "attempt_count": 1,
            "rerun_mode": "question",
            "question_id": "q11_decision_owner",
        },
    }

    updates = []
    worker.update_run = lambda batch_id, entity_id, payload: updates.append(payload)
    persisted_monitoring = []
    worker.persist_monitoring_outputs = lambda *args, **kwargs: persisted_monitoring.append((args, kwargs))
    sync_calls = []
    worker.sync_cached_entity = lambda *args, **kwargs: sync_calls.append((args, kwargs))
    worker._queue_manifest_auto_advance = lambda **kwargs: None
    worker.call_pipeline = lambda run, batch_id: {
        "phases": {
            "dossier_generation": {"status": "completed"},
            "discovery": {"status": "completed"},
            "ralph_validation": {"status": "completed"},
            "temporal_persistence": {"status": "completed"},
            "dashboard_scoring": {"status": "completed"},
        },
        "artifacts": {"dossier_id": "fc-porto-2027", "scores": {"sales_readiness": "MONITOR"}},
        "sales_readiness": "MONITOR",
        "rfp_count": 0,
        "dual_write_ok": False,
        "publication_status": "published_degraded",
        "publication_mode": "repair_degraded",
        "persistence_status": {
            "dual_write_ok": False,
            "supabase": {"ok": True, "attempts": 1},
            "falkordb": {"ok": False, "attempts": 3, "error_class": "connection_error"},
            "reconcile_required": True,
            "reconciliation_payload": {"idempotency_key": "reconcile-me"},
        },
        "step_artifact_counts": {"total": 2, "persisted": 2, "failed": 2},
        "step_failure_taxonomy": {
            "supabase_write_failure": 0,
            "falkordb_write_failure": 2,
            "dual_write_incomplete": 1,
        },
        "completed_at": "2026-03-04T12:10:00+00:00",
    }

    complete_calls = []

    class FakeRpcQuery:
        def __init__(self, name, params):
            self.name = name
            self.params = params

        def execute(self):
            if self.name == "complete_entity_import_batch":
                complete_calls.append(self.params)
            return SimpleNamespace(data=[])

    batch_updates = []

    class FakeTable:
        def __init__(self, name):
            self.name = name

        def update(self, payload):
            batch_updates.append(payload)
            return self

        def eq(self, *_args, **_kwargs):
            return self

        def execute(self):
            return SimpleNamespace(data=[])

    class FakeSupabase:
        def rpc(self, name, params):
            return FakeRpcQuery(name, params)

        def table(self, name):
            return FakeTable(name)

    worker.supabase = FakeSupabase()
    states = [[run], [{"entity_id": "fc-porto-2027", "status": "completed", "metadata": run["metadata"]}]]
    worker.get_batch_runs = lambda batch_id: states.pop(0)

    batch = {"id": "batch-1", "metadata": {"queue_mode": "durable_worker"}}
    worker.process_batch(batch)

    assert persisted_monitoring, "expected monitoring outputs to persist for degraded publication"
    assert sync_calls, "expected cached entity sync for degraded publication"
    assert updates[-1]["status"] == "completed"
    assert updates[-1]["error_message"] is None
    assert updates[-1]["metadata"]["publication_status"] == "published_degraded"
    assert updates[-1]["metadata"]["publication_mode"] == "repair_degraded"
    assert updates[-1]["metadata"]["reconcile_required"] is True
    assert updates[-1]["metadata"]["reconciliation_state"] == "pending"
    assert updates[-1]["metadata"]["reconciliation_payload"]["idempotency_key"] == "reconcile-me"
    assert complete_calls[-1]["batch_id"] == "batch-1"
    assert batch_updates[-1]["status"] == "completed"


def test_find_active_repair_run_ignores_terminal_batch_rows():
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)

    class FakeQuery:
        def __init__(self, table_name):
            self.table_name = table_name

        def select(self, *_args, **_kwargs):
            return self

        def eq(self, *_args, **_kwargs):
            return self

        def limit(self, *_args, **_kwargs):
            return self

        def execute(self):
            if self.table_name == "entity_pipeline_runs":
                return SimpleNamespace(data=[
                    {
                        "id": "import_done_fc-porto-2027",
                        "batch_id": "import_done",
                        "entity_id": "fc-porto-2027",
                        "status": "running",
                        "metadata": {
                            "rerun_mode": "question",
                            "question_id": "q11_decision_owner",
                            "cascade_dependents": True,
                        },
                    }
                ])
            return SimpleNamespace(data=[{"id": "import_done", "status": "completed"}])

    class FakeSupabase:
        def table(self, name):
            return FakeQuery(name)

    worker.supabase = FakeSupabase()

    assert worker.find_active_repair_run("fc-porto-2027", "q11_decision_owner", cascade_dependents=True) is None


def test_process_batch_aborts_claimed_terminal_batch_before_processing():
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker.worker_id = "worker-1"
    worker.lease_seconds = 60
    worker.max_run_attempts = 2
    worker._now_iso = lambda: "2026-03-04T12:10:00+00:00"
    worker._batch_metadata = lambda batch: batch.get("metadata", {})
    worker._get_batch_record = lambda batch_id: {
        "id": batch_id,
        "status": "completed",
        "completed_at": "2026-03-04T12:00:00+00:00",
        "metadata": {"retry_state": "completed"},
    }
    worker._start_batch_heartbeat = lambda batch_id, metadata=None: (
        SimpleNamespace(set=lambda: None),
        SimpleNamespace(join=lambda timeout=1: None),
    )
    worker.refresh_batch_heartbeat = lambda batch_id, metadata=None: metadata or {}
    worker.get_batch_runs = lambda batch_id: [{"entity_id": "fc-porto-2027", "status": "completed", "metadata": {}}]
    worker.call_pipeline = lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("call_pipeline should not run"))
    worker.persist_monitoring_outputs = lambda *args, **kwargs: None
    worker.sync_cached_entity = lambda *args, **kwargs: None
    worker.update_run = lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("update_run should not run"))

    batch_updates = []

    class FakeQuery:
        def __init__(self, table_name):
            self.table_name = table_name

        def update(self, payload):
            batch_updates.append(payload)
            return self

        def eq(self, *_args, **_kwargs):
            return self

        def execute(self):
            return SimpleNamespace(data=[])

    class FakeSupabase:
        def rpc(self, *_args, **_kwargs):
            raise AssertionError("complete_entity_import_batch should not run for a terminal batch")

        def table(self, name):
            return FakeQuery(name)

    worker.supabase = FakeSupabase()
    worker._safe_execute = lambda operation, context=None: operation() or True

    worker.process_batch({"id": "batch-1", "metadata": {"queue_mode": "durable_worker", "retry_state": "running"}})

    assert batch_updates[-1]["status"] == "completed"
    assert batch_updates[-1]["metadata"]["retry_state"] == "completed"


def test_process_batch_auto_queues_next_repair_for_blocked_published_run():
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker._now_iso = lambda: "2026-03-04T12:10:00+00:00"
    worker._batch_metadata = lambda batch: batch.get("metadata", {})
    worker.refresh_batch_heartbeat = lambda batch_id, metadata=None: {
        **(metadata or {}),
        "heartbeat_at": "2026-03-04T12:10:00+00:00",
    }
    worker._start_batch_heartbeat = lambda batch_id, metadata=None: (
        SimpleNamespace(set=lambda: None),
        SimpleNamespace(join=lambda timeout=1: None),
    )
    worker.worker_id = "worker-1"
    worker.lease_seconds = 60
    worker.max_run_attempts = 2
    worker.repair_retry_budget = 3
    worker._get_run_metadata = lambda batch_id, entity_id: {
        "entity_type": "CLUB",
        "priority_score": 90,
        "repair_retry_count": 0,
        "repair_retry_budget": 3,
    }
    worker._get_batch_record = lambda batch_id: {"id": batch_id, "status": "running", "metadata": {}}
    worker._safe_execute = lambda operation, context=None: operation() or True

    run = {
        "id": "batch-1_fc-porto-2027",
        "entity_id": "fc-porto-2027",
        "entity_name": "FC Porto",
        "status": "queued",
        "phase": "entity_registration",
        "metadata": {
            "entity_type": "CLUB",
            "priority_score": 90,
            "attempt_count": 1,
            "rerun_mode": "full",
        },
    }

    updates = []
    worker.update_run = lambda batch_id, entity_id, payload: updates.append(payload)
    worker.persist_monitoring_outputs = lambda *args, **kwargs: None
    worker.sync_cached_entity = lambda *args, **kwargs: None
    worker._queue_manifest_auto_advance = lambda **kwargs: None
    worker.call_pipeline = lambda run, batch_id: {
        "phases": {
            "dossier_generation": {"status": "completed"},
            "discovery": {"status": "completed"},
            "ralph_validation": {"status": "completed"},
            "temporal_persistence": {"status": "completed"},
            "dashboard_scoring": {"status": "completed"},
        },
        "artifacts": {
            "dossier_id": "fc-porto-2027",
            "scores": {"sales_readiness": "MONITOR"},
            "dossier": {
                "entity_id": "fc-porto-2027",
                "entity_name": "FC Porto",
                "quality_state": "blocked",
                "questions": [
                    {"question_id": "q3_leadership", "terminal_state": "answered"},
                    {"question_id": "q7_procurement_signal", "terminal_state": "answered"},
                    {"question_id": "q11_decision_owner", "terminal_state": "no_signal", "depends_on": ["q3_leadership", "q7_procurement_signal"]},
                    {"question_id": "q12_connections", "terminal_state": "blocked", "depends_on": ["q11_decision_owner"]},
                    {"question_id": "q15_outreach_strategy", "terminal_state": "no_signal", "depends_on": ["q11_decision_owner", "q12_connections"]},
                ],
            },
        },
        "sales_readiness": "MONITOR",
        "rfp_count": 0,
        "dual_write_ok": False,
        "publication_status": "published_degraded",
        "publication_mode": "full_degraded",
        "persistence_status": {
            "dual_write_ok": False,
            "supabase": {"ok": True, "attempts": 1},
            "falkordb": {"ok": False, "attempts": 3, "error_class": "connection_error"},
            "reconcile_required": True,
            "reconciliation_payload": {"idempotency_key": "reconcile-me"},
        },
        "completed_at": "2026-03-04T12:10:00+00:00",
    }

    inserted_batches = []
    inserted_runs = []
    complete_calls = []

    class FakeRpcQuery:
        def __init__(self, name, params):
            self.name = name
            self.params = params

        def execute(self):
            if self.name == "complete_entity_import_batch":
                complete_calls.append(self.params)
            return SimpleNamespace(data=[])

    class FakeQuery:
        def __init__(self, table_name):
            self.table_name = table_name
            self.payload = None
            self.filters = []

        def update(self, payload):
            self.payload = payload
            return self

        def insert(self, payload):
            self.payload = payload
            return self

        def select(self, *_args, **_kwargs):
            return self

        def eq(self, key, value):
            self.filters.append((key, value))
            return self

        def limit(self, _count):
            return self

        def execute(self):
            if self.table_name == "entity_pipeline_runs" and self.payload and isinstance(self.payload, list):
                inserted_runs.extend(self.payload)
            if self.table_name == "entity_import_batches" and self.payload and isinstance(self.payload, dict):
                inserted_batches.append(self.payload)
            return SimpleNamespace(data=[])

    class FakeSupabase:
        def rpc(self, name, params):
            return FakeRpcQuery(name, params)

        def table(self, name):
            return FakeQuery(name)

    worker.supabase = FakeSupabase()
    worker.find_active_repair_run = lambda entity_id, question_id, cascade_dependents=True: None
    states = [[run], [{"entity_id": "fc-porto-2027", "status": "completed", "metadata": run["metadata"]}]]
    worker.get_batch_runs = lambda batch_id: states.pop(0)

    batch = {"id": "batch-1", "metadata": {"queue_mode": "durable_worker"}}
    worker.process_batch(batch)

    queued_batch_rows = [payload for payload in inserted_batches if isinstance(payload, dict) and payload.get("id")]
    assert updates[-1]["metadata"]["repair_state"] == "queued"
    assert updates[-1]["metadata"]["next_repair_question_id"] == "q11_decision_owner"
    assert updates[-1]["metadata"]["next_repair_status"] == "queued"
    assert updates[-1]["metadata"]["next_repair_batch_id"] == queued_batch_rows[-1]["id"]
    assert updates[-1]["metadata"]["next_repair_batch_status"] == "queued"
    assert updates[-1]["metadata"]["repair_retry_count"] == 1
    assert inserted_batches, "expected a follow-on repair batch"
    assert inserted_runs, "expected a follow-on repair run"
    assert inserted_runs[-1]["metadata"]["rerun_mode"] == "question"
    assert inserted_runs[-1]["metadata"]["question_id"] == "q11_decision_owner"
    assert inserted_runs[-1]["metadata"]["repair_state"] == "queued"


def test_process_batch_skips_exhausted_question_and_queues_next():
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker._now_iso = lambda: "2026-03-04T12:20:00+00:00"
    worker._batch_metadata = lambda batch: batch.get("metadata", {})
    worker.refresh_batch_heartbeat = lambda batch_id, metadata=None: {
        **(metadata or {}),
        "heartbeat_at": "2026-03-04T12:20:00+00:00",
    }
    worker._start_batch_heartbeat = lambda batch_id, metadata=None: (
        SimpleNamespace(set=lambda: None),
        SimpleNamespace(join=lambda timeout=1: None),
    )
    worker.worker_id = "worker-2"
    worker.lease_seconds = 60
    worker.max_run_attempts = 2
    worker.repair_retry_budget = 1
    worker._get_run_metadata = lambda batch_id, entity_id: {
        "entity_type": "CLUB",
        "priority_score": 90,
        "repair_retry_count": 1,
        "repair_retry_budget": 1,
    }
    worker._get_batch_record = lambda batch_id: {"id": batch_id, "status": "running", "metadata": {}}
    worker._safe_execute = lambda operation, context=None: True
    worker._persist_skip_to_entity_dossier = lambda **kwargs: True

    queued_questions = []
    worker._queue_follow_on_repair = lambda **kwargs: queued_questions.append(kwargs["question_id"]) or {
        "batch_id": "batch-next",
        "status": "queued",
        "queue_source": "auto",
    }

    run = {
        "id": "batch-2_fc-porto-2027",
        "entity_id": "fc-porto-2027",
        "entity_name": "FC Porto",
        "status": "queued",
        "phase": "entity_registration",
        "metadata": {
            "entity_type": "CLUB",
            "priority_score": 90,
            "attempt_count": 1,
            "rerun_mode": "full",
        },
    }
    worker.get_batch_runs = lambda batch_id: [run]

    updates = []
    worker.update_run = lambda batch_id, entity_id, payload: updates.append(payload)
    worker.persist_monitoring_outputs = lambda *args, **kwargs: None
    worker.sync_cached_entity = lambda *args, **kwargs: None
    worker._queue_manifest_auto_advance = lambda **kwargs: None
    worker.call_pipeline = lambda run, batch_id: {
        "phases": {
            "dossier_generation": {"status": "completed"},
            "discovery": {"status": "completed"},
            "ralph_validation": {"status": "completed"},
            "temporal_persistence": {"status": "completed"},
            "dashboard_scoring": {"status": "completed"},
        },
        "artifacts": {
            "dossier_id": "fc-porto-2027",
            "scores": {"sales_readiness": "MONITOR"},
            "dossier": {
                "entity_id": "fc-porto-2027",
                "entity_name": "FC Porto",
                "quality_state": "blocked",
                "questions": [
                    {"question_id": "q11_decision_owner", "terminal_state": "no_signal"},
                    {"question_id": "q2_digital_stack", "terminal_state": "no_signal"},
                ],
            },
        },
        "sales_readiness": "MONITOR",
        "rfp_count": 0,
        "dual_write_ok": False,
        "publication_status": "published_degraded",
        "publication_mode": "full_degraded",
        "persistence_status": {
            "dual_write_ok": False,
            "supabase": {"ok": True, "attempts": 1},
            "falkordb": {"ok": False, "attempts": 3, "error_class": "connection_error"},
        },
    }

    worker.process_batch({"id": "batch-2", "metadata": {"queue_mode": "durable_worker", "retry_state": "running"}})

    assert queued_questions, "expected follow-on repair to be queued after skipping exhausted question"
    assert queued_questions[-1] == "q2_digital_stack"
    assert updates[-1]["metadata"]["skipped_question_ids"] == ["q11_decision_owner"]


def test_process_batch_auto_persists_skip_markers_for_question_local_repair_failure():
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker._now_iso = lambda: "2026-04-11T12:20:00+00:00"
    worker._batch_metadata = lambda batch: batch.get("metadata", {})
    worker.refresh_batch_heartbeat = lambda batch_id, metadata=None: {
        **(metadata or {}),
        "heartbeat_at": "2026-04-11T12:20:00+00:00",
    }
    worker._start_batch_heartbeat = lambda batch_id, metadata=None: (
        SimpleNamespace(set=lambda: None),
        SimpleNamespace(join=lambda timeout=1: None),
    )
    worker.worker_id = "worker-3"
    worker.lease_seconds = 60
    worker.max_run_attempts = 1
    worker._get_run_metadata = lambda batch_id, entity_id: {
        "entity_type": "CLUB",
        "priority_score": 90,
        "repair_retry_count": 0,
        "repair_retry_budget": 1,
        "rerun_mode": "question",
        "question_id": "q11_decision_owner",
        "canonical_entity_id": "fc-porto-canonical",
    }
    worker._get_batch_record = lambda batch_id: {"id": batch_id, "status": "running", "metadata": {}}

    run = {
        "id": "batch-3_fc-porto",
        "entity_id": "fc-porto-2027",
        "entity_name": "FC Porto",
        "canonical_entity_id": "fc-porto-canonical",
        "status": "running",
        "phase": "entity_registration",
        "metadata": {
            "entity_type": "CLUB",
            "priority_score": 90,
            "attempt_count": 0,
            "rerun_mode": "question",
            "question_id": "q11_decision_owner",
            "repair_retry_count": 0,
            "repair_retry_budget": 1,
        },
    }

    dossier = {
        "entity_id": "fc-porto-2027",
        "entity_name": "FC Porto",
        "quality_state": "blocked",
        "questions": [
            {"question_id": "q11_decision_owner", "terminal_state": "no_signal"},
            {"question_id": "q12_connections", "terminal_state": "blocked"},
        ],
    }

    persisted_skip_calls = []
    worker._persist_skip_to_entity_dossier = lambda **kwargs: persisted_skip_calls.append(kwargs) or True
    worker._load_persisted_dossier = lambda entity_id, canonical_entity_id: ("dossier-1", dossier)
    queued_questions = []
    worker._queue_follow_on_repair = lambda **kwargs: queued_questions.append(kwargs["question_id"]) or {
        "batch_id": "batch-next",
        "status": "queued",
        "queue_source": "auto",
    }
    worker.persist_monitoring_outputs = lambda *args, **kwargs: None
    worker.sync_cached_entity = lambda *args, **kwargs: None
    worker._queue_manifest_auto_advance = lambda **kwargs: None

    updates = []
    worker.update_run = lambda batch_id, entity_id, payload: updates.append(payload)

    class FakeRpcQuery:
        def execute(self):
            return SimpleNamespace(data=[])

    class FakeQuery:
        def __init__(self, table_name):
            self.table_name = table_name

        def update(self, payload):
            self.payload = payload
            return self

        def select(self, *_args, **_kwargs):
            return self

        def eq(self, *_args, **_kwargs):
            return self

        def limit(self, _count):
            return self

        def execute(self):
            return SimpleNamespace(data=[])

    class FakeSupabase:
        def rpc(self, *_args, **_kwargs):
            return FakeRpcQuery()

        def table(self, name):
            return FakeQuery(name)

    worker.supabase = FakeSupabase()
    worker.call_pipeline = lambda run, batch_id: (_ for _ in ()).throw(ValueError("schema failure for q11"))
    worker.get_batch_runs = lambda batch_id: [run]

    worker.process_batch({"id": "batch-3", "metadata": {"queue_mode": "durable_worker"}})

    assert persisted_skip_calls, "expected the worker to persist skip markers automatically"
    assert persisted_skip_calls[-1]["question_id"] == "q11_decision_owner"
    assert persisted_skip_calls[-1]["skip_reason"] == "value_error"
    assert persisted_skip_calls[-1]["skip_note"] == "schema failure for q11"
    assert queued_questions[-1] == "q12_connections"
    assert updates[-1]["metadata"]["skipped_question_ids"] == ["q11_decision_owner"]
    assert updates[-1]["metadata"]["last_skipped_question_id"] == "q11_decision_owner"
    assert updates[-1]["metadata"]["last_skip_reason"] == "value_error"
    assert updates[-1]["metadata"]["last_skip_note"] == "schema failure for q11"


def test_process_batch_auto_queues_fc_porto_people_chain_when_persisted_questions_lack_depends_on():
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker._now_iso = lambda: "2026-03-04T12:10:00+00:00"
    worker._batch_metadata = lambda batch: batch.get("metadata", {})
    worker.refresh_batch_heartbeat = lambda batch_id, metadata=None: {
        **(metadata or {}),
        "heartbeat_at": "2026-03-04T12:10:00+00:00",
    }
    worker._start_batch_heartbeat = lambda batch_id, metadata=None: (
        SimpleNamespace(set=lambda: None),
        SimpleNamespace(join=lambda timeout=1: None),
    )
    worker.worker_id = "worker-1"
    worker.lease_seconds = 60
    worker.max_run_attempts = 2
    worker.repair_retry_budget = 3
    worker._get_run_metadata = lambda batch_id, entity_id: {
        "entity_type": "SPORT_CLUB",
        "priority_score": 90,
        "repair_retry_count": 0,
        "repair_retry_budget": 3,
    }
    worker._safe_execute = lambda operation, context=None: operation() or True

    run = {
        "id": "batch-1_fc-porto-2027",
        "entity_id": "fc-porto-2027",
        "entity_name": "FC Porto",
        "status": "queued",
        "phase": "entity_registration",
        "metadata": {
            "entity_type": "SPORT_CLUB",
            "priority_score": 90,
            "attempt_count": 1,
            "rerun_mode": "question",
            "question_id": "q11_decision_owner",
        },
    }

    updates = []
    worker.update_run = lambda batch_id, entity_id, payload: updates.append(payload)
    worker.persist_monitoring_outputs = lambda *args, **kwargs: None
    worker.sync_cached_entity = lambda *args, **kwargs: None
    worker._queue_manifest_auto_advance = lambda **kwargs: None
    worker.call_pipeline = lambda run, batch_id: {
        "phases": {
            "dossier_generation": {"status": "completed"},
            "discovery": {"status": "completed"},
            "ralph_validation": {"status": "completed"},
            "temporal_persistence": {"status": "completed"},
            "dashboard_scoring": {"status": "completed"},
        },
        "artifacts": {
            "dossier_id": "fc-porto-2027",
            "scores": {"sales_readiness": "MONITOR"},
            "dossier": {
                "entity_id": "fc-porto-2027",
                "entity_name": "FC Porto",
                "quality_state": "blocked",
                "questions": [
                    {"question_id": "q1_foundation", "terminal_state": "no_signal"},
                    {"question_id": "q3_leadership", "terminal_state": "no_signal"},
                    {"question_id": "q7_procurement_signal", "terminal_state": "answered"},
                    {"question_id": "q11_decision_owner", "terminal_state": "no_signal"},
                    {"question_id": "q12_connections", "terminal_state": "blocked"},
                    {"question_id": "q15_outreach_strategy", "terminal_state": "no_signal"},
                ],
            },
        },
        "sales_readiness": "MONITOR",
        "rfp_count": 0,
        "dual_write_ok": False,
        "publication_status": "published_degraded",
        "publication_mode": "repair_degraded",
        "persistence_status": {
            "dual_write_ok": False,
            "supabase": {"ok": True, "attempts": 1},
            "falkordb": {"ok": False, "attempts": 3, "error_class": "connection_error"},
            "reconcile_required": True,
            "reconciliation_payload": {"idempotency_key": "reconcile-me"},
        },
        "completed_at": "2026-03-04T12:10:00+00:00",
    }

    inserted_batches = []
    inserted_runs = []

    class FakeRpcQuery:
        def __init__(self, name, params):
            self.name = name
            self.params = params

        def execute(self):
            return SimpleNamespace(data=[])

    class FakeQuery:
        def __init__(self, table_name):
            self.table_name = table_name
            self.payload = None
            self.filters = []

        def update(self, payload):
            self.payload = payload
            return self

        def insert(self, payload):
            self.payload = payload
            return self

        def select(self, *_args, **_kwargs):
            return self

        def eq(self, *_args, **_kwargs):
            return self

        def limit(self, _count):
            return self

        def execute(self):
            if self.table_name == "entity_pipeline_runs" and isinstance(self.payload, list):
                inserted_runs.extend(self.payload)
            if self.table_name == "entity_import_batches" and isinstance(self.payload, dict):
                inserted_batches.append(self.payload)
            return SimpleNamespace(data=[])

    class FakeSupabase:
        def rpc(self, name, params):
            return FakeRpcQuery(name, params)

        def table(self, name):
            return FakeQuery(name)

    worker.supabase = FakeSupabase()
    worker.find_active_repair_run = lambda entity_id, question_id, cascade_dependents=True: None
    states = [[run], [{"entity_id": "fc-porto-2027", "status": "completed", "metadata": run["metadata"]}]]
    worker.get_batch_runs = lambda batch_id: states.pop(0)

    worker.process_batch({"id": "batch-1", "metadata": {"queue_mode": "durable_worker"}})

    assert updates[-1]["metadata"]["next_repair_question_id"] == "q11_decision_owner"
    assert updates[-1]["metadata"]["next_repair_status"] == "queued"
    assert inserted_batches
    assert inserted_runs[-1]["metadata"]["question_id"] == "q11_decision_owner"


def test_process_batch_marks_next_repair_as_planned_when_follow_on_insert_fails():
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker._now_iso = lambda: "2026-03-04T12:10:00+00:00"
    worker._batch_metadata = lambda batch: batch.get("metadata", {})
    worker.refresh_batch_heartbeat = lambda batch_id, metadata=None: {
        **(metadata or {}),
        "heartbeat_at": "2026-03-04T12:10:00+00:00",
    }
    worker._start_batch_heartbeat = lambda batch_id, metadata=None: (
        SimpleNamespace(set=lambda: None),
        SimpleNamespace(join=lambda timeout=1: None),
    )
    worker.worker_id = "worker-1"
    worker.lease_seconds = 60
    worker.max_run_attempts = 2
    worker.repair_retry_budget = 3
    worker._get_run_metadata = lambda batch_id, entity_id: {
        "entity_type": "CLUB",
        "priority_score": 90,
        "repair_retry_count": 0,
        "repair_retry_budget": 3,
    }
    worker._get_batch_record = lambda batch_id: {"id": batch_id, "status": "running", "metadata": {}}

    run = {
        "id": "batch-1_fc-porto-2027",
        "entity_id": "fc-porto-2027",
        "entity_name": "FC Porto",
        "status": "queued",
        "phase": "entity_registration",
        "metadata": {
            "entity_type": "CLUB",
            "priority_score": 90,
            "attempt_count": 1,
            "rerun_mode": "full",
        },
    }

    updates = []
    worker.update_run = lambda batch_id, entity_id, payload: updates.append(payload)
    worker.persist_monitoring_outputs = lambda *args, **kwargs: None
    worker.sync_cached_entity = lambda *args, **kwargs: None
    worker._queue_manifest_auto_advance = lambda **kwargs: None
    worker.call_pipeline = lambda run, batch_id: {
        "phases": {
            "dossier_generation": {"status": "completed"},
            "discovery": {"status": "completed"},
            "ralph_validation": {"status": "completed"},
            "temporal_persistence": {"status": "completed"},
            "dashboard_scoring": {"status": "completed"},
        },
        "artifacts": {
            "dossier_id": "fc-porto-2027",
            "scores": {"sales_readiness": "MONITOR"},
            "dossier": {
                "entity_id": "fc-porto-2027",
                "entity_name": "FC Porto",
                "quality_state": "blocked",
                "questions": [
                    {"question_id": "q7_procurement_signal", "terminal_state": "answered"},
                    {"question_id": "q11_decision_owner", "terminal_state": "no_signal"},
                    {"question_id": "q12_connections", "terminal_state": "blocked"},
                ],
            },
        },
        "sales_readiness": "MONITOR",
        "rfp_count": 0,
        "dual_write_ok": False,
        "publication_status": "published_degraded",
        "publication_mode": "full_degraded",
        "persistence_status": {
            "dual_write_ok": False,
            "supabase": {"ok": True, "attempts": 1},
            "falkordb": {"ok": False, "attempts": 3, "error_class": "connection_error"},
            "reconcile_required": True,
        },
        "completed_at": "2026-03-04T12:10:00+00:00",
    }

    class FakeRpcQuery:
        def execute(self):
            return SimpleNamespace(data=[])

    class FakeQuery:
        def __init__(self, table_name):
            self.table_name = table_name
            self.payload = None
            self.filters = []

        def update(self, payload):
            self.payload = payload
            return self

        def insert(self, payload):
            self.payload = payload
            return self

        def select(self, *_args, **_kwargs):
            return self

        def eq(self, *_args, **_kwargs):
            self.filters.append((_args, _kwargs))
            return self

        def limit(self, _count):
            return self

        def execute(self):
            return SimpleNamespace(data=[])

    class FakeSupabase:
        def rpc(self, *_args, **_kwargs):
            return FakeRpcQuery()

        def table(self, name):
            return FakeQuery(name)

    worker.supabase = FakeSupabase()
    worker.find_active_repair_run = lambda entity_id, question_id, cascade_dependents=True: None
    worker.get_batch_runs = lambda batch_id: [run]
    worker._safe_execute = lambda operation, context=None: False if "self-healing" in (context or "") else (operation() or True)

    worker.process_batch({"id": "batch-1", "metadata": {"queue_mode": "durable_worker"}})

    assert updates[-1]["metadata"]["next_repair_question_id"] == "q11_decision_owner"
    assert updates[-1]["metadata"].get("next_repair_status") is None
    assert updates[-1]["metadata"].get("next_repair_batch_id") is None
    assert updates[-1]["metadata"].get("next_repair_batch_status") is None
    assert updates[-1]["metadata"]["repair_state"] == "idle"


def test_process_batch_exhausts_non_cascading_question_repair_when_same_question_is_selected_again():
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker._now_iso = lambda: "2026-03-04T12:10:00+00:00"
    worker._batch_metadata = lambda batch: batch.get("metadata", {})
    worker.refresh_batch_heartbeat = lambda batch_id, metadata=None: metadata or {}
    worker._start_batch_heartbeat = lambda batch_id, metadata=None: (
        SimpleNamespace(set=lambda: None),
        SimpleNamespace(join=lambda timeout=1: None),
    )
    worker.worker_id = "worker-1"
    worker.lease_seconds = 60
    worker.max_run_attempts = 2
    worker.repair_retry_budget = 3
    worker._get_run_metadata = lambda batch_id, entity_id: {
        "entity_type": "CLUB",
        "priority_score": 90,
        "repair_retry_count": 0,
        "repair_retry_budget": 3,
        "rerun_mode": "question",
        "question_id": "q11_decision_owner",
        "cascade_dependents": False,
    }
    worker._get_batch_record = lambda batch_id: {"id": batch_id, "status": "running", "metadata": {}}

    run = {
        "id": "batch-1_arsenal",
        "entity_id": "arsenal",
        "entity_name": "Arsenal",
        "status": "queued",
        "phase": "entity_registration",
        "metadata": {
            "entity_type": "CLUB",
            "priority_score": 90,
            "attempt_count": 1,
            "rerun_mode": "question",
            "question_id": "q11_decision_owner",
            "cascade_dependents": False,
        },
    }

    updates = []
    worker.update_run = lambda batch_id, entity_id, payload: updates.append(payload)
    worker.persist_monitoring_outputs = lambda *args, **kwargs: None
    worker.sync_cached_entity = lambda *args, **kwargs: None
    worker._queue_manifest_auto_advance = lambda **kwargs: None
    worker.find_active_repair_run = lambda entity_id, question_id, cascade_dependents=True: None
    worker.get_batch_runs = lambda batch_id: [run]
    worker._queue_manifest_auto_advance = lambda **kwargs: None
    worker.call_pipeline = lambda run, batch_id: {
        "phases": {
            "dossier_generation": {"status": "completed"},
            "discovery": {"status": "completed"},
            "dashboard_scoring": {"status": "completed"},
        },
        "artifacts": {
            "dossier_id": "arsenal",
            "scores": {"sales_readiness": "MONITOR"},
            "dossier": {
                "entity_id": "arsenal",
                "entity_name": "Arsenal",
                "quality_state": "partial",
                "questions": [
                    {"question_id": "q11_decision_owner", "terminal_state": "blocked"},
                    {"question_id": "q12_connections", "terminal_state": "pending"},
                ],
            },
        },
        "sales_readiness": "MONITOR",
        "rfp_count": 0,
        "dual_write_ok": True,
        "publication_status": "published",
        "publication_mode": "full",
        "persistence_status": {
            "dual_write_ok": True,
            "reconcile_required": False,
        },
        "completed_at": "2026-03-04T12:10:00+00:00",
    }

    class FakeRpcQuery:
        def execute(self):
            return SimpleNamespace(data=[])

    class FakeQuery:
        def __init__(self, table_name):
            self.table_name = table_name
            self.payload = None

        def update(self, payload):
            self.payload = payload
            return self

        def insert(self, payload):
            raise AssertionError("same-question repair loop should not queue a follow-on batch")

        def select(self, *_args, **_kwargs):
            return self

        def eq(self, *_args, **_kwargs):
            return self

        def limit(self, _count):
            return self

        def execute(self):
            return SimpleNamespace(data=[])

    class FakeSupabase:
        def rpc(self, *_args, **_kwargs):
            return FakeRpcQuery()

        def table(self, name):
            return FakeQuery(name)

    worker.supabase = FakeSupabase()

    worker.process_batch({"id": "batch-1", "metadata": {"queue_mode": "durable_worker"}})

    assert updates[-1]["status"] == "completed"
    assert updates[-1]["metadata"]["repair_state"] == "exhausted"
    assert updates[-1]["metadata"]["next_repair_status"] == "exhausted"
    assert updates[-1]["metadata"].get("next_repair_question_id") is None
    assert "q11_decision_owner" in updates[-1]["metadata"]["exhausted_question_ids"]


def test_find_active_repair_run_reuses_canonical_entity_uuid_alias():
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)

    canonical_uuid = "2df7c5d8-6db3-4fc6-8b15-e3838d8d8d8d"

    class FakeQuery:
        def __init__(self, table_name):
            self.table_name = table_name
            self.filters = []

        def select(self, *_args, **_kwargs):
            return self

        def eq(self, key, value):
            self.filters.append((key, value))
            return self

        def in_(self, *_args, **_kwargs):
            return self

        def order(self, *_args, **_kwargs):
            return self

        def limit(self, _count):
            return self

        def maybe_single(self):
            if self.table_name != "entity_pipeline_runs":
                return SimpleNamespace(data=None)
            filter_map = dict(self.filters)
            if filter_map.get("canonical_entity_id") == canonical_uuid:
                return SimpleNamespace(data={
                    "id": "batch-1_fc-porto-2027",
                    "batch_id": "batch-1",
                    "entity_id": "fc-porto-2027",
                    "entity_name": "FC Porto",
                    "canonical_entity_id": canonical_uuid,
                    "status": "running",
                    "started_at": "2026-04-10T14:00:00+00:00",
                    "metadata": {
                        "rerun_mode": "question",
                        "question_id": "q11_decision_owner",
                        "cascade_dependents": True,
                    },
                })
            return SimpleNamespace(data=None)

        def execute(self):
            return SimpleNamespace(data=[])

    class FakeSupabase:
        def table(self, name):
            return FakeQuery(name)

    worker.supabase = FakeSupabase()
    worker._get_batch_record = lambda batch_id: {"id": batch_id, "status": "running"}

    run = worker.find_active_repair_run(
        entity_id="fc-porto-2027",
        question_id="q11_decision_owner",
        cascade_dependents=True,
        canonical_entity_id=canonical_uuid,
    )

    assert run is not None
    assert run["canonical_entity_id"] == canonical_uuid


def test_queue_follow_on_repair_does_not_reuse_current_batch():
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker._now_iso = lambda: "2026-04-11T13:00:00+00:00"
    worker._build_follow_on_repair_batch_id = lambda: "batch-follow-on"
    worker._safe_execute = lambda operation, context=None: operation() or True
    worker.find_active_repair_run = lambda *args, **kwargs: {
        "batch_id": "batch-current",
        "status": "running",
    }
    worker._get_batch_record = lambda batch_id: {"id": batch_id, "status": "running"}

    inserted_batches = []
    inserted_runs = []

    class FakeQuery:
        def __init__(self, table_name):
            self.table_name = table_name
            self.payload = None

        def insert(self, payload):
            self.payload = payload
            return self

        def execute(self):
            if self.table_name == "entity_import_batches":
                inserted_batches.append(self.payload)
            if self.table_name == "entity_pipeline_runs":
                inserted_runs.append(self.payload)
            return SimpleNamespace(data=[])

    worker.supabase = SimpleNamespace(table=lambda name: FakeQuery(name))

    queue_result = worker._queue_follow_on_repair(
        run={
            "batch_id": "batch-current",
            "entity_id": "fc-porto-2027",
            "entity_name": "FC Porto",
            "canonical_entity_id": "fc-porto-canonical",
        },
        latest_metadata={"queue_mode": "durable_worker"},
        result={},
        question_id="q11_decision_owner",
        repair_retry_count=1,
        repair_retry_budget=3,
        reconcile_required=False,
    )

    assert queue_result["batch_id"] == "batch-follow-on"
    assert queue_result["status"] == "queued"
    assert inserted_batches[-1]["id"] == "batch-follow-on"
    assert inserted_runs[-1][0]["batch_id"] == "batch-follow-on"


def test_queue_follow_on_repair_skips_guarded_scoped_pilot_batches():
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker._now_iso = lambda: "2026-04-11T13:00:00+00:00"
    worker._build_follow_on_repair_batch_id = lambda: pytest.fail("guarded pilots must not queue follow-ons")
    worker.find_active_repair_run = lambda *args, **kwargs: None

    inserted = []

    class FakeQuery:
        def insert(self, payload):
            inserted.append(payload)
            return self

        def execute(self):
            return SimpleNamespace(data=[])

    worker.supabase = SimpleNamespace(table=lambda _name: FakeQuery())

    queue_result = worker._queue_follow_on_repair(
        run={
            "batch_id": "pilot-batch",
            "entity_id": "fdj-suez",
            "entity_name": "FDJ-Suez",
            "canonical_entity_id": "fdj-suez",
        },
        latest_metadata={
            "targeted_pilot": True,
            "auto_advance_guard": "pilot_batch_only",
            "suppress_cursor_resume_after_batch": True,
            "queue_mode": "durable_worker",
        },
        result={},
        question_id="q2_digital_stack",
        repair_retry_count=1,
        repair_retry_budget=3,
        reconcile_required=False,
    )

    assert queue_result == {
        "batch_id": None,
        "status": "skipped",
        "queue_source": "guarded_pilot",
    }
    assert inserted == []


def test_derive_follow_on_repair_metadata_clears_self_referential_next_batch():
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker._queue_follow_on_repair = lambda **kwargs: {
        "batch_id": "batch-current",
        "status": "running",
        "queue_source": "reused",
    }

    metadata = worker._derive_follow_on_repair_metadata(
        run={
            "id": "batch-current_fc-porto-2027",
            "batch_id": "batch-current",
            "entity_id": "fc-porto-2027",
            "entity_name": "FC Porto",
            "canonical_entity_id": "fc-porto-canonical",
        },
        latest_metadata={
            "repair_retry_count": 0,
            "repair_retry_budget": 3,
            "canonical_entity_id": "fc-porto-canonical",
        },
        result={
            "artifacts": {
                "dossier": {
                    "quality_state": "blocked",
                    "questions": [
                        {"question_id": "q11_decision_owner", "terminal_state": "no_signal"},
                    ],
                },
            },
        },
        publication_succeeded=True,
        reconcile_required=False,
    )

    assert metadata["next_repair_question_id"] == "q11_decision_owner"
    assert metadata["next_repair_status"] is None
    assert metadata["next_repair_batch_id"] is None
    assert metadata["next_repair_batch_status"] is None


def test_derive_follow_on_repair_metadata_exhausts_repeated_same_question():
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker._queue_follow_on_repair = lambda **kwargs: pytest.fail("same derived question should not be re-queued")

    metadata = worker._derive_follow_on_repair_metadata(
        run={
            "id": "batch-q11_entity-1",
            "batch_id": "batch-q11",
            "entity_id": "entity-1",
            "entity_name": "Entity 1",
            "canonical_entity_id": "entity-1",
        },
        latest_metadata={
            "question_id": "q11_decision_owner",
            "repair_retry_count": 1,
            "repair_retry_budget": 3,
            "canonical_entity_id": "entity-1",
        },
        result={
            "artifacts": {
                "dossier": {
                    "quality_state": "blocked",
                    "questions": [
                        {"question_id": "q11_decision_owner", "terminal_state": "no_signal"},
                        {"question_id": "q12_connections", "terminal_state": "blocked", "depends_on": ["q11_decision_owner"]},
                    ],
                },
            },
        },
        publication_succeeded=True,
        reconcile_required=False,
    )

    assert metadata["repair_state"] == "exhausted"
    assert metadata["next_repair_status"] == "exhausted"
    assert "q11_decision_owner" in metadata["exhausted_question_ids"]


def test_process_batch_stops_pipeline_when_follow_on_question_also_fails(tmp_path, monkeypatch):
    control_path = tmp_path / "pipeline-control-state.json"
    monkeypatch.setattr("entity_pipeline_worker.PIPELINE_CONTROL_STATE_PATH", control_path)

    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker._now_iso = lambda: "2026-04-12T10:00:00+00:00"
    worker._batch_metadata = lambda batch: batch.get("metadata", {})
    worker.refresh_batch_heartbeat = lambda batch_id, metadata=None: {**(metadata or {}), "heartbeat_at": "2026-04-12T10:00:00+00:00"}
    worker._start_batch_heartbeat = lambda batch_id, metadata=None: (
        SimpleNamespace(set=lambda: None),
        SimpleNamespace(join=lambda timeout=1: None),
    )
    worker.worker_id = "worker-stop"
    worker.lease_seconds = 60
    worker.max_run_attempts = 1
    worker._persist_skip_to_entity_dossier = lambda **kwargs: True
    worker._safe_execute = lambda operation, context=None: operation() or True
    worker._get_batch_record = lambda batch_id: {"id": batch_id, "status": "running", "metadata": {}}
    worker._get_run_metadata = lambda batch_id, entity_id: {
        "rerun_mode": "question",
        "question_id": "q12_connections",
        "canonical_entity_id": "fc-porto-canonical",
        "skipped_question_ids": ["q11_decision_owner"],
        "repair_retry_budget": 3,
    }
    worker.call_pipeline = lambda run, batch_id: (_ for _ in ()).throw(ValueError("schema invalid"))
    worker.sync_cached_entity = lambda *args, **kwargs: None

    updates = []
    worker.update_run = lambda batch_id, entity_id, payload: updates.append(payload)

    class FakeQuery:
        def select(self, *_args, **_kwargs):
            return self
        def limit(self, *_args, **_kwargs):
            return self
        def maybe_single(self):
            return SimpleNamespace(data={"id": "dossier-1", "dossier_data": {"questions": []}})
        def update(self, _payload):
            return self
        def eq(self, *_args, **_kwargs):
            return self
        def execute(self):
            return SimpleNamespace(data=[])

    class FakeRpc:
        def execute(self):
            return SimpleNamespace(data=[])

    worker.supabase = SimpleNamespace(
        table=lambda _name: FakeQuery(),
        rpc=lambda *_args, **_kwargs: FakeRpc(),
    )
    run = {
        "id": "batch-stop_fc-porto-2027",
        "batch_id": "batch-stop",
        "entity_id": "fc-porto-2027",
        "entity_name": "FC Porto",
        "canonical_entity_id": "fc-porto-canonical",
        "status": "running",
        "phase": "dossier_generation",
        "metadata": {
            "rerun_mode": "question",
            "question_id": "q12_connections",
            "skipped_question_ids": ["q11_decision_owner"],
        },
    }

    states = [[run], [{"entity_id": "fc-porto-2027", "status": "failed", "metadata": {}}]]
    worker.get_batch_runs = lambda batch_id: states.pop(0)

    worker.process_batch({"id": "batch-stop", "metadata": {"queue_mode": "durable_worker"}})

    state = read_pipeline_control_state()
    assert updates[-1]["metadata"]["stop_reason"] == "question_skipped_and_next_failed"
    assert state["is_paused"] is True
    assert state["stop_reason"] == "question_skipped_and_next_failed"


def test_process_batch_keeps_pipeline_running_when_manifest_is_exhausted(tmp_path, monkeypatch):
    control_path = tmp_path / "pipeline-control-state.json"
    monkeypatch.setattr("entity_pipeline_worker.PIPELINE_CONTROL_STATE_PATH", control_path)

    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker._now_iso = lambda: "2026-04-12T11:00:00+00:00"
    worker._batch_metadata = lambda batch: batch.get("metadata", {})
    worker.refresh_batch_heartbeat = lambda batch_id, metadata=None: {**(metadata or {}), "heartbeat_at": "2026-04-12T11:00:00+00:00"}
    worker._start_batch_heartbeat = lambda batch_id, metadata=None: (
        SimpleNamespace(set=lambda: None),
        SimpleNamespace(join=lambda timeout=1: None),
    )
    worker.worker_id = "worker-stop"
    worker.lease_seconds = 60
    worker.max_run_attempts = 1
    worker._safe_execute = lambda operation, context=None: operation() or True
    worker._get_run_metadata = lambda batch_id, entity_id: {}
    worker._get_batch_record = lambda batch_id: {"id": batch_id, "status": "running", "metadata": {}}
    worker.persist_monitoring_outputs = lambda *args, **kwargs: None
    worker.sync_cached_entity = lambda *args, **kwargs: None
    worker._queue_manifest_auto_advance = lambda **kwargs: None
    worker.call_pipeline = lambda run, batch_id: {
        "phases": {"dashboard_scoring": {"status": "completed"}},
        "artifacts": {"dossier_id": "fifa", "scores": {}},
        "sales_readiness": "MONITOR",
        "rfp_count": 0,
        "dual_write_ok": True,
        "publication_status": "published",
        "completed_at": "2026-04-12T11:00:00+00:00",
    }

    updates = []
    worker.update_run = lambda batch_id, entity_id, payload: updates.append(payload)

    class FakeTable:
        def select(self, *_args, **_kwargs):
            return self
        def eq(self, *_args, **_kwargs):
            return self
        def limit(self, *_args, **_kwargs):
            return self
        def update(self, _payload):
            return self
        def execute(self):
            return SimpleNamespace(data=[{"metadata": {}}])

    class FakeRpc:
        def execute(self):
            return SimpleNamespace(data=[])

    worker.supabase = SimpleNamespace(
        table=lambda _name: FakeTable(),
        rpc=lambda *_args, **_kwargs: FakeRpc(),
    )
    states = [[{
        "entity_id": "fifa",
        "entity_name": "FIFA",
        "status": "queued",
        "phase": "entity_registration",
        "metadata": {},
    }], [{
        "entity_id": "fifa",
        "entity_name": "FIFA",
        "status": "completed",
        "phase": "dashboard_scoring",
        "metadata": {},
    }]]
    worker.get_batch_runs = lambda batch_id: states.pop(0)

    worker.process_batch({"id": "batch-finished", "metadata": {"queue_mode": "durable_worker"}})

    state = read_pipeline_control_state()
    assert updates[-1]["status"] == "completed"
    assert state["is_paused"] is False
    assert state["requested_state"] == "running"
    assert state["observed_state"] == "running"
    assert state["transition_state"] == "running"
    assert state["stop_reason"] is None
    assert state["pause_reason"] is None


def test_queue_manifest_auto_advance_skips_prior_stopped_checkpointed_entity(monkeypatch):
    inserted_batches = []
    inserted_runs = []
    active_statuses = []
    seen_entity_ids = []
    stopped_checkpointed_runs = {
        "entity-b": [
            {
                "id": "run-entity-b-stopped",
                "batch_id": "batch-stopped",
                "entity_id": "entity-b",
                "canonical_entity_id": "entity-b",
                "status": "failed",
                "metadata": {
                    "current_question_id": "q7_procurement_signal",
                    "next_repair_question_id": "q11_decision_owner",
                },
            }
        ]
    }

    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker._now_iso = lambda: "2026-04-23T12:00:00+00:00"
    worker._build_follow_on_repair_batch_id = lambda: "batch-follow-on"
    worker._safe_execute = lambda operation, context=None: operation() or True
    worker._load_manifest_entities = lambda: [
        {"entity_id": "entity-a", "canonical_entity_id": "entity-a", "entity_name": "Entity A", "entity_type": "CLUB", "properties": {}},
        {"entity_id": "entity-b", "canonical_entity_id": "entity-b", "entity_name": "Entity B", "entity_type": "CLUB", "properties": {}},
        {"entity_id": "entity-c", "canonical_entity_id": "entity-c", "entity_name": "Entity C", "entity_type": "CLUB", "properties": {}},
        {"entity_id": "entity-d", "canonical_entity_id": "entity-d", "entity_name": "Entity D", "entity_type": "CLUB", "properties": {}},
    ]

    class FakeQuery:
        def __init__(self, table_name):
            self.table_name = table_name
            self.filters = []
            self.payload = None

        def select(self, *_args, **_kwargs):
            return self

        def eq(self, column, value):
            self.filters.append(("eq", column, value))
            return self

        def in_(self, column, values):
            self.filters.append(("in", column, tuple(values)))
            return self

        def limit(self, *_args, **_kwargs):
            return self

        def insert(self, payload):
            self.payload = payload
            return self

        def execute(self):
            if self.table_name == "entity_pipeline_runs" and self.payload is None:
                entity_ids = [value for kind, column, value in self.filters if kind == "eq" and column == "entity_id"]
                if entity_ids:
                    seen_entity_ids.extend(entity_ids)
                active_statuses.append(tuple(value for kind, column, value in self.filters if kind == "in" and column == "status"))
                # Entity B has a stopped run with question checkpoints, but the current helper
                # only asks whether it is actively queued/running/retrying, so it is ignored.
                if entity_ids and entity_ids[-1] in stopped_checkpointed_runs:
                    rows = [
                        row
                        for row in stopped_checkpointed_runs[entity_ids[-1]]
                        if row["status"] in {"queued", "claiming", "running", "retrying"}
                    ]
                    return SimpleNamespace(data=rows)
                return SimpleNamespace(data=[])
            if self.table_name == "entity_import_batches" and self.payload is not None:
                inserted_batches.append(self.payload)
                return SimpleNamespace(data=[self.payload])
            if self.table_name == "entity_pipeline_runs" and self.payload is not None:
                inserted_runs.append(self.payload)
                return SimpleNamespace(data=self.payload)
            return SimpleNamespace(data=[])

    worker.supabase = SimpleNamespace(table=lambda name: FakeQuery(name))
    monkeypatch.setattr(
        "entity_pipeline_worker.read_pipeline_control_state",
        lambda: {"requested_state": "running", "observed_state": "running", "is_paused": False},
    )

    queued = worker._queue_manifest_auto_advance(
        batch_id="batch-current",
        source_run={
            "entity_id": "entity-c",
            "canonical_entity_id": "entity-c",
            "entity_name": "Entity C",
            "metadata": {
                "current_question_id": "q7_procurement_signal",
                "next_repair_question_id": "q11_decision_owner",
            },
        },
        batch_metadata={"queue_mode": "durable_worker"},
    )

    assert queued["entity_id"] == "entity-d"
    assert inserted_batches[-1]["metadata"]["auto_advance_target_entity_id"] == "entity-d"
    assert inserted_runs[-1][0]["entity_id"] == "entity-d"
    assert stopped_checkpointed_runs["entity-b"][0]["metadata"]["current_question_id"] == "q7_procurement_signal"
    assert stopped_checkpointed_runs["entity-b"][0]["metadata"]["next_repair_question_id"] == "q11_decision_owner"
    assert "entity-b" not in seen_entity_ids
    assert seen_entity_ids == ["entity-d", "entity-d"]
    assert any(
        statuses == (("queued", "claiming", "running", "retrying"),)
        for statuses in active_statuses
    )
