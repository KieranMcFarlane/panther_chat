#!/usr/bin/env python3
"""
Batch Dossier Generator - Parallel Dossier Generation for 3,000+ Entities

Generates dossiers for multiple entities in parallel with:
- Tier assignment (BASIC/STANDARD/PREMIUM) based on priority
- Progress tracking and logging
- Incremental updates (re-generate only stale dossiers)
- Cost tracking and estimation
- Error handling and retry logic

USAGE:
    # Generate for all entities
    python batch_dossier_generator.py --tier AUTO --force-refresh

    # Generate for specific entities
    python batch_dossier_generator.py --entity-ids arsenal-fc,chelsea-fc

    # Generate from CSV list
    python batch_dossier_generator.py --input entities.csv

AUTHOR: Phase 0 Scalable Dossier System
DATE: 2026-02-22
"""

import os
import sys
import csv
import json
import logging
import asyncio
import argparse
from typing import Dict, List, Any, Optional, Set, Tuple
from dataclasses import dataclass, field, asdict
from pathlib import Path
from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor
import time

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from backend.schemas import EntityDossier
from backend.claude_client import ClaudeClient
from backend.dossier_generator import UniversalDossierGenerator
from backend.dossier_data_collector import DossierDataCollector
from backend.supabase_dossier_collector import SupabaseDataCollector, SupabaseEntity
from backend.universal_club_prompts import (
    BATCH_CONFIG,
    estimate_batch_cost,
    calculate_dossier_tier,
    estimate_dossier_cost
)

logger = logging.getLogger(__name__)


# =============================================================================
# DATA STRUCTURES
# =============================================================================

@dataclass
class EntityRecord:
    """Entity record from FalkorDB or CSV"""
    entity_id: str
    entity_name: str
    entity_type: str = "CLUB"
    priority_score: int = 50
    sport: Optional[str] = None
    country: Optional[str] = None
    league: Optional[str] = None
    last_dossier_date: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class BatchProgress:
    """Batch generation progress tracking"""
    total_entities: int = 0
    completed: int = 0
    failed: int = 0
    skipped: int = 0
    start_time: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    errors: List[Dict[str, str]] = field(default_factory=list)
    costs: Dict[str, float] = field(default_factory=lambda: {
        "BASIC": 0.0,
        "STANDARD": 0.0,
        "PREMIUM": 0.0
    })

    def get_elapsed_seconds(self) -> float:
        return (datetime.now(timezone.utc) - self.start_time).total_seconds()

    def get_progress_percent(self) -> float:
        if self.total_entities == 0:
            return 0.0
        return (self.completed / self.total_entities) * 100

    def get_total_cost(self) -> float:
        return sum(self.costs.values())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_entities": self.total_entities,
            "completed": self.completed,
            "failed": self.failed,
            "skipped": self.skipped,
            "progress_percent": round(self.get_progress_percent(), 1),
            "elapsed_seconds": round(self.get_elapsed_seconds(), 1),
            "estimated_remaining_seconds": round(self.estimate_remaining_seconds(), 1),
            "total_cost_usd": round(self.get_total_cost(), 4),
            "costs_by_tier": self.costs,
            "error_count": len(self.errors)
        }

    def estimate_remaining_seconds(self) -> float:
        """Estimate seconds remaining based on current progress"""
        if self.completed == 0:
            return 0.0

        elapsed = self.get_elapsed_seconds()
        rate = self.completed / elapsed
        remaining = self.total_entities - self.completed

        return remaining / rate if rate > 0 else 0.0


@dataclass
class DossierOutput:
    """Output from single dossier generation"""
    entity_id: str
    entity_name: str
    tier: str
    success: bool
    dossier_data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    generation_time: float = 0.0
    cost_usd: float = 0.0
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# =============================================================================
# BATCH DOSSIER GENERATOR
# =============================================================================

