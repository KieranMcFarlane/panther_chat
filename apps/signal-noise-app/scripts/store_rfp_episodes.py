#!/usr/bin/env python3
"""
Store Validated RFPs as Temporal Episodes

Stores validated RFP detections as temporal episodes in Graphiti for:
- Timeline tracking and historical analysis
- Predictive fit scoring
- Pattern recognition and trend analysis
- Feedback loop closure (outcome tracking)

Usage:
    python scripts/store_rfp_episodes.py --input validation_results_20260129_120000.json

Features:
- Fixed schema (Entity, Signal, Evidence nodes)
- Temporal episode tracking with metadata
- Confidence scoring and outcome tracking
- Integration with temporal intelligence MCP tools
"""
import asyncio
import sys
import logging
import json
from datetime import datetime, timezone
from typing import List, Dict, Any
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.graphiti_service import GraphitiService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def store_rfp_episodes(
    validation_results: Dict[str, Any],
    simulate: bool = False
) -> Dict[str, Any]:
    """
    Store validated RFPs as temporal episodes in Graphiti

    Args:
        validation_results: Results from validate_live_signals.py
        simulate: If True, simulate storage without writing to Graphiti

    Returns:
        Storage summary with episode IDs and metrics
    """
    logger.info(f"💾 Storing validated RFPs as temporal episodes")
    if simulate:
        logger.info(f"🧪 SIMULATION MODE - No actual writes to Graphiti")

    # Initialize Graphiti service
    graphiti = GraphitiService()
    await graphiti.initialize()

    storage_summary = {
        'total_entities': len(validation_results.get('entities', {})),
        'total_episodes_created': 0,
        'entities': {}
    }

    # Process each entity's validated signals
    for entity_id, entity_data in validation_results.get('entities', {}).items():
        entity_name = entity_data['entity_name']
        validated_count = entity_data['validated']

        logger.info(f"\n{'='*60}")
        logger.info(f"Processing {entity_name}: {validated_count} validated signals")
        logger.info(f"{'='*60}")

        entity_episodes = []

        # Store each validated signal as an episode
        for cascade_result in entity_data.get('cascade_results', []):
            if not cascade_result.get('validated'):
                continue

            # Create episode data
            episode_data = {
                'rfp_id': cascade_result['signal_id'],
                'organization': entity_name,
                'entity_type': 'Club',  # TODO: Detect from entity data
                'detected_at': datetime.now(timezone.utc).isoformat(),
                'title': f"{entity_name} RFP Detection",
                'description': f"RFP signal detected via {cascade_result.get('model', 'unknown')} validation",
                'category': 'Digital Transformation',  # TODO: Extract from template
                'estimated_value': None,  # TODO: Estimate from historical data
                'confidence_score': cascade_result.get('confidence_adjustment', 0.7),
                'source': 'LinkedIn',  # TODO: Extract from evidence
                'validation_model': cascade_result.get('model', 'unknown'),
                'validation_cost_usd': cascade_result.get('cost', 0.0),
                'metadata': {
                    'template_id': entity_data.get('template_id', 'unknown'),
                    'evidence_count': 2,  # TODO: Extract from signal
                    'verified': True
                }
            }

            if simulate:
                # Simulate episode creation
                episode_id = f"sim-{episode_data['rfp_id']}"
                logger.info(f"  🧪 [SIMULATED] Episode: {episode_id}")
            else:
                # Actually store in Graphiti
                try:
                    result = await graphiti.add_rfp_episode(episode_data)
                    episode_id = result.get('episode_id', episode_data['rfp_id'])
                    logger.info(f"  ✅ Episode: {episode_id}")
                except Exception as e:
                    logger.error(f"  ❌ Failed to store episode: {e}")
                    episode_id = None

            if episode_id:
                entity_episodes.append({
                    'episode_id': episode_id,
                    'rfp_id': episode_data['rfp_id'],
                    'confidence': episode_data['confidence_score'],
                    'category': episode_data['category']
                })

        storage_summary['entities'][entity_id] = {
            'entity_name': entity_name,
            'episodes_created': len(entity_episodes),
            'episodes': entity_episodes
        }

        storage_summary['total_episodes_created'] += len(entity_episodes)

        logger.info(f"  📊 Created {len(entity_episodes)} episodes for {entity_name}")

    # Print summary
    print_storage_summary(storage_summary)

    graphiti.close()

    return storage_summary


def print_storage_summary(storage_summary: Dict[str, Any]) -> None:
    """Print storage summary statistics"""
    print("\n" + "="*60)
    print("💾 EPISODE STORAGE SUMMARY")
    print("="*60)
    print(f"Total Entities: {storage_summary['total_entities']}")
    print(f"Total Episodes Created: {storage_summary['total_episodes_created']}")

    if storage_summary['total_entities'] > 0:
        avg_episodes = storage_summary['total_episodes_created'] / storage_summary['total_entities']
        print(f"Avg Episodes per Entity: {avg_episodes:.1f}")

    # Top entities by episode count
    entity_counts = [
        (entity_id, data['episodes_created'])
        for entity_id, data in storage_summary['entities'].items()
    ]
    entity_counts.sort(key=lambda x: x[1], reverse=True)

    print(f"\n🏆 Top Entities by Episode Count:")
    for i, (entity_id, count) in enumerate(entity_counts[:5], 1):
        entity_name = storage_summary['entities'][entity_id]['entity_name']
        print(f"  {i}. {entity_name}: {count} episodes")

    print("="*60)


async def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description="Store validated RFPs as temporal episodes")
    parser.add_argument(
        '--input',
        type=str,
        required=True,
        help='Path to validation results JSON file'
    )
    parser.add_argument(
        '--simulate',
        action='store_true',
        help='Simulate storage without writing to Graphiti'
    )

    args = parser.parse_args()

    # Load validation results
    input_file = Path(args.input)

    if not input_file.exists():
        logger.error(f"❌ Input file not found: {input_file}")
        sys.exit(1)

    with open(input_file, 'r') as f:
        validation_results = json.load(f)

    logger.info(f"📂 Loaded validation results from: {input_file}")
    logger.info(f"⏰ Started storage at: {datetime.now().isoformat()}")

    # Store episodes
    storage_summary = await store_rfp_episodes(
        validation_results=validation_results,
        simulate=args.simulate
    )

    logger.info(f"✅ Storage completed at: {datetime.now().isoformat()}")

    # Save results to file
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_file = Path(__file__).parent.parent / 'data' / f'storage_results_{timestamp}.json'

    output_file.parent.mkdir(exist_ok=True)

    with open(output_file, 'w') as f:
        json.dump(storage_summary, f, indent=2, default=str)

    logger.info(f"💾 Results saved to: {output_file}")


if __name__ == "__main__":
    asyncio.run(main())
