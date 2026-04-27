#!/usr/bin/env python3
"""
Tests for BrightData client selection in the API pipeline.
"""

import sys
import types
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

import main
from main import EntityPipelineRequest, run_entity_pipeline


@pytest.fixture(autouse=True)
def isolate_pipeline_env(monkeypatch):
    class _StubClaudeClient:
        def __init__(self, *args, **kwargs):
            pass

    class _StubUniversalDossierGenerator:
        def __init__(self, *args, **kwargs):
            pass

    class _StubGraphitiService:
        def __init__(self, *args, **kwargs):
            pass

        async def initialize(self):
            return None

    class _StubRalphLoop:
        def __init__(self, *args, **kwargs):
            pass

    class _StubDashboardScorer:
        def __init__(self, *args, **kwargs):
            pass

    monkeypatch.setenv("PIPELINE_QUESTION_FIRST_ENABLED", "false")
    monkeypatch.delenv("PIPELINE_QUESTION_FIRST_BACKEND", raising=False)
    monkeypatch.delenv("PIPELINE_PHASE0_MODE", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("PYTHON_PERSISTENCE_BACKEND", raising=False)
    monkeypatch.setitem(
        sys.modules,
        "backend.claude_client",
        types.SimpleNamespace(ClaudeClient=_StubClaudeClient),
    )
    monkeypatch.setitem(
        sys.modules,
        "backend.dossier_generator",
        types.SimpleNamespace(UniversalDossierGenerator=_StubUniversalDossierGenerator),
    )
    monkeypatch.setitem(
        sys.modules,
        "backend.discovery_engine_factory",
        types.SimpleNamespace(create_discovery_engine=lambda **_kwargs: (object(), "stub")),
    )
    monkeypatch.setitem(
        sys.modules,
        "backend.graphiti_service",
        types.SimpleNamespace(GraphitiService=_StubGraphitiService),
    )
    monkeypatch.setitem(
        sys.modules,
        "backend.ralph_loop",
        types.SimpleNamespace(RalphLoop=_StubRalphLoop),
    )
    monkeypatch.setitem(
        sys.modules,
        "backend.dashboard_scorer",
        types.SimpleNamespace(DashboardScorer=_StubDashboardScorer),
    )


def test_pipeline_phase_metadata_client_prefers_local_postgres_when_database_url_is_set(monkeypatch):
    fake_client = object()
    remote_calls = []

    monkeypatch.setenv("DATABASE_URL", "postgresql://localhost/signal_noise_app")
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "anon-key")
    monkeypatch.setattr(main, "create_local_pg_client", lambda: fake_client, raising=False)
    monkeypatch.setattr(
        main,
        "create_client",
        lambda *_args, **_kwargs: remote_calls.append(_args) or object(),
        raising=False,
    )

    assert main.create_pipeline_persistence_client() is fake_client
    assert remote_calls == []


def test_app_uses_lifespan_without_deprecated_event_hooks(monkeypatch):
    events = []

    class _StubGraphitiService:
        def __init__(self, *args, **kwargs):
            events.append("constructed")

        async def initialize(self):
            events.append("initialized")
            return True

        def close(self):
            events.append("closed")

    monkeypatch.setitem(
        sys.modules,
        "backend.graphiti_service",
        types.SimpleNamespace(GraphitiService=_StubGraphitiService),
    )
    monkeypatch.setattr(main, "graphiti_service", None, raising=False)

    assert main.app.router.on_startup == []
    assert main.app.router.on_shutdown == []

    with TestClient(main.app):
        assert events == ["constructed", "initialized"]
        assert isinstance(main.graphiti_service, _StubGraphitiService)

    assert events == ["constructed", "initialized", "closed"]


