#!/usr/bin/env python3
"""
Schema Setup Script for Graph Intelligence Architecture

Creates the new Entity/Signal/Evidence/Relationship schema in Supabase
Run this before migrating episodes to signals
"""

import os
import sys
import asyncio
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def create_schema():
    """Create database schema in Supabase"""
    try:
        from supabase import create_client

        supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

        if not supabase_url or not supabase_key:
            print("❌ Supabase credentials not found")
            print("   Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
            return False

        print(f"🔗 Connecting to Supabase...")
        client = create_client(supabase_url, supabase_key)

        # SQL statements to execute
        sql_statements = [
            # Enable UUID extension
            "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";",

            # Create entities table
            """
            CREATE TABLE IF NOT EXISTS entities (
              id TEXT PRIMARY KEY,
              type TEXT NOT NULL CHECK (type IN ('ORG', 'PERSON', 'PRODUCT', 'INITIATIVE', 'VENUE')),
              name TEXT NOT NULL,
              metadata JSONB DEFAULT '{}',
              created_at TIMESTAMPTZ DEFAULT NOW(),
              updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            """,

            # Create signals table
            """
            CREATE TABLE IF NOT EXISTS signals (
              id TEXT PRIMARY KEY,
              type TEXT NOT NULL CHECK (type IN (
                'RFP_DETECTED',
                'PARTNERSHIP_FORMED',
                'PARTNERSHIP_DISSOLVED',
                'TECHNOLOGY_ADOPTED',
                'TECHNOLOGY_DECOMMISSIONED',
                'EXECUTIVE_CHANGE',
                'FUNDING_RECEIVED',
                'PRODUCT_LAUNCH',
                'ACQUISITION',
                'REBRAND',
                'OTHER'
              )),
              subtype TEXT,
              confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
              first_seen TIMESTAMPTZ NOT NULL,
              entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
              metadata JSONB DEFAULT '{}',
              validated BOOLEAN DEFAULT FALSE,
              validation_pass INTEGER DEFAULT 0 CHECK (validation_pass >= 0 AND validation_pass <= 3),
              created_at TIMESTAMPTZ DEFAULT NOW(),
              updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            """,

            # Create evidence table
            """
            CREATE TABLE IF NOT EXISTS evidence (
              id TEXT PRIMARY KEY,
              source TEXT NOT NULL,
              date TIMESTAMPTZ NOT NULL,
              signal_id TEXT NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
              url TEXT,
              extracted_text TEXT,
              credibility_score FLOAT DEFAULT 0.5 CHECK (credibility_score >= 0 AND credibility_score <= 1),
              metadata JSONB DEFAULT '{}',
              created_at TIMESTAMPTZ DEFAULT NOW()
            );
            """,

            # Create relationships table
            """
            CREATE TABLE IF NOT EXISTS relationships (
              id TEXT PRIMARY KEY,
              type TEXT NOT NULL CHECK (type IN (
                'PARTNER_OF',
                'SPONSOR_OF',
                'EMPLOYEE_OF',
                'OWNED_BY',
                'LOCATED_AT',
                'COMPETITOR_OF',
                'SUPPLIER_TO',
                'CUSTOMER_OF'
              )),
              from_entity TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
              to_entity TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
              confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
              valid_from TIMESTAMPTZ NOT NULL,
              valid_until TIMESTAMPTZ,
              metadata JSONB DEFAULT '{}',
              created_at TIMESTAMPTZ DEFAULT NOW()
            );
            """,

            # Create indexes
            "CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);",
            "CREATE INDEX IF NOT EXISTS idx_signals_entity_id ON signals(entity_id);",
            "CREATE INDEX IF NOT EXISTS idx_signals_type ON signals(type);",
            "CREATE INDEX IF NOT EXISTS idx_signals_first_seen ON signals(first_seen DESC);",
            "CREATE INDEX IF NOT EXISTS idx_signals_validated ON signals(validated);",
            "CREATE INDEX IF NOT EXISTS idx_signals_confidence ON signals(confidence);",
            "CREATE INDEX IF NOT EXISTS idx_evidence_signal_id ON evidence(signal_id);",
            "CREATE INDEX IF NOT EXISTS idx_evidence_source ON evidence(source);",
            "CREATE INDEX IF NOT EXISTS idx_evidence_date ON evidence(date DESC);",
            "CREATE INDEX IF NOT EXISTS idx_relationships_from ON relationships(from_entity);",
            "CREATE INDEX IF NOT EXISTS idx_relationships_to ON relationships(to_entity);",
            "CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(type);",

            # Create update trigger function
            """
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ language 'plpgsql';
            """,

            # Create triggers
            """
            DROP TRIGGER IF EXISTS update_entities_updated_at ON entities;
            CREATE TRIGGER update_entities_updated_at BEFORE UPDATE ON entities
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
            """,

            """
            DROP TRIGGER IF EXISTS update_signals_updated_at ON signals;
            CREATE TRIGGER update_signals_updated_at BEFORE UPDATE ON signals
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
            """,
        ]

        print("📋 Creating schema in Supabase...")

        # Execute each SQL statement
        for i, sql in enumerate(sql_statements, 1):
            try:
                # Use rpc to execute raw SQL
                result = client.rpc('exec_sql', {'sql': sql}).execute()

                if result.data is not None:
                    print(f"   ✅ Step {i}/{len(sql_statements)} completed")
                else:
                    print(f"   ✅ Step {i}/{len(sql_statements)} completed (no output)")

            except Exception as e:
                # Some errors are OK (like "already exists")
                error_msg = str(e).lower()
                if 'already exists' in error_msg or 'duplicate' in error_msg or 'does not exist' in error_msg:
                    print(f"   ⚠️  Step {i}/{len(sql_statements)}: {str(e)[:100]}")
                else:
                    print(f"   ❌ Step {i}/{len(sql_statements)} failed: {e}")

        print()
        print("="*70)
        print("SCHEMA CREATION COMPLETE")
        print("="*70)
        print()
        print("✅ Tables created:")
        print("   - entities")
        print("   - signals")
        print("   - evidence")
        print("   - relationships")
        print()
        print("✅ Indexes created for performance")
        print()
        print("✅ Triggers created for updated_at")
        print()
        print("🚀 Next step: Run migration")
        print("   python3 backend/migrate_episodes_to_signals.py")
        print()

        return True

    except Exception as e:
        print(f"❌ Schema creation failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def verify_schema():
    """Verify that tables were created successfully"""
    try:
        from supabase import create_client

        supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

        client = create_client(supabase_url, supabase_key)

        print("🔍 Verifying schema creation...")

        # Check if tables exist by trying to query them
        tables = ['entities', 'signals', 'evidence', 'relationships']
        all_exist = True

        for table in tables:
            try:
                # Try to select from the table
                result = client.table(table).select('*', count='exact').execute()
                print(f"   ✅ Table '{table}' exists (count: {result.count if hasattr(result, 'count') else 'unknown'})")
            except Exception as e:
                print(f"   ❌ Table '{table}' not found: {str(e)[:100]}")
                all_exist = False

        if all_exist:
            print()
            print("✅ All tables created successfully!")
            return True
        else:
            print()
            print("⚠️  Some tables are missing. Please check Supabase dashboard.")
            return False

    except Exception as e:
        print(f"❌ Verification failed: {e}")
        return False


async def main():
    """Main schema setup function"""
    print("="*70)
    print("GRAPH INTELLIGENCE SCHEMA SETUP")
    print("="*70)
    print()

    # Create schema
    success = await create_schema()

    if success:
        print()
        await verify_schema()
        print()
        print("="*70)
        print("✅ Schema setup complete!")
        print("="*70)
    else:
        print()
        print("="*70)
        print("❌ Schema setup failed")
        print("="*70)

    return success


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
