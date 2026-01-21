#!/usr/bin/env python3
"""
Quick test for FalkorDB Cloud connection

Usage:
    python backend/test_falkordb_connection.py
"""

import os
import sys
from pathlib import Path

# Get project root
project_root = Path(__file__).parent.parent

# Load environment variables from multiple possible files
from dotenv import load_dotenv
load_dotenv(project_root / '.env.local')
load_dotenv(project_root / '.env')

print(f"Project root: {project_root}")
print(f"Looking for .env files in: {project_root}")

def test_redis_connection():
    """Test Redis connection to FalkorDB Cloud"""
    try:
        import redis
    except ImportError:
        print("❌ redis not installed. Run: pip install redis")
        return False

    uri = os.getenv("FALKORDB_URI")
    password = os.getenv("FALKORDB_PASSWORD")
    graph_name = os.getenv("FALKORDB_DATABASE", "sports_intelligence")

    if not uri:
        print("❌ FALKORDB_URI not set")
        return False

    # Parse URI
    if uri.startswith("rediss://"):
        host = uri.replace("rediss://", "").split(":")[0]
        port = int(uri.split(":")[-1])
        ssl = True
    elif uri.startswith("redis://"):
        host = uri.replace("redis://", "").split(":")[0]
        port = int(uri.split(":")[-1])
        ssl = False
    else:
        print(f"❌ Invalid URI: {uri}")
        return False

    print(f"🔗 Connecting to FalkorDB Cloud...")
    print(f"   Host: {host}")
    print(f"   Port: {port}")
    print(f"   SSL: {ssl}")

    try:
        client = redis.Redis(
            host=host,
            port=port,
            password=password,
            ssl=ssl,
            ssl_cert_reqs=None,
            decode_responses=True
        )

        # Test Redis connection
        client.ping()
        print("✅ Redis connection successful")

        # Check if graph module is loaded
        info = client.execute_command("MODULE", "LIST")
        print(f"✅ Loaded modules: {info}")

        # Test graph operations
        print("\n🧪 Testing Graph.QUERY...")

        # Create a simple test graph
        test_query = """
        CREATE (u:User {name: 'Alice', age: 32}),
               (f:User {name: 'Bob', age: 28}),
               (u)-[:FRIENDS_WITH]->(f)
        RETURN u, f
        """

        result = client.execute_command(
            "GRAPH.QUERY",
            graph_name,
            test_query
        )

        print(f"✅ Graph query successful: {result[0][0]} nodes created")

        # Query the graph back
        query_result = client.execute_command(
            "GRAPH.QUERY",
            graph_name,
            "MATCH (u:User) RETURN u.name, u.age"
        )

        print(f"✅ Found users: {query_result[1]}")

        # Clean up test data
        client.execute_command(f"GRAPH.DELETE {graph_name}")
        print("✅ Test graph cleaned up")

        return True

    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False


if __name__ == '__main__':
    success = test_redis_connection()
    sys.exit(0 if success else 1)
