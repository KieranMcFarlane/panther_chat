import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/lib/entity-import-rfp.ts', import.meta.url), 'utf8')

test('csv import promotes RFP signals into the canonical unified RFP table', () => {
  assert.match(source, /\.from\('rfp_opportunities_unified'\)/)
  assert.doesNotMatch(source, /\.from\('rfp_opportunities'\)/)
})
