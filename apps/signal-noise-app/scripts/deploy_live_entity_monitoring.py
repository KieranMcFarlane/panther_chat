#!/usr/bin/env python3
"""
Deploy RFP Detection for Live Entities

Deploys the production-ready RFP detection system to monitor live sports entities
for digital transformation signals and RFP opportunities.

Usage:
    python scripts/deploy_live_entity_monitoring.py --entities 50

Features:
- Template expansion for live entities
- Signal extraction using BrightData SDK
- Multi-source data collection (LinkedIn, official sites, partners)
- Progress tracking and error handling
"""
import asyncio
import sys
import logging
import os
from datetime import datetime
from typing import List, Dict, Any
from pathlib import Path

# Configure logging FIRST
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Verify critical environment variables
if not os.getenv('BRIGHTDATA_API_TOKEN'):
    logger.warning("⚠️ BRIGHTDATA_API_TOKEN not found in environment")

# Check authentication method
anthropic_token = os.getenv('ANTHROPIC_AUTH_TOKEN') or os.getenv('ANTHROPIC_API_KEY')
if not anthropic_token:
    logger.warning("⚠️ ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN not found in environment")
else:
    masked_token = f"{anthropic_token[:8]}...{anthropic_token[-4:]}" if len(anthropic_token) > 12 else "***"
    logger.info(f"✅ Anthropic token loaded: {masked_token}")

brightdata_token = os.getenv('BRIGHTDATA_API_TOKEN')
if brightdata_token:
    masked_token = f"{brightdata_token[:8]}...{brightdata_token[-4:]}" if len(brightdata_token) > 12 else "***"
    logger.info(f"✅ BrightData token loaded: {masked_token}")

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.template_expansion_agent import TemplateExpansionAgent
from backend.template_loader import TemplateLoader
from backend.brightdata_sdk_client import BrightDataSDKClient


# Target entities for deployment (top-tier clubs across major leagues)
TARGET_ENTITIES = [
    # Premier League
    "Arsenal FC",
    "Chelsea FC",
    "Manchester United",
    "Manchester City",
    "Liverpool FC",
    "Tottenham Hotspur",
    "Newcastle United",
    "Aston Villa",

    # La Liga
    "Real Madrid CF",
    "FC Barcelona",
    "Atlético Madrid",
    "Sevilla FC",
    "Real Betis",

    # Bundesliga
    "FC Bayern Munich",
    "Borussia Dortmund",
    "RB Leipzig",
    "Bayer Leverkusen",

    # Serie A
    "Juventus FC",
    "AC Milan",
    "Inter Milan",
    "SSC Napoli",

    # Ligue 1
    "Paris Saint-Germain",
    "AS Monaco",
    "Olympique Marseille",

    # Additional top clubs
    "Ajax Amsterdam",
    "FC Porto",
    "SL Benfica",
    "Sporting CP",
]


