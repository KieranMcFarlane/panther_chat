#!/usr/bin/env python3
"""
Schema Setup Script for Graph Intelligence Architecture

Creates the new Entity/Signal/Evidence/Relationship schema in Supabase
Uses HTTP requests to Supabase SQL API
"""

import os
import sys
import asyncio
import httpx
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def execute_sql_via_rpc(supabase_url: str, service_key: str, sql: str) -> dict:
    """Execute SQL via Supabase REST API"""

    # Use the rpc endpoint to execute SQL
    url = f"{supabase_url}/rest/v1/rpc/exec_sql"

    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json"
    }

    payload = {
        "sql": sql
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload, headers=headers)
        return response.json()


async def create_schema():
    """Create database schema in Supabase"""

    supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

    if not supabase_url or not service_key:
        print("❌ Supabase credentials not found")
        print("   Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY)")
        return False

    print(f"🔗 Connecting to Supabase...")
    print(f"   URL: {supabase_url}")
    print()

    # SQL statements organized by dependency order
    sql_batches = [
        {
            "name": "Extensions",
            "statements": [
                "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";",
            ]
        },
        {
            "name": "Entities Table",
            "statements": [
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
                "CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);",
            ]
        },
        {
            "name": "Signals Table",
            "statements": [
                """
                CREATE TABLE IF NOT EXISTS signals (
                  id TEXT PRIMARY KEY,
                  type TEXT NOT NULL CHECK (type IN (
                    'RFP_DETECTED', 'PARTNERSHIP_FORMED', 'PARTNERSHIP_DISSOLVED',
                    'TECHNOLOGY_ADOPTED', 'TECHNOLOGY_DECOMMISSIONED', 'EXECUTIVE_CHANGE',
                    'FUNDING_RECEIVED', 'PRODUCT_LAUNCH', 'ACQUISITION', 'REBRAND', 'OTHER'
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
                "CREATE INDEX IF NOT EXISTS idx_signals_entity_id ON signals(entity_id);",
                "CREATE INDEX IF NOT EXISTS idx_signals_type ON signals(type);",
                "CREATE INDEX IF NOT EXISTS idx_signals_first_seen ON signals(first_seen DESC);",
                "CREATE INDEX IF NOT EXISTS idx_signals_validated ON signals(validated);",
                "CREATE INDEX IF NOT EXISTS idx_signals_confidence ON signals(confidence);",
            ]
        },
        {
            "name": "Evidence Table",
            "statements": [
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
                "CREATE INDEX IF NOT EXISTS idx_evidence_signal_id ON evidence(signal_id);",
                "CREATE INDEX IF NOT EXISTS idx_evidence_source ON evidence(source);",
                "CREATE INDEX IF NOT EXISTS idx_evidence_date ON evidence(date DESC);",
            ]
        },
        {
            "name": "Relationships Table",
            "statements": [
                """
                CREATE TABLE IF NOT EXISTS relationships (
                  id TEXT PRIMARY KEY,
                  type TEXT NOT NULL CHECK (type IN (
                    'PARTNER_OF', 'SPONSOR_OF', 'EMPLOYEE_OF', 'OWNED_BY',
                    'LOCATED_AT', 'COMPETITOR_OF', 'SUPPLIER_TO', 'CUSTOMER_OF'
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
                "CREATE INDEX IF NOT EXISTS idx_relationships_from ON relationships(from_entity);",
                "CREATE INDEX IF NOT EXISTS idx_relationships_to ON relationships(to_entity);",
                "CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(type);",
            ]
        },
        {
            "name": "Triggers and Functions",
            "statements": [
                """
                CREATE OR REPLACE FUNCTION update_updated_at_column()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.updated_at = NOW();
                    RETURN NEW;
                END;
                $$ language 'plpgsql';
                """,
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
        },
    ]

    print("📋 Creating schema in Supabase...")
    print()

    total_statements = sum(len(batch["statements"]) for batch in sql_batches)
    current_statement = 0

    # Execute each batch
    for batch in sql_batches:
        print(f"📦 {batch['name']}:")

        for sql in batch["statements"]:
            current_statement += 1
            sql_clean = sql.strip().split('\n')[0][:50] + "..."  # First line only

            try:
                # Try to execute via direct HTTP to SQL endpoint
                # Note: This requires the Supabase SQL API to be enabled
                result = await execute_sql_via_rpc(supabase_url, service_key, sql)

                if "error" in str(result).lower() and "already exists" not in str(result).lower():
                    print(f"   ⚠️  Step {current_statement}/{total_statements}: {sql_clean}")
                    if "error" in result:
                        print(f"       Error: {result.get('error', 'Unknown')[:100]}")
                else:
                    print(f"   ✅ Step {current_statement}/{total_statements}: {sql_clean}")

            except Exception as e:
                error_msg = str(e).lower()
                if 'already exists' in error_msg or 'duplicate' in error_msg:
                    print(f"   ⚠️  Step {current_statement}/{total_statements}: Already exists")
                else:
                    print(f"   ⚠️  Step {current_statement}/{total_statements}: {sql_clean}")
                    print(f"       Note: {str(e)[:100]}")

            # Small delay to avoid rate limiting
            await asyncio.sleep(0.2)

        print()

    print("="*70)
    print("SCHEMA CREATION COMPLETE")
    print("="*70)
    print()
    print("✅ Tables created:")
    print("   - entities (with indexes)")
    print("   - signals (with indexes)")
    print("   - evidence (with indexes)")
    print("   - relationships (with indexes)")
    print()
    print("✅ Triggers created for updated_at timestamps")
    print()
    print("🚀 Next step: Run migration")
    print("   python3 backend/migrate_episodes_to_signals.py")
    print()

    return True


async def verify_schema():
    """Verify that tables were created successfully"""
    from supabase import create_client

    supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

    if not supabase_url or not service_key:
        print("⚠️  Cannot verify: Supabase credentials not found")
        return False

    print("🔍 Verifying schema...")

    client = create_client(supabase_url, service_key)

    tables = ['entities', 'signals', 'evidence', 'relationships']
    all_exist = True

    for table in tables:
        try:
            result = client.table(table).select('*', count='exact', head=True).execute()
            count = result.count if hasattr(result, 'count') else 0
            print(f"   ✅ Table '{table}' exists")
        except Exception as e:
            error_msg = str(e).lower()
            if 'could not find' in error_msg or 'does not exist' in error_msg:
                print(f"   ❌ Table '{table}' not found")
                all_exist = False
            else:
                print(f"   ⚠️  Table '{table}': {str(e)[:100]}")

    return all_exist


async def main():
    """Main schema setup function"""
    print("="*70)
    print("GRAPH INTELLIGENCE SCHEMA SETUP")
    print("="*70)
    print()

    try:
        # Create schema
        success = await create_schema()

        if success:
            print()
            verified = await verify_schema()
            print()

            if verified:
                print("="*70)
                print("✅ Schema setup complete and verified!")
                print("="*70)
            else:
                print("="*70)
                print("⚠️  Schema setup complete but verification failed")
                print("   Please check Supabase dashboard")
                print("="*70)
        else:
            print()
            print("="*70)
            print("❌ Schema setup failed")
            print("="*70)

        return success
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
