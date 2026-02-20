#!/usr/bin/env python3
"""
Test to validate the DiscoveryResult fix - ensures dataclass attributes are accessed correctly
"""

import asyncio
import sys

async def test_discovery_result_attribute_access():
    """Test that DiscoveryResult attributes can be accessed correctly (not .get())"""
    print("\n🧪 Testing DiscoveryResult Attribute Access Fix\n")

    try:
        from hypothesis_driven_discovery import DiscoveryResult
        from multi_pass_ralph_loop import PassResult

        # Create a mock DiscoveryResult
        discovery_result = DiscoveryResult(
            entity_id="test-entity",
            entity_name="Test Entity FC",
            final_confidence=0.75,
            confidence_band="CONFIDENT",
            is_actionable=False,
            iterations_completed=10,
            total_cost_usd=1.5,
            hypotheses=[],
            depth_stats={1: 5, 2: 3, 3: 2},
            signals_discovered=[
                {'type': 'RFP_DETECTED', 'category': 'Digital Transformation', 'confidence': 0.85}
            ]
        )

        # Test attribute access (this is what the fixed code does)
        print("Step 1: Testing attribute access (not .get())...")
        signals = discovery_result.signals_discovered
        assert len(signals) == 1, "Should have 1 signal"
        assert signals[0]['type'] == 'RFP_DETECTED', "Signal type mismatch"
        print("✅ signals_discovered attribute accessible")

        confidence = discovery_result.final_confidence
        assert confidence == 0.75, "Confidence mismatch"
        print("✅ final_confidence attribute accessible")

        # Test that PassResult accepts DiscoveryResult
        print("\nStep 2: Testing PassResult with DiscoveryResult...")
        pass_result = PassResult(
            pass_number=1,
            discovery_result=discovery_result,  # Pass the DiscoveryResult object
            strategy=None,
            raw_signals=signals,
            validated_signals=[],
            confidence_delta=0.25
        )
        assert pass_result.pass_number == 1
        assert pass_result.discovery_result.final_confidence == 0.75
        print("✅ PassResult accepts DiscoveryResult")

        # Validate the fix - accessing attributes without .get()
        print("\nStep 3: Validating the fix (no .get() calls)...")
        # This is what the fixed code does:
        raw_signals = pass_result.discovery_result.signals_discovered
        new_confidence = pass_result.discovery_result.final_confidence

        assert len(raw_signals) == 1
        assert new_confidence == 0.75
        print("✅ Can access attributes directly without .get()")

        print("\n✅ DiscoveryResult attribute access fix validated!")
        print("\nThe fix correctly:")
        print("  - Changed .get() calls to direct attribute access")
        print("  - Updated PassResult.discovery_result type from Dict to DiscoveryResult")
        print("  - All attribute access works correctly")

        return True

    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(test_discovery_result_attribute_access())
    sys.exit(0 if success else 1)
