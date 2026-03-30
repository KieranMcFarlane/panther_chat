import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const entityCardSource = readFileSync(
  new URL('../src/components/EntityCard.tsx', import.meta.url),
  'utf8',
)
const entityPageSource = readFileSync(
  new URL('../src/app/entity/[entityId]/client-page.tsx', import.meta.url),
  'utf8',
)
const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
)
const entityImportRouteSource = readFileSync(
  new URL('../src/app/api/entity-import/route.ts', import.meta.url),
  'utf8',
)
const entityPipelineRouteSource = readFileSync(
  new URL('../src/app/api/entity-pipeline/route.ts', import.meta.url),
  'utf8',
)
const falkorSyncRouteSource = readFileSync(
  new URL('../src/app/api/sync/falkordb-to-supabase/route.ts', import.meta.url),
  'utf8',
)
const adminAuditRouteSource = readFileSync(
  new URL('../src/app/api/admin/canonical-maintenance-audit/route.ts', import.meta.url),
  'utf8',
)
const adminAuditPageSource = readFileSync(
  new URL('../src/app/admin/canonical-maintenance/page.tsx', import.meta.url),
  'utf8',
)

test('entity routing uses canonical stable id rather than neo4j_id-specific navigation', () => {
  assert.match(entityCardSource, /stableEntityId/)
  assert.match(entityCardSource, /router\.push\(href\)/)
  assert.doesNotMatch(entityCardSource, /router\.push\(`\/entity\/\$\{entity\.neo4j_id\}/)
  assert.match(entityPageSource, /id:\s*entity\.id,/)
})

test('import and sync routes use the current canonical write path', () => {
  assert.match(entityImportRouteSource, /upsertImportedEntityIntoFalkor/)
  assert.match(entityImportRouteSource, /createEntityPipelineRuns/)
  assert.match(entityPipelineRouteSource, /createEntityImportBatch/)
  assert.match(entityPipelineRouteSource, /queueEntityImportBatch/)
  assert.match(entityPipelineRouteSource, /upsertImportedEntityIntoFalkor/)
  assert.match(falkorSyncRouteSource, /RealtimeSyncService/)
  assert.match(falkorSyncRouteSource, /performFullSync/)
})

test('deploy gate includes strict canonical congruence QA path', () => {
  assert.equal(
    packageJson.scripts['sync:post-import'],
    'npm run remediate:canonical-congruence && npm run remediate:taxonomy-hygiene && npm run qa:canonical-congruence && npm run qa:entity-congruence-audit',
  )
  assert.equal(
    packageJson.scripts['verify:canonical-congruence'],
    'npm run canonical:rebuild && npm run sync:post-import',
  )
  assert.match(packageJson.scripts['verify:entity-data'], /verify:canonical-congruence/)
  assert.equal(packageJson.scripts['predeploy:entity-data'], 'npm run verify:entity-data')
})

test('canonical maintenance admin audit surface is available', () => {
  assert.match(adminAuditRouteSource, /from\('canonical_maintenance_audit'\)/)
  assert.match(adminAuditRouteSource, /select\('id,sync_run_id,trigger,status/)
  assert.match(adminAuditPageSource, /\/api\/admin\/canonical-maintenance-audit/)
  assert.match(adminAuditPageSource, /Canonical Maintenance Audit/)
})
