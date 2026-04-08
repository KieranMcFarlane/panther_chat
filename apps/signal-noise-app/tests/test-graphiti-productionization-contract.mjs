import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migrationSource = readFileSync(new URL('../migrations/20260407_graphiti_productionization.sql', import.meta.url), 'utf8')
const persistenceSource = readFileSync(new URL('../src/lib/graphiti-persistence.ts', import.meta.url), 'utf8')
const loaderSource = readFileSync(new URL('../src/lib/graphiti-insight-loader.ts', import.meta.url), 'utf8')

test('graphiti productionization migration creates persisted insight and notification state tables', () => {
  assert.match(migrationSource, /create table if not exists public\.graphiti_materialized_insights/i)
  assert.match(migrationSource, /create table if not exists public\.graphiti_notifications/i)
  assert.match(migrationSource, /create table if not exists public\.entity_dossier_ops/i)
  assert.match(migrationSource, /unique \(insight_id, state_hash\)/i)
})

test('graphiti persistence computes state hashes and upserts notifications on state changes', () => {
  assert.match(persistenceSource, /createHash\('sha256'\)/)
  assert.match(persistenceSource, /state_hash/)
  assert.match(persistenceSource, /upsert\(persistedRows, \{ onConflict: 'insight_id' \}\)/)
  assert.match(persistenceSource, /graphiti_notifications/)
  assert.match(persistenceSource, /ignoreDuplicates: true/)
})

test('graphiti persistence does not persist demo fallback insights into the productionized materialized store', () => {
  assert.doesNotMatch(persistenceSource, /Materializing demo fallback Graphiti insights/)
  assert.doesNotMatch(persistenceSource, /getDemoGraphitiInsights/)
})

test('graphiti persisted loader filters demo-origin rows before serving the homepage feed', () => {
  assert.match(persistenceSource, /function isDemoOriginInsight/)
  assert.match(persistenceSource, /filter\(\(row\)\s*=>\s*!isDemoOriginInsight\(row\)\)/)
})

test('graphiti persistence prefers recent real pipeline rows before the demo fallback and resolves canonical dossier ids', () => {
  assert.match(persistenceSource, /Materializing recent Graphiti pipeline context rows/)
  assert.match(persistenceSource, /resolveCanonicalGraphitiInsight/)
  assert.match(persistenceSource, /resolvePinnedSmokeEntities/)
  assert.match(persistenceSource, /destination_url: `\/entity-browser\/\$\{entityId\}\/dossier\?from=1`/)
})

test('graphiti notifications load only from active materialized insights', () => {
  assert.match(persistenceSource, /graphiti_materialized_insights/)
  assert.match(persistenceSource, /\.eq\('is_active', true\)/)
  assert.match(persistenceSource, /\.in\('insight_id', activeInsightIds\)/)
  assert.match(persistenceSource, /deduped = new Map<string, PersistedNotificationRow>\(\)/)
})

test('graphiti loader prefers persisted insights and disables demo fallback in production', () => {
  assert.match(loaderSource, /loadGraphitiInsightsWithPersistence/)
  assert.match(loaderSource, /clientFacingOnly:\s*true/)
  assert.match(loaderSource, /allowDemoFallbacks/)
  assert.match(loaderSource, /isProductionRuntime/)
})
