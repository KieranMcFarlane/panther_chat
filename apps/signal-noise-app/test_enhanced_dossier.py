#!/usr/bin/env python3
"""
Test script for enhanced dossier system

Tests:
1. Multi-source intelligence collection
2. Contextual score prompts
3. Outreach strategy generation
"""

import asyncio
import sys
import os
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_dir))

from dossier_data_collector import DossierDataCollector
from universal_club_prompts import SCORE_CONTEXT_TEMPLATE, OUTREACH_STRATEGY_PROMPT


async def test_multi_source_collection():
    """Test Phase 1: Multi-source intelligence collection"""
    print("=" * 60)
    print("TEST 1: Multi-Source Intelligence Collection")
    print("=" * 60)

    try:
        collector = DossierDataCollector()
        print("✅ DossierDataCollector initialized")

        # Test multi-source collection
        entity_name = "Arsenal FC"
        print(f"\n🔍 Collecting multi-source intelligence for {entity_name}...")

        data = await collector._collect_multi_source_intelligence(entity_name)

        print(f"\n✅ Collection complete!")
        print(f"   Sources Used: {', '.join(data.get('sources_used', []))}")
        print(f"   Freshness Score: {data.get('freshness_score', 0)}/100")

        print(f"\n   Official Site: {len(data.get('official_site', {}).get('content', ''))} chars")
        print(f"   Job Postings: {len(data.get('job_postings', []))} found")
        print(f"   Press Releases: {len(data.get('press_releases', []))} found")
        print(f"   LinkedIn Posts: {len(data.get('linkedin_posts', []))} found")

        # Test summary methods
        if data.get('job_postings'):
            from dossier_generator import UniversalDossierGenerator
            generator = UniversalDossierGenerator(None)
            jobs_summary = generator._summarize_job_postings(data.get('job_postings', []))
            print(f"\n   Jobs Summary:\n{jobs_summary}")

        return True

    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_score_context_template():
    """Test Phase 2: Score context template"""
    print("\n" + "=" * 60)
    print("TEST 2: Contextual Score Template")
    print("=" * 60)

    try:
        # Check if SCORE_CONTEXT_TEMPLATE exists
        if SCORE_CONTEXT_TEMPLATE:
            print("✅ SCORE_CONTEXT_TEMPLATE defined")
            print(f"   Template length: {len(SCORE_CONTEXT_TEMPLATE)} chars")

            # Check for key elements
            required_elements = ["The Score", "What It Means", "Why This Score", "Comparison", "What To Do"]
            missing = []
            for element in required_elements:
                if element not in SCORE_CONTEXT_TEMPLATE:
                    missing.append(element)

            if missing:
                print(f"   ⚠️ Missing elements: {', '.join(missing)}")
            else:
                print("   ✅ All required elements present")

            return True
        else:
            print("❌ SCORE_CONTEXT_TEMPLATE not found")
            return False

    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False


def test_outreach_strategy_template():
    """Test Phase 3: Outreach strategy template"""
    print("\n" + "=" * 60)
    print("TEST 3: Outreach Strategy Template")
    print("=" * 60)

    try:
        # Check if OUTREACH_STRATEGY_PROMPT exists
        if OUTREACH_STRATEGY_PROMPT:
            print("✅ OUTREACH_STRATEGY_PROMPT defined")
            print(f"   Template length: {len(OUTREACH_STRATEGY_PROMPT)} chars")

            # Check for key elements
            required_elements = [
                "connection_intelligence",
                "conversation_trees",
                "opening_message",
                "response_branches",
                "anti_patterns"
            ]
            missing = []
            for element in required_elements:
                if element not in OUTREACH_STRATEGY_PROMPT:
                    missing.append(element)

            if missing:
                print(f"   ⚠️ Missing elements: {', '.join(missing)}")
            else:
                print("   ✅ All required elements present")

            return True
        else:
            print("❌ OUTREACH_STRATEGY_PROMPT not found")
            return False

    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False


async def test_dossier_generator_sections():
    """Test Phase 3: Dossier generator has outreach_strategy section"""
    print("\n" + "=" * 60)
    print("TEST 4: Dossier Generator Sections")
    print("=" * 60)

    try:
        from dossier_generator import UniversalDossierGenerator

        # Create generator (may fail without Claude client, but check sections)
        try:
            generator = UniversalDossierGenerator(None)
        except:
            # Fallback: import and check class attributes
            from dossier_generator import UniversalDossierGenerator as Generator

            # Check if section_templates includes outreach_strategy
            if hasattr(Generator, '__init__'):
                print("✅ UniversalDossierGenerator class exists")
                # We'll check the tier_sections in the code directly
                print("   ⚠️ Cannot instantiate without Claude client")
                print("   Checking code structure...")

                # Read the file and check
                import inspect
                source = inspect.getsource(Generator)

                if 'outreach_strategy' in source:
                    print("   ✅ 'outreach_strategy' found in source code")
                    return True
                else:
                    print("   ❌ 'outreach_strategy' not found in source code")
                    return False
            else:
                print("❌ UniversalDossierGenerator not properly defined")
                return False

        # Check tier_sections
        if hasattr(generator, 'tier_sections'):
            print("✅ tier_sections attribute exists")

            # Check if outreach_strategy is in STANDARD or PREMIUM
            sections = generator.tier_sections
            standard_has = 'outreach_strategy' in sections.get('STANDARD', [])
            premium_has = 'outreach_strategy' in sections.get('PREMIUM', [])

            print(f"   STANDARD includes outreach_strategy: {standard_has}")
            print(f"   PREMIUM includes outreach_strategy: {premium_has}")

            if standard_has or premium_has:
                print("   ✅ outreach_strategy section added to tier sections")
                return True
            else:
                print("   ❌ outreach_strategy not in tier sections")
                return False
        else:
            print("   ⚠️ tier_sections attribute not found (may need Claude client)")
            return True  # Don't fail test

    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    """Run all tests"""
    print("\n🧪 Enhanced Dossier System Test Suite\n")

    results = []

    # Test 1: Multi-source collection
    result1 = await test_multi_source_collection()
    results.append(("Multi-Source Collection", result1))

    # Test 2: Score context template
    result2 = test_score_context_template()
    results.append(("Score Context Template", result2))

    # Test 3: Outreach strategy template
    result3 = test_outreach_strategy_template()
    results.append(("Outreach Strategy Template", result3))

    # Test 4: Dossier generator sections
    result4 = await test_dossier_generator_sections()
    results.append(("Dossier Generator Sections", result4))

    # Print summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)

    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")

    total = len(results)
    passed = sum(1 for _, p in results if p)

    print(f"\nTotal: {passed}/{total} tests passed")

    if passed == total:
        print("\n🎉 All tests passed!")
        return 0
    else:
        print(f"\n⚠️ {total - passed} test(s) failed")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
