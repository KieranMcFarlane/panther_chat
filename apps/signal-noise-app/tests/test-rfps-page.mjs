import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pageSource = readFileSync(new URL('../src/app/rfps/page.tsx', import.meta.url), 'utf8')

test('rfps page uses the shared shell and canonical wide research surface', () => {
  assert.match(pageSource, /AppPageShell/)
  assert.match(pageSource, /AppPageHeader/)
  assert.match(pageSource, /AppPageBody/)
  assert.match(pageSource, /\/api\/rfp-wide-research/)
  assert.match(pageSource, /Canonical source of truth/)
  assert.match(pageSource, /Manus wide research after canonical-first normalization and ingestion/)
  assert.match(pageSource, /Last successful run:/)
  assert.match(pageSource, /activeLaneLabel|lane_label|focus_area/)
  assert.match(pageSource, /opacity-100/)
  assert.doesNotMatch(pageSource, /opacity-70/)
  assert.doesNotMatch(pageSource, /bg-card\/70/)
  assert.doesNotMatch(pageSource, /Open opportunities/)
  assert.doesNotMatch(pageSource, /Open raw tenders feed/)
  assert.doesNotMatch(pageSource, /Canonical entity actions/)
  assert.doesNotMatch(pageSource, /Create only when missing/)
  assert.doesNotMatch(pageSource, /promoted_only=true/)
  assert.doesNotMatch(pageSource, /Found RFPs|Operator shortlist|promoted opportunities/)
})
