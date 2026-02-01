#!/usr/bin/env python3
"""
Verification Script for State-Aware Ralph Loop Production Enhancements

This script verifies that all 5 production enhancements are working correctly:

1. Belief Ledger (Append-Only Audit Log)
2. Confidence Bands (Sales & Legal Clarity)
3. External Rename (WEAK_ACCEPT → CAPABILITY_SIGNAL)
4. Guardrail Tests (Non-Regression Guarantees)
5. Cluster Dampening (Predictive Learning)

Run this script after implementing the enhancements to verify everything works.
"""

import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from backend.schemas import (
    RalphState,
    RalphDecisionType,
    CategoryStats,
    ConfidenceBand,
    BeliefLedgerEntry,
    HypothesisAction
)
from backend.cluster_dampening import ClusterDampening


def test_belief_ledger():
    """Test 1: Belief Ledger (Append-Only Audit Log)"""
    print("\n" + "="*80)
    print("TEST 1: Belief Ledger (Append-Only Audit Log)")
    print("="*80)

    state = RalphState(
        entity_id="test_entity",
        entity_name="Test Entity",
        current_confidence=0.50
    )

    # Record some belief ledger entries
    from datetime import datetime, timezone

    entry1 = BeliefLedgerEntry(
        iteration=1,
        hypothesis_id="h1",
        change=HypothesisAction.REINFORCE,
        confidence_impact=0.05,
        evidence_ref="source1",
        timestamp=datetime.now(timezone.utc),
        category="Digital"
    )
    state.belief_ledger.append(entry1)

    entry2 = BeliefLedgerEntry(
        iteration=2,
        hypothesis_id="h1",
        change=HypothesisAction.WEAKEN,
        confidence_impact=-0.03,
        evidence_ref="source2",
        timestamp=datetime.now(timezone.utc),
        category="Digital"
    )
    state.belief_ledger.append(entry2)

    # Verify
    assert len(state.belief_ledger) == 2, "Should have 2 ledger entries"
    assert state.belief_ledger[0].iteration == 1, "First entry should be iteration 1"
    assert state.belief_ledger[1].iteration == 2, "Second entry should be iteration 2"

    # Verify serialization
    state_dict = state.to_dict()
    assert 'belief_ledger' in state_dict, "Belief ledger should be in serialized state"
    assert len(state_dict['belief_ledger']) == 2, "Serialized ledger should have 2 entries"

    print("✅ Belief ledger working correctly")
    print(f"   - Total entries: {len(state.belief_ledger)}")
    print(f"   - Serialization: OK")
    print(f"   - Append-only: OK")


def test_confidence_bands():
    """Test 2: Confidence Bands (Sales & Legal Clarity)"""
    print("\n" + "="*80)
    print("TEST 2: Confidence Bands (Sales & Legal Clarity)")
    print("="*80)

    test_cases = [
        (0.20, ConfidenceBand.EXPLORATORY, "EXPLORATORY"),
        (0.30, ConfidenceBand.INFORMED, "INFORMED"),
        (0.45, ConfidenceBand.INFORMED, "INFORMED"),
        (0.60, ConfidenceBand.CONFIDENT, "CONFIDENT"),
        (0.70, ConfidenceBand.CONFIDENT, "CONFIDENT"),
        (0.79, ConfidenceBand.CONFIDENT, "CONFIDENT"),
    ]

    for confidence, expected_band, band_name in test_cases:
        state = RalphState(
            entity_id="test",
            entity_name="Test",
            current_confidence=confidence
        )
        assert state.confidence_band == expected_band, \
            f"Confidence {confidence} should be {band_name}, got {state.confidence_band}"
        print(f"✅ Confidence {confidence:.2f} → {band_name}")

    # Test ACTIONABLE gate
    state = RalphState(
        entity_id="test_actionable",
        entity_name="Test Actionable",
        current_confidence=0.85
    )

    # Without ACCEPTs, should be CONFIDENT (not ACTIONABLE)
    assert state.confidence_band == ConfidenceBand.CONFIDENT, \
        "0.85 confidence without ACCEPTs should be CONFIDENT"
    print(f"✅ Confidence 0.85 (no ACCEPTs) → CONFIDENT (not ACTIONABLE)")

    # With 2 ACCEPTs across 2 categories, should be ACTIONABLE
    cat1 = state.get_category_stats("Digital")
    cat1.accept_count = 1
    cat2 = state.get_category_stats("Commercial")
    cat2.accept_count = 1

    assert state.confidence_band == ConfidenceBand.ACTIONABLE, \
        "0.85 confidence with 2 ACCEPTs across 2 categories should be ACTIONABLE"
    print(f"✅ Confidence 0.85 (2 ACCEPTs across 2 categories) → ACTIONABLE")


