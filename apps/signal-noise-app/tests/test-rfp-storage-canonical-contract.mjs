import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/services/RFPStorageService.ts', import.meta.url), 'utf8')

test('rfp storage enriches entity info from the canonical snapshot before touching cached_entities', () => {
  const canonicalLookupIndex = source.indexOf('const canonicalEntities = await getCanonicalEntitiesSnapshot()')
  const cachedLookupIndex = source.indexOf(".from('cached_entities')")

  assert.ok(canonicalLookupIndex >= 0, 'RFP storage should read the canonical snapshot for entity enrichment')
  assert.ok(cachedLookupIndex >= 0, 'RFP storage can keep cached_entities as a compatibility fallback')
  assert.ok(
    canonicalLookupIndex < cachedLookupIndex,
    'RFP entity enrichment should prefer canonical entities over cached_entities',
  )
})

test('rfp storage persists canonical public identity when enriching linked entities', () => {
  assert.match(source, /canonical_entity_id/)
  assert.match(source, /resolveEntityUuid/)
})
