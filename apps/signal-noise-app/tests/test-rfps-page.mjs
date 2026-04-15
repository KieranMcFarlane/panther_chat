import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pageSource = readFileSync(new URL('../src/app/rfps/page.tsx', import.meta.url), 'utf8')

test('rfps page uses the shared shell and merged manus wide research surface', () => {
  assert.match(pageSource, /AppPageShell/)
  assert.match(pageSource, /AppPageHeader/)
  assert.match(pageSource, /AppPageBody/)
  assert.match(pageSource, /loadLatestWideRfpResearchBatch/)
  assert.match(pageSource, /Merged Manus wide research batch/)
  assert.match(pageSource, /wide_rfp_research_batches/)
  assert.match(pageSource, /Manus wide research JSON/)
  assert.match(pageSource, /WideResearchRefreshButton/)
  assert.match(pageSource, /opacity-100/)
  assert.doesNotMatch(pageSource, /opacity-70/)
  assert.doesNotMatch(pageSource, /bg-card\/70/)
  assert.doesNotMatch(pageSource, /useEffect/)
  assert.doesNotMatch(pageSource, /useState/)
})
