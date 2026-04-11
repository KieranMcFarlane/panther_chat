import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migrationSource = readFileSync(new URL('../supabase/migrations/20260410_add_canonical_entity_id_to_pipeline_and_dossiers.sql', import.meta.url), 'utf8')
const jobsSource = readFileSync(new URL('../src/lib/entity-import-jobs.ts', import.meta.url), 'utf8')
const queueSource = readFileSync(new URL('../src/lib/entity-dossier-queue.ts', import.meta.url), 'utf8')
const dossierRouteSource = readFileSync(new URL('../src/app/api/entities/[entityId]/dossier/route.ts', import.meta.url), 'utf8')

test('pipeline and dossier migration adds canonical_entity_id columns with backfill and indexes', () => {
  assert.match(migrationSource, /ALTER TABLE entity_pipeline_runs\s+ADD COLUMN IF NOT EXISTS canonical_entity_id UUID/i)
  assert.match(migrationSource, /ALTER TABLE entity_dossiers\s+ADD COLUMN IF NOT EXISTS canonical_entity_id UUID/i)
  assert.match(migrationSource, /CREATE INDEX IF NOT EXISTS idx_entity_pipeline_runs_canonical_entity_id/i)
  assert.match(migrationSource, /CREATE INDEX IF NOT EXISTS idx_entity_dossiers_canonical_entity_id/i)
  assert.match(migrationSource, /UPDATE entity_pipeline_runs epr\s+SET canonical_entity_id =/i)
  assert.match(migrationSource, /UPDATE entity_dossiers ed\s+SET canonical_entity_id =/i)
})

test('active pipeline run lookup can resolve and reuse runs by canonical uuid', () => {
  assert.match(jobsSource, /canonical_entity_id/)
  assert.match(jobsSource, /findActivePipelineRunByEntityId/)
  assert.match(jobsSource, /eq\('canonical_entity_id',/)
})

test('dossier queue writes canonical uuid into new runs and dedupes equivalent repairs by canonical identity', () => {
  assert.match(queueSource, /canonical_entity_id/)
  assert.match(queueSource, /entity\.uuid/)
  assert.match(queueSource, /findActivePipelineRunByEntityId\(/)
})

test('dossier queue resolves canonical snapshot entries before raw cached_entities lookups', () => {
  const canonicalLookupIndex = queueSource.indexOf('const canonicalEntities = await getCanonicalEntitiesSnapshot()')
  const cachedLookupIndex = queueSource.indexOf(".from('cached_entities')")

  assert.ok(canonicalLookupIndex >= 0, 'queue resolver should load the canonical snapshot')
  assert.ok(cachedLookupIndex >= 0, 'queue resolver still needs raw cached_entities fallback support')
  assert.ok(
    canonicalLookupIndex < cachedLookupIndex,
    'queue resolver should check canonical entities before raw cached_entities to avoid stale public ids',
  )
})

test('dossier route prefers canonical_entity_id when resolving persisted dossier rows and latest runs', () => {
  assert.match(dossierRouteSource, /canonical_entity_id/)
  assert.match(dossierRouteSource, /eq\('canonical_entity_id',/)
})
