import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const entitiesRouteSource = readFileSync(new URL('../src/app/api/entities/route.ts', import.meta.url), 'utf8')
const entitiesSearchRouteSource = readFileSync(new URL('../src/app/api/entities/search/route.ts', import.meta.url), 'utf8')
const entityDetailRouteSource = readFileSync(new URL('../src/app/api/entities/[entityId]/route.ts', import.meta.url), 'utf8')
const entityDossierRouteSource = readFileSync(new URL('../src/app/api/entities/[entityId]/dossier/route.ts', import.meta.url), 'utf8')
const graphIdSource = readFileSync(new URL('../src/lib/graph-id.ts', import.meta.url), 'utf8')

test('entity list API exposes uuid as the public id and keeps neo4j metadata', () => {
  assert.match(entitiesRouteSource, /id:\s*uuid\s*\|\|\s*entity\.id/)
  assert.match(entitiesRouteSource, /neo4j_id:\s*entity\.neo4j_id/)
})

test('entity search API returns uuid as the public id', () => {
  assert.match(entitiesSearchRouteSource, /select\('id,\s*graph_id,\s*neo4j_id,\s*labels,\s*properties'\)/)
  assert.match(entitiesSearchRouteSource, /resolveEntityUuid\(/)
  assert.match(entitiesSearchRouteSource, /id:\s*uuid/)
})

test('entity detail and dossier routes accept uuid as a direct lookup key', () => {
  assert.match(entityDetailRouteSource, /entity\.uuid\?\.toString\(\)\s*\|\|\s*entity\.id/)
  assert.match(entityDossierRouteSource, /entity\?\.uuid/)
  assert.match(entityDossierRouteSource, /matchesEntityUuid/)
})

test('graph id resolver prefers uuid before legacy fallbacks', () => {
  assert.match(graphIdSource, /toIdString\(entity\.uuid\)\s*\?\?/)
  assert.match(graphIdSource, /toIdString\(entity\.neo4j_id\)\s*\?\?/)
})
