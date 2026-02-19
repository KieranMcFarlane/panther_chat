#!/usr/bin/env python3
"""
Add discovery_date column to temporal_episodes table

This migration adds the discovery_date column which tracks when WE discovered
evidence, separate from timestamp (which tracks when the evidence was published).
"""

import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from supabase import create_client
import httpx

def add_discovery_date_column():
    """Add discovery_date column to temporal_episodes table"""

    # Get environment variables
    supabase_url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
    supabase_key = os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

    if not supabase_url or not supabase_key:
        print("❌ Missing Supabase credentials")
        print("   Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY")
        return False

    print(f"🔗 Connecting to Supabase: {supabase_url}")

    # First, check if column exists
    check_url = f"{supabase_url}/rest/v1/temporal_episodes?select=*limit=1"
    headers = {
        'apikey': supabase_key,
        'Authorization': f'Bearer {supabase_key}'
    }

    response = httpx.get(check_url, headers=headers)
    if response.status_code != 200:
        print(f"❌ Error checking table: {response.status_code}")
        return False

    data = response.json()
    if data and 'discovery_date' in data[0]:
        print("✅ discovery_date column already exists")
        return True

    print("📋 Adding discovery_date column to temporal_episodes...")

    # Use Supabase SQL editor via API (service role key required for DDL)
    # For now, provide manual instructions
    print()
    print("⚠️  Cannot add column via REST API (service role required)")
    print()
    print("📝 Manual SQL to run in Supabase SQL Editor:")
    print("-" * 60)
    print("-- Add discovery_date column to track when we discovered evidence")
    print("-- separate from timestamp (when evidence was published)")
    print()
    print("ALTER TABLE temporal_episodes")
    print("ADD COLUMN discovery_date TIMESTAMPTZ DEFAULT NOW();")
    print()
    print("-- Add comment for documentation")
    print("COMMENT ON COLUMN temporal_episodes.discovery_date IS")
    print("'When the evidence was discovered by the system (separate from timestamp which is when evidence was published)';")
    print("-" * 60)
    print()
    print("🔗 SQL Editor: https://supabase.com/dashboard/project/itlcuazbybqlkicsaola/sql")

    return False


if __name__ == "__main__":
    # Load .env file
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                if '=' in line and not line.startswith('#'):
                    key, value = line.strip().split('=', 1)
                    os.environ[key] = value

    add_discovery_date_column()
