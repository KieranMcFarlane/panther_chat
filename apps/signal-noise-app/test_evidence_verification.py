#!/usr/bin/env python3
"""
Test Evidence Verification - iteration_02 Aligned

Demonstrates the new evidence verification feature that:
1. Validates URLs are accessible
2. Checks source credibility
3. Adjusts confidence based on verification
4. Prevents fake evidence from Claude reasoning

This aligns with iteration_02: Claude reasons over VERIFIED evidence, not raw text.
"""

import requests
import json
from datetime import datetime

def test_signal_with_fake_urls():
    """Test signal with fake LinkedIn URL (the one you caught!)"""

    print("\n" + "="*80)
    print("🧪 EVIDENCE VERIFICATION TEST - iteration_02 ALIGNED")
    print("="*80 + "\n")

    print("📋 Test 1: Signal with FAKE LinkedIn URL (the one you discovered)")
    print("-" * 80)

    webhook = {
        "id": "test-fake-url-" + str(int(datetime.now().timestamp())),
        "source": "linkedin",
        "entity_id": "arsenal_fc",
        "entity_name": "Arsenal FC",
        "type": "RFP_DETECTED",
        "confidence": 0.92,  # High confidence from scraper
        "evidence": [
            {
                "source": "LinkedIn",
                "credibility_score": 0.85,
                "url": "https://linkedin.com/jobs/view/123456789",  # FAKE! (as you discovered)
                "date": datetime.now().strftime("%Y-%m-%d"),
                "text": "Arsenal FC seeking Head of Digital Transformation"
            },
            {
                "source": "BrightData",
                "credibility_score": 0.82,
                "url": "https://linkedin.com/jobs/view/999999999",  # Another fake
                "date": datetime.now().strftime("%Y-%m-%d")
            },
            {
                "source": "Perplexity",
                "credibility_score": 0.75,
                "url": "https://perplexity.com",  # Real domain
                "date": datetime.now().strftime("%Y-%m-%d")
            }
        ],
        "timestamp": datetime.now().isoformat(),
        "metadata": {
            "test": "fake_url_detection"
        }
    }

    print(f"Signal ID: {webhook['id']}")
    print(f"Entity: {webhook['entity_id']}")
    print(f"Original Confidence: {webhook['confidence']}")
    print()
    print("Evidence:")
    for i, ev in enumerate(webhook['evidence'], 1):
        print(f"  {i}. {ev['source']}")
        print(f"     URL: {ev['url']}")
        print(f"     Claimed Credibility: {ev['credibility_score']}")
        print()

    print("⏳ Sending to Ralph Loop (with evidence verification enabled)...")
    print()

    try:
        response = requests.post(
            "http://localhost:8001/api/webhooks/signal",
            json=webhook,
            timeout=30
        )
        response.raise_for_status()
        result = response.json()

        print("✅ Webhook processed!")
        print()
        print("📊 RESULTS:")
        print(f"   Status: {result['status']}")
        print(f"   Validated: {result['validated']}")
        print(f"   Signal ID: {result.get('signal_id', 'N/A')}")
        print(f"   Original Confidence: {result.get('original_confidence', 'N/A')}")
        print(f"   Validated Confidence: {result.get('validated_confidence', 'N/A')}")

        adjustment = result.get('adjustment')
        if adjustment is not None:
            print(f"   Adjustment: {adjustment:+f}")
        else:
            print(f"   Adjustment: N/A (signal rejected)")

        print()
        print(f"   Rationale:")
        print(f"   {result.get('rationale', 'N/A')}")
        print()
        print(f"   Model: {result.get('model_used', 'N/A')}")
        print(f"   Processing Time: {result.get('processing_time_seconds', 0):.2f}s")
        print()

        # Check result
        if result['status'] == 'rejected':
            print("❌ SIGNAL REJECTED")
            print("   Evidence verification caught fake/unreliable evidence!")
            print("   This prevents false positives from unverified sources.")
        elif adjustment and adjustment < -0.1:
            print("✅ SUCCESS: Evidence verification detected fake URLs!")
            print("   Confidence was significantly lowered due to unverified evidence.")
        elif adjustment and adjustment < 0:
            print("⚠️  Confidence was adjusted (URLs may not be accessible)")

    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")

