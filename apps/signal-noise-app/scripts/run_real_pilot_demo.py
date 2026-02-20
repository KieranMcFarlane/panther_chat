#!/usr/bin/env python3
"""
Run Hypothesis-Driven Discovery with Real Entities - DEMO

This demonstrates the complete discovery system with real entity IDs.
Uses mock clients for demonstration purposes.

Usage:
    python scripts/run_real_pilot_demo.py --limit 5
    python scripts/run_real_pilot_demo.py --entity-ids arsenal,chelsea,liverpool
"""

import asyncio
import argparse
import logging
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.hypothesis_manager import HypothesisManager, Hypothesis
from backend.hypothesis_persistence_native import HypothesisRepository
from backend.eig_calculator import EIGCalculator, EIGConfig
from backend.parameter_tuning import ParameterConfig
from backend.rollout_monitor import RolloutMonitor

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Real sports entity IDs
SAMPLE_ENTITIES = [
    "arsenal-fc",
    "chelsea-fc",
    "liverpool-fc",
    "manchester-united-fc",
    "manchester-city-fc",
    "bayern-munich",
    "real-madrid",
    "barcelona",
    "juventus",
    "psg"
]


class MockDiscoveryEngine:
    """
    Mock discovery engine that simulates realistic hypothesis-driven discovery

    This simulates the behavior of HypothesisDrivenDiscovery with realistic
    costs, iterations, and confidence scores based on entity characteristics.
    """

    def __init__(self, config: ParameterConfig = None):
        self.config = config or ParameterConfig()

    async def discover(self, entity_id: str, template_id: str = None) -> Dict:
        """
        Run discovery for an entity

        Simulates realistic discovery behavior:
        - Tier-1 clubs: Higher confidence, actionable
        - Mid-tier clubs: Medium confidence
        - Smaller clubs: Lower confidence
        """
        import random

        # Determine entity tier based on ID
        tier_1 = ["arsenal", "chelsea", "liverpool", "manchester-united", "manchester-city",
                  "real-madrid", "barcelona", "bayern", "juventus", "psg"]

        is_tier_1 = any(tier in entity_id.lower() for tier in tier_1)

        # Simulate discovery iterations
        if is_tier_1:
            # Tier-1 clubs: Strong signals, fast convergence
            iterations = random.randint(3, 7)
            base_confidence = random.uniform(0.70, 0.90)
            actionable_prob = 0.85
        else:
            # Other clubs: Weaker signals, more iterations
            iterations = random.randint(5, 12)
            base_confidence = random.uniform(0.40, 0.70)
            actionable_prob = 0.40

        # Apply EIG-based stopping
        if base_confidence >= 0.75:
            actionable = True
            final_confidence = min(base_confidence + random.uniform(0.05, 0.15), 0.95)
        elif base_confidence >= 0.50:
            actionable = random.random() < actionable_prob
            final_confidence = base_confidence
        else:
            actionable = False
            final_confidence = base_confidence

        # Calculate cost (API calls, Claude processing, etc.)
        cost_per_iteration = 0.03  # Typical cost
        total_cost = iterations * cost_per_iteration

        # Simulate processing time
        duration_seconds = iterations * 0.15  # ~150ms per iteration

        await asyncio.sleep(duration_seconds * 0.1)  # Faster for demo

        return {
            'entity_id': entity_id,
            'iterations': iterations,
            'total_cost_usd': total_cost,
            'actionable': actionable,
            'final_confidence': final_confidence,
            'duration_seconds': duration_seconds,
            'template_id': template_id
        }


async def run_discovery_for_entity(
    entity_id: str,
    engine,
    monitor: RolloutMonitor,
    old_system_cost: float = 0.25,
    old_system_actionable: bool = False
) -> dict:
    """Run discovery for a single entity"""
    logger.info(f"Starting discovery for {entity_id}")
    start_time = datetime.now()

    try:
        # Run discovery
        result = await engine.discover(entity_id, template_id="tier_1_club_centralized_procurement")

        # Record metrics with comparison to old system
        await monitor.record_discovery(
            entity_id=entity_id,
            result=result,
            old_system_result={
                'total_cost_usd': old_system_cost,
                'actionable': old_system_actionable
            }
        )

        actionable_str = "✅ ACTIONABLE" if result['actionable'] else "❌ Not Actionable"
        logger.info(
            f"✅ {entity_id}: "
            f"Cost=${result['total_cost_usd']:.2f}, "
            f"Confidence={result['final_confidence']:.2f}, "
            f"Iterations={result['iterations']}, "
            f"{actionable_str}"
        )

        return {
            'entity_id': entity_id,
            'status': 'success',
            **result
        }

    except Exception as e:
        logger.error(f"❌ {entity_id}: Error - {e}")
        duration = (datetime.now() - start_time).total_seconds()

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


async def run_real_pilot(
    entity_ids: List[str],
    config: ParameterConfig = None,
    monitor_file: str = "data/real_pilot_metrics.jsonl"
):
    """Run pilot with real entities using discovery engine"""

    # Initialize
    engine = MockDiscoveryEngine(config)
    monitor = RolloutMonitor(log_file=monitor_file)

    logger.info("=" * 80)
    logger.info("HYPOTHESIS-DRIVEN DISCOVERY - REAL ENTITY PILOT")
    logger.info("=" * 80)
    logger.info(f"Entities: {len(entity_ids)}")
    logger.info(f"Config: {config}")
    logger.info("-" * 80)

    results = []
    total_cost = 0.0
    actionable_count = 0
    error_count = 0

    # Process each entity
    for i, entity_id in enumerate(entity_ids, 1):
        logger.info(f"\n[{i}/{len(entity_ids)}] Processing: {entity_id}")

        result = await run_discovery_for_entity(
            entity_id=entity_id,
            engine=engine,
            monitor=monitor
        )

        results.append(result)

        if result['status'] == 'success':
            total_cost += result['total_cost_usd']
            if result['actionable']:
                actionable_count += 1
        else:
            error_count += 1

    # Get metrics
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
    logger.info(f"Avg Iterations: {sum(r.get('iterations', 0) for r in results) / len(results):.1f}")

    # Calculate comparison vs old system
    old_total_cost = len(entity_ids) * 0.25
    cost_reduction = ((old_total_cost - total_cost) / old_total_cost) * 100
    logger.info(f"Cost Reduction vs Old: {cost_reduction:+.1f}%")
    logger.info("=" * 80)

    # Export report
    report = await monitor.export_report(format="markdown")
    report_path = Path("data/real_pilot_report.md")
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
        help="Comma-separated entity IDs (overrides --limit)"
    )
    parser.add_argument(
        "--monitor-file",
        type=str,
        default="data/real_pilot_metrics.jsonl",
        help="Metrics log file"
    )

    args = parser.parse_args()

    # Get entities
    if args.entity_ids:
        entity_ids = [e.strip() for e in args.entity_ids.split(',')]
    else:
        entity_ids = SAMPLE_ENTITIES[:args.limit]

    # Run pilot
    await run_real_pilot(
        entity_ids=entity_ids,
        monitor_file=args.monitor_file
    )


if __name__ == "__main__":
    asyncio.run(main())
