#!/usr/bin/env python3
"""
Test Premium Golf Enrichment Script
Tests and validates the golf enrichment process before full execution
"""

import os
import sys
import json
from datetime import datetime

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from backend.neo4j_client import Neo4jMCPClient

def test_neo4j_connection():
    """Test Neo4j connection"""
    try:
        print("🔍 Testing Neo4j connection...")
        client = Neo4jMCPClient()
        
        # Simple test query
        result = client.execute_cypher_query("RETURN 'Golf enrichment test' as message", {})
        
        if result.get('status') == 'success':
            print("✅ Neo4j connection successful!")
            return True
        else:
            print(f"❌ Neo4j connection failed: {result.get('error', 'Unknown error')}")
            return False
            
    except Exception as e:
        print(f"❌ Neo4j connection error: {str(e)}")
        return False

def test_single_golf_entity():
    """Test enrichment of a single golf entity"""
    try:
        print("\n🔍 Testing single golf entity enrichment...")
        
        # Import the enricher
        from enrich_golf_premium_yellow_panther import PremiumGolfYellowPantherEnricher
        
        # Create enricher
        enricher = PremiumGolfYellowPantherEnricher()
        
        # Test entity (PGA Tour)
        test_entity = {
            "name": "PGA Tour Test",
            "location": "Ponte Vedra Beach, Florida",
            "website": "https://www.pgatour.com",
            "category": "Professional Tour",
            "sport": "Golf",
            "priority": "CRITICAL",
            "market_tier": "TIER_1_PREMIUM",
            "description": "Test entity for premium golf enrichment validation"
        }
        
        print(f"📋 Testing entity: {test_entity['name']}")
        
        # Test LinkedIn search
        linkedin_result = enricher.search_linkedin_presence(test_entity)
        print(f"🔗 LinkedIn search: {linkedin_result['status']}")
        
        if linkedin_result['status'] == 'success':
            linkedin_data = linkedin_result['data']
            print(f"   • Found {len(linkedin_data.get('key_contacts', []))} contacts")
            
            # Test scoring
            scores = enricher.calculate_premium_golf_scores(test_entity, linkedin_data)
            print(f"📊 Scoring completed:")
            print(f"   • Opportunity Score: {scores['opportunity_score']}/10")
            print(f"   • Digital Maturity: {scores['digital_maturity']}/50")
            print(f"   • Estimated Value: £{scores['estimated_value']:,}")
            print(f"   • Panther Fit: {scores['panther_fit']}")
            
            # Test summary generation
            summary = enricher.generate_golf_enrichment_summary(test_entity, scores, linkedin_data)
            print(f"📝 Summary generated: {len(summary)} characters")
            
            print("✅ Single entity test completed successfully!")
            return True
        else:
            print("❌ LinkedIn search test failed")
            return False
            
    except Exception as e:
        print(f"❌ Single entity test error: {str(e)}")
        return False

def check_existing_golf_entities():
    """Check for existing golf entities in Neo4j"""
    try:
        print("\n🔍 Checking existing golf entities...")
        client = Neo4jMCPClient()
        
        # Query for existing golf entities
        query = """
        MATCH (e:Entity) 
        WHERE e.sport = 'Golf' OR e.name CONTAINS 'Golf' OR e.name CONTAINS 'PGA'
        RETURN e.name, e.sport, e.enriched_at, e.source
        ORDER BY e.name
        """
        
        result = client.execute_cypher_query(query, {})
        
        if result.get('status') == 'success' and result.get('results'):
            print(f"✅ Found {len(result['results'])} existing golf-related entities:")
            for row in result['results']:
                name = row.get('e.name', 'Unknown')
                sport = row.get('e.sport', 'Unknown')
                enriched_at = row.get('e.enriched_at', 'Never')
                source = row.get('e.source', 'Unknown')
                print(f"   • {name} (Sport: {sport}, Source: {source})")
        else:
            print("📋 No existing golf entities found - clean slate for enrichment!")
            
        return True
        
    except Exception as e:
        print(f"❌ Error checking existing golf entities: {str(e)}")
        return False

def validate_environment():
    """Validate environment setup"""
    print("🔍 Validating environment setup...")
    
    # Check for Perplexity API key
    perplexity_key = os.getenv('PERPLEXITY_API_KEY')
    if perplexity_key:
        print(f"✅ PERPLEXITY_API_KEY found: {perplexity_key[:10]}...")
    else:
        print("❌ PERPLEXITY_API_KEY not found in environment")
        return False
    
    # Check for required files
    required_files = [
        'enrich_golf_premium_yellow_panther.py',
        'backend/neo4j_client.py',
        'backend/perplexity_client.py'
    ]
    
    for file_path in required_files:
        full_path = os.path.join(os.path.dirname(__file__), file_path)
        if os.path.exists(full_path):
            print(f"✅ Required file found: {file_path}")
        else:
            print(f"❌ Required file missing: {file_path}")
            return False
    
    return True

def run_test_validation():
    """Run comprehensive test validation"""
    print("🏌️ Premium Golf Enrichment Test Suite")
    print("=" * 60)
    
    tests = [
        ("Environment Validation", validate_environment),
        ("Neo4j Connection", test_neo4j_connection),
        ("Existing Golf Entities Check", check_existing_golf_entities),
        ("Single Entity Enrichment", test_single_golf_entity)
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        print(f"\n🧪 Running: {test_name}")
        print("-" * 40)
        
        try:
            if test_func():
                print(f"✅ {test_name}: PASSED")
                passed += 1
            else:
                print(f"❌ {test_name}: FAILED")
                failed += 1
        except Exception as e:
            print(f"❌ {test_name}: ERROR - {str(e)}")
            failed += 1
    
    # Summary
    print(f"\n{'='*60}")
    print(f"🧪 TEST SUITE RESULTS")
    print(f"{'='*60}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"📊 Success Rate: {(passed/(passed+failed)*100):.1f}%")
    
    if failed == 0:
        print(f"\n🎉 ALL TESTS PASSED!")
        print(f"🚀 Ready to run full golf enrichment process")
        print(f"💡 Execute: python enrich_golf_premium_yellow_panther.py")
    else:
        print(f"\n⚠️  {failed} tests failed - please resolve issues before running enrichment")
    
    return failed == 0

if __name__ == "__main__":
    success = run_test_validation()
    sys.exit(0 if success else 1)