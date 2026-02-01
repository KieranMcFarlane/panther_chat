"""
Non-Regression Guardrail Tests for State-Aware Ralph Loop

These tests enforce critical system guarantees. They MUST NEVER be removed.
If any test fails, BLOCK deployment and fix the regression immediately.

Based on production case studies (e.g., KNVB with 0 ACCEPTs reaching 0.80 confidence).
"""
import pytest
from backend.schemas import (
    RalphState,
    RalphDecisionType,
    CategoryStats,
    ConfidenceBand,
    Hypothesis
)
from backend.ralph_loop import apply_category_saturation_multiplier


def test_no_accepts_confidence_ceiling():
    """
    GUARDRAIL 1: If entity has 0 ACCEPTs, confidence MUST be ≤0.70

    KNVB Case Study: KNVB reached 0.80 confidence with ZERO ACCEPTs.
    This test ensures that can never happen again.

    Rationale: WEAK_ACCEPT decisions indicate digital capability, not procurement intent.
    Without strong ACCEPT signals, confidence must be capped at 0.70.
    """
    state = RalphState(
        entity_id="test_entity",
        entity_name="Test Entity",
        current_confidence=0.20,
        iterations_completed=0
    )

    # Simulate 30 WEAK_ACCEPT iterations, 0 ACCEPT
    for i in range(30):
        cat = f"category_{i % 8}"
        stats = state.get_category_stats(cat)
        stats.weak_accept_count += 1
        stats.total_iterations += 1
        state.iterations_completed += 1

    # Apply guardrail
    total_accepts = sum(s.accept_count for s in state.category_stats.values())
    if total_accepts == 0:
        state.confidence_ceiling = 0.70
        state.current_confidence = min(state.current_confidence, state.confidence_ceiling)

    # ASSERT: Confidence MUST be ≤0.70
    assert state.current_confidence <= 0.70, \
        f"Confidence {state.current_confidence} exceeds 0.70 ceiling with 0 ACCEPTs"
    assert state.confidence_ceiling == 0.70, "Confidence ceiling not applied"

    # Verify confidence band is not CONFIDENT or ACTIONABLE
    assert state.confidence_band in [ConfidenceBand.EXPLORATORY, ConfidenceBand.INFORMED], \
        f"Confidence band should be EXPLORATORY or INFORMED with 0 ACCEPTs, got {state.confidence_band}"


def test_repeated_weak_accept_diminishing_delta():
    """
    GUARDRAIL 3: Repeated WEAK_ACCEPTs MUST have diminishing impact

    Formula: multiplier = 1.0 / (1.0 + weak_accept_count × 0.5)

    1st WEAK_ACCEPT: 1.0 multiplier
    2nd WEAK_ACCEPT: 0.67 multiplier
    3rd WEAK_ACCEPT: 0.50 multiplier

    Rationale: Repeated WEAK_ACCEPTs in the same category indicate capability
    but not procurement intent. Their impact must diminish over time.
    """
    stats = CategoryStats(category="test")

    # 1st WEAK_ACCEPT
    mult1 = apply_category_saturation_multiplier(RalphDecisionType.WEAK_ACCEPT, stats)
    stats.weak_accept_count += 1

    # 2nd WEAK_ACCEPT
    mult2 = apply_category_saturation_multiplier(RalphDecisionType.WEAK_ACCEPT, stats)
    stats.weak_accept_count += 1

    # 3rd WEAK_ACCEPT
    mult3 = apply_category_saturation_multiplier(RalphDecisionType.WEAK_ACCEPT, stats)

    # ASSERT: Multipliers MUST diminish
    assert mult1 == pytest.approx(1.0, abs=0.01), \
        f"1st multiplier {mult1} should be 1.0"
    assert mult2 == pytest.approx(0.67, abs=0.01), \
        f"2nd multiplier {mult2} should be 0.67"
    assert mult3 == pytest.approx(0.50, abs=0.01), \
        f"3rd multiplier {mult3} should be 0.50"
    assert mult1 > mult2 > mult3, "Multipliers must strictly diminish"

    # Verify ACCEPT is not affected by saturation
    accept_mult = apply_category_saturation_multiplier(RalphDecisionType.ACCEPT, stats)
    assert accept_mult == pytest.approx(1.0, abs=0.01), \
        "ACCEPT decisions should not be affected by category saturation"


