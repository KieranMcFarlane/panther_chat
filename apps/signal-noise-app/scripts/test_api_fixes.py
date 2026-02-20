#!/usr/bin/env python3
"""
Test API Authentication Fixes

Tests that the API authentication fixes work correctly for:
1. BrightData SDK client (token loading)
2. Claude API client (token loading and validation)
3. Domain extraction (proper TLD validation)

Usage:
    python scripts/test_api_fixes.py
"""
import asyncio
import sys
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))


def test_brightdata_token_loading():
    """Test that BrightData token is loaded correctly"""
    print("\n" + "="*60)
    print("🧪 Test 1: BrightData SDK Token Loading")
    print("="*60)

    from backend.brightdata_sdk_client import BrightDataSDKClient

    # Check environment variable
    token = os.getenv('BRIGHTDATA_API_TOKEN')
    if token:
        print(f"✅ BRIGHTDATA_API_TOKEN found (length: {len(token)})")
        print(f"   Token preview: {token[:8]}...{token[-4:]}")
    else:
        print("❌ BRIGHTDATA_API_TOKEN not found in environment")

    # Create client
    client = BrightDataSDKClient()

    # Check if token was loaded
    if client.token:
        print(f"✅ Client loaded token successfully")
        return True
    else:
        print(f"❌ Client failed to load token")
        return False


async def test_claude_api_authentication():
    """Test that Claude API token is loaded correctly"""
    print("\n" + "="*60)
    print("🧪 Test 2: Claude API Token Loading")
    print("="*60)

    from backend.claude_client import ClaudeClient

    # Check environment variables
    api_key = os.getenv('ANTHROPIC_API_KEY') or os.getenv('ANTHROPIC_AUTH_TOKEN')
    base_url = os.getenv('ANTHROPIC_BASE_URL', 'https://api.anthropic.com')

    if api_key:
        print(f"✅ API key found (length: {len(api_key)})")
        print(f"   Key preview: {api_key[:8]}...{api_key[-4:]}")
    else:
        print("❌ No API key found (ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN)")

    print(f"   Base URL: {base_url}")

    # Create client
    client = ClaudeClient()

    # Check if client loaded correctly
    if client.api_key:
        print(f"✅ Client loaded API key successfully")
        return True
    else:
        print(f"❌ Client failed to load API key")
        return False


def test_domain_validation():
    """Test that domain validation works correctly"""
    print("\n" + "="*60)
    print("🧪 Test 3: Domain Validation")
    print("="*60)

    from backend.entity_domain_discovery import EntityDomainDiscovery

    discovery = EntityDomainDiscovery()

    # Test cases
    test_cases = [
        ("https://www.arsenal.com/news", "arsenal.com", True),
        ("https://manchesterunited.com", "manchesterunited.com", True),
        ("https://bvb.de", "bvb.de", True),
        ("manchesterunited.", None, False),  # Invalid - missing TLD
        ("https://foo.bar", None, False),  # Invalid - "bar" is only 3 chars but not a valid TLD
        ("https://example.co.uk", "example.co.uk", True),
        ("https://subdomain.example.com", "subdomain.example.com", True),
    ]

    all_passed = True
    for url, expected_domain, should_pass in test_cases:
        result = discovery._extract_domain_from_url(url)
        passed = (result == expected_domain) and (result is not None) == should_pass

        status = "✅" if passed else "❌"
        print(f"{status} {url}")
        print(f"   Expected: {expected_domain}, Got: {result}")

        if not passed:
            all_passed = False

    return all_passed


async def test_claude_api_call():
    """Test actual Claude API call (if token available)"""
    print("\n" + "="*60)
    print("🧪 Test 4: Claude API Call (Live Test)")
    print("="*60)

    from backend.claude_client import ClaudeClient

    client = ClaudeClient()

    if not client.api_key:
        print("⚠️ Skipping - No API key available")
        return None

    try:
        print("🔄 Testing API call with Haiku...")

        result = await client.query(
            prompt="Say 'Hello!' in JSON format",
            model="haiku",
            max_tokens=50
        )

        if result and result.get("content"):
            print(f"✅ API call successful")
            print(f"   Response: {result['content'][:100]}")
            print(f"   Model: {result.get('model_used')}")
            print(f"   Tokens: {result.get('tokens_used')}")
            return True
        else:
            print(f"❌ API call failed - no content returned")
            return False

    except Exception as e:
        print(f"❌ API call failed with error: {e}")
        return False


async def main():
    """Run all tests"""
    print("🧪 API Authentication Fix Verification")
    print("="*60)

    results = {}

    # Test 1: BrightData token loading
    results['brightdata_token'] = test_brightdata_token_loading()

    # Test 2: Claude API token loading
    results['claude_token'] = await test_claude_api_authentication()

    # Test 3: Domain validation
    results['domain_validation'] = test_domain_validation()

    # Test 4: Claude API call (optional)
    results['claude_api_call'] = await test_claude_api_call()

    # Print summary
    print("\n" + "="*60)
    print("📊 Test Summary")
    print("="*60)

    for test_name, passed in results.items():
        if passed is None:
            status = "⏭️  Skipped"
        elif passed:
            status = "✅ Passed"
        else:
            status = "❌ Failed"

        print(f"{status}: {test_name}")

    # Overall result
    all_required_tests = [v for v in results.values() if v is not None]
    if all_required_tests and all(all_required_tests):
        print("\n🎉 All required tests passed!")
        return 0
    else:
        print("\n⚠️ Some tests failed - review above")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
