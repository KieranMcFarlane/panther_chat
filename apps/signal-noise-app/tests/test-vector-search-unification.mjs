import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('vector search consumers use the shared vector search client instead of raw fetch calls', async () => {
  const hookSource = await readFile(new URL('../src/hooks/useVectorSearch.ts', import.meta.url), 'utf8')
  const navSearchSource = await readFile(new URL('../src/components/ui/VectorSearch-debounced.tsx', import.meta.url), 'utf8')
  const knowledgeGraphSearchSource = await readFile(new URL('../src/components/VectorSearch.tsx', import.meta.url), 'utf8')
  const legacySearchSource = await readFile(new URL('../src/components/ui/VectorSearch.tsx', import.meta.url), 'utf8')

  assert.match(hookSource, /import \{ searchVectorEntities \} from ['"]@\/lib\/vector-search-client['"]/)
  assert.doesNotMatch(hookSource, /fetch\('\/api\/search'/)

  assert.match(navSearchSource, /import \{ searchVectorEntities \} from ['"]@\/lib\/vector-search-client['"]/)
  assert.doesNotMatch(navSearchSource, /fetch\('\/api\/vector-search'/)
  assert.doesNotMatch(navSearchSource, /fetch\('\/api\/search'/)

  assert.match(knowledgeGraphSearchSource, /useVectorSearch\(/)
  assert.match(legacySearchSource, /searchVectorEntities|useVectorSearch/)
  assert.doesNotMatch(legacySearchSource, /fetch\('\/api\/vector-search'/)
})
