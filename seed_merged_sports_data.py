#!/usr/bin/env python3
"""
Seed merged sports data from merged_sports_data.json into Neo4j database.
This script imports the unified sports entities data with enhanced schema.
"""

import json
import os
from typing import Dict, List, Any
from pathlib import Path
from neo4j import GraphDatabase
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class Neo4jSeeder:
    def __init__(self, uri: str, user: str, password: str):
        """Initialize Neo4j connection."""
        self.driver = GraphDatabase.driver(uri, auth=(user, password))
        
    def close(self):
        """Close the database connection."""
        self.driver.close()
        
    def test_connection(self):
        """Test the database connection."""
        try:
            with self.driver.session() as session:
                result = session.run("RETURN 1 as test")
                logger.info("✅ Successfully connected to Neo4j")
                return True
        except Exception as e:
            logger.error(f"❌ Failed to connect to Neo4j: {e}")
            return False
    
    def clear_existing_data(self):
        """Clear existing sports entities data."""
        try:
            with self.driver.session() as session:
                # Delete existing sports entities
                result = session.run("MATCH (e:Entity) WHERE e.source IN ['csv_seed', 'json_seed'] DETACH DELETE e")
                deleted_count = result.consume().counters.nodes_deleted
                logger.info(f"🗑️  Deleted {deleted_count} existing sports entities")
                
                # Delete any orphaned nodes
                result = session.run("MATCH (n) WHERE NOT (n)--() DELETE n")
                orphaned_count = result.consume().counters.nodes_deleted
                if orphaned_count > 0:
                    logger.info(f"🗑️  Deleted {orphaned_count} orphaned nodes")
                    
        except Exception as e:
            logger.error(f"❌ Error clearing existing data: {e}")
            raise
    
    def create_indexes(self):
        """Create indexes for better performance."""
        try:
            with self.driver.session() as session:
                # Create index on entity name for faster lookups (no unique constraint)
                session.run("CREATE INDEX entity_name_index IF NOT EXISTS FOR (e:Entity) ON (e.name)")
                
                # Create index on source for faster filtering
                session.run("CREATE INDEX entity_source_index IF NOT EXISTS FOR (e:Entity) ON (e.source)")
                
                # Create index on tier for faster filtering
                session.run("CREATE INDEX entity_tier_index IF NOT EXISTS FOR (e:Entity) ON (e.tier)")
                
                # Create index on sport for faster filtering
                session.run("CREATE INDEX entity_sport_index IF NOT EXISTS FOR (e:Entity) ON (e.sport)")
                
                # Create index on country for faster filtering
                session.run("CREATE INDEX entity_country_index IF NOT EXISTS FOR (e:Entity) ON (e.country)")
                
                logger.info("✅ Created indexes")
                
        except Exception as e:
            logger.error(f"❌ Error creating indexes: {e}")
            # Continue even if indexes fail (they might already exist)
    
    def seed_entities(self, entities_data: Dict[str, Any]):
        """Seed entities into Neo4j database."""
        total_entities = 0
        name_counter = {}  # Track name occurrences
        
        try:
            with self.driver.session() as session:
                for tier in ["tier_1", "tier_2", "tier_3"]:
                    if tier in entities_data:
                        entities = entities_data[tier]
                        logger.info(f"🌱 Seeding {len(entities)} entities from {tier}...")
                        
                        for entity in entities:
                            # Handle duplicate names by adding counter suffix
                            original_name = entity.get("name", "")
                            source = entity.get("source", "")
                            
                            # Make name unique by adding counter if needed
                            if original_name in name_counter:
                                name_counter[original_name] += 1
                                unique_name = f"{original_name} ({source}_{name_counter[original_name]})"
                            else:
                                name_counter[original_name] = 1
                                unique_name = f"{original_name} ({source})"
                            
                            # Debug output for first few entities
                            if total_entities < 5:
                                logger.info(f"   Debug: '{original_name}' -> '{unique_name}' (source: {source})")
                            
                            # Create the entity node with all properties
                            cypher_query = """
                            CREATE (e:Entity {
                                name: $unique_name,
                                originalName: $original_name,
                                type: $type,
                                sport: $sport,
                                country: $country,
                                level: $level,
                                website: $website,
                                linkedin: $linkedin,
                                notes: $notes,
                                source: $source,
                                tier: $tier,
                                priorityScore: $priorityScore,
                                estimatedValue: $estimatedValue,
                                digitalWeakness: $digitalWeakness,
                                opportunityType: $opportunityType,
                                mobileApp: $mobileApp,
                                description: $description
                            })
                            """
                            
                            # Prepare parameters, handling None values
                            params = {
                                'unique_name': unique_name,
                                'original_name': original_name
                            }
                            for key, value in entity.items():
                                if value is not None:
                                    params[key] = value
                                else:
                                    params[key] = ""
                            
                            session.run(cypher_query, params)
                            total_entities += 1
                            
                            # Log progress every 50 entities
                            if total_entities % 50 == 0:
                                logger.info(f"   📊 Progress: {total_entities} entities seeded...")
                        
                        logger.info(f"✅ Completed seeding {tier}: {len(entities)} entities")
                
                logger.info(f"🎉 Successfully seeded {total_entities} total entities")
                return total_entities
                
        except Exception as e:
            logger.error(f"❌ Error seeding entities: {e}")
            raise
    
    def create_relationships(self):
        """Create relationships between entities based on common attributes."""
        try:
            with self.driver.session() as session:
                # Create relationships between entities of the same sport
                result = session.run("""
                    MATCH (e1:Entity), (e2:Entity)
                    WHERE e1.sport = e2.sport 
                    AND e1.sport IS NOT NULL 
                    AND e1.sport <> ""
                    AND e1 <> e2
                    AND NOT (e1)-[:SAME_SPORT]-(e2)
                    CREATE (e1)-[:SAME_SPORT]->(e2)
                    """)
                sport_rels = result.consume().counters.relationships_created
                
                # Create relationships between entities of the same country
                result = session.run("""
                    MATCH (e1:Entity), (e2:Entity)
                    WHERE e1.country = e2.country 
                    AND e1.country IS NOT NULL 
                    AND e1.country <> ""
                    AND e1 <> e2
                    AND NOT (e1)-[:SAME_COUNTRY]-(e2)
                    CREATE (e1)-[:SAME_COUNTRY]->(e2)
                    """)
                country_rels = result.consume().counters.relationships_created
                
                # Create relationships between entities of the same tier
                result = session.run("""
                    MATCH (e1:Entity), (e2:Entity)
                    WHERE e1.tier = e2.tier 
                    AND e1.tier IS NOT NULL 
                    AND e1 <> e2
                    AND NOT (e1)-[:SAME_TIER]-(e2)
                    CREATE (e1)-[:SAME_TIER]->(e2)
                    """)
                tier_rels = result.consume().counters.relationships_created
                
                logger.info(f"🔗 Created relationships:")
                logger.info(f"   - SAME_SPORT: {sport_rels}")
                logger.info(f"   - SAME_COUNTRY: {country_rels}")
                logger.info(f"   - SAME_TIER: {tier_rels}")
                
        except Exception as e:
            logger.error(f"❌ Error creating relationships: {e}")
            # Continue even if relationships fail
    
    def verify_seeding(self):
        """Verify that the seeding was successful."""
        try:
            with self.driver.session() as session:
                # Count total entities
                result = session.run("MATCH (e:Entity) RETURN count(e) as total")
                total = result.single()["total"]
                
                # Count by source
                result = session.run("MATCH (e:Entity) RETURN e.source, count(e) as count ORDER BY count DESC")
                source_counts = {row["e.source"]: row["count"] for row in result}
                
                # Count by tier
                result = session.run("MATCH (e:Entity) RETURN e.tier, count(e) as count ORDER BY e.tier")
                tier_counts = {row["e.tier"]: row["count"] for row in result}
                
                # Count relationships
                result = session.run("MATCH ()-[r]->() RETURN count(r) as total")
                relationships = result.single()["total"]
                
                logger.info(f"📊 Verification Results:")
                logger.info(f"   - Total entities: {total}")
                logger.info(f"   - By source: {source_counts}")
                logger.info(f"   - By tier: {tier_counts}")
                logger.info(f"   - Total relationships: {relationships}")
                
                return total > 0
                
        except Exception as e:
            logger.error(f"❌ Error verifying seeding: {e}")
            return False

