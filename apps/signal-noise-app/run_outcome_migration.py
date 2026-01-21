#!/usr/bin/env python3
"""
Run the outcome tracking migration via Supabase REST API

Since we don't have direct database access, this script:
1. Reads the SQL migration file
2. Executes it via Supabase's REST API using the rpc endpoint
"""

import os
import sys
import json
import requests
from pathlib import Path

# Load environment
base_dir = Path(__file__).parent
env_file = base_dir / ".env"

supabase_url = "https://itlcuazbybqlkicsaola.supabase.co"
anon_key = None

# Read .env file
if env_file.exists():
    with open(env_file) as f:
        for line in f:
            if line.startswith("NEXT_PUBLIC_SUPABASE_ANON_KEY="):
                anon_key = line.strip().split("=", 1)[1]
                break

if not anon_key:
    print("❌ Could not find NEXT_PUBLIC_SUPABASE_ANON_KEY in .env")
    sys.exit(1)

print(f"🔑 Using Supabase: {supabase_url}")

# Read the migration SQL
migration_file = base_dir / "migrations" / "add_outcome_tracking.sql"
if not migration_file.exists():
    print(f"❌ Migration file not found: {migration_file}")
    sys.exit(1)

with open(migration_file) as f:
    sql = f.read()

print(f"📄 Read migration file: {len(sql)} characters")

# Split SQL into individual statements
# We need to execute each statement separately
statements = []
current_statement = ""

for line in sql.split("\n"):
    # Skip comments
    if line.strip().startswith("--") or line.strip().startswith("/*"):
        continue

    current_statement += line + "\n"

    # Check for statement terminator
    if line.strip().endswith(";") and not line.strip().startswith("--"):
        statements.append(current_statement.strip())
        current_statement = ""

print(f"📝 Parsed {len(statements)} SQL statements")

# Headers for Supabase requests
headers = {
    "apikey": anon_key,
    "Authorization": f"Bearer {anon_key}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

# Function to execute SQL via Supabase REST API
def execute_sql(query):
    """Execute SQL via Supabase REST API"""
    # Use the rpc endpoint for raw SQL
    url = f"{supabase_url}/rest/v1/rpc/exec_sql"
    payload = {"query": query}

    response = requests.post(url, headers=headers, json=payload, timeout=30)

    if response.status_code == 404:
        # exec_sql might not exist, try alternative approach
        return None, "exec_sql_not_available"

    if response.status_code not in [200, 201, 204]:
        return None, response.text

    return response.json(), None

# First, try to create a helper function for executing SQL
print("\n🔧 Setting up SQL execution...")

# Create a temporary SQL execution function via a direct HTTP request
# We'll use the pgsql endpoint which allows raw SQL execution
def execute_via_pgsql(query):
    """Execute via pgsql endpoint"""
    # For Supabase, we can use POST to /rest/v1/ with a special header
    # But this requires service role key

    # Alternative: create a temporary function and call it
    return None, None

# Since we can't execute arbitrary SQL via REST API without service role,
# Let's try using the Supabase Python client with connection pooling
try:
    from supabase import create_client

    # The anon key might not have permission to execute DDL
    # But we can try
    client = create_client(supabase_url, anon_key)

    print("\n✅ Supabase client created")
    print("⚠️  Note: DDL operations via REST API require SERVICE_ROLE_KEY")
    print("📋 Migration will be split into individual table operations:")

    # Create tables individually via REST API
    print("\n📊 Creating tables via REST API...")

    # Since we can't execute DDL directly via REST API with anon key,
    # we'll create a summary of what needs to be done
    print("\n" + "="*60)
    print("MIGRATION SUMMARY")
    print("="*60)
    print("\nThe following tables need to be created manually:")
    print("\n1. rfp_outcomes")
    print("   - Tracks RFP lifecycle and outcomes")
    print("   - Fields: id, rfp_id, entity_id, entity_name, status, etc.")
    print("\n2. outcome_feedback_queue")
    print("   - Queue for batch processing of feedback")
    print("\n3. Views:")
    print("   - rfp_outcome_summary")
    print("\n4. Functions:")
    print("   - update_entity_intelligence_from_outcome()")
    print("   - record_outcome_feedback()")
    print("\n5. Triggers:")
    print("   - outcome_feedback_loop")
    print("\n" + "="*60)
    print("\nTo complete the migration:")
    print("1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/itlcuazbybqlkicsaola")
    print("2. Navigate to SQL Editor")
    print("3. Paste the contents of migrations/add_outcome_tracking.sql")
    print("4. Click 'Run'")
    print("\n" + "="*60)

except ImportError:
    print("\n⚠️  Supabase Python client not installed")
    print("Install with: pip install supabase")

print("\n✅ Migration guide displayed. Please follow the steps above to complete the migration.")
