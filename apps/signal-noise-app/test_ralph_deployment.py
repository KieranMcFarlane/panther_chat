#!/usr/bin/env python3
"""
Test script for Ralph Loop deployment

Tests the webhook endpoint once Docker is running.
"""
import os
import sys
import json
import time
from datetime import datetime
import requests

def test_webhook_endpoint():
    """Test the webhook endpoint"""

    print("\n" + "="*80)
    print("🧪 RALPH LOOP WEBHOOK TEST")
    print("="*80 + "\n")

    # Check if services are ready
    print("🔍 Checking services...")

    try:
        # Check health endpoint
        response = requests.get("http://localhost:8001/health", timeout=5)
        response.raise_for_status()
        health = response.json()
        print("✅ Webhook handler is ready")
        print(f"   Status: {health['status']}")
        print(f"   Mode: {health['mode']}")
        print()

    except requests.exceptions.RequestException as e:
        print(f"❌ Webhook handler not ready: {e}")
        print("\nPlease start Docker Desktop and run:")
        print("  docker-compose -f docker-compose.ralph.yml up -d --build")
        return 1

    # Test webhook with Arsenal FC
    print("📤 Sending test webhook for Arsenal FC...")

    webhook_payload = {
        "id": f"arsenal-test-{int(time.time())}",
        "source": "linkedin",
        "entity_id": "arsenal_fc",
        "entity_name": "Arsenal FC",
        "type": "RFP_DETECTED",
        "confidence": 0.92,
        "evidence": [
            {
                "source": "LinkedIn",
                "credibility_score": 0.85,
                "url": "https://linkedin.com/jobs/view/123456789",
                "date": datetime.now().strftime("%Y-%m-%d"),
                "text": "Arsenal FC seeking Head of Digital Transformation - £120k-150k"
            },
            {
                "source": "Graphiti corroboration",
                "credibility_score": 0.75,
                "related_signal_id": "arsenal-rfp-20260115",
                "date": "2026-01-15"
            },
            {
                "source": "Perplexity",
                "credibility_score": 0.70,
                "date": datetime.now().strftime("%Y-%m-%d"),
                "text": "Arsenal FC actively pursuing digital transformation"
            }
        ],
        "timestamp": datetime.now().isoformat(),
        "metadata": {
            "job_title": "Head of Digital Transformation",
            "indicative_budget": "£1.5M",
            "department": "Technology"
        }
    }

    print(f"   Signal ID: {webhook_payload['id']}")
    print(f"   Type: {webhook_payload['type']}")
    print(f"   Original Confidence: {webhook_payload['confidence']}")
    print()

    try:
        # Send webhook
        start_time = time.time()
        response = requests.post(
            "http://localhost:8001/api/webhooks/signal",
            json=webhook_payload,
            timeout=30
        )
        end_time = time.time()

        response.raise_for_status()
        result = response.json()

        processing_time = end_time - start_time

        print("✅ Webhook processed successfully!")
        print()
        print("📊 Results:")
        print(f"   Status: {result['status']}")
        print(f"   Validated: {result['validated']}")
        print(f"   Signal ID: {result['signal_id']}")
        print(f"   Original Confidence: {result.get('original_confidence', 'N/A')}")
        print(f"   Validated Confidence: {result.get('validated_confidence', 'N/A')}")
        print(f"   Adjustment: {result.get('adjustment', 'N/A'):+f}")
        print(f"   Rationale: {result.get('rationale', 'N/A')[:80]}...")
        print()
        print(f"   Model: {result.get('model_used', 'N/A')}")
        print(f"   Cost: ${result.get('cost_usd', 0.0):.4f}")
        print(f"   Processing Time: {result.get('processing_time_seconds', 0.0):.2f}s")
        print()

        # Show cost savings
        if result.get('cost_usd'):
            sonnet_cost = result.get('cost_usd', 0.0) * 12  # Haiku is ~12x cheaper
            print("💰 Cost Savings:")
            print(f"   Haiku (actual): ${result.get('cost_usd', 0.0):.4f}")
            print(f"   Sonnet (baseline): ${sonnet_cost:.4f}")
            print(f"   Savings: ${sonnet_cost - result.get('cost_usd', 0.0):.4f} (92% savings)")

        print()
        print("="*80)
        print("✅ TEST SUCCESSFUL")
        print("="*80)
        print()
        print("📖 View live dashboard:")
        print("   Grafana: http://localhost:3000 (admin/admin)")
        print("   Prometheus: http://localhost:9090/metrics")
        print()

        return 0

    except requests.exceptions.RequestException as e:
        print(f"❌ Webhook request failed: {e}")
        print()
        print("Service status:")
        try:
            status = requests.get("http://localhost:8001/health", timeout=5)
            print(f"   Health check: {status.status_code}")
        except:
            print("   Health check: Failed")

        print()
        print("View logs:")
        print("   docker-compose -f docker-compose.ralph.yml logs webhook-handler")
        return 1


if __name__ == "__main__":
    try:
        sys.exit(test_webhook_endpoint())
    except KeyboardInterrupt:
        print("\n\n⚠️ Test interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
