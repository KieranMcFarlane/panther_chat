#!/usr/bin/env python3
"""
Tests for BrightData client selection in the API pipeline.
"""

import sys
import types
from pathlib import Path

import pytest

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

import main
from main import EntityPipelineRequest, run_entity_pipeline


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
async def test_run_entity_pipeline_emits_phase_boundary_logs(monkeypatch, caplog):
    monkeypatch.setenv("BRIGHTDATA_API_TOKEN", "test-token")
    monkeypatch.setenv("BRIGHTDATA_FASTMCP_URL", "http://127.0.0.1:8000/mcp")
    monkeypatch.setenv("PIPELINE_USE_BRIGHTDATA_FASTMCP", "true")

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
