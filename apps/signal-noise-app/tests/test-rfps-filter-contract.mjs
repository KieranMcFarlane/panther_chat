import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const rfpsSource = readFileSync(new URL('../src/app/rfps/page.tsx', import.meta.url), 'utf8')

test('rfps page uses the shared filter shell for its search controls', () => {
  assert.match(rfpsSource, /readLatestWideRfpResearchArtifact/)
  assert.match(rfpsSource, /WideResearchRefreshButton/)
  assert.match(rfpsSource, /No cached wide research batch yet/)
  assert.match(rfpsSource, /Cached output|cached wide research/i)
  assert.doesNotMatch(rfpsSource, /useEffect/)
  assert.doesNotMatch(rfpsSource, /useState/)
  assert.doesNotMatch(rfpsSource, /FacetFilterBar/)
})
