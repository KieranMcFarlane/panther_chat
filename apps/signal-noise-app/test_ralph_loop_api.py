#!/usr/bin/env python3
"""
Test Ralph Loop API Endpoint

Tests the /api/validate-exploration endpoint with various scenarios:
1. ACCEPT decision (all criteria met)
2. WEAK_ACCEPT decision (partially missing criteria)
3. REJECT decision (duplicate/no new info)
4. Category saturation (3 consecutive REJECTs)
5. Confidence saturation

Usage:
    # Start the server first
    python backend/ralph_loop.py serve

    # In another terminal, run tests
    python test_ralph_loop_api.py
"""

import httpx
import json
import asyncio
from typing import Dict, Any

API_URL = "http://localhost:8002"


def print_response(title: str, response: Dict[str, Any]):
    """Pretty print API response"""
    print(f"\n{'='*80}")
    print(f"TEST: {title}")
    print(f"{'='*80}")
    print(json.dumps(response, indent=2))


async def test_accept_decision():
    """Test ACCEPT decision (all criteria met)"""
    print("\n🧪 Testing ACCEPT decision...")

    payload = {
        "entity_name": "Arsenal FC",
        "category": "Digital Infrastructure & Stack",
        "evidence": "Arsenal FC is seeking a CRM Manager to lead digital transformation and implement new customer data platform",
        "current_confidence": 0.75,
        "source_url": "https://arsenal.com/jobs/crm-manager",
        "iteration_number": 1,
        "accepted_signals_per_category": {"Digital Infrastructure & Stack": 0},
        "consecutive_rejects_per_category": {}
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(f"{API_URL}/api/validate-exploration", json=payload)
        response.raise_for_status()
        result = response.json()

        print_response("ACCEPT Decision", result)

        assert result["decision"] == "ACCEPT", f"Expected ACCEPT, got {result['decision']}"
        assert result["action"] in ["CONTINUE", "LOCK_IN"], f"Expected CONTINUE or LOCK_IN, got {result['action']}"
        assert result["new_confidence"] > 0.75, "Confidence should increase"
        assert result["raw_delta"] == 0.06, "Raw delta should be +0.06 for ACCEPT"

        print("✅ ACCEPT test passed")


async def test_weak_accept_decision():
    """Test WEAK_ACCEPT decision (partially missing criteria)"""
    print("\n🧪 Testing WEAK_ACCEPT decision...")

    payload = {
        "entity_name": "Arsenal FC",
        "category": "Commercial & Revenue Systems",
        "evidence": "New partnership announced for ticketing system improvements",
        "current_confidence": 0.70,
        "source_url": "https://news.sports.com/arsenal-partnership",
        "iteration_number": 1,
        "accepted_signals_per_category": {},
        "consecutive_rejects_per_category": {}
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(f"{API_URL}/api/validate-exploration", json=payload)
        response.raise_for_status()
        result = response.json()

        print_response("WEAK_ACCEPT Decision", result)

        assert result["decision"] == "WEAK_ACCEPT", f"Expected WEAK_ACCEPT, got {result['decision']}"
        assert result["raw_delta"] == 0.02, "Raw delta should be +0.02 for WEAK_ACCEPT"

        print("✅ WEAK_ACCEPT test passed")


async def test_reject_decision():
    """Test REJECT decision (no new info)"""
    print("\n🧪 Testing REJECT decision...")

    payload = {
        "entity_name": "Arsenal FC",
        "category": "Fan Engagement & Experience",
        "evidence": "Team wins match in exciting game",  # This exact text is in previous_evidences
        "current_confidence": 0.50,
        "source_url": "https://generic-sports-news.com/article",
        "previous_evidences": ["Team wins match in exciting game"],  # Exact match → REJECT
        "iteration_number": 2,
        "accepted_signals_per_category": {},
        "consecutive_rejects_per_category": {}
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(f"{API_URL}/api/validate-exploration", json=payload)
        response.raise_for_status()
        result = response.json()

        print_response("REJECT Decision", result)

        assert result["decision"] == "REJECT", f"Expected REJECT, got {result['decision']}"
        assert result["raw_delta"] == 0.0, "Raw delta should be 0.0 for REJECT"

        print("✅ REJECT test passed")


async def test_duplicate_detection():
    """Test duplicate detection"""
    print("\n🧪 Testing duplicate detection...")

    payload = {
        "entity_name": "Arsenal FC",
        "category": "Data, Analytics & AI",
        "evidence": "Arsenal FC is seeking a CRM Manager to lead digital transformation",
        "current_confidence": 0.75,
        "source_url": "https://arsenal.com/jobs/crm-manager",
        "previous_evidences": ["Arsenal FC is seeking a CRM Manager to lead digital transformation"],  # Duplicate
        "iteration_number": 2,
        "accepted_signals_per_category": {},
        "consecutive_rejects_per_category": {}
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(f"{API_URL}/api/validate-exploration", json=payload)
        response.raise_for_status()
        result = response.json()

        print_response("Duplicate Detection", result)

        assert result["decision"] == "REJECT", f"Expected REJECT for duplicate, got {result['decision']}"
        assert "duplicate" in result["justification"].lower(), "Justification should mention duplicate"

        print("✅ Duplicate detection test passed")


async def test_category_saturation():
    """Test category saturation (3 consecutive REJECTs)"""
    print("\n🧪 Testing category saturation...")

    payload = {
        "entity_name": "Arsenal FC",
        "category": "Governance, Compliance & Security",
        "evidence": "Generic compliance news article",  # This exact text will be in previous_evidences
        "current_confidence": 0.40,
        "source_url": "https://generic-news.com",
        "previous_evidences": ["Generic compliance news article"],  # Duplicate → REJECT
        "iteration_number": 4,
        "accepted_signals_per_category": {},
        "consecutive_rejects_per_category": {"Governance, Compliance & Security": 3}  # 3 previous REJECTs + this one = 4
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(f"{API_URL}/api/validate-exploration", json=payload)
        response.raise_for_status()
        result = response.json()

        print_response("Category Saturation", result)

        assert result["category_saturated"] == True, "Category should be saturated"
        assert result["action"] == "STOP", "Action should be STOP when category saturated"

        print("✅ Category saturation test passed")


async def test_confidence_multiplier():
    """Test category multiplier reduces delta as signals increase"""
    print("\n🧪 Testing confidence category multiplier...")

    # First ACCEPT (multiplier = 1.0 / (1 + 0) = 1.0)
    payload1 = {
        "entity_name": "Arsenal FC",
        "category": "Digital Infrastructure & Stack",
        "evidence": "Arsenal FC hiring CRM Manager",
        "current_confidence": 0.50,
        "source_url": "https://arsenal.com/jobs",
        "iteration_number": 1,
        "accepted_signals_per_category": {"Digital Infrastructure & Stack": 0},
        "consecutive_rejects_per_category": {}
    }

    # Second ACCEPT (multiplier = 1.0 / (1 + 1) = 0.5)
    payload2 = {
        "entity_name": "Arsenal FC",
        "category": "Digital Infrastructure & Stack",
        "evidence": "Arsenal FC hiring Data Analyst",
        "current_confidence": 0.56,
        "source_url": "https://arsenal.com/jobs/data",
        "iteration_number": 2,
        "accepted_signals_per_category": {"Digital Infrastructure & Stack": 1},
        "consecutive_rejects_per_category": {}
    }

    async with httpx.AsyncClient() as client:
        # First ACCEPT
        response1 = await client.post(f"{API_URL}/api/validate-exploration", json=payload1)
        response1.raise_for_status()
        result1 = response1.json()

        # Second ACCEPT
        response2 = await client.post(f"{API_URL}/api/validate-exploration", json=payload2)
        response2.raise_for_status()
        result2 = response2.json()

        print_response("Confidence Multiplier - First ACCEPT", result1)
        print_response("Confidence Multiplier - Second ACCEPT", result2)

        assert result1["category_multiplier"] == 1.0, f"First multiplier should be 1.0, got {result1['category_multiplier']}"
        assert result2["category_multiplier"] == 0.5, f"Second multiplier should be 0.5, got {result2['category_multiplier']}"
        assert result1["applied_delta"] == 0.06, f"First applied delta should be 0.06, got {result1['applied_delta']}"
        assert result2["applied_delta"] == 0.03, f"Second applied delta should be 0.03, got {result2['applied_delta']}"

        print("✅ Confidence category multiplier test passed")


async def test_confidence_clamping():
    """Test confidence clamping to [0.05, 0.95]"""
    print("\n🧪 Testing confidence clamping...")

    # Test upper bound
    payload_high = {
        "entity_name": "Arsenal FC",
        "category": "Digital Infrastructure & Stack",
        "evidence": "Arsenal FC hiring CRM Manager",
        "current_confidence": 0.94,  # Near max
        "source_url": "https://arsenal.com/jobs",
        "iteration_number": 1,
        "accepted_signals_per_category": {},
        "consecutive_rejects_per_category": {}
    }

    # Test lower bound
    payload_low = {
        "entity_name": "Arsenal FC",
        "category": "Digital Infrastructure & Stack",
        "evidence": "Generic news",  # Will be REJECTED
        "current_confidence": 0.06,  # Near min
        "source_url": "https://generic.com",
        "iteration_number": 1,
        "accepted_signals_per_category": {},
        "consecutive_rejects_per_category": {}
    }

    async with httpx.AsyncClient() as client:
        # Test upper bound
        response_high = await client.post(f"{API_URL}/api/validate-exploration", json=payload_high)
        response_high.raise_for_status()
        result_high = response_high.json()

        # Test lower bound (will be REJECTED, so delta = 0, confidence stays same)
        response_low = await client.post(f"{API_URL}/api/validate-exploration", json=payload_low)
        response_low.raise_for_status()
        result_low = response_low.json()

        print_response("Confidence Clamping - Upper Bound", result_high)
        print_response("Confidence Clamping - Lower Bound", result_low)

        assert result_high["new_confidence"] <= 0.95, f"Confidence should be clamped to 0.95 max, got {result_high['new_confidence']}"
        assert result_low["new_confidence"] >= 0.05, f"Confidence should be clamped to 0.05 min, got {result_low['new_confidence']}"

        print("✅ Confidence clamping test passed")


async def test_health_check():
    """Test health check endpoint"""
    print("\n🧪 Testing health check...")

    async with httpx.AsyncClient() as client:
        response = await client.get(f"{API_URL}/health")
        response.raise_for_status()
        result = response.json()

        print_response("Health Check", result)

        assert result["status"] == "healthy", "Status should be healthy"
        assert "timestamp" in result, "Should include timestamp"

        print("✅ Health check test passed")


async def run_all_tests():
    """Run all tests"""
    print("\n" + "="*80)
    print("RALPH LOOP API TEST SUITE")
    print("="*80)
    print(f"\nAPI URL: {API_URL}")
    print("\nStarting tests...\n")

    try:
        await test_health_check()
        await test_accept_decision()
        await test_weak_accept_decision()
        await test_reject_decision()
        await test_duplicate_detection()
        await test_category_saturation()
        await test_confidence_multiplier()
        await test_confidence_clamping()

        print("\n" + "="*80)
        print("✅ ALL TESTS PASSED")
        print("="*80 + "\n")

    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        raise
    except Exception as e:
        print(f"\n❌ TEST ERROR: {e}")
        raise


if __name__ == "__main__":
    print("\n🧪 Ralph Loop API Test Suite")
    print("\nMake sure the Ralph Loop API server is running:")
    print("  python backend/ralph_loop.py serve")
    print("\nThen run this script in another terminal.\n")

    asyncio.run(run_all_tests())
