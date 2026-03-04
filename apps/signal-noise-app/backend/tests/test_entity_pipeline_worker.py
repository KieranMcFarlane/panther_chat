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
    build_run_phase_start_metadata,
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


def test_resolve_fastapi_url_prefers_ipv4_loopback_default():
    assert resolve_fastapi_url(None, None) == "http://127.0.0.1:8000"
    assert resolve_fastapi_url("http://localhost:8000", None) == "http://127.0.0.1:8000"


def test_worker_module_uses_longer_default_pipeline_timeout():
    import entity_pipeline_worker as worker_module

    assert worker_module.PIPELINE_TIMEOUT_SECONDS == 1800


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


def test_build_run_phase_start_metadata_seeds_phase_details():
    metadata = build_run_phase_start_metadata(
        {
            "entity_type": "FEDERATION",
            "priority_score": 85,
        },
        worker_id="worker-1",
        now_iso="2026-03-04T12:05:00+00:00",
        lease_seconds=60,
        phase="dossier_generation",
        entity_name="ICF Verification Beta",
    )

    assert metadata["retry_state"] == "running"
    assert metadata["phase_details"]["status"] == "running"
    assert metadata["phase_details"]["phase"] == "dossier_generation"
    assert metadata["phase_details"]["entity_name"] == "ICF Verification Beta"
    assert metadata["phase_details"]["entity_type"] == "FEDERATION"
    assert metadata["phase_details"]["priority_score"] == 85


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


def test_merge_pipeline_run_metadata_preserves_phase_details_and_adds_scores():
    merged = merge_pipeline_run_metadata(
        {"phase_details": {"status": "running", "iteration": 2}},
        phases={"discovery": {"status": "completed"}},
        scores={"sales_readiness": "MONITOR"},
        monitoring_summary={"pages_fetched": 3, "candidate_count": 1},
        escalation_reason="baseline_monitoring_ambiguous",
        performance_summary={"slowest_hop": {"hop_type": "rfp_page"}},
        promoted_rfp_ids=["rfp-1"],
        completed_at="2026-03-02T15:10:00+00:00",
    )

    assert merged["phase_details"]["iteration"] == 2
    assert merged["phases"]["discovery"]["status"] == "completed"
    assert merged["scores"]["sales_readiness"] == "MONITOR"
    assert merged["monitoring_summary"]["pages_fetched"] == 3
    assert merged["escalation_reason"] == "baseline_monitoring_ambiguous"
    assert merged["performance_summary"]["slowest_hop"]["hop_type"] == "rfp_page"
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
