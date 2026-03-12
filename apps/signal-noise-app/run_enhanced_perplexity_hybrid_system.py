#!/usr/bin/env python3
"""
🎯 ENHANCED PERPLEXITY-FIRST HYBRID RFP DETECTION SYSTEM - RUNNER

Quick start script for running the enhanced RFP detection system.

Usage:
    # Run with default settings (300 entities)
    python run_enhanced_perplexity_hybrid_system.py
    
    # Run in sample mode (10 entities for testing)
    python run_enhanced_perplexity_hybrid_system.py --sample
    
    # Run with custom entity limit
    python run_enhanced_perplexity_hybrid_system.py --limit 100
    
    # Run in sample mode with custom size
    python run_enhanced_perplexity_hybrid_system.py --sample --size 20

Author: RFP Detection System
Version: 1.0
"""

import asyncio
import sys
import os
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent / 'backend'))

def main():
    """Main entry point"""
    print("\n🎯 ENHANCED PERPLEXITY-FIRST HYBRID RFP DETECTION SYSTEM")
    print("=" * 80)
    print("Intelligent discovery with BrightData fallback")
    print("=" * 80 + "\n")
    
    # Parse command line arguments
    sample_mode = '--sample' in sys.argv
    sample_size = 10
    entity_limit = 300
    
    if '--size' in sys.argv:
        size_idx = sys.argv.index('--size')
        if size_idx + 1 < len(sys.argv):
            try:
                sample_size = int(sys.argv[size_idx + 1])
            except ValueError:
                print("⚠️ Invalid sample size, using default: 10")
    
    if '--limit' in sys.argv:
        limit_idx = sys.argv.index('--limit')
        if limit_idx + 1 < len(sys.argv):
            try:
                entity_limit = int(sys.argv[limit_idx + 1])
            except ValueError:
                print("⚠️ Invalid entity limit, using default: 300")
    
    print(f"Configuration:")
    print(f"  Entity Limit: {entity_limit}")
    print(f"  Sample Mode: {sample_mode}")
    print(f"  Sample Size: {sample_size if sample_mode else 'All'}")
    print("")
    
    try:
        # Import the enhanced system
        from backend.enhanced_perplexity_hybrid_rfp_system import EnhancedPerplexityHybridRFPSystem
        
        # Initialize system
        print("Initializing enhanced system...")
        system = EnhancedPerplexityHybridRFPSystem()
        
        # Run enhanced discovery
        print("Starting enhanced discovery...")
        result = asyncio.run(system.run_enhanced_discovery(
            entity_limit=entity_limit,
            sample_mode=sample_mode,
            sample_size=sample_size
        ))
        
        # Output summary
        print("\n📊 EXECUTION SUMMARY:")
        print(f"  Entities Checked: {result.entities_checked}")
        print(f"  Total RFPs Detected: {result.total_rfps_detected}")
        print(f"  Verified RFPs: {result.verified_rfps}")
        print(f"  Rejected RFPs: {result.rejected_rfps}")
        print(f"  Verification Rate: {result.quality_metrics['verified_rate']:.1%}")
        print(f"  Total Cost: ${result.cost_comparison['total_cost']:.2f}")
        print(f"  Cost Per Verified RFP: ${result.cost_comparison['cost_per_verified_rfp']:.2f}")
        
        if result.total_rfps_detected > 0:
            print(f"\n🎯 TOP OPPORTUNITIES:")
            for i, highlight in enumerate(result.highlights[:5], 1):
                print(f"  {i}. {highlight['organization']}")
                print(f"     Status: {highlight['validation_status']}")
                print(f"     Title: {highlight['summary_json']['title']}")
                print(f"     Confidence: {highlight['summary_json']['confidence']:.2f}")
                print(f"     Fit Score: {highlight['summary_json']['fit_score']}")
                print(f"     URL: {highlight['src_link']}")
                print()
        
        print("✅ Enhanced system execution complete!")
        return 0
        
    except KeyboardInterrupt:
        print("\n⚠️ Execution interrupted by user")
        return 1
    except Exception as e:
        print(f"\n❌ Error during execution: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())