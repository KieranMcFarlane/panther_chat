import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('vector search route uses canonical entity search text and canonical dedupe keys', async () => {
  const source = await readFile(new URL('../src/app/api/vector-search/route.ts', import.meta.url), 'utf8')

  assert.match(source, /buildCanonicalEntitySearchText/)
  assert.match(source, /getCanonicalEntityRole/)
  assert.match(source, /resolveEntityUuid/)
  assert.match(source, /getCanonicalEntityKey/)
  assert.match(source, /canonical.*key/i)
  assert.match(source, /roleBoost/i)
  assert.match(source, /searchText/i)
})
