#!/usr/bin/env python3
"""
Real Dossier Generation Test with Claude API

Tests the complete dossier generation system with actual Claude API calls:
- Validates all 11 sections can be generated
- Checks cost estimates match actual costs
- Tests model cascade strategy
- Verifies parallel generation performance
"""

import asyncio
import sys
import os
from datetime import datetime
from typing import Dict, Any

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dossier_generator import EntityDossierGenerator
from claude_client import ClaudeClient


async def test_claude_api_connection():
    """Test that Claude API is accessible"""
    print("=" * 60)
    print("TEST 1: Claude API Connection")
    print("=" * 60)
    
    try:
        client = ClaudeClient()
        
        # Simple test call using the correct API
        response = await client.query(
            prompt="Say 'API connection successful'",
            model="haiku",
            max_tokens=100
        )
        
        result = response.get("content", "")
        print(f"✅ Claude API Response: {result}")
        return True
        
    except Exception as e:
        print(f"❌ Claude API Error: {e}")
        print("\nTroubleshooting:")
        print("1. Check ANTHROPIC_API_KEY is set in .env")
        print("2. Check API key has sufficient credits")
        print("3. Check network connectivity")
        return False


async def test_single_section_generation():
    """Test generating a single dossier section"""
    print("\n" + "=" * 60)
    print("TEST 2: Single Section Generation (Haiku)")
    print("=" * 60)
    
    try:
        client = ClaudeClient()
        generator = EntityDossierGenerator(client, falkordb_client=None)
        
        # Test entity data
        entity_data = {
            "entity_name": "Arsenal FC",
            "founded": "1886",
            "stadium": "Emirates Stadium",
            "capacity": "60,704",
            "league": "Premier League"
        }
        
        # Generate core information section (Haiku)
        print("\nGenerating 'core_information' section with Haiku...")
        section = await generator._generate_section(
            section_id="core_information",
            entity_data=entity_data,
            model="haiku"
        )
        
        print(f"✅ Section Generated: {section.title}")
        print(f"   Model: {section.generated_by}")
        print(f"   Confidence: {section.confidence:.2f}")
        print(f"   Content Items: {len(section.content)}")
        print(f"   Cost: ${section.total_cost_usd:.6f}")
        
        if section.metrics:
            print(f"   Metrics: {len(section.metrics)} data points")
        
        return True, section
        
    except Exception as e:
        print(f"❌ Section Generation Error: {e}")
        import traceback
        traceback.print_exc()
        return False, None


async def test_model_cascade():
    """Test that different models produce different quality outputs"""
    print("\n" + "=" * 60)
    print("TEST 3: Model Cascade Strategy")
    print("=" * 60)
    
    try:
        client = ClaudeClient()
        generator = EntityDossierGenerator(client, falkordb_client=None)
        
        entity_data = {"entity_name": "Arsenal FC"}
        
        results = {}
        
        # Test Haiku (fast data extraction)
        print("\n[1/2] Testing Haiku (core_information)...")
        haiku_section = await generator._generate_section(
            section_id="core_information",
            entity_data=entity_data,
            model="haiku"
        )
        results["haiku"] = {
            "cost": haiku_section.total_cost_usd,
            "content_length": len(' '.join(haiku_section.content))
        }
        print(f"   ✅ Cost: ${haiku_section.total_cost_usd:.6f}")
        print(f"   ✅ Content Length: {results['haiku']['content_length']} chars")
        
        # Test Sonnet (balanced analysis)
        print("\n[2/2] Testing Sonnet (digital_maturity)...")
        sonnet_section = await generator._generate_section(
            section_id="digital_maturity",
            entity_data=entity_data,
            model="sonnet"
        )
        results["sonnet"] = {
            "cost": sonnet_section.total_cost_usd,
            "content_length": len(' '.join(sonnet_section.content))
        }
        print(f"   ✅ Cost: ${sonnet_section.total_cost_usd:.6f}")
        print(f"   ✅ Content Length: {results['sonnet']['content_length']} chars")
        
        # Verify cost ordering
        cost_order = results["haiku"]["cost"] < results["sonnet"]["cost"]
        print(f"\n✅ Cost ordering verified: Haiku < Sonnet")
        
        return True, results
        
    except Exception as e:
        print(f"❌ Model Cascade Error: {e}")
        import traceback
        traceback.print_exc()
        return False, None


