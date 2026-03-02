#!/usr/bin/env python3
"""
Supabase-Backed Dossier Data Collector

Pulls entity data directly from Supabase tables (cached_entities, leadership, etc.)
instead of requiring manual CSV population.

This bridges the gap between your existing Supabase cache and the new dossier system.

AUTHOR: Phase 0 Scalable Dossier System
DATE: 2026-02-22
"""

import os
import csv
import json
import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from pathlib import Path

# Load environment
project_root = Path(__file__).parent.parent
env_files = [
    project_root / '.env.local',
    project_root / '.env',
    Path('.env.local'),
    Path('.env')
]

for env_file in env_files:
    if env_file.exists():
        try:
            from dotenv import load_dotenv
            load_dotenv(env_file)
            break
        except ImportError:
            with open(env_file) as f:
                for line in f:
                    if line.strip() and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        os.environ[key.strip()] = value.strip()
        break

logger = logging.getLogger(__name__)


@dataclass
class SupabaseEntity:
    """Entity from Supabase cached_entities"""
    entity_id: str
    entity_name: str
    entity_type: str
    sport: Optional[str] = None
    country: Optional[str] = None
    league: Optional[str] = None
    description: Optional[str] = None
    website: Optional[str] = None
    founded_year: Optional[str] = None
    stadium: Optional[str] = None
    capacity: Optional[int] = None
    logo_url: Optional[str] = None
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


