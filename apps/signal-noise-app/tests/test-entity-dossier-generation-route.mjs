import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dossierRoutePath = new URL('../src/app/api/entities/[entityId]/dossier/route.ts', import.meta.url)
const dossierRouteSource = readFileSync(dossierRoutePath, 'utf8')

test('dossier generation route uses relationship-table fallback-safe helpers for POI loading', () => {
  assert.match(dossierRouteSource, /async function fetchPersonsOfInterest/)
  assert.match(dossierRouteSource, /from\('entity_relationships'\)/)
  assert.match(dossierRouteSource, /return \[\];/)
  assert.match(dossierRouteSource, /source_neo4j_id\.eq\.\$\{graphKey\},target_neo4j_id\.eq\.\$\{graphKey\}/)
  assert.match(dossierRouteSource, /return \[\];/)
  assert.match(dossierRouteSource, /onConflict: 'entity_id'/)
})

test('dossier scoring avoids dividing by zero when there are no POIs', () => {
  assert.match(dossierRouteSource, /const contactability = pois\.length > 0/)
  assert.match(dossierRouteSource, /: 0;/)
})
