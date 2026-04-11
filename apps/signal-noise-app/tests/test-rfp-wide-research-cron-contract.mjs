import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/app/api/cron/rfp-wide-research/route.ts', import.meta.url), 'utf8')

test('wide research cron reuses the latest successful prompt and routes through the Manus worker', () => {
  assert.match(source, /requireCronSecret/)
  assert.match(source, /readLatestWideRfpResearchArtifact/)
  assert.match(source, /latest\.batch\.prompt/)
  assert.match(source, /latest\.batch\.focus_area/)
  assert.match(source, /\/api\/rfp-wide-research/)
  assert.match(source, /seeded_from_run_id/)
})
