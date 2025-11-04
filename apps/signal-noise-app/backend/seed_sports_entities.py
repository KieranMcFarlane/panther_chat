#!/usr/bin/env python3
"""
Sports Entities Knowledge Graph Seeder
Processes the Global Sports Entities CSV and seeds the knowledge graph using the MCP system.
"""

import csv
import json
import time
import requests
from typing import List, Dict, Any
import os
import sys

# Add the backend directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from backend.neo4j_client import Neo4jMCPClient

class SportsEntitySeeder:
    def __init__(self, csv_path: str, api_base_url: str = "http://localhost:8000"):
        self.csv_path = csv_path
        self.api_base_url = api_base_url
        self.processed_count = 0
        self.max_entities = 10
        self.neo4j_client = Neo4jMCPClient()
        
    def load_csv_data(self) -> List[Dict[str, Any]]:
        """Load and parse the CSV file"""
        entities = []
        encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']
        
        for encoding in encodings:
            try:
                with open(self.csv_path, 'r', encoding=encoding) as file:
                    reader = csv.DictReader(file)
                    for row in reader:
                        if self.processed_count >= self.max_entities:
                            break
                        
                        # Clean and structure the data
                        entity = {
                            'name': row['Entity Name'].strip(),
                            'type': row['Type'].strip(),
                            'sport': row['Sport'].strip(),
                            'country': row['Country/Region'].strip(),
                            'level': row['Level/Division'].strip(),
                            'website': row['Website'].strip() if row['Website'] else None,
                            'linkedin': row['LinkedIn Profile URL'].strip() if row['LinkedIn Profile URL'] else None,
                            'notes': row['Notes'].strip() if row['Notes'] else None
                        }
                        entities.append(entity)
                        self.processed_count += 1
                    
                    print(f"✅ Successfully loaded CSV with {encoding} encoding")
                    break
                    
            except UnicodeDecodeError:
                print(f"⚠️ Failed with {encoding} encoding, trying next...")
                continue
            except Exception as e:
                print(f"Error loading CSV with {encoding}: {e}")
                continue
            
        return entities
    
    def create_base_entity_in_neo4j(self, entity: Dict[str, Any]) -> bool:
        """Create the base entity node in Neo4j"""
        try:
            # Create the main entity node
            cypher_query = """
            MERGE (e:Entity {name: $name})
            SET e.type = $type,
                e.sport = $sport,
                e.country = $country,
                e.level = $level,
                e.website = $website,
                e.linkedin = $linkedin,
                e.notes = $notes,
                e.created_at = datetime(),
                e.source = 'sports_csv_seeder'
            RETURN e
            """
            
            result = self.neo4j_client.execute_cypher_query(cypher_query, {
                'name': entity['name'],
                'type': entity['type'],
                'sport': entity['sport'],
                'country': entity['country'],
                'level': entity['level'],
                'website': entity['website'],
                'linkedin': entity['linkedin'],
                'notes': entity['notes']
            })
            
            if result and result.get('status') == 'success':
                print(f"✅ Created base entity: {entity['name']}")
                return True
            else:
                print(f"❌ Failed to create base entity: {entity['name']}")
                print(f"   Result: {result}")
                return False
                
        except Exception as e:
            print(f"❌ Error creating entity {entity['name']}: {e}")
            return False
    
    def enrich_entity_via_mcp(self, entity: Dict[str, Any]) -> bool:
        """Enrich entity using the MCP system via the API"""
        try:
            # Call the dossier enrichment API
            response = requests.post(
                f"{self.api_base_url}/dossier/direct",
                headers={"Content-Type": "application/json"},
                json={
                    "entity_name": entity['name'],
                    "entity_type": "sports_club"
                },
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ Enriched {entity['name']} via MCP - Summary length: {len(result.get('summary', ''))}")
                
                # Update the entity with enrichment data
                self.update_entity_with_enrichment(entity['name'], result)
                return True
            else:
                print(f"❌ Failed to enrich {entity['name']}: HTTP {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Error enriching {entity['name']}: {e}")
            return False
    
    def update_entity_with_enrichment(self, entity_name: str, enrichment_data: Dict[str, Any]):
        """Update the Neo4j entity with enrichment data"""
        try:
            # Store enrichment summary
            if enrichment_data.get('summary'):
                cypher_query = """
                MATCH (e:Entity {name: $name})
                SET e.enrichment_summary = $summary,
                    e.enriched_at = datetime(),
                    e.data_sources = $data_sources
                RETURN e
                """
                
                self.neo4j_client.execute_cypher_query(cypher_query, {
                    'name': entity_name,
                    'summary': enrichment_data['summary'],
                    'data_sources': json.dumps(enrichment_data.get('data_sources', {}))
                })
                
            # Process Cypher updates if available
            if enrichment_data.get('cypher_updates'):
                for cypher_update in enrichment_data['cypher_updates']:
                    try:
                        self.neo4j_client.execute_cypher_query(cypher_update, {})
                        print(f"  🔄 Applied Cypher update for {entity_name}")
                    except Exception as e:
                        print(f"  ⚠️ Failed to apply Cypher update: {e}")
                        
        except Exception as e:
            print(f"❌ Error updating entity {entity_name} with enrichment: {e}")
    
    def seed_knowledge_graph(self):
        """Main seeding process"""
        print(f"🚀 Starting Sports Entities Knowledge Graph Seeding")
        print(f"📊 Target: Up to {self.max_entities} entities")
        print(f"📁 CSV Source: {self.csv_path}")
        print(f"🌐 API Base: {self.api_base_url}")
        print("=" * 60)
        
        # Load CSV data
        entities = self.load_csv_data()
        print(f"📋 Loaded {len(entities)} entities from CSV")
        
        if not entities:
            print("❌ No entities to process")
            return
        
        # Process each entity
        successful_creations = 0
        successful_enrichments = 0
        
        for i, entity in enumerate(entities, 1):
            print(f"\n[{i}/{len(entities)}] Processing: {entity['name']}")
            print(f"   Sport: {entity['sport']} | Country: {entity['country']} | Level: {entity['level']}")
            
            # Create base entity in Neo4j
            if self.create_base_entity_in_neo4j(entity):
                successful_creations += 1
                
                # Enrich via MCP system
                print(f"   🔍 Enriching via MCP system...")
                if self.enrich_entity_via_mcp(entity):
                    successful_enrichments += 1
                
                # Rate limiting to avoid overwhelming the API
                time.sleep(2)
            else:
                print(f"   ⚠️ Skipping enrichment due to creation failure")
        
        # Summary
        print("\n" + "=" * 60)
        print(f"🎯 SEEDING COMPLETE")
        print(f"📊 Total Processed: {len(entities)}")
        print(f"✅ Successful Creations: {successful_creations}")
        print(f"🔍 Successful Enrichments: {successful_enrichments}")
        print(f"📈 Success Rate: {(successful_creations/len(entities)*100):.1f}%")
        
        # Verify in Neo4j
        self.verify_seeding_results()
    
    def verify_seeding_results(self):
        """Verify the seeding results in Neo4j"""
        try:
            print(f"\n🔍 Verifying seeding results...")
            
            # Count total entities
            count_query = "MATCH (e:Entity) WHERE e.source = 'sports_csv_seeder' RETURN count(e) as total"
            total_result = self.neo4j_client.execute_cypher_query(count_query, {})
            
            # Count enriched entities
            enriched_query = "MATCH (e:Entity) WHERE e.source = 'sports_csv_seeder' AND e.enrichment_summary IS NOT NULL RETURN count(e) as enriched"
            enriched_result = self.neo4j_client.execute_cypher_query(enriched_query, {})
            
            total = total_result.get('data', [0])[0] if total_result.get('data') else 0
            enriched = enriched_result.get('data', [0])[0] if enriched_result.get('data') else 0
            
            print(f"📊 Neo4j Verification:")
            print(f"   Total seeded entities: {total}")
            print(f"   Enriched entities: {enriched}")
            print(f"   Enrichment rate: {(enriched/total*100):.1f}%" if total > 0 else "N/A")
            
        except Exception as e:
            print(f"❌ Error verifying results: {e}")

def main():
    # Path to the CSV file
    csv_path = "/Users/kieranmcfarlane/Downloads/panther_chat/yellow-panther-ai/scraping_data/Global Sports Entities_AIBiztool.csv"
    
    # Check if CSV exists
    if not os.path.exists(csv_path):
        print(f"❌ CSV file not found: {csv_path}")
        return
    
    # Initialize seeder
    seeder = SportsEntitySeeder(csv_path)
    
    # Start seeding
    seeder.seed_knowledge_graph()

if __name__ == "__main__":
    main()
