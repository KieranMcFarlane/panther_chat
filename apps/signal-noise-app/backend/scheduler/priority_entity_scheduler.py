#!/usr/bin/env python3
"""
Priority Entity Scheduler

Assigns entities to tiers (Premium/Active/Dormant) and generates
ordered list for daily processing.

Key Principle: ALL entities processed daily
Priority determines ORDER and RESOURCE ALLOCATION, not frequency

Usage:
    python -m backend.scheduler.priority_entity_scheduler --mode=daily --output=entities.json
    python -m backend.scheduler.priority_entity_scheduler --mode=assign --output=tiers.json
"""
import asyncio
import json
import logging
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Dict, Optional
import yaml

from backend.graphiti_service import GraphitiService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PriorityEntityScheduler:
    """
    Priority-based entity scheduler for daily processing

    Tiers:
    - Premium (10%): Processed FIRST + most resources + webhooks
    - Active (30%): Processed NEXT + standard resources + some webhooks
    - Dormant (60%): Processed LAST + minimal resources + scraping only

    Tier Assignment Criteria:
    - Signal frequency (signals per month)
    - RFP density (RFP signals / total signals)
    - Manual tier assignments (admin override)
    """

    def __init__(self, graphiti_service: GraphitiService, tier_config: Dict):
        """
        Initialize priority entity scheduler

        Args:
            graphiti_service: GraphitiService instance
            tier_config: Tier configuration dict from tiers.yaml
        """
        self.graphiti = graphiti_service
        self.tier_config = tier_config
        self.tiers = {
            'premium': [],
            'active': [],
            'dormant': []
        }

    async def load_tiers_from_graphiti(self):
        """
        Load tier assignments from Graphiti

        Reads entity metadata to determine tier assignments
        """
        logger.info("Loading tier assignments from Graphiti...")

        # Get all entities
        entities = await self.graphiti.get_all_entities()

        for entity in entities:
            # Get tier from metadata (default to dormant if not set)
            tier = entity.metadata.get('tier', 'dormant')

            if tier in self.tiers:
                self.tiers[tier].append(entity.entity_id)
            else:
                logger.warning(f"Unknown tier '{tier}' for entity {entity.entity_id}, defaulting to dormant")
                self.tiers['dormant'].append(entity.entity_id)

        logger.info(f"✅ Loaded {len(self.tiers['premium'])} Premium, "
                   f"{len(self.tiers['active'])} Active, "
                   f"{len(self.tiers['dormant'])} Dormant entities")

    async def assign_tiers(self, entities: List[str]) -> Dict[str, List[str]]:
        """
        Assign entities to tiers based on signal frequency and RFP density

        Criteria:
        - Premium: >10 signals/month AND >30% RFP density
        - Active: >2 signals/month
        - Dormant: Everything else

        Args:
            entities: List of entity IDs

        Returns:
            Dict with tier assignments {'premium': [...], 'active': [...], 'dormant': [...]}
        """
        tier_assignments = {
            'premium': [],
            'active': [],
            'dormant': []
        }

        logger.info(f"Assigning tiers to {len(entities)} entities...")

        for entity_id in entities:
            try:
                # Get entity signals from last 30 days
                signals = await self.graphiti.get_entity_signals(
                    entity_id=entity_id,
                    time_horizon_days=30
                )

                # Calculate metrics
                signal_frequency = len(signals) / 30  # signals per day

                rfp_signals = [s for s in signals if s.type.value == 'RFP_DETECTED']
                rfp_density = len(rfp_signals) / max(len(signals), 1)

                # Determine tier based on configuration
                premium_config = self.tier_config.get('premium', {}).get('criteria', {})
                active_config = self.tier_config.get('active', {}).get('criteria', {})

                min_premium_freq = premium_config.get('min_signal_frequency', 0.33)
                min_premium_rfp = premium_config.get('min_rfp_density', 0.3)
                min_active_freq = active_config.get('min_signal_frequency', 0.07)

                if signal_frequency > min_premium_freq and rfp_density > min_premium_rfp:
                    tier = 'premium'
                elif signal_frequency > min_active_freq:
                    tier = 'active'
                else:
                    tier = 'dormant'

                tier_assignments[tier].append(entity_id)

                # Update entity metadata in Graphiti
                entity = await self.graphiti.get_entity(entity_id)
                if entity:
                    entity.metadata['tier'] = tier
                    entity.metadata['signal_frequency'] = signal_frequency
                    entity.metadata['rfp_density'] = rfp_density
                    entity.metadata['tier_assigned_at'] = datetime.now(timezone.utc).isoformat()
                    await self.graphiti.update_entity(entity)

            except Exception as e:
                logger.error(f"Error assigning tier for {entity_id}: {e}")
                # Default to dormant on error
                tier_assignments['dormant'].append(entity_id)

        return tier_assignments

    def get_daily_processing_order(self) -> List[str]:
        """
        Return ALL entities in priority order for daily processing

        NO entity is skipped - priority determines ORDER, not FREQUENCY

        Returns:
            List of entity IDs in priority order (Premium → Active → Dormant)
        """
        entities = []
        entities.extend(self.tiers['premium'])   # First (00:00-01:00)
        entities.extend(self.tiers['active'])    # Next (01:00-04:00)
        entities.extend(self.tiers['dormant'])    # Last (04:00-06:00)

        return entities  # All entities, every day

    def get_resource_allocation(self, entity_id: str) -> Dict:
        """
        Return resource allocation based on entity tier

        Higher priority = more workers, faster processing

        Args:
            entity_id: Entity identifier

        Returns:
            Dict with resource allocation (workers, priority, timeout, model)
        """
        if entity_id in self.tiers['premium']:
            return self.tier_config.get('premium', {}).get('resource_allocation', {
                'tier': 'premium',
                'workers': 10,
                'priority': 'high',
                'timeout': 300,
                'model': 'haiku'
            })
        elif entity_id in self.tiers['active']:
            return self.tier_config.get('active', {}).get('resource_allocation', {
                'tier': 'active',
                'workers': 5,
                'priority': 'standard',
                'timeout': 600,
                'model': 'haiku'
            })
        else:  # dormant
            return self.tier_config.get('dormant', {}).get('resource_allocation', {
                'tier': 'dormant',
                'workers': 2,
                'priority': 'low',
                'timeout': 900,
                'model': 'haiku'
            })

    def get_tier_statistics(self) -> Dict:
        """
        Get statistics about tier distribution

        Returns:
            Dict with tier counts and percentages
        """
        total = len(self.tiers['premium']) + len(self.tiers['active']) + len(self.tiers['dormant'])

        return {
            'total_entities': total,
            'premium': {
                'count': len(self.tiers['premium']),
                'percentage': len(self.tiers['premium']) / total * 100 if total > 0 else 0
            },
            'active': {
                'count': len(self.tiers['active']),
                'percentage': len(self.tiers['active']) / total * 100 if total > 0 else 0
            },
            'dormant': {
                'count': len(self.tiers['dormant']),
                'percentage': len(self.tiers['dormant']) / total * 100 if total > 0 else 0
            }
        }


