import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const routePath = new URL('../src/app/api/entity-pipeline/route.ts', import.meta.url)
const source = readFileSync(routePath, 'utf8')

test('single-entity pipeline route creates a batch and queues async processing', () => {
  assert.match(source, /createEntityImportBatch/)
  assert.match(source, /createEntityPipelineRuns/)
  assert.match(source, /normalizeImportedEntityRow/)
  assert.match(source, /\/api\/entity-import\/\$\{batch\.id\}\/run/)
  assert.match(source, /status:\s*202/)
  assert.match(source, /runDetailUrl/)
})
