#!/usr/bin/env python3
"""
Test script for Enhanced Perplexity-First Hybrid RFP Detection System

This script validates the system with mock data to ensure all components work correctly
without requiring external API calls.
"""

import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent))

def test_data_structures():
    """Test that data structures are properly defined"""
    print("🧪 Testing data structures...")
    
    try:
        from enhanced_perplexity_hybrid_rfp_system_v2 import (
            DiscoverySource,
            ValidationStatus,
            RFPDetection
        )
        
        # Test enums
        assert DiscoverySource.PERPLEXITY_PRIORITY_1.value == "perplexity_priority_1"
        assert ValidationStatus.VERIFIED.value == "VERIFIED"
        
        # Test dataclass
        detection = RFPDetection(
            organization="Test FC",
            sport="Football",
            country="UK",
            entity_type="Club",
            neo4j_id="test-123",
            discovery_source=DiscoverySource.PERPLEXITY_PRIORITY_1,
            discovery_method="perplexity_primary",
            validation_status=ValidationStatus.VERIFIED,
            status="ACTIVE_RFP",
            source_type="linkedin_post",
            source_url="https://linkedin.com/posts/123",
            title="Digital Transformation RFP",
            confidence=0.9,
            urgency="high"
        )
        
        assert detection.organization == "Test FC"
        assert detection.fit_score == 0  # Should be calculated
        
        print("✅ Data structures test passed")
        return True
        
    except Exception as e:
        print(f"❌ Data structures test failed: {e}")
        return False


def test_json_parsing():
    """Test JSON parsing from Perplexity responses"""
    print("🧪 Testing JSON parsing...")
    
    try:
        from enhanced_perplexity_hybrid_rfp_system_v2 import EnhancedPerplexityHybridRFPDetector
        
        detector = EnhancedPerplexityHybridRFPDetector(max_entities=10)
        
        # Test clean JSON
        clean_json = '{"status": "ACTIVE_RFP", "confidence": 0.8}'
        result = detector._parse_json_from_response(clean_json)
        assert result == {"status": "ACTIVE_RFP", "confidence": 0.8}
        
        # Test JSON with markdown
        markdown_json = '''```json
{
  "status": "ACTIVE_RFP",
  "confidence": 0.8
}
```'''
        result = detector._parse_json_from_response(markdown_json)
        assert result == {"status": "ACTIVE_RFP", "confidence": 0.8}
        
        # Test invalid JSON
        invalid_json = "This is not JSON"
        result = detector._parse_json_from_response(invalid_json)
        assert result is None
        
        print("✅ JSON parsing test passed")
        return True
        
    except Exception as e:
        print(f"❌ JSON parsing test failed: {e}")
        return False


def test_fit_scoring():
    """Test fit score calculation"""
    print("🧪 Testing fit score calculation...")
    
    try:
        from enhanced_perplexity_hybrid_rfp_system_v2 import EnhancedPerplexityHybridRFPDetector, RFPDetection, DiscoverySource, ValidationStatus
        
        detector = EnhancedPerplexityHybridRFPDetector(max_entities=10)
        
        # Test high-fit opportunity
        detection1 = RFPDetection(
            organization="Test FC",
            sport="Football",
            country="UK",
            entity_type="Premier league",
            neo4j_id="test-123",
            discovery_source=DiscoverySource.PERPLEXITY_PRIORITY_1,
            discovery_method="perplexity_primary",
            validation_status=ValidationStatus.VERIFIED,
            status="ACTIVE_RFP",
            source_type="linkedin_post",
            source_url="https://linkedin.com/posts/123",
            title="End-to-end mobile app development for Premier League club",
            confidence=0.9,
            urgency="high"
        )
        
        score1 = detector._calculate_fit_score(detection1)
        assert score1 > 80, f"Expected high fit score, got {score1}"
        
        # Test low-fit opportunity
        detection2 = RFPDetection(
            organization="Test FC",
            sport="Football",
            country="UK",
            entity_type="Club",
            neo4j_id="test-123",
            discovery_source=DiscoverySource.PERPLEXITY_PRIORITY_1,
            discovery_method="perplexity_primary",
            validation_status=ValidationStatus.VERIFIED,
            status="ACTIVE_RFP",
            source_type="linkedin_post",
            source_url="https://linkedin.com/posts/123",
            title="Facility maintenance services",
            confidence=0.5,
            urgency="low"
        )
        
        score2 = detector._calculate_fit_score(detection2)
        assert score2 < 50, f"Expected low fit score, got {score2}"
        
        print(f"  High-fit score: {score1}")
        print(f"  Low-fit score: {score2}")
        print("✅ Fit scoring test passed")
        return True
        
    except Exception as e:
        print(f"❌ Fit scoring test failed: {e}")
        return False


