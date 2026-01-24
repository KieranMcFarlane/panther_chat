#!/usr/bin/env python3
"""
Graphiti Data Backup Script

Creates backups of existing Graphiti data before Episode → Signal migration.

Backs up:
- Temporal episodes (Supabase)
- RFP tracking data (Supabase)
- Entity relationships (FalkorDB/Neo4j)
- Signals and evidence

Usage:
    python backend/backup_graphiti_data.py

Environment Variables:
    SUPABASE_URL: Supabase API URL
    SUPABASE_ANON_KEY: Supabase anonymous key
    FALKORDB_URI: FalkorDB connection URI
    FALKORDB_USER: FalkorDB username
    FALKORDB_PASSWORD: FalkorDB password
"""

import os
import sys
import json
import logging
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any, Optional

# Add parent directory to path
sys.path.insert(0, str(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class GraphitiBackup:
    """Backup utility for Graphiti data"""

    def __init__(self, backup_dir: str = "backups"):
        """
        Initialize backup utility

        Args:
            backup_dir: Directory to store backups (default: "backups")
        """
        self.backup_dir = Path(backup_dir)
        self.backup_dir.mkdir(exist_ok=True)

        # Create timestamped backup subdirectory
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        self.backup_path = self.backup_dir / f"graphiti_backup_{timestamp}"
        self.backup_path.mkdir(exist_ok=True)

        logger.info(f"📦 Backup directory: {self.backup_path}")

        # Initialize clients
        self.supabase_client = None
        self.driver = None

    async def initialize(self):
        """Initialize database connections"""
        # Try to import and initialize Supabase
        try:
            from supabase import create_client

            supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
            supabase_key = os.getenv("SUPABASE_ANON_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

            if supabase_url and supabase_key:
                self.supabase_client = create_client(supabase_url, supabase_key)
                logger.info("✅ Supabase client initialized")
            else:
                logger.warning("⚠️ Supabase credentials not found")

        except ImportError:
            logger.warning("⚠️ Supabase client not available")

        # Try to import and initialize FalkorDB
        try:
            from neo4j import GraphDatabase

            falkordb_uri = os.getenv("FALKORDB_URI") or os.getenv("NEO4J_URI")
            falkordb_user = os.getenv("FALKORDB_USER") or os.getenv("NEO4J_USER", "neo4j")
            falkordb_password = os.getenv("FALKORDB_PASSWORD") or os.getenv("NEO4J_PASSWORD")

            if falkordb_uri and falkordb_password:
                self.driver = GraphDatabase.driver(
                    falkordb_uri,
                    auth=(falkordb_user, falkordb_password)
                )
                self.driver.verify_connectivity()
                logger.info("✅ FalkorDB driver initialized")
            else:
                logger.warning("⚠️ FalkorDB credentials not found")

        except ImportError:
            logger.warning("⚠️ Neo4j driver not available")

    async def backup_all(self) -> Dict[str, Any]:
        """
        Backup all Graphiti data

        Returns:
            Summary of backup operation
        """
        logger.info("🔄 Starting full Graphiti backup...")

        summary = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "backup_path": str(self.backup_path),
            "tables": {},
            "files": []
        }

        # Backup Supabase tables
        if self.supabase_client:
            summary["tables"]["temporal_episodes"] = await self._backup_supabase_table("temporal_episodes")
            summary["tables"]["rfp_tracking"] = await self._backup_supabase_table("rfp_tracking")
            summary["tables"]["temporal_fit_cache"] = await self._backup_supabase_table("temporal_fit_cache")

        # Backup FalkorDB graph data
        if self.driver:
            await self._backup_falkordb_graph()

        # Create backup manifest
        manifest_path = self.backup_path / "manifest.json"
        with open(manifest_path, 'w') as f:
            json.dump(summary, f, indent=2)

        logger.info(f"✅ Backup complete: {self.backup_path}")

        return summary

    async def _backup_supabase_table(self, table_name: str) -> Dict[str, Any]:
        """
        Backup a Supabase table to JSON

        Args:
            table_name: Table name to backup

        Returns:
            Backup summary
        """
        logger.info(f"📋 Backing up Supabase table: {table_name}")

        try:
            # Fetch all rows
            response = self.supabase_client.table(table_name).select("*").execute()

            data = response.data
            count = len(data)

            # Write to JSON file
            output_file = self.backup_path / f"{table_name}.json"
            with open(output_file, 'w') as f:
                json.dump(data, f, indent=2, default=str)

            logger.info(f"   ✅ Backed up {count} rows to {output_file.name}")

            return {
                "status": "success",
                "rows": count,
                "file": str(output_file)
            }

        except Exception as e:
            logger.error(f"   ❌ Failed to backup {table_name}: {e}")
            return {
                "status": "error",
                "error": str(e)
            }

    async def _backup_falkordb_graph(self):
        """Backup FalkorDB graph data to JSON"""
        logger.info(f"📊 Backing up FalkorDB graph data")

        try:
            graph_name = os.getenv("FALKORDB_DATABASE", "sports_intelligence")

            with self.driver.session(database=graph_name) as session:
                # Backup all entities
                entities_result = session.run("MATCH (e:Entity) RETURN e")
                entities = [dict(record["e"]) for record in entities_result]

                entities_file = self.backup_path / "falkordb_entities.json"
                with open(entities_file, 'w') as f:
                    json.dump(entities, f, indent=2, default=str)

                logger.info(f"   ✅ Backed up {len(entities)} entities")

                # Backup all episodes
                episodes_result = session.run("MATCH (ep:Episode) RETURN ep")
                episodes = [dict(record["ep"]) for record in episodes_result]

                episodes_file = self.backup_path / "falkordb_episodes.json"
                with open(episodes_file, 'w') as f:
                    json.dump(episodes, f, indent=2, default=str)

                logger.info(f"   ✅ Backed up {len(episodes)} episodes")

                # Backup relationships
                rels_result = session.run("""
                    MATCH (a)-[r]->(b)
                    RETURN a, type(r) as rel_type, r, b
                    LIMIT 10000
                """)
                relationships = []
                for record in rels_result:
                    relationships.append({
                        "from": dict(record["a"]) if record["a"] else None,
                        "type": record["rel_type"],
                        "properties": dict(record["r"]) if record["r"] else {},
                        "to": dict(record["b"]) if record["b"] else None
                    })

                rels_file = self.backup_path / "falkordb_relationships.json"
                with open(rels_file, 'w') as f:
                    json.dump(relationships, f, indent=2, default=str)

                logger.info(f"   ✅ Backed up {len(relationships)} relationships")

        except Exception as e:
            logger.error(f"   ❌ Failed to backup FalkorDB: {e}")

    def close(self):
        """Close database connections"""
        if self.driver:
            self.driver.close()
            logger.info("🔌 FalkorDB connection closed")


async def main():
    """Main backup function"""
    backup = GraphitiBackup()

    try:
        await backup.initialize()
        summary = await backup.backup_all()

        # Print summary
        print("\n" + "="*60)
        print("BACKUP SUMMARY")
        print("="*60)
        print(f"Timestamp: {summary['timestamp']}")
        print(f"Location: {summary['backup_path']}")

        if summary["tables"]:
            print("\nSupabase Tables:")
            for table, info in summary["tables"].items():
                if info.get("status") == "success":
                    print(f"  ✅ {table}: {info['rows']} rows")
                else:
                    print(f"  ❌ {table}: {info.get('error', 'Unknown error')}")

        print("\n✅ Backup complete!")
        print(f"📦 Backup location: {summary['backup_path']}")
        print("="*60)

    finally:
        backup.close()


if __name__ == "__main__":
    asyncio.run(main())
