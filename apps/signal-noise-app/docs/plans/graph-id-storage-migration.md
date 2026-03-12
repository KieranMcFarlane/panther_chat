# Graph ID Storage Migration Plan

## Goal
Move the app from legacy `neo4j_id`-named storage fields to graph-neutral `graph_id` naming without breaking active runtime paths.

## Current State
- Active APIs and many active consumers already expose additive aliases:
  - `graph_id`
  - `source_graph_id`
  - `target_graph_id`
- Persisted tables still use legacy column names:
  - `cached_entities.neo4j_id`
  - `entity_relationships.source_neo4j_id`
  - `entity_relationships.target_neo4j_id`
- The app still has compatibility code that translates between alias fields and storage fields.

## Migration Phases

### Phase 1: Runtime Compatibility
- Keep legacy storage columns unchanged.
- Ensure all active API responses emit graph-neutral aliases.
- Move active in-memory code to prefer `graph_id` helpers over raw `neo4j_id` access.
- Centralize that logic in [`src/lib/graph-id.ts`](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/lib/graph-id.ts).

### Phase 2: Read-Path Migration
- Update active readers to prefer:
  - `graph_id`
  - `source_graph_id`
  - `target_graph_id`
- Keep fallback reads from legacy storage-backed fields while the schema is unchanged.
- Expand regression coverage so new code does not reintroduce `neo4j_id`-only contracts.

### Phase 3: Dual-Write / Dual-Read Schema Window
- Add new columns:
  - `cached_entities.graph_id`
  - `entity_relationships.source_graph_id`
  - `entity_relationships.target_graph_id`
- Backfill from existing legacy columns.
- Update write paths to dual-write both old and new columns for one transition window.
- Add uniqueness/index constraints on the new graph-neutral columns before cutover.

### Phase 4: Cutover
- Change active read paths to use only the new graph-neutral columns.
- Remove legacy compatibility helpers from active runtime paths.
- Rename or retire any remaining user-facing copy that still mentions `neo4j_id`.

### Phase 5: Cleanup
- Drop legacy columns only after:
  - runtime reads are fully cut over
  - historical data is backfilled
  - dashboards and exports have been validated
  - no integrations still depend on the legacy names

## Risks
- Relationship lookups are the highest-risk area because both source and target IDs are used in filters.
- Batch/import tooling may still depend on `onConflict: 'neo4j_id'` behavior.
- Historical dossier/test artifacts may still deserialize `neo4j_id` directly.

## Acceptance Criteria
- No active runtime path requires `neo4j_id` to function.
- New graph-neutral columns are authoritative.
- Legacy fields are either removed or isolated behind explicit archive/compatibility boundaries.
