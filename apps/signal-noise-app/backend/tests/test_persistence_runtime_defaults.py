import asyncio
import logging
import sys
from pathlib import Path

import pytest

backend_dir = Path(__file__).parent.parent
app_dir = backend_dir.parent
sys.path.insert(0, str(app_dir))
sys.path.insert(0, str(backend_dir))

import graphiti_service as graphiti_module
from dossier_data_collector import DossierDataCollector


def test_graphiti_service_prefers_service_role_key_for_backend_writes(monkeypatch):
    captured = {}

    class _FakeSupabaseClient:
        pass

    def _fake_create_client(url: str, key: str):
        captured["url"] = url
        captured["key"] = key
        return _FakeSupabaseClient()

    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("NEXT_PUBLIC_SUPABASE_URL", "https://public.supabase.co")
    monkeypatch.setenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-anon")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "server-anon")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-role")
    monkeypatch.setattr(graphiti_module, "SUPABASE_AVAILABLE", True, raising=False)
    monkeypatch.setattr(graphiti_module, "create_client", _fake_create_client, raising=False)

    service = graphiti_module.GraphitiService()

    assert service.use_supabase is True
    assert captured["url"] == "https://example.supabase.co"
    assert captured["key"] == "service-role"


@pytest.mark.asyncio
async def test_get_entity_metadata_missing_record_is_info_not_warning(caplog):
    class _EmptyQueryResult:
        result_set = []

    class _FakeGraph:
        def query(self, _cypher, _params):
            return _EmptyQueryResult()

    class _FakeFalkor:
        def select_graph(self, _database):
            return _FakeGraph()

    collector = DossierDataCollector(falkordb_client=_FakeFalkor())
    collector._falkordb_connected = True

    with caplog.at_level(logging.WARNING):
        result = await collector._get_entity_metadata("arsenal-fc")

    assert result is None
    assert not any(
        "No metadata found for arsenal-fc in FalkorDB" in rec.message for rec in caplog.records
    )