@pytest.mark.asyncio
async def test_generate_dossier_prefers_shared_persistence_client_for_local_postgres(monkeypatch):
    writes = []

    class _FakeExecuteResult:
        def __init__(self, data=None):
            self.data = data or []

    class _FakeTable:
        def __init__(self, name):
            self.name = name
            self._mode = "select"

        def select(self, *_args, **_kwargs):
            self._mode = "select"
            return self

        def eq(self, *_args, **_kwargs):
            return self

        def order(self, *_args, **_kwargs):
            return self

        def limit(self, *_args, **_kwargs):
            return self

        def update(self, payload):
            self._mode = "update"
            writes.append(("update", self.name, payload))
            return self

        def insert(self, payload):
            self._mode = "insert"
            writes.append(("insert", self.name, payload))
            return self

        def execute(self):
            if self._mode == "select":
                return _FakeExecuteResult([])
            return _FakeExecuteResult([{"id": "persisted-row"}])

    class _FakePersistenceClient:
        def table(self, name):
            return _FakeTable(name)

    class _StubClaudeClient:
        def __init__(self, *args, **kwargs):
            pass

    class _StubGenerator:
        def __init__(self, *args, **kwargs):
            pass

        async def generate_universal_dossier(self, **_kwargs):
            return {
                "metadata": {
                    "hypothesis_count": 1,
                    "signal_count": 1,
                    "generation_time_seconds": 0,
                    "source_count": 0,
                },
                "summary": "generated",
            }

    def _supabase_should_not_be_used(*_args, **_kwargs):  # pragma: no cover - red assertion
        raise AssertionError("generate_dossier should use create_pipeline_persistence_client()")

    monkeypatch.setenv("DATABASE_URL", "postgresql://localhost/signal_noise_app")
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("NEXT_PUBLIC_SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_ANON_KEY", raising=False)
    monkeypatch.delenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", raising=False)
    monkeypatch.setattr(main, "create_pipeline_persistence_client", lambda: _FakePersistenceClient(), raising=False)
    monkeypatch.setattr(main, "create_client", _supabase_should_not_be_used, raising=False)
    monkeypatch.setitem(
        sys.modules,
        "backend.claude_client",
        types.SimpleNamespace(ClaudeClient=_StubClaudeClient, LLMRequestError=RuntimeError),
    )
    monkeypatch.setitem(
        sys.modules,
        "backend.dossier_generator",
        types.SimpleNamespace(UniversalDossierGenerator=_StubGenerator),
    )

    response = await main.generate_dossier(
        main.DossierRequest(
            entity_id="arsenal-fc",
            entity_name="Arsenal FC",
            entity_type="CLUB",
            priority_score=85,
        )
    )

    assert response.cache_status == "FRESH"
    assert writes
    assert writes[0][0] == "insert"
    assert writes[0][1] == "entity_dossiers"


@pytest.mark.asyncio
async def test_health_check_reports_generic_persistence_readiness_fields(monkeypatch):
    class _StubGraphitiService:
        persist_pipeline_record_falkordb = staticmethod(lambda *_args, **_kwargs: None)
        persist_pipeline_record_storage = staticmethod(lambda *_args, **_kwargs: None)
        persistence_client = object()
        driver = object()

    monkeypatch.setattr(main, "graphiti_service", _StubGraphitiService(), raising=False)
    monkeypatch.setenv("FALKORDB_URI", "redis://localhost:6379")
    monkeypatch.setitem(sys.modules, "falkordb", types.SimpleNamespace())

    payload = await main.health_check()
    readiness = payload["services"]["dual_write_adapter_readiness"]

    assert "supabase_adapter" not in readiness
    assert "supabase_client_ready" not in readiness
    assert readiness["persistence_adapter"] is True
    assert readiness["persistence_client_ready"] is True
    assert readiness["falkordb_adapter"] is True
    assert readiness["falkordb_transport_ready"] is True


@pytest.mark.asyncio
async def test_run_entity_pipeline_phase_updates_do_not_treat_slug_canonical_entity_id_as_uuid(monkeypatch):
    captured_filters = []

    class _FakeTable:
        def select(self, *_args, **_kwargs):
            return self

        def update(self, *_args, **_kwargs):
            return self

        def eq(self, field, value):
            captured_filters.append((field, value))
            if field == "canonical_entity_id" and value == "arsenal-fc":
                raise AssertionError("slug canonical_entity_id should not be used as a UUID filter")
            return self

        def limit(self, *_args, **_kwargs):
            return self

        def execute(self):
            return types.SimpleNamespace(data=[{"metadata": {}}])

    class _FakePersistenceClient:
        def table(self, _name):
            return _FakeTable()

    monkeypatch.setenv("PIPELINE_QUESTION_FIRST_ENABLED", "true")
    monkeypatch.delenv("PIPELINE_PHASE0_MODE", raising=False)
    monkeypatch.setattr(main, "create_pipeline_persistence_client", lambda: _FakePersistenceClient(), raising=False)

    class _FakeBrightDataClient:
        async def search_engine(self, *args, **kwargs):
            return {"status": "success", "results": []}

        async def scrape_as_markdown(self, *args, **kwargs):
            return {"status": "success", "content": ""}

    monkeypatch.setattr(main, "create_pipeline_brightdata_client", lambda *args, **kwargs: _FakeBrightDataClient(), raising=False)

    orchestrator_module = types.ModuleType("backend.pipeline_orchestrator")

    class _DummyOrchestrator:
        def __init__(self, *args, **kwargs):
            pass

        async def run_entity_pipeline(self, **kwargs):
            phase_callback = kwargs.get("phase_callback")
            if phase_callback is not None:
                await phase_callback("dossier_generation", {"status": "question_first_running"})
            return {
                "entity_id": kwargs.get("entity_id", "unknown"),
                "entity_name": kwargs.get("entity_name", "unknown"),
                "phases": {"dossier_generation": {"status": "question_first_running"}},
                "validated_signal_count": 0,
                "capability_signal_count": 0,
                "rfp_count": 0,
                "sales_readiness": "MONITOR",
                "artifacts": {"dossier": kwargs.get("initial_dossier", {})},
                "completed_at": "2026-03-25T00:00:00+00:00",
            }

    orchestrator_module.PipelineOrchestrator = _DummyOrchestrator
    monkeypatch.setitem(sys.modules, "backend.pipeline_orchestrator", orchestrator_module)

    await run_entity_pipeline(
        EntityPipelineRequest(
            entity_id="arsenal-fc-smoke-20260423",
            entity_name="Arsenal FC",
            entity_type="CLUB",
            priority_score=85,
            batch_id="local-postgres-main-smoke-20260423",
            run_objective="procurement_discovery",
            metadata={"canonical_entity_id": "arsenal-fc"},
        )
    )

    assert ("entity_id", "arsenal-fc-smoke-20260423") in captured_filters


