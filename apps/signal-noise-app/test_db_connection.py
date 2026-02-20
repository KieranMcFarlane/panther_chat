#!/usr/bin/env python3
"""
Test database connection and list available entities for discovery.
"""
import os
from neo4j import GraphDatabase

# Neo4j Aura connection
NEO4J_URI = "neo4j+s://b9f0aba8.databases.neo4j.io"
NEO4J_USER = "neo4j"
NEO4J_PASSWORD = "f_Eq5P5dGx_7qA7WKKqU9xSmXGWPf6uMWCGvV4-m8RsA"

print(f"Connecting to Neo4j Aura...")
print(f"URI: {NEO4J_URI}")
print("-" * 80)

try:
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

    with driver.session() as session:
        # Count entities
        result = session.run('MATCH (e:Entity) RETURN count(e) as total')
        count = result.single()['total']
        print(f"Total entities in database: {count}")
        print()

        # Get sample entities
        result = session.run('''
            MATCH (e:Entity)
            RETURN e.entity_id as entity_id, e.name as name
            LIMIT 20
        ''')

        print("Sample entities:")
        print("-" * 80)
        entities = []
        for record in result:
            entity_id = record['entity_id']
            name = record['name']
            entities.append(entity_id)
            print(f"  {entity_id}: {name}")

        print()
        print("-" * 80)

        # Save entity list to file for discovery
        with open('data/entity_list.txt', 'w') as f:
            for entity_id in entities[:10]:  # First 10 for pilot
                f.write(f"{entity_id}\n")

        print(f"✅ Saved {len(entities[:10])} entities to data/entity_list.txt")

    driver.close()

except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
