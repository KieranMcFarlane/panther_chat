import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pageSource = readFileSync(new URL('../src/app/rfps/page.tsx', import.meta.url), 'utf8')

test('rfps page renders only the canonical wide research surface', () => {
  assert.match(pageSource, /\/api\/rfp-wide-research/)
  assert.match(pageSource, /Latest wide research|Wide research/i)
  assert.match(pageSource, /Last successful run:/)
  assert.match(pageSource, /normalized/i)
  assert.match(pageSource, /canonical_entity_id|canonical_entity_name|entity_actions/)
  assert.match(pageSource, /wideResearch|wideRfpResearch|latestWideResearch/i)
  assert.match(pageSource, /lane_label|focus_area|seed_query/)
  assert.doesNotMatch(pageSource, /\/api\/tenders\?action=opportunities&limit=50&orderBy=yellow_panther_fit&orderDirection=desc&promoted_only=true/)
  assert.doesNotMatch(pageSource, /Operator shortlist|Found RFPs|promoted RFPs|promoted shortlist/)
})
