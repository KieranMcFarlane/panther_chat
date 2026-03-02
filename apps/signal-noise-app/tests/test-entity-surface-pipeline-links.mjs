import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const entityCardPath = new URL('../src/components/EntityCard.tsx', import.meta.url)
const runRoutePath = new URL('../src/app/api/entity-import/[batchId]/run/route.ts', import.meta.url)

const entityCardSource = readFileSync(entityCardPath, 'utf8')
const runRouteSource = readFileSync(runRoutePath, 'utf8')

test('entity card surfaces the latest pipeline run link when import metadata is present', () => {
  assert.match(entityCardSource, /last_pipeline_run_detail_url/)
  assert.match(entityCardSource, /Latest pipeline run/i)
})

test('entity import run processing persists latest pipeline link metadata back onto cached entities', () => {
  assert.match(runRouteSource, /last_pipeline_batch_id/)
  assert.match(runRouteSource, /last_pipeline_run_detail_url/)
  assert.match(runRouteSource, /last_pipeline_status/)
})
