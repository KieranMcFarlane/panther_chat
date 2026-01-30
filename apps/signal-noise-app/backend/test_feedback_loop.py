#!/usr/bin/env python3
"""
Test script for RFP Outcome Feedback Loop

Demonstrates the complete feedback loop:
1. Record RFP outcome → updates binding
2. Ralph Loop validates → updates binding
3. Check lifecycle transitions
4. Verify re-discovery triggering
"""

import asyncio
import json
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Test data
TEST_ENTITY_ID = "test_feedback_entity"
TEST_ENTITY_NAME = "Test Feedback Entity"


def create_test_binding():
    """Create a test runtime binding"""
    return {
        "entity_id": TEST_ENTITY_ID,
        "entity_name": TEST_ENTITY_NAME,
        "template_id": "test_template",
        "discovered_at": "2026-01-30T10:00:00Z",
        "domains": ["test.com"],
        "channels": {
            "jobs": "linkedin.com/jobs@test",
            "careers": "test.com/careers"
        },
        "patterns": {
            "Test Pattern": {
                "patterns_found": ["Test signal"],
                "iterations_used": 10,
                "confidence": 0.70,
                "accept_rate": 0.75
            }
        },
        "performance_metrics": {
            "total_iterations": 30,
            "categories_discovered": 1,
            "overall_confidence": 0.70,
            "total_cost_usd": 0.75
        },
        "usage_count": 0,
        "success_rate": 0.0,
        "state": "EXPLORING",
        "confidence_adjustment": 0.0
    }


