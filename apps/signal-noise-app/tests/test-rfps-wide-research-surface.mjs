import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pageSource = readFileSync(new URL('../src/app/rfps/page.tsx', import.meta.url), 'utf8')

test('rfps page renders the merged manus wide research surface', () => {
  assert.match(pageSource, /loadLatestWideRfpResearchBatch/)
  assert.match(pageSource, /Merged Manus wide research batch/)
  assert.match(pageSource, /wide_rfp_research_batches/)
  assert.match(pageSource, /Manus wide research JSON/)
  assert.match(pageSource, /WideResearchRefreshButton/)
  assert.match(pageSource, /wideResearchBatch/)
  assert.match(pageSource, /opportunities/)
  assert.match(pageSource, /formatRunTimestamp/)
})
