import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pageSource = readFileSync(new URL('../src/app/rfps/page.tsx', import.meta.url), 'utf8')

test('rfps page renders only the canonical wide research surface', () => {
  assert.match(pageSource, /readLatestWideRfpResearchArtifact/)
  assert.match(pageSource, /Latest cached wide research|cached wide research/i)
  assert.match(pageSource, /Last cached run:/)
  assert.match(pageSource, /normalized/i)
  assert.match(pageSource, /canonical_entity_id|canonical_entity_name|entity_actions/)
  assert.match(pageSource, /wideResearch|wideRfpResearch|latestWideResearch/i)
  assert.match(pageSource, /lane_label|focus_area|seed_query/)
  assert.match(pageSource, /WideResearchRefreshButton/)
})
