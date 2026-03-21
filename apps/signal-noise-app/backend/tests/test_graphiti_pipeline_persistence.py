#!/usr/bin/env python3
"""
Tests for Graphiti dual-write persistence adapter methods.
"""

import sys
from pathlib import Path

import pytest

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from graphiti_service import GraphitiService


class _Result:
    def __init__(self, data):
        self.data = data


class _FakeTable:
    def __init__(self, parent, name: str):
        self.parent = parent
        self.name = name
        self._mode = None
        self._contains = None
        self._entity_id = None
        self._episode_type = None
        self._insert_payload = None

    def select(self, _fields):
        self._mode = "select"
        return self

    def eq(self, key, value):
        if key == "entity_id":
            self._entity_id = value
        if key == "episode_type":
            self._episode_type = value
        return self

    def contains(self, _key, value):
        self._contains = value
        return self

    def limit(self, _n):
        return self

    def insert(self, payload):
        self._mode = "insert"
        self._insert_payload = payload
        return self

    def execute(self):
        if self._mode == "select":
            key = (self._entity_id, self._episode_type, (self._contains or {}).get("idempotency_key"))
            exists = key in self.parent._seen
            return _Result([{"id": "existing"}] if exists else [])
        if self._mode == "insert":
            md = self._insert_payload.get("metadata", {}) if isinstance(self._insert_payload, dict) else {}
            key = (
                self._insert_payload.get("entity_id"),
                self._insert_payload.get("episode_type"),
                md.get("idempotency_key"),
            )
            self.parent._seen.add(key)
            self.parent._rows.append(self._insert_payload)
            return _Result([{"id": "new"}])
        return _Result([])


class _FakeSupabase:
    def __init__(self):
        self._seen = set()
        self._rows = []

    def table(self, name: str):
        return _FakeTable(self, name)


class _FakeSession:
    def __init__(self, sink):
        self.sink = sink

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def run(self, query, params):
        self.sink.append((query, params))


class _FakeDriver:
    def __init__(self):
        self.calls = []

    def session(self, database=None):
        return _FakeSession(self.calls)


@pytest.mark.asyncio
async def test_persist_pipeline_record_supabase_is_idempotent():
    svc = GraphitiService.__new__(GraphitiService)
    svc.use_supabase = True
    svc.supabase_client = _FakeSupabase()

    payload = {
        "idempotency_key": "k1",
        "entity_id": "arsenal-fc",
        "run_id": "run-1",
        "phase": "dashboard_scoring",
        "record_type": "pipeline_run",
        "record_id": "arsenal-fc",
        "payload": {"x": 1},
    }
    first = await GraphitiService.persist_pipeline_record_supabase(svc, payload)
    second = await GraphitiService.persist_pipeline_record_supabase(svc, payload)
    assert first["status"] == "inserted"
    assert second["status"] == "existing"


@pytest.mark.asyncio
async def test_persist_pipeline_record_falkordb_uses_merge_with_driver():
    svc = GraphitiService.__new__(GraphitiService)
    svc.driver = _FakeDriver()
    svc.graph_name = "sports_intelligence"
    svc.falkordb_uri = None

    payload = {
        "idempotency_key": "k2",
        "entity_id": "fiba",
        "run_id": "run-2",
        "phase": "dashboard_scoring",
        "record_type": "pipeline_run",
        "record_id": "fiba",
        "payload": {"y": 2},
    }
    result = await GraphitiService.persist_pipeline_record_falkordb(svc, payload)
    assert result["status"] == "merged"
    assert len(svc.driver.calls) == 1


@pytest.mark.asyncio
async def test_persist_pipeline_record_supabase_propagates_write_failure():
    class _BrokenSupabase(_FakeSupabase):
        def table(self, name: str):
            table = super().table(name)
            original_insert = table.insert

            def broken_insert(payload):
                original_insert(payload)
                raise RuntimeError("insert failed")

            table.insert = broken_insert
            return table

    svc = GraphitiService.__new__(GraphitiService)
    svc.use_supabase = True
    svc.supabase_client = _BrokenSupabase()
    payload = {
        "idempotency_key": "k3",
        "entity_id": "entity-1",
        "run_id": "run-3",
        "phase": "dashboard_scoring",
        "record_type": "pipeline_run",
        "record_id": "entity-1",
        "payload": {},
    }
    with pytest.raises(RuntimeError):
        await GraphitiService.persist_pipeline_record_supabase(svc, payload)
