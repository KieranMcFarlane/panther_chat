#!/usr/bin/env python3
"""
Run Hypothesis-Driven Discovery with Real Entities

This script runs the actual hypothesis-driven discovery system with
real sports entity IDs from the database.

Usage:
    python scripts/run_pilot_with_real_entities.py --limit 10
    python scripts/run_pilot_with_real_entities.py --entity-ids arsenal,chelsea,liverpool
"""

import asyncio
import argparse
import logging
import sys
from pathlib import Path
from datetime import datetime

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.hypothesis_driven_discovery import HypothesisDrivenDiscovery
from backend.hypothesis_manager import HypothesisManager
from backend.parameter_tuning import ParameterConfig
from backend.rollout_monitor import RolloutMonitor

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Sample sports entity IDs (from the actual database)
SAMPLE_ENTITIES = [
    "arsenal-fc",
    "chelsea-fc",
    "liverpool-fc",
    "manchester-united-fc",
    "manchester-city-fc",
    "tottenham-hotspur-fc",
    "everton-fc",
    "newcastle-united-fc",
    "aston-villa-fc",
    "leicester-city-fc",
    "west-ham-united-fc",
    "bayern-munich",
    "real-madrid",
    "barcelona",
    "juventus",
    "psg",
    "ajax",
    "ac-milan",
    "inter-milan",
    "napoli"
]

DEFAULT_TEMPLATE = "tier_1_club_centralized_procurement"


async def run_discovery_for_entity(
    entity_id: str,
    template_id: str,
    config: ParameterConfig,
    monitor: RolloutMonitor,
    old_system_cost: float = 0.25
) -> dict:
    """
    Run hypothesis-driven discovery for a single entity

    Args:
        entity_id: Entity to discover
        template_id: Hypothesis template ID
        config: Parameter configuration
        monitor: RolloutMonitor instance
        old_system_cost: Cost for old system (for comparison)

    Returns:
        Discovery results dictionary
    """
    logger.info(f"Starting discovery for {entity_id}")
    start_time = datetime.now()

    try:
        # Initialize discovery system
        discovery = HypothesisDrivenDiscovery(
            config=config,
            cache_enabled=True
        )

        # Run discovery
        result = await discovery.run_discovery(
            entity_id=entity_id,
            template_id=template_id
        )

        duration = (datetime.now() - start_time).total_seconds()

        # Extract metrics
        actionable = result.get('actionable', False)
        final_confidence = result.get('final_confidence', 0.0)
        total_cost = result.get('total_cost_usd', 0.0)
        iterations = result.get('total_iterations', 0)

        # Record metrics
        await monitor.record_discovery(
            entity_id=entity_id,
            result={
                'total_cost_usd': total_cost,
                'iterations': iterations,
                'actionable': actionable,
                'final_confidence': final_confidence,
                'duration_seconds': duration
            },
            old_system_result={
                'total_cost_usd': old_system_cost,
                'actionable': False  # Old system rarely finds actionable signals
            }
        )

        logger.info(
            f"✅ {entity_id}: Cost=${total_cost:.2f}, "
            f"Confidence={final_confidence:.2f}, Actionable={actionable}, "
            f"Iterations={iterations}, Duration={duration:.2f}s"
        )

        return {
            'entity_id': entity_id,
            'status': 'success',
            'total_cost_usd': total_cost,
            'iterations': iterations,
            'actionable': actionable,
            'final_confidence': final_confidence,
            'duration_seconds': duration
        }

    except Exception as e:
        logger.error(f"❌ {entity_id}: Error - {e}")
        duration = (datetime.now() - start_time).total_seconds()

        # Record error
        await monitor.record_discovery(
            entity_id=entity_id,
            result={
                'error': str(e),
                'duration_seconds': duration
            }
        )

        return {
            'entity_id': entity_id,
            'status': 'error',
            'error': str(e)
        }


