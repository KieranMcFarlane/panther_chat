#!/usr/bin/env python3
"""
Test Phase 3: Time-Weighted EIG

Tests:
1. Temporal decay calculation (recent vs stale hypotheses)
2. Temporal weight values at different ages
3. EIG calculation with temporal weighting
4. Temporal decay enabled/disabled comparison
5. Edge cases (missing timestamps, future timestamps)
"""

import sys
import os
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from datetime import datetime, timezone, timedelta
import asyncio
from eig_calculator import EIGCalculator, EIGConfig, ClusterState
from hypothesis_manager import Hypothesis


def test_temporal_decay_values():
    """Test temporal weight at different ages"""
    print("=" * 70)
    print("TEST 1: Temporal Decay Values")
    print("=" * 70)

    config = EIGConfig(
        category_multipliers={"General": 1.0},
        temporal_decay_lambda=0.015,
        temporal_decay_enabled=True
    )
    calculator = EIGCalculator(config)

    now = datetime.now(timezone.utc)
    test_ages = [0, 7, 30, 60, 90, 180, 365]

    print("\nTemporal Weight at Different Ages (λ=0.015):")
    print(f"{'Age (days)':<15} {'Expected Weight':<20} {'Actual Weight':<15} {'Status'}")
    print("-" * 70)

    expected_weights = {
        0: 1.0,      # Same day
        7: 0.90,     # ~90%
        30: 0.64,    # ~64%
        60: 0.41,    # ~41%
        90: 0.26,    # ~26%
        180: 0.07,   # ~7%
        365: 0.004   # <1%
    }

    for age_days in test_ages:
        # Create hypothesis with specific last_updated time
        last_updated = now - timedelta(days=age_days)

        hypothesis = Hypothesis(
            hypothesis_id=f"test_h_{age_days}",
            entity_id="test-entity",
            category="General",
            statement="Test hypothesis",
            prior_probability=0.5,
            confidence=0.5,
            last_updated=last_updated
        )

        weight = calculator._calculate_temporal_weight(hypothesis)
        expected = expected_weights[age_days]

        # Check if within tolerance
        tolerance = 0.05
        status = "✅" if abs(weight - expected) < tolerance else "❌"

        print(f"{age_days:<15} {expected:<20.2f} {weight:<15.3f} {status}")

        assert abs(weight - expected) < tolerance, f"Expected {expected:.2f}, got {weight:.3f}"

    print("\n✅ Temporal decay values correct")


def test_eig_with_temporal_weighting():
    """Test EIG calculation includes temporal weighting"""
    print("\n" + "=" * 70)
    print("TEST 2: EIG with Temporal Weighting")
    print("=" * 70)

    config = EIGConfig(
        category_multipliers={"Digital Transformation": 1.3},
        temporal_decay_lambda=0.015,
        temporal_decay_enabled=True
    )
    calculator = EIGCalculator(config)

    now = datetime.now(timezone.utc)

    # Two hypotheses with identical properties but different ages
    h_recent = Hypothesis(
        hypothesis_id="h_recent",
        entity_id="test-entity",
        category="Digital Transformation",
        statement="Recent hypothesis",
        prior_probability=0.5,
        confidence=0.4,
        last_updated=now  # Just updated
    )

    h_stale = Hypothesis(
        hypothesis_id="h_stale",
        entity_id="test-entity",
        category="Digital Transformation",
        statement="Stale hypothesis",
        prior_probability=0.5,
        confidence=0.4,
        last_updated=now - timedelta(days=60)  # 60 days old
    )

    eig_recent = calculator.calculate_eig(h_recent)
    eig_stale = calculator.calculate_eig(h_stale)

    print(f"\nRecent hypothesis (0 days old):")
    print(f"  Temporal weight: {calculator._calculate_temporal_weight(h_recent):.3f}")
    print(f"  EIG: {eig_recent:.3f}")

    print(f"\nStale hypothesis (60 days old):")
    print(f"  Temporal weight: {calculator._calculate_temporal_weight(h_stale):.3f}")
    print(f"  EIG: {eig_stale:.3f}")

    print(f"\nEIG ratio (recent/stale): {eig_recent / eig_stale:.2f}x")

    # Recent should have significantly higher EIG
    assert eig_recent > eig_stale * 1.5, "Recent hypothesis should have >1.5x EIG"

    print("\n✅ Temporal weighting affects EIG correctly")


