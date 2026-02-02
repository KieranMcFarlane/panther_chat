#!/usr/bin/env python3
"""
Simplified Hypothesis-Driven Discovery System Test

Tests the core hypothesis system without database dependencies.
Uses in-memory storage for demonstration.

Usage:
    python backend/test_hypothesis_system_simple.py
"""

import asyncio
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def test_hypothesis_manager():
    """Test hypothesis manager without database"""
    from backend.hypothesis_manager import HypothesisManager

    print("\n=== Test 1: Hypothesis Manager (In-Memory) ===\n")

    # Initialize manager without repository (in-memory only)
    manager = HypothesisManager(repository=None)

    # Create test hypotheses manually (no template loading)
    from backend.hypothesis_manager import Hypothesis

    hypotheses = [
        Hypothesis(
            hypothesis_id="test_crm_procurement",
            entity_id="test-arsenal-fc",
            category="CRM Implementation",
            statement="Arsenal FC is preparing CRM procurement",
            prior_probability=0.5,
            confidence=0.42
        ),
        Hypothesis(
            hypothesis_id="test_digital_transform",
            entity_id="test-arsenal-fc",
            category="Digital Transformation",
            statement="Arsenal FC is undergoing digital transformation",
            prior_probability=0.5,
            confidence=0.85
        ),
        Hypothesis(
            hypothesis_id="test_c_suite_hire",
            entity_id="test-arsenal-fc",
            category="C-Suite Hiring",
            statement="Arsenal FC is hiring CTO",
            prior_probability=0.5,
            confidence=0.50
        )
    ]

    # Cache them manually
    manager._hypotheses_cache["test-arsenal-fc"] = hypotheses

    print(f"✅ Created {len(hypotheses)} test hypotheses")

    # Display initial state
    for h in hypotheses:
        print(f"\n  {h.hypothesis_id}:")
        print(f"    Statement: {h.statement}")
        print(f"    Confidence: {h.confidence:.2f}")
        print(f"    Status: {h.status}")
        print(f"    Iterations: {h.iterations_attempted}")

    # Update first hypothesis
    h = hypotheses[0]
    print(f"\n🔄 Updating hypothesis: {h.hypothesis_id}")

    updated = await manager.update_hypothesis(
        hypothesis_id=h.hypothesis_id,
        entity_id="test-arsenal-fc",
        decision="ACCEPT",
        confidence_delta=0.06,
        evidence_ref="test_source_1"
    )

    print(f"  Old confidence: {h.confidence - updated.last_delta:.2f}")
    print(f"  New confidence: {updated.confidence:.2f}")
    print(f"  Delta: {updated.last_delta:+.2f}")
    print(f"  Iterations: {updated.iterations_attempted}")
    print(f"  Status: {updated.status}")

    # Test second update (simulate saturation)
    print(f"\n🔄 Simulating saturation...")

    for i in range(5):
        await manager.update_hypothesis(
            hypothesis_id=h.hypothesis_id,
            entity_id="test-arsenal-fc",
            decision="NO_PROGRESS",
            confidence_delta=0.0,
            evidence_ref=f"test_source_{i+2}"
        )

    print(f"  After 5 NO_PROGRESS iterations:")
    print(f"  Confidence: {updated.confidence:.2f}")
    print(f"  Iterations: {updated.iterations_attempted}")
    print(f"  NO_PROGRESS count: {updated.iterations_no_progress}")
    print(f"  Status: {updated.status}")


async def test_eig_calculator():
    """Test EIG calculator without database"""
    from backend.hypothesis_manager import Hypothesis
    from backend.eig_calculator import EIGCalculator, ClusterState

    print("\n=== Test 2: EIG Calculator ===\n")

    # Create test hypotheses
    h1 = Hypothesis(
        hypothesis_id="test_crm_procurement",
        entity_id="test-entity",
        category="CRM Implementation",
        statement="Test entity is preparing CRM procurement",
        prior_probability=0.5,
        confidence=0.42  # Low confidence → high uncertainty → high EIG
    )

    h2 = Hypothesis(
        hypothesis_id="test_digital_transform",
        entity_id="test-entity",
        category="Digital Transformation",
        statement="Test entity is undergoing digital transformation",
        prior_probability=0.5,
        confidence=0.85  # High confidence → low uncertainty → low EIG
    )

    h3 = Hypothesis(
        hypothesis_id="test_c_suite_hire",
        entity_id="test-entity",
        category="C-Suite Hiring",
        statement="Test entity is hiring CTO",
        prior_probability=0.5,
        confidence=0.50  # Medium confidence + high category value
    )

    # Initialize calculator
    calculator = EIGCalculator()

    # Calculate EIG without cluster dampening
    print("--- EIG without Cluster Dampening ---")
    results = []
    for h in [h1, h2, h3]:
        eig = calculator.calculate_eig(h)
        results.append((h, eig))
        print(f"  {h.hypothesis_id}:")
        print(f"    Confidence: {h.confidence:.2f}")
        print(f"    Category: {h.category}")
        print(f"    EIG: {eig:.3f}")

    # Rank by EIG
    print("\n--- Ranked by EIG (Highest Priority First) ---")
    ranked = sorted(results, key=lambda x: x[1], reverse=True)
    for i, (h, eig) in enumerate(ranked, 1):
        print(f"  {i}. {h.hypothesis_id}: EIG = {eig:.3f}")

    # Test with cluster dampening
    print("\n--- EIG with Cluster Dampening ---")
    cluster_state = ClusterState(
        cluster_id="test_cluster",
        pattern_frequencies={
            "Strategic Hire": 5,      # High frequency → low novelty
            "C-Suite Hiring": 1,     # Medium frequency
            "Digital Transformation": 0  # Never seen → high novelty
        }
    )

    for h, _ in results[:3]:
        eig = calculator.calculate_eig(h, cluster_state)
        novelty = calculator._calculate_novelty(h, cluster_state)
        info_value = calculator._get_information_value(h.category)

        print(f"  {h.hypothesis_id}:")
        print(f"    Novelty: {novelty:.2f}")
        print(f"    Info Value: {info_value:.2f}")
        print(f"    EIG: {eig:.3f}")

    # Test cluster state update
    print("\n--- Testing Cluster State Updates ---")
    calculator.update_cluster_state(cluster_state, [h1, h2, h3])
    print(f"  Cluster pattern frequencies:")
    for pattern, freq in cluster_state.pattern_frequencies.items():
        print(f"    {pattern}: {freq}")