def load_merged_data(json_path: str) -> Dict[str, Any]:
    """Load the merged sports data from JSON file."""
    try:
        with open(json_path, 'r', encoding='utf-8') as file:
            data = json.load(file)
            logger.info(f"📄 Loaded merged data: {data['metadata']['total_entities']} entities")
            return data
    except Exception as e:
        logger.error(f"❌ Error loading merged data: {e}")
        raise

def main():
    """Main function to seed the merged sports data."""
    # Configuration
    NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
    NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")
    
    # Data file path
    data_path = "../yellow-panther-ai/scraping_data/merged_sports_data.json"
    
    logger.info("🚀 Starting Neo4j seeding process for merged sports data...")
    
    # Check if data file exists
    if not Path(data_path).exists():
        logger.error(f"❌ Data file not found: {data_path}")
        return
    
    # Initialize Neo4j connection
    seeder = Neo4jSeeder(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD)
    
    try:
        # Test connection
        if not seeder.test_connection():
            return
        
        # Load merged data
        entities_data = load_merged_data(data_path)
        
        # Clear existing data
        logger.info("🧹 Clearing existing sports entities data...")
        seeder.clear_existing_data()
        
        # Create indexes
        logger.info("🔧 Creating indexes...")
        seeder.create_indexes()
        
        # Seed entities
        logger.info("🌱 Seeding entities into Neo4j...")
        total_seeded = seeder.seed_entities(entities_data)
        
        # Create relationships
        logger.info("🔗 Creating relationships between entities...")
        seeder.create_relationships()
        
        # Verify seeding
        logger.info("✅ Verifying seeding results...")
        if seeder.verify_seeding():
            logger.info("🎉 Neo4j seeding completed successfully!")
            logger.info(f"📊 Total entities seeded: {total_seeded}")
        else:
            logger.error("❌ Seeding verification failed!")
            
    except Exception as e:
        logger.error(f"❌ Error during seeding process: {e}")
        import traceback
        traceback.print_exc()
        
    finally:
        seeder.close()

if __name__ == "__main__":
    main()
