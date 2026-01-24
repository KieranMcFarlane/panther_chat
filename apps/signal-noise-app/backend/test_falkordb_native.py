#!/usr/bin/env python3
from falkordb import FalkorDB

print("Testing FalkorDB native client without auth...")

try:
    # Connect without username/password for local dev
    db = FalkorDB(host='localhost', port=6379, ssl=False)
    g = db.select_graph('sports_intelligence')

    # Test query
    result = g.query("RETURN 1 AS test")
    print(f"✓ Query successful: {result}")

    # Create entity
    g.query("CREATE (ac:Entity {name: 'AC Milan', type: 'ORG'})")
    print("✓ Created AC Milan")

    # Query back
    result = g.query("MATCH (n:Entity) RETURN count(n) AS count")
    print(f"✓ Total entities: {result[0][0]}")

    print("\n✅ SUCCESS! FalkorDB works!")

except Exception as e:
    print(f"✗ Failed: {e}")
