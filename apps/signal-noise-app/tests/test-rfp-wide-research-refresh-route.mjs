import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/app/api/rfp-wide-research/refresh/route.ts', import.meta.url), 'utf8')

test('wide research refresh route requires an operator session and forwards year and exclusion context', () => {
  assert.match(source, /requireApiSession/)
  assert.match(source, /loadLatestWideRfpResearchBatch/)
  assert.match(source, /latest\.batch\.focus_area/)
  assert.match(source, /targetYear/)
  assert.match(source, /excludeNames/)
  assert.match(source, /collectOpportunityTitles/)
  assert.match(source, /excludeTitles/)
  assert.match(source, /getDefaultWideRfpSeedQuery/)
  assert.match(source, /\/api\/rfp-wide-research/)
  assert.match(source, /seeded_from_run_id/)
  assert.match(source, /UnauthorizedError/)
})
