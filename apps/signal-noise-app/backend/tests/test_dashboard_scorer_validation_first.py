import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from types import SimpleNamespace

import pytest

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from dashboard_scorer import DashboardScorer


@pytest.mark.asyncio
async def test_maturity_uses_validated_evidence_before_hypothesis_prior():
    scorer = DashboardScorer()
    now = datetime.now(timezone.utc).isoformat()
    low_hypotheses = [
        SimpleNamespace(status="ACTIVE", confidence=0.25),
        SimpleNamespace(status="ACTIVE", confidence=0.30),
    ]
    signals = [
        {
            "type": "DIGITAL_TRANSFORMATION",
            "description": "Validated digital transformation roadmap",
            "confidence": 0.88,
            "validated": True,
            "timestamp": now,
        },
        {
            "type": "CRM_PLATFORM",
            "description": "Validated CRM modernization programme",
            "confidence": 0.82,
            "validated": True,
            "timestamp": now,
        },
    ]
    episodes = [
        {"episode_type": "DIGITAL_TRANSFORMATION", "timestamp": now},
        {"episode_type": "TECHNOLOGY_ADOPTED", "timestamp": now},
    ]

    maturity = await scorer._calculate_maturity_score(
        signals=signals,
        episodes=episodes,
        hypotheses=low_hypotheses,
    )

    assert maturity >= 45.0


@pytest.mark.asyncio
async def test_probability_prefers_validated_procurement_signals_and_small_hypothesis_modifier():
    scorer = DashboardScorer()
    now = datetime.now(timezone.utc)
    signals = [
        {
            "type": "PROCUREMENT_NOTICE",
            "description": "Validated procurement tender notice",
            "confidence": 0.9,
            "validated": True,
            "timestamp": (now - timedelta(days=5)).isoformat(),
        }
    ]
    episodes = [
        {
            "episode_type": "PROCUREMENT_ACTIVITY",
            "timestamp": (now - timedelta(days=3)).isoformat(),
        }
    ]
    weak_hypotheses = [SimpleNamespace(status="ACTIVE", confidence=0.55)]

    probability = await scorer._calculate_active_probability(
        hypotheses=weak_hypotheses,
        signals=signals,
        episodes=episodes,
        validated_rfps=None,
    )
    baseline = await scorer._calculate_active_probability(
        hypotheses=None,
        signals=None,
        episodes=None,
        validated_rfps=None,
    )

    assert probability > baseline
    assert probability < 0.50


@pytest.mark.asyncio
async def test_breakdowns_expose_evidence_source_weights():
    scorer = DashboardScorer()

    result = await scorer.calculate_entity_scores(
        entity_id="icf",
        entity_name="International Canoe Federation",
        signals=[],
        episodes=[],
        hypotheses=[SimpleNamespace(status="ACTIVE", confidence=0.6)],
        validated_rfps=None,
    )

    maturity = result["breakdown"]["maturity"]
    probability = result["breakdown"]["probability"]

    assert "validated_signal_weight" in maturity
    assert "temporal_weight" in maturity
    assert "hypothesis_prior_weight" in maturity
    assert "validated_signal_weight" in probability
    assert "temporal_weight" in probability
    assert "hypothesis_prior_weight" in probability


@pytest.mark.asyncio
async def test_validator_backed_monitoring_candidates_count_as_validated_evidence():
    scorer = DashboardScorer()
    now = datetime.now(timezone.utc)
    signals = [
        {
            "type": "MONITORING_CANDIDATE",
            "candidate_type": "procurement_signal",
            "description": "Procurement modernization tender programme for fan engagement platform",
            "confidence": 0.25,
            "validated": False,
            "timestamp": (now - timedelta(days=2)).isoformat(),
            "metadata": {
                "validation_result": {
                    "verdict": "relevant",
                    "confidence": 0.91,
                    "reason": "Clear procurement and modernization language",
                    "should_escalate": True,
                }
            },
        }
    ]

    maturity = await scorer._calculate_maturity_score(
        signals=signals,
        episodes=[],
        hypotheses=[],
    )
    probability = await scorer._calculate_active_probability(
        hypotheses=[],
        signals=signals,
        episodes=[],
        validated_rfps=None,
    )
    baseline_probability = await scorer._calculate_active_probability(
        hypotheses=[],
        signals=[],
        episodes=[],
        validated_rfps=None,
    )

    assert maturity > 25.0
    assert probability > baseline_probability
