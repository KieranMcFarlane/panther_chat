#!/usr/bin/env python3
"""
Tests for timeout-safe dossier generation behavior in phase 0.
"""

import asyncio
import sys
import types
from pathlib import Path

import pytest

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

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
async def test_run_entity_pipeline_times_out_with_clear_http_error(monkeypatch):
    monkeypatch.setenv("DOSSIER_PHASE0_TIMEOUT_SECONDS", "0.01")

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