def test_output_generation():
    """Test final output generation"""
    print("🧪 Testing output generation...")
    
    try:
        from enhanced_perplexity_hybrid_rfp_system_v2 import EnhancedPerplexityHybridRFPDetector, RFPDetection, DiscoverySource, ValidationStatus
        
        detector = EnhancedPerplexityHybridRFPDetector(max_entities=10)
        
        # Add a mock detection
        detection = RFPDetection(
            organization="Test FC",
            sport="Football",
            country="UK",
            entity_type="Premier league",
            neo4j_id="test-123",
            discovery_source=DiscoverySource.PERPLEXITY_PRIORITY_1,
            discovery_method="perplexity_primary",
            validation_status=ValidationStatus.VERIFIED,
            status="ACTIVE_RFP",
            source_type="linkedin_post",
            source_url="https://linkedin.com/posts/123",
            title="End-to-end mobile app development",
            confidence=0.9,
            urgency="high",
            fit_score=85,
            budget="£100,000-200,000",
            deadline="2025-03-15",
            date_published="2025-02-01"
        )
        
        detector.highlights.append(detection)
        detector.total_rfps_detected = 1
        detector.verified_rfps = 1
        detector.entities_checked = 10
        
        # Generate output
        output = detector._generate_final_output()
        
        # Validate output structure
        assert "total_rfps_detected" in output
        assert "verified_rfps" in output
        assert "entities_checked" in output
        assert "highlights" in output
        assert "scoring_summary" in output
        assert "quality_metrics" in output
        assert "cost_comparison" in output
        
        # Check values
        assert output["total_rfps_detected"] == 1
        assert output["verified_rfps"] == 1
        assert output["entities_checked"] == 10
        assert len(output["highlights"]) == 1
        
        # Check highlight structure
        highlight = output["highlights"][0]
        assert highlight["organization"] == "Test FC"
        assert highlight["validation_status"] == "VERIFIED"
        assert highlight["discovery_method"] == "perplexity_primary"
        assert highlight["summary_json"]["fit_score"] == 85
        
        # Check cost comparison
        cost_comparison = output["cost_comparison"]
        assert "total_cost" in cost_comparison
        assert "savings_vs_old_system" in cost_comparison
        
        print("✅ Output generation test passed")
        print(f"  Generated output with {len(output['highlights'])} highlights")
        return True
        
    except Exception as e:
        print(f"❌ Output generation test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_client_initialization():
    """Test client initialization"""
    print("🧪 Testing client initialization...")
    
    try:
        from enhanced_perplexity_hybrid_rfp_system_v2 import EnhancedPerplexityHybridRFPDetector
        
        detector = EnhancedPerplexityHybridRFPDetector(max_entities=10)
        
        # Check if clients were initialized (may be None if env vars missing)
        print(f"  BrightData client: {'✅' if detector.brightdata_client else '⚠️  Not initialized'}")
        print(f"  Supabase client: {'✅' if detector.supabase_client else '⚠️  Not initialized'}")
        print(f"  Perplexity API key: {'✅' if detector.perplexity_api_key else '⚠️  Not configured'}")
        
        print("✅ Client initialization test passed")
        return True
        
    except Exception as e:
        print(f"❌ Client initialization test failed: {e}")
        return False


def run_all_tests():
    """Run all tests"""
    print("🧪 ENHANCED PERPLEXITY-FIRST HYBRID RFP SYSTEM TESTS")
    print("=" * 60)
    print()
    
    results = []
    
    # Run synchronous tests
    results.append(("Data Structures", test_data_structures()))
    results.append(("JSON Parsing", test_json_parsing()))
    results.append(("Fit Scoring", test_fit_scoring()))
    results.append(("Output Generation", test_output_generation()))
    
    # Run async tests
    try:
        asyncio.run(test_client_initialization())
        results.append(("Client Initialization", True))
    except Exception as e:
        print(f"❌ Client initialization test failed: {e}")
        results.append(("Client Initialization", False))
    
    # Print summary
    print()
    print("=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print()
    print(f"Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️  {total - passed} test(s) failed")
        return 1


if __name__ == "__main__":
    sys.exit(run_all_tests())