import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const entityLoaderPath = new URL('../src/lib/entity-loader.ts', import.meta.url)
const entityLoaderSource = readFileSync(entityLoaderPath, 'utf8')

test('entity dossier loader prioritizes canonical uuid matching before raw cached entity id lookup', () => {
  const canonicalLookupIndex = entityLoaderSource.indexOf('const canonicalEntities = await getCanonicalEntitiesSnapshot()')
  const cachedEntityLookupIndex = entityLoaderSource.indexOf(".from('cached_entities')")

  assert.notEqual(canonicalLookupIndex, -1)
  assert.notEqual(cachedEntityLookupIndex, -1)
  assert.ok(
    canonicalLookupIndex < cachedEntityLookupIndex,
    'canonical uuid lookup should happen before raw cached_entities id matching to avoid id collisions',
  )
})

test('entity dossier loader resolves cached canonical name matches before team table fallbacks', () => {
  const cachedNameLookupIndex = entityLoaderSource.indexOf(".ilike('properties->>name'")
  const teamLookupIndex = entityLoaderSource.indexOf(".from('teams')")

  assert.notEqual(cachedNameLookupIndex, -1)
  assert.notEqual(teamLookupIndex, -1)
  assert.ok(
    cachedNameLookupIndex < teamLookupIndex,
    'cached_entities canonical-name resolution should happen before teams fallback to avoid divergent UUIDs for slug aliases',
  )
})

test('entity dossier loader normalizes slug aliases by stripping year suffixes before cached canonical name lookup', () => {
  assert.match(entityLoaderSource, /replace\(\/\\b20\\d\{2\}\\b\/g, ''\)/)
})

test('entity dossier loader prefers the best persisted dossier candidate instead of the newest malformed row', () => {
  assert.match(entityLoaderSource, /selectBestPersistedDossierCandidate/)
  assert.match(entityLoaderSource, /\.select\('dossier_data, created_at, generated_at'\)/)
  assert.match(entityLoaderSource, /\.limit\(5\)/)
})