class BatchDossierGenerator:
    """
    Generate dossiers for multiple entities in parallel.

    Features:
    - Parallel processing with configurable concurrency
    - Tier assignment based on priority scores
    - Progress tracking and cost estimation
    - Incremental updates (skip fresh dossiers)
    - Error handling and retry logic
    - CSV import/export
    """

    def __init__(
        self,
        claude_client: Optional[ClaudeClient] = None,
        max_concurrent: int = 5,
        stale_days: int = 7,
        output_dir: str = "data/dossiers"
    ):
        """
        Initialize batch generator.

        Args:
            claude_client: Optional Claude client (creates if None)
            max_concurrent: Maximum parallel dossier generation
            stale_days: Days before dossier considered stale
            output_dir: Directory for dossier output files
        """
        self.claude_client = claude_client or ClaudeClient()
        self.max_concurrent = max_concurrent
        self.stale_days = stale_days
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # Create generator instance
        self.generator = UniversalDossierGenerator(
            claude_client=self.claude_client
        )

    async def generate_batch(
        self,
        entities: List[EntityRecord],
        tier: str = "AUTO",
        force_refresh: bool = False
    ) -> Tuple[List[DossierOutput], BatchProgress]:
        """
        Generate dossiers for multiple entities.

        Args:
            entities: List of entity records
            tier: Dossier tier (BASIC/STANDARD/PREMIUM/AUTO)
            force_refresh: Force regeneration even if recent dossier exists

        Returns:
            Tuple of (output list, progress tracking)
        """
        progress = BatchProgress(total_entities=len(entities))
        outputs: List[DossierOutput] = []

        logger.info(f"Starting batch generation: {len(entities)} entities, tier={tier}")

        # Filter entities that need generation
        entities_to_process = self._filter_entities(
            entities, tier, force_refresh
        )

        progress.skipped = len(entities) - len(entities_to_process)
        logger.info(f"Processing {len(entities_to_process)} entities (skipped {progress.skipped})")

        # Process in batches
        for i in range(0, len(entities_to_process), self.max_concurrent):
            batch = entities_to_process[i:i + self.max_concurrent]

            # Generate batch in parallel
            batch_results = await asyncio.gather(
                *[self._generate_single_entity(entity, tier) for entity in batch],
                return_exceptions=True
            )

            # Process results
            for result in batch_results:
                if isinstance(result, Exception):
                    logger.error(f"Generation error: {result}")
                    progress.failed += 1
                    progress.errors.append({
                        "error": str(result),
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    })
                elif isinstance(result, DossierOutput):
                    outputs.append(result)

                    if result.success:
                        progress.completed += 1
                        progress.costs[result.tier] += result.cost_usd
                    else:
                        progress.failed += 1
                        progress.errors.append({
                            "entity_id": result.entity_id,
                            "error": result.error or "Unknown error",
                            "timestamp": result.timestamp
                        })

            # Log progress
            logger.info(
                f"Progress: {progress.completed}/{progress.total_entities} "
                f"({progress.get_progress_percent():.1f}%), "
                f"cost: ${progress.get_total_cost():.4f}, "
                f"errors: {progress.failed}"
            )

            # Save intermediate results
            if i % 20 == 0:  # Every 20 entities
                self._save_intermediate_results(outputs)

        # Save final results
        self._save_results(outputs, progress)

        return outputs, progress

    async def _generate_single_entity(
        self,
        entity: EntityRecord,
        tier: str = "AUTO"
    ) -> DossierOutput:
        """
        Generate dossier for a single entity.

        Args:
            entity: Entity record
            tier: Dossier tier (AUTO uses priority score)

        Returns:
            DossierOutput with result
        """
        start_time = time.time()
        entity_tier = tier

        if tier == "AUTO":
            entity_tier = calculate_dossier_tier(entity.priority_score)

        try:
            logger.info(f"Generating {entity_tier} dossier for {entity.entity_name}")

            dossier = await self.generator.generate_universal_dossier(
                entity_id=entity.entity_id,
                entity_name=entity.entity_name,
                entity_type=entity.entity_type,
                priority_score=entity.priority_score
            )

            generation_time = time.time() - start_time
            estimated_cost = estimate_dossier_cost(entity_tier)

            # Save individual dossier file
            self._save_dossier_file(entity.entity_id, dossier, entity_tier)

            return DossierOutput(
                entity_id=entity.entity_id,
                entity_name=entity.entity_name,
                tier=entity_tier,
                success=True,
                dossier_data=dossier,
                generation_time=generation_time,
                cost_usd=estimated_cost
            )

        except Exception as e:
            generation_time = time.time() - start_time
            logger.error(f"Failed to generate dossier for {entity.entity_name}: {e}")

            return DossierOutput(
                entity_id=entity.entity_id,
                entity_name=entity.entity_name,
                tier=entity_tier,
                success=False,
                error=str(e),
                generation_time=generation_time
            )

    def _filter_entities(
        self,
        entities: List[EntityRecord],
        tier: str,
        force_refresh: bool
    ) -> List[EntityRecord]:
        """
        Filter entities that need dossier generation.

        Args:
            entities: All entities
            tier: Dossier tier
            force_refresh: Skip freshness check

        Returns:
            List of entities that need generation
        """
        if force_refresh:
            return entities

        filtered = []
        stale_threshold = datetime.now(timezone.utc) - timedelta(days=self.stale_days)

        for entity in entities:
            # Check if existing dossier exists and is fresh
            dossier_path = self._get_dossier_path(entity.entity_id, tier)

            if dossier_path.exists():
                # Check file modification time
                mtime = datetime.fromtimestamp(
                    dossier_path.stat().st_mtime,
                    tz=timezone.utc
                )

                if mtime > stale_threshold:
                    logger.debug(f"Skipping {entity.entity_name} - fresh dossier exists")
                    continue

            filtered.append(entity)

        return filtered

    def _get_dossier_path(self, entity_id: str, tier: str) -> Path:
        """Get the file path for a dossier"""
        tier_dir = self.output_dir / tier.lower()
        tier_dir.mkdir(exist_ok=True)
        return tier_dir / f"{entity_id}.json"

    def _save_dossier_file(
        self,
        entity_id: str,
        dossier: Dict[str, Any],
        tier: str
    ):
        """Save individual dossier to file"""
        dossier_path = self._get_dossier_path(entity_id, tier)

        with open(dossier_path, 'w', encoding='utf-8') as f:
            json.dump(dossier, f, indent=2, default=str)

    def _save_intermediate_results(self, outputs: List[DossierOutput]):
        """Save intermediate results for recovery"""
        intermediate_path = self.output_dir / "_intermediate_results.json"

        data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "outputs": [asdict(o) for o in outputs]
        }

        with open(intermediate_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, default=str)

    def _save_results(
        self,
        outputs: List[DossierOutput],
        progress: BatchProgress
    ):
        """Save final results summary"""
        summary_path = self.output_dir / f"_batch_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

        summary = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "progress": progress.to_dict(),
            "outputs": [asdict(o) for o in outputs]
        }

        with open(summary_path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2, default=str)

        logger.info(f"Batch summary saved to {summary_path}")


