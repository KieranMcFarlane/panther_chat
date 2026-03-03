#!/usr/bin/env python3
"""
Tests for pipeline behavior when discovery exceeds the configured timeout.
"""

import sys
from pathlib import Path
import asyncio
import pytest

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from pipeline_orchestrator import PipelineOrchestrator


class FakeDossierGenerator:
    async def generate_universal_dossier(self, **kwargs):
        return {
            "metadata": {
                "entity_id": kwargs["entity_id"],
                "hypothesis_count": 0,
                "signal_count": 0,
            },
            "extracted_signals": [],
            "procurement_signals": {
                "upcoming_opportunities": [],
            },
        }


class SlowDiscovery:
    async def run_discovery_with_dossier_context(self, **kwargs):
        await asyncio.sleep(0.2)


class UnusedRalph:
    async def validate_signals(self, raw_signals, entity_id):
        raise AssertionError("Ralph should not run when discovery times out")


class FakeGraphiti:
    async def get_entity_timeline(self, entity_id, limit=50):
        return []


class FakeDashboardScorer:
    async def calculate_entity_scores(self, **kwargs):
        return {
            "procurement_maturity": 0.0,
            "active_probability": 0.0,
            "sales_readiness": "MONITOR",
        }


@pytest.mark.asyncio
async def test_pipeline_marks_discovery_failed_on_timeout(monkeypatch):
    monkeypatch.setenv("ENTITY_DISCOVERY_TIMEOUT_SECONDS", "0")
    monkeypatch.setenv("ENTITY_DISCOVERY_MAX_ITERATIONS", "2")
    monkeypatch.setenv("ENTITY_DISCOVERY_HARD_TIMEOUT", "1")

    orchestrator = PipelineOrchestrator(
        dossier_generator=FakeDossierGenerator(),
        baseline_monitoring_runner=None,
        discovery=SlowDiscovery(),
        ralph_validator=UnusedRalph(),
        graphiti_service=FakeGraphiti(),
        dashboard_scorer=FakeDashboardScorer(),
    )

    result = await orchestrator.run_entity_pipeline(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
    )

    assert result["phases"]["discovery"]["status"] == "failed"
    assert "timed out" in result["phases"]["discovery"]["error"].lower()
    assert result["phases"]["ralph_validation"]["status"] == "skipped"
    assert result["phases"]["dashboard_scoring"]["status"] == "completed"
