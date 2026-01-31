#!/usr/bin/env python3
"""
Backfill signal_category for existing episodes

This script:
1. Loads all episodes from temporal_episodes table
2. Infers signal_category from template_name/category
3. Updates each episode with canonical signal_category
"""

import asyncio
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from backend.graphiti_service import GraphitiService
from backend.temporal.category_mapper import CategoryMapper


async def migrate():
    """Backfill signal_category for existing episodes"""
    print("🔄 Starting signal_category migration...")

    # Initialize Graphiti service
    graphiti = GraphitiService()
    await graphiti.initialize()

    if not (graphiti.use_supabase and graphiti.supabase_client):
        print("❌ Supabase client not available - migration required")
        return

    # Get all episodes without signal_category
    response = graphiti.supabase_client.table('temporal_episodes') \
        .select('*') \
        .is_('signal_category', 'null') \
        .execute()

    episodes = response.data

    if not episodes:
        print("✅ No episodes to migrate (all have signal_category)")
        return

    print(f"📊 Found {len(episodes)} episodes to migrate")

    migrated_count = 0
    failed_count = 0

    for ep in episodes:
        try:
            # Get template info
            template_name = ep.get('template_name', '') or ep.get('description', '')
            current_category = ep.get('category', 'Operations')

            # Map to canonical category
            signal_category = CategoryMapper.map_template_to_category(
                template_name, current_category
            )

            # Update episode
            episode_id = ep.get('id')
            if not episode_id:
                # Try episode_id field
                episode_id = ep.get('episode_id')

            if episode_id:
                graphiti.supabase_client.table('temporal_episodes') \
                    .update({'signal_category': signal_category.value}) \
                    .eq('id', episode_id) \
                    .execute()

                migrated_count += 1

                if migrated_count % 100 == 0:
                    print(f"  Migrated {migrated_count}/{len(episodes)} episodes...")

            else:
                print(f"⚠️  Episode missing ID: {ep.get('entity_name')}")
                failed_count += 1

        except Exception as e:
            print(f"❌ Failed to migrate episode: {e}")
            failed_count += 1

    print(f"\n✅ Migration complete:")
    print(f"  - Migrated: {migrated_count} episodes")
    print(f"  - Failed: {failed_count} episodes")

    # Verify
    print("\n🔍 Verifying migration...")

    null_count_response = graphiti.supabase_client.table('temporal_episodes') \
        .select('*', count='exact') \
        .is_('signal_category', 'null') \
        .execute()

    remaining_nulls = null_count_response.count if hasattr(null_count_response, 'count') else 0

    print(f"  - Episodes without signal_category: {remaining_nulls}")

    if remaining_nulls == 0:
        print("✅ All episodes now have signal_category!")
    else:
        print(f"⚠️  {remaining_nulls} episodes still missing signal_category")


if __name__ == '__main__':
    asyncio.run(migrate())
