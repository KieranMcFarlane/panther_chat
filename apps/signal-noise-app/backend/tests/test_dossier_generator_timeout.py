#!/usr/bin/env python3
"""
Tests for timeout-safe dossier generation behavior in phase 0.
"""

import asyncio
import json
import sys
import types
from pathlib import Path

import pytest

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

import main
from main import EntityPipelineRequest, run_entity_pipeline
from dossier_generator import UniversalDossierGenerator
from fastapi import HTTPException


class _SlowClaudeClient:
    def __init__(self):
        self.calls = 0

    async def query(self, **_kwargs):
        self.calls += 1
        await asyncio.sleep(0.1)
        return {
            "content": '{"metadata": {"entity_id":"icf", "generated_at":"2026-01-01T00:00:00+00:00", "confidence_overall": 0.5, "priority_signals": []}, "executive_summary": {"overall_assessment": {"digital_maturity": {"score": 1, "trend": "up", "key_strengths": [], "key_gaps": []}, "key_strengths": [], "key_gaps": []}, "quick_actions": [], "key_insights": []}}'
        }


class _JsonOnlyClaudeClient:
    def __init__(self):
        self.calls = []

    async def query(self, **kwargs):
        self.calls.append(kwargs)
        if not kwargs.get("json_mode"):
            raise AssertionError("Expected dossier synthesis to use json_mode=True")
        if str(kwargs.get("model", "")).strip().lower() != "json":
            raise AssertionError("Expected dossier synthesis to route through the json model alias")
        return {
            "content": '{"metadata": {"entity_id":"icf", "generated_at":"2026-01-01T00:00:00+00:00", "confidence_overall": 0.8, "priority_signals": []}, "executive_summary": {"overall_assessment": {"digital_maturity": {"score": 70, "trend": "stable", "key_strengths": [], "key_gaps": []}}, "quick_actions": [], "key_insights": []}}'
        }


@pytest.mark.asyncio
async def test_generate_with_model_query_timeout_falls_back_to_minimal_dossier(monkeypatch):
    monkeypatch.setenv("DOSSIER_MODEL_QUERY_TIMEOUT_SECONDS", "0.01")
    monkeypatch.setattr("dossier_generator.random.random", lambda: 0.5)

    claude = _SlowClaudeClient()
    generator = UniversalDossierGenerator(claude)

    result = await generator._generate_with_model_cascade(
        "Ignore context, return a valid JSON object.",
        "International Canoe Federation",
        "STANDARD",
    )

    assert result["metadata"]["confidence_overall"] == 0
    assert result["executive_summary"]["overall_assessment"]["digital_maturity"]["score"] == 0


@pytest.mark.asyncio
async def test_generate_with_model_cascade_uses_json_model_route(monkeypatch):
    monkeypatch.setenv("DOSSIER_MODEL_QUERY_TIMEOUT_SECONDS", "1")
    generator = UniversalDossierGenerator(_JsonOnlyClaudeClient())

    result = await generator._generate_with_model_cascade(
        "Ignore context, return a valid JSON object.",
        "International Canoe Federation",
        "STANDARD",
    )

    assert result["metadata"]["confidence_overall"] == 0.8


@pytest.mark.asyncio
async def test_generate_universal_dossier_emits_post_model_assembly_logs(monkeypatch, caplog):
    monkeypatch.setenv("DOSSIER_MODEL_QUERY_TIMEOUT_SECONDS", "1")
    monkeypatch.setattr("dossier_generator.random.random", lambda: 0.5)
    caplog.set_level("WARNING")

    generator = UniversalDossierGenerator(_JsonOnlyClaudeClient())

    await generator.generate_universal_dossier(
        entity_id="icf",
        entity_name="International Canoe Federation",
        entity_type="FEDERATION",
        priority_score=85,
        entity_data={
            "entity_id": "icf",
            "entity_name": "International Canoe Federation",
            "entity_type": "FEDERATION",
            "sources_used": ["official_website"],
        },
    )

    messages = [record.message for record in caplog.records]
    assert any("Dossier boundary: post_model_processing:start" in message for message in messages)
    assert any("Dossier boundary: post_model_processing:complete" in message for message in messages)