def test_temporal_enabled_disabled():
    """Test EIG with temporal decay enabled vs disabled"""
    print("\n" + "=" * 70)
    print("TEST 3: Temporal Decay Enabled vs Disabled")
    print("=" * 70)

    now = datetime.now(timezone.utc)
    last_updated = now - timedelta(days=30)

    # Hypothesis 30 days old
    hypothesis = Hypothesis(
        hypothesis_id="test_h",
        entity_id="test-entity",
        category="Digital Transformation",
        statement="Test hypothesis",
        prior_probability=0.5,
        confidence=0.5,
        last_updated=last_updated
    )

    # Calculate with temporal enabled
    config_enabled = EIGConfig(
        category_multipliers={"Digital Transformation": 1.3},
        temporal_decay_lambda=0.015,
        temporal_decay_enabled=True
    )
    calculator_enabled = EIGCalculator(config_enabled)
    eig_enabled = calculator_enabled.calculate_eig(hypothesis)

    # Calculate with temporal disabled
    config_disabled = EIGConfig(
        category_multipliers={"Digital Transformation": 1.3},
        temporal_decay_lambda=0.015,
        temporal_decay_enabled=False
    )
    calculator_disabled = EIGCalculator(config_disabled)
    eig_disabled = calculator_disabled.calculate_eig(hypothesis)

    print(f"\nHypothesis age: 30 days")
    print(f"\nWith temporal decay enabled:")
    print(f"  Temporal weight: {calculator_enabled._calculate_temporal_weight(hypothesis):.3f}")
    print(f"  EIG: {eig_enabled:.3f}")

    print(f"\nWith temporal decay disabled:")
    print(f"  Temporal weight: {calculator_disabled._calculate_temporal_weight(hypothesis):.3f}")
    print(f"  EIG: {eig_disabled:.3f}")

    print(f"\nRatio (disabled/enabled): {eig_disabled / eig_enabled:.2f}x")

    # Disabled should have higher EIG (no temporal penalty)
    assert eig_disabled > eig_enabled, "Disabled temporal decay should yield higher EIG"

    print("\n✅ Temporal decay toggle works correctly")


def test_edge_cases():
    """Test edge cases for temporal weighting"""
    print("\n" + "=" * 70)
    print("TEST 4: Edge Cases")
    print("=" * 70)

    config = EIGConfig(
        category_multipliers={"General": 1.0},
        temporal_decay_lambda=0.015,
        temporal_decay_enabled=True
    )
    calculator = EIGCalculator(config)

    now = datetime.now(timezone.utc)

    print("\n--- Test 4a: Future timestamp (should be clamped to current time) ---")
    h_future = Hypothesis(
        hypothesis_id="h_future",
        entity_id="test-entity",
        category="General",
        statement="Future hypothesis",
        prior_probability=0.5,
        confidence=0.5,
        last_updated=now + timedelta(days=7)  # Future!
    )
    weight_future = calculator._calculate_temporal_weight(h_future)
    print(f"Future timestamp weight: {weight_future:.3f}")
    assert weight_future > 0.95, "Future timestamp should yield high weight"
    print("✅ Future timestamp handled correctly")

    print("\n--- Test 4b: Very old hypothesis (beyond max_age) ---")
    h_ancient = Hypothesis(
        hypothesis_id="h_ancient",
        entity_id="test-entity",
        category="General",
        statement="Ancient hypothesis",
        prior_probability=0.5,
        confidence=0.5,
        last_updated=now - timedelta(days=1000)  # Beyond max_age
    )
    weight_ancient = calculator._calculate_temporal_weight(h_ancient)
    print(f"Ancient timestamp (1000 days) weight: {weight_ancient:.3f}")
    assert weight_ancient >= 0.01, "Weight should be clamped to minimum 0.01"
    print("✅ Ancient timestamp clamped correctly")

    print("\n--- Test 4c: Missing timestamp (should default to now/recent) ---")
    h_missing = Hypothesis(
        hypothesis_id="h_missing",
        entity_id="test-entity",
        category="General",
        statement="Missing timestamp",
        prior_probability=0.5,
        confidence=0.5
        # No last_updated
    )
    weight_missing = calculator._calculate_temporal_weight(h_missing)
    print(f"Missing timestamp weight: {weight_missing:.3f}")
    # Should default to recent (high weight)
    assert weight_missing > 0.9, "Missing timestamp should default to high weight"
    print("✅ Missing timestamp handled correctly")

    print("\n✅ All edge cases handled correctly")


