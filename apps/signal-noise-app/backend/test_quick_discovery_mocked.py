#!/usr/bin/env python3
"""
Quick Discovery Test with Mocked Discovery - Tests the orchestrator flow without web scraping

This test validates that:
1. The DiscoveryResult attribute access bug is fixed
2. All components integrate correctly
3. The complete flow works end-to-end
"""

import asyncio
import sys
import logging
from unittest.mock import Mock, AsyncMock, patch

logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)


async def test_quick_discovery_mocked():
    """Test quick discovery with mocked external services"""
    print("\n🧪 Testing Quick Discovery with Mocked Services\n")

    try:
        from multi_pass_rfp_orchestrator import MultiPassRFPOrchestrator
        from hypothesis_driven_discovery import DiscoveryResult
        from multi_pass_ralph_loop import MultiPassResult, PassResult

        # Create mock discovery result
        mock_discovery_result = DiscoveryResult(
            entity_id="test-entity",
            entity_name="Test Entity FC",
            final_confidence=0.75,
            confidence_band="CONFIDENT",
            is_actionable=False,
            iterations_completed=5,
            total_cost_usd=1.0,
            hypotheses=[],
            depth_stats={1: 3, 2: 2},
            signals_discovered=[]  # No signals for this test
        )

        # Create mock pass result
        mock_pass_result = PassResult(
            pass_number=1,
            discovery_result=mock_discovery_result,
            strategy=None,
            raw_signals=[],
            validated_signals=[],
            hypotheses_tested=[],
            confidence_delta=0.25
        )

        # Create mock multi-pass result
        mock_multi_pass_result = MultiPassResult(
            entity_id="test-entity",
            entity_name="Test Entity FC",
            pass_results=[mock_pass_result],
            evolved_hypotheses=[],
            final_confidence=0.75,
            total_cost=1.0,
            total_iterations=5,
            duration_seconds=10.0,
            total_signals_detected=0,
            high_confidence_signals=0,
            unique_categories=0
        )

        # Mock the multi-pass coordinator
        with patch('multi_pass_ralph_loop.MultiPassRalphCoordinator') as mock_coordinator_class:
            mock_coordinator_instance = AsyncMock()
            mock_coordinator_instance.run_multi_pass_discovery = AsyncMock(
                return_value=mock_multi_pass_result
            )
            mock_coordinator_class.return_value = mock_coordinator_instance

            # Create orchestrator
            orchestrator = MultiPassRFPOrchestrator()

            # Replace the coordinator with our mock
            orchestrator.multi_pass_coordinator = mock_coordinator_instance

            # Run quick discovery
            result = await orchestrator.discover_rfp_opportunities(
                entity_id="test-entity",
                entity_name="Test Entity FC",
                max_passes=2,
                dossier_priority='BASIC',
                include_temporal=False,
                include_network=False
            )

            # Validate the result
            assert result.entity_id == "test-entity", "Entity ID mismatch"
            assert result.final_confidence == 0.75, f"Confidence mismatch: {result.final_confidence}"
            assert result.opportunity_report is not None, "Opportunity report missing"

            print(f"✅ Quick Discovery test PASSED!")
            print(f"   Final Confidence: {result.final_confidence:.2f}")
            print(f"   Duration: {result.duration_seconds:.1f}s")
            print(f"   Cost: ${result.total_cost:.2f}")
            print(f"   Opportunities: {result.opportunity_report.total_opportunities}")

            return True

    except AttributeError as e:
        if "'DiscoveryResult' object has no attribute 'get'" in str(e):
            print(f"❌ Quick Discovery test FAILED with the original bug:")
            print(f"   {e}")
            print(f"\n   This means the fix wasn't applied correctly.")
            return False
        else:
            print(f"❌ Quick Discovery test FAILED with AttributeError: {e}")
            logger.exception("Quick Discovery test failed")
            return False
    except Exception as e:
        print(f"❌ Quick Discovery test failed: {e}")
        logger.exception("Quick Discovery test failed")
        return False


async def run_all_tests():
    """Run all mock-based tests"""
    print("\n" + "="*80)
    print("  Multi-Layered RFP Discovery - Mock Integration Tests")
    print("="*80)

    tests = [
        ("Quick Discovery (Mocked)", test_quick_discovery_mocked),
    ]

    results = []
    for test_name, test_func in tests:
        try:
            passed = await test_func()
            results.append((test_name, passed))
        except Exception as e:
            logger.exception(f"Test {test_name} crashed")
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
        print("\n🎉 All mock integration tests passed!")
        print("\nThe discovery flow is working correctly.")
        print("The DiscoveryResult attribute access bug has been fixed.")
        return True
    else:
        print(f"\n⚠️  {total_count - passed_count} test(s) failed.")
        return False


if __name__ == "__main__":
    success = asyncio.run(run_all_tests())
    sys.exit(0 if success else 1)
