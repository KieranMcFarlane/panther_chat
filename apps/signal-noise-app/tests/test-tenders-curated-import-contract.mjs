import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('tenders API is reduced to a deprecated canonical alias over the unified RFP store', async () => {
  const source = await readFile(new URL('../src/app/api/tenders/route.ts', import.meta.url), 'utf8')

  assert.match(source, /loadUnifiedRfpOpportunities/)
  assert.match(source, /source: 'rfp_opportunities_unified'/)
  assert.match(source, /deprecated:\s*true/)
})

test('tenders alias does not write curated import data through legacy raw-table code paths', async () => {
  const source = await readFile(new URL('../src/app/api/tenders/route.ts', import.meta.url), 'utf8')

  assert.doesNotMatch(source, /linkOpportunityToCanonicalEntity/)
  assert.doesNotMatch(source, /digital-rfp-opportunities\.js/)
  assert.doesNotMatch(source, /real-rfp-opportunities\.js/)
})

test('tenders alias no longer exposes controlled batch import actions', async () => {
  const source = await readFile(new URL('../src/app/api/tenders/route.ts', import.meta.url), 'utf8')

  assert.doesNotMatch(source, /import-controlled-batch-opportunities/)
  assert.doesNotMatch(source, /perplexity-rfp-50-entities-supabase-ready\.json/)
  assert.doesNotMatch(source, /rfp-results\.json/)
})