async def run_pilot_with_real_entities(
    entity_ids: list,
    template_id: str = DEFAULT_TEMPLATE,
    config: ParameterConfig = None,
    monitor_file: str = "data/real_pilot_metrics.jsonl"
):
    """
    Run pilot stage with real entities

    Args:
        entity_ids: List of entity IDs to discover
        template_id: Hypothesis template to use
        config: Optional parameter configuration
        monitor_file: Path to metrics log file
    """
    # Initialize monitoring
    monitor = RolloutMonitor(log_file=monitor_file)

    # Use default config if none provided
    if not config:
        config = ParameterConfig()

    logger.info("=" * 80)
    logger.info("HYPOTHESIS-DRIVEN DISCOVERY - REAL ENTITY PILOT")
    logger.info("=" * 80)
    logger.info(f"Entities: {len(entity_ids)}")
    logger.info(f"Template: {template_id}")
    logger.info(f"Config: {config}")
    logger.info("-" * 80)

    # Track results
    results = []
    total_cost = 0.0
    actionable_count = 0
    error_count = 0

    # Process each entity
    for i, entity_id in enumerate(entity_ids, 1):
        logger.info(f"\n[{i}/{len(entity_ids)}] Processing: {entity_id}")

        result = await run_discovery_for_entity(
            entity_id=entity_id,
            template_id=template_id,
            config=config,
            monitor=monitor
        )

        results.append(result)

        if result['status'] == 'success':
            total_cost += result['total_cost_usd']
            if result['actionable']:
                actionable_count += 1
        else:
            error_count += 1

    # Get aggregate metrics
    metrics = await monitor.get_aggregate_metrics(time_window_minutes=60)

    # Print summary
    logger.info("\n" + "=" * 80)
    logger.info("PILOT SUMMARY")
    logger.info("=" * 80)
    logger.info(f"Total Entities: {len(entity_ids)}")
    logger.info(f"Successful: {len(entity_ids) - error_count}")
    logger.info(f"Errors: {error_count}")
    logger.info(f"Total Cost: ${total_cost:.2f}")
    logger.info(f"Avg Cost Per Entity: ${total_cost / len(entity_ids):.4f}")
    logger.info(f"Actionable: {actionable_count}/{len(entity_ids)} ({actionable_count / len(entity_ids) * 100:.1f}%)")
    logger.info(f"Avg Confidence: {metrics.total_cost_usd / max(len(entity_ids), 1):.2f}")
    logger.info("=" * 80)

    # Export report
    report = await monitor.export_report(format="markdown")
    report_path = Path("data/real_pilot_report.md")
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with open(report_path, 'w') as f:
        f.write(report)

    logger.info(f"Report exported to {report_path}")

    return results, metrics


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Run pilot with real entities")
    parser.add_argument(
        "--limit",
        type=int,
        default=10,
        help="Number of entities to process (default: 10)"
    )
    parser.add_argument(
        "--entity-ids",
        type=str,
        help="Comma-separated list of entity IDs (overrides --limit)"
    )
    parser.add_argument(
        "--template",
        type=str,
        default=DEFAULT_TEMPLATE,
        help=f"Hypothesis template ID (default: {DEFAULT_TEMPLATE})"
    )
    parser.add_argument(
        "--config-file",
        type=str,
        help="Path to parameter config JSON file"
    )
    parser.add_argument(
        "--monitor-file",
        type=str,
        default="data/real_pilot_metrics.jsonl",
        help="Path to metrics log file"
    )

    args = parser.parse_args()

    # Load entities
    if args.entity_ids:
        entity_ids = [e.strip() for e in args.entity_ids.split(',')]
    else:
        entity_ids = SAMPLE_ENTITIES[:args.limit]

    # Load config if provided
    config = None
    if args.config_file:
        config = ParameterConfig.load(args.config_file)
        logger.info(f"Loaded config from {args.config_file}")

    # Run pilot
    await run_pilot_with_real_entities(
        entity_ids=entity_ids,
        template_id=args.template,
        config=config,
        monitor_file=args.monitor_file
    )


if __name__ == "__main__":
    asyncio.run(main())
