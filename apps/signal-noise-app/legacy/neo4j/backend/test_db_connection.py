#!/usr/bin/env python3
"""
Test script to verify Neo4j database connection and query results
"""

import os
import sys
from backend.neo4j_client import Neo4jMCPClient

def test_connection():
    print("🔌 Testing Neo4j connection...")
    print(f"NEO4J_URI: {os.getenv('NEO4J_URI', 'NOT SET')}")
    print(f"NEO4J_USER: {os.getenv('NEO4J_USER', 'NOT SET')}")
    print(f"NEO4J_PASSWORD: {'SET' if os.getenv('NEO4J_PASSWORD') else 'NOT SET'}")
    
    try:
        neo = Neo4jMCPClient()
        
        # Test basic connection
        result = neo.execute_cypher_query("MATCH (e:Entity) RETURN count(e) as total")
        print(f"✅ Total entities: {result.get('results', [{}])[0].get('total', 0)}")
        
        # Test enriched entities
        enriched_result = neo.execute_cypher_query("MATCH (e:Entity) WHERE e.enriched = true RETURN count(e) as enriched_count")
        print(f"✅ Enriched entities: {enriched_result.get('results', [{}])[0].get('enriched_count', 0)}")
        
        # Test specific entity
        entity_result = neo.execute_cypher_query("MATCH (e:Entity) WHERE e.name = '1. FC Köln' RETURN e.name, e.enriched, e.enrichment_summary")
        if entity_result.get('results'):
            entity = entity_result['results'][0]
            print(f"✅ Found entity: {entity.get('e.name')} - enriched: {entity.get('e.enriched')}")
        else:
            print("❌ Entity '1. FC Köln' not found")
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_connection()






