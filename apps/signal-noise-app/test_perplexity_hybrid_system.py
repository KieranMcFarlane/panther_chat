#!/usr/bin/env python3
"""
Test script for Perplexity-first hybrid RFP detection system

Tests individual components and small batch processing
"""

import asyncio
import json
import os
from datetime import datetime

# Add parent directory to path for imports
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from perplexity_first_hybrid_rfp_system import PerplexityFirstHybridRFPSystem


async def test_perplexity_connection():
    """Test Perplexity API connection"""
    print("🧪 Testing Perplexity API connection...")
    
    system = PerplexityFirstHybridRFPSystem()
    
    test_prompt = """Test query: Search for Arsenal FC procurement opportunities

Return JSON:
{
  "status": "ACTIVE_RFP|PARTNERSHIP|INITIATIVE|NONE",
  "test": "connection_verified"
}

IMPORTANT: Respond with valid JSON only, no markdown formatting."""
    
    result = await system.query_perplexity(test_prompt, max_tokens=500)
    
    print(f"✅ Perplexity Connection Test:")
    print(f"   Status: {result.get('status', 'ERROR')}")
    print(f"   Queries made: {system.perplexity_queries}")
    
    return result.get('status') in ['ACTIVE_RFP', 'PARTNERSHIP', 'INITIATIVE', 'NONE']


async def test_brightdata_connection():
    """Test BrightData SDK connection"""
    print("\n🧪 Testing BrightData SDK connection...")
    
    system = PerplexityFirstHybridRFPSystem()
    
    test_query = "Arsenal FC official website"
    
    result = await system.query_brightdata(test_query, engine="google")
    
    print(f"✅ BrightData Connection Test:")
    print(f"   Status: {result.get('status', 'error')}")
    print(f"   Results: {len(result.get('results', []))} found")
    print(f"   Queries made: {system.brightdata_queries}")
    
    return result.get('status') == 'success'


async def test_discovery_prompt():
    """Test Perplexity discovery prompt generation"""
    print("\n🧪 Testing discovery prompt generation...")
    
    system = PerplexityFirstHybridRFPSystem()
    
    prompt = system.build_perplexity_discovery_prompt(
        organization="Arsenal FC",
        sport="Football",
        country="UK"
    )
    
    print(f"✅ Discovery Prompt Generated:")
    print(f"   Length: {len(prompt)} characters")
    print(f"   Contains LinkedIn: {'linkedin.com' in prompt}")
    print(f"   Contains tender portals: {'isportconnect.com' in prompt}")
    
    return len(prompt) > 1000 and 'linkedin.com' in prompt


async def test_validation_prompt():
    """Test Perplexity validation prompt generation"""
    print("\n🧪 Testing validation prompt generation...")
    
    system = PerplexityFirstHybridRFPSystem()
    
    prompt = system.build_perplexity_validation_prompt(
        organization="Arsenal FC",
        project_title="Mobile App Development RFP",
        url="https://arsenal.com/procurement/mobile-app-rfp"
    )
    
    print(f"✅ Validation Prompt Generated:")
    print(f"   Length: {len(prompt)} characters")
    print(f"   Contains validation checks: {'validate' in prompt.lower()}")
    
    return len(prompt) > 200 and 'validate' in prompt.lower()


async def test_fit_scoring():
    """Test fit scoring algorithm"""
    print("\n🧪 Testing fit scoring algorithm...")
    
    system = PerplexityFirstHybridRFPSystem()
    
    # Test case 1: Perfect match
    opp1 = {
        "title": "Mobile App Development for Fan Engagement",
        "description": "End-to-end development of sports industry mobile application"
    }
    score1 = system.calculate_fit_score(opp1)
    
    # Test case 2: Low match
    opp2 = {
        "title": "Catering Services Request",
        "description": "Food and beverage services for stadium"
    }
    score2 = system.calculate_fit_score(opp2)
    
    print(f"✅ Fit Scoring Test:")
    print(f"   Perfect match: {score1}/100")
    print(f"   Low match: {score2}/100")
    
    return score1 > 70 and score2 < 30