@pytest.mark.asyncio
async def test_run_entity_pipeline_times_out_with_clear_http_error(monkeypatch):
    monkeypatch.setenv("DOSSIER_PHASE0_TIMEOUT_SECONDS", "0.01")
    monkeypatch.setenv("ENTITY_IMPORT_QUEUE_MODE", "in_process")
    monkeypatch.setenv("PIPELINE_PHASE0_TIMEOUT_MODE", "fail")

    # The timeout path is exercised before baseline monitoring logic, but
    # run_entity_pipeline imports this module eagerly. Stub it if absent.
    if "backend.baseline_monitoring" not in sys.modules:
        baseline_module = types.ModuleType("backend.baseline_monitoring")

        class _DummyRunner:  # pragma: no cover - runtime stub for import only
            def __init__(self, *args, **kwargs):
                pass

        baseline_module.BaselineMonitoringRunner = _DummyRunner
        baseline_module.build_compact_candidate_validator = lambda *_args, **_kwargs: (lambda *_a, **_k: [])
        monkeypatch.setitem(sys.modules, "backend.baseline_monitoring", baseline_module)

    async def slow_generate_dossier(*_args, **_kwargs):
        await asyncio.sleep(0.1)
        raise RuntimeError("should not return")

    monkeypatch.setattr("main.generate_dossier", slow_generate_dossier)

    with pytest.raises(HTTPException) as exc_info:
        await run_entity_pipeline(
            EntityPipelineRequest(
                entity_id="icf",
                entity_name="International Canoe Federation",
                entity_type="FEDERATION",
                priority_score=85,
            )
        )

    assert exc_info.value.status_code == 504
    assert "timed out" in str(exc_info.value.detail).lower()