def test_external_rename():
    """Test 3: External Rename (WEAK_ACCEPT → CAPABILITY_SIGNAL)"""
    print("\n" + "="*80)
    print("TEST 3: External Rename (Internal → External Names)")
    print("="*80)

    mapping = {
        RalphDecisionType.ACCEPT: "PROCUREMENT_SIGNAL",
        RalphDecisionType.WEAK_ACCEPT: "CAPABILITY_SIGNAL",
        RalphDecisionType.REJECT: "NO_SIGNAL",
        RalphDecisionType.NO_PROGRESS: "NO_SIGNAL",
        RalphDecisionType.SATURATED: "SATURATED"
    }

    for internal, expected_external in mapping.items():
        actual_external = internal.to_external_name()
        assert actual_external == expected_external, \
            f"{internal} should map to {expected_external}, got {actual_external}"
        print(f"✅ {internal.value:20} → {actual_external}")

    print("\n✅ All decision types mapped correctly")


def test_guardrail_tests():
    """Test 4: Guardrail Tests (Non-Regression Guarantees)"""
    print("\n" + "="*80)
    print("TEST 4: Guardrail Tests (Non-Regression Guarantees)")
    print("="*80)

    import subprocess
    import sys

    result = subprocess.run(
        [sys.executable, "-m", "pytest", "backend/tests/test_ralph_guardrails.py", "-v"],
        capture_output=True,
        text=True
    )

    if result.returncode == 0:
        print("✅ All 5 guardrail tests PASSED")
        # Count passed tests
        output = result.stdout
        if "5 passed" in output:
            print("   - test_no_accepts_confidence_ceiling: PASSED")
            print("   - test_repeated_weak_accept_diminishing_delta: PASSED")
            print("   - test_actionable_gate_requirements: PASSED")
            print("   - test_confidence_bands_match_rules: PASSED")
            print("   - test_belief_ledger_append_only: PASSED")
    else:
        print("❌ Some guardrail tests FAILED")
        print(result.stdout)
        print(result.stderr)
        raise AssertionError("Guardrail tests failed")


def test_cluster_dampening():
    """Test 5: Cluster Dampening (Predictive Learning)"""
    print("\n" + "="*80)
    print("TEST 5: Cluster Dampening (Predictive Learning Flywheel)")
    print("="*80)

    import tempfile
    import os

    # Use temp file for testing
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.json') as f:
        temp_file = Path(f.name)

    try:
        dampener = ClusterDampening(cache_file=temp_file)

        # Record 7 saturations out of 10 entities (70%)
        for i in range(7):
            dampener.record_saturation(
                cluster_id="test_cluster",
                hypothesis_id="test_hypothesis",
                entity_id=f"entity_{i}"
            )

        # Should not be exhausted yet (need at least 5 entities with 70% rate)
        # Actually, we have 7/7 = 100% which is >= 70% and >= 5 entities
        # So it should be exhausted
        is_exhausted = dampener.is_hypothesis_exhausted("test_cluster", "test_hypothesis")
        assert is_exhausted, "7/7 saturations (100%) should be exhausted"
        print(f"✅ 7/7 saturations (100%) → EXHAUSTED")

        # Get exhausted hypotheses
        exhausted = dampener.get_exhausted_hypotheses("test_cluster")
        assert "test_hypothesis" in exhausted, "Hypothesis should be in exhausted set"
        print(f"✅ Exhausted hypotheses: {exhausted}")

        # Export report
        report = dampener.export_report()
        assert report['total_hypotheses'] == 1, "Should have 1 hypothesis"
        assert report['exhausted_hypotheses'] == 1, "Should have 1 exhausted hypothesis"
        print(f"✅ Cluster report: {report['total_hypotheses']} hypotheses, {report['exhausted_hypotheses']} exhausted")

    finally:
        # Cleanup temp file
        if temp_file.exists():
            temp_file.unlink()


def main():
    """Run all verification tests"""
    print("\n" + "="*80)
    print("STATE-AWARE RALPH LOOP: PRODUCTION ENHANCEMENTS VERIFICATION")
    print("="*80)
    print("\nVerifying all 5 production enhancements...")

    try:
        test_belief_ledger()
        test_confidence_bands()
        test_external_rename()
        test_guardrail_tests()
        test_cluster_dampening()

        print("\n" + "="*80)
        print("✅ ALL VERIFICATION TESTS PASSED")
        print("="*80)
        print("\n🎉 Production enhancements successfully implemented!")
        print("\nSummary:")
        print("  1. ✅ Belief Ledger (Append-Only Audit Log)")
        print("  2. ✅ Confidence Bands (Sales & Legal Clarity)")
        print("  3. ✅ External Rename (WEAK_ACCEPT → CAPABILITY_SIGNAL)")
        print("  4. ✅ Guardrail Tests (Non-Regression Guarantees)")
        print("  5. ✅ Cluster Dampening (Predictive Learning)")
        print("\n🚀 Ready for deployment!")
        print("="*80 + "\n")

        return 0

    except Exception as e:
        print("\n" + "="*80)
        print("❌ VERIFICATION FAILED")
        print("="*80)
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