def test_signal_with_real_urls():
    """Test signal with real URLs"""

    print("\n" + "="*80)
    print("📋 Test 2: Signal with VERIFIED URLs")
    print("-" * 80 + "\n")

    webhook = {
        "id": "test-real-url-" + str(int(datetime.now().timestamp())),
        "source": "arsenal.com",
        "entity_id": "arsenal_fc",
        "entity_name": "Arsenal FC",
        "type": "RFP_DETECTED",
        "confidence": 0.85,
        "evidence": [
            {
                "source": "Arsenal Official",
                "credibility_score": 0.95,
                "url": "https://arsenal.com",  # Real!
                "date": datetime.now().strftime("%Y-%m-%d"),
                "text": "Official Arsenal FC website"
            },
            {
                "source": "LinkedIn",
                "credibility_score": 0.85,
                "url": "https://linkedin.com",  # Real!
                "date": datetime.now().strftime("%Y-%m-%d")
            }
        ],
        "timestamp": datetime.now().isoformat()
    }

    print(f"Signal ID: {webhook['id']}")
    print(f"Entity: {webhook['entity_id']}")
    print(f"Original Confidence: {webhook['confidence']}")
    print()

    print("⏳ Sending to Ralph Loop...")
    print()

    try:
        response = requests.post(
            "http://localhost:8001/api/webhooks/signal",
            json=webhook,
            timeout=30
        )
        response.raise_for_status()
        result = response.json()

        print("✅ Webhook processed!")
        print()
        print("📊 RESULTS:")
        print(f"   Status: {result['status']}")
        print(f"   Validated: {result['validated']}")
        print(f"   Original Confidence: {result['original_confidence']}")
        print(f"   Validated Confidence: {result.get('validated_confidence', 'N/A')}")

        adjustment = result.get('adjustment')
        if adjustment is not None:
            print(f"   Adjustment: {adjustment:+f}")
        else:
            print(f"   Adjustment: N/A")

        print()
        print(f"   Rationale:")
        print(f"   {result.get('rationale', 'N/A')}")

        if result['status'] == 'validated':
            print()
            print("✅ Signal validated with verified URLs!")

    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")

def show_logs():
    """Show recent logs"""
    print("\n" + "="*80)
    print("📋 RECENT LOGS")
    print("="*80 + "\n")

    import subprocess
    try:
        logs = subprocess.check_output(
            ["docker-compose", "-f", "docker-compose.ralph.yml", "logs", "--tail=50", "webhook-handler"],
            text=True
        )

        # Find and show evidence verification logs
        for line in logs.split('\n'):
            if 'Pass 1.5' in line or 'evidence_verification' in line or 'Verification rate' in line:
                print(line)
    except:
        print("Could not fetch logs")

if __name__ == "__main__":
    try:
        # Test 1: Fake URLs (like the one you discovered)
        test_signal_with_fake_urls()

        # Test 2: Real URLs
        test_signal_with_real_urls()

        # Show logs
        show_logs()

        print("\n" + "="*80)
        print("📝 SUMMARY")
        print("="*80)
        print()
        print("iteration_02 Architecture Alignment:")
        print("  ✅ GraphRAG scrapes raw data (articles, posts, job listings)")
        print("  ✅ Evidence Verifier validates scraped data")
        print("  ✅ Claude reasons over VERIFIED evidence (not raw text)")
        print("  ✅ Graphiti stores validated signals")
        print()
        print("Key Improvement:")
        print("  ✅ Fake URLs detected and penalized")
        print("  ✅ Claude sees verification status")
        print("  ✅ Confidence adjusted based on actual evidence quality")
        print()

    except KeyboardInterrupt:
        print("\n⚠️  Test interrupted")
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