@pytest.mark.asyncio
async def test_run_entity_pipeline_creates_missing_run_record_for_direct_api_batch(monkeypatch):
    inserted_rows = []
    updated_rows = []

    class _FakeTable:
        def __init__(self, name):
            self.name = name
            self._mode = "select"

        def select(self, *_args, **_kwargs):
            self._mode = "select"
            return self

        def insert(self, payload):
            self._mode = "insert"
            inserted_rows.append((self.name, payload))
            return self

        def update(self, payload):
            self._mode = "update"
            updated_rows.append((self.name, payload))
            return self

        def eq(self, *_args, **_kwargs):
            return self

        def limit(self, *_args, **_kwargs):
            return self

        def execute(self):
            if self._mode == "select":
                return types.SimpleNamespace(data=[])
            return types.SimpleNamespace(data=[{"id": "run-row"}])

    class _FakePersistenceClient:
        def table(self, name):
            return _FakeTable(name)

    monkeypatch.setenv("PIPELINE_QUESTION_FIRST_ENABLED", "true")
    monkeypatch.delenv("PIPELINE_PHASE0_MODE", raising=False)
    monkeypatch.setattr(main, "create_pipeline_persistence_client", lambda: _FakePersistenceClient(), raising=False)

    class _FakeBrightDataClient:
        async def search_engine(self, *args, **kwargs):
            return {"status": "success", "results": []}

        async def scrape_as_markdown(self, *args, **kwargs):
            return {"status": "success", "content": ""}

    monkeypatch.setattr(main, "create_pipeline_brightdata_client", lambda *args, **kwargs: _FakeBrightDataClient(), raising=False)

    orchestrator_module = types.ModuleType("backend.pipeline_orchestrator")

    class _DummyOrchestrator:
        def __init__(self, *args, **kwargs):
            pass

        async def run_entity_pipeline(self, **kwargs):
            phase_callback = kwargs.get("phase_callback")
            if phase_callback is not None:
                await phase_callback("dossier_generation", {"status": "question_first_running"})
            return {
                "entity_id": kwargs.get("entity_id", "unknown"),
                "entity_name": kwargs.get("entity_name", "unknown"),
                "phases": {"dossier_generation": {"status": "completed"}},
                "validated_signal_count": 0,
                "capability_signal_count": 0,
                "rfp_count": 0,
                "sales_readiness": "MONITOR",
                "artifacts": {"dossier": kwargs.get("initial_dossier", {})},
                "completed_at": "2026-03-25T00:00:00+00:00",
            }

    orchestrator_module.PipelineOrchestrator = _DummyOrchestrator
    monkeypatch.setitem(sys.modules, "backend.pipeline_orchestrator", orchestrator_module)

    await run_entity_pipeline(
        EntityPipelineRequest(
            entity_id="arsenal-fc-smoke-create",
            entity_name="Arsenal FC",
            entity_type="CLUB",
            priority_score=85,
            batch_id="local-postgres-direct-api-create",
            run_objective="procurement_discovery",
            metadata={"canonical_entity_id": "arsenal-fc"},
        )
    )

    assert inserted_rows
    assert inserted_rows[0][0] == "entity_pipeline_runs"
    inserted_payload = inserted_rows[0][1]
    if isinstance(inserted_payload, list):
        inserted_payload = inserted_payload[0]
    assert inserted_payload["batch_id"] == "local-postgres-direct-api-create"
    assert inserted_payload["entity_id"] == "arsenal-fc-smoke-create"
    assert updated_rows


