#!/usr/bin/env python3
"""
Quick validation script for BrightData MCP integration
"""

import sys
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment
load_dotenv()

print("=" * 60)
print("BrightData MCP Integration Validation")
print("=" * 60)

# Check 1: Environment variables
print("\n1. Environment Variables:")
print(f"   BRIGHTDATA_API_TOKEN: {'✅ Set' if os.getenv('BRIGHTDATA_API_TOKEN') else '❌ Not set'}")
print(f"   BRIGHTDATA_PRO_MODE: {os.getenv('BRIGHTDATA_PRO_MODE', 'true')}")

# Check 2: MCP package
print("\n2. MCP Package Installation:")
try:
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client
    print("   ✅ mcp package installed")
    MCP_AVAILABLE = True
except ImportError as e:
    print(f"   ❌ mcp package not installed: {e}")
    print("   Install with: pip install mcp")
    MCP_AVAILABLE = False

# Check 3: Client import
print("\n3. BrightData Client Import:")
try:
    from backend.brightdata_mcp_client import BrightDataMCPClient
    print("   ✅ BrightDataMCPClient imported successfully")
except ImportError as e:
    print(f"   ❌ Failed to import client: {e}")
    sys.exit(1)

# Check 4: Client initialization
print("\n4. Client Initialization:")
try:
    client = BrightDataMCPClient()
    print(f"   ✅ Client initialized")
    print(f"   API Token: {'✅ Set' if client.api_token else '❌ Not set'}")
    print(f"   Pro Mode: {client.pro_mode}")
    print(f"   MCP Available: {MCP_AVAILABLE}")
except Exception as e:
    print(f"   ❌ Failed to initialize client: {e}")
    sys.exit(1)

# Check 5: Configuration file
print("\n5. MCP Configuration:")
mcp_config_path = Path("mcp-config.json")
if mcp_config_path.exists():
    print(f"   ✅ mcp-config.json exists")
    import json
    with open(mcp_config_path) as f:
        config = json.load(f)
        if "brightData" in config.get("mcpServers", {}):
            print(f"   ✅ brightData server configured in mcp-config.json")
        else:
            print(f"   ❌ brightData server NOT configured in mcp-config.json")
else:
    print(f"   ❌ mcp-config.json not found")

# Check 6: Requirements file
print("\n6. Dependencies:")
requirements_path = Path("backend/requirements.ralph.txt")
if requirements_path.exists():
    with open(requirements_path) as f:
        content = f.read()
        if "mcp" in content:
            print(f"   ✅ mcp dependency added to requirements.ralph.txt")
        else:
            print(f"   ❌ mcp dependency NOT in requirements.ralph.txt")
else:
    print(f"   ⚠️ requirements.ralph.txt not found")

# Summary
print("\n" + "=" * 60)
print("Validation Summary")
print("=" * 60)

all_checks_passed = (
    MCP_AVAILABLE and
    os.getenv("BRIGHTDATA_API_TOKEN") and
    mcp_config_path.exists() and
    "brightData" in json.loads(mcp_config_path.read_text()).get("mcpServers", {})
)

if all_checks_passed:
    print("✅ All checks passed! Ready to use BrightData MCP.")
    print("\nNext steps:")
    print("1. Install mcp: pip install mcp")
    print("2. Run template validation: python3 backend/test_template_validation.py")
    print("3. Or test MCP directly: python3 backend/brightdata_mcp_client.py")
else:
    print("⚠️ Some checks failed. Please fix the issues above.")

sys.exit(0 if all_checks_passed else 1)
