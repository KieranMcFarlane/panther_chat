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


def test_claim_next_batch_prioritizes_question_first_continuations(monkeypatch):
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

    assert "question_first_timeout_continuation" in captured["sql"]
    assert "ORDER BY" in captured["sql"]
    assert "CASE" in captured["sql"]
    assert captured["sql"].index("CASE") < captured["sql"].index("started_at ASC")


def test_select_next_entity_cursor_candidate_prefers_resumable_work(monkeypatch):
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
            return [{
                "candidate_kind": "resume_repair",
                "entity_id": "entity-b",
                "canonical_entity_id": "entity-b",
                "entity_name": "Entity B",
                "entity_type": "CLUB",
                "question_id": "q11_decision_owner",
                "current_question_id": "q7_procurement_signal",
                "next_repair_question_id": "q11_decision_owner",
            }]

    class _FakeConnection:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def cursor(self):
            return _FakeCursor()

    client = LocalPgClient("postgresql://localhost/signal_noise_app")
    monkeypatch.setattr(client, "_connect", lambda: _FakeConnection())

    response = client.rpc(
        "select_next_entity_cursor_candidate",
        {"current_entity_id": "entity-c", "current_canonical_entity_id": "entity-c"},
    ).execute()

    assert "candidate_kind" in captured["sql"]
    assert "next_repair_question_id" in captured["sql"]
    assert "current_question_id" in captured["sql"]
    assert "'running'" in captured["sql"]
    assert "'retrying'" in captured["sql"]
    assert "'failed'" in captured["sql"]
    assert "'queued'" not in captured["sql"]
    assert captured["params"] == ["entity-c", "entity-c", "entity-c", "entity-c", "entity-c", "entity-c"]
    assert response.data[0]["candidate_kind"] == "resume_repair"
    assert response.data[0]["question_id"] == "q11_decision_owner"


def test_select_next_entity_cursor_candidate_ignores_queued_rows(monkeypatch):
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
            return [{
                "candidate_kind": "next_entity",
                "entity_id": "entity-z",
                "canonical_entity_id": "entity-z",
                "entity_name": "Entity Z",
                "entity_type": "CLUB",
                "question_id": None,
                "current_question_id": None,
                "next_repair_question_id": None,
            }]

    class _FakeConnection:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def cursor(self):
            return _FakeCursor()

    client = LocalPgClient("postgresql://localhost/signal_noise_app")
    monkeypatch.setattr(client, "_connect", lambda: _FakeConnection())

    response = client.rpc(
        "select_next_entity_cursor_candidate",
        {"current_entity_id": "entity-a", "current_canonical_entity_id": "entity-a"},
    ).execute()

    assert "'running'" in captured["sql"]
    assert "'retrying'" in captured["sql"]
    assert "'failed'" in captured["sql"]
    assert "'queued'" not in captured["sql"]
    assert response.data[0]["candidate_kind"] == "next_entity"


def test_select_next_entity_cursor_candidate_accepts_blank_canonical_entity_id(monkeypatch):
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
        "select_next_entity_cursor_candidate",
        {"current_entity_id": "", "current_canonical_entity_id": ""},
    ).execute()

    assert "IS DISTINCT FROM" in captured["sql"]
    assert captured["params"] == ["", None, None, None, None, ""]


def test_select_next_entity_cursor_candidate_ignores_nonblocking_continue_on_failure_rows(monkeypatch):
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
        "select_next_entity_cursor_candidate",
        {"current_entity_id": "", "current_canonical_entity_id": ""},
    ).execute()

    assert "continue_pipeline_on_failure" in captured["sql"]


def test_select_next_entity_cursor_candidate_ignores_infrastructure_failures(monkeypatch):
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
        "select_next_entity_cursor_candidate",
        {"current_entity_id": "", "current_canonical_entity_id": ""},
    ).execute()

    assert "infrastructure_failure" in captured["sql"]
    assert "failure_class" in captured["sql"]


def test_select_next_entity_cursor_candidate_only_considers_latest_run_per_entity(monkeypatch):
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
        "select_next_entity_cursor_candidate",
        {"current_entity_id": "", "current_canonical_entity_id": ""},
    ).execute()

    assert "row_number()" in captured["sql"].lower()


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


def test_range_adds_limit_and_offset(monkeypatch):
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

    client.table("canonical_entities").select("id").range(10, 19).execute()

    assert "LIMIT %s OFFSET %s" in captured["sql"]
    assert captured["params"] == [10, 10]
