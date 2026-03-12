import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const helperPath = new URL('../src/lib/dossier-entity.ts', import.meta.url)
const loaderPath = new URL('../src/lib/entity-loader.ts', import.meta.url)
const entityRoutePath = new URL('../src/app/api/entities/[entityId]/route.ts', import.meta.url)
const dossierRoutePath = new URL('../src/app/api/entities/[entityId]/dossier/route.ts', import.meta.url)
const enhancedClubDossierPath = new URL('../src/components/entity-dossier/EnhancedClubDossier.tsx', import.meta.url)

const helperSource = readFileSync(helperPath, 'utf8')
const loaderSource = readFileSync(loaderPath, 'utf8')
const entityRouteSource = readFileSync(entityRoutePath, 'utf8')
const dossierRouteSource = readFileSync(dossierRoutePath, 'utf8')
const enhancedClubDossierSource = readFileSync(enhancedClubDossierPath, 'utf8')

test('dossier entity helper resolves canonical dossier ids from Supabase-backed entities', () => {
  assert.match(helperSource, /export async function resolveEntityForDossier/)
  assert.match(helperSource, /export function getCanonicalDossierEntityId/)
  assert.match(helperSource, /return String\(entity\?\.id \|\| fallbackEntityId\)/)
})

test('dossier loader reads persisted output by canonical entity id only', () => {
  assert.match(loaderSource, /getCanonicalDossierEntityId\(entity, entityId\)/)
  assert.match(loaderSource, /\.eq\('entity_id', entityId\)/)
  assert.doesNotMatch(loaderSource, /\.in\('entity_id', lookupIds\)/)
})

test('entity apis use canonical dossier ids and do not read embedded dossier_data', () => {
  assert.match(entityRouteSource, /resolveEntityForDossier\(entityId\)/)
  assert.match(entityRouteSource, /getCanonicalDossierEntityId\(entity, entityId\)/)
  assert.doesNotMatch(entityRouteSource, /entity\.properties\.dossier_data/)
  assert.match(dossierRouteSource, /resolveCanonicalEntityId\(entityId\)/)
  assert.match(dossierRouteSource, /await cacheDossier\(canonicalEntityId, dossier\)/)
  assert.match(dossierRouteSource, /await getCachedDossier\(canonicalEntityId\)/)
})

test('runtime entity helpers and club dossier ui do not consume embedded dossier_data props', () => {
  assert.match(helperSource, /function stripEmbeddedDossierData/)
  assert.match(helperSource, /const \{ dossier_data, neo4j_id, supabase_id, id, \.\.\.rest \} = properties/)
  assert.doesNotMatch(enhancedClubDossierSource, /props\.dossier_data/)
})
