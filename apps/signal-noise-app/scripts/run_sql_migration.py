#!/usr/bin/env python3
"""
Run SQL migration for signal_category column

This script executes the SQL migration to add the signal_category column
to the temporal_episodes table via Supabase.
"""

import asyncio
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

try:
    from supabase import create_client
    import os
    from dotenv import load_dotenv

    # Load environment
    load_dotenv()

    SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    SUPABASE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ Supabase credentials not found in environment")
        print(f"   SUPABASE_URL: {bool(SUPABASE_URL)}")
        print(f"   SUPABASE_KEY: {bool(SUPABASE_KEY)}")
        sys.exit(1)

    print("🔗 Connecting to Supabase...")

    # Use service role key for admin operations
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or SUPABASE_KEY

    # Create Supabase client
    supabase = create_client(SUPABASE_URL, service_key)

    # SQL statements to execute
    sql_statements = [
        # Add signal_category column
        "ALTER TABLE temporal_episodes ADD COLUMN IF NOT EXISTS signal_category VARCHAR(50);",

        # Create index on signal_category
        "CREATE INDEX IF NOT EXISTS idx_temporal_episodes_signal_category ON temporal_episodes(signal_category);",

        # Create composite index
        "CREATE INDEX IF NOT EXISTS idx_temporal_episodes_entity_category ON temporal_episodes(entity_id, signal_category);",

        # Create category-only index
        "CREATE INDEX IF NOT EXISTS idx_temporal_episodes_category_only ON temporal_episodes(signal_category);"
    ]

    print("📊 Running SQL migration...")

    # Note: Supabase Python client doesn't support raw SQL execution directly
    # We need to use PostgreSQL connection instead
    print("\n⚠️  SQL migration requires direct PostgreSQL access")
    print("\nPlease run the following SQL via Supabase dashboard:")
    print("https://app.supabase.com/project/YOUR-PROJECT/sql")
    print("\nOr use the Supabase CLI:")
    print("supabase db execute --file backend/migrations/001_add_signal_category_to_episodes.sql")
    print("\nMigration SQL content:")
    print("=" * 70)

    with open(backend_dir / "migrations" / "001_add_signal_category_to_episodes.sql") as f:
        print(f.read())

    print("=" * 70)

except ImportError as e:
    print(f"❌ Missing dependencies: {e}")
    print("Install with: pip install supabase python-dotenv")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
