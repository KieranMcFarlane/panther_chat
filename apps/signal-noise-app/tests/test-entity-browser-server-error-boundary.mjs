import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pageSource = readFileSync(
  new URL('../src/app/entity-browser/page.tsx', import.meta.url),
  'utf8',
)

test('entity browser page degrades when the initial database snapshot fails', () => {
  assert.match(pageSource, /function createEmptyEntityBrowserResponse/)
  assert.match(pageSource, /catch \(error\)/)
  assert.match(pageSource, /console\.error\('\[entity-browser\] Initial data load failed'/)
  assert.match(pageSource, /initialEntitiesData=\{initialEntitiesData\}/)
  assert.match(pageSource, /initialLoadError=\{initialLoadError\}/)
})
