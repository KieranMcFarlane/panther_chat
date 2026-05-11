#!/usr/bin/env python3
"""
Tests for Graphiti dual-write persistence adapter methods.
"""

import sys
import types
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


class _DossierMonotonicTable:
    def __init__(self, parent):
        self.parent = parent
        self._mode = None
        self._filters = []
        self._payload = None

    def select(self, _columns):
        self._mode = "select"
        return self

    def eq(self, column, value):
        self._filters.append((column, value))
        return self

    def limit(self, _count):
        return self

    def upsert(self, payload, on_conflict=None):
        self._mode = "upsert"
        self._payload = payload
        self.parent.upsert_conflict = on_conflict
        return self

    def execute(self):
        if self._mode == "select":
            return _Result([self.parent.existing_row] if self.parent.existing_row else [])
        if self._mode == "upsert":
            self.parent.upsert_payloads.append(self._payload)
            self.parent.existing_row = self._payload
            return _Result([self._payload])
        return _Result([])


class _DossierMonotonicSupabase:
    def __init__(self, existing_row):
        self.existing_row = existing_row
        self.upsert_payloads = []
        self.upsert_conflict = None

    def table(self, name: str):
        assert name == "entity_dossiers"
        return _DossierMonotonicTable(self)


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
async def test_persist_pipeline_record_supabase_does_not_upsert_entity_dossier_for_question_first_snapshot(monkeypatch):
    svc = GraphitiService.__new__(GraphitiService)
    svc.use_supabase = True
    svc.supabase_client = _FakeSupabase()
    upsert_calls = []

    async def fake_upsert(*args, **kwargs):
        upsert_calls.append((args, kwargs))

    monkeypatch.setattr(
        GraphitiService,
        "_upsert_entity_dossier_from_pipeline_payload",
        fake_upsert,
    )

    await GraphitiService.persist_pipeline_record_supabase(
        svc,
        {
            "idempotency_key": "early-dossier",
            "entity_id": "orlen",
            "run_id": "run-early",
            "phase": "question_first_enrichment",
            "record_type": "question_first_dossier",
            "record_id": "orlen",
            "payload": {
                "entity_name": "Orlen Wisła Płock",
                "entity_type": "CLUB",
                "dossier": {
                    "entity_id": "orlen",
                    "question_first_checkpoint": {"questions_answered": 3},
                },
            },
        },
    )

    assert upsert_calls == []


@pytest.mark.asyncio
async def test_persist_pipeline_record_supabase_upserts_entity_dossier_for_dashboard_publication(monkeypatch):
    svc = GraphitiService.__new__(GraphitiService)
    svc.use_supabase = True
    svc.supabase_client = _FakeSupabase()
    upsert_calls = []

    async def fake_upsert(*args, **kwargs):
        upsert_calls.append((args, kwargs))

    monkeypatch.setattr(
        GraphitiService,
        "_upsert_entity_dossier_from_pipeline_payload",
        fake_upsert,
    )

    await GraphitiService.persist_pipeline_record_supabase(
        svc,
        {
            "idempotency_key": "final-dossier",
            "entity_id": "orlen",
            "run_id": "run-final",
            "phase": "dashboard_scoring",
            "record_type": "pipeline_run",
            "record_id": "orlen",
            "payload": {
                "entity_name": "Orlen Wisła Płock",
                "entity_type": "CLUB",
                "dossier": {
                    "entity_id": "orlen",
                    "question_first_checkpoint": {"questions_answered": 15},
                },
            },
        },
    )

    assert len(upsert_calls) == 1


@pytest.mark.asyncio
async def test_entity_dossier_upsert_does_not_regress_question_first_checkpoint():
    existing = {
        "entity_id": "jason",
        "canonical_entity_id": "jason",
        "dossier_data": {
            "quality_state": "partial",
            "question_first_checkpoint": {
                "questions_answered": 7,
                "last_completed_question_id": "q9_news_signal",
            },
        },
    }
    supabase = _DossierMonotonicSupabase(existing)
    svc = GraphitiService.__new__(GraphitiService)
    svc.supabase_client = supabase

    await GraphitiService._upsert_entity_dossier_from_pipeline_payload(
        svc,
        entity_id="jason",
        run_payload={
            "entity_name": "Jason Whittingham",
            "entity_type": "PERSON",
            "dossier": {
                "entity_id": "jason",
                "entity_name": "Jason Whittingham",
                "entity_type": "PERSON",
                "quality_state": "partial",
                "question_first_checkpoint": {
                    "questions_answered": 2,
                    "last_completed_question_id": "q2_digital_stack",
                },
                "question_first": {
                    "questions_answered": 2,
                    "answers": [
                        {"question_id": "q1_foundation"},
                        {"question_id": "q2_digital_stack"},
                    ],
                },
            },
        },
    )

    assert supabase.upsert_payloads == []