async def test_single_entity_processing():
    """Test processing a single entity through all phases"""
    print("\n🧪 Testing single entity processing...")
    
    system = PerplexityFirstHybridRFPSystem()
    
    test_entity = {
        "neo4j_id": "arsenal-fc",
        "name": "Arsenal FC",
        "sport": "Football",
        "country": "UK",
        "type": "Club"
    }
    
    print(f"   Processing: {test_entity['name']}")
    
    # Phase 1: Perplexity Discovery
    phase1_result = await system.process_entity_phase1(test_entity)
    print(f"   Phase 1 Status: {phase1_result['status']}")
    
    return phase1_result['status'] in ['VERIFIED', 'VERIFIED-INDIRECT', 'NONE']


async def test_json_output():
    """Test JSON output generation"""
    print("\n🧪 Testing JSON output generation...")
    
    system = PerplexityFirstHybridRFPSystem()
    
    # Create mock results
    from perplexity_first_hybrid_rfp_system import RFPResults, RFPHighlight
    
    mock_highlight = RFPHighlight(
        organization="Test FC",
        src_link="https://test.com/rfp",
        source_type="tender_portal",
        discovery_source="perplexity_discovery",
        discovery_method="perplexity_primary",
        validation_status="VERIFIED",
        date_published="2026-02-19",
        deadline="2026-03-30",
        deadline_days_remaining=39,
        estimated_rfp_date=None,
        budget="£50,000-100,000",
        summary_json={
            "title": "Test RFP",
            "confidence": 0.9,
            "urgency": "medium",
            "fit_score": 85,
            "source_quality": 0.8
        },
        perplexity_validation={
            "verified_by_perplexity": True,
            "deadline_confirmed": True,
            "url_verified": True,
            "budget_estimated": False,
            "verification_sources": []
        }
    )
    
    mock_results = RFPResults(
        total_rfps_detected=1,
        verified_rfps=1,
        rejected_rfps=0,
        entities_checked=1,
        highlights=[mock_highlight.__dict__],
        scoring_summary={
            "avg_confidence": 0.9,
            "avg_fit_score": 85.0,
            "top_opportunity": "Test FC"
        },
        quality_metrics={
            "brightdata_detections": 0,
            "perplexity_verifications": 1,
            "verified_rate": 1.0,
            "placeholder_urls_rejected": 0,
            "expired_rfps_rejected": 0,
            "competitive_intel_gathered": 0
        },
        discovery_breakdown={
            "linkedin_posts": 0,
            "linkedin_jobs": 0,
            "tender_platforms": 1,
            "sports_news_sites": 0,
            "official_websites": 0,
            "linkedin_success_rate": 0.0,
            "tender_platform_success_rate": 1.0
        },
        perplexity_usage={
            "discovery_queries": 1,
            "validation_queries": 0,
            "competitive_intel_queries": 0,
            "total_queries": 1,
            "estimated_cost": 0.01
        },
        brightdata_usage={
            "targeted_domain_queries": 0,
            "broad_web_queries": 0,
            "total_queries": 0,
            "estimated_cost": 0.0
        },
        cost_comparison={
            "total_cost": 0.01,
            "cost_per_verified_rfp": 0.01,
            "estimated_old_system_cost": 0.05,
            "savings_vs_old_system": 0.04
        }
    )
    
    json_output = system.results_to_json(mock_results)
    
    # Verify valid JSON
    try:
        parsed = json.loads(json_output)
        print(f"✅ JSON Output Test:")
        print(f"   Valid JSON: Yes")
        print(f"   Contains highlights: {len(parsed['highlights'])} found")
        return True
    except json.JSONDecodeError:
        print(f"❌ JSON Output Test: Invalid JSON")
        return False


async def main():
    """Run all tests"""
    print("=" * 80)
    print("🧪 PERPLEXITY-FIRST HYBRID RFP SYSTEM - TEST SUITE")
    print("=" * 80)
    
    tests = [
        ("Perplexity Connection", test_perplexity_connection),
        ("BrightData Connection", test_brightdata_connection),
        ("Discovery Prompt", test_discovery_prompt),
        ("Validation Prompt", test_validation_prompt),
        ("Fit Scoring", test_fit_scoring),
        ("Single Entity Processing", test_single_entity_processing),
        ("JSON Output", test_json_output)
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = await test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} failed: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\n{passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("\n🎉 All tests passed! System ready for production.")
    else:
        print("\n⚠️  Some tests failed. Review errors above.")


if __name__ == "__main__":
    asyncio.run(main())