@pytest.mark.asyncio
async def test_run_entity_pipeline_degrades_when_phase0_timeout_mode_is_degraded(monkeypatch):
    monkeypatch.setenv("DOSSIER_PHASE0_TIMEOUT_SECONDS", "0.01")
    monkeypatch.setenv("PIPELINE_PHASE0_TIMEOUT_MODE", "degraded")

    baseline_module = types.ModuleType("backend.baseline_monitoring")

    class _DummyRunner:  # pragma: no cover - runtime stub for import only
        def __init__(self, *args, **kwargs):
            pass

    baseline_module.BaselineMonitoringRunner = _DummyRunner
    baseline_module.build_compact_candidate_validator = lambda *_args, **_kwargs: (lambda *_a, **_k: [])
    monkeypatch.setitem(sys.modules, "backend.baseline_monitoring", baseline_module)

    orchestrator_module = types.ModuleType("backend.pipeline_orchestrator")

    class _DummyOrchestrator:  # pragma: no cover - runtime stub for test isolation
        def __init__(self, *args, **kwargs):
            pass

        async def run_entity_pipeline(self, **kwargs):
            now = "2026-03-15T00:00:00+00:00"
            return {
                "entity_id": kwargs.get("entity_id", "unknown"),
                "entity_name": kwargs.get("entity_name", "unknown"),
                "phases": {"dossier_generation": {"status": "completed"}},
                "validated_signal_count": 0,
                "capability_signal_count": 0,
                "rfp_count": 0,
                "sales_readiness": "MONITOR",
                "artifacts": {"dossier": kwargs.get("initial_dossier", {})},
                "completed_at": now,
            }

    orchestrator_module.PipelineOrchestrator = _DummyOrchestrator
    monkeypatch.setitem(sys.modules, "backend.pipeline_orchestrator", orchestrator_module)

    graphiti_module = types.ModuleType("backend.graphiti_service")

    class _DummyGraphitiService:  # pragma: no cover
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

    if "backend.baseline_monitoring" not in sys.modules:
        baseline_module = types.ModuleType("backend.baseline_monitoring")

        class _DummyRunner:  # pragma: no cover - runtime stub for import only
            def __init__(self, *args, **kwargs):
                pass

        baseline_module.BaselineMonitoringRunner = _DummyRunner
        baseline_module.build_compact_candidate_validator = lambda *_args, **_kwargs: (lambda *_a, **_k: [])
        monkeypatch.setitem(sys.modules, "backend.baseline_monitoring", baseline_module)

    if "backend.pipeline_orchestrator" not in sys.modules:
        orchestrator_module = types.ModuleType("backend.pipeline_orchestrator")

        class _DummyOrchestrator:  # pragma: no cover - runtime stub for test isolation
            def __init__(self, *args, **kwargs):
                pass

            async def run_entity_pipeline(self, **kwargs):
                now = "2026-03-15T00:00:00+00:00"
                return {
                    "entity_id": kwargs.get("entity_id", "unknown"),
                    "entity_name": kwargs.get("entity_name", "unknown"),
                    "phases": {"dossier_generation": {"status": "completed"}},
                    "validated_signal_count": 0,
                    "capability_signal_count": 0,
                    "rfp_count": 0,
                    "sales_readiness": "MONITOR",
                    "artifacts": {"dossier": kwargs.get("initial_dossier", {})},
                    "completed_at": now,
                }

        orchestrator_module.PipelineOrchestrator = _DummyOrchestrator
        monkeypatch.setitem(sys.modules, "backend.pipeline_orchestrator", orchestrator_module)

    if "backend.graphiti_service" not in sys.modules:
        graphiti_module = types.ModuleType("backend.graphiti_service")

        class _DummyGraphitiService:  # pragma: no cover
            async def initialize(self):
                return None

        graphiti_module.GraphitiService = _DummyGraphitiService
        monkeypatch.setitem(sys.modules, "backend.graphiti_service", graphiti_module)

    if "backend.hypothesis_driven_discovery" not in sys.modules:
        discovery_module = types.ModuleType("backend.hypothesis_driven_discovery")
        discovery_module.HypothesisDrivenDiscovery = type(
            "HypothesisDrivenDiscovery",
            (),
            {"__init__": lambda self, *args, **kwargs: None},
        )
        monkeypatch.setitem(sys.modules, "backend.hypothesis_driven_discovery", discovery_module)

    if "backend.ralph_loop" not in sys.modules:
        ralph_module = types.ModuleType("backend.ralph_loop")
        ralph_module.RalphLoop = type("RalphLoop", (), {"__init__": lambda self, *args, **kwargs: None})
        monkeypatch.setitem(sys.modules, "backend.ralph_loop", ralph_module)

    if "backend.dashboard_scorer" not in sys.modules:
        scorer_module = types.ModuleType("backend.dashboard_scorer")
        scorer_module.DashboardScorer = type("DashboardScorer", (), {"__init__": lambda self, *args, **kwargs: None})
        monkeypatch.setitem(sys.modules, "backend.dashboard_scorer", scorer_module)

    async def slow_generate_dossier(*_args, **_kwargs):
        await asyncio.sleep(0.1)
        raise RuntimeError("should not return")

    monkeypatch.setattr("main.generate_dossier", slow_generate_dossier)

    result = await run_entity_pipeline(
        EntityPipelineRequest(
            entity_id="icf-degraded",
            entity_name="International Canoe Federation",
            entity_type="FEDERATION",
            priority_score=85,
        )
    )

    assert result.phases["dossier_generation"]["status"] in {"completed", "failed"}
    assert result.artifacts["dossier"]["metadata"]["generation_mode"] == "timeout_degraded"


