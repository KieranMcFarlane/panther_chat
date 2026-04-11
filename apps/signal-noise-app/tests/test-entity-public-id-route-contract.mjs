import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const entityBrowserDataSource = readFileSync(new URL('../src/lib/entity-browser-data.ts', import.meta.url), 'utf8')
const entitiesSearchRouteSource = readFileSync(new URL('../src/app/api/entities/search/route.ts', import.meta.url), 'utf8')
const entityDetailRouteSource = readFileSync(new URL('../src/app/api/entities/[entityId]/route.ts', import.meta.url), 'utf8')
const entityDossierRouteSource = readFileSync(new URL('../src/app/api/entities/[entityId]/dossier/route.ts', import.meta.url), 'utf8')
const graphIdSource = readFileSync(new URL('../src/lib/graph-id.ts', import.meta.url), 'utf8')

test('entity list API exposes uuid as the public id and keeps neo4j metadata', () => {
  assert.match(entityBrowserDataSource, /id:\s*uuid\s*\|\|\s*entity\.id/)
  assert.match(entityBrowserDataSource, /neo4j_id:\s*entity\.neo4j_id/)
})

test('entity search API returns uuid as the public id', () => {
  assert.match(entitiesSearchRouteSource, /getCanonicalEntitiesSnapshot\(\)/)
  assert.doesNotMatch(entitiesSearchRouteSource, /\.from\('cached_entities'\)/)
  assert.match(entitiesSearchRouteSource, /resolveEntityUuid\(/)
  assert.match(entitiesSearchRouteSource, /id:\s*uuid/)
})

test('entity detail and dossier routes accept uuid as a direct lookup key', () => {
  assert.match(entityDetailRouteSource, /entity\.uuid\s*\|\|\s*null/)
  assert.match(entityDossierRouteSource, /entity\?\.uuid/)
  assert.match(entityDossierRouteSource, /matchesEntityUuid/)
  const canonicalLookupIndex = entityDossierRouteSource.indexOf('const canonicalEntities = await getCanonicalEntitiesSnapshot()')
  const cachedLookupIndex = entityDossierRouteSource.indexOf(".from('cached_entities')")
  assert.ok(canonicalLookupIndex !== -1 && cachedLookupIndex !== -1 && canonicalLookupIndex < cachedLookupIndex)
})

test('graph id resolver prefers uuid before legacy fallbacks', () => {
  assert.match(graphIdSource, /toIdString\(entity\.uuid\)\s*\?\?/)
  assert.match(graphIdSource, /toIdString\(entity\.neo4j_id\)\s*\?\?/)
})
