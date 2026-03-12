#!/usr/bin/env python3
"""
🎯 PERPLEXITY-FIRST HYBRID RFP DETECTION SYSTEM - Production Runner

Production script for intelligent RFP discovery with cost optimization.

This script implements a 5-phase approach:
1. Perplexity intelligent discovery (LinkedIn-first)
2. BrightData targeted fallback (for Perplexity NONE results only) 
3. Perplexity validation (for BrightData detections)
4. Competitive intelligence (high-value opportunities only)
5. Enhanced fit scoring and structured output

Usage:
    python run_perplexity_hybrid_detector.py [--entities 300] [--test]

Author: RFP Detection System
Version: 1.0
"""

import asyncio
import argparse
import sys
import os
from datetime import datetime

# Add parent directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from backend.perplexity_hybrid_rfp_detector import PerplexityHybridRFPDetector


async def main():
    """Main execution function"""
    
    # Parse arguments
    parser = argparse.ArgumentParser(description='Run Perplexity-First Hybrid RFP Detection System')
    parser.add_argument('--entities', type=int, default=300, 
                       help='Number of entities to process (default: 300)')
    parser.add_argument('--test', action='store_true',
                       help='Run in test mode with sample entities')
    parser.add_argument('--verbose', action='store_true',
                       help='Enable verbose logging')
    
    args = parser.parse_args()
    
    print("=" * 80)
    print("🎯 PERPLEXITY-FIRST HYBRID RFP DETECTION SYSTEM")
    print("=" * 80)
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Entities to process: {args.entities}")
    print(f"Test mode: {args.test}")
    print(f"Verbose logging: {args.verbose}")
    print("=" * 80)
    print()
    
    try:
        # Create detector
        detector = PerplexityHybridRFPDetector()
        
        # Run detection
        if args.test:
            print("⚠️ Running in TEST mode - using sample entities")
            from backend.test_perplexity_hybrid_system import test_with_sample_entities
            result = await test_with_sample_entities()
        else:
            print("🚀 Running in PRODUCTION mode - querying Supabase entities")
            result = await detector.run_detection(entity_limit=args.entities)
        
        # Print summary
        print()
        print("=" * 80)
        print("📊 EXECUTION SUMMARY")
        print("=" * 80)
        print(f"Entities checked: {result['entities_checked']}")
        print(f"Total RFPs detected: {result['total_rfps_detected']}")
        print(f"Verified RFPs: {result['verified_rfps']}")
        print(f"Rejected RFPs: {result['rejected_rfps']}")
        print(f"Verified rate: {result['quality_metrics']['verified_rate']:.1%}")
        
        print(f"\n💰 COST ANALYSIS:")
        print(f"Total cost: ${result['cost_comparison']['total_cost']:.2f}")
        print(f"Cost per verified RFP: ${result['cost_comparison']['cost_per_verified_rfp']:.2f}")
        print(f"Savings vs old system: ${result['cost_comparison']['savings_vs_old_system']:.2f}")
        
        print(f"\n🎯 TOP OPPORTUNITY: {result['scoring_summary']['top_opportunity']}")
        print(f"Avg confidence: {result['scoring_summary']['avg_confidence']:.2f}")
        print(f"Avg fit score: {result['scoring_summary']['avg_fit_score']:.1f}")
        
        print(f"\n📈 DISCOVERY BREAKDOWN:")
        print(f"LinkedIn posts: {result['discovery_breakdown']['linkedin_posts']}")
        print(f"LinkedIn jobs: {result['discovery_breakdown']['linkedin_jobs']}")
        print(f"Tender platforms: {result['discovery_breakdown']['tender_platforms']}")
        print(f"Sports news sites: {result['discovery_breakdown']['sports_news_sites']}")
        print(f"Official websites: {result['discovery_breakdown']['official_websites']}")
        
        print("\n" + "=" * 80)
        print("✅ EXECUTION COMPLETED SUCCESSFULLY")
        print("=" * 80)
        print(f"Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
    except Exception as e:
        print()
        print("=" * 80)
        print("❌ EXECUTION FAILED")
        print("=" * 80)
        print(f"Error: {e}")
        
        import traceback
        traceback.print_exc()
        
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())