@pytest.mark.asyncio
async def test_entity_dossier_upsert_does_not_replace_checkpoint_with_shell():
    existing = {
        "entity_id": "red-star",
        "canonical_entity_id": "red-star",
        "dossier_data": {
            "quality_state": "partial",
            "publication_status": "published_partial",
            "question_first_checkpoint": {
                "questions_answered": 12,
                "last_completed_question_id": "q12_connections",
            },
        },
    }
    supabase = _DossierMonotonicSupabase(existing)
    svc = GraphitiService.__new__(GraphitiService)
    svc.supabase_client = supabase

    await GraphitiService._upsert_entity_dossier_from_pipeline_payload(
        svc,
        entity_id="red-star",
        run_payload={
            "entity_name": "Red Star Belgrade",
            "entity_type": "CLUB",
            "dossier": {
                "entity_id": "red-star",
                "entity_name": "Red Star Belgrade",
                "entity_type": "CLUB",
                "publish_status": "published",
            },
        },
    )

    assert supabase.upsert_payloads == []


@pytest.mark.asyncio
async def test_entity_dossier_upsert_demotes_weak_published_question_first_payload():
    supabase = _DossierMonotonicSupabase(None)
    svc = GraphitiService.__new__(GraphitiService)
    svc.supabase_client = supabase

    await GraphitiService._upsert_entity_dossier_from_pipeline_payload(
        svc,
        entity_id="gauteng-empty",
        run_payload={
            "entity_name": "Gauteng Empty",
            "entity_type": "PROVINCE",
            "dossier": {
                "entity_id": "gauteng-empty",
                "entity_name": "Gauteng Empty",
                "entity_type": "PROVINCE",
                "publish_status": "published",
                "publication_status": "published",
                "quality_state": "complete",
                "question_first": {
                    "questions_answered": 15,
                    "questions_total": 15,
                    "publish_status": "published",
                    "quality_state": "complete",
                    "discovery_summary": {
                        "graphiti_sales_brief": None,
                        "yellow_panther_fit": None,
                        "outreach_strategy": None,
                    },
                },
                "sections": None,
                "executive_summary": {"summary": ""},
                "strategic_analysis": {"recommended_approach": ""},
            },
        },
    )

    assert len(supabase.upsert_payloads) == 1
    persisted = supabase.upsert_payloads[0]["dossier_data"]
    assert persisted["publish_status"] == "published_partial"
    assert persisted["publication_status"] == "published_partial"
    assert persisted["question_first"]["publish_status"] == "published_partial"


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
async def test_persist_pipeline_record_falkordb_omits_stale_auth_for_local_redis(monkeypatch):
    calls = []

    class _FakeGraph:
        def query(self, query, params):
            calls.append(("query", query, params))

    class _FakeFalkorDB:
        def __init__(self, **kwargs):
            calls.append(("client", kwargs))

        def select_graph(self, graph_name):
            calls.append(("graph", graph_name))
            return _FakeGraph()

    monkeypatch.setitem(
        sys.modules,
        "falkordb",
        types.SimpleNamespace(FalkorDB=_FakeFalkorDB),
    )

    svc = GraphitiService.__new__(GraphitiService)
    svc.driver = None
    svc.graph_name = "sports_intelligence"
    svc.falkordb_uri = "redis://localhost:6379"
    svc.falkordb_user = "stale-cloud-user"
    svc.falkordb_password = "stale-cloud-password"

    payload = {
        "idempotency_key": "k-local",
        "entity_id": "local-club",
        "run_id": "run-local",
        "phase": "dashboard_scoring",
        "record_type": "pipeline_run",
        "record_id": "local-club",
        "payload": {"z": 3},
    }

    result = await GraphitiService.persist_pipeline_record_falkordb(svc, payload)

    assert result["status"] == "merged"
    client_call = calls[0][1]
    assert client_call["host"] == "localhost"
    assert client_call["port"] == 6379
    assert client_call["username"] is None
    assert client_call["password"] is None


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
