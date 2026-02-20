#!/usr/bin/env python3
"""
Test script for Perplexity-first hybrid RFP detection system
Validates the system with a small sample of entities
"""

import asyncio
import json
import sys
import os
from datetime import datetime

# Add backend directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from perplexity_first_rfp_system import PerplexityFirstRFPDetector


async def test_system():
    """Test the system with a small sample"""
    print("🧪 TESTING PERPLEXITY-FIRST HYBRID RFP DETECTION SYSTEM")
    print("=" * 60)
    print()
    
    # Create detector instance
    detector = PerplexityFirstRFPDetector()
    
    # Test with small sample
    print("🔬 Running test with 5 entities...")
    print()
    
    try:
        results = await detector.run_detection(limit=5)
        
        print()
        print("✅ TEST COMPLETED")
        print("=" * 60)
        print()
        
        # Display results
        print("📊 Test Results:")
        print(f"   Entities checked: {results['entities_checked']}")
        print(f"   RFPs detected: {results['total_rfps_detected']}")
        print(f"   Verified RFPs: {results['verified_rfps']}")
        print(f"   Rejected RFPs: {results['rejected_rfps']}")
        print()
        
        # Display cost analysis
        print("💰 Cost Analysis:")
        print(f"   Total cost: ${results['cost_comparison']['total_cost']:.2f}")
        print(f"   Perplexity queries: {results['perplexity_usage']['total_queries']}")
        print(f"   BrightData queries: {results['brightdata_usage']['total_queries']}")
        print()
        
        # Display highlights if any
        if results.get('highlights'):
            print("🎯 Detected Opportunities:")
            for highlight in results['highlights'][:3]:
                print(f"   • {highlight['organization']} - {highlight['summary_json']['title']}")
                print(f"     Fit Score: {highlight['summary_json']['fit_score']}/100")
                print(f"     Confidence: {highlight['summary_json']['confidence']}")
                print()
        else:
            print("ℹ️  No RFPs detected in test sample")
            print()
        
        # Save test results
        test_file = f"test_results_perplexity_first_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(test_file, 'w') as f:
            json.dump(results, f, indent=2)
        
        print(f"📁 Test results saved to: {test_file}")
        print()
        
        # Validation checks
        print("🔍 System Validation:")
        
        # Check 1: System ran without errors
        if 'error' not in results:
            print("   ✅ No system errors")
        else:
            print(f"   ❌ System error: {results['error']}")
        
        # Check 2: Checked expected number of entities
        if results['entities_checked'] == 5:
            print("   ✅ Checked correct number of entities")
        else:
            print(f"   ⚠️  Checked {results['entities_checked']} entities (expected 5)")
        
        # Check 3: Output structure is valid
        required_keys = [
            'total_rfps_detected', 'verified_rfps', 'rejected_rfps',
            'entities_checked', 'highlights', 'scoring_summary',
            'quality_metrics', 'discovery_breakdown',
            'perplexity_usage', 'brightdata_usage', 'cost_comparison'
        ]
        
        missing_keys = [key for key in required_keys if key not in results]
        if not missing_keys:
            print("   ✅ Output structure is complete")
        else:
            print(f"   ❌ Missing output keys: {missing_keys}")
        
        # Check 4: JSON is valid
        try:
            json.dumps(results)
            print("   ✅ Output JSON is valid")
        except Exception as e:
            print(f"   ❌ Invalid JSON: {e}")
        
        print()
        print("🎉 Test completed successfully!")
        print()
        print("💡 To run the full system:")
        print("   ./run-perplexity-hybrid-system.sh --limit 300")
        
        return results
        
    except Exception as e:
        print(f"❌ Test failed with error: {str(e)}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == "__main__":
    results = asyncio.run(test_system())
    
    # Exit with appropriate code
    if results and 'error' not in results:
        sys.exit(0)
    else:
        sys.exit(1)