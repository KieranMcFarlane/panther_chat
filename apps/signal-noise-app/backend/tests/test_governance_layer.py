#!/usr/bin/env python3
"""
Test Governance Layer

Tests:
1. Lifecycle state transitions (EXPLORING → PROMOTED → FROZEN → RETIRED)
2. Cluster intelligence rollups
3. End-to-end governance integration

Usage:
    cd backend && python3 tests/test_governance_layer.py
"""

import asyncio
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from binding_lifecycle_manager import BindingLifecycleManager
from cluster_intelligence import ClusterIntelligence
from template_runtime_binding import RuntimeBinding, RuntimeBindingCache


def test_lifecycle_state_transitions():
    """Test lifecycle state transitions"""
    print("\n=== Test 1: Lifecycle State Transitions ===")

    manager = BindingLifecycleManager()

    # Test 1.1: Promotion criteria
    print("\n--- Test 1.1: Promotion Criteria ---")

    binding_promoted = RuntimeBinding(
        template_id="tier_1_club_centralized_procurement",
        entity_id="borussia-dortmund",
        entity_name="Borussia Dortmund",
        usage_count=5,
        success_rate=0.75,
        confidence_adjustment=0.10,
        discovered_domains=["bvb.de"],
        state="EXPLORING"
    )

    state = manager.evaluate_binding_state(binding_promoted)
    print(f"Binding with usage_count=5, success_rate=0.75: {state}")
    assert state == "PROMOTED", f"Expected PROMOTED, got {state}"
    print("✅ Promotion test passed")

    # Test 1.2: Freeze criteria
    print("\n--- Test 1.2: Freeze Criteria ---")

    from datetime import datetime, timedelta

    # Create binding with old last_used timestamp (100 days ago)
    old_last_used = (datetime.now() - timedelta(days=100)).isoformat()

    binding_frozen = RuntimeBinding(
        template_id="tier_1_club_centralized_procurement",
        entity_id="test-entity",
        entity_name="Test Entity",
        usage_count=5,
        success_rate=0.55,
        confidence_adjustment=0.02,
        discovered_domains=["test.com"],
        last_used=old_last_used,  # Set old timestamp
        state="EXPLORING"
    )

    state = manager.evaluate_binding_state(binding_frozen)
    print(f"Binding with usage_count=5, success_rate=0.55: {state}")
    assert state == "FROZEN", f"Expected FROZEN, got {state}"
    print("✅ Freeze test passed")

    # Test 1.3: Retirement criteria
    print("\n--- Test 1.3: Retirement Criteria ---")

    binding_retired = RuntimeBinding(
        template_id="tier_1_club_centralized_procurement",
        entity_id="test-entity-2",
        entity_name="Test Entity 2",
        usage_count=10,
        success_rate=0.30,  # Below 0.35
        confidence_adjustment=-0.20,
        discovered_domains=["test2.com"],
        state="EXPLORING"
    )

    state = manager.evaluate_binding_state(binding_retired)
    print(f"Binding with success_rate=0.30: {state}")
    assert state == "RETIRED", f"Expected RETIRED, got {state}"
    print("✅ Retirement test passed")

    # Test 1.4: Exploring (default)
    print("\n--- Test 1.4: Exploring (Default) ---")

    binding_exploring = RuntimeBinding(
        template_id="tier_1_club_centralized_procurement",
        entity_id="test-entity-3",
        entity_name="Test Entity 3",
        usage_count=1,  # Too few for promotion
        success_rate=0.60,
        confidence_adjustment=0.05,
        discovered_domains=["test3.com"],
        state="EXPLORING"
    )

    state = manager.evaluate_binding_state(binding_exploring)
    print(f"Binding with usage_count=1: {state}")
    assert state == "EXPLORING", f"Expected EXPLORING, got {state}"
    print("✅ Exploring test passed")

    # State summary
    print("\n--- State Summary ---")
    summary = manager.get_state_summary()
    print(f"State Distribution: {summary}")
    assert summary["PROMOTED"] == 1, "Expected 1 PROMOTED"
    assert summary["FROZEN"] == 1, "Expected 1 FROZEN"
    assert summary["RETIRED"] == 1, "Expected 1 RETIRED"
    print("✅ State summary test passed")