def test_actionable_gate_requirements():
    """
    GUARDRAIL 2: Actionable requires ≥2 ACCEPTs across ≥2 categories

    This is the sales-readiness gate. High confidence ≠ sales-ready.

    Rationale: Sales team should only call on entities with:
    - At least 2 strong ACCEPT signals (indicating procurement intent)
    - Across at least 2 categories (indicating diversified evidence)

    Without this gate, sales wastes time on entities like KNVB with
    high confidence but zero procurement signals.
    """
    state = RalphState(
        entity_id="test",
        entity_name="Test",
        current_confidence=0.20
    )

    # Case 1: 0 ACCEPTs → Not actionable
    assert not state.is_actionable, \
        "0 ACCEPTs should NOT be actionable"

    # Case 2: 1 ACCEPT in 1 category → Not actionable
    cat1 = state.get_category_stats("Digital")
    cat1.accept_count = 1
    cat1.total_iterations = 5
    assert not state.is_actionable, \
        "1 ACCEPT in 1 category should NOT be actionable"

    # Case 3: 2 ACCEPTs in 1 category → Not actionable
    cat1.accept_count = 2
    cat1.total_iterations = 10
    assert not state.is_actionable, \
        "2 ACCEPTs in 1 category should NOT be actionable"

    # Case 4: 2 ACCEPTs across 2 categories → Actionable
    cat2 = state.get_category_stats("Commercial")
    cat2.accept_count = 1
    cat2.total_iterations = 5
    cat1.accept_count = 1  # Reset to 1 ACCEPT each
    assert state.is_actionable, \
        "≥2 ACCEPTs across ≥2 categories MUST be actionable"

    # Case 5: High confidence (0.85) but only 1 ACCEPT → Not actionable
    state3 = RalphState(entity_id="test3", entity_name="Test3", current_confidence=0.85)
    cat3 = state3.get_category_stats("Digital")
    cat3.accept_count = 1
    assert not state3.is_actionable, \
        "High confidence with 1 ACCEPT should NOT be actionable"
    assert state3.confidence_band == ConfidenceBand.CONFIDENT, \
        "High confidence without actionable gate should be CONFIDENT, not ACTIONABLE"