async def test_depth_tracking():
    """Test depth tracking in RalphState"""
    from backend.schemas import RalphState
    from backend.hypothesis_manager import Hypothesis

    print("\n=== Test 3: Depth Tracking ===\n")

    # Create state
    state = RalphState(
        entity_id="test-entity",
        entity_name="Test Entity",
        max_depth=3,
        current_depth=1
    )

    print(f"Initial state:")
    print(f"  Max depth: {state.max_depth}")
    print(f"  Current depth: {state.current_depth}")
    print(f"  Depth level: {state.get_depth_level().value}")

    # Simulate iterations at different depths
    test_hypothesis = Hypothesis(
        hypothesis_id="test_h",
        entity_id="test-entity",
        category="Test",
        statement="Test hypothesis",
        prior_probability=0.5,
        confidence=0.5
    )

    for depth in [1, 2, 3, 3, 3]:
        state.current_depth = depth
        state.increment_depth_count(depth)

        should_continue = state.should_dig_deeper(test_hypothesis)

        print(f"\n  Depth {depth} ({state.get_depth_level().value}):")
        print(f"    Depth counts: {state.depth_counts}")
        print(f"    Should dig deeper: {should_continue}")

    print(f"\nFinal depth statistics:")
    for depth, count in state.depth_counts.items():
        print(f"  Level {depth}: {count} iterations")


async def test_lifecycle_transitions():
    """Test hypothesis lifecycle transitions"""
    from backend.hypothesis_manager import Hypothesis

    print("\n=== Test 4: Hypothesis Lifecycle Transitions ===\n")

    # Test hypothesis
    h = Hypothesis(
        hypothesis_id="test_lifecycle",
        entity_id="test-entity",
        category="Test",
        statement="Test hypothesis for lifecycle",
        prior_probability=0.5,
        confidence=0.5
    )

    print(f"Initial state: {h.status}")
    print(f"  Confidence: {h.confidence:.2f}")
    print(f"  Iterations: {h.iterations_attempted}")

    # Simulate ACCEPTs (should promote)
    print(f"\n🔄 Simulating 2 ACCEPT decisions...")
    h.confidence = 0.75
    h.iterations_accepted = 2
    h.iterations_attempted = 2

    # Create manager to check lifecycle
    from backend.hypothesis_manager import HypothesisManager
    manager = HypothesisManager()

    new_status = manager._determine_lifecycle_status(h)
    print(f"  New status: {new_status}")
    print(f"  ✅ Promoted! (confidence ≥0.70 AND ≥2 ACCEPTs)")

    # Reset for next test
    h.status = "ACTIVE"

    # Simulate REJECTs (should degrade)
    print(f"\n🔄 Simulating 2 REJECT decisions...")
    h.confidence = 0.25
    h.iterations_rejected = 2
    h.iterations_accepted = 0
    h.iterations_attempted = 4

    new_status = manager._determine_lifecycle_status(h)
    print(f"  New status: {new_status}")
    print(f"  ⚠️ Degraded! (confidence <0.30 AND ≥2 REJECTs)")

    # Reset for next test
    h.status = "ACTIVE"

    # Simulate NO_PROGRESS saturation
    print(f"\n🔄 Simulating saturation (3+ NO_PROGRESS)...")
    h.confidence = 0.50
    h.iterations_no_progress = 3
    h.iterations_rejected = 0
    h.iterations_accepted = 0
    h.iterations_attempted = 5

    new_status = manager._determine_lifecycle_status(h)
    print(f"  New status: {new_status}")
    print(f"  🔄 Saturated! (≥3 NO_PROGRESS in last 5 iterations)")


async def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("Hypothesis-Driven Discovery System Test (No Database)")
    print("="*60)

    try:
        # Test 1: Hypothesis Manager
        await test_hypothesis_manager()

        # Test 2: EIG Calculator
        await test_eig_calculator()

        # Test 3: Depth Tracking
        await test_depth_tracking()

        # Test 4: Lifecycle Transitions
        await test_lifecycle_transitions()

        print("\n" + "="*60)
        print("✅ All tests passed!")
        print("="*60)

        print("\n💡 Notes:")
        print("  - Tests ran without database (in-memory)")
        print("  - For production, configure FALKORDB_URI or use Supabase")
        print("  - See HYPOTHESIS_DRIVEN_DISCOVERY_QUICKSTART.md for setup")

    except Exception as e:
        logger.error(f"❌ Test failed: {e}", exc_info=True)
        print("\n❌ Test failed. Check logs for details.")


if __name__ == "__main__":
    asyncio.run(main())
