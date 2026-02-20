#!/usr/bin/env python3
"""
Test dossier generation for Fulham FC
"""

import asyncio
import sys
import os
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dossier_generator import EntityDossierGenerator
from claude_client import ClaudeClient


async def test_fulham_dossier():
    """Generate dossier for Fulham FC"""
    print("=" * 60)
    print("GENERATING DOSSIER FOR FULHAM FC")
    print("=" * 60)
    
    try:
        # Initialize
        print("\n[1/3] Initializing ClaudeClient and DossierGenerator...")
        client = ClaudeClient()
        generator = EntityDossierGenerator(client, falkordb_client=None)
        
        # Check API credentials
        if not client.api_key:
            print("\n⚠️  WARNING: ANTHROPIC_API_KEY not set")
            print("   Using mock mode for demonstration...")
            print("\n   To enable real API calls:")
            print("   1. Add ANTHROPIC_API_KEY to backend/.env")
            print("   2. Or add ANTHROPIC_AUTH_TOKEN for Z.AI proxy")
        
        # Generate dossier
        print("\n[2/3] Generating Premium tier dossier for Fulham FC...")
        print("   Entity ID: fulham-fc")
        print("   Entity Name: Fulham FC")
        print("   Entity Type: CLUB")
        print("   Priority Score: 85 (Standard tier)")
        print("   Expected Sections: 7")
        
        start_time = datetime.now()
        
        dossier = await generator.generate_dossier(
            entity_id="fulham-fc",
            entity_name="Fulham FC",
            entity_type="CLUB",
            priority_score=85  # Standard tier (7 sections)
        )
        
        end_time = datetime.now()
        actual_time = (end_time - start_time).total_seconds()
        
        # Display results
        print("\n[3/3] ✅ DOSSIER GENERATED SUCCESSFULLY!")
        print("\n" + "=" * 60)
        print("DOSSIER SUMMARY")
        print("=" * 60)
        
        print(f"\nEntity: {dossier.entity_name}")
        print(f"Entity ID: {dossier.entity_id}")
        print(f"Entity Type: {dossier.entity_type}")
        print(f"Priority Score: {dossier.priority_score}/100")
        print(f"Tier: {dossier.tier}")
        
        print(f"\nSections Generated: {len(dossier.sections)}")
        print(f"Generation Time: {dossier.generation_time_seconds:.2f}s")
        print(f"Actual Time: {actual_time:.2f}s")
        print(f"Total Cost: ${dossier.total_cost_usd:.6f}")
        print(f"Cache Status: {dossier.cache_status}")
        
        print("\n" + "-" * 60)
        print("SECTIONS")
        print("-" * 60)
        
        for i, section in enumerate(dossier.sections, 1):
            print(f"\n{i}. {section.title}")
            print(f"   Model: {section.generated_by.upper()}")
            print(f"   Confidence: {section.confidence:.2f}")
            print(f"   Content Items: {len(section.content)}")
            
            if section.metrics:
                print(f"   Metrics: {len(section.metrics)} data points")
            
            if section.insights:
                print(f"   Insights: {len(section.insights)} key insights")
            
            if section.recommendations:
                print(f"   Recommendations: {len(section.recommendations)} actions")
            
            # Show preview of content
            if section.content:
                preview = section.content[0][:100] + "..." if len(section.content[0]) > 100 else section.content[0]
                print(f"   Preview: {preview}")
        
        print("\n" + "-" * 60)
        print("MODEL DISTRIBUTION")
        print("-" * 60)
        
        model_counts = {}
        for section in dossier.sections:
            model_counts[section.generated_by] = model_counts.get(section.generated_by, 0) + 1
        
        for model, count in model_counts.items():
            percentage = (count / len(dossier.sections)) * 100
            print(f"{model.upper()}: {count}/{len(dossier.sections)} ({percentage:.0f}%)")
        
        print("\n" + "=" * 60)
        print("✅ FULHAM FC DOSSIER COMPLETE")
        print("=" * 60)
        
        return dossier
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == "__main__":
    dossier = asyncio.run(test_fulham_dossier())
    
    if dossier:
        print("\n🎉 Success! The dossier system is working.")
        print("\nNext steps:")
        print("1. Review the generated sections above")
        print("2. Test with other entities (Arsenal, Aston Villa, etc.)")
        print("3. Verify cost estimates match actual API usage")
        print("4. Deploy to production when ready")
    else:
        print("\n⚠️  Generation failed. Please check:")
        print("1. API credentials configured in .env")
        print("2. Network connectivity")
        print("3. Error messages above for details")
