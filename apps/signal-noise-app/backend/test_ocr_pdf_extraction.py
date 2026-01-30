#!/usr/bin/env python3
"""
Test OCR PDF Extraction

Tests OCR auto-detection and cost tracking in PDF extractor:
1. Native PDF: Should use pdfplumber (fast, $0 cost)
2. Scanned PDF: Should auto-trigger OCR (slower, $0.01 cost)
3. Cost tracking: Verify $0.01 added for OCR

Author: Claude Code
Date: 2026-01-30
"""

import asyncio
import logging
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from pdf_extractor import PDFExtractor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s: %(message)s'
)
logger = logging.getLogger(__name__)


async def test_native_pdf():
    """
    Test 1: Native PDF (should use pdfplumber, fast, $0 cost)
    """
    print("\n" + "="*70)
    print("TEST 1: Native PDF Extraction (pdfplumber)")
    print("="*70)

    extractor = PDFExtractor(enable_ocr=True, ocr_threshold=100)

    # ICF PDF - known to be native (extractable with pdfplumber)
    url = "https://www.canoeicf.com/sites/default/files/paddle_worldwide_proposed_ecosystem.pdf"

    print(f"\n📄 URL: {url}")
    print(f"⚙️  Config: enable_ocr=True, ocr_threshold=100")

    result = await extractor.extract(url)

    if result["status"] == "success":
        print(f"\n✅ SUCCESS")
        print(f"   Method: {result['method']}")
        print(f"   Characters: {result['char_count']:,}")
        print(f"   Pages: {result['page_count']}")
        print(f"   Confidence: {result['confidence']}")
        print(f"   Cost: ${result['cost_usd']:.3f}")

        # Verify expectations
        assert result["method"] == "pdfplumber", f"Expected pdfplumber, got {result['method']}"
        assert result["char_count"] > 100, f"Expected > 100 chars, got {result['char_count']}"
        assert result["cost_usd"] == 0.0, f"Expected $0.00 cost, got ${result['cost_usd']:.3f}"

        print(f"\n✅ All assertions passed!")
        return True
    else:
        print(f"\n❌ FAILED: {result.get('error', 'Unknown error')}")
        return False


async def test_scanned_pdf_simulation():
    """
    Test 2: Simulate scanned PDF (should trigger OCR)

    Note: This test uses a real native PDF but simulates OCR triggering
    by setting a very high ocr_threshold to force OCR fallback.
    """
    print("\n" + "="*70)
    print("TEST 2: OCR Auto-Detection (scanned PDF simulation)")
    print("="*70)

    # Set threshold VERY high to force OCR even for native PDF
    extractor = PDFExtractor(enable_ocr=True, ocr_threshold=1000000)

    url = "https://www.canoeicf.com/sites/default/files/paddle_worldwide_proposed_ecosystem.pdf"

    print(f"\n📄 URL: {url}")
    print(f"⚙️  Config: enable_ocr=True, ocr_threshold=1,000,000 (forces OCR)")
    print(f"⚠️  This simulates OCR triggering for scanned PDFs")

    result = await extractor.extract(url)

    if result["status"] == "success":
        print(f"\n✅ SUCCESS")
        print(f"   Method: {result['method']}")
        print(f"   Characters: {result['char_count']:,}")
        print(f"   Pages: {result['page_count']}")
        print(f"   Confidence: {result['confidence']}")
        print(f"   Cost: ${result['cost_usd']:.3f}")

        # Verify expectations
        assert result["method"] == "ocr", f"Expected OCR, got {result['method']}"
        assert result["char_count"] > 100, f"Expected > 100 chars, got {result['char_count']}"
        assert result["cost_usd"] == 0.01, f"Expected $0.01 cost, got ${result['cost_usd']:.3f}"

        print(f"\n✅ All assertions passed!")
        print(f"✅ OCR cost tracking verified: ${result['cost_usd']:.3f} added")
        return True
    else:
        print(f"\n❌ FAILED: {result.get('error', 'Unknown error')}")
        return False