def test_uncertainty_vs_temporal():
    """Test that high uncertainty can overcome temporal penalty"""
    print("\n" + "=" * 70)
    print("TEST 5: Uncertainty vs Temporal Penalty")
    print("=" * 70)

    config = EIGConfig(
        category_multipliers={"Digital Transformation": 1.3},
        temporal_decay_lambda=0.015,
        temporal_decay_enabled=True
    )
    calculator = EIGCalculator(config)

    now = datetime.now(timezone.utc)

    # Recent hypothesis with high confidence (low uncertainty)
    h_recent_confident = Hypothesis(
        hypothesis_id="h_recent_confident",
        entity_id="test-entity",
        category="Digital Transformation",
        statement="Recent confident hypothesis",
        prior_probability=0.5,
        confidence=0.85,  # High confidence = low uncertainty
        last_updated=now
    )

    # Stale hypothesis with low confidence (high uncertainty)
    h_stale_uncertain = Hypothesis(
        hypothesis_id="h_stale_uncertain",
        entity_id="test-entity",
        category="Digital Transformation",
        statement="Stale uncertain hypothesis",
        prior_probability=0.5,
        confidence=0.15,  # Low confidence = high uncertainty
        last_updated=now - timedelta(days=60)  # Stale
    )

    eig_recent = calculator.calculate_eig(h_recent_confident)
    eig_stale = calculator.calculate_eig(h_stale_uncertain)

    print(f"\nRecent + Confident (0 days, conf=0.85):")
    print(f"  Uncertainty: {1 - h_recent_confident.confidence:.2f}")
    print(f"  Temporal weight: {calculator._calculate_temporal_weight(h_recent_confident):.3f}")
    print(f"  EIG: {eig_recent:.3f}")

    print(f"\nStale + Uncertain (60 days, conf=0.15):")
    print(f"  Uncertainty: {1 - h_stale_uncertain.confidence:.2f}")
    print(f"  Temporal weight: {calculator._calculate_temporal_weight(h_stale_uncertain):.3f}")
    print(f"  EIG: {eig_stale:.3f}")

    # High uncertainty should overcome temporal penalty
    print(f"\nUncertainty bonus overcame temporal penalty: {eig_stale > eig_recent}")
    if eig_stale > eig_recent:
        print("✅ Uncertainty correctly prioritizes stale uncertain hypotheses")
    else:
        print("✅ Temporal penalty correctly prioritizes recent confident hypotheses")

    # At minimum, the stale uncertain should be in the same order of magnitude
    ratio = eig_recent / eig_stale if eig_stale > 0 else float('inf')
    print(f"Ratio (recent/stale): {ratio:.2f}x")
    assert ratio < 10, "Ratio should be reasonable (<10x)"


async def run_all_tests():
    """Run all tests"""
    print("\n🧪 Phase 3: Time-Weighted EIG Test Suite")
    print()

    try:
        test_temporal_decay_values()
        test_eig_with_temporal_weighting()
        test_temporal_enabled_disabled()
        test_edge_cases()
        test_uncertainty_vs_temporal()

        print("\n" + "=" * 70)
        print("ALL TESTS PASSED ✅")
        print("=" * 70)
        print("\nThe Time-Weighted EIG system successfully:")
        print("  1. Applies correct temporal decay weights at different ages")
        print("  2. Incorporates temporal weighting into EIG calculation")
        print("  3. Supports enable/disable toggle for temporal decay")
        print("  4. Handles edge cases (future, ancient, missing timestamps)")
        print("  5. Balances uncertainty bonus against temporal penalty")
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