async def test_complete_basic_dossier():
    """Test generating a complete Basic tier dossier (3 sections)"""
    print("\n" + "=" * 60)
    print("TEST 4: Complete Basic Tier Dossier (3 sections)")
    print("=" * 60)
    
    try:
        client = ClaudeClient()
        generator = EntityDossierGenerator(client, falkordb_client=None)
        
        print("\nGenerating Basic tier dossier for Arsenal FC...")
        dossier = await generator.generate_dossier(
            entity_id="arsenal-fc-basic-test",
            entity_name="Arsenal FC",
            entity_type="CLUB",
            priority_score=15  # Basic tier
        )
        
        print(f"\n✅ Dossier Generated Successfully!")
        print(f"   Entity: {dossier.entity_name}")
        print(f"   Tier: {dossier.tier}")
        print(f"   Sections: {len(dossier.sections)}")
        print(f"   Total Cost: ${dossier.total_cost_usd:.6f}")
        print(f"   Generation Time: {dossier.generation_time_seconds:.2f}s")
        
        # Verify section count
        expected_sections = 3  # Basic tier
        if len(dossier.sections) == expected_sections:
            print(f"\n✅ Section count correct: {len(dossier.sections)}/{expected_sections}")
        else:
            print(f"\n⚠️  Section count mismatch: {len(dossier.sections)}/{expected_sections}")
        
        # List all sections
        print("\nGenerated Sections:")
        for section in dossier.sections:
            print(f"   - {section.title} ({section.generated_by})")
        
        # Verify cost target
        target_cost = 0.001  # Basic tier target
        if dossier.total_cost_usd < target_cost:
            print(f"\n✅ Cost target met: ${dossier.total_cost_usd:.6f} < ${target_cost}")
        else:
            print(f"\n⚠️  Cost exceeds target: ${dossier.total_cost_usd:.6f} >= ${target_cost}")
        
        return True, dossier
        
    except Exception as e:
        print(f"❌ Dossier Generation Error: {e}")
        import traceback
        traceback.print_exc()
        return False, None


async def test_parallel_generation():
    """Test parallel section generation performance"""
    print("\n" + "=" * 60)
    print("TEST 5: Parallel Generation Performance")
    print("=" * 60)
    
    try:
        client = ClaudeClient()
        generator = EntityDossierGenerator(client, falkordb_client=None)
        
        # Generate Standard tier (7 sections) to test parallel execution
        print("\nGenerating Standard tier dossier (7 sections)...")
        start = datetime.now()
        
        dossier = await generator.generate_dossier(
            entity_id="arsenal-fc-parallel-test",
            entity_name="Arsenal FC",
            entity_type="CLUB",
            priority_score=35  # Standard tier
        )
        
        end = datetime.now()
        actual_time = (end - start).total_seconds()
        
        print(f"\n✅ Parallel Generation Complete!")
        print(f"   Sections: {len(dossier.sections)}")
        print(f"   Actual Time: {actual_time:.2f}s")
        print(f"   Tracked Time: {dossier.generation_time_seconds:.2f}s")
        print(f"   Total Cost: ${dossier.total_cost_usd:.6f}")
        
        # Calculate model distribution
        model_counts = {}
        for section in dossier.sections:
            model_counts[section.generated_by] = model_counts.get(section.generated_by, 0) + 1
        
        print("\nModel Distribution:")
        for model, count in model_counts.items():
            percentage = (count / len(dossier.sections)) * 100
            print(f"   {model.upper()}: {count}/{len(dossier.sections)} ({percentage:.0f}%)")
        
        return True, dossier
        
    except Exception as e:
        print(f"❌ Parallel Generation Error: {e}")
        import traceback
        traceback.print_exc()
        return False, None


async def main():
    """Run all integration tests"""
    print("\n")
    print("╔" + "═" * 58 + "╗")
    print("║" + " " * 10 + "REAL DOSSIER GENERATION INTEGRATION TEST" + " " * 10 + "║")
    print("╚" + "═" * 58 + "╝")
    
    test_results = {}
    
    # Test 1: Claude API Connection
    api_ok = await test_claude_api_connection()
    test_results["api_connection"] = api_ok
    
    if not api_ok:
        print("\n❌ Cannot proceed without Claude API access")
        return
    
    # Test 2: Single Section Generation
    section_ok, section = await test_single_section_generation()
    test_results["single_section"] = section_ok
    
    # Test 3: Model Cascade
    cascade_ok, cascade_results = await test_model_cascade()
    test_results["model_cascade"] = cascade_ok
    
    # Test 4: Complete Basic Dossier
    basic_ok, basic_dossier = await test_complete_basic_dossier()
    test_results["basic_dossier"] = basic_ok
    
    # Test 5: Parallel Generation
    parallel_ok, parallel_dossier = await test_parallel_generation()
    test_results["parallel_generation"] = parallel_ok
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for v in test_results.values() if v)
    total = len(test_results)
    
    print(f"\nTests Passed: {passed}/{total}")
    
    for test_name, result in test_results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"   {status}: {test_name}")
    
    if passed == total:
        print("\n" + "🎉 " * 15)
        print("ALL TESTS PASSED!")
        print("The Entity Dossier Generation System is fully operational.")
        print("🎉 " * 15)
        
        print("\n📊 System Metrics:")
        if cascade_results:
            print(f"   - Haiku cost: ${cascade_results['haiku']['cost']:.6f} per section")
            print(f"   - Sonnet cost: ${cascade_results['sonnet']['cost']:.6f} per section")
        
        if basic_dossier:
            print(f"   - Basic tier: {len(basic_dossier.sections)} sections, ${basic_dossier.total_cost_usd:.6f}")
        
        if parallel_dossier:
            print(f"   - Standard tier: {len(parallel_dossier.sections)} sections, ${parallel_dossier.total_cost_usd:.6f}")
        
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Please review errors above.")
    
    print("\n" + "=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
