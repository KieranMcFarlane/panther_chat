# Episode → Signal Migration Instructions

## Overview

This document provides step-by-step instructions for migrating existing Episode-based temporal data to the new Entity/Signal/Evidence schema.

## Prerequisites

1. **Environment Variables** (ensure these are set in `.env`):
   - `FALKORDB_URI`
   - `FALKORDB_PASSWORD`
   - `FALKORDB_USER`
   - `FALKORDB_DATABASE`
   - `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`

2. **Backup** (REQUIRED):
   ```bash
   python3 backend/backup_graphiti_data.py
   ```

## Migration Steps

### Step 1: Verify Data to Migrate

Check how many episodes exist:

```python
from supabase import create_client
import os

supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_ANON_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

client = create_client(supabase_url, supabase_key)
response = client.table('temporal_episodes').select("*").execute()

print(f"Episodes to migrate: {len(response.data)}")
for episode in response.data:
    print(f"  - {episode.get('entity_name')}: {episode.get('episode_type')}")
```

### Step 2: Dry Run Migration

Test the migration without making changes:

```bash
# Load environment variables
export $(grep -v '^#' .env | xargs)

# Run dry-run
python3 backend/migrate_episodes_to_signals.py --dry-run
```

Review the output to ensure:
- Entity mappings look correct
- Signal types are properly mapped
- Evidence is preserved

### Step 3: Run Actual Migration

Once dry-run looks good:

```bash
# Load environment variables
export $(grep -v '^#' .env | xargs)

# Run migration
python3 backend/migrate_episodes_to_signals.py
```

### Step 4: Verify Migration

Run verification after migration completes:

```bash
python3 backend/migrate_episodes_to_signals.py --verify
```

Expected output:
- `episode_to_signal_ratio`: Should be approximately 1:1
- Signal count should match or exceed episode count
- No critical errors

## Migration Mapping

| Episode Field | Signal/Evidence Field | Notes |
|--------------|---------------------|-------|
| episode.episode_type | Signal.type | Mapped via `map_episode_type_to_signal_type()` |
| Episode.organization | Entity.id | Entities created if needed |
| Episode.source | Evidence.source | Preserved as-is |
| Episode.date | Evidence.date | Preserved as-is |
| Episode.confidence_score | Signal.confidence | Defaults to 0.7 if missing |
| Episode.metadata | Signal.metadata | Merged with migration metadata |
| Episode.url | Evidence.url | Preserved if present |
| Episode.description | Evidence.extracted_text | Full text preserved |

## Rollback Plan

If migration fails:

1. **Restore from backup**:
   ```bash
   # Find latest backup
   ls -lt backups/

   # Restore Supabase tables (if needed)
   # Restore FalkorDB data (if needed)
   ```

2. **Revert code changes**:
   - `backend/schemas.py` - New schema
   - `backend/graphiti_service.py` - New methods
   - `backend/graphiti_mcp_server.py` - New MCP server

3. **Verify system health**:
   ```bash
   npm run dev
   ```

## Post-Migration Tasks

1. **Update scrapers** to use new schema:
   - Ralph Loop validation now required
   - Signals written via `/api/signals/validate` endpoint

2. **Update queries** to use new graph intelligence tools:
   - `mcp__graphiti-intelligence__query_entity`
   - `mcp__graphiti-intelligence__query_subgraph`
   - `mcp__graphiti-intelligence__find_related_signals`

3. **Monitor system** for issues:
   - Check alert generation
   - Verify query responses
   - Monitor Ralph Loop validation performance

## Troubleshooting

### Issue: "Missing required environment variables"

**Solution**: Export environment variables before running migration:
```bash
export $(grep -v '^#' .env | xargs)
python3 backend/migrate_episodes_to_signals.py --dry-run
```

### Issue: "Supabase client not available"

**Solution**: Verify Supabase credentials in `.env`:
```bash
grep SUPABASE .env
```

### Issue: "FalkorDB connection failed"

**Solution**: Verify FalkorDB is running and credentials are correct:
```bash
grep FALKORDB .env
```

### Issue: "Signals table doesn't exist"

**Solution**: Run database setup script first:
```bash
# The migration script will create tables automatically
# If it fails, check Supabase schema
```

## Support

For issues or questions:
1. Check migration report in `backups/migration_report_*.json`
2. Review logs in console output
3. Verify backup exists before attempting migration
