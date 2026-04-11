import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pageSource = readFileSync(new URL('../src/app/rfps/page.tsx', import.meta.url), 'utf8')

test('rfps page uses the shared shell and canonical wide research surface', () => {
  assert.match(pageSource, /AppPageShell/)
  assert.match(pageSource, /AppPageHeader/)
  assert.match(pageSource, /AppPageBody/)
  assert.match(pageSource, /readLatestWideRfpResearchArtifact/)
  assert.match(pageSource, /Canonical source of truth/)
  assert.match(pageSource, /Manus-wide discovery output is cached on the server/)
  assert.match(pageSource, /Last cached run:/)
  assert.match(pageSource, /activeLaneLabel|lane_label|focus_area/)
  assert.match(pageSource, /opacity-100/)
  assert.doesNotMatch(pageSource, /opacity-70/)
  assert.doesNotMatch(pageSource, /bg-card\/70/)
  assert.match(pageSource, /WideResearchRefreshButton/)
  assert.doesNotMatch(pageSource, /useEffect/)
  assert.doesNotMatch(pageSource, /useState/)
})
