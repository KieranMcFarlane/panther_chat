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
const cacheSyncRouteSource = readFileSync(
  new URL('../src/app/api/entities/cache-sync/route.ts', import.meta.url),
  'utf8',
)
const graphSyncRouteSource = readFileSync(
  new URL('../src/app/api/sync/neo4j-to-supabase/route.ts', import.meta.url),
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
  assert.match(entityCardSource, /pushWithViewTransition\(router,\s*`\/entity\/\$\{stableEntityId\}/)
  assert.doesNotMatch(entityCardSource, /\/entity\/\$\{entity\.neo4j_id\}/)
  assert.match(entityPageSource, /id:\s*entity\.id,/)
})

test('import and sync routes invoke canonical maintenance after writes', () => {
  assert.match(entityImportRouteSource, /runPostImportCanonicalMaintenance\('entity-import'\)/)
  assert.match(entityPipelineRouteSource, /runPostImportCanonicalMaintenance\('entity-pipeline'\)/)
  assert.match(cacheSyncRouteSource, /runPostImportCanonicalMaintenanceWithOptions\('entities-cache-sync'/)
  assert.match(graphSyncRouteSource, /runPostImportCanonicalMaintenanceWithOptions\('sync-neo4j-to-supabase'/)
})

test('deploy gate includes strict canonical congruence QA path', () => {
  assert.equal(
    packageJson.scripts['sync:post-import'],
    'npm run remediate:canonical-congruence && npm run remediate:taxonomy-hygiene && npm run qa:canonical-congruence',
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
