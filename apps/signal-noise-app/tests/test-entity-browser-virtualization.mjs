import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const entityBrowserSource = readFileSync(
  new URL('../src/app/entity-browser/client-page.tsx', import.meta.url),
  'utf8',
)

test('entity browser uses react-window virtualization for rendered cards', () => {
  assert.match(entityBrowserSource, /from "react-window"/)
  assert.match(entityBrowserSource, /<FixedSizeList/)
})
