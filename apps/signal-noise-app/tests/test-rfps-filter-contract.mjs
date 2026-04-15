import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const rfpsSource = readFileSync(new URL('../src/app/rfps/page.tsx', import.meta.url), 'utf8')

test('rfps page uses the merged manus wide research batch for its search controls', () => {
  assert.match(rfpsSource, /loadLatestWideRfpResearchBatch/)
  assert.match(rfpsSource, /Merged Manus wide research batch/)
  assert.match(rfpsSource, /wide_rfp_research_batches/)
  assert.match(rfpsSource, /Manus wide research JSON/)
  assert.doesNotMatch(rfpsSource, /useEffect/)
  assert.doesNotMatch(rfpsSource, /useState/)
  assert.doesNotMatch(rfpsSource, /FacetFilterBar/)
})
