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
