import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pageSource = readFileSync(
  new URL('../src/app/entity-browser/[entityId]/dossier/page.tsx', import.meta.url),
  'utf8',
)

test('entity browser dossier page redirects unresolved ids back to the canonical browser', () => {
  assert.match(pageSource, /if \(!entityData\.entity\) \{/)
  assert.match(pageSource, /redirect\(['"]\/entity-browser['"]\)/)
})
