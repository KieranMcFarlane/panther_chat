import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('tenders API is a deprecated canonical alias over the unified RFP store', async () => {
  const source = await readFile(new URL('../src/app/api/tenders/route.ts', import.meta.url), 'utf8')

  assert.match(source, /loadUnifiedRfpOpportunities/)
  assert.match(source, /rfp_opportunities_unified/)
  assert.match(source, /deprecated:\s*true/)
  assert.doesNotMatch(source, /\.from\('rfp_opportunities'\)/)
})
