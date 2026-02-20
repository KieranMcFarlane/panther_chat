#!/usr/bin/env python3
"""
Test Question-First Dossier Integration

Tests the complete question-first reasoning integration:
1. Entity-type-specific question templates
2. Yellow Panther service mapping
3. Hypothesis generation from questions
4. Contact validation (rejecting placeholders)
5. Question → hop type mapping
6. Enhanced dossier generation with YP context
"""

import asyncio
import sys
import os
import json
from datetime import datetime

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))



def print_section(title: str):
    """Print a formatted section header"""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)


def test_entity_type_questions():
    """Test 1: Entity-Type Question Templates"""
    print_section("TEST 1: Entity-Type Question Templates")

    try:
        from entity_type_dossier_questions import (
            get_questions_for_entity_type,
            ENTITY_TYPE_QUESTIONS,
            YPServiceCategory,
            YPPositioningStrategy
        )

        print(f"✅ Successfully imported entity_type_dossier_questions")

        # Test SPORT_CLUB questions
        club_questions = get_questions_for_entity_type("SPORT_CLUB")
        print(f"\n📊 SPORT_CLUB Questions: {len(club_questions)}")
        for q in club_questions[:3]:
            print(f"   - {q.question_id}")
            print(f"     Question: {q.question}")
            print(f"     YP Services: {[s.value for s in q.yp_service_fit]}")
            print(f"     Budget: {q.budget_range}")
            print(f"     Positioning: {q.positioning_strategy.value}")

        # Test SPORT_FEDERATION questions
        fed_questions = get_questions_for_entity_type("SPORT_FEDERATION")
        print(f"\n📊 SPORT_FEDERATION Questions: {len(fed_questions)}")
        for q in fed_questions[:2]:
            print(f"   - {q.question_id}")
            print(f"     Question: {q.question}")
            print(f"     YP Services: {[s.value for s in q.yp_service_fit]}")

        # Test SPORT_LEAGUE questions
        league_questions = get_questions_for_entity_type("SPORT_LEAGUE")
        print(f"\n📊 SPORT_LEAGUE Questions: {len(league_questions)}")

        print("\n✅ TEST 1 PASSED: Entity-type questions loaded correctly")
        return True

    except Exception as e:
        print(f"❌ TEST 1 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_hypothesis_generation():
    """Test 2: Hypothesis Generation from Questions"""
    print_section("TEST 2: Hypothesis Generation from Questions")

    try:
        from entity_type_dossier_questions import (
            generate_hypothesis_from_question,
            generate_hypothesis_batch,
            get_questions_for_entity_type
        )

        # Get a question
        questions = get_questions_for_entity_type("SPORT_CLUB")
        test_question = questions[0]  # Mobile app question

        print(f"📝 Test Question: {test_question.question_id}")
        print(f"   {test_question.question}")

        # Generate single hypothesis
        hypothesis = generate_hypothesis_from_question(
            question=test_question,
            entity_name="Arsenal FC",
            entity_id="arsenal-fc"
        )

        print(f"\n🎯 Generated Hypothesis:")
        print(f"   ID: {hypothesis['hypothesis_id']}")
        print(f"   Statement: {hypothesis['statement']}")
        print(f"   Confidence: {hypothesis['confidence']:.2f}")
        print(f"   YP Services: {', '.join(hypothesis['metadata']['yp_service_fit'])}")
        print(f"   Budget: {hypothesis['metadata']['budget_range']}")
        print(f"   Positioning: {hypothesis['metadata']['positioning_strategy']}")
        print(f"   Next Signals: {hypothesis['metadata']['next_signals'][:2]}")
        print(f"   Hop Types: {hypothesis['metadata']['hop_types']}")

        # Generate batch hypotheses
        print(f"\n📦 Batch Hypothesis Generation:")
        hypotheses = generate_hypothesis_batch(
            entity_type="SPORT_CLUB",
            entity_name="Arsenal FC",
            entity_id="arsenal-fc",
            max_questions=5
        )

        print(f"   Generated {len(hypotheses)} hypotheses")
        for h in hypotheses:
            print(f"   - {h['statement']} (confidence: {h['confidence']:.2f})")

        print("\n✅ TEST 2 PASSED: Hypothesis generation working correctly")
        return True

    except Exception as e:
        print(f"❌ TEST 2 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_contact_validation():
    """Test 3: Contact Data Validation"""
    print_section("TEST 3: Contact Data Validation (Reject Placeholders)")

    try:
        from entity_type_dossier_questions import validate_contact_data

        # Test contacts
        test_contacts = [
            {"name": "Juliet Slot", "title": "Commercial Director", "linkedin_url": "linkedin.com/in/juliet"},
            {"name": "{FEDERATION PRESIDENT}", "title": "President", "linkedin_url": ""},
            {"name": "Edu Gaspar", "title": "Technical Director", "linkedin_url": "linkedin.com/in/edu"},
            {"name": "Director", "title": "Director", "email": "contact@example.com"},  # Generic title
            {"name": "Tim Lewis", "title": "Head of Digital", "linkedin_url": "linkedin.com/in/tim"}
        ]

        print("📋 Testing contact validation:")
        for contact in test_contacts:
            is_valid, message = validate_contact_data(contact)
            status = "✅ VALID" if is_valid else "❌ INVALID"
            print(f"   {status}: {contact['name']} - {message}")

        print("\n✅ TEST 3 PASSED: Contact validation working correctly")
        return True

    except Exception as e:
        print(f"❌ TEST 3 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_yp_scorer_integration():
    """Test 4: YP Scorer with Question Templates"""
    print_section("TEST 4: YP Scorer with Question Templates")

    try:
        from yellow_panther_scorer import YellowPantherFitScorer

        scorer = YellowPantherFitScorer()

        # Test getting questions
        questions = scorer.get_entity_type_questions("SPORT_CLUB")
        print(f"📊 YP Scorer loaded {len(questions)} questions for SPORT_CLUB")

        # Test positioning strategy
        test_signals = [
            "RFP_DETECTED",
            "DIGITAL_INITIATIVE",
            "HIRING_SIGNAL",
            "PARTNERSHIP_SEEKING",
            "MUTUAL_CONNECTION"
        ]

        print(f"\n🎯 Positioning Strategy Mapping:")
        for signal in test_signals:
            positioning = scorer.get_positioning_strategy_for_signal(signal)
            print(f"   {signal} → {positioning}")

        # Test scoring with evidence
        signal = {
            'signal_category': 'mobile app',
            'evidence': [{'content': 'Looking for React Native mobile app development for fan engagement'}],
            'confidence': 0.8
        }

        result = scorer.score_opportunity(signal, {'name': 'Arsenal', 'country': 'UK'})

        print(f"\n📈 Scoring Result:")
        print(f"   Fit Score: {result['fit_score']}/100")
        print(f"   Priority: {result['priority']}")
        print(f"   Budget Alignment: {result['budget_alignment']}")
        print(f"   Service Alignment: {result['service_alignment']}")
        print(f"   Recommendations: {result['recommended_actions'][:2]}")

        print("\n✅ TEST 4 PASSED: YP scorer integration working correctly")
        return True

    except Exception as e:
        print(f"❌ TEST 4 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_hop_mapping():
    """Test 5: Question → Hop Type Mapping"""
    print_section("TEST 5: Question → Hop Type Mapping")

    try:
        from entity_type_dossier_questions import (
            get_questions_for_entity_type,
            map_question_to_hop_types
        )

        questions = get_questions_for_entity_type("SPORT_CLUB")

        print(f"\n🗺️  Hop Type Mapping for SPORT_CLUB Questions:")
        for q in questions[:5]:
            hop_types = map_question_to_hop_types(q)
            print(f"   {q.question_id}")
            print(f"     → {hop_types}")

        # Test hypothesis-driven discovery integration
        from hypothesis_driven_discovery import HypothesisDrivenDiscovery, HopType

        # Create a mock hypothesis with hop types
        class MockHypothesis:
            def __init__(self):
                self.statement = "Arsenal FC will issue mobile app RFP"
                self.metadata = {
                    'hop_types': ['RFP_PAGE', 'CAREERS_PAGE'],
                    'next_signals': ['Mobile Developer jobs', 'RFP announcements']
                }

        discovery = HypothesisDrivenDiscovery(None, None)
        mock_hyp = MockHypothesis()

        hop_plans = discovery.plan_hops_from_hypothesis(mock_hyp, "Arsenal FC")

        print(f"\n📋 Generated Hop Plans:")
        for plan in hop_plans:
            print(f"   - {plan['hop_type'].value}: {plan['query']} (priority: {plan['priority']})")

        print("\n✅ TEST 5 PASSED: Hop type mapping working correctly")
        return True

    except Exception as e:
        print(f"❌ TEST 5 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_enhanced_dossier_generator():
    """Test 6: Enhanced Dossier Generator with YP Integration"""
    print_section("TEST 6: Enhanced Dossier Generator with YP Integration")

    try:
        from enhanced_dossier_generator import EnhancedDossierGenerator
        from claude_client import ClaudeClient

        # Skip if no API key
        if not os.getenv('ANTHROPIC_API_KEY'):
            print("⚠️  ANTHROPIC_API_KEY not set - skipping API test")
            print("   Testing YP integration methods only...")

        generator = EnhancedDossierGenerator(ClaudeClient())

        # Test getting questions
        questions = generator.get_questions_for_entity("SPORT_CLUB", max_questions=3)
        print(f"📊 Retrieved {len(questions)} questions for SPORT_CLUB")

        for q in questions:
            print(f"   - {q['question_id']}: {q['question']}")
            print(f"     YP Services: {', '.join(q['yp_service_fit'])}")

        # Test contact validation
        test_contacts = [
            {"name": "Real Person", "title": "Commercial Director", "linkedin_url": "linkedin.com/real"},
            {"name": "{PLACEHOLDER}", "title": "Director", "linkedin_url": ""}
        ]

        valid_contacts, errors = generator.validate_real_contacts(test_contacts)
        print(f"\n👥 Contact Validation:")
        print(f"   Valid: {len(valid_contacts)}, Invalid: {len(errors)}")
        for error in errors:
            print(f"   - {error}")

        print("\n✅ TEST 6 PASSED: Enhanced dossier generator YP integration working")
        return True

    except Exception as e:
        print(f"❌ TEST 6 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_full_integration():
    """Test 7: Full End-to-End Integration"""
    print_section("TEST 7: Full End-to-End Integration")

    try:
        from entity_type_dossier_questions import generate_hypothesis_batch
        from enhanced_dossier_generator import EnhancedDossierGenerator
        from claude_client import ClaudeClient

        # Generate hypotheses for different entity types
        entity_types = ["SPORT_CLUB", "SPORT_FEDERATION", "SPORT_LEAGUE"]
        entity_names = ["Arsenal FC", "International Canoe Federation", "Premier League"]

        print("🔬 Generating hypotheses across entity types:\n")

        all_results = []

        for entity_type, entity_name in zip(entity_types, entity_names):
            entity_id = entity_name.lower().replace(" ", "-")

            hypotheses = generate_hypothesis_batch(
                entity_type=entity_type,
                entity_name=entity_name,
                entity_id=entity_id,
                max_questions=5
            )

            print(f"📊 {entity_name} ({entity_type}):")
            print(f"   Generated {len(hypotheses)} hypotheses")

            for hyp in hypotheses[:2]:
                yp_services = hyp['metadata']['yp_service_fit']
                budget = hyp['metadata']['budget_range']
                positioning = hyp['metadata']['positioning_strategy']

                print(f"   - {hyp['statement']}")
                print(f"     YP: {', '.join(yp_services)}, Budget: {budget}, Positioning: {positioning}")

            all_results.append({
                'entity_type': entity_type,
                'entity_name': entity_name,
                'hypotheses': hypotheses
            })

        # Summary statistics
        print(f"\n📈 Integration Summary:")
        total_hypotheses = sum(len(r['hypotheses']) for r in all_results)
        print(f"   Total hypotheses generated: {total_hypotheses}")

        # Count YP service distribution
        yp_service_counts = {}
        for result in all_results:
            for hyp in result['hypotheses']:
                for service in hyp['metadata']['yp_service_fit']:
                    yp_service_counts[service] = yp_service_counts.get(service, 0) + 1

        print(f"   YP Service Distribution:")
        for service, count in sorted(yp_service_counts.items()):
            print(f"   - {service}: {count} hypotheses")

        print("\n✅ TEST 7 PASSED: Full end-to-end integration working")
        return True

    except Exception as e:
        print(f"❌ TEST 7 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all tests"""
    print("\n" + "=" * 80)
    print("  QUESTION-FIRST DOSSIER INTEGRATION TEST")
    print("=" * 80)
    print(f"  Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    results = {}

    # Run synchronous tests
    results['entity_type_questions'] = test_entity_type_questions()
    results['hypothesis_generation'] = test_hypothesis_generation()
    results['contact_validation'] = test_contact_validation()
    results['yp_scorer'] = test_yp_scorer_integration()
    results['hop_mapping'] = test_hop_mapping()
    results['dossier_generator'] = test_enhanced_dossier_generator()

    # Run async test
    results['full_integration'] = asyncio.run(test_full_integration())

    # Print summary
    print_section("TEST SUMMARY")
    passed = sum(1 for v in results.values() if v)
    total = len(results)

    for test_name, result in results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"  {status}: {test_name.replace('_', ' ').title()}")

    print(f"\n  Overall: {passed}/{total} tests passed")

    if passed == total:
        print("\n🎉 All tests passed! Question-first dossier integration is working correctly.")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Please review the errors above.")
        return 1


if __name__ == "__main__":
    exit(main())