@pytest.mark.asyncio
async def test_run_entity_pipeline_uses_pipeline_brightdata_factory(monkeypatch):
    monkeypatch.setenv("BRIGHTDATA_API_TOKEN", "test-token")
    monkeypatch.setenv("BRIGHTDATA_FASTMCP_URL", "http://127.0.0.1:8000/mcp")
    monkeypatch.setenv("PIPELINE_USE_BRIGHTDATA_FASTMCP", "true")
    monkeypatch.setenv("PIPELINE_BRIGHTDATA_SHARED_CLIENT", "true")

    class _FakeBrightDataClient:
        def __init__(self):
            self.used = True

        async def search_engine(self, *args, **kwargs):
            return {"status": "success", "results": []}

        async def scrape_as_markdown(self, *args, **kwargs):
            return {"status": "success", "content": ""}

    fake_client = _FakeBrightDataClient()
    factory_calls = []

    def _fake_factory(*args, **kwargs):
        factory_calls.append((args, kwargs))
        return fake_client

    monkeypatch.setattr(main, "create_pipeline_brightdata_client", _fake_factory, raising=False)

    def _sdk_should_not_be_used(*_args, **_kwargs):  # pragma: no cover - should never be called
        raise AssertionError("run_entity_pipeline should use create_pipeline_brightdata_client()")

    sdk_module = types.SimpleNamespace(BrightDataSDKClient=_sdk_should_not_be_used)
    monkeypatch.setitem(sys.modules, "backend.brightdata_sdk_client", sdk_module)

    baseline_module = types.ModuleType("backend.baseline_monitoring")

    class _DummyRunner:  # pragma: no cover - runtime stub for import only
        def __init__(self, *args, **kwargs):
            pass

    baseline_module.BaselineMonitoringRunner = _DummyRunner
    baseline_module.build_compact_candidate_validator = lambda *_args, **_kwargs: (lambda *_a, **_k: [])
    monkeypatch.setitem(sys.modules, "backend.baseline_monitoring", baseline_module)

    graphiti_module = types.ModuleType("backend.graphiti_service")

    class _DummyGraphitiService:  # pragma: no cover
        def __init__(self, *args, **kwargs):
            pass

        async def initialize(self):
            return None

    graphiti_module.GraphitiService = _DummyGraphitiService
    monkeypatch.setitem(sys.modules, "backend.graphiti_service", graphiti_module)

    discovery_module = types.ModuleType("backend.hypothesis_driven_discovery")
    discovery_module.HypothesisDrivenDiscovery = type(
        "HypothesisDrivenDiscovery",
        (),
        {"__init__": lambda self, *args, **kwargs: None},
    )
    monkeypatch.setitem(sys.modules, "backend.hypothesis_driven_discovery", discovery_module)

    ralph_module = types.ModuleType("backend.ralph_loop")
    ralph_module.RalphLoop = type("RalphLoop", (), {"__init__": lambda self, *args, **kwargs: None})
    monkeypatch.setitem(sys.modules, "backend.ralph_loop", ralph_module)

    scorer_module = types.ModuleType("backend.dashboard_scorer")
    scorer_module.DashboardScorer = type("DashboardScorer", (), {"__init__": lambda self, *args, **kwargs: None})
    monkeypatch.setitem(sys.modules, "backend.dashboard_scorer", scorer_module)

    orchestrator_module = types.ModuleType("backend.pipeline_orchestrator")

    class _DummyOrchestrator:  # pragma: no cover - runtime stub for test isolation
        def __init__(self, *args, **kwargs):
            pass

        async def run_entity_pipeline(self, **kwargs):
            return {
                "entity_id": kwargs.get("entity_id", "unknown"),
                "entity_name": kwargs.get("entity_name", "unknown"),
                "phases": {"dossier_generation": {"status": "completed"}},
                "validated_signal_count": 0,
                "capability_signal_count": 0,
                "rfp_count": 0,
                "sales_readiness": "MONITOR",
                "artifacts": {"dossier": kwargs.get("initial_dossier", {})},
                "completed_at": "2026-03-25T00:00:00+00:00",
            }

    orchestrator_module.PipelineOrchestrator = _DummyOrchestrator
    monkeypatch.setitem(sys.modules, "backend.pipeline_orchestrator", orchestrator_module)

    async def _fake_generate_dossier(*_args, **_kwargs):
        return types.SimpleNamespace(
            metadata={
                "hypothesis_count": 0,
                "signal_count": 0,
                "generation_time_seconds": 0,
                "tier": "STANDARD",
                "source_count": 0,
                "sources_used": [],
                "source_timings": {},
                "canonical_sources": {},
                "generation_mode": "test",
                "collection_timed_out": False,
                "model_max_tokens": 0,
                "inference_runtime": {},
            },
            dossier_data={"metadata": {}},
        )

    monkeypatch.setattr(main, "generate_dossier", _fake_generate_dossier)

    result = await run_entity_pipeline(
        EntityPipelineRequest(
            entity_id="icf",
            entity_name="International Canoe Federation",
            entity_type="FEDERATION",
            priority_score=85,
        )
    )

    assert factory_calls, "Expected run_entity_pipeline to call create_pipeline_brightdata_client()"
    assert result.phases["dossier_generation"]["status"] == "completed"