def test_cluster_intelligence_rollup():
    """Test cluster intelligence rollup"""
    print("\n=== Test 2: Cluster Intelligence Rollup ===")

    # Create test bindings (use unique template ID)
    cache = RuntimeBindingCache()
    test_template_id = "test_cluster_intelligence"

    # Create promoted binding 1
    binding1 = RuntimeBinding(
        template_id=test_template_id,
        entity_id="borussia-dortmund",
        entity_name="Borussia Dortmund",
        usage_count=5,
        success_rate=0.80,
        confidence_adjustment=0.15,
        discovered_channels={
            "jobs_board": ["https://linkedin.com/jobs/..."],
            "official_site": ["https://bvb.de"]
        },
        enriched_patterns={
            "Strategic Hire": ["CRM Manager", "Digital Director"],
            "Digital Transformation": ["New CRM system"]
        },
        state="PROMOTED"
    )

    # Create promoted binding 2
    binding2 = RuntimeBinding(
        template_id=test_template_id,
        entity_id="fc-bayern-munich",
        entity_name="FC Bayern Munich",
        usage_count=4,
        success_rate=0.75,
        confidence_adjustment=0.10,
        discovered_channels={
            "jobs_board": ["https://linkedin.com/jobs/..."],
            "press": ["https://fcbayern.com/en/news"]
        },
        enriched_patterns={
            "Strategic Hire": ["Data Analyst"],
            "Partnership": ["Salesforce partnership"]
        },
        state="PROMOTED"
    )

    # Cache bindings
    cache.set_binding(binding1)
    cache.set_binding(binding2)

    # Create cluster intelligence
    intelligence = ClusterIntelligence(binding_cache=cache)

    # Rollup cluster data
    print("\n--- Rolling up cluster data ---")

    stats = intelligence.rollup_cluster_data(test_template_id)

    print(f"Cluster: {stats.cluster_id}")
    print(f"Total Bindings: {stats.total_bindings}")
    assert stats.total_bindings == 2, "Expected 2 promoted bindings"
    print("✅ Binding count test passed")

    print(f"\nChannel Effectiveness:")
    for channel, effectiveness in stats.channel_effectiveness.items():
        print(f"  {channel}: {effectiveness:.2%}")

    # Verify channel effectiveness
    assert "jobs_board" in stats.channel_effectiveness, "Expected jobs_board in channels"
    assert stats.channel_effectiveness["jobs_board"] > 0.7, "Expected jobs_board effectiveness > 0.7"
    print("✅ Channel effectiveness test passed")

    print(f"\nSignal Reliability:")
    for signal, reliability in stats.signal_reliability.items():
        print(f"  {signal}: {reliability:.2%}")

    # Verify signal reliability
    assert "Strategic Hire" in stats.signal_reliability, "Expected Strategic Hire in signals"
    print("✅ Signal reliability test passed")

    print(f"\nDiscovery Shortcuts:")
    for i, shortcut in enumerate(stats.discovery_shortcuts, 1):
        print(f"  {i}. {shortcut}")

    # Verify shortcuts
    assert len(stats.discovery_shortcuts) > 0, "Expected discovery shortcuts"
    # Note: official_site has 80% effectiveness vs jobs_board 77.78%, so it ranks higher
    assert "jobs_board" in stats.discovery_shortcuts, "Expected jobs_board in shortcuts"
    print("✅ Discovery shortcuts test passed")

    # Get channel priorities
    print("\n--- Getting channel priorities ---")

    priorities = intelligence.get_channel_priorities(test_template_id)
    print(f"Channel priorities: {priorities}")

    assert len(priorities) > 0, "Expected channel priorities"
    assert "jobs_board" in priorities, "Expected jobs_board in priorities"
    print("✅ Channel priorities test passed")


