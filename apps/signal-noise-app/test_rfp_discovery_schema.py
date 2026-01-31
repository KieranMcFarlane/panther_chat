#!/usr/bin/env python3
"""
Test RFP Discovery Schema with Real Entities

This script tests the complete RFP discovery pipeline with real sports entities
from the Signal Noise database.

Usage:
    python test_rfp_discovery_schema.py [--entity ENTITY_ID] [--category CATEGORY]

Examples:
    # Test Arsenal FC for CRM signals
    python test_rfp_discovery_schema.py --entity arsenal --category CRM

    # Test top 5 entities for all categories
    python test_rfp_discovery_schema.py --top 5

    # Test specific entity for multiple categories
    python test_rfp_discovery_schema.py --entity chelsea --categories CRM,TICKETING,ANALYTICS
"""

import asyncio
import sys
import os
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Any, Optional
import argparse
import json

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def test_single_entity(
    entity_name: str,
    entity_id: str,
    categories: List[str]
):
    """
    Test RFP discovery for a single entity

    Args:
        entity_name: Entity display name
        entity_id: Entity identifier
        categories: List of category names
    """
    from backend.rfc_discovery_schema import (
        discover_rfps_for_entity,
        SignalCategory
    )

    logger.info(f"\n{'='*80}")
    logger.info(f"Testing RFP Discovery for: {entity_name} ({entity_id})")
    logger.info(f"Categories: {', '.join(categories)}")
    logger.info(f"{'='*80}\n")

    # Convert category strings to enums
    category_enums = [SignalCategory(c) for c in categories]

    # Run discovery
    start_time = datetime.now(timezone.utc)

    try:
        result = await discover_rfps_for_entity(
            entity_name=entity_name,
            entity_id=entity_id,
            categories=categories
        )

        end_time = datetime.now(timezone.utc)
        duration = (end_time - start_time).total_seconds()

        # Print results
        print(f"\n{'='*80}")
        print("DISCOVERY RESULTS")
        print(f"{'='*80}")
        print(f"Entity: {result['entity_name']}")
        print(f"Categories searched: {', '.join(result['categories_searched'])}")
        print(f"Duration: {duration:.2f} seconds")
        print(f"\nValidated Signals: {len(result['validated_signals'])}")
        print(f"Rejected Candidates: {len(result['rejected_candidates'])}")

        # Print validated signals
        if result['validated_signals']:
            print(f"\n✅ VALIDATED SIGNALS:")
            for i, signal in enumerate(result['validated_signals'], 1):
                print(f"\n  {i}. {signal.category} (confidence: {signal.confidence:.2f})")
                print(f"     ID: {signal.id}")
                print(f"     Evidence: {len(signal.evidence)} items")
                print(f"     Temporal Multiplier: {signal.temporal_multiplier:.2f}")

                if signal.confidence_validation:
                    cv = signal.confidence_validation
                    print(f"     Confidence Validation:")
                    print(f"       Original: {cv.original_confidence:.2f}")
                    print(f"       Validated: {cv.validated_confidence:.2f}")
                    print(f"       Adjustment: {cv.adjustment:+.2f}")
                    print(f"       Rationale: {cv.rationale}")

                if signal.primary_reason:
                    print(f"     Primary Reason: {signal.primary_reason} ({signal.primary_reason_confidence:.2f})")
                    print(f"     Urgency: {signal.urgency}")

                if signal.yellow_panther_fit_score:
                    print(f"     YP Fit Score: {signal.yellow_panther_fit_score:.1f}/100")
                    print(f"     YP Priority: {signal.yellow_panther_priority}")

                # Print evidence details
                print(f"\n     Evidence:")
                for j, ev in enumerate(signal.evidence[:3], 1):  # Show first 3
                    print(f"       {j}. {ev.source} (credibility: {ev.credibility_score:.2f})")
                    if ev.url:
                        print(f"          URL: {ev.url}")
                    if ev.extracted_text:
                        text_preview = ev.extracted_text[:100] + "..." if len(ev.extracted_text) > 100 else ev.extracted_text
                        print(f"          Text: \"{text_preview}\"")

        # Print discovery summary by category
        print(f"\n📊 DISCOVERY SUMMARY BY CATEGORY:")
        for category, summary in result['discovery_summary'].items():
            print(f"\n  {category}:")
            print(f"     Iterations: {summary['iterations']}")
            print(f"     Final Confidence: {summary['final_confidence']:.2f}")
            print(f"     Validated: {summary['validated_count']}")
            print(f"     Rejected: {summary['rejected_count']}")
            print(f"     Temporal Multiplier: {summary['temporal_multiplier']:.2f}")

        # Save results to file
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        output_file = f"rfp_discovery_results_{entity_id}_{timestamp}.json"

        results_to_save = {
            'entity_id': entity_id,
            'entity_name': entity_name,
            'categories_searched': result['categories_searched'],
            'duration_seconds': duration,
            'validated_signals': [
                {
                    'id': s.id,
                    'category': s.category.value,
                    'confidence': s.confidence,
                    'evidence_count': len(s.evidence),
                    'temporal_multiplier': s.temporal_multiplier,
                    'primary_reason': s.primary_reason,
                    'yellow_panther_fit_score': s.yellow_panther_fit_score,
                    'yellow_panther_priority': s.yellow_panther_priority
                }
                for s in result['validated_signals']
            ],
            'rejected_candidates': len(result['rejected_candidates']),
            'discovery_summary': result['discovery_summary']
        }

        with open(output_file, 'w') as f:
            json.dump(results_to_save, f, indent=2)

        print(f"\n💾 Results saved to: {output_file}")

    except Exception as e:
        logger.error(f"❌ Discovery failed: {e}")
        import traceback
        traceback.print_exc()