@pytest.mark.asyncio
async def test_run_entity_pipeline_passes_canonical_entity_id_into_dossier_request(monkeypatch):
    captured_request = {}

    monkeypatch.setenv("BRIGHTDATA_API_TOKEN", "test-token")
    monkeypatch.setenv("PIPELINE_PHASE0_MODE", "legacy_python")

    class _FakeBrightDataClient:
        async def search_engine(self, *args, **kwargs):
            return {"status": "success", "results": []}

        async def scrape_as_markdown(self, *args, **kwargs):
            return {"status": "success", "content": ""}

    monkeypatch.setattr(main, "create_pipeline_brightdata_client", lambda *args, **kwargs: _FakeBrightDataClient(), raising=False)

    orchestrator_module = types.ModuleType("backend.pipeline_orchestrator")

    class _DummyOrchestrator:
        def __init__(self, *args, **kwargs):
            pass

        async def run_entity_pipeline(self, **kwargs):
            return {
                "entity_id": kwargs.get("entity_id", "unknown"),
                "entity_name": kwargs.get("entity_name", "unknown"),
                "phases": {"dossier_generation": {"status": "completed"}},
                "validated_signal_count": 0,
                "capability_signal_count": 0,
                "rfp_count": 0,
                "sales_readiness": "MONITOR",
                "artifacts": {"dossier": kwargs.get("initial_dossier", {})},
                "completed_at": "2026-03-25T00:00:00+00:00",
            }

    orchestrator_module.PipelineOrchestrator = _DummyOrchestrator
    monkeypatch.setitem(sys.modules, "backend.pipeline_orchestrator", orchestrator_module)

    async def _fake_generate_dossier(request):
        captured_request["canonical_entity_id"] = getattr(request, "canonical_entity_id", None)
        captured_request["metadata"] = getattr(request, "metadata", None)
        return types.SimpleNamespace(
            metadata={
                "hypothesis_count": 0,
                "signal_count": 0,
                "generation_time_seconds": 0,
                "tier": "STANDARD",
                "source_count": 0,
                "sources_used": [],
                "source_timings": {},
                "canonical_sources": {},
                "generation_mode": "test",
                "collection_timed_out": False,
                "model_max_tokens": 0,
                "inference_runtime": {},
            },
            dossier_data={"metadata": {}},
        )

    monkeypatch.setattr(main, "generate_dossier", _fake_generate_dossier)

    await run_entity_pipeline(
        EntityPipelineRequest(
            entity_id="fc-porto-2027",
            canonical_entity_id="fc-porto-canonical",
            entity_name="FC Porto",
            entity_type="CLUB",
            priority_score=85,
            metadata={"canonical_entity_id": "fc-porto-canonical", "rerun_mode": "full"},
        )
    )

    assert captured_request["canonical_entity_id"] == "fc-porto-canonical"
    assert captured_request["metadata"]["canonical_entity_id"] == "fc-porto-canonical"


