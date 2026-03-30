# Schema Setup Instructions

## Quick Setup Option (Recommended)

The easiest way to create the schema is to use the Supabase SQL Editor in your browser:

### Step 1: Open Supabase SQL Editor
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click on "SQL Editor" in the left sidebar

### Step 2: Copy and Execute SQL
Copy the contents of `backend/create_schema.sql` and paste it into the SQL Editor
Click "Run" to execute

### Step 3: Verify
After execution, you should see:
- ✅ entities
- ✅ signals
- ✅ evidence
- ✅ relationships

In the "Table Editor" section of your Supabase dashboard

---

## Alternative: Using psql Command Line

If you have the Supabase connection string:

```bash
# From your project directory
export DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Execute the schema
psql $DATABASE_URL < backend/create_schema.sql
```

---

## Alternative: Using Supabase CLI

```bash
# Install Supabase CLI if needed
npm install -g supabase

# Link to your project
supabase link --project-ref [YOUR-PROJECT-REF]

# Execute schema
cat backend/create_schema.sql | supabase db execute
```

---

## After Schema Creation

Once the schema is created, run the migration:

```bash
# Load environment variables
export $(grep -v '^#' .env | grep -v '^$' | grep -vE '^FALKORDB' | xargs)
export NEO4J_PASSWORD="llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0"

# Run migration
python3 backend/migrate_episodes_to_signals.py

# Verify
python3 backend/migrate_episodes_to_signals.py --verify
```

---

## Verification Queries

Run these in Supabase SQL Editor to verify the schema:

```sql
-- Check tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('entities', 'signals', 'evidence', 'relationships')
ORDER BY table_name;

-- Check indexes
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('entities', 'signals', 'evidence', 'relationships')
ORDER BY tablename, indexname;

-- Expected results
```

---

## Troubleshooting

### Issue: "permission denied"
**Solution**: Make sure you're using the SERVICE_ROLE_KEY, not ANON_KEY

### Issue: "table already exists"
**Solution**: That's fine! The tables are already created from a previous run.

### Issue: "foreign key constraint failed"
**Solution**: Drop tables in reverse order:
```sql
DROP TABLE IF EXISTS evidence CASCADE;
DROP TABLE IF EXISTS signals CASCADE;
DROP TABLE IF EXISTS relationships CASCADE;
DROP TABLE IF EXISTS entities;
```

Then re-run the schema creation.

---

## Quick Test

After schema creation, test with a simple insert:

```sql
-- Test entities table
INSERT INTO entities (id, type, name)
VALUES ('test-entity', 'ORG', 'Test Organization');

-- Test signals table
INSERT INTO signals (id, type, confidence, first_seen, entity_id)
VALUES ('test-signal', 'RFP_DETECTED', 0.8, NOW(), 'test-entity');

-- Test evidence table
INSERT INTO evidence (id, source, date, signal_id)
VALUES ('test-evidence', 'Test Source', NOW(), 'test-signal');

-- Verify
SELECT * FROM entities;
SELECT * FROM signals;
SELECT * FROM evidence;

-- Cleanup test data
DELETE FROM evidence WHERE id = 'test-evidence';
DELETE FROM signals WHERE id = 'test-signal';
DELETE FROM entities WHERE id = 'test-entity';
```

---

## Next Steps

Once schema is created:

1. ✅ Tables are ready in Supabase
2. ✅ Run migration script
3. ✅ Verify migration results
4. ✅ Start using the new Entity/Signal/Evidence architecture!
