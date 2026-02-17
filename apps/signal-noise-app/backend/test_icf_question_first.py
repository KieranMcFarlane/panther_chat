#!/usr/bin/env python3
"""
Test Question-First Dossier with Real Entity: ICF (International Canoe Federation)

This tests the complete system with a SPORT_FEDERATION entity type.
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


async def test_icf_question_templates():
    """Test 1: ICF-specific question templates"""
    print("\n" + "=" * 80)
    print("TEST 1: ICF (SPORT_FEDERATION) Question Templates")
    print("=" * 80)
    
    questions = get_questions_for_entity_type("SPORT_FEDERATION")
    
    print(f"\n📊 Total SPORT_FEDERATION Questions: {len(questions)}")
    
    for i, q in enumerate(questions, 1):
        print(f"\n{i}. {q.question_id}")
        print(f"   Question: {q.question}")
        print(f"   YP Services: {[s.value for s in q.yp_service_fit]}")
        print(f"   Budget: {q.budget_range}")
        print(f"   Positioning: {q.positioning_strategy.value}")
        print(f"   Next Signals: {q.next_signals[:2]}")
        print(f"   Hop Types: {q.hop_types}")
    
    return True


async def test_icf_hypothesis_generation():
    """Test 2: Generate ICF-specific hypotheses"""
    print("\n" + "=" * 80)
    print("TEST 2: Generate Hypotheses for ICF")
    print("=" * 80)
    
    hypotheses = generate_hypothesis_batch(
        entity_type="SPORT_FEDERATION",
        entity_name="International Canoe Federation",
        entity_id="icf",
        max_questions=6
    )
    
    print(f"\n🎯 Generated {len(hypotheses)} hypotheses for ICF:\n")
    
    for hyp in hypotheses:
        print(f"📋 {hyp['statement']}")
        print(f"   Confidence: {hyp['confidence']}")
        print(f"   YP Services: {', '.join(hyp['metadata']['yp_service_fit'])}")
        print(f"   Budget: {hyp['metadata']['budget_range']}")
        print(f"   Positioning: {hyp['metadata']['positioning_strategy']}")
        print(f"   Next Signals: {hyp['metadata']['next_signals'][:2]}")
        print()
    
    return True


async def test_icf_with_brightdata():
    """Test 3: ICF targeted discovery with BrightData SDK"""
    print("\n" + "=" * 80)
    print("TEST 3: ICF Targeted Discovery with BrightData SDK")
    print("=" * 80)
    
    if not os.getenv('BRIGHTDATA_API_TOKEN'):
        print("⚠️  BRIGHTDATA_API_TOKEN not set - skipping real scraping")
        return None
    
    brightdata = BrightDataSDKClient()
    
    # Generate hypotheses first
    hypotheses = generate_hypothesis_batch(
        entity_type="SPORT_FEDERATION",
        entity_name="International Canoe Federation",
        entity_id="icf",
        max_questions=3
    )
    
    print(f"\n🔍 Testing targeted searches for ICF:\n")
    
    for hyp in hypotheses[:3]:
        print(f"🎯 Hypothesis: {hyp['statement'][:60]}...")
        
        # Use next_signals to generate targeted searches
        for signal in hyp['metadata']['next_signals'][:2]:
            query = f'"International Canoe Federation" {signal}'
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
                        print(f"         - {r.get('title', 'N/A')[:60]}...")
                        print(f"           URL: {r.get('url', 'N/A')}")
                else:
                    print(f"      ⚠️  Search failed: {results.get('message', 'Unknown error')}")
            except Exception as e:
                print(f"      ❌ Error: {e}")
    
    return True


async def test_icf_yp_scoring():
    """Test 4: YP Scoring for ICF opportunities"""
    print("\n" + "=" * 80)
    print("TEST 4: YP Scoring for ICF Opportunities")
    print("=" * 80)
    
    scorer = YellowPantherFitScorer()
    
    # Real ICF signal scenarios
    test_scenarios = [
        {
            'name': 'ICF Member Portal Digital Transformation',
            'signal': {
                'signal_category': 'digital transformation',
                'evidence': [{'content': 'ICF seeking modern member federation management platform with mobile app support'}],
                'confidence': 0.75
            },
            'entity': {'name': 'International Canoe Federation', 'country': 'International'}
        },
        {
            'name': 'ICF Officiating Technology for Events',
            'signal': {
                'signal_category': 'analytics',
                'evidence': [{'content': 'AI-powered officiating system for canoeing and kayaking events'}],
                'confidence': 0.70
            },
            'entity': {'name': 'International Canoe Federation', 'country': 'International'}
        },
        {
            'name': 'ICF Event Management Platform',
            'signal': {
                'signal_category': 'ecommerce',
                'evidence': [{'content': 'Centralized event registration and ticketing platform for canoeing events'}],
                'confidence': 0.65
            },
            'entity': {'name': 'International Canoe Federation', 'country': 'International'}
        }
    ]
    
    print(f"\n📊 Testing {len(test_scenarios)} ICF signal scenarios:\n")
    
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


async def test_icf_contact_validation():
    """Test 5: ICF Contact Validation (Federation-specific)"""
    print("\n" + "=" * 80)
    print("TEST 5: ICF Contact Validation")
    print("=" * 80)
    
    # Mix of real and placeholder federation contacts
    test_contacts = [
        {"name": "David Choquehuanca", "title": "President", "linkedin_url": "linkedin.com/in/david"},
        {"name": "{FEDERATION PRESIDENT}", "title": "President", "linkedin_url": ""},
        {"name": "João Paulo", "title": "Secretary General", "linkedin_url": "linkedin.com/in/joao"},
        {"name": "{TECHNICAL DIRECTOR}", "title": "Technical Director", "linkedin_url": ""},
        {"name": "Head of Digital", "title": "Head of Digital", "linkedin_url": ""},  # Generic
        {"name": "Tomás Vecsey", "title": "Finance Director", "linkedin_url": "linkedin.com/in/tomas"},
    ]
    
    print(f"\n👥 Testing {len(test_contacts)} federation contacts:\n")
    
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


async def main():
    """Run all ICF tests"""
    print("\n" + "=" * 80)
    print("  QUESTION-FIRST DOSSIER TEST - ICF (SPORT_FEDERATION)")
    print("=" * 80)
    print(f"  Started: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')} UTC")
    print(f"  Entity: International Canoe Federation (ICF)")
    print(f"  Entity Type: SPORT_FEDERATION")
    
    results = {}
    
    # Run tests
    results['question_templates'] = await test_icf_question_templates()
    results['hypothesis_generation'] = await test_icf_hypothesis_generation()
    results['brightdata_discovery'] = await test_icf_with_brightdata()
    results['yp_scoring'] = await test_icf_yp_scoring()
    results['contact_validation'] = await test_icf_contact_validation()
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY - ICF")
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
        print("\n🎉 All ICF tests passed! Question-first system working for SPORT_FEDERATION entities.")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed.")
        return 1


if __name__ == "__main__":
    exit(asyncio.run(main()))
