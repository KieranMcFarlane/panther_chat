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
                            "question_id": "foundation_q",
                            "question": "When was Arsenal FC founded?",
                            "yp_service_fit": ["QUESTION_FIRST"],
                        },
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
                                "question_id": "foundation_q",
                                "section_id": "core_information",
                                "question_text": "When was Arsenal FC founded?",
                                "answer": "Arsenal FC was founded in 1886.",
                                "confidence": 0.93,
                                "evidence_url": "https://example.com/arsenal-foundation",
                                "reasoning_model_used": "judge",
                                "retry_count": 0,
                                "category": "identity",
                                "validation_state": "validated",
                                "signal_type": "FOUNDATION",
                            },
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
                        "dossier_promotions": [
                            {
                                "candidate_id": "sc_fan_engagement_gaps:opportunity_signals",
                                "question_id": "sc_fan_engagement_gaps",
                                "promotion_target": "opportunity_signals",
                                "signal_type": "PROCUREMENT_SIGNAL",
                                "answer": "Arsenal FC is hiring for supporter loyalty and CRM modernization.",
                                "confidence": 0.84,
                                "evidence_url": "https://example.com/arsenal-supporter-experience",
                                "promotion_candidate": True,
                            }
                        ],
                        "discovery_summary": {
                            "promoted_count": 1,
                            "supporting_evidence_count": 1,
                            "promotion_targets": ["opportunity_signals"],
                            "opportunity_signals": [
                                {
                                    "candidate_id": "sc_fan_engagement_gaps:opportunity_signals",
                                    "question_id": "sc_fan_engagement_gaps",
                                    "promotion_target": "opportunity_signals",
                                    "signal_type": "PROCUREMENT_SIGNAL",
                                    "answer": "Arsenal FC is hiring for supporter loyalty and CRM modernization.",
                                    "confidence": 0.84,
                                    "evidence_url": "https://example.com/arsenal-supporter-experience",
                                }
                            ],
                        },
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


@pytest.mark.asyncio
async def test_materialize_homepage_insight_materializes_all_question_first_opportunities():
    svc = GraphitiService.__new__(GraphitiService)
    svc.use_supabase = True
    svc.supabase_client = _FakeSupabase()

    result = await GraphitiService.materialize_homepage_insight(
        svc,
        {
            "entity_id": "major-league-cricket",
            "entity_name": "Major League Cricket",
            "entity_type": "LEAGUE",
            "run_id": "run-dossier-multi",
            "objective": "procurement_discovery",
            "scores": {
                "sales_readiness": "MONITOR",
                "active_probability": 0.61,
            },
            "phase_details_by_phase": {
                "temporal_persistence": {"status": "completed"},
            },
            "artifacts": {
                "dossier": {
                    "league": "Major League Cricket",
                    "sport": "cricket",
                    "questions": [
                        {
                            "question_id": "sc_media_rights",
                            "question": "What evidence shows Major League Cricket is investing in media rights or distribution?",
                            "yp_service_fit": ["MEDIA_RIGHTS"],
                            "yp_advantage": "Review media rights evidence and prepare outreach.",
                        },
                        {
                            "question_id": "sc_sponsorship",
                            "question": "What evidence shows Major League Cricket is investing in sponsorship or partnership growth?",
                            "yp_service_fit": ["SPONSORSHIP"],
                            "yp_advantage": "Review sponsorship evidence and prepare outreach.",
                        },
                    ],
                    "question_first": {
                        "enabled": True,
                        "questions_answered": 2,
                        "answers": [
                            {
                                "question_id": "sc_media_rights",
                                "section_id": "commercial_signal",
                                "question_text": "What evidence shows Major League Cricket is investing in media rights or distribution?",
                                "answer": "Major League Cricket is actively evaluating distribution and media-rights partnerships.",
                                "confidence": 0.88,
                                "evidence_url": "https://example.com/mlc-media-rights",
                                "validation_state": "validated",
                                "signal_type": "PROCUREMENT_SIGNAL",
                            },
                            {
                                "question_id": "sc_sponsorship",
                                "section_id": "commercial_signal",
                                "question_text": "What evidence shows Major League Cricket is investing in sponsorship or partnership growth?",
                                "answer": "Major League Cricket is actively evaluating sponsorship and partnership expansion.",
                                "confidence": 0.86,
                                "evidence_url": "https://example.com/mlc-sponsorship",
                                "validation_state": "validated",
                                "signal_type": "PROCUREMENT_SIGNAL",
                            },
                        ],
                        "dossier_promotions": [
                            {
                                "candidate_id": "sc_media_rights:opportunity_signals",
                                "question_id": "sc_media_rights",
                                "promotion_target": "opportunity_signals",
                                "signal_type": "PROCUREMENT_SIGNAL",
                                "answer": "Major League Cricket is actively evaluating distribution and media-rights partnerships.",
                                "confidence": 0.88,
                                "evidence_url": "https://example.com/mlc-media-rights",
                                "promotion_candidate": True,
                            },
                            {
                                "candidate_id": "sc_sponsorship:opportunity_signals",
                                "question_id": "sc_sponsorship",
                                "promotion_target": "opportunity_signals",
                                "signal_type": "PROCUREMENT_SIGNAL",
                                "answer": "Major League Cricket is actively evaluating sponsorship and partnership expansion.",
                                "confidence": 0.86,
                                "evidence_url": "https://example.com/mlc-sponsorship",
                                "promotion_candidate": True,
                            },
                        ],
                        "discovery_summary": {
                            "promoted_count": 2,
                            "supporting_evidence_count": 2,
                            "promotion_targets": ["opportunity_signals"],
                            "opportunity_signals": [
                                {
                                    "candidate_id": "sc_media_rights:opportunity_signals",
                                    "question_id": "sc_media_rights",
                                    "promotion_target": "opportunity_signals",
                                    "signal_type": "PROCUREMENT_SIGNAL",
                                    "answer": "Major League Cricket is actively evaluating distribution and media-rights partnerships.",
                                    "confidence": 0.88,
                                    "evidence_url": "https://example.com/mlc-media-rights",
                                },
                                {
                                    "candidate_id": "sc_sponsorship:opportunity_signals",
                                    "question_id": "sc_sponsorship",
                                    "promotion_target": "opportunity_signals",
                                    "signal_type": "PROCUREMENT_SIGNAL",
                                    "answer": "Major League Cricket is actively evaluating sponsorship and partnership expansion.",
                                    "confidence": 0.86,
                                    "evidence_url": "https://example.com/mlc-sponsorship",
                                },
                            ],
                        },
                    },
                },
                "validated_signals": [],
                "episodes": [
                    {
                        "episode_id": "episode-dossier-multi",
                        "description": "Multiple dossier-derived opportunity promotions",
                        "source": "question_first_runner",
                    }
                ],
            },
        },
    )

    assert result["status"] == "materialized"
    assert result["materialized_count"] == 2
    assert len(svc.supabase_client.rows) == 2
    stored_question_ids = {
        payload["raw_payload"]["question_first_question_id"]
        for _, payload in svc.supabase_client.rows
    }
    assert stored_question_ids == {"sc_media_rights", "sc_sponsorship"}