async def deploy_live_monitoring(
    entities: List[str],
    max_signals_per_entity: int = 20,
    filter_digital_transformation: bool = True
) -> List[Dict[str, Any]]:
    """
    Deploy RFP detection monitoring for live entities

    Args:
        entities: List of entity names to monitor
        max_signals_per_entity: Maximum signals to collect per entity
        filter_digital_transformation: Only use digital transformation templates

    Returns:
        List of deployment results with metrics
    """
    logger.info(f"🚀 Deploying live RFP detection for {len(entities)} entities")

    # Initialize Claude client
    from backend.claude_client import ClaudeClient

    claude_client = ClaudeClient()

    # Initialize components
    agent = TemplateExpansionAgent(claude_client=claude_client)
    loader = TemplateLoader()

    # Get applicable templates
    all_templates = loader.get_all_templates()

    if filter_digital_transformation:
        # Filter for digital transformation and procurement templates
        dt_templates = [
            t for t in all_templates
            if any(keyword in t.template_name.lower()
                   for keyword in ["digital", "procurement", "crm", "transformation", "centralized"])
        ]
        logger.info(f"📋 Using {len(dt_templates)} digital transformation templates")
    else:
        dt_templates = all_templates
        logger.info(f"📋 Using all {len(dt_templates)} templates")

    results = []
    successful_deployments = 0
    failed_deployments = 0

    # Process each entity
    for idx, entity in enumerate(entities, 1):
        logger.info(f"\n{'='*60}")
        logger.info(f"Processing {idx}/{len(entities)}: {entity}")
        logger.info(f"{'='*60}")

        entity_results = []

        for template in dt_templates:
            try:
                logger.info(f"  🔍 Expanding template: {template.template_name}")

                # Expand template for entity
                expanded = await agent.expand_template_for_entity(
                    template_id=template.template_id,
                    entity_name=entity,
                    max_signals=max_signals_per_entity
                )

                # Collect results
                result = {
                    'entity': entity,
                    'template': template.template_name,
                    'template_id': template.template_id,
                    'signals_detected': len(expanded.signal_examples),
                    'channels_discovered': len(expanded.live_urls),
                    'confidence_boost': expanded.expansion_metadata.get('confidence_boost', 0.0),
                    'status': 'success'
                }

                entity_results.append(result)

                logger.info(f"    ✅ {len(expanded.signal_examples)} signals detected")
                logger.info(f"    📡 {len(expanded.live_urls)} channels discovered")
                logger.info(f"    📈 Confidence boost: +{result['confidence_boost']:.2f}")

            except Exception as e:
                logger.error(f"    ❌ Template expansion failed: {e}")

                result = {
                    'entity': entity,
                    'template': template.template_name,
                    'template_id': template.template_id,
                    'signals_detected': 0,
                    'channels_discovered': 0,
                    'confidence_boost': 0.0,
                    'status': 'error',
                    'error': str(e)
                }

                entity_results.append(result)

        # Aggregate entity metrics
        total_signals = sum(r['signals_detected'] for r in entity_results)
        total_channels = sum(r['channels_discovered'] for r in entity_results)
        successful_templates = len([r for r in entity_results if r['status'] == 'success'])

        entity_summary = {
            'entity': entity,
            'templates_processed': len(entity_results),
            'successful_templates': successful_templates,
            'total_signals': total_signals,
            'total_channels': total_channels,
            'avg_confidence_boost': sum(r['confidence_boost'] for r in entity_results) / len(entity_results) if entity_results else 0.0,
            'results': entity_results
        }

        results.append(entity_summary)

        if successful_templates > 0:
            successful_deployments += 1
            logger.info(f"  📊 Entity Summary: {total_signals} signals, {total_channels} channels")
        else:
            failed_deployments += 1
            logger.warning(f"  ⚠️ All template expansions failed for {entity}")

    # Print deployment summary
    print_deployment_summary(results, successful_deployments, failed_deployments)

    return results


def print_deployment_summary(
    results: List[Dict[str, Any]],
    successful: int,
    failed: int
) -> None:
    """Print deployment summary statistics"""
    total_entities = len(results)
    total_signals = sum(r['total_signals'] for r in results)
    total_channels = sum(r['total_channels'] for r in results)

    print("\n" + "="*60)
    print("🎯 DEPLOYMENT SUMMARY")
    print("="*60)
    print(f"Total Entities: {total_entities}")
    print(f"Successful: {successful} ({successful/total_entities*100:.1f}%)")
    print(f"Failed: {failed} ({failed/total_entities*100:.1f}%)")
    print(f"\nTotal Signals Detected: {total_signals}")
    print(f"Total Channels Discovered: {total_channels}")
    print(f"Avg Signals per Entity: {total_signals/total_entities:.1f}" if total_entities > 0 else "")
    print(f"Avg Channels per Entity: {total_channels/total_entities:.1f}" if total_entities > 0 else "")

    # Top performing entities
    top_entities = sorted(results, key=lambda x: x['total_signals'], reverse=True)[:5]
    print(f"\n🏆 Top Performing Entities:")
    for i, entity in enumerate(top_entities, 1):
        print(f"  {i}. {entity['entity']}: {entity['total_signals']} signals")

    print("="*60)


async def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description="Deploy live RFP detection monitoring")
    parser.add_argument(
        '--entities',
        type=int,
        default=10,
        help='Number of entities to monitor (default: 10, max: 50)'
    )
    parser.add_argument(
        '--max-signals',
        type=int,
        default=20,
        help='Maximum signals per entity (default: 20)'
    )
    parser.add_argument(
        '--all-templates',
        action='store_true',
        help='Use all templates (not just digital transformation)'
    )

    args = parser.parse_args()

    # Limit to max entities
    num_entities = min(args.entities, len(TARGET_ENTITIES))
    entities = TARGET_ENTITIES[:num_entities]

    logger.info(f"🎯 Starting deployment for {num_entities} entities")
    logger.info(f"⏰ Started at: {datetime.now().isoformat()}")

    # Deploy monitoring
    results = await deploy_live_monitoring(
        entities=entities,
        max_signals_per_entity=args.max_signals,
        filter_digital_transformation=not args.all_templates
    )

    logger.info(f"✅ Deployment completed at: {datetime.now().isoformat()}")

    # Save results to file
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_file = Path(__file__).parent.parent / 'data' / f'deployment_results_{timestamp}.json'

    output_file.parent.mkdir(exist_ok=True)

    import json
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2, default=str)

    logger.info(f"💾 Results saved to: {output_file}")


if __name__ == "__main__":
    asyncio.run(main())
