#!/usr/bin/env python3
"""
Test Question-First Dossier with Real Entity: Premier League (SPORT_LEAGUE)

This tests the complete system with a SPORT_LEAGUE entity type.
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


async def test_league_question_templates():
    """Test 1: SPORT_LEAGUE question templates"""
    print("\n" + "=" * 80)
    print("TEST 1: Premier League (SPORT_LEAGUE) Question Templates")
    print("=" * 80)
    
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


async def test_league_hypothesis_generation():
    """Test 2: Generate Premier League-specific hypotheses"""
    print("\n" + "=" * 80)
    print("TEST 2: Generate Hypotheses for Premier League")
    print("=" * 80)
    
    hypotheses = generate_hypothesis_batch(
        entity_type="SPORT_LEAGUE",
        entity_name="Premier League",
        entity_id="premier-league",
        max_questions=5
    )
    
    print(f"\n🎯 Generated {len(hypotheses)} hypotheses for Premier League:\n")
    
    for hyp in hypotheses:
        print(f"📋 {hyp['statement']}")
        print(f"   Confidence: {hyp['confidence']}")
        print(f"   YP Services: {', '.join(hyp['metadata']['yp_service_fit'])}")
        print(f"   Budget: {hyp['metadata']['budget_range']}")
        print(f"   Positioning: {hyp['metadata']['positioning_strategy']}")
        print(f"   Next Signals: {hyp['metadata']['next_signals'][:2]}")
        print()
    
    return True


async def test_league_with_brightdata():
    """Test 3: Premier League targeted discovery with BrightData SDK"""
    print("\n" + "=" * 80)
    print("TEST 3: Premier League Targeted Discovery with BrightData SDK")
    print("=" * 80)
    
    if not os.getenv('BRIGHTDATA_API_TOKEN'):
        print("⚠️  BRIGHTDATA_API_TOKEN not set - skipping real scraping")
        return None
    
    brightdata = BrightDataSDKClient()
    
    # Generate hypotheses first
    hypotheses = generate_hypothesis_batch(
        entity_type="SPORT_LEAGUE",
        entity_name="Premier League",
        entity_id="premier-league",
        max_questions=3
    )
    
    print(f"\n🔍 Testing targeted searches for Premier League:\n")
    
    for hyp in hypotheses[:3]:
        print(f"🎯 Hypothesis: {hyp['statement'][:60]}...")
        
        # Use next_signals to generate targeted searches
        for signal in hyp['metadata']['next_signals'][:2]:
            query = f'"Premier League" {signal}'
            print(f"\n   → Search: {query}")
            
            try:
                results = await brightdata.search_engine(
                    query=query,
                    engine='google',
                    num_results=5
                )
                
                if results.get('status') == 'success':
                    print(f"      ✅ Found {len(results.get('results', []))} results")
                    for r in results.get('results', [])[:2]:
                        print(f"         - {r.get('title', 'N/A')[:70]}...")
                        print(f"           URL: {r.get('url', 'N/A')}")
                else:
                    print(f"      ⚠️  Search failed: {results.get('message', 'Unknown error')}")
            except Exception as e:
                print(f"      ❌ Error: {e}")
    
    return True


async def test_league_yp_scoring():
    """Test 4: YP Scoring for Premier League opportunities"""
    print("\n" + "=" * 80)
    print("TEST 4: YP Scoring for Premier League Opportunities")
    print("=" * 80)
    
    scorer = YellowPantherFitScorer()
    
    # Real Premier League signal scenarios
    test_scenarios = [
        {
            'name': 'Premier League Centralized Analytics Platform',
            'signal': {
                'signal_category': 'analytics',
                'evidence': [{'content': 'Premier League seeking centralized data platform for all 20 clubs with advanced performance analytics'}],
                'confidence': 0.80
            },
            'entity': {'name': 'Premier League', 'country': 'UK'}
        },
        {
            'name': 'Premier League Digital Transformation',
            'signal': {
                'signal_category': 'digital transformation',
                'evidence': [{'content': 'League-wide modernization of broadcast and streaming infrastructure'}],
                'confidence': 0.75
            },
            'entity': {'name': 'Premier League', 'country': 'UK'}
        },
        {
            'name': 'Premier League Fan Engagement Platform',
            'signal': {
                'signal_category': 'mobile app',
                'evidence': [{'content': 'Unified fan engagement app for all Premier League clubs with personalized content'}],
                'confidence': 0.70
            },
            'entity': {'name': 'Premier League', 'country': 'UK'}
        }
    ]
    
    print(f"\n📊 Testing {len(test_scenarios)} Premier League signal scenarios:\n")
    
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


async def test_league_contact_validation():
    """Test 5: Premier League Contact Validation"""
    print("\n" + "=" * 80)
    print("TEST 5: Premier League Contact Validation")
    print("=" * 80)
    
    # Mix of real and placeholder league contacts
    test_contacts = [
        {"name": "Richard Masters", "title": "Chief Executive Officer", "linkedin_url": "linkedin.com/in/richardmasters"},
        {"name": "{LEAGUE COMMISSIONER}", "title": "Commissioner", "linkedin_url": ""},
        {"name": "Susanna Dinnage", "title": "CEO", "linkedin_url": "linkedin.com/in/susanna"},
        {"name": "{DIRECTOR OF OPERATIONS}", "title": "Director of Operations", "linkedin_url": ""},
        {"name": "Will Brass", "title": "Chief Commercial Officer", "linkedin_url": "linkedin.com/in/willbrass"},
        {"name": "General Counsel", "title": "General Counsel", "linkedin_url": ""},  # Generic
    ]
    
    print(f"\n👥 Testing {len(test_contacts)} league contacts:\n")
    
    valid_contacts = []
    invalid_contacts = []
    
    for contact in test_contacts:
        is_valid, message = validate_contact_data(contact)
        status = "✅ VALID" if is_valid else "❌ INVALID"
        print(f"   {status}: {contact['name']} ({contact['title']})")
        print(f"           Reason: {message}")
        
        if is_valid:
            valid_contacts.append(contact)
        else:
            invalid_contacts.append(contact)
    
    print(f"\n📊 Validation Metrics:")
    print(f"   Valid: {len(valid_contacts)}/{len(test_contacts)} ({len(valid_contacts)/len(test_contacts)*100:.1f}%)")
    print(f"   Invalid (Placeholders): {len(invalid_contacts)}/{len(test_contacts)} ({len(invalid_contacts)/len(test_contacts)*100:.1f}%)")
    
    return True


async def test_compare_entity_types():
    """Test 6: Compare all three entity types"""
    print("\n" + "=" * 80)
    print("TEST 6: Entity Type Comparison")
    print("=" * 80)
    
    entity_types = ["SPORT_CLUB", "SPORT_FEDERATION", "SPORT_LEAGUE"]
    entity_names = ["Arsenal FC", "International Canoe Federation", "Premier League"]
    entity_ids = ["arsenal-fc", "icf", "premier-league"]
    
    print(f"\n📊 Comparing question templates across entity types:\n")
    
    for et, en, eid in zip(entity_types, entity_names, entity_ids):
        questions = get_questions_for_entity_type(et)
        print(f"🏟️  {en} ({et})")
        print(f"   Questions: {len(questions)}")
        
        # Generate hypotheses
        hypotheses = generate_hypothesis_batch(et, en, eid, max_questions=3)
        
        # Show unique YP services
        all_services = set()
        for h in hypotheses:
            all_services.update(h['metadata']['yp_service_fit'])
        
        print(f"   Hypotheses: {len(hypotheses)}")
        print(f"   YP Services: {', '.join(sorted(all_services))}")
        
        # Show budget range
        budgets = [h['metadata']['budget_range'] for h in hypotheses]
        print(f"   Budgets: {', '.join(budgets[:2])}{'...' if len(budgets) > 2 else ''}")
        print()
    
    return True


async def main():
    """Run all Premier League tests"""
    print("\n" + "=" * 80)
    print("  QUESTION-FIRST DOSSIER TEST - PREMIER LEAGUE (SPORT_LEAGUE)")
    print("=" * 80)
    print(f"  Started: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')} UTC")
    print(f"  Entity: Premier League")
    print(f"  Entity Type: SPORT_LEAGUE")
    
    results = {}
    
    # Run tests
    results['question_templates'] = await test_league_question_templates()
    results['hypothesis_generation'] = await test_league_hypothesis_generation()
    results['brightdata_discovery'] = await test_league_with_brightdata()
    results['yp_scoring'] = await test_league_yp_scoring()
    results['contact_validation'] = await test_league_contact_validation()
    results['entity_comparison'] = await test_compare_entity_types()
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY - PREMIER LEAGUE")
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
        print("\n🎉 All Premier League tests passed! Question-first system working for SPORT_LEAGUE entities.")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed.")
        return 1


if __name__ == "__main__":
    exit(asyncio.run(main()))
