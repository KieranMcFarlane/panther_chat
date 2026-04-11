import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('legacy /api/search shims through the canonical vector search service', async () => {
  const source = await readFile(new URL('../src/app/api/search/route.ts', import.meta.url), 'utf8')

  assert.match(source, /import \{ searchVectorEntities \} from ['"]@\/lib\/vector-search-service['"]/)
  assert.match(source, /import \{ toLegacySearchResponse \} from ['"]@\/lib\/vector-search-service['"]/)
  assert.doesNotMatch(source, /from '[@"]?\/lib\/cached-entities-supabase/)
  assert.doesNotMatch(source, /from '[@"]?\/lib\/graph-id/)
  assert.doesNotMatch(source, /from '[@"]?\/lib\/entity-public-id/)
})
