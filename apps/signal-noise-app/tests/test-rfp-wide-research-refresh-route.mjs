import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/app/api/rfp-wide-research/refresh/route.ts', import.meta.url), 'utf8')

test('wide research refresh route requires an operator session and reuses the latest cached prompt', () => {
  assert.match(source, /requireApiSession/)
  assert.match(source, /readLatestWideRfpResearchArtifact/)
  assert.match(source, /latest\.batch\.prompt/)
  assert.match(source, /latest\.batch\.focus_area/)
  assert.match(source, /\/api\/rfp-wide-research/)
  assert.match(source, /seeded_from_run_id/)
  assert.match(source, /UnauthorizedError/)
})
