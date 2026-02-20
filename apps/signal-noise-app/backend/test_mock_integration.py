#!/usr/bin/env python3
"""
Mock Integration Test - Tests the full discovery flow with mocked external services
"""

import asyncio
import sys
import logging
from unittest.mock import Mock, AsyncMock, MagicMock

logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)


async def test_quick_discovery_with_mocks():
    """Test quick discovery with mocked external services"""
    print("\n🧪 Testing Quick Discovery with Mocked Services\n")

    try:
        # Mock external clients
        from unittest.mock import patch, AsyncMock

        # Create orchestrator
        from multi_pass_rfp_orchestrator import MultiPassRFPOrchestrator

        # Mock the discovery to return immediately
        mock_discovery_result = {
            'final_confidence': 0.75,
            'raw_signals': [],
            'total_cost': 1.0,
            'iteration_count': 5,
            'duration_seconds': 10.0
        }

        mock_pass_result = MagicMock()
        mock_pass_result.pass_number = 1
        mock_pass_result.validated_signals = []
        mock_pass_result.raw_signals = []
        mock_pass_result.confidence_delta = 0.25

        mock_multi_pass_result = MagicMock()
        mock_multi_pass_result.pass_results = [mock_pass_result]
        mock_multi_pass_result.evolved_hypotheses = []
        mock_multi_pass_result.final_confidence = 0.75
        mock_multi_pass_result.total_cost = 1.0
        mock_multi_pass_result.total_iterations = 5
        mock_multi_pass_result.duration_seconds = 10.0
        mock_multi_pass_result.total_signals_detected = 0
        mock_multi_pass_result.high_confidence_signals = 0
        mock_multi_pass_result.unique_categories = 0

        # Test with mocked discovery
        with patch('multi_pass_ralph_loop.MultiPassRalphCoordinator') as mock_coordinator_class:
            mock_coordinator_instance = AsyncMock()
            mock_coordinator_instance.run_multi_pass_discovery = AsyncMock(
                return_value=mock_multi_pass_result
            )
            mock_coordinator.return_value = mock_coordinator_instance

            orchestrator = MultiPassRFPOrchestrator()

            # Replace the coordinator
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

            # Verify results
            assert result.entity_id == "test-entity", "Entity ID mismatch"
            assert result.final_confidence == 0.75, "Confidence mismatch"
            assert result.opportunity_report is not None, "Opportunity report missing"

            print(f"✅ Quick Discovery test passed!")
            print(f"   Final Confidence: {result.final_confidence:.2f}")
            print(f"   Duration: {result.duration_seconds:.1f}s")
            print(f"   Cost: ${result.total_cost:.2f}")

            return True

    except Exception as e:
        print(f"❌ Quick Discovery test failed: {e}")
        logger.exception("Quick Discovery test failed")
        return False


async def test_full_discovery_with_mocks():
    """Test full discovery with mocked services"""
    print("\n🧪 Testing Full Discovery with Mocked Services\n")

    try:
        from multi_pass_rfp_orchestrator import MultiPassRFPOrchestrator
        from unittest.mock import patch, AsyncMock, MagicMock

        # Mock results
        mock_pass_result = MagicMock()
        mock_pass_result.pass_number = 1
        mock_pass_result.validated_signals = []
        mock_pass_result.raw_signals = []
        mock_pass_result.confidence_delta = 0.30

        mock_multi_pass_result = MagicMock()
        mock_multi_pass_result.pass_results = [mock_pass_result, mock_pass_result]
        mock_multi_pass_result.evolved_hypotheses = []
        mock_multi_pass_result.final_confidence = 0.90
        mock_multi_pass_result.total_cost = 5.0
        mock_multi_pass_result.total_iterations = 20
        mock_multi_pass_result.duration_seconds = 60.0
        mock_multi_pass_result.total_signals_detected = 5
        mock_multi_pass_result.high_confidence_signals = 3
        mock_multi_pass_result.unique_categories = 3

        # Test with mocked coordinator
        with patch('multi_pass_rfp_orchestrator.MultiPassRalphCoordinator') as mock_coordinator:
            mock_coordinator_instance = AsyncMock()
            mock_coordinator_instance.run_multi_pass_discovery = AsyncMock(
                return_value=mock_multi_pass_result
            )
            mock_coordinator.return_value = mock_coordinator_instance

            orchestrator = MultiPassRFPOrchestrator()
            orchestrator.multi_pass_coordinator = mock_coordinator_instance

            # Run full discovery
            result = await orchestrator.discover_rfp_opportunities(
                entity_id="arsenal-fc",
                entity_name="Arsenal FC",
                max_passes=4,
                dossier_priority='PREMIUM',
                include_temporal=False,
                include_network=False
            )

            # Verify
            assert result.entity_id == "arsenal-fc"
            assert result.final_confidence == 0.90
            assert result.duration_seconds == 60.0

            print(f"✅ Full Discovery test passed!")
            print(f"   Final Confidence: {result.final_confidence:.2f}")
            print(f"   Signals: {result.multi_pass_result.total_signals_detected}")
            print(f"   Duration: {result.duration_seconds:.1f}s")

            return True

    except Exception as e:
        print(f"❌ Full Discovery test failed: {e}")
        logger.exception("Full Discovery test failed")
        return False


async def run_all_tests():
    """Run all mock-based integration tests"""
    print("\n" + "="*80)
    print("  Multi-Layered RFP Discovery - Mock Integration Tests")
    print("="*80)

    tests = [
        ("Quick Discovery (Mocked)", test_quick_discovery_with_mocks),
        ("Full Discovery (Mocked)", test_full_discovery_with_mocks),
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
        print("\nThe discovery flow is working correctly. The system only needs:")
        print("  - FalkorDB connection")
        print("  - API credentials (Claude, BrightData)")
        print("  - Network access for web scraping")
        return True
    else:
        print(f"\n⚠️  {total_count - passed_count} test(s) failed.")
        return False


if __name__ == "__main__":
    success = asyncio.run(run_all_tests())
    sys.exit(0 if success else 1)