@pytest.mark.asyncio
async def test_run_entity_pipeline_uses_leadership_enrichment_for_phase0_when_question_first_enabled(monkeypatch):
    captured_request = {}

    monkeypatch.setenv("PIPELINE_QUESTION_FIRST_ENABLED", "true")
    monkeypatch.setenv("PIPELINE_PHASE0_MODE", "legacy_python")
    monkeypatch.delenv("PIPELINE_DOSSIER_OBJECTIVE", raising=False)

    class _FakeBrightDataClient:
        async def search_engine(self, *args, **kwargs):
            return {"status": "success", "results": []}

        async def scrape_as_markdown(self, *args, **kwargs):
            return {"status": "success", "content": ""}

    monkeypatch.setattr(main, "create_pipeline_brightdata_client", lambda *args, **kwargs: _FakeBrightDataClient(), raising=False)

    orchestrator_module = types.ModuleType("backend.pipeline_orchestrator")

    class _DummyOrchestrator:
        def __init__(self, *args, **kwargs):
            pass

        async def run_entity_pipeline(self, **kwargs):
            return {
                "entity_id": kwargs.get("entity_id", "unknown"),
                "entity_name": kwargs.get("entity_name", "unknown"),
                "phases": {"dossier_generation": {"status": "completed"}},
                "validated_signal_count": 0,
                "capability_signal_count": 0,
                "rfp_count": 0,
                "sales_readiness": "MONITOR",
                "artifacts": {"dossier": kwargs.get("initial_dossier", {})},
                "completed_at": "2026-03-25T00:00:00+00:00",
            }

    orchestrator_module.PipelineOrchestrator = _DummyOrchestrator
    monkeypatch.setitem(sys.modules, "backend.pipeline_orchestrator", orchestrator_module)

    async def _fake_generate_dossier(request):
        captured_request["run_objective"] = getattr(request, "run_objective", None)
        return types.SimpleNamespace(
            metadata={
                "hypothesis_count": 0,
                "signal_count": 0,
                "generation_time_seconds": 0,
                "tier": "STANDARD",
                "source_count": 0,
                "sources_used": [],
                "source_timings": {},
                "canonical_sources": {},
                "generation_mode": "test",
                "collection_timed_out": False,
                "model_max_tokens": 0,
                "inference_runtime": {},
            },
            dossier_data={"metadata": {}},
        )

    monkeypatch.setattr(main, "generate_dossier", _fake_generate_dossier)

    await run_entity_pipeline(
        EntityPipelineRequest(
            entity_id="arsenal",
            entity_name="Arsenal",
            entity_type="CLUB",
            priority_score=90,
            run_objective="dossier_core",
        )
    )

    assert captured_request["run_objective"] == "leadership_enrichment"


@pytest.mark.asyncio
async def test_run_entity_pipeline_skips_python_phase0_and_enters_orchestrator_with_no_initial_dossier_when_opencode_first(monkeypatch):
    generate_dossier_called = False
    captured_kwargs = {}
    emitted_updates = []

    monkeypatch.setenv("PIPELINE_QUESTION_FIRST_ENABLED", "true")
    monkeypatch.delenv("PIPELINE_PHASE0_MODE", raising=False)

    class _FakeBrightDataClient:
        async def search_engine(self, *args, **kwargs):
            return {"status": "success", "results": []}

        async def scrape_as_markdown(self, *args, **kwargs):
            return {"status": "success", "content": ""}

    monkeypatch.setattr(main, "create_pipeline_brightdata_client", lambda *args, **kwargs: _FakeBrightDataClient(), raising=False)

    orchestrator_module = types.ModuleType("backend.pipeline_orchestrator")

    class _DummyOrchestrator:
        def __init__(self, *args, **kwargs):
            pass

        async def run_entity_pipeline(self, **kwargs):
            captured_kwargs.update(kwargs)
            phase_callback = kwargs.get("phase_callback")
            if phase_callback is not None:
                await phase_callback(
                    "dossier_generation",
                    {
                        "status": "question_first_running",
                        "question_first_backend": "opencode",
                        "phase0_mode": "opencode_first",
                        "opencode_model": "zai-coding-plan/glm-5.1",
                        "opencode_provider": "z.ai",
                        "brightdata_transport": "stdio",
                    },
                )
            return {
                "entity_id": kwargs.get("entity_id", "unknown"),
                "entity_name": kwargs.get("entity_name", "unknown"),
                "phases": {"dossier_generation": {"status": "question_first_running"}},
                "validated_signal_count": 0,
                "capability_signal_count": 0,
                "rfp_count": 0,
                "sales_readiness": "MONITOR",
                "artifacts": {"dossier": kwargs.get("initial_dossier", {})},
                "completed_at": "2026-03-25T00:00:00+00:00",
            }

    orchestrator_module.PipelineOrchestrator = _DummyOrchestrator
    monkeypatch.setitem(sys.modules, "backend.pipeline_orchestrator", orchestrator_module)

    async def _fake_generate_dossier(*_args, **_kwargs):
        nonlocal generate_dossier_called
        generate_dossier_called = True
        raise AssertionError("generate_dossier should be skipped in opencode_first mode")

    monkeypatch.setattr(main, "generate_dossier", _fake_generate_dossier)

    class _FakeTable:
        def update(self, payload):
            emitted_updates.append(payload)
            return self

        def eq(self, *_args, **_kwargs):
            return self

        def execute(self):
            return None

    class _FakeSupabase:
        def table(self, _name):
            return _FakeTable()

    monkeypatch.setattr(main, "create_client", lambda *_args, **_kwargs: _FakeSupabase(), raising=False)
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "anon-key")

    await run_entity_pipeline(
        EntityPipelineRequest(
            entity_id="bundesliga",
            entity_name="Bundesliga",
            entity_type="LEAGUE",
            priority_score=92,
            batch_id="import_test_opencode_first",
            run_objective="procurement_discovery",
            metadata={"preset": "bundesliga-atomic-matrix"},
        )
    )

    assert generate_dossier_called is False
    assert captured_kwargs["initial_dossier"] is None
    assert emitted_updates
    assert any(update.get("metadata", {}).get("phase0_mode") == "opencode_first" for update in emitted_updates)
    assert any(update.get("metadata", {}).get("question_first_backend") == "opencode" for update in emitted_updates)


