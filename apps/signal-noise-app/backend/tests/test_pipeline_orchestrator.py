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
                "tier": "PREMIUM",
                "source_count": 2,
                "sources_used": ["FalkorDB", "BrightData"],
                "collection_time_seconds": 4.5,
                "canonical_sources": {
                    "official_site": "https://www.arsenal.com",
                    "press_release": "https://www.arsenal.com/news",
                    "careers_page": "https://www.arsenal.com/careers",
                    "jobs_board": "https://jobs.arsenal.com",
                    "linkedin_company": "https://www.linkedin.com/company/arsenal-fc",
                    "linkedin_posts": "https://www.linkedin.com/company/arsenal-fc/posts",
                    "document": "https://www.arsenal.com/documents",
                },
            },
            "generation_time_seconds": 12.3,
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


class FakeBaselineMonitoring:
    async def run_monitoring(self, **kwargs):
        return {
            "pages_fetched": 2,
            "pages_changed": 1,
            "pages_unchanged": 1,
            "candidate_count": 1,
            "candidates": [
                {
                    "entity_id": kwargs["entity_id"],
                    "batch_id": kwargs["batch_id"],
                    "run_id": kwargs["run_id"],
                    "page_class": "official_site",
                    "url": "https://example.com/rfp",
                    "content_hash": "hash-1",
                    "candidate_type": "procurement_signal",
                    "score": 0.82,
                    "evidence_excerpt": "Confirmed procurement activity",
                    "metadata": {},
                }
            ],
            "snapshots": [],
        }




class EscalatingBaselineMonitoring:
    async def run_monitoring(self, **kwargs):
        return {
            "pages_fetched": 1,
            "pages_changed": 1,
            "pages_unchanged": 0,
            "candidate_count": 1,
            "candidates": [
                {
                    "entity_id": kwargs["entity_id"],
                    "batch_id": kwargs["batch_id"],
                    "run_id": kwargs["run_id"],
                    "page_class": "official_site",
                    "url": "https://example.com/ambiguous",
                    "content_hash": "hash-2",
                    "candidate_type": "procurement_signal",
                    "score": 0.61,
                    "evidence_excerpt": "Potential procurement activity",
                    "metadata": {"requires_escalation": True},
                }
            ],
            "snapshots": [],
        }


class ValidatorEscalatingBaselineMonitoring:
    async def run_monitoring(self, **kwargs):
        return {
            "pages_fetched": 1,
            "pages_changed": 1,
            "pages_unchanged": 0,
            "candidate_count": 1,
            "candidates": [
                {
                    "entity_id": kwargs["entity_id"],
                    "batch_id": kwargs["batch_id"],
                    "run_id": kwargs["run_id"],
                    "page_class": "linkedin_posts",
                    "url": "https://example.com/social",
                    "content_hash": "hash-3",
                    "candidate_type": "social_signal",
                    "score": 0.64,
                    "evidence_excerpt": "Potential procurement activity",
                    "metadata": {
                        "validation_result": {
                            "verdict": "interesting",
                            "confidence": 0.7,
                            "should_escalate": True,
                        }
                    },
                }
            ],
            "snapshots": [],
        }

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


class FakeDashboardScorer:
    async def calculate_entity_scores(self, **kwargs):
        return {
            "procurement_maturity": 74.0,
            "active_probability": 0.81,
            "sales_readiness": "LIVE",
            "calculated_at": datetime.now(timezone.utc).isoformat(),
        }


