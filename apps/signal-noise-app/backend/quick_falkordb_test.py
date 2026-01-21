#!/usr/bin/env python3
"""Quick FalkorDB Cloud connection test"""
import os
from pathlib import Path

project_root = Path(__file__).parent.parent
os.chdir(project_root)

from dotenv import load_dotenv
load_dotenv()

import redis
import socket

# Connection details from .env
host = "r-6jissuruar.instance-vnsu2asxb.hc-srom4rolb.eu-west-1.aws.f2e0a955bb84.cloud"
port = 50743
password = "N!HH@CBC9QDesFdS"

print(f"Testing connection to {host}:{port}...")

# Test TCP connection first
print("1. TCP Connection Test...")
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.settimeout(5)
try:
    sock.connect((host, port))
    print("   ✅ TCP connection successful")
except Exception as e:
    print(f"   ❌ TCP failed: {e}")
    sock.close()
    exit(1)
sock.close()

# Test Redis connection
print("2. Redis Connection Test...")
try:
    client = redis.Redis(
        host=host,
        port=port,
        password=password,
        ssl=True,
        ssl_cert_reqs=None,
        socket_timeout=5,
        socket_connect_timeout=5,
        decode_responses=True
    )
    result = client.ping()
    print(f"   ✅ PING: {result}")

    # Check modules
    modules = client.execute_command("MODULE", "LIST")
    print(f"   ✅ Modules: {modules}")

    # Test Graph query
    print("3. Graph Query Test...")
    response = client.execute_command("GRAPH.QUERY", "sports_intelligence", "RETURN 1")
    print(f"   ✅ Graph query: {response}")

except Exception as e:
    print(f"   ❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\nDone!")
