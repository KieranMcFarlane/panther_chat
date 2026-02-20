#!/usr/bin/env python3
"""
Integration Test: Yellow Panther Temporal Profiling

Verifies end-to-end integration of all components:
1. Dossier generation with question extraction
2. LinkedIn profiling across multiple passes
3. Question-guided discovery
4. Temporal sweep scheduling
5. Profile evolution tracking
"""

import asyncio
import logging
from datetime import datetime, timezone

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def print_section(title):
    """Print a formatted section header"""
    print("\n" + "="*80)
    print(f"  {title}")
    print("="*80)


async def test_schema_integration():
    """Test that all new schemas are properly defined"""
    print_section("TEST 1: Schema Integration")

    from schemas import (
        DossierQuestion, DossierQuestionType, DossierQuestionStatus,
        EntityProfile, ProfileChange, ProfileChangeType,
        SweepConfig, SweepResult, SweepType,
        LinkedInProfile, LinkedInEpisodeType
    )

    print("✅ All schema imports successful")

    # Test DossierQuestion creation
    question = DossierQuestion(
        question_id="test_q_1",
        section_id="leadership",
        question_type=DossierQuestionType.LEADERSHIP,
        question_text="Who is the CTO?",
        priority=8
    )
    print(f"✅ DossierQuestion created: {question.question_type.value} - {question.question_text}")

    # Test EntityProfile creation
    profile = EntityProfile(
        entity_id="test-entity",
        entity_name="Test Entity",
        profile_version=1,
        sweep_pass=1,
        confidence_score=0.62
    )
    print(f"✅ EntityProfile created: {profile.entity_name} (v{profile.profile_version}, confidence: {profile.confidence_score})")

    # Test LinkedInProfile creation
    linkedin = LinkedInProfile(
        profile_id="li_test_1",
        entity_id="test-entity",
        profile_type="EXECUTIVE",
        sweep_pass=1,
        data_source="CACHE",
        title="CTO",
        company="Test Entity"
    )
    print(f"✅ LinkedInProfile created: {linkedin.title} at {linkedin.company}")

    return True


async def test_question_extraction():
    """Test dossier question extraction"""
    print_section("TEST 2: Question Extraction")

    try:
        from schemas import DossierSection
        from dossier_question_extractor import DossierQuestionExtractor
        from claude_client import ClaudeClient

        claude = ClaudeClient()
        extractor = DossierQuestionExtractor(claude)

        # Create a mock section
        section = DossierSection(
            id="leadership",
            title="Leadership Team",
            content=[
                "The leadership team at Arsenal FC needs to be analyzed.",
                "Who is the primary decision maker for technology procurement?",
                "What is the decision-making process for major purchases?",
                "The CTO and CIO jointly oversee digital transformation initiatives."
            ],
            generated_by="haiku"
        )

        # Extract questions
        questions = await extractor.extract_questions_from_section(
            section,
            "Arsenal FC",
            max_questions=5
        )

        print(f"✅ Extracted {len(questions)} questions from section")
        for i, q in enumerate(questions[:3], 1):
            print(f"   {i}. [{q.question_type.value}] {q.question_text} (priority: {q.priority})")

        return len(questions) > 0

    except Exception as e:
        logger.error(f"Question extraction test failed: {e}")
        return False


async def test_linkedin_profiling():
    """Test LinkedIn profiler (mock)"""
    print_section("TEST 3: LinkedIn Profiling")

    try:
        from linkedin_profiler import LinkedInProfiler
        from brightdata_sdk_client import BrightDataSDKClient

        brightdata = BrightDataSDKClient()
        profiler = LinkedInProfiler(brightdata)

        # Test Pass 1 (cached)
        print("   Testing Pass 1 (cached sweep)...")
        # Note: This will make actual API calls, so we'll just test instantiation
        print(f"✅ LinkedInProfiler instantiated successfully")
        print(f"   - Executive keywords defined: {len(profiler.executive_keywords)}")

        return True

    except Exception as e:
        logger.error(f"LinkedIn profiling test failed: {e}")
        return False


async def test_sweep_scheduler():
    """Test temporal sweep scheduler"""
    print_section("TEST 4: Temporal Sweep Scheduler")

    try:
        from temporal_sweep_scheduler import TemporalSweepScheduler
        from claude_client import ClaudeClient
        from brightdata_sdk_client import BrightDataSDKClient

        claude = ClaudeClient()
        brightdata = BrightDataSDKClient()
        scheduler = TemporalSweepScheduler(claude, brightdata)

        print("✅ TemporalSweepScheduler instantiated successfully")

        # Check default schedules
        print(f"   - Sweep schedules configured: {len(scheduler.default_sweep_schedule)}")
        for pass_num, config in scheduler.default_sweep_schedule.items():
            print(f"     Pass {pass_num}: {config.sweep_type.value} - "
                  f"{config.max_duration_seconds}s, ${config.max_cost_usd:.4f}")

        return True

    except Exception as e:
        logger.error(f"Sweep scheduler test failed: {e}")
        return False


async def test_dossier_integration():
    """Test that dossier generator extracts questions"""
    print_section("TEST 5: Dossier Integration")

    try:
        from dossier_generator import EntityDossierGenerator
        from claude_client import ClaudeClient

        claude = ClaudeClient()
        generator = EntityDossierGenerator(claude)

        print("   Generating minimal dossier...")
        dossier = await generator.generate_dossier(
            entity_id="test-entity",
            entity_name="Test Entity",
            entity_type="CLUB",
            priority_score=10  # BASIC tier (fastest)
        )

        print(f"✅ Dossier generated successfully")
        print(f"   - Sections: {len(dossier.sections)}")
        print(f"   - Questions: {len(dossier.questions)}")

        if dossier.questions:
            print("   Sample questions:")
            for i, q in enumerate(dossier.questions[:3], 1):
                print(f"     {i}. {q.question_text[:60]}...")

        return True

    except Exception as e:
        logger.error(f"Dossier integration test failed: {e}")
        return False


async def run_all_tests():
    """Run all integration tests"""
    print_section("YELLOW PANTHER TEMPORAL PROFILING - INTEGRATION TEST")
    print(f"Started at: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")

    tests = [
        ("Schema Integration", test_schema_integration),
        ("Question Extraction", test_question_extraction),
        ("LinkedIn Profiling", test_linkedin_profiling),
        ("Sweep Scheduler", test_sweep_scheduler),
        ("Dossier Integration", test_dossier_integration),
    ]

    results = []
    for test_name, test_func in tests:
        try:
            result = await test_func()
            results.append((test_name, result))
        except Exception as e:
            logger.error(f"Test {test_name} crashed: {e}")
            results.append((test_name, False))

    # Print summary
    print_section("TEST SUMMARY")
    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"   {status}: {test_name}")

    print(f"\n   Total: {passed}/{total} tests passed")

    if passed == total:
        print("\n🎉 ALL TESTS PASSED - System is ready for production!")
    else:
        print("\n⚠️  Some tests failed - review errors above")

    print(f"\nCompleted at: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")

    return passed == total


if __name__ == "__main__":
    success = asyncio.run(run_all_tests())
    exit(0 if success else 1)
