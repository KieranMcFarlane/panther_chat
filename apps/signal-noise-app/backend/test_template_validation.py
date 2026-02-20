"""
Template Validation Test Suite

Test live validation with 5 entities per template.

Success criteria:
- >= 3/5 entities pass with confidence >= 0.7
- Average confidence across entities >= 0.7

Usage:
    python backend/test_template_validation.py
    python backend/test_template_validation.py --template tier_1_club_centralized_procurement
    python backend/test_template_validation.py --all
"""

import asyncio
import argparse
import logging
import sys
import os
from datetime import datetime
from typing import Dict, List, Any

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from backend.template_validator_agent import TemplateValidationAgent, Entity
from backend.template_loader import TemplateLoader
from backend.claude_client import ClaudeClient

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# Test entities (5 representative per cluster)
TEST_ENTITIES = {
    "top_tier_club": [
        {
            "entity_id": "arsenal-fc",
            "name": "Arsenal FC",
            "entity_domain": "arsenal.com",
            "sport": "Football",
            "org_type": "club",
            "estimated_revenue_band": "high",
            "digital_maturity": "high"
        },
        {
            "entity_id": "liverpool-fc",
            "name": "Liverpool FC",
            "entity_domain": "liverpoolfc.com",
            "sport": "Football",
            "org_type": "club",
            "estimated_revenue_band": "high",
            "digital_maturity": "high"
        },
        {
            "entity_id": "manchester-united",
            "name": "Manchester United",
            "entity_domain": "manutd.com",
            "sport": "Football",
            "org_type": "club",
            "estimated_revenue_band": "high",
            "digital_maturity": "high"
        },
        {
            "entity_id": "chelsea-fc",
            "name": "Chelsea FC",
            "entity_domain": "chelseafc.com",
            "sport": "Football",
            "org_type": "club",
            "estimated_revenue_band": "high",
            "digital_maturity": "high"
        },
        {
            "entity_id": "manchester-city",
            "name": "Manchester City",
            "entity_domain": "mancity.com",
            "sport": "Football",
            "org_type": "club",
            "estimated_revenue_band": "high",
            "digital_maturity": "high"
        }
    ],
    "mid_tier_club": [
        {
            "entity_id": "brighton-fc",
            "name": "Brighton FC",
            "entity_domain": "brightonandhovealbion.com",
            "sport": "Football",
            "org_type": "club",
            "estimated_revenue_band": "medium",
            "digital_maturity": "medium"
        },
        {
            "entity_id": "aston-villa",
            "name": "Aston Villa",
            "entity_domain": "avfc.co.uk",
            "sport": "Football",
            "org_type": "club",
            "estimated_revenue_band": "medium",
            "digital_maturity": "medium"
        },
        {
            "entity_id": "leicester-city",
            "name": "Leicester City",
            "entity_domain": "lcfc.com",
            "sport": "Football",
            "org_type": "club",
            "estimated_revenue_band": "medium",
            "digital_maturity": "medium"
        },
        {
            "entity_id": "west-ham-united",
            "name": "West Ham United",
            "entity_domain": "westhamunited.com",
            "sport": "Football",
            "org_type": "club",
            "estimated_revenue_band": "medium",
            "digital_maturity": "medium"
        },
        {
            "entity_id": "newcastle-united",
            "name": "Newcastle United",
            "entity_domain": "newcastleunited.com",
            "sport": "Football",
            "org_type": "club",
            "estimated_revenue_band": "medium",
            "digital_maturity": "medium"
        }
    ]
}