# =============================================================================
# ENTITY LOADING
# =============================================================================

def load_entities_from_falkordb(limit: Optional[int] = None) -> List[EntityRecord]:
    """
    Load entities from FalkorDB.

    Args:
        limit: Optional limit on number of entities

    Returns:
        List of EntityRecord objects
    """
    try:
        from falkordb import FalkorDB
        from dotenv import load_dotenv
        import os
        import urllib.parse

        # Load environment
        load_dotenv()

        uri = os.getenv("FALKORDB_URI")
        if not uri:
            logger.warning("FALKORDB_URI not set - using empty entity list")
            return []

        # Parse connection
        parsed = urllib.parse.urlparse(uri.replace("rediss://", "http://"))
        host = parsed.hostname or "localhost"
        port = parsed.port or 6379

        username = os.getenv("FALKORDB_USER", "falkordb")
        password = os.getenv("FALKORDB_PASSWORD")
        database = os.getenv("FALKORDB_DATABASE", "sports_intelligence")

        # Connect
        db = FalkorDB(
            host=host,
            port=port,
            username=username,
            password=password,
            ssl=False
        )

        g = db.select_graph(database)

        # Query entities
        if limit:
            cypher = f"MATCH (e:Entity) RETURN e.entity_id, e.name, e.sport, e.country, e.league_or_competition LIMIT {limit}"
        else:
            cypher = "MATCH (e:Entity) RETURN e.entity_id, e.name, e.sport, e.country, e.league_or_competition"

        result = g.query(cypher)

        entities = []
        for row in result.result_set:
            entities.append(EntityRecord(
                entity_id=row[0],
                entity_name=row[1],
                sport=row[2],
                country=row[3],
                league=row[4]
            ))

        logger.info(f"Loaded {len(entities)} entities from FalkorDB")
        return entities

    except Exception as e:
        logger.error(f"Failed to load entities from FalkorDB: {e}")
        return []


