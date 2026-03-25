#!/usr/bin/env python3
"""
Tests for the canonical entity pipeline orchestrator.
"""

import sys
from pathlib import Path
from datetime import datetime, timezone
import pytest

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from pipeline_orchestrator import PipelineOrchestrator


class FakeDossierGenerator:
    async def generate_universal_dossier(self, **kwargs):
        return {
            "metadata": {
                "entity_id": kwargs["entity_id"],
                "hypothesis_count": 1,
                "signal_count": 1,
            },
            "procurement_signals": {
                "upcoming_opportunities": [
                    {
                        "opportunity": "CRM replacement",
                        "rfp_probability": 80,
                        "timeline": "Q3 2026",
                    }
                ]
            },
            "extracted_signals": [
                {
                    "type": "[PROCUREMENT]",
                    "insight": "CRM replacement likely",
                    "confidence": 80,
                }
            ],
        }


class FakeDiscoveryResult:
    def __init__(self):
        self.final_confidence = 0.78
        self.iterations_completed = 3
        self.signals_discovered = [
            {
                "signal_type": "RFP_DETECTED",
                "statement": "Confirmed procurement activity",
                "confidence": 0.82,
                "url": "https://example.com/rfp",
            }
        ]
        self.hypotheses = [
            {
                "statement": "Entity is in market for CRM",
                "confidence": 0.78,
                "category": "PROCUREMENT",
            }
        ]


class FakeDiscovery:
    async def run_discovery_with_dossier_context(self, **kwargs):
        return FakeDiscoveryResult()


class FakeDiscoveryManySignals:
    async def run_discovery_with_dossier_context(self, **kwargs):
        result = FakeDiscoveryResult()
        result.signals_discovered = [
            {
                "signal_type": "TECHNOLOGY_ADOPTED",
                "statement": f"Raw discovery signal {idx}",
                "confidence": 0.81,
                "url": f"https://example.com/signal/{idx}",
            }
            for idx in range(5)
        ]
        return result


class FakeDiscoveryHybridSignals:
    async def run_discovery_with_dossier_context(self, **kwargs):
        result = FakeDiscoveryResult()
        result.provisional_signals = [
            {
                "signal_type": "DISCOVERY_SIGNAL",
                "validation_state": "provisional",
                "statement": "Provisional entity-grounded signal A",
                "confidence": 0.66,
                "url": "https://example.com/news/a",
            },
            {
                "signal_type": "DISCOVERY_SIGNAL",
                "validation_state": "provisional",
                "statement": "Provisional entity-grounded signal B",
                "confidence": 0.64,
                "url": "https://example.com/news/b",
            },
        ]
        result.performance_summary = {"schema_fail_count": 0}
        return result


class FakeRalph:
    async def validate_signals(self, raw_signals, entity_id):
        return [
            {
                "id": f"{entity_id}-validated-rfp",
                "type": "RFP_DETECTED",
                "confidence": 0.85,
                "statement": "Validated RFP signal",
                "url": "https://example.com/rfp",
            }
        ]


class FakeRalphNonRfp:
    async def validate_signals(self, raw_signals, entity_id):
        return [
            {
                "id": f"{entity_id}-validated-signal",
                "type": "TECHNOLOGY_ADOPTED",
                "confidence": 0.74,
                "statement": "Adopted new CRM workflow",
                "url": "https://example.com/news/crm",
            }
        ]


class FakeRalphEmpty:
    async def validate_signals(self, raw_signals, entity_id):
        return []


class FakeRalphHybrid:
    async def validate_signals(self, raw_signals, entity_id):
        return [
            {
                "id": f"{entity_id}-validated-min",
                "type": "DISCOVERY_SIGNAL",
                "confidence": 0.72,
                "statement": "Validated minimum signal",
                "url": "https://example.com/validated",
                "validation_state": "validated",
                "accept_guard_passed": True,
                "evidence_pointer_ids": ["ev:abc123"],
            }
        ]


class FakeGraphiti:
    def __init__(self):
        self.episodes = []
        self.signals = []

    async def upsert_signal(self, signal):
        self.signals.append(signal)
        return {"signal_id": getattr(signal, "id", "signal-1")}

    async def add_rfp_episode(self, rfp_data):
        self.episodes.append(rfp_data)
        return {"episode_id": "episode-1"}

    async def add_discovery_episode(self, **kwargs):
        self.episodes.append(kwargs)
        return {"episode_id": "episode-discovery-1"}

    async def get_entity_timeline(self, entity_id, limit=50):
        return self.episodes[:limit]


class StrictDiscoveryGraphiti(FakeGraphiti):
    async def add_discovery_episode(
        self,
        entity_id,
        entity_name,
        entity_type,
        episode_type,
        description,
        source="discovery",
        url=None,
        confidence=0.5,
        evidence_date=None,
        metadata=None,
    ):
        self.episodes.append(
            {
                "entity_id": entity_id,
                "entity_name": entity_name,
                "entity_type": entity_type,
                "episode_type": episode_type,
                "description": description,
                "source": source,
                "url": url,
                "confidence": confidence,
                "metadata": metadata or {},
            }
        )
        return {"episode_id": "episode-discovery-1"}


