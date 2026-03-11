# Current Truth Report: Entity Reconciliation + Dossier Health

Generated (UTC): 2026-03-11T14:40:31Z
Generated (local): 2026-03-11T14:40:31+0000

## Data Congruence Snapshot
- cached_entities: 7277
- entity_embeddings: 4397
- entity_relationships: 63
- id_name_mismatches_raw: 0
- embeddings_not_in_cached: 0
- cached_not_in_embeddings: 2880

## Dossier Integrity Snapshot
- total_dossiers: 63
- mapped_to_existing_entity: 63
- orphan_dossiers: 0

## Recent Sync Runs (latest first)
1. id: 57c0ab08-d4c2-4d6c-a7a1-fb23eab7b751
   - sync_type: full
   - status: completed
   - started_at: 2026-03-11 14:25:12.607193+00
   - completed_at: 2026-03-11 14:27:15.413+00
   - entities_added: 0
   - entities_updated: 299
   - entities_removed: 701
   - sync_duration_ms: 124895
2. id: 72c9f4c1-55e2-4a38-8192-6330e93a54a6
   - sync_type: full
   - status: completed
   - started_at: 2026-03-11 14:15:22.596655+00
   - completed_at: 2026-03-11 14:17:02.849+00
   - entities_added: 0
   - entities_updated: 299
   - entities_removed: 701
   - sync_duration_ms: 100979
3. id: eea01e25-7102-4eb4-82a5-3be6314e545a
   - sync_type: full
   - status: completed
   - started_at: 2026-03-11 12:33:26.774542+00
   - completed_at: 2026-03-11 12:39:51.995+00
   - entities_added: 0
   - entities_updated: 571
   - entities_removed: 429
   - sync_duration_ms: 385351

## Installed Cron Block
```cron
# BEGIN PANTHER_ENTITY_OPS
0 */6 * * * cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app && (curl -fsS -m 600 -X POST http://127.0.0.1:3005/api/sync/graph-to-supabase -H 'content-type: application/json' -d '{"trigger":"cron"}' || curl -fsS -m 600 -X POST http://127.0.0.1:3010/api/sync/graph-to-supabase -H 'content-type: application/json' -d '{"trigger":"cron"}') >> logs/graph-sync-cron.log 2>&1
*/15 * * * * cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app && npm run reconciliation:monitor >> logs/reconciliation-monitor.log 2>&1
# END PANTHER_ENTITY_OPS
```

## Dossier ID Resolution Hardening
Applied dual-key cache read behavior so dossier fetch can resolve with any of:
- canonical cached_entities UUID (`id`)
- `graph_id`
- `neo4j_id`
- request fallback id

Files updated:
- `src/lib/dossier-entity.ts`
- `src/lib/entity-loader.ts`
- `src/app/api/entities/[entityId]/route.ts`
- `src/app/api/entities/[entityId]/dossier/route.ts`
