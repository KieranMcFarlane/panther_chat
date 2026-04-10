import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const rfpsSource = readFileSync(new URL('../src/app/rfps/page.tsx', import.meta.url), 'utf8')

test('rfps page uses the shared filter shell for its search controls', () => {
  assert.match(rfpsSource, /import \{ FacetFilterBar \} from ["']@\/components\/filters\/FacetFilterBar["']/)
  assert.match(rfpsSource, /import \{ Command, CommandInput \} from ["']@\/components\/ui\/command["']/)
  assert.match(rfpsSource, /<FacetFilterBar/)
  assert.match(rfpsSource, /searchSlot=\{/)
  assert.match(rfpsSource, /<CommandInput/)
})
