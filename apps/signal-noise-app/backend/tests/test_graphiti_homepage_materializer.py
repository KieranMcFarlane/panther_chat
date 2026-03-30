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


@pytest.mark.asyncio
async def test_materialize_homepage_insight_prefers_question_first_validation_when_validated_signals_are_missing():
    svc = GraphitiService.__new__(GraphitiService)
    svc.use_supabase = True
    svc.supabase_client = _FakeSupabase()

    result = await GraphitiService.materialize_homepage_insight(
        svc,
        {
            "entity_id": "arsenal-fc",
            "entity_name": "Arsenal FC",
            "entity_type": "CLUB",
            "run_id": "run-question-first",
            "objective": "procurement_discovery",
            "scores": {
                "sales_readiness": "MONITOR",
                "active_probability": 0.42,
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
                    "questions": [
                        {
                            "question_id": "sc_fan_engagement_gaps",
                            "question": "What evidence shows Arsenal FC is investing in fan engagement, loyalty, membership, or personalized communication?",
                            "yp_service_fit": ["FAN_ENGAGEMENT", "MOBILE_APPS"],
                            "budget_range": "£80K-£300K",
                            "positioning_strategy": "INNOVATION_PARTNER",
                            "graphiti_focus": "membership changes, supporter communications, loyalty mentions",
                            "graphiti_sources": ["Graphiti community updates", "press releases"],
                        }
                    ],
                    "question_first": {
                        "enabled": True,
                        "questions_answered": 1,
                        "answers": [
                            {
                                "question_id": "sc_fan_engagement_gaps",
                                "section_id": "recent_news",
                                "question_text": "What evidence shows Arsenal FC is investing in fan engagement, loyalty, membership, or personalized communication?",
                                "search_query": '"Arsenal FC" supporter experience',
                                "search_hit": True,
                                "search_results_count": 1,
                                "scrape_url": "https://example.com/arsenal-supporter-experience",
                                "answer": "Arsenal FC is hiring for supporter loyalty and CRM modernization.",
                                "confidence": 0.84,
                                "evidence_url": "https://example.com/arsenal-supporter-experience",
                                "reasoning_model_used": "judge",
                                "retry_count": 0,
                                "category": "strategy",
                                "validation_state": "validated",
                            }
                        ],
                        "categories": [
                            {
                                "category": "strategy",
                                "question_count": 1,
                                "validated_count": 1,
                                "pending_count": 0,
                                "no_signal_count": 0,
                                "retry_count": 0,
                            }
                        ],
                    },
                },
                "validated_signals": [],
                "episodes": [
                    {
                        "episode_id": "episode-question-first",
                        "description": "Validated question-first fan engagement signal",
                        "source": "question_first_runner",
                    }
                ],
            },
        },
    )

    assert result["status"] == "materialized"
    assert len(svc.supabase_client.rows) == 1
    _, payload = svc.supabase_client.rows[0]
    assert payload["title"].lower().startswith("arsenal fc: fan engagement")
    assert "question-first" in payload["why_it_matters"].lower()
    assert payload["confidence"] >= 0.84
    assert payload["raw_payload"]["signal_basis"] == "question_first"
    assert payload["evidence"][0]["snippet"].startswith("Arsenal FC is hiring")


@pytest.mark.asyncio
async def test_materialize_homepage_insight_skips_low_signal_runs():
    svc = GraphitiService.__new__(GraphitiService)
    svc.use_supabase = True
    svc.supabase_client = _FakeSupabase()

    result = await GraphitiService.materialize_homepage_insight(
        svc,
        {
            "entity_id": "arsenal-fc",
            "entity_name": "Arsenal FC",
            "entity_type": "CLUB",
            "run_id": "run-low-signal",
            "objective": "procurement_discovery",
            "scores": {
                "sales_readiness": "MONITOR",
                "active_probability": 0.31,
            },
            "phase_details_by_phase": {
                "temporal_persistence": {"status": "completed"},
            },
            "artifacts": {
                "dossier": {
                    "league": "Premier League",
                    "sport": "football",
                    "questions": [],
                },
                "validated_signals": [],
                "episodes": [],
            },
        },
    )

    assert result["status"] == "skipped"
    assert result["reason"] == "insufficient_signal_quality"
    assert svc.supabase_client.rows == []
