import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('tenders API exposes a curated source-backed import action for smoke opportunities', async () => {
  const source = await readFile(new URL('../src/app/api/tenders/route.ts', import.meta.url), 'utf8')

  assert.match(source, /import-curated-opportunities/)
  assert.match(source, /digital-rfp-opportunities\.js/)
  assert.match(source, /real-rfp-opportunities\.js/)
  assert.match(
    source,
    /const curatedSources:[\s\S]*\[\s*[\s\S]*comprehensiveRfpOpportunities[\s\S]*digitalRfpOpportunities[\s\S]*realRfpOpportunities[\s\S]*\]/,
  )
})

test('curated import passes source urls into canonical linkage so domain aliases can apply at insert time', async () => {
  const source = await readFile(new URL('../src/app/api/tenders/route.ts', import.meta.url), 'utf8')

  assert.match(
    source,
    /linkOpportunityToCanonicalEntity\s*\(\s*\{\s*[\s\S]*?description:\s*opportunity\.description,\s*[\s\S]*?source_url:\s*opportunity\.url,/,
  )
})

test('tenders API exposes a dedicated controlled batch import for the 50-entity perplexity results', async () => {
  const source = await readFile(new URL('../src/app/api/tenders/route.ts', import.meta.url), 'utf8')

  assert.match(source, /import-controlled-batch-opportunities/)
  assert.match(source, /perplexity-rfp-50-entities-supabase-ready\.json/)
  assert.match(source, /controlled-batch-library/)
})

test('controlled batch import also references the repo rfp-results fixture for the next widening batch', async () => {
  const source = await readFile(new URL('../src/app/api/tenders/route.ts', import.meta.url), 'utf8')

  assert.match(source, /rfp-results\.json/)
})