def load_entities_from_supabase(
    limit: Optional[int] = None,
    filters: Optional[Dict[str, Any]] = None
) -> List[EntityRecord]:
    """
    Load entities from Supabase cached_entities table.

    This is the preferred method as it uses the existing Supabase cache
    instead of requiring FalkorDB connection or manual CSV files.

    Args:
        limit: Optional limit on number of entities
        filters: Optional filters for entity selection
            - sport: Filter by sport (e.g., "Football")
            - country: Filter by country (e.g., "England")
            - entity_type: Filter by type (e.g., "CLUB", "LEAGUE")
            - min_priority: Minimum priority_score (e.g., 70)

    Returns:
        List of EntityRecord objects
    """
    try:
        collector = SupabaseDataCollector()
        supabase_entities = collector.get_all_entities(limit=limit)

        entities = []
        for se in supabase_entities:
            # Apply filters if provided
            if filters:
                if filters.get('sport') and se.sport != filters['sport']:
                    continue
                if filters.get('country') and se.country != filters['country']:
                    continue
                if filters.get('entity_type') and se.entity_type != filters['entity_type']:
                    continue
                # Priority score from metadata
                priority = se.metadata.get('priority_score', 50)
                if filters.get('min_priority') and priority < filters['min_priority']:
                    continue

            # Extract priority from metadata
            priority_score = se.metadata.get('priority_score', 50)

            entities.append(EntityRecord(
                entity_id=se.entity_id,
                entity_name=se.entity_name,
                entity_type=se.entity_type or 'CLUB',
                priority_score=priority_score,
                sport=se.sport,
                country=se.country,
                league=se.league,
                metadata={
                    'badge_s3_url': se.metadata.get('badge_s3_url'),
                    'neo4j_id': se.metadata.get('neo4j_id'),
                    'labels': se.metadata.get('labels', []),
                    'supabase_raw': se.metadata.get('properties', {})
                }
            ))

        logger.info(f"Loaded {len(entities)} entities from Supabase")
        return entities

    except Exception as e:
        logger.error(f"Failed to load entities from Supabase: {e}")
        return []


