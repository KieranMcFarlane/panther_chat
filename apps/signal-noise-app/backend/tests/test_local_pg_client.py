from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from local_pg_client import LocalPgClient


def test_claim_next_batch_uses_typed_interval_expression(monkeypatch):
    captured = {}

    class _FakeCursor:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def execute(self, sql, params):
            captured["sql"] = sql
            captured["params"] = params

        def fetchall(self):
            return []

    class _FakeConnection:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def cursor(self):
            return _FakeCursor()

    client = LocalPgClient("postgresql://localhost/signal_noise_app")
    monkeypatch.setattr(client, "_connect", lambda: _FakeConnection())

    client.rpc(
        "claim_next_entity_import_batch",
        {"worker_id": "worker-1", "lease_seconds": 300},
    ).execute()

    assert "make_interval(secs => %s)" in captured["sql"]
    assert "|| ' seconds'" not in captured["sql"]
    assert captured["params"] == ["worker-1", 300]


def test_contains_on_text_array_uses_text_array_rhs(monkeypatch):
    captured = {}

    class _FakeCursor:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def execute(self, sql, params):
            captured["sql"] = sql
            captured["params"] = params

        def fetchall(self):
            return []

    class _FakeConnection:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def cursor(self):
            return _FakeCursor()

    client = LocalPgClient("postgresql://localhost/signal_noise_app")
    monkeypatch.setattr(client, "_connect", lambda: _FakeConnection())

    client.table("canonical_entities").select("*").contains("source_neo4j_ids", ["arsenal-fc"]).execute()

    assert "@> %s::text[]" in captured["sql"]
    assert captured["params"] == [["arsenal-fc"]]
