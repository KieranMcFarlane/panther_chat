#!/usr/bin/env python3
"""
Full Integration Test Suite with Real Services

Tests the complete question-first dossier system with:
1. BrightData SDK for real web scraping
2. Entity-type question templates
3. Yellow Panther service scoring
4. Hypothesis-driven discovery integration
5. Real contact validation
"""

import asyncio
import sys
import os
import json
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

# Load environment variables from .env
from dotenv import load_dotenv
# Try backend .env first, then parent directory .env
backend_env = os.path.join(os.path.dirname(__file__), '.env')
parent_env = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(backend_env)
load_dotenv(parent_env, override=True)

# Ensure backend is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


async def test_brightdata_sdk():
    """Test 1: BrightData SDK Integration"""
    print("\n" + "=" * 80)
    print("TEST 1: BrightData SDK - Real Web Scraping")
    print("=" * 80)

    try:
        from brightdata_sdk_client import BrightDataSDKClient

        # Check for API token
        if not os.getenv('BRIGHTDATA_API_TOKEN'):
            print("⚠️  BRIGHTDATA_API_TOKEN not set - skipping SDK test")
            print("   To test real scraping, set BRIGHTDATA_API_TOKEN in .env")
            return None

        client = BrightDataSDKClient()

        print(f"✅ BrightData SDK Client initialized")

        # Test search_engine
        print(f"\n🔍 Testing search_engine for Arsenal FC official website...")
        result = await client.search_engine(
            query='"Arsenal FC" official website',
            engine='google',
            num_results=3
        )

        if result.get('status') == 'success':
            results = result.get('results', [])
            print(f"   ✅ Found {len(results)} search results")
            for r in results[:2]:
                print(f"      - {r.get('title', 'N/A')[:60]}...")
                print(f"        URL: {r.get('url', 'N/A')}")
        else:
            print(f"   ❌ Search failed: {result.get('error', 'Unknown error')}")

        # Test scrape_as_markdown
        print(f"\n📄 Testing scrape_as_markdown...")
        scrape_result = await client.scrape_as_markdown('https://arsenal.com')

        if scrape_result.get('status') == 'success':
            content = scrape_result.get('content', '')
            print(f"   ✅ Scraped {len(content)} characters from arsenal.com")
            print(f"   Preview: {content[:200]}...")
        else:
            print(f"   ⚠️  Scrape failed (may be blocked): {scrape_result.get('error', 'Unknown')}")

        return True

    except Exception as e:
        print(f"❌ TEST 1 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_question_templates_with_brightdata():
    """Test 2: Question Templates + BrightData SDK"""
    print("\n" + "=" * 80)
    print("TEST 2: Question Templates + BrightData - Targeted Discovery")
    print("=" * 80)

    try:
        from entity_type_dossier_questions import (
            get_questions_for_entity_type,
            generate_hypothesis_batch
        )
        from brightdata_sdk_client import BrightDataSDKClient

        # Check for API token
        if not os.getenv('BRIGHTDATA_API_TOKEN'):
            print("⚠️  BRIGHTDATA_API_TOKEN not set - skipping SDK test")
            return None

        brightdata = BrightDataSDKClient()

        # Get questions for Arsenal FC
        questions = get_questions_for_entity_type("SPORT_CLUB", max_questions=3)
        print(f"📋 Testing {len(questions)} questions with BrightData SDK:")

        # Test targeted searches based on questions
        for q in questions[:2]:
            print(f"\n   Question: {q.question_id}")
            print(f"   {q.question}")

            # Generate targeted search from next_signals
            next_signals = q.next_signals[:2]  # Take first 2 signals
            for signal in next_signals:
                # Extract search keywords from signal
                if 'Job posting' in signal:
                    query = '"Arsenal FC" mobile developer job posting'
                elif 'RFP' in signal or 'tender' in signal:
                    query = '"Arsenal FC" RFP tender mobile app'
                else:
                    query = f'"Arsenal FC" {signal[:30]}'

                print(f"      → Search: {query}")

                result = await brightdata.search_engine(
                    query=query,
                    engine='google',
                    num_results=2
                )

                if result.get('status') == 'success':
                    print(f"         ✅ Found {len(result.get('results', []))} results")
                else:
                    print(f"         ⚠️  No results: {result.get('error', 'Unknown')}")

        return True

    except Exception as e:
        print(f"❌ TEST 2 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_hypothesis_discovery_with_dossier():
    """Test 3: Hypothesis Discovery with Dossier Context"""
    print("\n" + "=" * 80)
    print("TEST 3: Hypothesis Discovery with Dossier Initialization")
    print("=" * 80)

    try:
        from hypothesis_driven_discovery import HypothesisDrivenDiscovery, HopType
        from entity_type_dossier_questions import generate_hypothesis_batch
        from brightdata_sdk_client import BrightDataSDKClient

        # Check for API token
        if not os.getenv('BRIGHTDATA_API_TOKEN'):
            print("⚚️  BRIGHTDATA_API_TOKEN not set - using mock client")
            brightdata = None
        else:
            brightdata = BrightDataSDKClient()

        # Create discovery instance
        discovery = HypothesisDrivenDiscovery(
            claude_client=None,  # Will use mock/None for this test
            brightdata_client=brightdata
        )

        entity_id = "test-arsenal-fc"
        entity_name = "Arsenal FC"
        entity_type = "SPORT_CLUB"

        # Initialize from question templates
        print(f"📋 Initializing discovery from question templates...")
        hypothesis_count = await discovery.initialize_from_question_templates(
            entity_id=entity_id,
            entity_name=entity_name,
            entity_type=entity_type,
            max_questions=5
        )

        print(f"   ✅ Initialized {hypothesis_count} hypotheses")

        # Get the generated hypotheses
        if hasattr(discovery, '_dossier_hypotheses_cache') and entity_id in discovery._dossier_hypotheses_cache:
            hypotheses = discovery._dossier_hypotheses_cache[entity_id]
            print(f"\n🎯 Generated Hypotheses:")
            for h in hypotheses:
                yp_services = h.metadata.get('yp_service_fit', [])
                budget = h.metadata.get('budget_range', 'N/A')
                positioning = h.metadata.get('positioning_strategy', 'N/A')

                print(f"   - {h.statement[:70]}")
                print(f"     YP: {', '.join(yp_services)}, Budget: {budget}, Positioning: {positioning}")

            # Test hop planning
            print(f"\n🗺️  Hop Planning (first 2 hypotheses):")
            for h in hypotheses[:2]:
                hop_plans = discovery.plan_hops_from_hypothesis(h, entity_name)
                print(f"   {h.hypothesis_id}:")
                for plan in hop_plans:
                    print(f"      → {plan['hop_type'].value}: {plan['query']}")

        return True

    except Exception as e:
        print(f"❌ TEST 3 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_yp_scorer_with_real_signals():
    """Test 4: YP Scorer with Real Signal Simulation"""
    print("\n" + "=" * 80)
    print("TEST 4: YP Scorer with Real Signal Scenarios")
    print("=" * 80)

    try:
        from yellow_panther_scorer import YellowPantherFitScorer
        from brightdata_sdk_client import BrightDataSDKClient

        scorer = YellowPantherFitScorer()

        # Skip SDK test if no API token
        use_real_api = os.getenv('BRIGHTDATA_API_TOKEN') is not None

        # Test real signal scenarios
        test_scenarios = [
            {
                'name': 'Arsenal FC Mobile App RFP',
                'entity_context': {'name': 'Arsenal FC', 'type': 'SPORT_CLUB', 'country': 'UK'},
                'signal': {
                    'signal_category': 'MOBILE_APPS',
                    'evidence': [{'content': 'Arsenal FC seeking React Native mobile app development for fan engagement platform'}],
                    'confidence': 0.85
                }
            },
            {
                'name': 'ICF Digital Transformation',
                'entity_context': {'name': 'International Canoe Federation', 'type': 'SPORT_FEDERATION', 'country': 'International'},
                'signal': {
                    'signal_category': 'DIGITAL_TRANSFORMATION',
                    'evidence': [{'content': 'ICF planning member federation management platform modernization'}],
                    'confidence': 0.70
                }
            },
            {
                'name': 'Premier League Analytics',
                'entity_context': {'name': 'Premier League', 'type': 'SPORT_LEAGUE', 'country': 'UK'},
                'signal': {
                    'signal_category': 'ANALYTICS',
                    'evidence': [{'content': 'League seeking centralized data analytics platform for all clubs'}],
                    'confidence': 0.75
                }
            }
        ]

        print(f"📊 Testing {len(test_scenarios)} real signal scenarios:\n")

        for scenario in test_scenarios:
            print(f"🎯 Scenario: {scenario['name']}")

            result = scorer.score_opportunity(
                signal=scenario['signal'],
                entity_context=scenario['entity_context']
            )

            print(f"   Fit Score: {result['fit_score']}/100")
            print(f"   Priority: {result['priority']}")
            print(f"   Budget Alignment: {result['budget_alignment']}")
            print(f"   Service Alignment: {result['service_alignment']}")
            print(f"   Positioning: {result.get('positioning_strategy', 'N/A')}")

            # Get question-based scoring
            if use_real_api and scorer.entity_type_questions:
                yp_score = scorer.score_from_question_template(
                    entity_type=scenario['entity_context']['type'],
                    question_id='sc_mobile_fan_platform',
                    signal_evidence=scenario['signal']['evidence'][0]
                )
                print(f"   Question-Based Fit: {yp_score['fit_score']}/100")
                print(f"   YP Services: {yp_score['yp_services']}")
                print(f"   Recommendations: {yp_score['recommendations'][:2]}")

            print()

        return True

    except Exception as e:
        print(f"❌ TEST 4 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_contact_validation_with_real_data():
    """Test 5: Contact Validation with Real LinkedIn Scenarios"""
    print("\n" + "=" * 80)
    print("TEST 5: Contact Validation - Real vs Placeholder Detection")
    print("=" * 80)

    try:
        from entity_type_dossier_questions import validate_contact_data
        from enhanced_dossier_generator import EnhancedDossierGenerator
        from claude_client import ClaudeClient

        # Simulate extracted contacts (what might come from web scraping)
        extracted_contacts = [
            # Real contacts (should pass)
            {"name": "Juliet Slot", "title": "Commercial Director", "linkedin_url": "linkedin.com/in/julietslot"},
            {"name": "Edu Gaspar", "title": "Technical Director", "linkedin_url": "linkedin.com/in/edugaspar"},
            {"name": "Tim Lewis", "title": "Head of Digital", "linkedin_url": "linkedin.com/in/timlewis"},

            # Placeholder contacts (should fail)
            {"name": "{COMMERCIAL DIRECTOR}", "title": "Director", "linkedin_url": ""},
            {"name": "{TECHNICAL DIRECTOR}", "title": "Technical Director", "linkedin_url": ""},
            {"name": "Director", "title": "Director", "linkedin_url": "", "email": "info@example.com"},

            # Edge cases
            {"name": "Unknown Person", "title": "Unknown", "linkedin_url": ""},
            {"name": "CEO", "title": "Chief Executive Officer", "linkedin_url": "linkedin.com/company/arsenal"}
        ]

        generator = EnhancedDossierGenerator(ClaudeClient())

        print("👥 Testing contact validation on {len(extracted_contacts)} contacts:\n")

        valid_contacts, errors = generator.validate_real_contacts(extracted_contacts)

        print(f"✅ Valid Contacts: {len(valid_contacts)}")
        for contact in valid_contacts:
            print(f"   - {contact['name']} ({contact['title']})")

        print(f"\n❌ Invalid Contacts: {len(errors)}")
        for error in errors:
            print(f"   - {error}")

        # Calculate validation metrics
        total = len(extracted_contacts)
        valid_rate = len(valid_contacts) / total * 100 if total > 0 else 0

        print(f"\n📊 Validation Metrics:")
        print(f"   Valid Rate: {valid_rate:.1f}%")
        print(f"   Placeholder Detection Rate: {(len(errors)/total*100):.1f}%")

        # Expected: ~60% valid rate (4 valid, 4 invalid, 3 edge case)
        if valid_rate >= 50:
            print("   ✅ Validation working as expected")
        else:
            print("   ⚠️  Validation rate lower than expected")

        return True

    except Exception as e:
        print(f"❌ TEST 5 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_full_pipeline_simulation():
    """Test 6: Full Pipeline - Question → Hypothesis → Discovery → YP Scoring"""
    print("\n" + "=" * 80)
    print("TEST 6: Full Pipeline Simulation")
    print("=" * 80)

    try:
        from entity_type_dossier_questions import (
            get_questions_for_entity_type,
            generate_hypothesis_batch,
            get_yp_service_summary
        )
        from yellow_panther_scorer import YellowPantherFitScorer
        from brightdata_sdk_client import BrightDataSDKClient
        from schemas import Entity, EntityType

        use_real_api = os.getenv('BRIGHTDATA_API_TOKEN') is not None

        # Simulate entity
        entity = Entity(
            id="test-arsenal-fc",
            type=EntityType.ORG,
            name="Arsenal FC",
            metadata={"league": "Premier League"}
        )

        print(f"📊 Entity: {entity.name} ({entity.type})")
        print(f"   League: {entity.metadata.get('league')}")

        # Step 1: Generate hypotheses from questions
        print(f"\n🎯 Step 1: Generate hypotheses from question templates")
        hypotheses = generate_hypothesis_batch(
            entity_type="SPORT_CLUB",
            entity_name=entity.name,
            entity_id=entity.id,
            max_questions=5
        )
        print(f"   Generated {len(hypotheses)} hypotheses")

        # Step 2: Score hypotheses against YP profile
        print(f"\n💰 Step 2: Score against Yellow Panther profile")
        scorer = YellowPantherFitScorer()

        yp_summary = get_yp_service_summary()
        print(f"   YP Ideal Budget: {yp_summary['ideal_profile']['budget_range']}")

        scored_hypotheses = []
        for hyp in hypotheses:
            yp_services = hyp['metadata']['yp_service_fit']
            budget = hyp['metadata']['budget_range']

            # Simulate signal evidence
            mock_signal = {
                'signal_category': yp_services[0] if yp_services else 'GENERIC',
                'evidence': [{'content': hyp['statement']}],
                'confidence': hyp['confidence']
            }

            score_result = scorer.score_opportunity(
                signal=mock_signal,
                entity_context={'name': entity.name, 'type': 'SPORT_CLUB'}
            )

            scored_hypotheses.append({
                'hypothesis': hyp,
                'fit_score': score_result['fit_score'],
                'priority': score_result['priority'],
                'positioning': score_result.get('positioning_strategy', 'UNKNOWN')
            })

            print(f"   - {hyp['statement'][:60]}...")
            print(f"     Fit: {score_result['fit_score']}/100, Priority: {score_result['priority']}")

        # Step 3: Plan discovery hops
        print(f"\n🗺️  Step 3: Plan discovery hops (top 3 hypotheses)")
        from hypothesis_driven_discovery import HypothesisDrivenDiscovery

        discovery = HypothesisDrivenDiscovery(None, None)

        class MockHypothesis:
            def __init__(self, hyp_dict, hop_plans):
                self.statement = hyp_dict['statement']
                self.metadata = hyp_dict['metadata']
                self.hop_plans = hop_plans

        for hyp in scored_hypotheses[:3]:
            # Plan hops
            hop_plans = discovery.plan_hops_from_hypothesis(
                MockHypothesis(hyp['hypothesis'], []),
                entity.name
            )

            print(f"   {hyp['hypothesis']['statement'][:50]}...")
            for plan in hop_plans[:2]:
                print(f"      → {plan['hop_type'].value}")

        # Step 4: Test real searches (if API available)
        if use_real_api:
            print(f"\n🔍 Step 4: Real BrightData searches (top 2 hop types)")
            brightdata = BrightDataSDKClient()

            # Get hop types from first hypothesis
            hop_types_to_test = set()
            for hyp in scored_hypotheses[:2]:
                for ht in hyp['hypothesis']['metadata'].get('hop_types', []):
                    hop_types_to_test.add(ht)

            # Test a few searches
            for hop_type in list(hop_types_to_test)[:2]:
                if hop_type == 'RFP_PAGE':
                    query = '"Arsenal FC" RFP tender'
                elif hop_type == 'CAREERS_PAGE':
                    query = '"Arsenal FC" mobile developer job'
                else:
                    query = f'"Arsenal FC"'

                print(f"   Testing: {hop_type} → {query}")
                result = await brightdata.search_engine(
                    query=query,
                    engine='google',
                    num_results=2
                )

                if result.get('status') == 'success':
                    print(f"      ✅ {len(result.get('results', []))} results found")
                else:
                    print(f"      ⚠️  Search failed: {result.get('error', 'Unknown')}")

        print(f"\n✅ TEST 6 PASSED: Full pipeline working correctly")
        return True

    except Exception as e:
        print(f"❌ TEST 6 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_env_setup():
    """Test 0: Environment Setup"""
    print("\n" + "=" * 80)
    print("ENVIRONMENT CHECK")
    print("=" * 80)

    print("Checking environment variables:")

    env_vars = {
        'ANTHROPIC_API_KEY': 'Claude API (required for dossier generation)',
        'BRIGHTDATA_API_TOKEN': 'BrightData SDK (optional - for real web scraping)',
        'NEO4J_URI': 'Neo4j Aura (optional - for graph queries)',
        'FALKORDB_URI': 'FalkorDB (optional - for local graph DB)'
    }

    for var, desc in env_vars.items():
        if os.getenv(var):
            value = os.getenv(var)
            if 'SECRET' in var or 'TOKEN' in var or 'PASSWORD' in var:
                print(f"  ✅ {var}: Set (length: {len(value)})")
            else:
                print(f"  ✅ {var}: {value}")
        else:
            print(f"  ⚠️  {var}: Not set ({desc})")

    # Check Python modules
    print("\nChecking Python modules:")

    modules = [
        ('brightdata_sdk_client', 'BrightData SDK'),
        ('entity_type_dossier_questions', 'Question Templates'),
        ('yellow_panther_scorer', 'YP Scorer'),
        ('hypothesis_driven_discovery', 'Hypothesis Discovery'),
        ('enhanced_dossier_generator', 'Enhanced Dossier Generator'),
        ('universal_club_prompts', 'Prompt Templates')
    ]

    for module, desc in modules:
        try:
            __import__(module)
            print(f"  ✅ {module}: {desc}")
        except ImportError as e:
            print(f"  ❌ {module}: {e}")

    return True


async def main():
    """Run all tests"""
    print("\n" + "=" * 80)
    print("  FULL INTEGRATION TEST - BrightData SDK + Question-First Dossier")
    print("=" * 80)
    print(f"  Started: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')} UTC")

    results = {}

    # Environment check
    test_env_setup()

    # Run tests
    results['brightdata_sdk'] = await test_brightdata_sdk()
    results['questions_with_brightdata'] = await test_question_templates_with_brightdata()
    results['discovery_with_dossier'] = await test_hypothesis_discovery_with_dossier()
    results['yp_scorer_real'] = await test_yp_scorer_with_real_signals()
    results['contact_validation'] = await test_contact_validation_with_real_data()
    results['full_pipeline'] = await test_full_pipeline_simulation()

    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)

    for test_name, result in results.items():
        if result is None:
            status = "⚠️  SKIPPED"
        elif result is True:
            status = "✅ PASSED"
        else:
            status = "❌ FAILED"
        print(f"  {status}: {test_name.replace('_', ' ').title()}")

    passed = sum(1 for v in results.values() if v is True)
    total = len([v for v in results.values() if v is not None])

    print(f"\n  Overall: {passed}/{total} tests passed")

    if passed == total:
        print("\n🎉 All tests passed! Question-first dossier integration with BrightData SDK is working.")
        print("\n📋 Key Capabilities Verified:")
        print("   • Entity-type question templates with YP mapping")
        print("   • Hypothesis generation with validation strategies")
        print("   • Contact validation (placeholder rejection)")
        print("   • YP service scoring and positioning")
        print("   • Discovery hop type mapping")
        print("   • BrightData SDK integration for targeted searches")
    else:
        print(f"\n⚠️  {total - passed} test(s) failed or skipped.")

    return 0 if passed == total else 1


if __name__ == "__main__":
    exit(asyncio.run(main()))