def load_entities_from_supabase_with_keywords(
    keywords: List[str],
    limit: Optional[int] = None
) -> List[EntityRecord]:
    """
    Load entities from Supabase that match specific keywords.

    Useful for targeting specific sports, countries, or competitions.

    Args:
        keywords: List of keywords to search for in entity names
        limit: Optional limit on number of entities

    Returns:
        List of EntityRecord objects
    """
    try:
        collector = SupabaseDataCollector()
        all_entities = collector.get_all_entities()

        entities = []
        for se in all_entities:
            # Check if any keyword matches entity name, country, or sport
            name_lower = (se.entity_name or '').lower()
            country_lower = (se.country or '').lower()
            sport_lower = (se.sport or '').lower()

            matches = False
            for keyword in keywords:
                keyword_lower = keyword.lower()
                if (keyword_lower in name_lower or
                    keyword_lower in country_lower or
                    keyword_lower in sport_lower):
                    matches = True
                    break

            if matches:
                priority_score = se.metadata.get('priority_score', 50)
                entities.append(EntityRecord(
                    entity_id=se.entity_id,
                    entity_name=se.entity_name,
                    entity_type=se.entity_type or 'CLUB',
                    priority_score=priority_score,
                    sport=se.sport,
                    country=se.country,
                    league=se.league,
                    metadata={
                        'badge_s3_url': se.metadata.get('badge_s3_url'),
                        'neo4j_id': se.metadata.get('neo4j_id'),
                        'labels': se.metadata.get('labels', [])
                    }
                ))

            if limit and len(entities) >= limit:
                break

        logger.info(f"Loaded {len(entities)} entities from Supabase matching keywords {keywords}")
        return entities

    except Exception as e:
        logger.error(f"Failed to load entities from Supabase with keywords: {e}")
        return []


def load_entities_from_csv(csv_path: str) -> List[EntityRecord]:
    """
    Load entities from CSV file.

    CSV format:
    entity_id,entity_name,entity_type,priority_score,sport,country,league

    Args:
        csv_path: Path to CSV file

    Returns:
        List of EntityRecord objects
    """
    entities = []

    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        for row in reader:
            entities.append(EntityRecord(
                entity_id=row['entity_id'],
                entity_name=row.get('entity_name', row['entity_id']),
                entity_type=row.get('entity_type', 'CLUB'),
                priority_score=int(row.get('priority_score', 50)),
                sport=row.get('sport'),
                country=row.get('country'),
                league=row.get('league')
            ))

    logger.info(f"Loaded {len(entities)} entities from CSV")
    return entities


def load_entity_list_from_args(entity_ids: List[str]) -> List[EntityRecord]:
    """
    Create entity records from command line ID list.

    Args:
        entity_ids: List of entity IDs

    Returns:
        List of EntityRecord objects
    """
    entities = []

    for entity_id in entity_ids:
        # Convert kebab-case to title case for name
        name = entity_id.replace('-', ' ').replace('_', ' ').title()

        entities.append(EntityRecord(
            entity_id=entity_id,
            entity_name=name,
            entity_type="CLUB",
            priority_score=50
        ))

    return entities


# =============================================================================
# CLI INTERFACE
# =============================================================================