@pytest.mark.asyncio
async def test_run_entity_pipeline_bypasses_generate_dossier_for_question_repair(monkeypatch, tmp_path):
    repair_source_path = tmp_path / "fc-porto_question_first_dossier.json"
    repair_source_path.write_text(
        json.dumps(
            {
                "entity_id": "fc-porto-2027",
                "entity_name": "FC Porto",
                "entity_type": "SPORT_CLUB",
                "question_first": {
                    "answers": [{"question_id": "q11_decision_owner", "status": "no_signal"}],
                    "publish_status": "published",
                    "run_id": "fc-porto-base",
                    "quality_state": "blocked",
                },
                "questions": [{"question_id": "q11_decision_owner", "status": "no_signal"}],
            }
        ),
        encoding="utf-8",
    )

    async def fail_generate_dossier(*_args, **_kwargs):
        raise AssertionError("generate_dossier should not run for question repairs")

    monkeypatch.setattr("main.generate_dossier", fail_generate_dossier)

    orchestrator_module = types.ModuleType("backend.pipeline_orchestrator")

    class _DummyOrchestrator:
        def __init__(self, *args, **kwargs):
            pass

        async def run_entity_pipeline(self, **kwargs):
            now = "2026-03-15T00:00:00+00:00"
            return {
                "entity_id": kwargs.get("entity_id", "unknown"),
                "entity_name": kwargs.get("entity_name", "unknown"),
                "phases": {"dossier_generation": {"status": "completed"}},
                "validated_signal_count": 0,
                "capability_signal_count": 0,
                "rfp_count": 0,
                "sales_readiness": "MONITOR",
                "artifacts": {"dossier": kwargs.get("initial_dossier", {})},
                "completed_at": now,
            }

    orchestrator_module.PipelineOrchestrator = _DummyOrchestrator
    monkeypatch.setitem(sys.modules, "backend.pipeline_orchestrator", orchestrator_module)

    graphiti_module = types.ModuleType("backend.graphiti_service")

    class _DummyGraphitiService:
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

    baseline_module = types.ModuleType("backend.baseline_monitoring")
    baseline_module.BaselineMonitoringRunner = type("BaselineMonitoringRunner", (), {"__init__": lambda self, *args, **kwargs: None})
    baseline_module.build_compact_candidate_validator = lambda *_args, **_kwargs: (lambda *_a, **_k: [])
    monkeypatch.setitem(sys.modules, "backend.baseline_monitoring", baseline_module)

    result = await run_entity_pipeline(
        EntityPipelineRequest(
            entity_id="fc-porto-2027",
            entity_name="FC Porto",
            entity_type="SPORT_CLUB",
            priority_score=91,
            metadata={
                "rerun_mode": "question",
                "question_id": "q11_decision_owner",
                "repair_source_dossier_path": str(repair_source_path),
            },
        )
    )

    assert result.artifacts["dossier"]["question_first"]["run_id"] == "fc-porto-base"
    assert result.artifacts["dossier"]["question_first"]["quality_state"] == "blocked"


