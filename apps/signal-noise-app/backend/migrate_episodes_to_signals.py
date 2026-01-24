#!/usr/bin/env python3
"""
Episode to Signal Migration Script

Migrates existing Episode-based temporal system to new Entity/Signal/Evidence schema.

Migration mapping:
- Episode.episode_type → Signal.type
- Episode.organization → Entity.id
- Episode.source → Evidence.source
- Episode.date → Evidence.date
- Episode.confidence_score → Signal.confidence
- Episode.metadata → Signal.metadata

Prerequisites:
1. Run backup_graphiti_data.py to create backup
2. Verify backup exists in backups/ directory
3. Ensure FALKORDB_URI and SUPABASE_URL are set

Usage:
    python backend/migrate_episodes_to_signals.py [--dry-run] [--verify]

Options:
    --dry-run: Print migration plan without executing
    --verify: Verify migration after completion
    --batch-size: Number of episodes to migrate per batch (default: 100)

Environment Variables:
    FALKORDB_URI: FalkorDB connection URI
    FALKORDB_USER: FalkorDB username
    FALKORDB_PASSWORD: FalkorDB password
    FALKORDB_DATABASE: FalkorDB database name
    SUPABASE_URL: Supabase API URL
    SUPABASE_ANON_KEY: Supabase anonymous key
"""

import os
import sys
import json
import logging
import asyncio
import argparse
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass

