import sys
from pathlib import Path

import pytest

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from graphiti_service import GraphitiService


class _Result:
    def __init__(self, data=None, error=None):
        self.data = data or []
        self.error = error


class _HomepageInsightsTable:
    def __init__(self, sink):
        self.sink = sink
        self._payload = None
        self._conflict = None

    def upsert(self, payload, on_conflict=None):
        self._payload = payload
        self._conflict = on_conflict
        return self

    def execute(self):
        self.sink.append((self._conflict, self._payload))
        return _Result([self._payload])


class _FakeSupabase:
    def __init__(self):
        self.rows = []

    def table(self, name):
        assert name == "homepage_graphiti_insights"
        return _HomepageInsightsTable(self.rows)


@pytest.mark.asyncio
async def test_materialize_homepage_insight_writes_stable_homepage_row():
    svc = GraphitiService.__new__(GraphitiService)
    svc.use_supabase = True
    svc.supabase_client = _FakeSupabase()

    result = await GraphitiService.materialize_homepage_insight(
        svc,
        {
            "entity_id": "arsenal-fc",
            "entity_name": "Arsenal FC",
            "entity_type": "CLUB",
            "run_id": "run-123",
            "objective": "rfp_web",
            "scores": {
                "sales_readiness": "LIVE",
                "active_probability": 0.91,
            },
            "phase_details_by_phase": {
                "temporal_persistence": {"status": "completed"},
            },
            "artifacts": {
                "dossier": {
                    "league": "Premier League",
                    "sport": "football",
                    "relationships": [
                        {
                            "type": "member_of",
                            "target_id": "premier-league",
                            "target_name": "Premier League",
                        }
                    ],
                },
                "validated_signals": [
                    {
                        "id": "signal-1",
                        "type": "RFP_DETECTED",
                        "confidence": 0.86,
                        "statement": "Arsenal is actively reviewing a CRM change.",
                        "source": "pipeline_orchestrator",
                    }
                ],
                "episodes": [
                    {
                        "episode_id": "episode-1",
                        "description": "Validated opportunity signal",
                        "source": "pipeline_orchestrator",
                    }
                ],
            },
        },
    )

    assert result["status"] == "materialized"
    assert result["insight_id"] == "run-123:arsenal-fc"
    assert len(svc.supabase_client.rows) == 1
    _, payload = svc.supabase_client.rows[0]
    assert payload["entity_id"] == "arsenal-fc"
    assert payload["entity_name"] == "Arsenal FC"
    assert payload["freshness"] == "new"
    assert payload["confidence"] >= 0.86
    assert payload["title"].startswith("Arsenal FC:")
    assert payload["relationships"][0]["target_name"] == "Premier League"
    assert payload["evidence"][0]["id"] == "episode-1"
