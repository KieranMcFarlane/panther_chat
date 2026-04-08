import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('navigation exposes only the client path in the primary shell', async () => {
  const navSource = await readFile(new URL('../src/components/layout/AppNavigation.tsx', import.meta.url), 'utf8')

  assert.match(navSource, /Client Path/)
  assert.doesNotMatch(navSource, /Primary Surfaces/)
  assert.doesNotMatch(navSource, /Advanced Ops/)
  assert.doesNotMatch(navSource, /Utilities/)
})

test('home page is framed around canonical question-first output instead of graphiti marketing', async () => {
  const source = await readFile(new URL('../src/app/page.tsx', import.meta.url), 'utf8')

  assert.match(source, /Work only from canonical dossiers and promoted opportunities/)
  assert.match(source, /question-first dossier artifacts/)
  assert.match(source, /Promoted opportunities only/)
  assert.doesNotMatch(source, /Graphiti is the memory layer/)
  assert.doesNotMatch(source, /Fresh Graphiti Insights/)
})

test('dossier page leads with a compact workspace summary and explicit next decision', async () => {
  const source = await readFile(new URL('../src/app/entity-browser/[entityId]/dossier/client-page.tsx', import.meta.url), 'utf8')

  assert.match(source, /Entity dossier workspace/)
  assert.match(source, /Persisted dossier|Persisted entity state/)
  assert.match(source, /Next decision/)
})
