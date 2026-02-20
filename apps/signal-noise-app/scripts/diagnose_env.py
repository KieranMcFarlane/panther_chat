#!/usr/bin/env python3
"""
Quick diagnostic script to verify environment variables load correctly
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

print("=== Environment Variable Diagnostic ===\n")

# Load .env
print("Loading .env file...")
load_dotenv()
print("✅ .env loaded\n")

# Check BrightData token
brightdata_token = os.getenv('BRIGHTDATA_API_TOKEN')
if brightdata_token:
    masked = f"{brightdata_token[:8]}...{brightdata_token[-4:]}" if len(brightdata_token) > 12 else "***"
    print(f"✅ BRIGHTDATA_API_TOKEN: {masked} ({len(brightdata_token)} chars)")
else:
    print("❌ BRIGHTDATA_API_TOKEN: NOT FOUND")

# Check Anthropic tokens
anthropic_auth = os.getenv('ANTHROPIC_AUTH_TOKEN')
anthropic_key = os.getenv('ANTHROPIC_API_KEY')

if anthropic_auth:
    masked = f"{anthropic_auth[:8]}...{anthropic_auth[-4:]}" if len(anthropic_auth) > 12 else "***"
    print(f"✅ ANTHROPIC_AUTH_TOKEN: {masked} ({len(anthropic_auth)} chars)")
else:
    print("❌ ANTHROPIC_AUTH_TOKEN: NOT FOUND")

if anthropic_key:
    masked = f"{anthropic_key[:8]}...{anthropic_key[-4:]}" if len(anthropic_key) > 12 else "***"
    print(f"✅ ANTHROPIC_API_KEY: {masked} ({len(anthropic_key)} chars)")
else:
    print("❌ ANTHROPIC_API_KEY: NOT FOUND")

# Check base URL
base_url = os.getenv('ANTHROPIC_BASE_URL')
print(f"✅ ANTHROPIC_BASE_URL: {base_url}")

# Now test imports and initialization
print("\n=== Testing Backend Initialization ===\n")

sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from backend.brightdata_sdk_client import BrightDataSDKClient
    print("✅ BrightDataSDKClient imported")

    client = BrightDataSDKClient()
    if client.token:
        print(f"✅ BrightData SDK initialized with token: {len(client.token)} chars")
    else:
        print("❌ BrightData SDK initialized WITHOUT token")

except Exception as e:
    print(f"❌ BrightData SDK error: {e}")

try:
    from backend.claude_client import ClaudeClient
    print("✅ ClaudeClient imported")

    claude = ClaudeClient()
    if claude.api_key:
        print(f"✅ Claude client initialized with token: {len(claude.api_key)} chars")
        print(f"   Base URL: {claude.base_url}")
    else:
        print("❌ Claude client initialized WITHOUT token")

except Exception as e:
    print(f"❌ Claude client error: {e}")

print("\n=== Diagnostic Complete ===")
