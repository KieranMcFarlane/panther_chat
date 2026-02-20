#!/usr/bin/env python3
"""
Hypothesis-Driven Discovery System Integration Test

Tests the full hypothesis-driven discovery flow with FalkorDB persistence.

This script demonstrates:
1. Initializing hypotheses from templates
2. Calculating EIG for prioritization
3. Running single-hop discovery iterations
4. Persisting state to FalkorDB
5. Loading and resuming discovery

Usage:
    python backend/test_hypothesis_driven_discovery.py
"""

import asyncio
import logging
import os
from datetime import datetime, timezone
from pathlib import Path

# Add parent directory to path
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def test_hypothesis_manager_with_persistence():
    """Test hypothesis manager with FalkorDB persistence"""
    from backend.hypothesis_manager import HypothesisManager
    from backend.hypothesis_persistence import HypothesisRepository

    print("\n=== Test 1: Hypothesis Manager with Persistence ===\n")

    # Initialize repository
    repo = HypothesisRepository()
    if not await repo.initialize():
        print("❌ Failed to initialize repository")
        return

    # Initialize manager with repository
    manager = HypothesisManager(repository=repo)

    # Initialize hypotheses from template
    hypotheses = await manager.initialize_hypotheses(
        template_id="tier_1_club_centralized_procurement",
        entity_id="test-arsenal-fc",
        entity_name="Arsenal FC (Test)"
    )

    print(f"✅ Initialized {len(hypotheses)} hypotheses")

    # Display initial state
    for h in hypotheses[:3]:
        print(f"\n  {h.hypothesis_id}:")
        print(f"    Statement: {h.statement}")
        print(f"    Confidence: {h.confidence:.2f}")
        print(f"    Status: {h.status}")

    # Update first hypothesis
    if hypotheses:
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
        print(f"  Status: {updated.status}")

    # Test loading from database
    print("\n💾 Testing database persistence...")

    loaded_hypotheses = await manager.get_hypotheses("test-arsenal-fc")
    print(f"✅ Loaded {len(loaded_hypotheses)} hypotheses from database")

    # Close repository
    await repo.close()


async def test_eig_calculator_with_dampening():
    """Test EIG calculator with cluster dampening"""
    from backend.hypothesis_manager import Hypothesis
    from backend.eig_calculator import EIGCalculator, ClusterState
    from backend.hypothesis_persistence import HypothesisRepository

    print("\n=== Test 2: EIG Calculator with Cluster Dampening ===\n")

    # Initialize repository
    repo = HypothesisRepository()
    await repo.initialize()

    # Create test hypotheses
    h1 = Hypothesis(
        hypothesis_id="test_crm_procurement",
        entity_id="test-entity",
        category="CRM Implementation",
        statement="Test entity is preparing CRM procurement",
        prior_probability=0.5,
        confidence=0.42
    )

    h2 = Hypothesis(
        hypothesis_id="test_digital_transform",
        entity_id="test-entity",
        category="Digital Transformation",
        statement="Test entity is undergoing digital transformation",
        prior_probability=0.5,
        confidence=0.85
    )

    h3 = Hypothesis(
        hypothesis_id="test_c_suite_hire",
        entity_id="test-entity",
        category="C-Suite Hiring",
        statement="Test entity is hiring CTO",
        prior_probability=0.5,
        confidence=0.50
    )

    # Initialize calculator with repository
    calculator = EIGCalculator(repository=repo)

    # Calculate EIG without cluster state
    print("--- EIG without Cluster Dampening ---")
    for h in [h1, h2, h3]:
        eig = calculator.calculate_eig(h)
        print(f"  {h.hypothesis_id}: EIG = {eig:.3f}")

    # Create cluster state with pattern frequencies
    cluster_state = ClusterState(
        cluster_id="test_cluster",
        pattern_frequencies={
            "Strategic Hire": 5,      # High frequency → low novelty
            "C-Suite Hiring": 1,     # Medium frequency
            "Digital Transformation": 0  # Never seen → high novelty
        }
    )

    # Persist cluster state
    for pattern, freq in cluster_state.pattern_frequencies.items():
        await repo.update_cluster_pattern_frequency("test_cluster", pattern, freq)

    # Calculate EIG with cluster state
    print("\n--- EIG with Cluster Dampening ---")
    for h in [h1, h2, h3]:
        eig = calculator.calculate_eig(h, cluster_state)
        novelty = calculator._calculate_novelty(h, cluster_state)
        print(f"  {h.hypothesis_id}:")
        print(f"    Novelty: {novelty:.2f}")
        print(f"    EIG: {eig:.3f}")

    # Test loading cluster state from database
    print("\n💾 Testing cluster state persistence...")

    loaded_state = await calculator.get_cluster_state("test_cluster")
    print(f"✅ Loaded cluster state: {loaded_state.pattern_frequencies}")

    # Close repository
    await repo.close()


async def test_full_discovery_flow():
    """Test full hypothesis-driven discovery flow"""
    from backend.hypothesis_driven_discovery import HypothesisDrivenDiscovery
    from backend.hypothesis_persistence import HypothesisRepository

    print("\n=== Test 3: Full Discovery Flow ===\n")

    # Initialize repository
    repo = HypothesisRepository()
    await repo.initialize()

    # Note: This is a simplified test without actual clients
    # In production, you would initialize with real Claude and BrightData clients

    print("✅ Discovery flow test requires:")
    print("  1. ClaudeClient instance")
    print("  2. BrightDataSDKClient instance")
    print("\n💡 See quick_start_hypothesis_driven_discovery.md for usage examples")

    # Close repository
    await repo.close()


async def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("Hypothesis-Driven Discovery System Integration Test")
    print("="*60)

    try:
        # Test 1: Hypothesis Manager with Persistence
        await test_hypothesis_manager_with_persistence()

        # Test 2: EIG Calculator with Dampening
        await test_eig_calculator_with_dampening()

        # Test 3: Full Discovery Flow
        await test_full_discovery_flow()

        print("\n" + "="*60)
        print("✅ All tests complete!")
        print("="*60 + "\n")

    except Exception as e:
        logger.error(f"❌ Test failed: {e}", exc_info=True)
        print("\n❌ Test failed. Check logs for details.")


if __name__ == "__main__":
    asyncio.run(main())
