import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('navigation labels primary surfaces and operational utilities distinctly', async () => {
  const navSource = await readFile(new URL('../src/components/layout/AppNavigation.tsx', import.meta.url), 'utf8')

  assert.match(navSource, /Primary Surfaces/)
  assert.match(navSource, /Advanced Ops/)
  assert.match(navSource, /Utilities/)
})

test('dossier page leads with a compact workspace summary and explicit next decision', async () => {
  const source = await readFile(new URL('../src/app/entity-browser/[entityId]/dossier/client-page.tsx', import.meta.url), 'utf8')

  assert.match(source, /Entity dossier workspace/)
  assert.match(source, /Persisted dossier|Persisted entity state/)
  assert.match(source, /Next decision/)
})
