import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/app/api/cron/rfp-wide-research/route.ts', import.meta.url), 'utf8')
const vercelConfig = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')

test('wide research cron is disabled because scheduled Manus ingestion is webhook-only', () => {
  assert.match(source, /webhook-only/)
  assert.match(source, /\/api\/rfp-wide-research\/manus-webhook/)
  assert.match(source, /disabled:\s*true/)
  assert.doesNotMatch(source, /loadLatestWideRfpResearchBatch/)
  assert.doesNotMatch(source, /loadWideRfpDeltaMemoryPack/)
  assert.doesNotMatch(source, /requireCronSecret/)
  assert.doesNotMatch(vercelConfig, /\/api\/cron\/rfp-wide-research/)
})