@pytest.mark.asyncio
async def test_run_entity_pipeline_recovers_question_repair_source_from_artifacts_when_metadata_path_is_missing(monkeypatch, tmp_path):
    repair_root = tmp_path / "question-first-diagnostics" / "fc-porto-2027"
    repair_root.mkdir(parents=True)
    repair_source_path = repair_root / "fc-porto-2027_question_first_dossier.json"
    repair_source_path.write_text(
        json.dumps(
            {
                "entity_id": "fc-porto-2027",
                "entity_name": "FC Porto",
                "entity_type": "SPORT_CLUB",
                "question_first": {
                    "answers": [{"question_id": "q11_decision_owner", "status": "answered"}],
                    "publish_status": "published",
                    "run_id": "fc-porto-recovered",
                    "quality_state": "complete",
                },
                "questions": [{"question_id": "q11_decision_owner", "status": "answered"}],
            }
        ),
        encoding="utf-8",
    )

    monkeypatch.setenv("QUESTION_REPAIR_SOURCE_ROOTS", str(tmp_path))

    async def fail_generate_dossier(*_args, **_kwargs):
        raise AssertionError("generate_dossier should not run when a repair artifact can be recovered")

    monkeypatch.setattr("main.generate_dossier", fail_generate_dossier)

    orchestrator_module = types.ModuleType("backend.pipeline_orchestrator")

    class _DummyOrchestrator:
        def __init__(self, *args, **kwargs):
            pass

        async def run_entity_pipeline(self, **kwargs):
            now = "2026-03-15T00:00:00+00:00"
            return {
                "entity_id": kwargs.get("entity_id", "unknown"),
                "entity_name": kwargs.get("entity_name", "unknown"),
                "phases": {"dossier_generation": {"status": "completed"}},
                "validated_signal_count": 0,
                "capability_signal_count": 0,
                "rfp_count": 0,
                "sales_readiness": "MONITOR",
                "artifacts": {"dossier": kwargs.get("initial_dossier", {})},
                "completed_at": now,
            }

    orchestrator_module.PipelineOrchestrator = _DummyOrchestrator
    monkeypatch.setitem(sys.modules, "backend.pipeline_orchestrator", orchestrator_module)

    graphiti_module = types.ModuleType("backend.graphiti_service")

    class _DummyGraphitiService:
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

    baseline_module = types.ModuleType("backend.baseline_monitoring")
    baseline_module.BaselineMonitoringRunner = type("BaselineMonitoringRunner", (), {"__init__": lambda self, *args, **kwargs: None})
    baseline_module.build_compact_candidate_validator = lambda *_args, **_kwargs: (lambda *_a, **_k: [])
    monkeypatch.setitem(sys.modules, "backend.baseline_monitoring", baseline_module)

    result = await run_entity_pipeline(
        EntityPipelineRequest(
            entity_id="fc-porto-2027",
            entity_name="FC Porto",
            entity_type="SPORT_CLUB",
            priority_score=91,
            metadata={
                "rerun_mode": "question",
                "question_id": "q11_decision_owner",
            },
        )
    )

    assert result.artifacts["dossier"]["question_first"]["run_id"] == "fc-porto-recovered"
    assert result.artifacts["dossier"]["question_first"]["quality_state"] == "complete"


def test_resolve_phase0_timeout_seconds_defaults_to_300(monkeypatch):
    monkeypatch.delenv("DOSSIER_PHASE0_TIMEOUT_SECONDS", raising=False)
    assert main.resolve_phase0_timeout_seconds() == 300.0


def test_resolve_phase0_timeout_seconds_respects_env_override(monkeypatch):
    monkeypatch.setenv("DOSSIER_PHASE0_TIMEOUT_SECONDS", "240")
    assert main.resolve_phase0_timeout_seconds() == 240.0


def test_should_replace_persisted_dossier_rejects_newer_empty_candidate():
    existing = {
        "publish_status": "published_degraded",
        "quality_state": "blocked",
        "questions": [
            {"question_id": "q7_procurement_signal", "terminal_state": "answered"},
            {"question_id": "q13_capability_gap", "terminal_state": "answered"},
            {"question_id": "q14_yp_fit", "terminal_state": "answered"},
        ],
    }
    candidate = {
        "publish_status": "published",
        "questions": [],
    }

    assert main.score_persisted_dossier_candidate(existing) > main.score_persisted_dossier_candidate(candidate)
    assert main.should_replace_persisted_dossier(existing=existing, candidate=candidate) is False


def test_should_replace_persisted_dossier_accepts_better_complete_candidate():
    existing = {
        "publish_status": "published_degraded",
        "quality_state": "blocked",
        "questions": [
            {"question_id": "q7_procurement_signal", "terminal_state": "answered"},
            {"question_id": "q13_capability_gap", "terminal_state": "answered"},
            {"question_id": "q14_yp_fit", "terminal_state": "blocked"},
        ],
    }
    candidate = {
        "publish_status": "published",
        "quality_state": "complete",
        "questions": [
            {"question_id": f"q{i}", "terminal_state": "answered"}
            for i in range(1, 16)
        ],
    }

    assert main.score_persisted_dossier_candidate(candidate) > main.score_persisted_dossier_candidate(existing)
    assert main.should_replace_persisted_dossier(existing=existing, candidate=candidate) is True