async def test_feedback_loop():
    """Test the complete feedback loop"""
    print("\n" + "="*70)
    print("TEST: RFP Outcome Feedback Loop")
    print("="*70 + "\n")

    from binding_feedback_processor import BindingFeedbackProcessor

    # Setup
    bindings_dir = Path("data/runtime_bindings")
    bindings_dir.mkdir(parents=True, exist_ok=True)

    # Create test binding
    test_binding = create_test_binding()
    binding_path = bindings_dir / f"{TEST_ENTITY_ID}.json"

    with open(binding_path, 'w') as f:
        json.dump(test_binding, f, indent=2)

    print(f"✅ Created test binding: {binding_path}")
    print(f"   Initial confidence: 0.70")
    print(f"   Initial state: EXPLORING\n")

    # Initialize processor
    processor = BindingFeedbackProcessor()

    # Test 1: Record won outcome
    print("Test 1: Recording WON outcome")
    print("-" * 70)

    result1 = await processor.process_outcome_feedback(
        rfp_id="test-rfp-001",
        entity_id=TEST_ENTITY_ID,
        outcome="won",
        pattern_id="Test Pattern",
        value_actual=150000
    )

    print(f"Success: {result1.success}")
    print(f"Confidence delta: {result1.confidence_delta:+.2f}")
    print(f"New confidence: {result1.new_confidence:.2f}")
    print(f"Binding updated: {result1.binding_updated}")
    print(f"Lifecycle transition: {result1.lifecycle_transition}")

    # Verify binding was updated
    with open(binding_path, 'r') as f:
        binding_after_win = json.load(f)

    print(f"\nBinding after WIN:")
    print(f"  Usage count: {binding_after_win.get('usage_count', 0)}")
    print(f"  Success rate: {binding_after_win.get('success_rate', 0):.2%}")
    print(f"  Wins: {binding_after_win.get('wins', 0)}")
    print(f"  Pattern confidence: {binding_after_win['patterns']['Test Pattern']['confidence']:.2f}")

    # Test 2: Record Ralph Loop validation
    print("\n" + "-" * 70)
    print("Test 2: Recording Ralph Loop VALIDATION")
    print("-" * 70)

    result2 = await processor.process_ralph_loop_feedback(
        entity_id=TEST_ENTITY_ID,
        signal_id="test-signal-001",
        pattern_id="Test Pattern",
        validation_result="validated",
        confidence=0.85
    )

    print(f"Success: {result2.success}")
    print(f"Confidence delta: {result2.confidence_delta:+.2f}")
    print(f"New confidence: {result2.new_confidence:.2f}")

    # Test 3: Multiple wins to trigger promotion
    print("\n" + "-" * 70)
    print("Test 3: Recording multiple wins to trigger PROMOTION")
    print("-" * 70)

    for i in range(2, 5):  # Already 1 win, need 2 more for promotion
        result = await processor.process_outcome_feedback(
            rfp_id=f"test-rfp-{i:03d}",
            entity_id=TEST_ENTITY_ID,
            outcome="won",
            pattern_id="Test Pattern",
            value_actual=100000 + (i * 10000)
        )
        print(f"  Win #{i}: confidence {result.new_confidence:.2f}, state: {result.lifecycle_transition or 'EXPLORING'}")

    # Check final state
    with open(binding_path, 'r') as f:
        final_binding = json.load(f)

    print(f"\nFinal binding state:")
    print(f"  Usage count: {final_binding.get('usage_count', 0)}")
    print(f"  Success rate: {final_binding.get('success_rate', 0):.2%}")
    print(f"  State: {final_binding.get('state', 'EXPLORING')}")
    print(f"  Wins: {final_binding.get('wins', 0)}")
    print(f"  Pattern confidence: {final_binding['patterns']['Test Pattern']['confidence']:.2f}")

    # Test 4: False positive to trigger degradation
    print("\n" + "-" * 70)
    print("Test 4: Recording FALSE POSITIVE to test degradation")
    print("-" * 70)

    # Record multiple false positives
    for i in range(5):
        result = await processor.process_outcome_feedback(
            rfp_id=f"test-fp-{i:03d}",
            entity_id=TEST_ENTITY_ID,
            outcome="false_positive",
            pattern_id="Test Pattern"
        )

    with open(binding_path, 'r') as f:
        degraded_binding = json.load(f)

    print(f"After 5 false positives:")
    print(f"  Pattern confidence: {degraded_binding['patterns']['Test Pattern']['confidence']:.2f}")
    print(f"  False positives: {degraded_binding.get('false_positives', 0)}")
    print(f"  State: {degraded_binding.get('state', 'EXPLORING')}")
    print(f"  Re-discovery triggered: {result.rediscovery_triggered}")

    # Test 5: Check feedback log
    print("\n" + "-" * 70)
    print("Test 5: Verifying feedback log")
    print("-" * 70)

    feedback_log_path = Path("data/feedback_history.jsonl")
    if feedback_log_path.exists():
        with open(feedback_log_path, 'r') as f:
            feedback_count = sum(1 for _ in f)
        print(f"Feedback log entries: {feedback_count}")
    else:
        print("No feedback log found (expected if first run)")

    # Test 6: Check re-discovery queue
    print("\n" + "-" * 70)
    print("Test 6: Checking re-discovery queue")
    print("-" * 70)

    rediscovery_queue_dir = Path("data/rediscovery_queue")
    queue_file = rediscovery_queue_dir / f"{TEST_ENTITY_ID}.json"

    if queue_file.exists():
        with open(queue_file, 'r') as f:
            queue_entry = json.load(f)
        print(f"Re-discovery queued:")
        print(f"  Reason: {queue_entry.get('reason')}")
        print(f"  Priority: {queue_entry.get('priority')}")
        print(f"  Current confidence: {queue_entry.get('current_confidence'):.2f}")
    else:
        print("No re-discovery queued (confidence not degraded enough)")

    # Cleanup
    print("\n" + "-" * 70)
    print("Cleanup")
    print("-" * 70)
    binding_path.unlink()
    if queue_file.exists():
        queue_file.unlink()
    print("✅ Test files cleaned up")

    print("\n" + "="*70)
    print("TEST COMPLETE ✅")
    print("="*70 + "\n")


if __name__ == "__main__":
    asyncio.run(test_feedback_loop())
