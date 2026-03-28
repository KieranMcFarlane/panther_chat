import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const entityLoaderSource = readFileSync(new URL('../src/lib/entity-loader.ts', import.meta.url), 'utf8')
const canonicalDossierRouteSource = readFileSync(new URL('../src/app/api/entities/[entityId]/dossier/route.ts', import.meta.url), 'utf8')
const legacyDossierRouteSource = readFileSync(new URL('../src/app/api/dossier/route.ts', import.meta.url), 'utf8')
const legacyDossierFileRouteSource = readFileSync(new URL('../src/app/api/dossier/file/route.ts', import.meta.url), 'utf8')
const canonicalRfpRouteSource = readFileSync(new URL('../src/app/api/rfp-opportunities/route.ts', import.meta.url), 'utf8')
const tendersAliasSource = readFileSync(new URL('../src/app/api/tenders/route.ts', import.meta.url), 'utf8')

test('entity loader no longer uses dossier-file fallbacks on UI-serving reads', () => {
  assert.doesNotMatch(entityLoaderSource, /dossier-file/)
  assert.doesNotMatch(entityLoaderSource, /resolveCanonicalQuestionFirstDossier/)
  assert.doesNotMatch(entityLoaderSource, /getFallbackEntityFromDossier/)
})

test('canonical entity dossier API only reads persisted dossiers and queue state', () => {
  assert.match(canonicalDossierRouteSource, /from\('entity_dossiers'\)/)
  assert.match(canonicalDossierRouteSource, /from\('entity_pipeline_runs'\)/)
  assert.doesNotMatch(canonicalDossierRouteSource, /resolveCanonicalQuestionFirstDossier/)
})

test('legacy dossier endpoints are removed in favor of canonical entity dossier APIs', () => {
  assert.match(legacyDossierRouteSource, /status:\s*'gone'/)
  assert.match(legacyDossierRouteSource, /canonical_route:\s*'\/api\/entities\/\[entityId\]\/dossier'/)
  assert.match(legacyDossierFileRouteSource, /Filesystem dossier reads are no longer allowed/)
  assert.match(legacyDossierFileRouteSource, /status:\s*'gone'/)
})

test('rfp APIs are unified on rfp_opportunities_unified', () => {
  assert.match(canonicalRfpRouteSource, /loadUnifiedRfpOpportunities/)
  assert.match(canonicalRfpRouteSource, /rfp_opportunities_unified/)
  assert.doesNotMatch(canonicalRfpRouteSource, /\.from\('rfp_opportunities'\)/)
  assert.match(tendersAliasSource, /loadUnifiedRfpOpportunities/)
  assert.match(tendersAliasSource, /deprecated:\s*true/)
  assert.doesNotMatch(tendersAliasSource, /\.from\('rfp_opportunities'\)/)
})
