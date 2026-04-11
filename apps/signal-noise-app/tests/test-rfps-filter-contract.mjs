import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const rfpsSource = readFileSync(new URL('../src/app/rfps/page.tsx', import.meta.url), 'utf8')

test('rfps page uses the shared filter shell for its search controls', () => {
  assert.match(rfpsSource, /import \{ FacetFilterBar, type FacetFilterField \} from ["']@\/components\/filters\/FacetFilterBar["']/)
  assert.match(rfpsSource, /import \{ Command, CommandInput \} from ["']@\/components\/ui\/command["']/)
  assert.match(rfpsSource, /buildOpportunityFacetOptions/)
  assert.match(rfpsSource, /normalizeOpportunityTaxonomy/)
  assert.match(rfpsSource, /<FacetFilterBar/)
  assert.match(rfpsSource, /searchSlot=\{/)
  assert.match(rfpsSource, /<CommandInput/)
  assert.match(rfpsSource, /label: 'Competition'/)
  assert.match(rfpsSource, /label: 'Role'/)
  assert.match(rfpsSource, /label: 'Opportunity Kind'/)
  assert.doesNotMatch(rfpsSource, /label: 'Theme'/)
  assert.match(rfpsSource, /Canonical context:/)
})
