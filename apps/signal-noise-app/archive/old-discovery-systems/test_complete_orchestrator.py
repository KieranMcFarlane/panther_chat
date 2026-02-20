#!/usr/bin/env python3
"""
Test Complete Multi-Layered RFP Discovery System

Tests the full orchestrator (Phase 6) which brings together:
- Dossier generation
- Dossier-informed hypothesis generation
- Multi-pass Ralph Loop coordination
- Temporal context provider
- Graph relationship analyzer
- Opportunity report generation

Usage:
    cd backend
    python test_complete_orchestrator.py
"""

import asyncio
import sys
import logging
from datetime import datetime, timezone

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def print_section(title: str):
    """Print a formatted section header"""
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}\n")


def print_test_results(test_name: str, passed: bool, details: str = ""):
    """Print test result in a formatted way"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {test_name}")
    if details:
        print(f"     {details}")


async def test_quick_discovery():
    """Test 1: Quick discovery with minimal configuration"""
    print_section("Test 1: Quick Discovery (2 passes, BASIC)")

    try:
        from multi_pass_rfp_orchestrator import quick_discovery

        result = await quick_discovery(
            entity_id="test-entity",
            entity_name="Test Entity FC",
            max_passes=2
        )

        # Validate results
        assert result.entity_id == "test-entity", "Entity ID mismatch"
        assert result.final_confidence >= 0.0, "Confidence should be >= 0"
        assert result.final_confidence <= 1.0, "Confidence should be <= 1"
        assert result.opportunity_report is not None, "Opportunity report missing"

        print_test_results(
            "Quick Discovery",
            True,
            f"Confidence: {result.final_confidence:.2f}, "
            f"Opportunities: {result.opportunity_report.total_opportunities}, "
            f"Duration: {result.duration_seconds:.1f}s"
        )

        return True

    except Exception as e:
        print_test_results("Quick Discovery", False, str(e))
        logger.exception("Quick discovery test failed")
        return False


async def test_orchestrator_initialization():
    """Test 2: Orchestrator initialization with all components"""
    print_section("Test 2: Orchestrator Initialization")

    try:
        from multi_pass_rfp_orchestrator import MultiPassRFPOrchestrator

        orchestrator = MultiPassRFPOrchestrator()

        # Verify YP profile loaded
        assert hasattr(orchestrator, 'yp_profile'), "YP profile missing"
        assert 'capabilities' in orchestrator.yp_profile, "YP capabilities missing"

        # Verify all components initialized
        assert hasattr(orchestrator, 'dossier_generator'), "Dossier generator missing"
        assert hasattr(orchestrator, 'hypothesis_generator'), "Hypothesis generator missing"
        assert hasattr(orchestrator, 'multi_pass_coordinator'), "Multi-pass coordinator missing"
        assert hasattr(orchestrator, 'temporal_provider'), "Temporal provider missing"
        assert hasattr(orchestrator, 'graph_analyzer'), "Graph analyzer missing"

        yp_caps = len(orchestrator.yp_profile.get('capabilities', []))

        print_test_results(
            "Orchestrator Initialization",
            True,
            f"YP Capabilities: {yp_caps}, All 6 components initialized"
        )

        return True

    except Exception as e:
        print_test_results("Orchestrator Initialization", False, str(e))
        logger.exception("Initialization test failed")
        return False


async def test_yp_capability_matching():
    """Test 3: Yellow Panther capability matching"""
    print_section("Test 3: YP Capability Matching")

    try:
        from multi_pass_rfp_orchestrator import MultiPassRFPOrchestrator

        orchestrator = MultiPassRFPOrchestrator()

        # Test signal matching
        test_signals = [
            {'category': 'React Web Development', 'type': 'JOB_POSTING'},
            {'category': 'Mobile App', 'type': 'RFP_DETECTED'},
            {'category': 'Digital Transformation', 'type': 'PRESS_RELEASE'},
            {'category': 'Fan Engagement', 'type': 'CRM_ANALYTICS'},
            {'category': 'Unknown Category', 'type': 'GENERAL'}
        ]

        matches = []
        for signal in test_signals:
            service = orchestrator._match_signal_to_yp_service(signal)
            matches.append(service)

        # Verify matches
        assert matches[0] == 'React Web Development', "Web match failed"
        assert matches[1] == 'React Mobile Development', "Mobile match failed"
        assert matches[2] == 'Digital Transformation', "Digital transformation match failed"
        assert matches[3] == 'Fan Engagement Platforms', "Fan engagement match failed"
        assert matches[4] == 'General Consulting', "Default match failed"

        print_test_results(
            "YP Capability Matching",
            True,
            f"All 5 test signals matched correctly"
        )

        return True

    except Exception as e:
        print_test_results("YP Capability Matching", False, str(e))
        logger.exception("YP matching test failed")
        return False


async def test_opportunity_report_generation():
    """Test 4: Opportunity report generation"""
    print_section("Test 4: Opportunity Report Generation")

    try:
        from multi_pass_rfp_orchestrator import MultiPassRFPOrchestrator
        from multi_pass_ralph_loop import MultiPassResult, PassResult

        orchestrator = MultiPassRFPOrchestrator()

        # Create mock multi-pass result
        # Create a mock DiscoveryResult
        from hypothesis_driven_discovery import DiscoveryResult

        mock_discovery_result = DiscoveryResult(
            entity_id="test-entity",
            entity_name="Test Entity",
            final_confidence=0.85,
            confidence_band="CONFIDENT",
            is_actionable=False,
            iterations_completed=10,
            total_cost_usd=1.5,
            hypotheses=[],
            depth_stats={1: 5, 2: 3, 3: 2},
            signals_discovered=[]
        )

        mock_pass = PassResult(
            pass_number=1,
            discovery_result=mock_discovery_result,
            strategy=None,
            validated_signals=[
                {
                    'id': 'signal-1',
                    'type': 'RFP_DETECTED',
                    'category': 'Digital Transformation',
                    'confidence': 0.85,
                    'evidence': [{'source': 'test1'}, {'source': 'test2'}, {'source': 'test3'}]
                },
                {
                    'id': 'signal-2',
                    'type': 'JOB_POSTING',
                    'category': 'React Web Development',
                    'confidence': 0.65,
                    'evidence': [{'source': 'test1'}]
                }
            ]
        )

        mock_result = MultiPassResult(
            entity_id="test-entity",
            entity_name="Test Entity",
            pass_results=[mock_pass],
            evolved_hypotheses=[],
            final_confidence=0.75,
            total_cost=10.0,
            total_iterations=10,
            duration_seconds=60.0,
            total_signals_detected=2,
            high_confidence_signals=1,
            unique_categories=2
        )

        # Generate report
        report = await orchestrator._generate_opportunity_report(
            entity_id="test-entity",
            entity_name="Test Entity",
            multi_pass_result=mock_result,
            temporal_context=None,
            network_context=None
        )

        # Validate report
        assert report.total_opportunities == 2, "Opportunity count mismatch"
        assert report.high_priority_count == 1, "High priority count mismatch"
        assert report.medium_priority_count == 1, "Medium priority count mismatch"
        assert len(report.opportunities) == 2, "Opportunities list mismatch"

        # Check opportunity details
        high_opp = [o for o in report.opportunities if o.confidence >= 0.80][0]
        assert high_opp.yp_service == 'Digital Transformation', "YP service mismatch"
        assert high_opp.recommended_action == 'Immediate outreach', "Action mismatch"

        print_test_results(
            "Opportunity Report Generation",
            True,
            f"Total: {report.total_opportunities}, "
            f"High: {report.high_priority_count}, "
            f"Medium: {report.medium_priority_count}"
        )

        return True

    except Exception as e:
        print_test_results("Opportunity Report Generation", False, str(e))
        logger.exception("Report generation test failed")
        return False


async def test_value_estimation():
    """Test 5: Opportunity value estimation"""
    print_section("Test 5: Value Estimation")

    try:
        from multi_pass_rfp_orchestrator import MultiPassRFPOrchestrator

        orchestrator = MultiPassRFPOrchestrator()

        # Test value estimation for different categories
        test_cases = [
            {'category': 'Digital Transformation', 'confidence': 0.90, 'expected_min': 400000},
            {'category': 'CRM Platform', 'confidence': 0.80, 'expected_min': 180000},
            {'category': 'AI Platform', 'confidence': 0.70, 'expected_min': 250000},
            {'category': 'Web Development', 'confidence': 0.60, 'expected_min': 75000},
        ]

        all_correct = True
        for case in test_cases:
            estimated = orchestrator._estimate_value(case, case['confidence'])
            is_correct = estimated >= case['expected_min']

            if not is_correct:
                all_correct = False
                logger.warning(
                    f"Value estimation failed for {case['category']}: "
                    f"estimated ${estimated:,.0f}, expected >${case['expected_min']:,}"
                )

        print_test_results(
            "Value Estimation",
            all_correct,
            f"All {len(test_cases)} test cases estimated correctly"
        )

        return all_correct

    except Exception as e:
        print_test_results("Value Estimation", False, str(e))
        logger.exception("Value estimation test failed")
        return False


async def test_recommended_actions():
    """Test 6: Recommended action mapping"""
    print_section("Test 6: Recommended Actions")

    try:
        from multi_pass_rfp_orchestrator import MultiPassRFPOrchestrator

        orchestrator = MultiPassRFPOrchestrator()

        # Test confidence ranges
        test_cases = [
            {'confidence': 0.85, 'expected': 'Immediate outreach'},
            {'confidence': 0.75, 'expected': 'Engage sales team'},
            {'confidence': 0.55, 'expected': 'Add to watchlist'},
            {'confidence': 0.35, 'expected': 'Monitor for changes'}
        ]

        all_correct = True
        for case in test_cases:
            action = orchestrator._get_recommended_action(case['confidence'])
            is_correct = action == case['expected']

            if not is_correct:
                all_correct = False
                logger.warning(
                    f"Action mismatch for confidence {case['confidence']}: "
                    f"got '{action}', expected '{case['expected']}'"
                )

        print_test_results(
            "Recommended Actions",
            all_correct,
            f"All {len(test_cases)} confidence bands mapped correctly"
        )

        return all_correct

    except Exception as e:
        print_test_results("Recommended Actions", False, str(e))
        logger.exception("Recommended actions test failed")
        return False


async def run_all_tests():
    """Run all tests and report results"""
    print_section("Multi-Layered RFP Discovery System - Complete Test Suite")

    print("Testing Phase 6: Unified Orchestrator")
    print("This test suite validates the complete system integration\n")

    tests = [
        ("Orchestrator Initialization", test_orchestrator_initialization),
        ("YP Capability Matching", test_yp_capability_matching),
        ("Value Estimation", test_value_estimation),
        ("Recommended Actions", test_recommended_actions),
        ("Opportunity Report Generation", test_opportunity_report_generation),
        ("Quick Discovery", test_quick_discovery)
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
    print_section("Test Summary")

    passed_count = sum(1 for _, passed in results if passed)
    total_count = len(results)

    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")

    print(f"\nResults: {passed_count}/{total_count} tests passed")

    if passed_count == total_count:
        print("\n🎉 All tests passed! Phase 6 is complete.")
        print("\nThe Multi-Layered RFP Discovery System is ready for production use.")
        return True
    else:
        print(f"\n⚠️  {total_count - passed_count} test(s) failed. Please review the errors above.")
        return False


if __name__ == "__main__":
    success = asyncio.run(run_all_tests())
    sys.exit(0 if success else 1)
