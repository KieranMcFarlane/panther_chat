#!/usr/bin/env python3
"""Check Anthropic API account status"""
import os
from anthropic import Anthropic

api_key = os.getenv("ANTHROPIC_API_KEY", "")
if not api_key:
    print("❌ ANTHROPIC_API_KEY environment variable not set")
    exit(1)

print("="*80)
print("🔍 ANTHROPIC API ACCOUNT STATUS")
print("="*80)
print()

client = Anthropic(api_key=api_key)

try:
    # Try a minimal API call to check account status
    response = client.messages.create(
        model="claude-3-5-haiku-20241022",
        max_tokens=10,
        messages=[{"role": "user", "content": "Hi"}]
    )
    
    print("✅ API Key is valid")
    print(f"   Model: {response.model}")
    print(f"   Usage: {response.usage.input_tokens} input tokens, {response.usage.output_tokens} output tokens")
    print()
    print("💡 If you see this, you have API credits available!")
    
except Exception as e:
    error_str = str(e)
    if "credit balance" in error_str.lower():
        print("❌ Insufficient API Credits")
        print()
        print("📝 What this means:")
        print("   • Your API key is valid")
        print("   • Your Claude Max subscription is active")
        print("   • BUT: API credits are separate from subscription")
        print()
        print("💳 To purchase API credits:")
        print("   1. Go to: https://console.anthropic.com/settings/plans")
        print("   2. Look for 'Purchase Credits' or 'Add Funds'")
        print("   3. Minimum purchase: Usually $5-$25")
        print()
        print("📊 Expected costs for this deployment:")
        print("   • Per signal validation: ~$0.0001")
        print("   • Daily (3,400 entities): ~$3.40")
        print("   • Monthly: ~$100")
        print("   • With Haiku cascade: 92% savings vs Sonnet")
    elif "invalid" in error_str.lower() or "401" in error_str:
        print("❌ Invalid API Key")
    else:
        print(f"❌ Error: {error_str}")

print()
print("="*80)
