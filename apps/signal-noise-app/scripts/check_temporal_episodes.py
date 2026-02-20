#!/usr/bin/env python3
"""
Check temporal_episodes table structure
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
    SUPABASE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_ANON_KEY")

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ Supabase credentials not found")
        sys.exit(1)

    print("🔗 Connecting to Supabase...")

    # Create Supabase client
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    print("📊 Checking temporal_episodes table...")

    # Try to query the table
    try:
        response = supabase.table('temporal_episodes').select('*', count='exact').limit(1).execute()

        print(f"✅ Table exists")
        print(f"   Total episodes: {response.count}")

        # Get a sample to see columns
        if response.data:
            sample = response.data[0]
            print(f"\n📋 Sample columns found:")
            for key in sorted(sample.keys()):
                value = sample[key]
                if isinstance(value, str) and len(value) > 50:
                    value = value[:50] + "..."
                print(f"   - {key}: {value}")

            # Check if signal_category exists
            if 'signal_category' in sample:
                print(f"\n✅ signal_category column EXISTS")
            else:
                print(f"\n⚠️  signal_category column DOES NOT EXIST")
                print(f"\n📝 To add it, run this SQL in Supabase dashboard:")
                print(f"   https://app.supabase.com")
                print(f"\nSQL:")
                print(f"   ALTER TABLE temporal_episodes ADD COLUMN IF NOT EXISTS signal_category VARCHAR(50);")
                print(f"   CREATE INDEX IF NOT EXISTS idx_temporal_episodes_signal_category")
                print(f"   ON temporal_episodes(signal_category);")

        else:
            print("⚠️  No episodes found in table")

    except Exception as e:
        if 'does not exist' in str(e):
            print("❌ Table temporal_episodes does not exist")
            print("\n💡 You need to create the table first")
        else:
            print(f"❌ Error: {e}")
            import traceback
            traceback.print_exc()

except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
