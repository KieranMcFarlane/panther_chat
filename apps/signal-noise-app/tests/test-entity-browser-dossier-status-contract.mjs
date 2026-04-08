import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const entitiesRouteSource = readFileSync(new URL('../src/app/api/entities/route.ts', import.meta.url), 'utf8')
const entityCardSource = readFileSync(new URL('../src/components/EntityCard.tsx', import.meta.url), 'utf8')

test('entity browser api exposes lightweight dossier index fields for cards', () => {
  assert.match(entitiesRouteSource, /dossier_status/)
  assert.match(entitiesRouteSource, /latest_generated_at/)
  assert.match(entitiesRouteSource, /latest_dossier_path/)
  assert.match(entitiesRouteSource, /latest_run_id/)
})

test('entity browser api avoids per-row dossier index resolution on the hot path', () => {
  assert.doesNotMatch(entitiesRouteSource, /getEntityDossierIndexRecord/)
  assert.match(entitiesRouteSource, /function buildLightweightDossierIndexFromEntityState/)
  assert.match(entitiesRouteSource, /dossier_status:\s*lightweightDossierIndex\.dossier_status/)
})

test('entity cards surface dossier availability and freshness status', () => {
  assert.match(entityCardSource, /dossier_status/)
  assert.match(entityCardSource, /Dossier ready|Dossier pending|Needs rerun/)
  assert.match(entityCardSource, /latest_generated_at/)
})