async def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description="Priority Entity Scheduler")
    parser.add_argument('--mode', required=True, choices=['daily', 'assign'],
                       help='Operation mode: daily (load existing tiers) or assign (calculate new tiers)')
    parser.add_argument('--output', required=True, help="Output JSON file path")
    parser.add_argument('--config', default='config/tiers.yaml', help="Tier configuration file")
    args = parser.parse_args()

    # Load tier configuration
    config_path = Path(args.config)
    if not config_path.exists():
        logger.warning(f"Tier config not found at {config_path}, using defaults")
        tier_config = {}
    else:
        with open(config_path) as f:
            tier_config = yaml.safe_load(f)

    # Initialize Graphiti service
    graphiti = GraphitiService()
    await graphiti.initialize()

    try:
        # Initialize scheduler
        scheduler = PriorityEntityScheduler(graphiti, tier_config)

        if args.mode == 'daily':
            # Load existing tiers from Graphiti
            await scheduler.load_tiers_from_graphiti()

            # Get all entities in priority order
            entities = scheduler.get_daily_processing_order()

            # Get tier statistics
            stats = scheduler.get_tier_statistics()

            logger.info(f"✅ Total entities: {stats['total_entities']}")
            logger.info(f"   Premium: {stats['premium']['count']} ({stats['premium']['percentage']:.1f}%)")
            logger.info(f"   Active: {stats['active']['count']} ({stats['active']['percentage']:.1f}%)")
            logger.info(f"   Dormant: {stats['dormant']['count']} ({stats['dormant']['percentage']:.1f}%)")

            # Prepare output data
            output_data = {
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'total_entities': stats['total_entities'],
                'tiers': {
                    'premium': scheduler.tiers['premium'],
                    'active': scheduler.tiers['active'],
                    'dormant': scheduler.tiers['dormant']
                },
                'statistics': stats
            }

            # Write to JSON
            output_path = Path(args.output)
            output_path.parent.mkdir(parents=True, exist_ok=True)

            with open(output_path, 'w') as f:
                json.dump(output_data, f, indent=2, default=str)

            logger.info(f"✅ Entity list written to: {output_path}")

        elif args.mode == 'assign':
            # Get all entities from Graphiti
            entities = await graphiti.get_all_entities()
            entity_ids = [e.entity_id for e in entities]

            logger.info(f"Assigning tiers to {len(entity_ids)} entities...")

            # Assign tiers
            tier_assignments = await scheduler.assign_tiers(entity_ids)

            logger.info(f"✅ Tier assignment complete:")
            logger.info(f"   Premium: {len(tier_assignments['premium'])}")
            logger.info(f"   Active: {len(tier_assignments['active'])}")
            logger.info(f"   Dormant: {len(tier_assignments['dormant'])}")

            # Prepare output data
            output_data = {
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'tier_assignments': tier_assignments
            }

            # Write to JSON
            output_path = Path(args.output)
            output_path.parent.mkdir(parents=True, exist_ok=True)

            with open(output_path, 'w') as f:
                json.dump(output_data, f, indent=2, default=str)

            logger.info(f"✅ Tier assignments written to: {output_path}")

    finally:
        # Close Graphiti connection
        graphiti.close()


if __name__ == '__main__':
    asyncio.run(main())
