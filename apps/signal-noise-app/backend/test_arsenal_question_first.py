#!/usr/bin/env python3
"""
Test Question-First Dossier with Real Entity: Arsenal FC

This tests the question-first dossier system with Arsenal FC.
"""

import asyncio
import sys
import os
import json
from datetime import datetime, timezone

# Load environment variables
from dotenv import load_dotenv
backend_env = os.path.join(os.path.dirname(__file__), '.env')
parent_env = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(backend_env)
load_dotenv(parent_env, override=True)

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from entity_type_dossier_questions import (
    get_questions_for_entity_type,
    generate_hypothesis_batch,
    validate_contact_data,
    YPServiceCategory,
    YPPositioningStrategy
)
from brightdata_sdk_client import BrightDataSDKClient
from yellow_panther_scorer import YellowPantherFitScorer


def print_section(title: str):
    """Print a formatted section header"""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)


async def test_arsenal_question_templates():
    """Test 1: Question templates for Arsenal FC"""
    print_section("TEST 1: Arsenal FC Question Templates")

    # Arsenal FC is a club type entity
    questions = get_questions_for_entity_type("SPORT_CLUB")

    print(f"\n📊 Total SPORT_CLUB Questions: {len(questions)}")

    for i, q in enumerate(questions, 1):
        print(f"\n{i}. {q.question_id}")
        print(f"   Question: {q.question}")
        print(f"   YP Services: {[s.value for s in q.yp_service_fit]}")
        print(f"   Budget: {q.budget_range}")
        print(f"   Positioning: {q.positioning_strategy.value}")
        print(f"   Next Signals: {q.next_signals[:2]}")
        print(f"   Hop Types: {q.hop_types}")

    return True


async def test_arsenal_hypothesis_generation():
    """Test 2: Generate Arsenal FC-specific hypotheses"""
    print_section("TEST 2: Generate Hypotheses for Arsenal FC")

    hypotheses = generate_hypothesis_batch(
        entity_type="SPORT_CLUB",
        entity_name="Arsenal FC",
        entity_id="arsenal-fc",
        max_questions=5
    )

    print(f"\n🎯 Generated {len(hypotheses)} hypotheses for Arsenal FC:\n")

    for hyp in hypotheses:
        print(f"📋 {hyp['statement']}")
        print(f"   Confidence: {hyp['confidence']}")
        print(f"   YP Services: {', '.join(hyp['metadata']['yp_service_fit'])}")
        print(f"   Budget: {hyp['metadata']['budget_range']}")
        print(f"   Positioning: {hyp['metadata']['positioning_strategy']}")
        print(f"   Next Signals: {hyp['metadata']['next_signals'][:2]}")
        print()

    return True


async def test_arsenal_with_brightdata():
    """Test 3: Arsenal FC targeted discovery with BrightData SDK"""
    print_section("TEST 3: Arsenal FC Targeted Discovery")

    if not os.getenv('BRIGHTDATA_API_TOKEN'):
        print("⚠️  BRIGHTDATA_API_TOKEN not set - skipping real scraping")
        return None

    brightdata = BrightDataSDKClient()

    # Generate hypotheses first
    hypotheses = generate_hypothesis_batch(
        entity_type="SPORT_CLUB",
        entity_name="Arsenal FC",
        entity_id="arsenal-fc",
        max_questions=3
    )

    print(f"\n🔍 Testing targeted searches for Arsenal FC:\n")

    for hyp in hypotheses[:3]:
        print(f"🎯 Hypothesis: {hyp['statement']}")

        # Use next_signals to generate targeted searches
        for signal in hyp['metadata']['next_signals'][:2]:
            query = f'"Arsenal FC" {signal}'
            print(f"\n   → Search: {query}")

            try:
                results = await brightdata.search_engine(
                    query=query,
                    engine='google',
                    num_results=5
                )

                if results.get('status') == 'success':
                    print(f"      ✅ Found {len(results.get('results', []))} results")
                    for r in results.get('results', [])[:3]:
                        print(f"         - {r.get('title', 'N/A')[:70]}...")
                        print(f"           URL: {r.get('url', 'N/A')}")
                else:
                    print(f"      ⚠️  Search failed: {results.get('message', 'Unknown error')}")
            except Exception as e:
                print(f"      ❌ Error: {e}")

    return True


async def test_arsenal_yp_scoring():
    """Test 4: YP Scoring for Arsenal FC opportunities"""
    print_section("TEST 4: YP Scoring for Arsenal FC")

    scorer = YellowPantherFitScorer()

    # Real Arsenal FC signal scenarios
    test_scenarios = [
        {
            'name': 'Arsenal Mobile App',
            'signal': {
                'signal_category': 'mobile app',
                'evidence': [{'content': 'Arsenal FC seeking to rebuild official mobile app with enhanced matchday features and fan engagement'}],
                'confidence': 0.80
            },
            'entity': {'name': 'Arsenal FC', 'country': 'UK'}
        },
        {
            'name': 'Arsenal Digital Transformation',
            'signal': {
                'signal_category': 'digital transformation',
                'evidence': [{'content': 'Arsenal announces digital transformation of Emirates Stadium with new WiFi and mobile ordering'}],
                'confidence': 0.75
            },
            'entity': {'name': 'Arsenal FC', 'country': 'UK'}
        },
        {
            'name': 'Arsenal Analytics Platform',
            'signal': {
                'signal_category': 'analytics',
                'evidence': [{'content': 'Arsenal looking for performance analytics platform for first team scouting and player development'}],
                'confidence': 0.70
            },
            'entity': {'name': 'Arsenal FC', 'country': 'UK'}
        }
    ]

    print(f"\n📊 Testing {len(test_scenarios)} Arsenal FC signal scenarios:\n")

    for scenario in test_scenarios:
        print(f"🎯 Scenario: {scenario['name']}")

        result = scorer.score_opportunity(scenario['signal'], scenario['entity'])

        print(f"   Fit Score: {result['fit_score']}/100")
        print(f"   Priority: {result['priority']}")
        print(f"   Budget Alignment: {result['budget_alignment']}")
        print(f"   Service Alignment: {result['service_alignment']}")
        print(f"   Recommendations: {result['recommended_actions'][:2]}")
        print()

    return True


async def main():
    """Run all Arsenal FC tests"""
    print("\n" + "=" * 80)
    print("  QUESTION-FIRST DOSSIER TEST - ARSENAL FC")
    print("=" * 80)
    print(f"  Started: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')} UTC")
    print(f"  Entity: Arsenal FC")
    print(f"  Entity Type: SPORT_CLUB")

    results = {}

    # Run tests
    results['question_templates'] = await test_arsenal_question_templates()
    results['hypothesis_generation'] = await test_arsenal_hypothesis_generation()
    results['brightdata_discovery'] = await test_arsenal_with_brightdata()
    results['yp_scoring'] = await test_arsenal_yp_scoring()

    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY - ARSENAL FC")
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

    print(f"\n  Passed: {passed}/{total}")

    if passed == total:
        print("\n🎉 All Arsenal FC tests passed!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed.")
        return 1


if __name__ == "__main__":
    exit(asyncio.run(main()))