def test_end_to_end_governance():
    """Test end-to-end governance integration"""
    print("\n=== Test 3: End-to-End Governance Integration ===")

    # Create cache and bindings (use unique template ID to avoid conflicts)
    cache = RuntimeBindingCache()

    # Use a unique template ID for this test
    test_template_id = "test_governance_integration"

    # Create binding that will promote
    binding = RuntimeBinding(
        template_id=test_template_id,
        entity_id="test-governance-entity",
        entity_name="Test Governance Entity",
        usage_count=3,
        success_rate=0.70,
        confidence_adjustment=0.10,
        discovered_channels={
            "jobs_board": ["https://linkedin.com/jobs/..."],
            "official_site": ["https://example.com"]
        },
        enriched_patterns={
            "Strategic Hire": ["CRM Manager"]
        },
        state="EXPLORING"
    )

    cache.set_binding(binding)

    # Initialize lifecycle manager
    lifecycle_manager = BindingLifecycleManager()

    # Evaluate state
    print("\n--- Evaluating binding state ---")
    state = lifecycle_manager.evaluate_binding_state(binding)
    print(f"Initial state: {state}")
    assert state == "PROMOTED", f"Expected PROMOTED, got {state}"
    print("✅ Binding promoted")

    # Update binding state
    binding.state = state
    binding.promoted_at = binding.last_used
    cache.set_binding(binding)

    # Initialize cluster intelligence
    cluster_intel = ClusterIntelligence(binding_cache=cache)

    # Rollup cluster data
    print("\n--- Rolling up cluster intelligence ---")
    stats = cluster_intel.rollup_cluster_data(test_template_id)

    print(f"Total bindings in cluster: {stats.total_bindings}")
    assert stats.total_bindings == 1, "Expected 1 binding"
    print("✅ Cluster intelligence updated")

    # Verify shortcuts include promoted binding channels
    print("\n--- Verifying discovery shortcuts ---")
    print(f"Discovery shortcuts: {stats.discovery_shortcuts}")

    assert "jobs_board" in stats.discovery_shortcuts, "Expected jobs_board in shortcuts"
    assert "official_site" in stats.discovery_shortcuts, "Expected official_site in shortcuts"
    print("✅ Discovery shortcuts include promoted channels")

    # Global summary
    print("\n--- Global summary ---")
    summary = cluster_intel.get_global_summary()
    print(f"Total clusters: {summary['total_clusters']}")
    print(f"Avg channels per cluster: {summary['avg_channels_per_cluster']:.1f}")

    # Note: total_clusters may be >1 due to previous tests
    assert summary['total_clusters'] >= 1, "Expected at least 1 cluster"
    print("✅ Global summary test passed")


def main():
    """Run all governance tests"""
    print("╔════════════════════════════════════════════════════════════╗")
    print("║     Testing Adaptive Template Runtime Governance Layer    ║")
    print("╚════════════════════════════════════════════════════════════╝")

    try:
        # Test 1: Lifecycle state transitions
        test_lifecycle_state_transitions()
        print("\n✅ Test 1 PASSED: Lifecycle state transitions")

        # Test 2: Cluster intelligence rollup
        test_cluster_intelligence_rollup()
        print("\n✅ Test 2 PASSED: Cluster intelligence rollup")

        # Test 3: End-to-end governance integration
        test_end_to_end_governance()
        print("\n✅ Test 3 PASSED: End-to-end governance integration")

        print("\n" + "="*60)
        print("🎉 ALL GOVERNANCE TESTS PASSED!")
        print("="*60)
        print("\nGovernance Layer Summary:")
        print("  ✅ Lifecycle state transitions (EXPLORING → PROMOTED → FROZEN → RETIRED)")
        print("  ✅ Cluster intelligence rollups (channel effectiveness, signal reliability)")
        print("  ✅ Discovery shortcuts (prioritize channels for new entities)")
        print("\nNext Steps:")
        print("  1. Monitor promotion/freeze/retirement rates in production")
        print("  2. Validate cluster intelligence accuracy (>70% target)")
        print("  3. Measure discovery shortcut effectiveness (50% faster target)")

    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
