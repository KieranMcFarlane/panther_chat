#!/usr/bin/env python3
"""
Tests for degraded pipeline execution when LLM-dependent phases are unavailable.
"""

import sys
from pathlib import Path
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


class FailingDiscovery:
    async def run_discovery_with_dossier_context(self, **kwargs):
        raise RuntimeError("Claude API disabled: no key configured")


class UnusedRalph:
    async def validate_signals(self, raw_signals, entity_id):
        raise AssertionError("Ralph should not run when discovery failed")


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
async def test_pipeline_degrades_cleanly_when_discovery_is_unavailable():
    phase_updates = []

    async def callback(phase, payload):
        phase_updates.append((phase, payload))

    orchestrator = PipelineOrchestrator(
        dossier_generator=FakeDossierGenerator(),
        baseline_monitoring_runner=None,
        discovery=FailingDiscovery(),
        ralph_validator=UnusedRalph(),
        graphiti_service=FakeGraphiti(),
        dashboard_scorer=FakeDashboardScorer(),
    )

    result = await orchestrator.run_entity_pipeline(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        phase_callback=callback,
    )

    assert result["phases"]["dossier_generation"]["status"] == "completed"
    assert result["phases"]["baseline_monitoring"]["status"] == "skipped"
    assert result["phases"]["discovery"]["status"] == "failed"
    assert result["phases"]["ralph_validation"]["status"] == "skipped"
    assert result["phases"]["temporal_persistence"]["status"] == "skipped"
    assert result["phases"]["dashboard_scoring"]["status"] == "completed"
    assert result["validated_signal_count"] == 0
    assert result["rfp_count"] == 0
    assert result["sales_readiness"] == "MONITOR"
    assert any(phase == "discovery" and payload["status"] == "failed" for phase, payload in phase_updates)
