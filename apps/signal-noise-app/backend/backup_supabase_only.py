#!/usr/bin/env python3
"""
Simple Supabase Backup Script for Migration
Backs up temporal_episodes table only (what we need for migration)
"""

import os
import sys
import json
import asyncio
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

async def backup_supabase_episodes():
    """Backup temporal_episodes from Supabase"""
    try:
        from supabase import create_client

        supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_ANON_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

        if not supabase_url or not supabase_key:
            print("❌ Supabase credentials not found")
            return None

        client = create_client(supabase_url, supabase_key)

        # Create backup directory
        backup_dir = Path("backups")
        backup_dir.mkdir(exist_ok=True)

        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        backup_path = backup_dir / f"supabase_episodes_backup_{timestamp}.json"

        print(f"📦 Backing up temporal_episodes to {backup_path}...")

        # Fetch all episodes
        response = client.table('temporal_episodes').select("*").execute()
        episodes = response.data

        print(f"   Found {len(episodes)} episodes")

        # Write to JSON
        with open(backup_path, 'w') as f:
            json.dump({
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "count": len(episodes),
                "episodes": episodes
            }, f, indent=2, default=str)

        print(f"✅ Backup complete: {backup_path}")
        print(f"   Total episodes: {len(episodes)}")

        return {
            "backup_path": str(backup_path),
            "count": len(episodes),
            "episodes": episodes
        }

    except Exception as e:
        print(f"❌ Backup failed: {e}")
        return None

if __name__ == "__main__":
    asyncio.run(backup_supabase_episodes())