class SupabaseDataCollector:
    """
    Pull dossier data from Supabase tables.

    Tables queried:
    - cached_entities: Core entity data
    - leadership: Decision makers (if exists)
    - Other relevant tables as discovered
    """

    def __init__(self):
        """Initialize Supabase client"""
        try:
            from supabase import create_client
        except ImportError:
            logger.error("supabase-py not installed. Run: pip install supabase")
            raise

        supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_ANON_KEY")

        if not supabase_url or not supabase_key:
            raise ValueError(
                "Supabase credentials not found. Set NEXT_PUBLIC_SUPABASE_URL "
                "and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
            )

        self.client = create_client(supabase_url, supabase_key)
        logger.info("Supabase client initialized")

    def get_entity(self, entity_id: str) -> Optional[SupabaseEntity]:
        """
        Get single entity from cached_entities.

        The cached_entities table stores data in a 'properties' JSONB column.
        We query by name since entity_id doesn't exist as a separate column.

        Args:
            entity_id: Entity ID (e.g., "arsenal-fc" or "arsenal")

        Returns:
            SupabaseEntity or None
        """
        try:
            # Normalize entity_id for search
            normalized_id = entity_id.lower().replace('-', ' ').replace('_', ' ')
            normalized_dash = entity_id.lower()

            # Try exact match first on various properties
            response = self.client.table('cached_entities').select('*').or_(
                f'properties->>name.eq.{entity_id},'
                f'properties->>name.ilike.%{normalized_id}%,'
                f'properties->>supabase_id.eq.{entity_id},'
                f'properties->>neo4j_id.eq.{entity_id}'
            ).limit(10).execute()

            # If no results, try broader search
            if not response.data:
                response = self.client.table('cached_entities').select('*').ilike(
                    'properties->>name', f'%{normalized_id}%'
                ).limit(10).execute()

            if not response.data:
                logger.warning(f"Entity {entity_id} not found in cached_entities")
                return None

            # Find best match: prefer exact or prefix match
            best_match = None
            best_score = 0

            for row in response.data:
                props = row.get('properties', {})
                name = props.get('name', '').lower()
                score = 0

                # Exact match gets highest score
                if name == normalized_dash or name == normalized_id:
                    score = 100
                # Prefix match
                elif name.startswith(normalized_dash) or name.startswith(normalized_id):
                    score = 80
                # Contains match
                elif normalized_id in name or normalized_dash in name:
                    score = 50

                if score > best_score:
                    best_score = score
                    best_match = row

            if best_match:
                return self._parse_entity_row(best_match)
            else:
                return self._parse_entity_row(response.data[0])

        except Exception as e:
            logger.error(f"Error fetching entity {entity_id}: {e}")
            return None

    def _parse_entity_row(self, row: Dict[str, Any]) -> Optional[SupabaseEntity]:
        """
        Parse a Supabase row into a SupabaseEntity.

        The cached_entities table stores entity data in a 'properties' JSONB column.
        """
        props = row.get('properties', {})

        # Extract basic fields from properties
        entity_id = (
            props.get('supabase_id') or
            props.get('neo4j_id') or
            props.get('name', '').lower().replace(' ', '-') or
            str(row.get('id', ''))
        )

        # Parse founded year - may be stored as {'low': year, 'high': 0}
        founded = props.get('founded', '')
        if isinstance(founded, dict):
            founded = founded.get('low', '')
        founded_year = str(founded) if founded else None

        # Parse capacity
        capacity = props.get('capacity')
        if isinstance(capacity, dict):
            capacity = capacity.get('low', None)

        # Parse labels for entity_type
        labels = row.get('labels', [])
        entity_type = props.get('type')
        if not entity_type and labels:
            # Map labels to entity type
            if 'Club' in labels or 'SportsClub' in labels:
                entity_type = 'CLUB'
            elif 'League' in labels:
                entity_type = 'LEAGUE'
            elif 'Federation' in labels:
                entity_type = 'FEDERATION'
            elif 'Person' in labels:
                entity_type = 'PERSON'
            else:
                entity_type = 'ORG'

        return SupabaseEntity(
            entity_id=entity_id,
            entity_name=props.get('name', ''),
            entity_type=entity_type or 'CLUB',
            sport=props.get('sport'),
            country=props.get('country'),
            league=props.get('level'),  # 'level' maps to league in properties
            description=props.get('about'),
            website=props.get('website'),
            founded_year=founded_year,
            stadium=props.get('stadium'),
            capacity=capacity,
            logo_url=row.get('badge_s3_url'),  # S3 URL from table level
            metadata={
                'properties': props,
                'neo4j_id': row.get('neo4j_id'),
                'labels': labels,
                'badge_s3_url': row.get('badge_s3_url'),
                'priority_score': row.get('priority_score'),
                'entity_category': row.get('entity_category'),
                'cache_version': row.get('cache_version')
            }
        )

    def get_all_entities(self, limit: Optional[int] = None) -> List[SupabaseEntity]:
        """
        Get all entities from cached_entities.

        Args:
            limit: Optional limit on number of entities

        Returns:
            List of SupabaseEntity
        """
        try:
            query = self.client.table('cached_entities').select('*')

            if limit:
                query = query.limit(limit)

            response = query.execute()

            entities = []
            for row in response.data:
                entity = self._parse_entity_row(row)
                if entity:
                    entities.append(entity)

            logger.info(f"Retrieved {len(entities)} entities from cached_entities")
            return entities

        except Exception as e:
            logger.error(f"Error fetching entities: {e}")
            return []

    def get_leadership(self, entity_id: str) -> List[Dict[str, Any]]:
        """
        Get leadership data for an entity (if table exists).

        Args:
            entity_id: Entity ID

        Returns:
            List of leadership records
        """
        try:
            # Try different possible table names
            tables_to_try = ['leadership', 'leaders', 'entity_leadership', 'staff']

            for table_name in tables_to_try:
                try:
                    response = self.client.table(table_name).select('*').eq('entity_id', entity_id).execute()

                    if response.data:
                        logger.info(f"Found {len(response.data)} leadership records in {table_name}")
                        return response.data
                except Exception:
                    continue  # Table doesn't exist or no access

            logger.info(f"No leadership data found for {entity_id}")
            return []

        except Exception as e:
            logger.error(f"Error fetching leadership for {entity_id}: {e}")
            return []

    def get_dossier_data(self, entity_id: str) -> Dict[str, Any]:
        """
        Get all dossier data for an entity from Supabase.

        Args:
            entity_id: Entity ID

        Returns:
            Dictionary with all available dossier data
        """
        entity = self.get_entity(entity_id)

        if not entity:
            return {
                "error": f"Entity {entity_id} not found"
            }

        # Get leadership
        leadership = self.get_leadership(entity_id)

        # Build dossier data dict
        dossier_data = {
            # Core info
            "entity_id": entity.entity_id,
            "entity_name": entity.entity_name,
            "entity_type": entity.entity_type,
            "sport": entity.sport,
            "country": entity.country,
            "league_or_competition": entity.league,
            "description": entity.description,

            # Details
            "website": entity.website,
            "founded": entity.founded_year,
            "stadium": entity.stadium,
            "capacity": entity.capacity,
            "logo_url": entity.logo_url,

            # Metadata
            "metadata": entity.metadata,

            # Leadership (if available)
            "leadership": leadership,
            "leadership_count": len(leadership),

            # Sources used
            "data_sources_used": ["Supabase"]
        }

        # Add metadata summary
        dossier_data["metadata_summary"] = self._format_metadata_summary(entity)

        return dossier_data

    def _format_metadata_summary(self, entity: SupabaseEntity) -> str:
        """Format entity metadata as summary string"""
        lines = [
            f"Entity: {entity.entity_name}",
            f"Type: {entity.entity_type}",
            f"Sport: {entity.sport or 'N/A'}",
            f"Country: {entity.country or 'N/A'}",
            f"League: {entity.league or 'N/A'}",
        ]

        if entity.website:
            lines.append(f"Website: {entity.website}")
        if entity.stadium:
            lines.append(f"Stadium: {entity.stadium}")
        if entity.capacity:
            lines.append(f"Capacity: {entity.capacity}")

        return "\n".join(lines)

    def _clean_int_value(self, value: Any) -> Optional[int]:
        """
        Clean integer values that may be stored as {'low': X, 'high': Y}
        """
        if value is None:
            return None
        if isinstance(value, int):
            return value
        if isinstance(value, dict):
            return value.get('low')
        if isinstance(value, str):
            try:
                return int(value)
            except ValueError:
                return None
        return None

    def export_to_csv_format(self, output_dir: str = "data/dossier_exports"):
        """
        Export Supabase data to CSV format (for template compatibility).

        Args:
            output_dir: Directory for CSV files
        """
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        # Export entities
        entities = self.get_all_entities()

        if entities:
            # Core info
            core_csv = output_path / "core_info.csv"
            with open(core_csv, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow([
                    "entity_id", "official_name", "type", "sport", "country",
                    "league", "founded_year", "stadium_name", "capacity",
                    "website_url", "employee_count", "description"
                ])

                for entity in entities:
                    # Clean integer values
                    founded = self._clean_int_value(entity.founded_year) if entity.founded_year else ""
                    capacity = self._clean_int_value(entity.capacity) if entity.capacity else ""

                    writer.writerow([
                        entity.entity_id,
                        entity.entity_name,
                        entity.entity_type,
                        entity.sport or "",
                        entity.country or "",
                        entity.league or "",
                        founded,
                        entity.stadium or "",
                        capacity,
                        entity.website or "",
                        "",  # employee_count not available
                        entity.description or ""
                    ])

            logger.info(f"Exported {len(entities)} entities to {core_csv}")

            # Export leadership (if available)
            leadership = self._collect_all_leadership()
            if leadership:
                leadership_csv = output_path / "leadership.csv"
                with open(leadership_csv, 'w', newline='', encoding='utf-8') as f:
                    writer = csv.writer(f)
                    writer.writerow([
                        "entity_id", "person_name", "role", "title",
                        "influence_level", "linkedin_url", "email"
                    ])

                    for record in leadership:
                        writer.writerow([
                            record.get('entity_id', ''),
                            record.get('person_name', ''),
                            record.get('role', ''),
                            record.get('title', ''),
                            record.get('influence_level', ''),
                            record.get('linkedin_url', ''),
                            record.get('email', '')
                        ])

                logger.info(f"Exported {len(leadership)} leadership records to {leadership_csv}")

        return {
            "entities_exported": len(entities),
            "core_csv": str(core_csv) if entities else None,
            "leadership_csv": str(output_path / "leadership.csv") if leadership else None
        }

    def _collect_all_leadership(self) -> List[Dict[str, Any]]:
        """Collect all leadership records across all entities"""
        all_leadership = []

        tables_to_try = ['leadership', 'leaders', 'entity_leadership', 'staff']

        for table_name in tables_to_try:
            try:
                # Get all records (with reasonable limit)
                response = self.client.table(table_name).select('*').limit(10000).execute()

                if response.data:
                    for row in response.data:
                        all_leadership.append(row)
                    logger.info(f"Found {len(response.data)} leadership records in {table_name}")
                    break  # Use first successful table
            except:
                continue

        return all_leadership


def get_entity_for_dossier(entity_id: str) -> Optional[Dict[str, Any]]:
    """
    Convenience function to get entity data for dossier generation.

    Usage:
        from supabase_dossier_collector import get_entity_for_dossier
        data = get_entity_for_dossier("arsenal-fc")
    """
    collector = SupabaseDataCollector()
    return collector.get_dossier_data(entity_id)


def get_all_entities_for_batch(limit: Optional[int] = None) -> List[SupabaseEntity]:
    """
    Convenience function to get all entities for batch processing.

    Usage:
        from supabase_dossier_collector import get_all_entities_for_batch
        entities = get_all_entities_for_batch(limit=100)
    """
    collector = SupabaseDataCollector()
    return collector.get_all_entities(limit=limit)


# =============================================================================
# CLI INTERFACE
# =============================================================================

def main():
    """CLI interface for Supabase data collection"""
    import argparse

    parser = argparse.ArgumentParser(description="Pull dossier data from Supabase")
    parser.add_argument("--entity-id", help="Get specific entity")
    parser.add_argument("--export-csv", action="store_true", help="Export to CSV format")
    parser.add_argument("--output-dir", default="data/dossier_exports", help="Output directory")
    parser.add_argument("--limit", type=int, help="Limit number of entities")
    parser.add_argument("--verbose", action="store_true")

    args = parser.parse_args()

    if args.verbose:
        logging.basicConfig(level=logging.INFO)

    collector = SupabaseDataCollector()

    if args.export_csv:
        print("Exporting Supabase data to CSV format...")
        result = collector.export_to_csv_format(args.output_dir)

        print("\nExport Complete:")
        print(f"  Entities: {result['entities_exported']}")
        print(f"  Core CSV: {result['core_csv']}")
        print(f"  Leadership CSV: {result['leadership_csv']}")

    elif args.entity_id:
        print(f"\nFetching dossier data for {args.entity_id}...")
        data = collector.get_dossier_data(args.entity_id)

        print("\nEntity Data:")
        print(f"  Name: {data.get('entity_name')}")
        print(f"  Type: {data.get('entity_type')}")
        print(f"  Sport: {data.get('sport')}")
        print(f"  Country: {data.get('country')}")
        print(f"  League: {data.get('league_or_competition')}")
        print(f"  Website: {data.get('website')}")
        print(f"  Leadership: {data.get('leadership_count')} records")

    else:
        # List all entities
        entities = collector.get_all_entities(args.limit)

        print(f"\nFound {len(entities)} entities:")
        for entity in entities[:20]:  # Show first 20
            print(f"  - {entity.entity_id}: {entity.entity_name}")

        if len(entities) > 20:
            print(f"  ... and {len(entities) - 20} more")


if __name__ == "__main__":
    main()
