#!/usr/bin/env python3
"""Debug FalkorDB authentication"""
import os
from pathlib import Path
from dotenv import load_dotenv

project_root = Path(__file__).parent.parent
load_dotenv(project_root / '.env')

from falkordb import FalkorDB

# Config from env
uri = os.getenv("FALKORDB_URI")
username = os.getenv("FALKORDB_USER")
password = os.getenv("FALKORDB_PASSWORD")

print(f"URI: {uri}")
print(f"User: {username}")
print(f"Pass: {'*' * len(password) if password else 'NOT SET'}")

# Parse host from URI
import urllib.parse
parsed = urllib.parse.urlparse(uri.replace("rediss://", "http://"))
host = parsed.hostname
port = parsed.port

print(f"Host: {host}")
print(f"Port: {port}")

# Test connection with explicit parameters
print("\nTesting connection...")
try:
    db = FalkorDB(host=host, port=port, username=username, password=password)
    print("✅ Connected!")

    g = db.select_graph("sports_intelligence")
    result = g.query("RETURN 1 AS test")
    print(f"✅ Query result: {result.result_set}")

except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
