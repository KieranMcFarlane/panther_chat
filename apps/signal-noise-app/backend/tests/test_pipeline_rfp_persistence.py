#!/usr/bin/env python3
"""
Tests for promoting imported-entity RFPs into the unified/global RFP system.
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
            },
            "extracted_signals": [],
            "procurement_signals": {
                "upcoming_opportunities": [],
            },
        }


class FakeDiscoveryResult:
    def __init__(self):
        self.signals_discovered = [
            {
                "signal_type": "RFP_DETECTED",
                "statement": "CRM procurement detected",
                "confidence": 0.9,
                "url": "https://example.com/rfp",
            }
        ]
        self.hypotheses = []


class FakeDiscovery:
    async def run_discovery_with_dossier_context(self, **kwargs):
        return FakeDiscoveryResult()


class FakeRalph:
    async def validate_signals(self, raw_signals, entity_id):
        return {
            "validated_signals": [
                {
                    "id": f"{entity_id}-rfp-1",
                    "type": "RFP_DETECTED",
                    "confidence": 0.92,
                    "statement": "Validated CRM procurement detected",
                    "url": "https://example.com/rfp",
                    "entity_id": entity_id,
                }
            ],
            "capability_signals": [],
            "hypothesis_states": {},
        }


class FakeGraphiti:
    def __init__(self):
        self.unified_rfps = []

    async def add_rfp_episode(self, rfp_data):
        return {
            "episode_id": "episode-rfp-1",
            "organization": rfp_data["organization"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "created",
        }

    async def add_discovery_episode(self, **kwargs):
        return {"episode_id": "episode-discovery-1"}

    async def get_entity_timeline(self, entity_id, limit=50):
        return []

    async def persist_unified_rfp(self, rfp_data):
        self.unified_rfps.append(rfp_data)
        return {
            "rfp_id": rfp_data["rfp_id"],
            "status": "upserted",
        }


class FakeDashboardScorer:
    async def calculate_entity_scores(self, **kwargs):
        return {
            "sales_readiness": "LIVE",
        }


@pytest.mark.asyncio
async def test_validated_rfp_is_promoted_into_unified_rfp_persistence():
    graphiti = FakeGraphiti()
    orchestrator = PipelineOrchestrator(
        dossier_generator=FakeDossierGenerator(),
        discovery=FakeDiscovery(),
        ralph_validator=FakeRalph(),
        graphiti_service=graphiti,
        dashboard_scorer=FakeDashboardScorer(),
    )

    result = await orchestrator.run_entity_pipeline(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        entity_type="CLUB",
        priority_score=90,
    )

    assert result["rfp_count"] == 1
    assert len(graphiti.unified_rfps) == 1
    assert graphiti.unified_rfps[0]["entity_id"] == "arsenal-fc"
    assert graphiti.unified_rfps[0]["organization"] == "Arsenal FC"
    assert graphiti.unified_rfps[0]["metadata"]["episode_id"] == "episode-rfp-1"