def test_build_question_repair_source_dossier_response_synthesizes_q14_from_q13_and_q7(monkeypatch, tmp_path):
    repair_root = tmp_path / "question-first-diagnostics" / "fc-porto-2027"
    repair_root.mkdir(parents=True)
    repair_source_path = repair_root / "fc-porto-2027_question_first_dossier.json"
    repair_source_path.write_text(
        json.dumps(
            {
                "schema_version": "question_first_run_v2",
                "generated_at": "2026-04-10T08:00:00+00:00",
                "entity_id": "fc-porto-2027",
                "entity_name": "FC Porto",
                "entity_type": "SPORT_CLUB",
                "questions": [
                    {
                        "question_id": "q7_procurement_signal",
                        "question_text": "Procurement motion",
                        "question_first_answer": {
                            "question_id": "q7_procurement_signal",
                            "validation_state": "validated",
                            "confidence": 0.92,
                            "answer": {
                                "kind": "summary",
                                "summary": "FC Porto is actively reshaping its digital and commercial ecosystem.",
                                "raw_structured_output": {
                                    "answer": "FC Porto is actively reshaping its digital and commercial ecosystem.",
                                    "summary": "FC Porto is actively reshaping its digital and commercial ecosystem.",
                                    "themes": [
                                        {"theme": "Digital transformation"},
                                        {"theme": "Commercial platform refresh"},
                                    ],
                                    "terminal_state": "answered",
                                    "validation_state": "validated",
                                    "blocked_by": [],
                                    "sources": [],
                                },
                                "terminal_state": "answered",
                                "blocked_by": [],
                            },
                        },
                    },
                    {
                        "question_id": "q13_capability_gap",
                        "question_text": "Capability gap",
                        "question_first_answer": {
                            "question_id": "q13_capability_gap",
                            "validation_state": "provisional",
                            "confidence": 0.6,
                            "answer": {
                                "kind": "summary",
                                "summary": "Capability gaps inferred from digital_stack_maturity, vendor_change_motion",
                                "raw_structured_output": {
                                    "answer": "Capability gaps inferred from digital_stack_maturity, vendor_change_motion",
                                    "summary": "Capability gaps inferred from digital_stack_maturity, vendor_change_motion",
                                    "top_gap": "digital_stack_maturity",
                                    "themes": ["digital_stack_maturity", "vendor_change_motion"],
                                    "gap_scorecard": [
                                        {
                                            "capability": "digital_stack_maturity",
                                            "gap_score": 0.78,
                                            "severity": "high",
                                        }
                                    ],
                                    "recommendations": ["Close digital stack maturity gap"],
                                    "terminal_state": "answered",
                                    "validation_state": "provisional",
                                    "blocked_by": [],
                                    "sources": [],
                                },
                                "terminal_state": "answered",
                                "blocked_by": [],
                            },
                        },
                    },
                    {
                        "question_id": "q14_yp_fit",
                        "question_text": "YP fit",
                        "question_first_answer": {
                            "question_id": "q14_yp_fit",
                            "validation_state": "no_signal",
                            "confidence": 0.0,
                            "answer": {
                                "kind": "summary",
                                "summary": "No capability-gap inference is available yet for YP fit mapping.",
                                "raw_structured_output": {
                                    "answer": "",
                                    "summary": "No capability-gap inference is available yet for YP fit mapping.",
                                    "notes": "No capability-gap inference is available yet for YP fit mapping.",
                                    "context": "No capability-gap inference is available yet for YP fit mapping.",
                                    "terminal_state": "blocked",
                                    "validation_state": "no_signal",
                                    "blocked_by": ["q13_capability_gap", "q7_procurement_signal"],
                                    "sources": [],
                                },
                                "terminal_state": "blocked",
                                "blocked_by": ["q13_capability_gap", "q7_procurement_signal"],
                            },
                        },
                    },
                ],
                "question_first": {
                    "schema_version": "question_first_run_v2",
                    "run_id": "fc-porto-source",
                    "quality_state": "blocked",
                    "answers": [
                        {
                            "question_id": "q7_procurement_signal",
                            "validation_state": "validated",
                            "confidence": 0.92,
                            "answer": {
                                "kind": "summary",
                                "summary": "FC Porto is actively reshaping its digital and commercial ecosystem.",
                                "raw_structured_output": {
                                    "answer": "FC Porto is actively reshaping its digital and commercial ecosystem.",
                                    "summary": "FC Porto is actively reshaping its digital and commercial ecosystem.",
                                    "themes": [
                                        {"theme": "Digital transformation"},
                                        {"theme": "Commercial platform refresh"},
                                    ],
                                    "terminal_state": "answered",
                                    "validation_state": "validated",
                                    "blocked_by": [],
                                    "sources": [],
                                },
                                "terminal_state": "answered",
                                "blocked_by": [],
                            },
                        },
                        {
                            "question_id": "q13_capability_gap",
                            "validation_state": "provisional",
                            "confidence": 0.6,
                            "answer": {
                                "kind": "summary",
                                "summary": "Capability gaps inferred from digital_stack_maturity, vendor_change_motion",
                                "raw_structured_output": {
                                    "answer": "Capability gaps inferred from digital_stack_maturity, vendor_change_motion",
                                    "summary": "Capability gaps inferred from digital_stack_maturity, vendor_change_motion",
                                    "top_gap": "digital_stack_maturity",
                                    "themes": ["digital_stack_maturity", "vendor_change_motion"],
                                    "gap_scorecard": [
                                        {
                                            "capability": "digital_stack_maturity",
                                            "gap_score": 0.78,
                                            "severity": "high",
                                        }
                                    ],
                                    "recommendations": ["Close digital stack maturity gap"],
                                    "terminal_state": "answered",
                                    "validation_state": "provisional",
                                    "blocked_by": [],
                                    "sources": [],
                                },
                                "terminal_state": "answered",
                                "blocked_by": [],
                            },
                        },
                        {
                            "question_id": "q14_yp_fit",
                            "validation_state": "no_signal",
                            "confidence": 0.0,
                            "answer": {
                                "kind": "summary",
                                "summary": "No capability-gap inference is available yet for YP fit mapping.",
                                "raw_structured_output": {
                                    "answer": "",
                                    "summary": "No capability-gap inference is available yet for YP fit mapping.",
                                    "notes": "No capability-gap inference is available yet for YP fit mapping.",
                                    "context": "No capability-gap inference is available yet for YP fit mapping.",
                                    "terminal_state": "blocked",
                                    "validation_state": "no_signal",
                                    "blocked_by": ["q13_capability_gap", "q7_procurement_signal"],
                                    "sources": [],
                                },
                                "terminal_state": "blocked",
                                "blocked_by": ["q13_capability_gap", "q7_procurement_signal"],
                            },
                        },
                    ],
                },
                    "question_first_run": {
                        "schema_version": "question_first_run_v2",
                        "run_id": "fc-porto-source",
                    "generated_at": "2026-04-10T08:00:00+00:00",
                    "run_started_at": "2026-04-10T08:00:00+00:00",
                    "source": "opencode_agentic_batch",
                    "status": "ready",
                    "entity": {
                        "entity_id": "fc-porto-2027",
                        "entity_name": "FC Porto",
                        "entity_type": "SPORT_CLUB",
                    },
                        "question_specs": [
                            {"question_id": "q7_procurement_signal"},
                            {"question_id": "q13_capability_gap"},
                            {"question_id": "q14_yp_fit"},
                        ],
                        "answer_records": [
                            {
                                "question_id": "q7_procurement_signal",
                                "validation_state": "validated",
                                "confidence": 0.92,
                                "answer": {
                                    "kind": "summary",
                                    "summary": "FC Porto is actively reshaping its digital and commercial ecosystem.",
                                    "raw_structured_output": {
                                        "answer": "FC Porto is actively reshaping its digital and commercial ecosystem.",
                                        "summary": "FC Porto is actively reshaping its digital and commercial ecosystem.",
                                        "themes": [
                                            {"theme": "Digital transformation"},
                                            {"theme": "Commercial platform refresh"},
                                        ],
                                        "terminal_state": "answered",
                                        "validation_state": "validated",
                                        "blocked_by": [],
                                        "sources": [],
                                    },
                                    "terminal_state": "answered",
                                    "blocked_by": [],
                                },
                            },
                            {
                                "question_id": "q13_capability_gap",
                                "validation_state": "provisional",
                                "confidence": 0.6,
                                "answer": {
                                    "kind": "summary",
                                    "summary": "Capability gaps inferred from digital_stack_maturity, vendor_change_motion",
                                    "raw_structured_output": {
                                        "answer": "Capability gaps inferred from digital_stack_maturity, vendor_change_motion",
                                        "summary": "Capability gaps inferred from digital_stack_maturity, vendor_change_motion",
                                        "top_gap": "digital_stack_maturity",
                                        "themes": ["digital_stack_maturity", "vendor_change_motion"],
                                        "gap_scorecard": [
                                            {
                                                "capability": "digital_stack_maturity",
                                                "gap_score": 0.78,
                                                "severity": "high",
                                            }
                                        ],
                                        "recommendations": ["Close digital stack maturity gap"],
                                        "terminal_state": "answered",
                                        "validation_state": "provisional",
                                        "blocked_by": [],
                                        "sources": [],
                                    },
                                    "terminal_state": "answered",
                                    "blocked_by": [],
                                },
                            },
                            {
                                "question_id": "q14_yp_fit",
                                "validation_state": "no_signal",
                                "confidence": 0.0,
                                "answer": {
                                    "kind": "summary",
                                    "summary": "No capability-gap inference is available yet for YP fit mapping.",
                                    "raw_structured_output": {
                                        "answer": "",
                                        "summary": "No capability-gap inference is available yet for YP fit mapping.",
                                        "notes": "No capability-gap inference is available yet for YP fit mapping.",
                                        "context": "No capability-gap inference is available yet for YP fit mapping.",
                                        "terminal_state": "blocked",
                                        "validation_state": "no_signal",
                                        "blocked_by": ["q13_capability_gap", "q7_procurement_signal"],
                                        "sources": [],
                                    },
                                    "terminal_state": "blocked",
                                    "blocked_by": ["q13_capability_gap", "q7_procurement_signal"],
                                },
                            },
                        ],
                    },
                }
            ),
        encoding="utf-8",
    )

    monkeypatch.setenv("QUESTION_REPAIR_SOURCE_ROOTS", str(tmp_path))

    response = main.build_question_repair_source_dossier_response(
        EntityPipelineRequest(
            entity_id="fc-porto-2027",
            entity_name="FC Porto",
            entity_type="SPORT_CLUB",
            priority_score=91,
            metadata={
                "rerun_mode": "question",
                "question_id": "q14_yp_fit",
            },
        )
    )

    assert response is not None
    q14 = next(question for question in response.dossier_data["questions"] if question["question_id"] == "q14_yp_fit")
    assert q14["terminal_state"] == "answered"
    assert "No capability-gap inference is available yet" not in q14["terminal_summary"]
    assert q14["answer"]["raw_structured_output"]["best_service"] == "DIGITAL_TRANSFORMATION"
