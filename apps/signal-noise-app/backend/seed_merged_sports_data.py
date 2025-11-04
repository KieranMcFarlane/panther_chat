#!/usr/bin/env python3
"""
Seed merged sports data from merged_sports_data.json into Neo4j database.
This script imports the unified sports entities data with enhanced schema.
"""

import json
import os
from typing import Dict, Any
from pathlib import Path
from neo4j import GraphDatabase
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class Neo4jSeeder:
    def __init__(self, uri: str, user: str, password: str):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))
        
    def close(self):
        self.driver.close()
        
    def test_connection(self):
        try:
            with self.driver.session() as session:
                session.run("RETURN 1 as test")
                logger.info("✅ Successfully connected to Neo4j")
                return True
        except Exception as e:
            logger.error(f"❌ Failed to connect to Neo4j: {e}")
            return False
    
    def clear_existing_data(self):
        with self.driver.session() as session:
            result = session.run("MATCH (e:Entity) WHERE e.source IN ['csv_seed', 'json_seed'] DETACH DELETE e")
            deleted_count = result.consume().counters.nodes_deleted
            logger.info(f"🗑️  Deleted {deleted_count} existing sports entities")
            # Clean up orphans
            result = session.run("MATCH (n) WHERE NOT (n)--() DELETE n")
            orphaned_count = result.consume().counters.nodes_deleted
            if orphaned_count:
                logger.info(f"🗑️  Deleted {orphaned_count} orphaned nodes")
    
    def create_indexes(self):
        with self.driver.session() as session:
            session.run("CREATE INDEX entity_name_index IF NOT EXISTS FOR (e:Entity) ON (e.name)")
            session.run("CREATE INDEX entity_source_index IF NOT EXISTS FOR (e:Entity) ON (e.source)")
            session.run("CREATE INDEX entity_tier_index IF NOT EXISTS FOR (e:Entity) ON (e.tier)")
            session.run("CREATE INDEX entity_sport_index IF NOT EXISTS FOR (e:Entity) ON (e.sport)")
            session.run("CREATE INDEX entity_country_index IF NOT EXISTS FOR (e:Entity) ON (e.country)")
            logger.info("✅ Created indexes")
    
    def seed_entities(self, entities_data: Dict[str, Any]):
        total_entities = 0
        name_counter = {}
        with self.driver.session() as session:
            for tier in ["tier_1", "tier_2", "tier_3"]:
                if tier not in entities_data:
                    continue
                entities = entities_data[tier]
                logger.info(f"🌱 Seeding {len(entities)} entities from {tier}...")
                for entity in entities:
                    original_name = entity.get("name", "")
                    source = entity.get("source", "")
                    if original_name in name_counter:
                        name_counter[original_name] += 1
                        unique_name = f"{original_name} ({source}_{name_counter[original_name]})"
                    else:
                        name_counter[original_name] = 1
                        unique_name = f"{original_name} ({source})"
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
                    params = { 'unique_name': unique_name, 'original_name': original_name }
                    for key, value in entity.items():
                        params[key] = value if value is not None else ""
                    session.run(cypher_query, params)
                    total_entities += 1
                    if total_entities % 200 == 0:
                        logger.info(f"   📊 Progress: {total_entities} entities seeded...")
                logger.info(f"✅ Completed seeding {tier}: {len(entities)} entities")
        logger.info(f"🎉 Successfully seeded {total_entities} total entities")
        return total_entities
    
    def verify_seeding(self):
        with self.driver.session() as session:
            total = session.run("MATCH (e:Entity) RETURN count(e) as total").single()["total"]
            source_counts = {row["e.source"]: row["count"] for row in session.run("MATCH (e:Entity) RETURN e.source, count(e) as count")}
            tier_counts = {row["e.tier"]: row["count"] for row in session.run("MATCH (e:Entity) RETURN e.tier, count(e) as count")}
            logger.info("📊 Verification Results:")
            logger.info(f"   - Total entities: {total}")
            logger.info(f"   - By source: {source_counts}")
            logger.info(f"   - By tier: {tier_counts}")
            return total > 0

def load_merged_data(json_path: str) -> Dict[str, Any]:
    with open(json_path, 'r', encoding='utf-8') as file:
        data = json.load(file)
        logger.info(f"📄 Loaded merged data: {data['metadata']['total_entities']} entities")
        return data


def main():
    NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
    NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")
    data_path = "../yellow-panther-ai/scraping_data/merged_sports_data.json"

    logger.info("🚀 Starting Neo4j seeding process for merged sports data...")
    if not Path(data_path).exists():
        logger.error(f"❌ Data file not found: {data_path}")
        return

    seeder = Neo4jSeeder(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD)
    try:
        if not seeder.test_connection():
            return
        entities_data = load_merged_data(data_path)
        logger.info("🧹 Clearing existing sports entities data...")
        seeder.clear_existing_data()
        logger.info("🔧 Creating indexes...")
        seeder.create_indexes()
        logger.info("🌱 Seeding entities into Neo4j...")
        total_seeded = seeder.seed_entities(entities_data)
        logger.info("✅ Verifying seeding results...")
        if seeder.verify_seeding():
            logger.info("🎉 Neo4j seeding completed successfully!")
            logger.info(f"📊 Total entities seeded: {total_seeded}")
        else:
            logger.error("❌ Seeding verification failed!")
    finally:
        seeder.close()

if __name__ == "__main__":
    main()
