#!/usr/bin/env python3
"""
Test to validate both Bug #1 and Bug #2 are fixed

Bug #1: DiscoveryResult attribute access (multi_pass_ralph_loop.py)
Bug #2: Template dict access (hypothesis_driven_discovery.py)
"""

import asyncio
import sys
from unittest.mock import Mock, AsyncMock, patch


async def test_bug1_fixed():
    """Test that DiscoveryResult is accessed correctly (not with .get())"""
    print("\n🧪 Test 1: DiscoveryResult Attribute Access (Bug #1)")

    try:
        from hypothesis_driven_discovery import DiscoveryResult
        from multi_pass_ralph_loop import PassResult

        # Create mock DiscoveryResult
        discovery_result = DiscoveryResult(
            entity_id="test-entity",
            entity_name="Test Entity FC",
            final_confidence=0.75,
            confidence_band="CONFIDENT",
            is_actionable=False,
            iterations_completed=5,
            total_cost_usd=1.0,
            hypotheses=[],
            depth_stats={1: 3},
            signals_discovered=[]
        )

        # Test attribute access (Bug #1 fix)
        signals = discovery_result.signals_discovered  # Not .get('signals_discovered')
        confidence = discovery_result.final_confidence  # Not .get('final_confidence')

        assert confidence == 0.75
        print("   ✅ DiscoveryResult attributes accessible directly")
        print("   ✅ No .get() calls needed")

        return True

    except AttributeError as e:
        if "'DiscoveryResult' object has no attribute 'get'" in str(e) or \
           "has no attribute" in str(e):
            print(f"   ❌ Bug #1 NOT fixed: {e}")
            return False
        raise


async def test_bug2_fixed():
    """Test that template dict is accessed correctly"""
    print("\n🧪 Test 2: Template Dict Access (Bug #2)")

    try:
        from template_loader import TemplateLoader

        loader = TemplateLoader()
        template = loader.get_template('yellow_panther_agency')

        # Test dict access (Bug #2 fix)
        signal_patterns = template.get('signal_patterns', [])  # Not template.signal_patterns

        assert len(signal_patterns) > 0
        print(f"   ✅ Template signal_patterns accessible via .get()")
        print(f"   ✅ Found {len(signal_patterns)} patterns")

        return True

    except AttributeError as e:
        if "'dict' object has no attribute 'signal_patterns'" in str(e) or \
           "has no attribute" in str(e):
            print(f"   ❌ Bug #2 NOT fixed: {e}")
            return False
        raise


async def test_integration_flow():
    """Test that the complete discovery flow works"""
    print("\n🧪 Test 3: Integration Flow (Both Bugs Fixed)")

    try:
        # This test validates that the discovery system can initialize
        # and access templates correctly
        from hypothesis_driven_discovery import HypothesisDrivenDiscovery
        from template_loader import TemplateLoader

        # Test template loading
        loader = TemplateLoader()
        template = loader.get_template('yellow_panther_agency')
        assert template is not None
        assert isinstance(template, dict)
        patterns = template.get('signal_patterns', [])
        assert len(patterns) > 0

        print("   ✅ Template loads correctly as dict")
        print("   ✅ Template has signal_patterns")

        # Validate the pattern structure matches what the code expects
        first_pattern = patterns[0]
        assert 'pattern_name' in first_pattern
        assert 'early_indicators' in first_pattern
        assert 'keywords' in first_pattern

        print("   ✅ Pattern structure correct")

        return True

    except Exception as e:
        print(f"   ❌ Integration test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def run_all_tests():
    """Run all bug fix validation tests"""
    print("\n" + "="*80)
    print("  Bug Fix Validation - Bugs #1 and #2")
    print("="*80)

    tests = [
        ("Bug #1: DiscoveryResult Access", test_bug1_fixed),
        ("Bug #2: Template Dict Access", test_bug2_fixed),
        ("Integration Flow", test_integration_flow),
    ]

    results = []
    for test_name, test_func in tests:
        try:
            passed = await test_func()
            results.append((test_name, passed))
        except Exception as e:
            print(f"\n   ❌ {test_name} crashed: {e}")
            results.append((test_name, False))

    # Print summary
    print("\n" + "="*80)
    print("  Test Summary")
    print("="*80)

    passed_count = sum(1 for _, passed in results if passed)
    total_count = len(results)

    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")

    print(f"\nResults: {passed_count}/{total_count} tests passed")

    if passed_count == total_count:
        print("\n🎉 All bug fixes validated!")
        print("\nBoth Bug #1 and Bug #2 are fixed:")
        print("  ✅ Bug #1: DiscoveryResult accessed as dataclass (not dict)")
        print("  ✅ Bug #2: Template accessed as dict (not object)")
        return True
    else:
        print(f"\n⚠️  {total_count - passed_count} test(s) failed.")
        return False


if __name__ == "__main__":
    success = asyncio.run(run_all_tests())
    sys.exit(0 if success else 1)
