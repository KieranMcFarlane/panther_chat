import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/lib/rfp-wide-research-store.ts', import.meta.url), 'utf8')

test('wide research store uses the shared canonical cache table', () => {
  assert.match(source, /wide_rfp_research_batches/)
  assert.match(source, /getSupabaseAdmin/)
  assert.match(source, /upsert/)
  assert.match(source, /loadLatestWideRfpResearchBatch/)
  assert.match(source, /persistWideRfpResearchBatch/)
  assert.match(source, /joinWideRfpResearchBatches/)
  assert.match(source, /readLatestWideRfpResearchArtifact/)
  assert.match(source, /writeWideRfpResearchArtifact/)
})