async def test_single_template(
    template_id: str,
    verbose: bool = True
) -> Dict[str, Any]:
    """
    Test single template against 5 entities

    Args:
        template_id: Template to test
        verbose: Print detailed results

    Returns:
        Test results dict
    """
    logger.info(f"🧪 Testing template: {template_id}")

    loader = TemplateLoader()
    template = loader.get_template(template_id)

    if not template:
        logger.error(f"❌ Template not found: {template_id}")
        return {
            "template_id": template_id,
            "error": "Template not found"
        }

    claude = ClaudeClient()
    agent = TemplateValidationAgent(claude, loader)

    # Get entities for this cluster
    entities_data = TEST_ENTITIES.get(
        template.cluster_id,
        TEST_ENTITIES.get("top_tier_club", [])  # Fallback
    )

    if not entities_data:
        logger.warning(f"⚠️ No test entities for cluster: {template.cluster_id}")
        return {
            "template_id": template_id,
            "cluster_id": template.cluster_id,
            "error": "No test entities available"
        }

    results = []
    start_time = datetime.now()

    for entity_data in entities_data[:5]:
        try:
            entity = Entity(**entity_data)
            result = await agent.validate_template_for_entity(template, entity)

            results.append({
                "entity_id": result.entity_id,
                "passed": result.passed,
                "signals_detected": result.signals_detected,
                "confidence_score": result.confidence_score,
                "execution_time_seconds": result.execution_time_seconds,
                "errors": result.errors
            })

            if verbose:
                print(f"\n✅ Entity: {entity.name}")
                print(f"  Passed: {result.passed}")
                print(f"  Signals: {result.signals_detected}")
                print(f"  Confidence: {result.confidence_score:.2f}")
                print(f"  Time: {result.execution_time_seconds:.2f}s")

        except Exception as e:
            logger.error(f"❌ Error testing {entity_data.get('name')}: {e}")
            results.append({
                "entity_id": entity_data.get("entity_id", "unknown"),
                "passed": False,
                "signals_detected": 0,
                "confidence_score": 0.0,
                "execution_time_seconds": 0.0,
                "errors": [str(e)]
            })

    # Calculate summary
    passed = sum(1 for r in results if r["passed"])
    avg_confidence = sum(r["confidence_score"] for r in results) / len(results)
    total_time = (datetime.now() - start_time).total_seconds()

    success = passed >= 3 and avg_confidence >= 0.7

    if verbose:
        print(f"\n{'='*60}")
        print(f"SUMMARY: {template.template_name}")
        print(f"{'='*60}")
        print(f"Cluster: {template.cluster_id}")
        print(f"Passed: {passed}/5")
        print(f"Avg Confidence: {avg_confidence:.2f}")
        print(f"Total Time: {total_time:.2f}s")
        print(f"Status: {'✅ SUCCESS' if success else '❌ FAILED'}")
        print(f"{'='*60}\n")

    return {
        "template_id": template_id,
        "template_name": template.template_name,
        "cluster_id": template.cluster_id,
        "passed_entities": passed,
        "total_entities": len(results),
        "success_rate": passed / len(results),
        "avg_confidence": avg_confidence,
        "total_time_seconds": total_time,
        "success": success,
        "per_entity_results": results
    }


async def test_all_templates(limit: int = 5):
    """
    Test all templates (or limited subset)

    Args:
        limit: Maximum number of templates to test
    """
    loader = TemplateLoader()
    templates = loader.get_all_templates()

    logger.info(f"🧪 Testing {len(templates)} templates (limit: {limit})")

    results = []
    passed_count = 0

    for i, template in enumerate(templates[:limit]):
        print(f"\n{'#'*60}")
        print(f"Test {i+1}/{limit}: {template.template_name}")
        print(f"{'#'*60}\n")

        result = await test_single_template(template.template_id, verbose=True)
        results.append(result)

        if result.get("success"):
            passed_count += 1

    # Final summary
    print(f"\n\n{'='*60}")
    print(f"FINAL SUMMARY")
    print(f"{'='*60}")
    print(f"Total Templates Tested: {len(results)}")
    print(f"Passed: {passed_count}")
    print(f"Failed: {len(results) - passed_count}")
    print(f"Success Rate: {passed_count / len(results) * 100:.1f}%")
    print(f"{'='*60}\n")

    return results


async def main():
    """Main test entry point"""
    parser = argparse.ArgumentParser(
        description="Test template validation with live data"
    )
    parser.add_argument(
        "--template",
        type=str,
        help="Template ID to test (e.g., tier_1_club_centralized_procurement)"
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Test all templates (use --limit to control count)"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=5,
        help="Limit number of templates to test (default: 5)"
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress detailed output"
    )

    args = parser.parse_args()

    if args.template:
        # Test single template
        result = await test_single_template(args.template, verbose=not args.quiet)

        # Exit with error code if failed
        sys.exit(0 if result.get("success") else 1)

    elif args.all:
        # Test all templates
        results = await test_all_templates(limit=args.limit)

        # Exit with error code if any failed
        failed = sum(1 for r in results if not r.get("success"))
        sys.exit(0 if failed == 0 else 1)

    else:
        # Default: test first template
        loader = TemplateLoader()
        templates = loader.get_all_templates()

        if not templates:
            logger.error("❌ No templates found")
            sys.exit(1)

        first_template = templates[0]
        logger.info(f"Testing first template: {first_template.template_id}")

        result = await test_single_template(
            first_template.template_id,
            verbose=not args.quiet
        )

        sys.exit(0 if result.get("success") else 1)


if __name__ == "__main__":
    asyncio.run(main())