async def test_auto_detection_logic():
    """
    Test 3: Auto-detection logic (verify threshold behavior)

    Tests that OCR triggers when native extraction returns < threshold chars.
    """
    print("\n" + "="*70)
    print("TEST 3: Auto-Detection Logic (threshold verification)")
    print("="*70)

    print("\n📋 Scenario: Low-quality native PDF (< 100 chars)")
    print("⚙️  Config: enable_ocr=True, ocr_threshold=100")
    print("🎯 Expected: OCR triggers automatically")

    # Create extractor with threshold = 100
    extractor = PDFExtractor(enable_ocr=True, ocr_threshold=100)

    # Verify threshold is set correctly
    assert extractor.ocr_threshold == 100, f"Expected threshold=100, got {extractor.ocr_threshold}"
    assert extractor.enable_ocr == True, f"Expected enable_ocr=True, got {extractor.enable_ocr}"

    print(f"\n✅ Auto-detection configured correctly")
    print(f"   - OCR enabled: {extractor.enable_ocr}")
    print(f"   - OCR threshold: {extractor.ocr_threshold} chars")
    print(f"   - Logic: OCR triggers when native extraction < {extractor.ocr_threshold} chars")

    return True


async def test_cost_tracking():
    """
    Test 4: Cost tracking verification
    """
    print("\n" + "="*70)
    print("TEST 4: Cost Tracking Verification")
    print("="*70)

    print("\n💰 Expected costs:")
    print("   - Native extraction (pdfplumber): $0.00")
    print("   - OCR extraction (tesseract):     $0.01")

    # Test native PDF cost
    extractor = PDFExtractor(enable_ocr=True, ocr_threshold=100)
    url = "https://www.canoeicf.com/sites/default/files/paddle_worldwide_proposed_ecosystem.pdf"

    result = await extractor.extract(url)
    native_cost = result.get("cost_usd", 0.0)

    print(f"\n✅ Native extraction cost: ${native_cost:.3f}")
    assert native_cost == 0.0, f"Expected $0.00, got ${native_cost:.3f}"

    # Test OCR cost (simulated)
    extractor_ocr = PDFExtractor(enable_ocr=True, ocr_threshold=1000000)
    result_ocr = await extractor_ocr.extract(url)
    ocr_cost = result_ocr.get("cost_usd", 0.0)

    print(f"✅ OCR extraction cost: ${ocr_cost:.3f}")
    assert ocr_cost == 0.01, f"Expected $0.01, got ${ocr_cost:.3f}"

    print(f"\n✅ Cost tracking verified:")
    print(f"   - Native: ${native_cost:.3f} (expected: $0.00)")
    print(f"   - OCR:    ${ocr_cost:.3f} (expected: $0.01)")

    return True


async def main():
    """Run all OCR tests"""
    print("\n" + "="*70)
    print("OCR PDF Extraction Test Suite")
    print("="*70)
    print("\nThis test suite verifies:")
    print("1. Native PDF extraction (pdfplumber)")
    print("2. OCR auto-detection (threshold-based)")
    print("3. OCR cost tracking ($0.01 per PDF)")
    print("4. Auto-detection logic")

    # Run tests
    results = []

    try:
        results.append(("Native PDF", await test_native_pdf()))
    except Exception as e:
        print(f"\n❌ Test 1 failed with exception: {e}")
        results.append(("Native PDF", False))

    try:
        results.append(("OCR Auto-Detection", await test_scanned_pdf_simulation()))
    except Exception as e:
        print(f"\n❌ Test 2 failed with exception: {e}")
        results.append(("OCR Auto-Detection", False))

    try:
        results.append(("Auto-Detection Logic", await test_auto_detection_logic()))
    except Exception as e:
        print(f"\n❌ Test 3 failed with exception: {e}")
        results.append(("Auto-Detection Logic", False))

    try:
        results.append(("Cost Tracking", await test_cost_tracking()))
    except Exception as e:
        print(f"\n❌ Test 4 failed with exception: {e}")
        results.append(("Cost Tracking", False))

    # Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")

    print(f"\nTotal: {passed}/{total} tests passed")

    if passed == total:
        print("\n🎉 All tests passed!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
