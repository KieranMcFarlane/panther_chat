#!/usr/bin/env python3
"""
Test Phase 4: Three-Axis Dashboard Scoring

Tests:
1. Procurement Maturity Score calculation
2. Active Procurement Probability calculation
3. Sales Readiness Level determination
4. Confidence interval calculation
5. Batch scoring multiple entities
"""

import sys
import os
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from datetime import datetime, timezone, timedelta
import asyncio
from dashboard_scorer import (
    DashboardScorer,
    ScoringConfig,
    SalesReadiness,
    score_entities_batch
)
from hypothesis_manager import Hypothesis


async def test_procurement_maturity():
    """Test Procurement Maturity Score calculation"""
    print("=" * 70)
    print("TEST 1: Procurement Maturity Score")
    print("=" * 70)

    scorer = DashboardScorer()

    now = datetime.now(timezone.utc)

    # Create test episodes
    episodes = [
        {"episode_type": "TECHNOLOGY_ADOPTED", "timestamp": now.isoformat()},
        {"episode_type": "DIGITAL_TRANSFORMATION", "timestamp": now.isoformat()},
        {"episode_type": "CRM_IMPLEMENTATION", "timestamp": now.isoformat()},
        {"episode_type": "C_SUITE_HIRING", "timestamp": now.isoformat()},
        {"episode_type": "PARTNERSHIP", "timestamp": now.isoformat()},
    ]

    maturity = await scorer._calculate_maturity_score(episodes=episodes)

    print(f"\nEpisodes: {len(episodes)}")
    print(f"Capability Score: {await scorer._score_capability_signals(episodes=episodes)}")
    print(f"Initiative Score: {await scorer._score_digital_initiatives(episodes=episodes)}")
    print(f"Partnership Score: {await scorer._score_partnership_activity(episodes=episodes)}")
    print(f"Executive Score: {await scorer._score_executive_changes(episodes=episodes)}")
    print(f"\nTotal Maturity: {maturity:.1f}/100")

    assert 0 <= maturity <= 100, "Maturity should be 0-100"

    print("\n✅ Procurement Maturity Score calculated correctly")


async def test_active_probability():
    """Test Active Procurement Probability calculation"""
    print("\n" + "=" * 70)
    print("TEST 2: Active Procurement Probability")
    print("=" * 70)

    scorer = DashboardScorer()

    now = datetime.now(timezone.utc)

    # Test with validated RFP (should get bonus)
    validated_rfps = [{"rfp_id": "rfp1", "title": "CRM Procurement"}]

    probability = await scorer._calculate_active_probability(
        validated_rfps=validated_rfps
    )

    print(f"\nWith validated RFP: {probability*100:.1f}%")

    assert probability >= 0.40, "Validated RFP should give >= 40% probability"

    # Test without RFP
    probability_no_rfp = await scorer._calculate_active_probability(
        validated_rfps=None
    )

    print(f"Without validated RFP: {probability_no_rfp*100:.1f}%")

    assert probability_no_rfp < probability, "Probability should be lower without RFP"

    print("\n✅ Active Procurement Probability calculated correctly")


