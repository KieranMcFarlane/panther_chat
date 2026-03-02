import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pagePath = new URL('../src/app/entity-import/[batchId]/[entityId]/page.tsx', import.meta.url)
const source = readFileSync(pagePath, 'utf8')

test('entity import run detail page renders phase data and discovery timing', () => {
  assert.match(source, /getEntityPipelineRun/)
  assert.match(source, /performanceSummary/)
  assert.match(source, /slowest hop/i)
  assert.match(source, /hopTimings/)
  assert.match(source, /budget exceeded/i)
  assert.match(source, /slowest iteration/i)
  assert.match(source, /validation timeout/i)
  assert.match(source, /Open dossier/)
  assert.match(source, /Open RFP page/)
})
