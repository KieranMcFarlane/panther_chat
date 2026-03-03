import os
import sys
from pathlib import Path
from types import SimpleNamespace
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from entity_pipeline_worker import (
    build_batch_claim_metadata,
    build_batch_heartbeat_metadata,
    build_batch_running_update,
    build_run_retry_metadata,
    choose_supabase_key,
    build_run_detail_url,
    load_worker_environment,
    merge_pipeline_run_metadata,
    merge_cached_entity_properties,
    derive_discovery_context,
    should_process_in_process,
    EntityPipelineWorker,
)


def test_should_process_in_process_defaults_true_for_local_mode():
    assert should_process_in_process(None) is True
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


def test_load_worker_environment_reads_local_dotenv(tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text("ENTITY_IMPORT_QUEUE_MODE=durable_worker\nSUPABASE_ANON_KEY=anon-key\n", encoding="utf-8")

    monkeypatch.delenv("ENTITY_IMPORT_QUEUE_MODE", raising=False)
    monkeypatch.delenv("SUPABASE_ANON_KEY", raising=False)

    load_worker_environment(env_file)

    assert os.environ["ENTITY_IMPORT_QUEUE_MODE"] == "durable_worker"
    assert os.environ["SUPABASE_ANON_KEY"] == "anon-key"


def test_build_batch_claim_metadata_sets_worker_and_heartbeat_fields():
    metadata = build_batch_claim_metadata({"source": "single_entity_trigger"}, worker_id="worker-1", now_iso="2026-03-02T15:00:00+00:00")

    assert metadata["worker_id"] == "worker-1"
    assert metadata["claimed_at"] == "2026-03-02T15:00:00+00:00"
    assert metadata["heartbeat_at"] == "2026-03-02T15:00:00+00:00"
    assert metadata["queue_mode"] == "durable_worker"


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


def test_merge_pipeline_run_metadata_preserves_phase_details_and_adds_scores():
    merged = merge_pipeline_run_metadata(
        {"phase_details": {"status": "running", "iteration": 2}},
        phases={"discovery": {"status": "completed"}},
        scores={"sales_readiness": "MONITOR"},
        performance_summary={"slowest_hop": {"hop_type": "rfp_page"}},
        promoted_rfp_ids=["rfp-1"],
        completed_at="2026-03-02T15:10:00+00:00",
    )

    assert merged["phase_details"]["iteration"] == 2
    assert merged["phases"]["discovery"]["status"] == "completed"
    assert merged["scores"]["sales_readiness"] == "MONITOR"
    assert merged["performance_summary"]["slowest_hop"]["hop_type"] == "rfp_page"
    assert merged["promoted_rfp_ids"] == ["rfp-1"]


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


def test_claim_next_batch_uses_rpc_claim_function():
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

    claimed = worker.claim_next_batch()

    assert claimed["id"] == "batch-1"


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
        "metadata": {"entity_type": "FEDERATION"},
    }
    worker.get_batch_runs = lambda batch_id: [run]
    worker.sync_cached_entity = lambda batch_id, run, result, status: None

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
            "scores": {"sales_readiness": "MONITOR"},
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
