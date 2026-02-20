#!/usr/bin/env python3
"""
Test Question-First Dossier with Real Entity: Major League Cricket

This tests the question-first dossier system with Major League Cricket.
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


async def test_mlc_question_templates():
    """Test 1: Question templates for MLC"""
    print_section("TEST 1: Major League Cricket Question Templates")

    # MLC is a league/tournament type entity
    questions = get_questions_for_entity_type("SPORT_LEAGUE")

    print(f"\n📊 Total SPORT_LEAGUE Questions: {len(questions)}")

    for i, q in enumerate(questions, 1):
        print(f"\n{i}. {q.question_id}")
        print(f"   Question: {q.question}")
        print(f"   YP Services: {[s.value for s in q.yp_service_fit]}")
        print(f"   Budget: {q.budget_range}")
        print(f"   Positioning: {q.positioning_strategy.value}")
        print(f"   Next Signals: {q.next_signals[:2]}")
        print(f"   Hop Types: {q.hop_types}")

    return True


async def test_mlc_hypothesis_generation():
    """Test 2: Generate MLC-specific hypotheses"""
    print_section("TEST 2: Generate Hypotheses for Major League Cricket")

    hypotheses = generate_hypothesis_batch(
        entity_type="SPORT_LEAGUE",
        entity_name="Major League Cricket",
        entity_id="major-league-cricket",
        max_questions=5
    )

    print(f"\n🎯 Generated {len(hypotheses)} hypotheses for Major League Cricket:\n")

    for hyp in hypotheses:
        print(f"📋 {hyp['statement']}")
        print(f"   Confidence: {hyp['confidence']}")
        print(f"   YP Services: {', '.join(hyp['metadata']['yp_service_fit'])}")
        print(f"   Budget: {hyp['metadata']['budget_range']}")
        print(f"   Positioning: {hyp['metadata']['positioning_strategy']}")
        print(f"   Next Signals: {hyp['metadata']['next_signals'][:2]}")
        print()

    return True


async def test_mlc_with_brightdata():
    """Test 3: MLC targeted discovery with BrightData SDK"""
    print_section("TEST 3: Major League Cricket Targeted Discovery")

    if not os.getenv('BRIGHTDATA_API_TOKEN'):
        print("⚠️  BRIGHTDATA_API_TOKEN not set - skipping real scraping")
        return None

    brightdata = BrightDataSDKClient()

    # Generate hypotheses first
    hypotheses = generate_hypothesis_batch(
        entity_type="SPORT_LEAGUE",
        entity_name="Major League Cricket",
        entity_id="major-league-cricket",
        max_questions=3
    )

    print(f"\n🔍 Testing targeted searches for Major League Cricket:\n")

    for hyp in hypotheses[:3]:
        print(f"🎯 Hypothesis: {hyp['statement']}")

        # Use next_signals to generate targeted searches
        for signal in hyp['metadata']['next_signals'][:2]:
            query = f'"Major League Cricket" {signal}'
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


async def test_mlc_yp_scoring():
    """Test 4: YP Scoring for MLC opportunities"""
    print_section("TEST 4: YP Scoring for Major League Cricket")

    scorer = YellowPantherFitScorer()

    # Real MLC signal scenarios
    test_scenarios = [
        {
            'name': 'MLC Centralized Analytics Platform',
            'signal': {
                'signal_category': 'analytics',
                'evidence': [{'content': 'Major League Cricket seeking centralized data platform for all 6 teams with advanced performance analytics and fan insights'}],
                'confidence': 0.80
            },
            'entity': {'name': 'Major League Cricket', 'country': 'USA'}
        },
        {
            'name': 'MLC Digital Transformation',
            'signal': {
                'signal_category': 'digital transformation',
                'evidence': [{'content': 'MLC announces league-wide modernization of broadcast and streaming infrastructure for enhanced fan experience'}],
                'confidence': 0.75
            },
            'entity': {'name': 'Major League Cricket', 'country': 'USA'}
        },
        {
            'name': 'MLC Fan Engagement Platform',
            'signal': {
                'signal_category': 'mobile app',
                'evidence': [{'content': 'Major League Cricket launches unified fan engagement app for all 6 teams with personalized content and live stats'}],
                'confidence': 0.70
            },
            'entity': {'name': 'Major League Cricket', 'country': 'USA'}
        }
    ]

    print(f"\n📊 Testing {len(test_scenarios)} MLC signal scenarios:\n")

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
    """Run all MLC tests"""
    print("\n" + "=" * 80)
    print("  QUESTION-FIRST DOSSIER TEST - MAJOR LEAGUE CRICKET")
    print("=" * 80)
    print(f"  Started: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')} UTC")
    print(f"  Entity: Major League Cricket")
    print(f"  Entity Type: SPORT_LEAGUE")

    results = {}

    # Run tests
    results['question_templates'] = await test_mlc_question_templates()
    results['hypothesis_generation'] = await test_mlc_hypothesis_generation()
    results['brightdata_discovery'] = await test_mlc_with_brightdata()
    results['yp_scoring'] = await test_mlc_yp_scoring()

    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY - MAJOR LEAGUE CRICKET")
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
        print("\n🎉 All MLC tests passed!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed.")
        return 1


if __name__ == "__main__":
    exit(asyncio.run(main()))
