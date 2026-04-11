import asyncio
import sys
from pathlib import Path
from types import SimpleNamespace

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from reconciliation_worker import ReconciliationWorker


class FakeQuery:
    def __init__(self, table_name, store):
        self.table_name = table_name
        self.store = store
        self.filters = []
        self.payload = None

    def select(self, *_args, **_kwargs):
        return self

    def update(self, payload):
        self.payload = payload
        return self

    def eq(self, key, value):
        self.filters.append((key, value))
        return self

    def limit(self, _count):
        return self

    def execute(self):
        if self.table_name == "entity_pipeline_runs" and self.payload is None:
            batch_id = dict(self.filters).get("batch_id")
            entity_id = dict(self.filters).get("entity_id")
            run = self.store.get((batch_id, entity_id))
            return SimpleNamespace(data=[run] if run else [])
        if self.table_name == "entity_pipeline_runs" and isinstance(self.payload, dict):
            batch_id = dict(self.filters).get("batch_id")
            entity_id = dict(self.filters).get("entity_id")
            run = self.store[(batch_id, entity_id)]
            run.update(self.payload)
            return SimpleNamespace(data=[run])
        return SimpleNamespace(data=[])


class FakeSupabase:
    def __init__(self, store):
        self.store = store

    def table(self, name):
        return FakeQuery(name, self.store)


def _run_record(metadata):
    return {
        "batch_id": "batch-1",
        "entity_id": "fc-porto-2027",
        "status": "completed",
        "metadata": metadata,
    }


def test_reconciliation_worker_clears_reconcile_required_when_falkor_retry_succeeds():
    store = {
        ("batch-1", "fc-porto-2027"): _run_record(
            {
                "reconcile_required": True,
                "reconciliation_state": "pending",
                "reconciliation_payload": {
                    "idempotency_key": "reconcile-me",
                    "envelope": {"payload": {"score": 2}},
                },
            }
        )
    }
    seen = []

    async def falkordb_writer(payload):
        seen.append(payload)

    worker = ReconciliationWorker(
        supabase=FakeSupabase(store),
        falkordb_writer=falkordb_writer,
        max_attempts=2,
    )

    result = asyncio.run(worker.process_run("batch-1", "fc-porto-2027"))

    assert result["status"] == "completed"
    assert seen == [{"payload": {"score": 2}}]
    assert store[("batch-1", "fc-porto-2027")]["metadata"]["reconcile_required"] is False
    assert store[("batch-1", "fc-porto-2027")]["metadata"]["reconciliation_state"] == "healthy"


def test_reconciliation_worker_marks_retrying_when_retry_fails_with_budget_remaining():
    store = {
        ("batch-1", "fc-porto-2027"): _run_record(
            {
                "reconcile_required": True,
                "reconciliation_state": "pending",
                "reconciliation_retry_count": 0,
                "reconciliation_payload": {
                    "idempotency_key": "reconcile-me",
                    "envelope": {"payload": {"score": 2}},
                },
            }
        )
    }

    async def falkordb_writer(payload):
        raise RuntimeError("falkor unavailable")

    worker = ReconciliationWorker(
        supabase=FakeSupabase(store),
        falkordb_writer=falkordb_writer,
        max_attempts=2,
    )

    result = asyncio.run(worker.process_run("batch-1", "fc-porto-2027"))

    assert result["status"] == "retrying"
    assert store[("batch-1", "fc-porto-2027")]["metadata"]["reconciliation_state"] == "retrying"
    assert store[("batch-1", "fc-porto-2027")]["metadata"]["reconciliation_retry_count"] == 1


def test_reconciliation_worker_marks_exhausted_when_retry_budget_is_spent():
    store = {
        ("batch-1", "fc-porto-2027"): _run_record(
            {
                "reconcile_required": True,
                "reconciliation_state": "retrying",
                "reconciliation_retry_count": 1,
                "reconciliation_payload": {
                    "idempotency_key": "reconcile-me",
                    "envelope": {"payload": {"score": 2}},
                },
            }
        )
    }

    async def falkordb_writer(payload):
        raise RuntimeError("falkor unavailable")

    worker = ReconciliationWorker(
        supabase=FakeSupabase(store),
        falkordb_writer=falkordb_writer,
        max_attempts=2,
    )

    result = asyncio.run(worker.process_run("batch-1", "fc-porto-2027"))

    assert result["status"] == "exhausted"
    assert store[("batch-1", "fc-porto-2027")]["metadata"]["reconciliation_state"] == "exhausted"
    assert store[("batch-1", "fc-porto-2027")]["metadata"]["reconcile_required"] is True