async def test_multiple_entities(top_n: int = 5):
    """
    Test RFP discovery for top N entities from the database

    Args:
        top_n: Number of top entities to test
    """
    from backend.rfc_discovery_schema import SignalCategory

    # Get entities from FalkorDB (sample entities)
    test_entities = [
        {
            "entity_id": "arsenal",
            "entity_name": "Arsenal FC",
            "categories": ["CRM", "ANALYTICS", "CONTENT"]
        },
        {
            "entity_id": "chelsea",
            "entity_name": "Chelsea FC",
            "categories": ["TICKETING", "COMMERCE", "MARKETING"]
        },
        {
            "entity_id": "mancity",
            "entity_name": "Manchester City",
            "categories": ["DATA_PLATFORM", "ANALYTICS", "INFRASTRUCTURE"]
        },
        {
            "entity_id": "liverpool",
            "entity_name": "Liverpool FC",
            "categories": ["FAN_ENGAGEMENT", "CONTENT", "MARKETING"]
        },
        {
            "entity_id": "tottenham",
            "entity_name": "Tottenham Hotspur",
            "categories": ["ANALYTICS", "CRM", "TICKETING"]
        }
    ]

    # Limit to top_n
    test_entities = test_entities[:top_n]

    logger.info(f"\n🚀 Testing {len(test_entities)} entities")

    all_results = []

    for entity in test_entities:
        print(f"\n\n{'='*80}")
        print(f"Testing: {entity['entity_name']} ({entity['entity_id']})")
        print(f"{'='*80}")

        try:
            result = await test_single_entity(
                entity_name=entity['entity_name'],
                entity_id=entity['entity_id'],
                categories=entity['categories']
            )

            # Summarize results
            validated_count = len(result.get('validated_signals', []))
            rejected_count = len(result.get('rejected_candidates', 0))

            print(f"\n📊 Summary: {validated_count} validated, {rejected_count} rejected")

            all_results.append({
                'entity': entity,
                'validated_count': validated_count,
                'rejected_count': rejected_count
            })

        except Exception as e:
            logger.error(f"❌ Failed to test {entity['entity_name']}: {e}")
            all_results.append({
                'entity': entity,
                'validated_count': 0,
                'rejected_count': 0,
                'error': str(e)
            })

    # Print overall summary
    print(f"\n\n{'='*80}")
    print("OVERALL SUMMARY")
    print(f"{'='*80}")

    total_validated = sum(r['validated_count'] for r in all_results)
    total_rejected = sum(r['rejected_count'] for r in all_results)

    print(f"\nTotal Entities Tested: {len(all_results)}")
    print(f"Total Validated Signals: {total_validated}")
    print(f"Total Rejected Candidates: {total_rejected}")

    print(f"\nBreakdown by Entity:")
    for result in all_results:
        entity = result['entity']
        print(f"\n  {entity['entity_name']} ({entity['entity_id']}):")
        print(f"    Validated: {result['validated_count']}")
        print(f"    Rejected: {result['rejected_count']}")
        if 'error' in result:
            print(f"    Error: {result['error']}")

    # Save overall results
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    output_file = f"rfp_discovery_batch_{timestamp}.json"

    with open(output_file, 'w') as f:
        json.dump({
            'timestamp': timestamp,
            'total_entities_tested': len(all_results),
            'total_validated_signals': total_validated,
            'total_rejected_candidates': total_rejected,
            'results_by_entity': all_results
        }, f, indent=2)

    print(f"\n💾 Batch results saved to: {output_file}")