class FakeDashboardScorer:
    async def calculate_entity_scores(self, **kwargs):
        return {
            "procurement_maturity": 74.0,
            "active_probability": 0.81,
            "sales_readiness": "LIVE",
            "calculated_at": datetime.now(timezone.utc).isoformat(),
        }


class FakePersistenceCoordinator:
    async def persist_run_artifacts(self, **kwargs):
        return {
            "dual_write_ok": True,
            "supabase": {"ok": True, "attempts": 1},
            "falkordb": {"ok": True, "attempts": 1},
            "reconcile_required": False,
            "reconciliation_payload": None,
        }

    async def persist_step_artifacts(self, **kwargs):
        artifacts = kwargs.get("artifacts") or []
        return {
            "total_count": len(artifacts),
            "persisted_count": len(artifacts),
            "failed_count": 0,
            "dual_write_ok": True,
            "status_matrix": [],
            "reconcile_required": False,
            "reconciliation_payloads": [],
            "failure_taxonomy": {
                "supabase_write_failure": 0,
                "falkordb_write_failure": 0,
                "dual_write_incomplete": 0,
            },
        }


class FakePersistenceCoordinatorFail:
    async def persist_run_artifacts(self, **kwargs):
        return {
            "dual_write_ok": False,
            "supabase": {"ok": False, "attempts": 3, "error_class": "timeout"},
            "falkordb": {"ok": True, "attempts": 1},
            "reconcile_required": True,
            "reconciliation_payload": {"idempotency_key": "k"},
        }

    async def persist_step_artifacts(self, **kwargs):
        artifacts = kwargs.get("artifacts") or []
        return {
            "total_count": len(artifacts),
            "persisted_count": 0,
            "failed_count": len(artifacts),
            "dual_write_ok": False,
            "status_matrix": [],
            "reconcile_required": True,
            "reconciliation_payloads": [{"idempotency_key": "step-k"}],
            "failure_taxonomy": {
                "supabase_write_failure": len(artifacts),
                "falkordb_write_failure": 0,
                "dual_write_incomplete": 1 if artifacts else 0,
            },
        }


@pytest.mark.asyncio
async def test_pipeline_orchestrator_runs_phases_and_returns_artifacts():
    phase_events = []

    async def phase_callback(phase, payload):
        phase_events.append((phase, payload["status"]))

    orchestrator = PipelineOrchestrator(
        dossier_generator=FakeDossierGenerator(),
        discovery=FakeDiscovery(),
        ralph_validator=FakeRalph(),
        graphiti_service=FakeGraphiti(),
        dashboard_scorer=FakeDashboardScorer(),
        persistence_coordinator=FakePersistenceCoordinator(),
    )

    result = await orchestrator.run_entity_pipeline(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        entity_type="CLUB",
        priority_score=90,
        phase_callback=phase_callback,
    )

    assert result["entity_id"] == "arsenal-fc"
    assert result["phases"]["dossier_generation"]["status"] == "completed"
    assert result["phases"]["discovery"]["status"] == "completed"
    assert result["phases"]["ralph_validation"]["status"] == "completed"
    assert result["phases"]["temporal_persistence"]["status"] == "completed"
    assert result["phases"]["dashboard_scoring"]["status"] == "completed"
    assert result["validated_signal_count"] == 1
    assert result["rfp_count"] == 1
    assert result["sales_readiness"] == "LIVE"
    assert result["phase_details_by_phase"]["discovery"]["status"] == "completed"
    assert result["acceptance_gate"]["passed"] is False
    assert "signals_below_threshold" in result["acceptance_gate"]["reasons"]
    assert result["failure_taxonomy"]["low_signal_content"] == 1
    assert result["run_profile"] == "bounded_production"
    assert result["degraded_mode"] is False
    assert result["dual_write_ok"] is True
    assert result["persistence_status"]["supabase"]["ok"] is True
    assert ("discovery", "running") in phase_events
    assert ("dashboard_scoring", "completed") in phase_events


@pytest.mark.asyncio
async def test_pipeline_orchestrator_emits_phase_boundary_logs(caplog):
    caplog.set_level("WARNING")

    orchestrator = PipelineOrchestrator(
        dossier_generator=FakeDossierGenerator(),
        discovery=FakeDiscovery(),
        ralph_validator=FakeRalph(),
        graphiti_service=FakeGraphiti(),
        dashboard_scorer=FakeDashboardScorer(),
        persistence_coordinator=FakePersistenceCoordinator(),
    )

    await orchestrator.run_entity_pipeline(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        entity_type="CLUB",
        priority_score=90,
    )

    messages = [record.message for record in caplog.records]
    assert any("Pipeline boundary: orchestrator:start" in message for message in messages)
    assert any("Pipeline boundary: discovery:start" in message for message in messages)
    assert any("Pipeline boundary: discovery:complete" in message for message in messages)
    assert any("Pipeline boundary: dashboard_scoring:complete" in message for message in messages)
    assert any("Pipeline boundary: orchestrator:complete" in message for message in messages)