async def test_sales_readiness_levels():
    """Test Sales Readiness Level determination"""
    print("\n" + "=" * 70)
    print("TEST 3: Sales Readiness Levels")
    print("=" * 70)

    scorer = DashboardScorer()

    test_cases = [
        {
            "name": "LIVE (RFP detected)",
            "maturity": 50.0,
            "probability": 0.20,
            "rfps": [{"rfp_id": "rfp1"}],
            "expected": SalesReadiness.LIVE
        },
        {
            "name": "HIGH_PRIORITY (high maturity, high probability)",
            "maturity": 85.0,
            "probability": 0.80,
            "rfps": None,
            "expected": SalesReadiness.HIGH_PRIORITY
        },
        {
            "name": "ENGAGE (moderate maturity, moderate probability)",
            "maturity": 65.0,
            "probability": 0.50,
            "rfps": None,
            "expected": SalesReadiness.ENGAGE
        },
        {
            "name": "MONITOR (baseline maturity)",
            "maturity": 45.0,
            "probability": 0.15,
            "rfps": None,
            "expected": SalesReadiness.MONITOR
        },
        {
            "name": "NOT_READY (low everything)",
            "maturity": 20.0,
            "probability": 0.10,
            "rfps": None,
            "expected": SalesReadiness.NOT_READY
        }
    ]

    print(f"\n{'Test Case':<30} {'Maturity':<12} {'Probability':<12} {'Expected':<15} {'Actual':<15} {'Status'}")
    print("-" * 70)

    for tc in test_cases:
        readiness = scorer._determine_sales_readiness(
            tc["maturity"],
            tc["probability"],
            tc["rfps"]
        )

        status = "✅" if readiness == tc["expected"] else "❌"

        print(f"{tc['name']:<30} {tc['maturity']:<12.1f} {tc['probability']*100:<12.0f} "
              f"{tc['expected'].value:<15} {readiness.value:<15} {status}")

        assert readiness == tc["expected"], f"Expected {tc['expected']}, got {readiness}"

    print("\n✅ Sales Readiness Levels determined correctly")


async def test_confidence_intervals():
    """Test confidence interval calculation"""
    print("\n" + "=" * 70)
    print("TEST 4: Confidence Intervals")
    print("=" * 70)

    scorer = DashboardScorer()

    now = datetime.now(timezone.utc)

    # Create hypotheses
    hypotheses = [
        Hypothesis(
            hypothesis_id="h1",
            entity_id="test-entity",
            category="Test",
            statement="Test hypothesis",
            prior_probability=0.5,
            confidence=0.6,
            last_updated=now
        )
    ]

    ci = scorer._calculate_confidence_interval(50.0, 0.30, hypotheses)

    print(f"\nConfidence Level: {ci['confidence_level']}")
    print(f"Maturity Range: {ci['maturity_range']}")
    print(f"Probability Range: {ci['probability_range']}")

    assert 0 < ci['confidence_level'] <= 1, "Confidence level should be 0-1"
    assert len(ci['maturity_range']) == 2, "Maturity range should have 2 values"
    assert len(ci['probability_range']) == 2, "Probability range should have 2 values"

    print("\n✅ Confidence Intervals calculated correctly")


async def test_hypothesis_based_scoring():
    """Test scoring based on hypotheses rather than signals"""
    print("\n" + "=" * 70)
    print("TEST 5: Hypothesis-Based Scoring")
    print("=" * 70)

    scorer = DashboardScorer()

    now = datetime.now(timezone.utc)

    # Create hypotheses with different confidence levels
    hypotheses = [
        Hypothesis(
            hypothesis_id="h1",
            entity_id="test-entity",
            category="Digital Transformation",
            statement="High confidence hypothesis",
            prior_probability=0.5,
            confidence=0.80,
            last_updated=now - timedelta(days=7),
            status="ACTIVE"
        ),
        Hypothesis(
            hypothesis_id="h2",
            entity_id="test-entity",
            category="CRM Implementation",
            statement="Medium confidence hypothesis",
            prior_probability=0.5,
            confidence=0.50,
            last_updated=now - timedelta(days=14),
            status="ACTIVE"
        ),
        Hypothesis(
            hypothesis_id="h3",
            entity_id="test-entity",
            category="Data Analytics",
            statement="Low confidence hypothesis",
            prior_probability=0.5,
            confidence=0.25,
            last_updated=now - timedelta(days=30),
            status="ACTIVE"
        )
    ]

    # Calculate maturity from hypotheses
    maturity = await scorer._maturity_from_hypotheses(hypotheses)

    # Calculate EIG confidence
    eig_conf = await scorer._calculate_eig_confidence(hypotheses)

    print(f"\nHypotheses: {len(hypotheses)}")
    print(f"Average Confidence: {sum(h.confidence for h in hypotheses) / len(hypotheses):.2f}")
    print(f"Maturity Score: {maturity:.1f}/100")
    print(f"EIG Confidence: {eig_conf:.2f}")

    assert 40 <= maturity <= 60, f"Maturity should be around 50, got {maturity}"
    assert eig_conf > 0, "EIG confidence should be positive"

    print("\n✅ Hypothesis-based scoring works correctly")