# Add parent directory to path
sys.path.insert(0, str(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class EpisodeToSignalMigrator:
    """
    Migrates Episode-based schema to Entity/Signal/Evidence schema
    """

    def __init__(self, batch_size: int = 100, dry_run: bool = False):
        """
        Initialize migrator

        Args:
            batch_size: Number of episodes to process per batch
            dry_run: If True, print plan without executing
        """
        self.batch_size = batch_size
        self.dry_run = dry_run

        # Initialize clients
        self.supabase_client = None
        self.driver = None

        # Statistics
        self.stats = {
            "episodes_processed": 0,
            "entities_created": 0,
            "signals_created": 0,
            "evidence_created": 0,
            "errors": []
        }

    async def initialize(self):
        """Initialize database connections"""
        # Supabase
        try:
            from supabase import create_client

            supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
            supabase_key = os.getenv("SUPABASE_ANON_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

            if supabase_url and supabase_key:
                self.supabase_client = create_client(supabase_url, supabase_key)
                logger.info("✅ Supabase client initialized")
        except ImportError:
            logger.warning("⚠️ Supabase client not available")

        # FalkorDB/Neo4j
        try:
            from neo4j import GraphDatabase

            falkordb_uri = os.getenv("FALKORDB_URI") or os.getenv("NEO4J_URI")
            falkordb_user = os.getenv("FALKORDB_USER") or os.getenv("NEO4J_USER", "neo4j")
            falkordb_password = os.getenv("FALKORDB_PASSWORD") or os.getenv("NEO4J_PASSWORD")
            graph_name = os.getenv("FALKORDB_DATABASE", "sports_intelligence")

            if falkordb_uri and falkordb_password:
                self.driver = GraphDatabase.driver(
                    falkordb_uri,
                    auth=(falkordb_user, falkordb_password)
                )
                try:
                    self.driver.verify_connectivity()
                    logger.info(f"✅ FalkorDB driver initialized (database: {graph_name})")
                except Exception as e:
                    logger.warning(f"⚠️ FalkorDB connectivity check failed: {e}")
                    logger.info("   Will continue with Supabase data only")
                    self.driver = None
        except ImportError:
            logger.warning("⚠️ Neo4j driver not available")

    async def migrate(self) -> Dict[str, Any]:
        """
        Execute migration

        Returns:
            Migration summary with statistics
        """
        logger.info("🔄 Starting Episode → Signal migration...")

        if self.dry_run:
            logger.info("🔍 DRY RUN MODE - No changes will be made")

        # Step 1: Fetch all episodes from Supabase
        episodes = await self._fetch_episodes()
        logger.info(f"📊 Found {len(episodes)} episodes to migrate")

        # Step 2: Group episodes by organization (entity)
        episodes_by_entity = self._group_episodes_by_entity(episodes)
        logger.info(f"📊 Episodes span {len(episodes_by_entity)} entities")

        # Step 3: Migrate each entity's episodes
        for entity_id, entity_episodes in episodes_by_entity.items():
            await self._migrate_entity_episodes(entity_id, entity_episodes)

        # Step 4: Generate migration report
        report = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "dry_run": self.dry_run,
            "statistics": self.stats,
            "summary": self._generate_summary()
        }

        logger.info("✅ Migration complete!")
        return report

    async def _fetch_episodes(self) -> List[Dict[str, Any]]:
        """Fetch all episodes from Supabase"""
        if not self.supabase_client:
            logger.warning("⚠️ No Supabase client, returning empty list")
            return []

        logger.info("📥 Fetching episodes from Supabase...")

        response = self.supabase_client.table('temporal_episodes').select("*").execute()
        episodes = response.data

        logger.info(f"   ✅ Fetched {len(episodes)} episodes")
        return episodes

    def _group_episodes_by_entity(self, episodes: List[Dict]) -> Dict[str, List[Dict]]:
        """Group episodes by organization (entity_id)"""
        grouped = {}

        for episode in episodes:
            entity_id = episode.get('entity_id') or episode.get('entity_name', 'unknown').lower().replace(' ', '-')

            if entity_id not in grouped:
                grouped[entity_id] = []

            grouped[entity_id].append(episode)

        return grouped

    async def _migrate_entity_episodes(self, entity_id: str, episodes: List[Dict]):
        """Migrate all episodes for a single entity"""
        from backend.schemas import Entity, Signal, Evidence, SignalType, EntityType, map_episode_type_to_signal_type

        logger.info(f"🔄 Migrating {len(episodes)} episodes for entity: {entity_id}")

        # Create entity
        first_episode = episodes[0]
        entity_name = first_episode.get('entity_name', entity_id)
        entity_type_name = first_episode.get('entity_type', 'ORG')

        # Map entity type
        entity_type_map = {
            'Club': EntityType.ORG,
            'League': EntityType.ORG,
            'Organization': EntityType.ORG,
            'Company': EntityType.ORG,
            'Person': EntityType.PERSON,
            'Player': EntityType.PERSON,
            'Manager': EntityType.PERSON,
            'Venue': EntityType.VENUE
        }
        entity_type = entity_type_map.get(entity_type_name, EntityType.ORG)

        entity = Entity(
            id=entity_id,
            type=entity_type,
            name=entity_name,
            metadata={
                'original_type': entity_type_name,
                'episode_count': len(episodes),
                'migrated_at': datetime.now(timezone.utc).isoformat()
            }
        )

        if not self.dry_run:
            try:
                from backend.graphiti_service import GraphitiService
                service = GraphitiService()
                await service.initialize()

                await service.upsert_entity(entity)
                self.stats["entities_created"] += 1

                service.close()
            except Exception as e:
                logger.error(f"   ❌ Failed to create entity {entity_id}: {e}")
                self.stats["errors"].append(f"Entity {entity_id}: {e}")
                return
        else:
            logger.info(f"   [DRY RUN] Would create entity: {entity_id}")
            self.stats["entities_created"] += 1

        # Migrate episodes to signals
        for episode in episodes:
            await self._migrate_episode_to_signal(episode, entity_id)

    async def _migrate_episode_to_signal(self, episode: Dict, entity_id: str):
        """Migrate a single episode to a signal"""
        from backend.schemas import Signal, Evidence, SignalType, map_episode_type_to_signal_type

        episode_id = episode.get('id', 'unknown')
        episode_type = episode.get('episode_type', 'OTHER')

        # Map episode type to signal type
        try:
            signal_type = map_episode_type_to_signal_type(episode_type)
        except Exception:
            signal_type = SignalType.RFP_DETECTED

        # Create signal
        timestamp_str = episode.get('timestamp') or episode.get('created_at') or datetime.now(timezone.utc).isoformat()
        if isinstance(timestamp_str, str):
            try:
                timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
            except:
                timestamp = datetime.now(timezone.utc)
        else:
            timestamp = datetime.now(timezone.utc)

        signal_id = f"signal_{entity_id}_{signal_type.value.lower()}_{timestamp.strftime('%Y%m%d%H%M%S')}"

        signal = Signal(
            id=signal_id,
            type=signal_type,
            confidence=episode.get('confidence_score') or 0.7,  # Handle None values
            first_seen=timestamp,
            entity_id=entity_id,
            metadata={
                'original_episode_id': episode_id,
                'source': episode.get('source'),
                'url': episode.get('url'),
                'category': episode.get('category'),
                'estimated_value': episode.get('estimated_value'),
                'migrated_at': datetime.now(timezone.utc).isoformat()
            },
            validated=True,  # Episodes are already validated
            validation_pass=3
        )

        # Create evidence from episode
        evidence = Evidence(
            id=f"evidence_{signal_id}_0",
            source=episode.get('source', 'unknown'),
            date=timestamp,
            signal_id=signal_id,
            url=episode.get('url'),
            extracted_text=episode.get('description', ''),
            metadata={
                'original_episode_id': episode_id,
                'category': episode.get('category')
            },
            credibility_score=0.7  # Default credibility for migrated data
        )

        if not self.dry_run:
            try:
                from backend.graphiti_service import GraphitiService
                service = GraphitiService()
                await service.initialize()

                await service.upsert_signal(signal)
                self.stats["signals_created"] += 1

                await service.link_evidence(evidence)
                self.stats["evidence_created"] += 1

                service.close()

                self.stats["episodes_processed"] += 1

                if self.stats["episodes_processed"] % 100 == 0:
                    logger.info(f"   📊 Progress: {self.stats['episodes_processed']} episodes migrated")

            except Exception as e:
                logger.error(f"   ❌ Failed to migrate episode {episode_id}: {e}")
                self.stats["errors"].append(f"Episode {episode_id}: {e}")
        else:
            logger.info(f"   [DRY RUN] Would create signal: {signal_id}")
            self.stats["signals_created"] += 1
            self.stats["evidence_created"] += 1
            self.stats["episodes_processed"] += 1

    def _generate_summary(self) -> str:
        """Generate migration summary"""
        return f"""
Migration Summary:
- Episodes processed: {self.stats['episodes_processed']}
- Entities created: {self.stats['entities_created']}
- Signals created: {self.stats['signals_created']}
- Evidence created: {self.stats['evidence_created']}
- Errors: {len(self.stats['errors'])}

{"✅ Migration successful!" if len(self.stats['errors']) == 0 else "⚠️ Migration completed with errors"}
"""

    async def verify_migration(self) -> Dict[str, Any]:
        """
        Verify migration by comparing counts

        Returns:
            Verification report
        """
        logger.info("🔍 Verifying migration...")

        verification = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "checks": {}
        }

        # Check if signals table exists and has data
        if self.supabase_client:
            try:
                # Check temporal_episodes count
                old_episodes = self.supabase_client.table('temporal_episodes').select("*", count="exact").execute()
                old_count = len(old_episodes.data) if old_episodes.data else 0

                # Check if signals table exists
                try:
                    new_signals = self.supabase_client.table('signals').select("*", count="exact").execute()
                    new_count = len(new_signals.data) if new_signals.data else 0

                    verification["checks"]["episode_to_signal_ratio"] = {
                        "old_episodes": old_count,
                        "new_signals": new_count,
                        "expected_ratio": "1:1 (approximately)",
                        "status": "✅ Pass" if new_count >= old_count * 0.9 else "⚠️ Warning"
                    }
                except Exception as e:
                    verification["checks"]["signals_table"] = {"status": "⚠️ Signals table may not exist yet", "error": str(e)}

            except Exception as e:
                verification["checks"]["supabase"] = {"status": "❌ Failed", "error": str(e)}

        logger.info("✅ Verification complete")
        return verification

    def close(self):
        """Close database connections"""
        if self.driver:
            self.driver.close()
            logger.info("🔌 FalkorDB connection closed")


async def main():
    """Main migration function"""
    parser = argparse.ArgumentParser(description="Migrate Episodes to Signals")
    parser.add_argument("--dry-run", action="store_true", help="Print migration plan without executing")
    parser.add_argument("--verify", action="store_true", help="Verify migration after completion")
    parser.add_argument("--batch-size", type=int, default=100, help="Batch size for migration (default: 100)")

    args = parser.parse_args()

    print("="*60)
    print("EPISODE → SIGNAL MIGRATION")
    print("="*60)
    print(f"Mode: {'DRY RUN (no changes)' if args.dry_run else 'LIVE MIGRATION'}")
    print(f"Batch size: {args.batch_size}")
    print()

    # Check prerequisites
    print("Checking prerequisites...")

    # Check for backup
    backup_dir = Path("backups")
    if not backup_dir.exists():
        print("⚠️  No backups directory found")
        print("   Run: python backend/backup_graphiti_data.py")
        print("   Continuing anyway...")

    # Check environment variables
    # Accept either FALKORDB_* or NEO4J_* variables
    has_falkordb = os.getenv("FALKORDB_URI") and os.getenv("FALKORDB_PASSWORD")
    has_neo4j = os.getenv("NEO4J_URI") and os.getenv("NEO4J_PASSWORD")

    if not has_falkordb and not has_neo4j:
        print("❌ Missing required environment variables")
        print("   Please set either:")
        print("   - FALKORDB_URI and FALKORDB_PASSWORD")
        print("   OR")
        print("   - NEO4J_URI and NEO4J_PASSWORD")
        return

    print("✅ Prerequisites check passed")
    print()

    # Run migration
    migrator = EpisodeToSignalMigrator(
        batch_size=args.batch_size,
        dry_run=args.dry_run
    )

    try:
        await migrator.initialize()
        report = await migrator.migrate()

        # Print report
        print()
        print("="*60)
        print("MIGRATION REPORT")
        print("="*60)
        print(report["summary"])

        if args.verify and not args.dry_run:
            print()
            print("Running verification...")
            verification = await migrator.verify_migration()

            print()
            print("VERIFICATION RESULTS:")
            for check_name, check_result in verification["checks"].items():
                print(f"  {check_name}: {check_result}")

        print("="*60)

        # Save report to file
        report_path = Path("backups") / f"migration_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        report_path.parent.mkdir(exist_ok=True)
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2, default=str)

        print(f"📄 Report saved: {report_path}")

    finally:
        migrator.close()


if __name__ == "__main__":
    asyncio.run(main())
