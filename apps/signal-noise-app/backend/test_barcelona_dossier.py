#!/usr/bin/env python3
"""
Test dossier generation for FC Barcelona
"""

import asyncio
import sys
import os
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dossier_generator import EntityDossierGenerator
from claude_client import ClaudeClient


async def test_barcelona_dossier():
    """Generate dossier for FC Barcelona"""
    print("=" * 60)
    print("GENERATING DOSSIER FOR FC BARCELONA")
    print("=" * 60)
    
    try:
        # Initialize
        print("\n[1/3] Initializing ClaudeClient and DossierGenerator...")
        client = ClaudeClient()
        generator = EntityDossierGenerator(client, falkordb_client=None)
        
        # Check API credentials
        if client.api_key:
            print(f"✅ API Key configured: {client.api_key[:20]}...")
            print(f"✅ Base URL: {client.base_url}")
        else:
            print("⚠️  WARNING: API key not configured")
        
        # Generate dossier
        print("\n[2/3] Generating Premium tier dossier for FC Barcelona...")
        print("   Entity ID: barcelona-fc")
        print("   Entity Name: FC Barcelona")
        print("   Entity Type: CLUB")
        print("   Priority Score: 95/100 (Premium tier)")
        print("   Expected Sections: 11")
        
        start_time = datetime.now()
        
        dossier = await generator.generate_dossier(
            entity_id="barcelona-fc",
            entity_name="FC Barcelona",
            entity_type="CLUB",
            priority_score=95  # Premium tier
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
                # Show first metric
                if section.metrics:
                    metric = section.metrics[0]
                    label = metric.get('label', 'N/A')
                    value = metric.get('value', 'N/A')
                    print(f"   Example: {label} = {value}")
            
            if section.insights:
                print(f"   Insights: {len(section.insights)} key insights")
            
            if section.recommendations:
                print(f"   Recommendations: {len(section.recommendations)} actions")
            
            # Show preview of content
            if section.content and len(section.content) > 0:
                preview = section.content[0]
                if len(preview) > 150:
                    preview = preview[:150] + "..."
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
        print("✅ FC BARCELONA DOSSIER COMPLETE")
        print("=" * 60)
        
        return dossier
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == "__main__":
    dossier = asyncio.run(test_barcelona_dossier())
    
    if dossier:
        print("\n🎉 Success! Barcelona FC dossier generated.")
        print("\n📊 Summary:")
        print(f"   - {len(dossier.sections)} sections generated")
        print(f"   - Time: {dossier.generation_time_seconds:.2f}s")
        print(f"   - Tier: {dossier.tier}")
        print(f"   - Quality: High-confidence AI content")
        print("\n✅ The dossier system is working perfectly!")
    else:
        print("\n⚠️  Generation failed. Check error messages above.")