@pytest.mark.asyncio
async def test_pipeline_orchestrator_hard_fails_acceptance_gate_when_dual_write_fails():
    orchestrator = PipelineOrchestrator(
        dossier_generator=FakeDossierGenerator(),
        discovery=FakeDiscovery(),
        ralph_validator=FakeRalph(),
        graphiti_service=FakeGraphiti(),
        dashboard_scorer=FakeDashboardScorer(),
        persistence_coordinator=FakePersistenceCoordinatorFail(),
    )
    result = await orchestrator.run_entity_pipeline(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        entity_type="CLUB",
        priority_score=90,
    )
    assert result["dual_write_ok"] is False
    assert result["acceptance_gate"]["passed"] is False
    assert "dual_write_incomplete" in result["acceptance_gate"]["reasons"]
    assert result["failure_taxonomy"]["dual_write_incomplete"] == 1
    assert result["failure_taxonomy"]["supabase_write_failure"] >= 1


@pytest.mark.asyncio
async def test_pipeline_orchestrator_acceptance_gate_uses_validated_signal_count():
    orchestrator = PipelineOrchestrator(
        dossier_generator=FakeDossierGenerator(),
        discovery=FakeDiscoveryManySignals(),
        ralph_validator=FakeRalphEmpty(),
        graphiti_service=FakeGraphiti(),
        dashboard_scorer=FakeDashboardScorer(),
        persistence_coordinator=FakePersistenceCoordinator(),
    )
    result = await orchestrator.run_entity_pipeline(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        entity_type="CLUB",
        priority_score=90,
    )
    assert result["validated_signal_count"] == 0
    assert result["acceptance_gate"]["passed"] is False
    assert "signals_below_threshold" in result["acceptance_gate"]["reasons"]
    no_signal_episodes = [
        episode
        for episode in result["artifacts"]["episodes"]
        if isinstance(episode, dict) and str(episode.get("episode_type") or "") == "NO_SIGNAL_FOUND"
    ]
    assert len(no_signal_episodes) == 1


@pytest.mark.asyncio
async def test_pipeline_orchestrator_acceptance_gate_supports_hybrid_provisional_mode():
    orchestrator = PipelineOrchestrator(
        dossier_generator=FakeDossierGenerator(),
        discovery=FakeDiscoveryHybridSignals(),
        ralph_validator=FakeRalphHybrid(),
        graphiti_service=FakeGraphiti(),
        dashboard_scorer=FakeDashboardScorer(),
        persistence_coordinator=FakePersistenceCoordinator(),
    )
    result = await orchestrator.run_entity_pipeline(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        entity_type="CLUB",
        priority_score=90,
    )
    assert result["acceptance_gate"]["passed"] is True
    assert result["acceptance_gate"]["acceptance_mode"] == "hybrid_provisional"


@pytest.mark.asyncio
async def test_pipeline_orchestrator_uses_graphiti_discovery_episode_contract_for_non_rfp_signals():
    orchestrator = PipelineOrchestrator(
        dossier_generator=FakeDossierGenerator(),
        discovery=FakeDiscovery(),
        ralph_validator=FakeRalphNonRfp(),
        graphiti_service=StrictDiscoveryGraphiti(),
        dashboard_scorer=FakeDashboardScorer(),
        persistence_coordinator=FakePersistenceCoordinator(),
    )
    result = await orchestrator.run_entity_pipeline(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        entity_type="CLUB",
        priority_score=90,
    )
    assert result["phases"]["temporal_persistence"]["status"] == "completed"
    episodes = result["artifacts"]["episodes"]
    assert len(episodes) == 1


@pytest.mark.asyncio
async def test_pipeline_orchestrator_emits_objective_contract_fields():
    orchestrator = PipelineOrchestrator(
        dossier_generator=FakeDossierGenerator(),
        discovery=FakeDiscovery(),
        ralph_validator=FakeRalph(),
        graphiti_service=FakeGraphiti(),
        dashboard_scorer=FakeDashboardScorer(),
        persistence_coordinator=FakePersistenceCoordinator(),
    )
    result = await orchestrator.run_entity_pipeline(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        entity_type="CLUB",
        priority_score=90,
        run_objective="rfp_web",
    )

    assert result["objective"] == "rfp_web"
    assert isinstance(result["objective_result"], dict)
    assert isinstance(result["llm_efficiency_metrics"], dict)
    assert "length_stop_count" in result["llm_efficiency_metrics"]
    assert "schema_fail_count" in result["llm_efficiency_metrics"]
