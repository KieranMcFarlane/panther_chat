#!/usr/bin/env python3
"""Test FalkorDB using native falkordb-py library"""
import sys

try:
    from falkordb import FalkorDB
except ImportError:
    print("Installing falkordb-py...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "falkordb"])
    from falkordb import FalkorDB

# Connection details
host = "r-6jissuruar.instance-vnsu2asxb.hc-srom4rolb.eu-west-1.aws.f2e0a955bb84.cloud"
port = 50743
password = "N!HH@CBC9QDesFdS"
username = "falkordb"

print(f"Connecting to FalkorDB Cloud...")
print(f"  Host: {host}")
print(f"  Port: {port}")
print(f"  User: {username}")

try:
    db = FalkorDB(host=host, port=port, username=username, password=password)
    print("✅ FalkorDB connection successful")

    # Test graph operations
    g = db.select_graph("sports_intelligence")
    print("✅ Selected graph: sports_intelligence")

    # Simple test query
    result = g.query("RETURN 1 AS test")
    print(f"✅ Query result: {result.result_set}")

    # Test creating nodes
    g.query("CREATE (n:Test {name: 'GraphRAG', active: true}) RETURN n")
    print("✅ Created test node")

    # Query back
    result = g.query("MATCH (n:Test) RETURN n.name")
    print(f"✅ Found: {result.result_set}")

    # Clean up
    g.query("MATCH (n:Test) DELETE n")
    print("✅ Cleaned up test data")

except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n✅ FalkorDB + GraphRAG is ready!")
