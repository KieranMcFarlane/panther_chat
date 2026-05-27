import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const browserSource = readFileSync(
  new URL('../src/components/rfp/RfpOpportunitiesBrowser.tsx', import.meta.url),
  'utf8',
)

test('rfps browser keeps filters and pagination in URL-backed SPA state', () => {
  assert.match(browserSource, /window\.history/)
  assert.match(browserSource, /pushState/)
  assert.match(browserSource, /replaceState/)
  assert.match(browserSource, /popstate/)
  assert.match(browserSource, /URLSearchParams/)
  assert.match(browserSource, /category/)
  assert.match(browserSource, /type/)
  assert.match(browserSource, /RFPs ·/)
  assert.match(browserSource, /Signals ·/)
  assert.match(browserSource, /page/)
  assert.doesNotMatch(browserSource, /href=\{`\/rfps\?page/)
})
