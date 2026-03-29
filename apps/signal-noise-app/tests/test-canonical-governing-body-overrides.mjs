import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { CANONICAL_GOVERNING_BODY_OVERRIDES } from '../src/lib/canonical-governing-body-overrides.ts'

test('canonical governing-body overrides include the missing curated import entities', () => {
  const names = CANONICAL_GOVERNING_BODY_OVERRIDES.map((entity) => entity.properties?.name)

  assert.deepEqual(names, [
    'Korea Football Association',
    'U.S. Soccer Federation',
    'Mexican Football Federation',
    'USA Cricket',
    'USA Cycling',
  ])
})

test('canonical snapshot merges governing-body overrides into the live snapshot source', async () => {
  const source = await readFile(new URL('../src/lib/canonical-entities-snapshot.ts', import.meta.url), 'utf8')

  assert.match(source, /CANONICAL_GOVERNING_BODY_OVERRIDES/)
  assert.match(source, /applyCanonicalOverrides/)
})