@pytest.mark.asyncio
async def test_run_entity_pipeline_does_not_construct_legacy_claude_for_opencode_first(monkeypatch):
    captured_kwargs = {}

    monkeypatch.setenv("PIPELINE_QUESTION_FIRST_ENABLED", "true")
    monkeypatch.delenv("PIPELINE_PHASE0_MODE", raising=False)
    monkeypatch.setenv("PIPELINE_DISABLE_LEGACY_CLAUDE_FOR_OPENCODE", "true")

    class _FakeBrightDataClient:
        async def search_engine(self, *args, **kwargs):
            return {"status": "success", "results": []}

        async def scrape_as_markdown(self, *args, **kwargs):
            return {"status": "success", "content": ""}

    monkeypatch.setattr(main, "create_pipeline_brightdata_client", lambda *args, **kwargs: _FakeBrightDataClient(), raising=False)

    def _legacy_claude_should_not_be_constructed(*_args, **_kwargs):
        raise AssertionError("ClaudeClient should not be constructed for opencode_first runs")

    monkeypatch.setitem(
        sys.modules,
        "backend.claude_client",
        types.SimpleNamespace(ClaudeClient=_legacy_claude_should_not_be_constructed),
    )

    orchestrator_module = types.ModuleType("backend.pipeline_orchestrator")

    class _DummyOrchestrator:
        def __init__(self, *args, **kwargs):
            captured_kwargs["ctor"] = kwargs

        async def run_entity_pipeline(self, **kwargs):
            captured_kwargs["run"] = kwargs
            return {
                "entity_id": kwargs.get("entity_id", "unknown"),
                "entity_name": kwargs.get("entity_name", "unknown"),
                "phases": {"dossier_generation": {"status": "question_first_running"}},
                "validated_signal_count": 0,
                "capability_signal_count": 0,
                "rfp_count": 0,
                "sales_readiness": "MONITOR",
                "artifacts": {"dossier": kwargs.get("initial_dossier", {})},
                "completed_at": "2026-03-25T00:00:00+00:00",
            }

    orchestrator_module.PipelineOrchestrator = _DummyOrchestrator
    monkeypatch.setitem(sys.modules, "backend.pipeline_orchestrator", orchestrator_module)

    await run_entity_pipeline(
        EntityPipelineRequest(
            entity_id="livescore",
            entity_name="LiveScore Group (media)",
            entity_type="MEDIA",
            priority_score=88,
            run_objective="procurement_discovery",
            metadata={"preset": "media-atomic-matrix"},
        )
    )

    assert getattr(captured_kwargs["ctor"]["claude_client"], "provider", None) == "disabled_legacy"
    assert getattr(captured_kwargs["ctor"]["claude_client"], "_get_disabled_reason")() == "legacy_llm_disabled_for_opencode"