async def test_full_scoring():
    """Test full scoring pipeline"""
    print("\n" + "=" * 70)
    print("TEST 6: Full Scoring Pipeline")
    print("=" * 70)

    scorer = DashboardScorer()

    now = datetime.now(timezone.utc)

    # Create complete test data
    hypotheses = [
        Hypothesis(
            hypothesis_id="dt_procurement",
            entity_id="test-entity",
            category="Digital Transformation",
            statement="Digital transformation procurement",
            prior_probability=0.5,
            confidence=0.70,
            last_updated=now - timedelta(days=7),
            status="ACTIVE"
        )
    ]

    episodes = [
        {
            "episode_id": "ep1",
            "entity_id": "test-entity",
            "episode_type": "DIGITAL_TRANSFORMATION",
            "description": "DT initiative",
            "timestamp": now.isoformat(),
            "confidence_score": 0.8
        },
        {
            "episode_id": "ep2",
            "entity_id": "test-entity",
            "episode_type": "TECHNOLOGY_ADOPTED",
            "description": "New CRM",
            "timestamp": (now - timedelta(days=30)).isoformat(),
            "confidence_score": 0.7
        }
    ]

    scores = await scorer.calculate_entity_scores(
        entity_id="test-entity",
        entity_name="Test Entity",
        hypotheses=hypotheses,
        episodes=episodes
    )

    print(f"\n{'Metric':<25} {'Value'}")
    print("-" * 40)
    print(f"{'Procurement Maturity':<25} {scores['procurement_maturity']}/100")
    print(f"{'Active Probability':<25} {scores['active_probability']*100:.1f}%")
    print(f"{'Sales Readiness':<25} {scores['sales_readiness']}")
    print(f"{'Confidence Level':<25} {scores['confidence_interval']['confidence_level']*100:.0f}%")

    print(f"\nMaturity Breakdown:")
    for key, value in scores['breakdown']['maturity'].items():
        print(f"  {key}: {value}")

    print(f"\nProbability Breakdown:")
    for key, value in scores['breakdown']['probability'].items():
        print(f"  {key}: {value}")

    assert 0 <= scores['procurement_maturity'] <= 100, "Maturity should be 0-100"
    assert 0 <= scores['active_probability'] <= 1, "Probability should be 0-1"
    assert scores['sales_readiness'] in [r.value for r in SalesReadiness], "Valid readiness level"

    print("\n✅ Full scoring pipeline works correctly")


async def run_all_tests():
    """Run all tests"""
    print("\n🧪 Phase 4: Three-Axis Dashboard Scoring Test Suite")
    print()

    try:
        await test_procurement_maturity()
        await test_active_probability()
        await test_sales_readiness_levels()
        await test_confidence_intervals()
        await test_hypothesis_based_scoring()
        await test_full_scoring()

        print("\n" + "=" * 70)
        print("ALL TESTS PASSED ✅")
        print("=" * 70)
        print("\nThe Three-Axis Dashboard Scoring system successfully:")
        print("  1. Calculates Procurement Maturity Score (0-100)")
        print("  2. Calculates Active Procurement Probability (6-month)")
        print("  3. Determines Sales Readiness Level (5 levels)")
        print("  4. Provides confidence intervals for scores")
        print("  5. Scores based on hypotheses or signals/episodes")
        print("  6. Runs complete end-to-end scoring pipeline")
        sys.exit(0)

    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(run_all_tests())
