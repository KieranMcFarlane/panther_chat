import json
import os
import sys
from pathlib import Path
from types import SimpleNamespace
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

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
    load_worker_environment,
    merge_pipeline_run_metadata,
    merge_cached_entity_properties,
    derive_discovery_context,
    derive_monitoring_summary,
    resolve_pipeline_timeout,
    resolve_fastapi_url,
    read_pipeline_control_state,
    should_process_in_process,
    EntityPipelineWorker,
)


def test_should_process_in_process_defaults_to_durable_worker_mode():
    assert should_process_in_process(None) is False
    assert should_process_in_process("in_process") is True
    assert should_process_in_process("durable_worker") is False


def test_build_run_detail_url_points_to_import_run_detail_page():
    assert (
        build_run_detail_url("batch-1", "entity-1")
        == "/entity-import/batch-1/entity-1"
    )


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


def test_choose_supabase_key_prefers_anon_key_when_service_role_missing():
    assert choose_supabase_key(
        service_role_key=None,
        anon_key="anon-key",
        public_anon_key="public-anon-key",
    ) == "anon-key"


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

    assert read_pipeline_control_state()["is_paused"] is False


def test_read_pipeline_control_state_reads_pause_file(tmp_path, monkeypatch):
    control_path = tmp_path / "pipeline-control-state.json"
    control_path.write_text('{"is_paused": true, "pause_reason": "Paused from Live Ops"}', encoding="utf-8")
    monkeypatch.setattr("entity_pipeline_worker.PIPELINE_CONTROL_STATE_PATH", control_path)

    state = read_pipeline_control_state()

    assert state["is_paused"] is True
    assert state["pause_reason"] == "Paused from Live Ops"


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

    state = read_pipeline_control_state()

    assert state["requested_state"] == "running"
    assert state["observed_state"] == "starting"
    assert state["transition_state"] == "starting"
    assert state["desired_state"] == "running"


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
    monkeypatch.setattr("entity_pipeline_worker.read_pipeline_control_state", lambda: {"is_paused": False})
    monkeypatch.setattr("entity_pipeline_worker.write_pipeline_control_state", lambda payload: payload)

    claimed = worker.claim_next_batch()

    assert claimed["id"] == "batch-1"


def test_claim_next_batch_returns_none_when_pipeline_is_paused(monkeypatch):
    worker = EntityPipelineWorker.__new__(EntityPipelineWorker)
    worker.recover_stale_batches = lambda: None
    worker.worker_id = "worker-1"
    worker.lease_seconds = 60
    worker.supabase = SimpleNamespace(rpc=lambda *_args, **_kwargs: None)
    monkeypatch.setattr("entity_pipeline_worker.read_pipeline_control_state", lambda: {"is_paused": True, "pause_reason": "Paused from Live Ops"})

    claimed = worker.claim_next_batch()

    assert claimed is None


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


def test_process_batch_marks_exhausted_retrying_run_failed_and_fails_batch():
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

    batch_updates = []

    class FakeRpcQuery:
        def __init__(self, name, params):
            self.name = name
            self.params = params

        def execute(self):
            return SimpleNamespace(data=[])

    class FakeTable:
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

        def table(self, _name):
            return FakeTable()

    worker.supabase = FakeSupabase()
    states = [[run], [{"entity_id": "icf", "status": "failed", "metadata": run["metadata"]}]]
    worker.get_batch_runs = lambda batch_id: states.pop(0)

    batch = {"id": "batch-1", "metadata": {"queue_mode": "durable_worker"}}
    worker.process_batch(batch)

    assert run_updates[-1]["status"] == "failed"
    assert run_updates[-1]["metadata"]["retry_state"] == "failed"
    assert run_updates[-1]["error_message"] == "timed out"
    assert sync_calls, "expected failed cached-entity sync for exhausted retry"
    assert batch_updates[-1]["status"] == "failed"
    assert batch_updates[-1]["metadata"]["retry_state"] == "failed"


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


def test_process_batch_stops_pipeline_when_manifest_is_exhausted(tmp_path, monkeypatch):
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
    assert state["is_paused"] is True
    assert state["stop_reason"] == "queue_exhausted"