@pytest.mark.asyncio
async def test_run_entity_pipeline_emits_phase_boundary_logs(monkeypatch, caplog):
    monkeypatch.setenv("BRIGHTDATA_API_TOKEN", "test-token")
    monkeypatch.setenv("BRIGHTDATA_FASTMCP_URL", "http://127.0.0.1:8000/mcp")
    monkeypatch.setenv("PIPELINE_USE_BRIGHTDATA_FASTMCP", "true")
    monkeypatch.setenv("PIPELINE_PHASE0_MODE", "legacy_python")

    class _FakeBrightDataClient:
        async def search_engine(self, *args, **kwargs):
            return {"status": "success", "results": []}

        async def scrape_as_markdown(self, *args, **kwargs):
            return {"status": "success", "content": ""}

    def _fake_factory(*args, **kwargs):
        return _FakeBrightDataClient()

    monkeypatch.setattr(main, "create_pipeline_brightdata_client", _fake_factory, raising=False)

    baseline_module = types.ModuleType("backend.baseline_monitoring")

    class _DummyRunner:  # pragma: no cover - runtime stub for import only
        def __init__(self, *args, **kwargs):
            pass

    baseline_module.BaselineMonitoringRunner = _DummyRunner
    baseline_module.build_compact_candidate_validator = lambda *_args, **_kwargs: (lambda *_a, **_k: [])
    monkeypatch.setitem(sys.modules, "backend.baseline_monitoring", baseline_module)

    graphiti_module = types.ModuleType("backend.graphiti_service")

    class _DummyGraphitiService:  # pragma: no cover
        def __init__(self, *args, **kwargs):
            pass

        async def initialize(self):
            return None

    graphiti_module.GraphitiService = _DummyGraphitiService
    monkeypatch.setitem(sys.modules, "backend.graphiti_service", graphiti_module)

    discovery_module = types.ModuleType("backend.hypothesis_driven_discovery")
    discovery_module.HypothesisDrivenDiscovery = type(
        "HypothesisDrivenDiscovery",
        (),
        {"__init__": lambda self, *args, **kwargs: None},
    )
    monkeypatch.setitem(sys.modules, "backend.hypothesis_driven_discovery", discovery_module)

    ralph_module = types.ModuleType("backend.ralph_loop")
    ralph_module.RalphLoop = type("RalphLoop", (), {"__init__": lambda self, *args, **kwargs: None})
    monkeypatch.setitem(sys.modules, "backend.ralph_loop", ralph_module)

    scorer_module = types.ModuleType("backend.dashboard_scorer")
    scorer_module.DashboardScorer = type("DashboardScorer", (), {"__init__": lambda self, *args, **kwargs: None})
    monkeypatch.setitem(sys.modules, "backend.dashboard_scorer", scorer_module)

    orchestrator_module = types.ModuleType("backend.pipeline_orchestrator")

    class _DummyOrchestrator:  # pragma: no cover - runtime stub for test isolation
        def __init__(self, *args, **kwargs):
            pass

        async def run_entity_pipeline(self, **kwargs):
            return {
                "entity_id": kwargs.get("entity_id", "unknown"),
                "entity_name": kwargs.get("entity_name", "unknown"),
                "phases": {"dossier_generation": {"status": "completed"}},
                "validated_signal_count": 0,
                "capability_signal_count": 0,
                "rfp_count": 0,
                "sales_readiness": "MONITOR",
                "artifacts": {"dossier": kwargs.get("initial_dossier", {})},
                "completed_at": "2026-03-25T00:00:00+00:00",
            }

    orchestrator_module.PipelineOrchestrator = _DummyOrchestrator
    monkeypatch.setitem(sys.modules, "backend.pipeline_orchestrator", orchestrator_module)

    async def _fake_generate_dossier(*_args, **_kwargs):
        return types.SimpleNamespace(
            metadata={
                "hypothesis_count": 0,
                "signal_count": 0,
                "generation_time_seconds": 0,
                "tier": "STANDARD",
                "source_count": 0,
                "sources_used": [],
                "source_timings": {},
                "canonical_sources": {},
                "generation_mode": "test",
                "collection_timed_out": False,
                "model_max_tokens": 0,
                "inference_runtime": {},
            },
            dossier_data={"metadata": {}},
        )

    monkeypatch.setattr(main, "generate_dossier", _fake_generate_dossier)

    caplog.set_level("INFO")
    await run_entity_pipeline(
        EntityPipelineRequest(
            entity_id="icf",
            entity_name="International Canoe Federation",
            entity_type="FEDERATION",
            priority_score=85,
        )
    )

    messages = [record.message for record in caplog.records]
    assert any("Pipeline boundary: pipeline_execute:start" in message for message in messages)
    assert any("Pipeline boundary: dossier_phase_runtime_init:start" in message for message in messages)
    assert any("Pipeline boundary: dossier_generation_call:start" in message for message in messages)
    assert any("Pipeline boundary: dossier_generation_call:complete" in message for message in messages)
    assert any("Pipeline boundary: dossier_response_received" in message for message in messages)
    assert any("Pipeline boundary: dossier_post_runtime_init:start" in message for message in messages)
    assert any("Pipeline boundary: dossier_post_runtime_init:complete" in message for message in messages)
    assert any("Pipeline boundary: graphiti_initialize:start" in message for message in messages)
    assert any("Pipeline boundary: orchestrator_run:complete" in message for message in messages)
