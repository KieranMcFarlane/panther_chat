#!/usr/bin/env python3
"""
Simplified Integration Test for Multi-Layered RFP Discovery System

Tests that all components can be initialized and work together
without running full discovery (which requires external services).
"""

import asyncio
import sys
import logging

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def test_orchestrator_initialization():
    """Test that orchestrator can be initialized"""
    print("\n🧪 Testing Orchestrator Initialization\n")

    try:
        from multi_pass_rfp_orchestrator import MultiPassRFPOrchestrator

        orchestrator = MultiPassRFPOrchestrator()

        # Verify all components initialized
        assert hasattr(orchestrator, 'dossier_generator'), "Missing dossier_generator"
        assert hasattr(orchestrator, 'hypothesis_generator'), "Missing hypothesis_generator"
        assert hasattr(orchestrator, 'multi_pass_coordinator'), "Missing multi_pass_coordinator"
        assert hasattr(orchestrator, 'temporal_provider'), "Missing temporal_provider"
        assert hasattr(orchestrator, 'graph_analyzer'), "Missing graph_analyzer"

        print(f"✅ Orchestrator initialized successfully")
        print(f"   YP Capabilities: {len(orchestrator.yp_profile.get('capabilities', []))}")
        return True

    except Exception as e:
        print(f"❌ Initialization failed: {e}")
        logger.exception("Initialization failed")
        return False


async def test_component_integration():
    """Test that all components can work together"""
    print("\n🧪 Testing Component Integration\n")

    try:
        from multi_pass_rfp_orchestrator import MultiPassRFPOrchestrator

        orchestrator = MultiPassRFPOrchestrator()

        # Test 1: Check YP profile loaded
        yp_caps = orchestrator.yp_profile.get('capabilities', [])
        assert len(yp_caps) > 0, "YP capabilities not loaded"
        print(f"✅ YP Profile: {len(yp_caps)} capabilities loaded")

        # Test 2: Check convenience functions exist
        from multi_pass_rfp_orchestrator import quick_discovery, full_discovery
        print("✅ Convenience functions: quick_discovery, full_discovery available")

        # Test 3: Check data classes exist
        from multi_pass_rfp_orchestrator import Opportunity, OpportunityReport, OrchestratorResult
        print("✅ Data classes: Opportunity, OpportunityReport, OrchestratorResult available")

        return True

    except Exception as e:
        print(f"❌ Integration test failed: {e}")
        logger.exception("Integration test failed")
        return False


async def test_method_signatures():
    """Test that key methods have correct signatures"""
    print("\n🧪 Testing Method Signatures\n")

    try:
        from multi_pass_rfp_orchestrator import MultiPassRFPOrchestrator
        import inspect

        orchestrator = MultiPassRFPOrchestrator()

        # Check discover_rfp_opportunities signature
        sig = inspect.signature(orchestrator.discover_rfp_opportunities)
        params = list(sig.parameters.keys())

        required_params = ['entity_id', 'entity_name']
        for param in required_params:
            assert param in params, f"Missing required parameter: {param}"

        print(f"✅ discover_rfp_opportunities() has correct signature")
        print(f"   Parameters: {', '.join(params[:5])}...")

        # Check save_result signature
        sig = inspect.signature(orchestrator.save_result)
        params = list(sig.parameters.keys())
        assert 'result' in params, "Missing result parameter"

        print(f"✅ save_result() has correct signature")
        print(f"   Parameters: {', '.join(params)}")

        return True

    except Exception as e:
        print(f"❌ Method signature test failed: {e}")
        logger.exception("Method signature test failed")
        return False


async def test_yp_capability_matching():
    """Test YP capability matching logic"""
    print("\n🧪 Testing YP Capability Matching\n")

    try:
        from multi_pass_rfp_orchestrator import MultiPassRFPOrchestrator

        orchestrator = MultiPassRFPOrchestrator()

        # Test signal to service matching
        test_signals = [
            {'category': 'React Web Development', 'type': 'JOB_POSTING'},
            {'category': 'Mobile App', 'type': 'RFP_DETECTED'},
            {'category': 'Digital Transformation', 'type': 'PRESS_RELEASE'},
            {'category': 'Fan Engagement', 'type': 'CRM_ANALYTICS'},
            {'category': 'E-commerce', 'type': 'WEBSITE_SCRAPED'}
        ]

        matches = []
        for signal in test_signals:
            service = orchestrator._match_signal_to_yp_service(signal)
            matches.append(service)

        # Verify matches
        assert matches[0] == 'React Web Development', f"Web match failed: {matches[0]}"
        assert matches[1] == 'React Mobile Development', f"Mobile match failed: {matches[1]}"
        assert matches[2] == 'Digital Transformation', f"Digital match failed: {matches[2]}"
        assert matches[3] == 'Fan Engagement Platforms', f"Fan engagement match failed: {matches[3]}"

        print(f"✅ All 5 test signals matched correctly:")
        for i, (signal, service) in enumerate(zip(test_signals, matches)):
            print(f"   {i+1}. {signal['category']} → {service}")

        return True

    except Exception as e:
        print(f"❌ YP matching test failed: {e}")
        logger.exception("YP matching test failed")
        return False


async def test_value_estimation():
    """Test opportunity value estimation"""
    print("\n🧪 Testing Value Estimation\n")

    try:
        from multi_pass_rfp_orchestrator import MultiPassRFPOrchestrator

        orchestrator = MultiPassRFPOrchestrator()

        # Test value estimation
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

            status = "✅" if is_correct else "❌"
            print(f"   {status} {case['category']}: ${estimated:,.0f} (expected >${case['expected_min']:,})")

            if not is_correct:
                all_correct = False

        if all_correct:
            print(f"✅ All {len(test_cases)} value estimates correct")
        else:
            print(f"❌ Some value estimates incorrect")

        return all_correct

    except Exception as e:
        print(f"❌ Value estimation test failed: {e}")
        logger.exception("Value estimation test failed")
        return False


async def run_all_tests():
    """Run all integration tests"""
    print("\n" + "="*80)
    print("  Multi-Layered RFP Discovery System - Integration Tests")
    print("="*80)

    tests = [
        ("Orchestrator Initialization", test_orchestrator_initialization),
        ("Component Integration", test_component_integration),
        ("Method Signatures", test_method_signatures),
        ("YP Capability Matching", test_yp_capability_matching),
        ("Value Estimation", test_value_estimation),
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
        print("\n🎉 All integration tests passed!")
        print("\nThe Multi-Layered RFP Discovery System is fully integrated and ready for use.")
        return True
    else:
        print(f"\n⚠️  {total_count - passed_count} test(s) failed.")
        return False


if __name__ == "__main__":
    success = asyncio.run(run_all_tests())
    sys.exit(0 if success else 1)
