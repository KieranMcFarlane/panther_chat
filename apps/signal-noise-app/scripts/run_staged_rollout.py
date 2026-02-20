#!/usr/bin/env python3
"""
Run Staged Rollout Script

Executes the staged production rollout of the hypothesis-driven
discovery system with monitoring and validation.

Usage:
    python scripts/run_staged_rollout.py --stage pilot --dry-run
    python scripts/run_staged_rollout.py --stage limited --entities 100
    python scripts/run_staged_rollout.py --stage production --resume
"""

import asyncio
import argparse
import logging
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.staged_rollout import StagedRollout, run_full_rollout
from backend.rollout_monitor import RolloutMonitor, print_metrics_summary
from backend.hypothesis_driven_discovery import HypothesisDrivenDiscovery
from backend.parameter_tuning import ParameterConfig

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def mock_new_system(entity_id: str, config: ParameterConfig = None) -> dict:
    """
    Mock new discovery system for testing.

    In production, this would be the actual HypothesisDrivenDiscovery.
    """
    # Simulate discovery
    await asyncio.sleep(0.1)  # Simulate processing time

    # Mock results
    return {
        "entity_id": entity_id,
        "total_cost_usd": 0.15,
        "iterations": 5,
        "actionable": True,
        "final_confidence": 0.85,
        "duration_seconds": 0.1
    }


async def mock_old_system(entity_id: str) -> dict:
    """
    Mock old discovery system for comparison.

    In production, this would be the legacy discovery system.
    """
    # Simulate old system (higher cost, lower actionable rate)
    await asyncio.sleep(0.2)

    return {
        "entity_id": entity_id,
        "total_cost_usd": 0.25,
        "iterations": 8,
        "actionable": False,
        "final_confidence": 0.65,
        "duration_seconds": 0.2
    }


async def load_entity_ids(limit: int = None) -> list:
    """
    Load entity IDs for rollout.

    Args:
        limit: Optional limit on number of entities

    Returns:
        List of entity IDs
    """
    # In production, this would load from database
    # For now, return mock entities
    if limit:
        return [f"entity_{i:04d}" for i in range(limit)]
    return [f"entity_{i:04d}" for i in range(3400)]


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Run staged rollout")
    parser.add_argument(
        "--stage",
        choices=["pilot", "limited", "production", "all"],
        default="all",
        help="Rollout stage to run"
    )
    parser.add_argument(
        "--entities",
        type=int,
        help="Number of entities to process (overrides stage default)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run without making actual changes"
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Resume from checkpoint"
    )
    parser.add_argument(
        "--checkpoint-file",
        type=str,
        default="data/rollout_checkpoint.json",
        help="Path to checkpoint file"
    )
    parser.add_argument(
        "--monitor-file",
        type=str,
        default="data/rollout_metrics.jsonl",
        help="Path to metrics log file"
    )
    parser.add_argument(
        "--config-file",
        type=str,
        default=None,
        help="Path to parameter config JSON file"
    )

    args = parser.parse_args()

    # Load parameter config if provided
    config = None
    if args.config_file:
        config = ParameterConfig.load(args.config_file)
        logger.info(f"Loaded config from {args.config_file}")

    # Initialize monitor
    monitor = RolloutMonitor(log_file=args.monitor_file)

    # Initialize staged rollout
    rollout = StagedRollout(
        new_system_fn=lambda e: mock_new_system(e, config),
        old_system_fn=mock_old_system,
        checkpoint_file=args.checkpoint_file
    )

    # Load checkpoint if resuming
    start_stage = 1
    if args.resume:
        checkpoint = rollout.load_checkpoint()
        if checkpoint:
            start_stage = checkpoint.current_stage + 1
            logger.info(f"Resuming from stage {start_stage}")

    # Determine stage to run
    stage_map = {
        "pilot": 1,
        "limited": 2,
        "production": 3,
        "all": 1
    }
    start_stage = max(start_stage, stage_map[args.stage])

    # Load entities
    if args.stage == "all":
        entity_limit = None  # Use all entities
    elif args.stage == "pilot":
        entity_limit = args.entities or 10
    elif args.stage == "limited":
        entity_limit = args.entities or 100
    else:  # production
        entity_limit = args.entities or 3400

    entity_ids = await load_entity_ids(limit=entity_limit)

    logger.info(f"Starting rollout with {len(entity_ids)} entities")

    if args.dry_run:
        logger.info("DRY RUN MODE - No actual changes will be made")

        # Dry run: process first 5 entities only
        entity_ids = entity_ids[:5]
        logger.info(f"Dry run: processing {len(entity_ids)} entities")

    # Run rollout
    try:
        results = await run_full_rollout(
            rollout=rollout,
            entity_ids=entity_ids,
            start_stage=start_stage
        )

        # Print summary
        logger.info("\n=== Rollout Summary ===")
        for result in results:
            logger.info(
                f"Stage {result.stage_num}: {result.status} - "
                f"{result.entities_processed} entities, "
                f"${result.total_cost_usd:.2f}, "
                f"{result.actionable_count} actionable"
            )

        # Print metrics
        await print_metrics_summary(monitor)

        # Export report
        report = await monitor.export_report(format="markdown")
        report_path = Path("data/rollout_report.md")
        report_path.parent.mkdir(parents=True, exist_ok=True)
        with open(report_path, 'w') as f:
            f.write(report)
        logger.info(f"Report exported to {report_path}")

    except KeyboardInterrupt:
        logger.warning("\nRollout interrupted by user")
        logger.info(f"Checkpoint saved to {args.checkpoint_file}")
        logger.info("Resume with --resume flag")

    except Exception as e:
        logger.error(f"Rollout failed: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())