async def test_brightdata_integration():
    """
    Test BrightData SDK integration independently
    """
    from backend.brightdata_sdk_client import BrightDataSDKClient

    logger.info("\n" + "="*80)
    logger.info("Testing BrightData SDK Integration")
    logger.info("="*80 + "\n")

    client = BrightDataSDKClient()

    # Test 1: Search engine
    print("Test 1: Search Engine")
    print("-" * 40)

    search_result = await client.search_engine(
        query="Arsenal FC CRM Director jobs",
        engine="google",
        num_results=5
    )

    if search_result['status'] == 'success':
        print(f"✅ Search successful: {len(search_result['results'])} results")
        for i, result in enumerate(search_result['results'][:3], 1):
            print(f"  {i}. {result['title']}")
            print(f"     URL: {result['url']}")
    else:
        print(f"❌ Search failed: {search_result.get('error')}")

    # Test 2: URL scraping
    if search_result['status'] == 'success' and search_result['results']:
        first_url = search_result['results'][0]['url']

        print(f"\nTest 2: URL Scraping")
        print("-" * 40)
        print(f"Scraping: {first_url}")

        scrape_result = await client.scrape_as_markdown(first_url)

        if scrape_result['status'] == 'success':
            content_len = len(scrape_result['content'])
            print(f"✅ Scrape successful: {content_len} characters")
            print(f"Preview: {scrape_result['content'][:200]}...")
        else:
            print(f"❌ Scrape failed: {scrape_result.get('error')}")

    # Test 3: Batch scraping
    if search_result['status'] == 'success' and len(search_result['results']) > 1:
        urls = [r['url'] for r in search_result['results'][:3]]

        print(f"\nTest 3: Batch Scraping ({len(urls)} URLs)")
        print("-" * 40)

        batch_result = await client.scrape_batch(urls)

        if batch_result['status'] == 'success':
            print(f"✅ Batch scrape successful:")
            print(f"   Total URLs: {batch_result['total_urls']}")
            print(f"   Successful: {batch_result['successful']}")
            print(f"   Failed: {batch_result['failed']}")
        else:
            print(f"❌ Batch scrape failed: {batch_result.get('error')}")

    logger.info("\n✅ BrightData SDK integration test complete\n")


async def main():
    """Main test entry point"""
    parser = argparse.ArgumentParser(
        description="Test RFP Discovery Schema with Real Entities"
    )

    parser.add_argument(
        '--entity',
        type=str,
        help='Entity ID to test (e.g., arsenal, chelsea)'
    )

    parser.add_argument(
        '--entity-name',
        type=str,
        help='Entity display name (if different from ID)'
    )

    parser.add_argument(
        '--category',
        type=str,
        help='Single category to test (e.g., CRM, TICKETING)'
    )

    parser.add_argument(
        '--categories',
        type=str,
        help='Comma-separated categories (e.g., CRM,TICKETING,ANALYTICS)'
    )

    parser.add_argument(
        '--top',
        type=int,
        default=5,
        help='Test top N entities (default: 5)'
    )

    parser.add_argument(
        '--test-brightdata',
        action='store_true',
        help='Test BrightData SDK integration'
    )

    args = parser.parse_args()

    print("\n" + "="*80)
    print("RFP DISCOVERY SCHEMA - REAL ENTITY TESTING")
    print("="*80 + "\n")

    # Test BrightData integration first
    if args.test_brightdata:
        await test_brightdata_integration()
        return

    # Test single entity
    if args.entity:
        entity_id = args.entity
        entity_name = args.entity_name or args.entity.title()

        if args.category:
            categories = [args.category]
        elif args.categories:
            categories = args.categories.split(',')
        else:
            # Default categories
            categories = ["CRM", "TICKETING", "ANALYTICS"]

        await test_single_entity(
            entity_name=entity_name,
            entity_id=entity_id,
            categories=categories
        )

    # Test multiple entities
    elif args.top:
        await test_multiple_entities(top_n=args.top)

    else:
        # Default: test single entity
        await test_single_entity(
            entity_name="Arsenal FC",
            entity_id="arsenal",
            categories=["CRM", "ANALYTICS", "CONTENT"]
        )


if __name__ == "__main__":
    asyncio.run(main())