@pytest.mark.asyncio
async def test_pipeline_orchestrator_runs_phases_and_returns_artifacts():
    phase_events = []

    async def phase_callback(phase, payload):
        phase_events.append((phase, payload["status"]))

    orchestrator = PipelineOrchestrator(
        dossier_generator=FakeDossierGenerator(),
        baseline_monitoring_runner=FakeBaselineMonitoring(),
        discovery=FakeDiscovery(),
        ralph_validator=FakeRalph(),
        graphiti_service=FakeGraphiti(),
        dashboard_scorer=FakeDashboardScorer(),
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
    assert result["phases"]["dossier_generation"]["duration_seconds"] == 12.3
    assert result["phases"]["dossier_generation"]["collection_time_seconds"] == 4.5
    assert result["phases"]["dossier_generation"]["source_count"] == 2
    assert result["phases"]["dossier_generation"]["canonical_sources"]["official_site"] == "https://www.arsenal.com"
    assert result["phases"]["dossier_generation"]["canonical_sources"]["jobs_board"] == "https://jobs.arsenal.com"
    assert result["phases"]["baseline_monitoring"]["status"] == "completed"
    assert result["phases"]["baseline_monitoring"]["candidate_count"] == 1
    assert result["phases"]["discovery"]["status"] == "skipped"
    assert result["phases"]["ralph_validation"]["status"] == "completed"
    assert result["phases"]["temporal_persistence"]["status"] == "completed"
    assert result["phases"]["dashboard_scoring"]["status"] == "completed"
    assert result["validated_signal_count"] == 1
    assert result["rfp_count"] == 1
    assert result["sales_readiness"] == "LIVE"
    assert result["artifacts"]["dossier"]["metadata"]["canonical_sources"]["press_release"] == "https://www.arsenal.com/news"
    assert result["artifacts"]["monitoring_result"]["candidate_count"] == 1
    assert ("baseline_monitoring", "running") in phase_events
    assert ("dashboard_scoring", "completed") in phase_events


@pytest.mark.asyncio
async def test_pipeline_orchestrator_preserves_prefetched_dossier_phase_metadata():
    orchestrator = PipelineOrchestrator(
        dossier_generator=FakeDossierGenerator(),
        baseline_monitoring_runner=FakeBaselineMonitoring(),
        discovery=FakeDiscovery(),
        ralph_validator=FakeRalph(),
        graphiti_service=FakeGraphiti(),
        dashboard_scorer=FakeDashboardScorer(),
    )

    initial_dossier = await FakeDossierGenerator().generate_universal_dossier(
        entity_id="fiba",
        entity_name="FIBA",
        entity_type="FEDERATION",
        priority_score=88,
    )

    result = await orchestrator.run_entity_pipeline(
        entity_id="fiba",
        entity_name="FIBA",
        entity_type="FEDERATION",
        priority_score=88,
        initial_dossier=initial_dossier,
    )

    dossier_phase = result["phases"]["dossier_generation"]
    assert dossier_phase["status"] == "completed"
    assert dossier_phase["duration_seconds"] == 12.3
    assert dossier_phase["collection_time_seconds"] == 4.5
    assert dossier_phase["source_count"] == 2
    assert dossier_phase["sources_used"] == ["FalkorDB", "BrightData"]
    assert dossier_phase["canonical_sources"]["linkedin_company"] == "https://www.linkedin.com/company/arsenal-fc"
    assert dossier_phase["canonical_sources"]["document"] == "https://www.arsenal.com/documents"


@pytest.mark.asyncio
async def test_pipeline_orchestrator_escalates_selected_baseline_runs_into_discovery():
    phase_events = []

    async def phase_callback(phase, payload):
        phase_events.append((phase, payload))

    orchestrator = PipelineOrchestrator(
        dossier_generator=FakeDossierGenerator(),
        baseline_monitoring_runner=EscalatingBaselineMonitoring(),
        discovery=FakeDiscovery(),
        ralph_validator=FakeRalph(),
        graphiti_service=FakeGraphiti(),
        dashboard_scorer=FakeDashboardScorer(),
    )

    result = await orchestrator.run_entity_pipeline(
        entity_id="fiba",
        entity_name="FIBA",
        entity_type="FEDERATION",
        priority_score=70,
        phase_callback=phase_callback,
    )

    assert result["artifacts"]["escalation_reason"] == "baseline_monitoring_ambiguous"
    assert result["phases"]["baseline_monitoring"]["escalation_reason"] == "baseline_monitoring_ambiguous"
    assert result["phases"]["discovery"]["status"] == "completed"
    assert result["phases"]["discovery"]["reason"] == "baseline_monitoring_ambiguous"
    assert any(
        phase == "discovery" and payload.get("status") == "running" and payload.get("reason") == "baseline_monitoring_ambiguous"
        for phase, payload in phase_events
    )


@pytest.mark.asyncio
async def test_pipeline_orchestrator_prefers_validator_recommended_escalation():
    orchestrator = PipelineOrchestrator(
        dossier_generator=FakeDossierGenerator(),
        baseline_monitoring_runner=ValidatorEscalatingBaselineMonitoring(),
        discovery=FakeDiscovery(),
        ralph_validator=FakeRalph(),
        graphiti_service=FakeGraphiti(),
        dashboard_scorer=FakeDashboardScorer(),
    )

    result = await orchestrator.run_entity_pipeline(
        entity_id="fiba",
        entity_name="FIBA",
        entity_type="FEDERATION",
        priority_score=40,
    )

    assert result["artifacts"]["escalation_reason"] == "validator_recommended_escalation"
    assert result["phases"]["baseline_monitoring"]["escalation_reason"] == "validator_recommended_escalation"
    assert result["phases"]["discovery"]["status"] == "completed"