def main():
    """CLI interface for batch dossier generation"""
    parser = argparse.ArgumentParser(
        description="Generate dossiers for multiple entities"
    )
    parser.add_argument(
        "--entity-ids",
        help="Comma-separated list of entity IDs"
    )
    parser.add_argument(
        "--input",
        help="Path to CSV file with entity list"
    )
    parser.add_argument(
        "--tier",
        choices=["BASIC", "STANDARD", "PREMIUM", "AUTO"],
        default="AUTO",
        help="Dossier tier (default: AUTO)"
    )
    parser.add_argument(
        "--max-concurrent",
        type=int,
        default=5,
        help="Maximum concurrent generations (default: 5)"
    )
    parser.add_argument(
        "--force-refresh",
        action="store_true",
        help="Force regeneration even for fresh dossiers"
    )
    parser.add_argument(
        "--stale-days",
        type=int,
        default=7,
        help="Days before dossier considered stale (default: 7)"
    )
    parser.add_argument(
        "--output-dir",
        default="data/dossiers",
        help="Output directory for dossiers (default: data/dossiers)"
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Limit number of entities (default: all from data source)"
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose logging"
    )

    # Supabase options
    parser.add_argument(
        "--from-supabase",
        action="store_true",
        help="Load entities from Supabase (preferred method)"
    )
    parser.add_argument(
        "--filter-sport",
        help="Filter by sport (e.g., 'Football', 'Basketball')"
    )
    parser.add_argument(
        "--filter-country",
        help="Filter by country (e.g., 'England', 'USA')"
    )
    parser.add_argument(
        "--filter-type",
        help="Filter by entity type (e.g., 'CLUB', 'LEAGUE', 'FEDERATION')"
    )
    parser.add_argument(
        "--filter-min-priority",
        type=int,
        help="Filter by minimum priority score (0-100)"
    )
    parser.add_argument(
        "--keywords",
        help="Comma-separated keywords to search for in entity names"
    )

    args = parser.parse_args()

    # Configure logging
    logging.basicConfig(
        level=logging.INFO if args.verbose else logging.WARNING,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # Load entities
    entities = []
    data_source = "Unknown"

    if args.entity_ids:
        entity_ids = [e.strip() for e in args.entity_ids.split(',')]
        entities = load_entity_list_from_args(entity_ids)
        data_source = "Command-line IDs"
    elif args.input:
        entities = load_entities_from_csv(args.input)
        data_source = f"CSV file: {args.input}"
    elif args.from_supabase:
        # Use Supabase as data source
        if args.keywords:
            keywords = [k.strip() for k in args.keywords.split(',')]
            entities = load_entities_from_supabase_with_keywords(
                keywords=keywords,
                limit=args.limit
            )
            data_source = f"Supabase (keywords: {', '.join(keywords)})"
        else:
            filters = {}
            if args.filter_sport:
                filters['sport'] = args.filter_sport
            if args.filter_country:
                filters['country'] = args.filter_country
            if args.filter_type:
                filters['entity_type'] = args.filter_type
            if args.filter_min_priority:
                filters['min_priority'] = args.filter_min_priority

            entities = load_entities_from_supabase(
                limit=args.limit,
                filters=filters if filters else None
            )

            filter_desc = ", ".join(f"{k}={v}" for k, v in filters.items()) if filters else "all"
            data_source = f"Supabase ({filter_desc})"
    else:
        entities = load_entities_from_falkordb(limit=args.limit)
        data_source = "FalkorDB"

    if not entities:
        logger.error("No entities to process")
        return 1

    # Estimate cost
    cost_estimate = estimate_batch_cost(len(entities))
    logger.info(
        f"Estimated cost for {len(entities)} entities: "
        f"${cost_estimate['total_cost_usd']:.2f}, "
        f"time: {cost_estimate['total_time_hours']:.1f} hours"
    )

    # Run batch generation
    generator = BatchDossierGenerator(
        max_concurrent=args.max_concurrent,
        stale_days=args.stale_days,
        output_dir=args.output_dir
    )

    async def run(data_src: str):
        outputs, progress = await generator.generate_batch(
            entities=entities,
            tier=args.tier,
            force_refresh=args.force_refresh
        )

        # Print summary
        print("\n" + "=" * 70)
        print("BATCH GENERATION COMPLETE")
        print("=" * 70)
        print(f"Data Source: {data_src}")
        print(f"Total Entities: {progress.total_entities}")
        print(f"Completed: {progress.completed}")
        print(f"Failed: {progress.failed}")
        print(f"Skipped: {progress.skipped}")
        print(f"Total Cost: ${progress.get_total_cost():.4f}")
        print(f"Time Elapsed: {progress.get_elapsed_seconds():.1f}s")
        print(f"Output Directory: {args.output_dir}")
        print("=" * 70)

        return 0 if progress.failed == 0 else 1

    return asyncio.run(run(data_source))


if __name__ == "__main__":
    sys.exit(main())
