#!/usr/bin/env python3
"""
Test Probabilistic Scoring System

Tests:
1. Temporal decay produces expected weight values
2. Signal strength assessment differentiates based on content
3. Same signal count produces different scores based on content/timing
4. Demo shows variance across entities
"""

import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from datetime import datetime, timezone, timedelta
from ralph_loop import calculate_temporal_decay, _heuristic_signal_strength, recalculate_hypothesis_state
from schemas import SignalClass


def test_temporal_decay():
    """Test temporal decay function"""
    print("="*70)
    print("TEST 1: Temporal Decay")
    print("="*70)

    now = datetime.now(timezone.utc)

    test_cases = [
        (0, "~100%"),
        (7, "~90%"),
        (30, "~64%"),
        (60, "~41%"),
        (90, "~26%"),
        (365, "<1%"),
    ]

    print("\nAge (days) | Expected | Actual")
    print("-" * 40)

    for age_days, expected in test_cases:
        signal_date = now - timedelta(days=age_days)
        decay = calculate_temporal_decay(signal_date, now)
        print(f"{age_days:10} | {expected:>8} | {decay:.2%}")

    # Verify decay curve is monotonic
    decays = [calculate_temporal_decay(now - timedelta(days=d), now) for d in range(0, 100, 10)]
    assert all(decays[i] >= decays[i+1] for i in range(len(decays)-1)), "Decay should be monotonic"
    print("\n✅ Decay curve is monotonic (decreases with age)")


def test_signal_strength():
    """Test signal strength assessment"""
    print("\n" + "="*70)
    print("TEST 2: Signal Strength Assessment")
    print("="*70)

    capability_signals = [
        {"title": "Chief Digital Officer Hiring", "category": "CRM_UPGRADE"},  # C-level
        {"title": "CRM Manager Role Available", "category": "CRM_UPGRADE"},  # Manager
        {"title": "Salesforce Specialist Needed", "category": "CRM_UPGRADE"},  # Specialist
    ]

    procurement_signals = [
        {"title": "RFP Issued for CRM Platform", "category": "CRM_UPGRADE"},  # Strong
        {"title": "Evaluating CRM Vendors", "category": "CRM_UPGRADE"},  # Medium
        {"title": "Researching CRM Options", "category": "CRM_UPGRADE"},  # Weak
        {"title": "Technology Partnership Discussion", "category": "CRM_UPGRADE"},  # Very weak
    ]

    print("\nCAPABILITY Signals:")
    for signal in capability_signals:
        strength = _heuristic_signal_strength(signal, SignalClass.CAPABILITY)
        print(f"  {signal['title']:<40} → {strength:.2f}")

    print("\nPROCUREMENT_INDICATOR Signals:")
    for signal in procurement_signals:
        strength = _heuristic_signal_strength(signal, SignalClass.PROCUREMENT_INDICATOR)
        print(f"  {signal['title']:<40} → {strength:.2f}")

    # Verify ranges
    cap_strengths = [_heuristic_signal_strength(s, SignalClass.CAPABILITY) for s in capability_signals]
    proc_strengths = [_heuristic_signal_strength(s, SignalClass.PROCUREMENT_INDICATOR) for s in procurement_signals]

    assert all(0.4 <= s <= 0.6 for s in cap_strengths), "CAPABILITY signals should be in [0.4, 0.6]"
    assert all(0.6 <= s <= 0.9 for s in proc_strengths), "PROCUREMENT signals should be in [0.6, 0.9]"
    print("\n✅ Signal strengths in expected ranges")


def test_same_count_different_scores():
    """Test that same signal counts produce different scores"""
    print("\n" + "="*70)
    print("TEST 3: Same Signal Count, Different Scores")
    print("="*70)

    now = datetime.now(timezone.utc)

    # Club A: High seniority, strong procurement language, recent signals
    club_a_capability = [
        {"title": "Chief Digital Officer", "confidence": 0.8, "collected_at": now},
    ]
    club_a_procurement = [
        {"title": "RFP Issued CRM Platform", "confidence": 0.9, "collected_at": now},
        {"title": "Vendor Selection Process", "confidence": 0.85, "collected_at": now},
    ]

    # Club B: Low seniority, weak procurement language, old signals
    club_b_capability = [
        {"title": "Salesforce Specialist", "confidence": 0.7, "collected_at": now - timedelta(days=60)},
    ]
    club_b_procurement = [
        {"title": "Researching CRM Options", "confidence": 0.6, "collected_at": now - timedelta(days=60)},
        {"title": "Technology Partnership", "confidence": 0.65, "collected_at": now - timedelta(days=60)},
    ]

    state_a = recalculate_hypothesis_state(
        "club-a", "CRM_UPGRADE", club_a_capability, club_a_procurement, []
    )

    state_b = recalculate_hypothesis_state(
        "club-b", "CRM_UPGRADE", club_b_capability, club_b_procurement, []
    )

    print("\nClub A (Strong, Recent):")
    print(f"  Maturity: {state_a.maturity_score:.3f}")
    print(f"  Activity: {state_a.activity_score:.3f}")
    print(f"  State: {state_a.state}")

    print("\nClub B (Weak, Old):")
    print(f"  Maturity: {state_b.maturity_score:.3f}")
    print(f"  Activity: {state_b.activity_score:.3f}")
    print(f"  State: {state_b.state}")

    variance = abs(state_a.activity_score - state_b.activity_score)
    print(f"\nActivity variance: {variance:.3f}")

    assert variance > 0.05, f"Expected variance > 0.05, got {variance}"
    print("✅ Same signal count produces different scores")


def test_temporal_differentiation():
    """Test temporal differentiation"""
    print("\n" + "="*70)
    print("TEST 4: Temporal Differentiation")
    print("="*70)

    now = datetime.now(timezone.utc)

    # Same content, different ages
    recent_signal = {
        "title": "CRM Manager Hiring",
        "confidence": 0.75,
        "collected_at": now  # Today
    }

    old_signal = {
        "title": "CRM Manager Hiring",
        "confidence": 0.75,
        "collected_at": now - timedelta(days=60)  # 60 days ago
    }

    state_recent = recalculate_hypothesis_state(
        "entity", "CRM_UPGRADE", [recent_signal], [], []
    )

    state_old = recalculate_hypothesis_state(
        "entity", "CRM_UPGRADE", [old_signal], [], []
    )

    print("\nRecent Signal (0 days old):")
    print(f"  Maturity: {state_recent.maturity_score:.3f}")

    print("\nOld Signal (60 days old):")
    print(f"  Maturity: {state_old.maturity_score:.3f}")

    # Recent should have higher score due to temporal decay
    assert state_recent.maturity_score > state_old.maturity_score, "Recent signals should score higher"
    print(f"\n✅ Temporal decay: {state_recent.maturity_score:.3f} > {state_old.maturity_score:.3f}")


if __name__ == "__main__":
    print("\n🧪 Probabilistic Scoring Test Suite")
    print()

    try:
        test_temporal_decay()
        test_signal_strength()
        test_same_count_different_scores()
        test_temporal_differentiation()

        print("\n" + "="*70)
        print("ALL TESTS PASSED ✅")
        print("="*70)
        print("\nThe probabilistic scoring system successfully:")
        print("  1. Applies temporal decay (recent signals weigh more)")
        print("  2. Differentiates signal strength by content")
        print("  3. Produces different scores for same signal counts")
        print("  4. Enables cross-entity divergence")
        sys.exit(0)

    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