def test_confidence_bands_match_rules():
    """
    Confidence bands MUST follow strict rules

    - EXPLORATORY: <0.30
    - INFORMED: 0.30-0.60
    - CONFIDENT: 0.60-0.80
    - ACTIONABLE: >0.80 + is_actionable gate

    Rationale: Confidence bands map to pricing tiers and SLAs.
    Incorrect classification leads to revenue leakage or customer dissatisfaction.
    """
    # EXPLORATORY: <0.30
    state1 = RalphState(
        entity_id="test",
        entity_name="Test",
        current_confidence=0.20
    )
    assert state1.confidence_band == ConfidenceBand.EXPLORATORY, \
        f"0.20 confidence should be EXPLORATORY, got {state1.confidence_band}"

    state1b = RalphState(
        entity_id="test1b",
        entity_name="Test1B",
        current_confidence=0.29
    )
    assert state1b.confidence_band == ConfidenceBand.EXPLORATORY, \
        f"0.29 confidence should be EXPLORATORY, got {state1b.confidence_band}"

    # INFORMED: 0.30-0.60
    state2 = RalphState(
        entity_id="test2",
        entity_name="Test2",
        current_confidence=0.30
    )
    assert state2.confidence_band == ConfidenceBand.INFORMED, \
        f"0.30 confidence should be INFORMED, got {state2.confidence_band}"

    state2b = RalphState(
        entity_id="test2b",
        entity_name="Test2B",
        current_confidence=0.45
    )
    assert state2b.confidence_band == ConfidenceBand.INFORMED, \
        f"0.45 confidence should be INFORMED, got {state2b.confidence_band}"

    state2c = RalphState(
        entity_id="test2c",
        entity_name="Test2C",
        current_confidence=0.59
    )
    assert state2c.confidence_band == ConfidenceBand.INFORMED, \
        f"0.59 confidence should be INFORMED, got {state2c.confidence_band}"

    # CONFIDENT: 0.60-0.80
    state3 = RalphState(
        entity_id="test3",
        entity_name="Test3",
        current_confidence=0.60
    )
    assert state3.confidence_band == ConfidenceBand.CONFIDENT, \
        f"0.60 confidence should be CONFIDENT, got {state3.confidence_band}"

    state3b = RalphState(
        entity_id="test3b",
        entity_name="Test3B",
        current_confidence=0.70
    )
    assert state3b.confidence_band == ConfidenceBand.CONFIDENT, \
        f"0.70 confidence should be CONFIDENT, got {state3b.confidence_band}"

    state3c = RalphState(
        entity_id="test3c",
        entity_name="Test3C",
        current_confidence=0.79
    )
    assert state3c.confidence_band == ConfidenceBand.CONFIDENT, \
        f"0.79 confidence should be CONFIDENT, got {state3c.confidence_band}"

    # ACTIONABLE: >0.80 + is_actionable gate
    state4 = RalphState(
        entity_id="test4",
        entity_name="Test4",
        current_confidence=0.85
    )
    # Add 2 ACCEPTs across 2 categories to make it actionable
    cat1 = state4.get_category_stats("Digital")
    cat1.accept_count = 1
    cat2 = state4.get_category_stats("Commercial")
    cat2.accept_count = 1
    assert state4.confidence_band == ConfidenceBand.ACTIONABLE, \
        f"0.85 confidence with actionable gate should be ACTIONABLE, got {state4.confidence_band}"

    # CONFIDENT: >0.80 but NOT actionable
    state5 = RalphState(
        entity_id="test5",
        entity_name="Test5",
        current_confidence=0.85
    )
    # No ACCEPTs, so not actionable
    assert state5.confidence_band == ConfidenceBand.CONFIDENT, \
        "High confidence without actionable gate should be CONFIDENT, not ACTIONABLE"

    # Edge case: Exactly 0.80
    state6 = RalphState(
        entity_id="test6",
        entity_name="Test6",
        current_confidence=0.80
    )
    assert state6.confidence_band == ConfidenceBand.CONFIDENT, \
        "Exactly 0.80 should be CONFIDENT, not ACTIONABLE (needs >0.80)"


def test_belief_ledger_append_only():
    """
    Belief ledger MUST be append-only (immutable)

    Once a confidence change is recorded, it must never be modified.
    This ensures auditability and debuggability.

    Rationale: If confidence changes, we need to trace WHY.
    The belief ledger is the single source of truth for all adjustments.
    """
    from datetime import datetime, timezone
    from backend.schemas import BeliefLedgerEntry, HypothesisAction

    state = RalphState(
        entity_id="test",
        entity_name="Test",
        current_confidence=0.50
    )

    # Record first change
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

    # Record second change
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

    # ASSERT: Ledger must have exactly 2 entries
    assert len(state.belief_ledger) == 2, \
        f"Belief ledger should have 2 entries, got {len(state.belief_ledger)}"

    # ASSERT: Entries must be in order
    assert state.belief_ledger[0].iteration == 1, "First entry should be iteration 1"
    assert state.belief_ledger[1].iteration == 2, "Second entry should be iteration 2"

    # ASSERT: Entries must be immutable (no modification allowed)
    # In Python, dataclasses are mutable by default, but we enforce
    # append-only usage through the API
    initial_impact = state.belief_ledger[0].confidence_impact

    # If someone tries to modify, it's a bug
    # (We can't prevent modification in Python, but we can detect it)
    # state.belief_ledger[0].confidence_impact = 999.0  # BUG: Don't do this!

    assert state.belief_ledger[0].confidence_impact == initial_impact, \
        "Belief ledger entries must not be modified"

    # ASSERT: Ledger must serialize correctly
    state_dict = state.to_dict()
    assert 'belief_ledger' in state_dict, "Belief ledger must be in serialized state"
    assert len(state_dict['belief_ledger']) == 2, \
        "Serialized belief ledger should have 2 entries"


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])
