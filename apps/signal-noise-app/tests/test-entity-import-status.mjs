import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const statusRoutePath = new URL('../src/app/api/entity-import/[batchId]/route.ts', import.meta.url)
const runRoutePath = new URL('../src/app/api/entity-import/[batchId]/run/route.ts', import.meta.url)
const importerPath = new URL('../src/components/entity-import/EntityCsvImporter.tsx', import.meta.url)
const rfpHelperPath = new URL('../src/lib/entity-import-rfp.ts', import.meta.url)

const statusRouteSource = readFileSync(statusRoutePath, 'utf8')
const runRouteSource = readFileSync(runRoutePath, 'utf8')
const importerSource = readFileSync(importerPath, 'utf8')
const rfpHelperSource = readFileSync(rfpHelperPath, 'utf8')

test('entity import status route reads batch and pipeline run status from the jobs helper', () => {
  assert.match(statusRouteSource, /import \{ getEntityImportBatchStatus \} from ["']@\/lib\/entity-import-jobs["']/)
  assert.match(statusRouteSource, /export async function GET/)
  assert.match(statusRouteSource, /params: \{ batchId: string \}/)
})

test('entity import page polls the status route and renders per-entity phase progress', () => {
  assert.match(importerSource, /fetch\(`\/api\/entity-import\/\$\{batchId\}`\)/)
  assert.match(importerSource, /fetch\(`\/api\/entity-import\/\$\{batchId\}\/run`\s*,\s*\{/)
  assert.match(importerSource, /setPipelineStarted/)
  assert.match(importerSource, /setBatchStatus/)
  assert.match(importerSource, /Imports run asynchronously/)
  assert.match(importerSource, /execution:\s*\{/)
  assert.match(importerSource, /sales_readiness/)
  assert.match(importerSource, /rfp_count/)
  assert.match(importerSource, /pipeline_runs/)
  assert.match(importerSource, /dossier_id/)
  assert.match(importerSource, /error_message/)
  assert.match(importerSource, /metadata: Record<string, unknown>/)
  assert.match(importerSource, /phaseEntries/)
  assert.match(importerSource, /run\.metadata\?\.phases/)
  assert.match(importerSource, /Object\.entries\(phaseMap\)/)
  assert.match(importerSource, /\/entity-import\/\$\{batchId\}\/\$\{run\.entity_id\}/)
  assert.match(importerSource, /\/entity-browser\/\$\{run\.entity_id\}\/dossier\?from=1/)
  assert.match(importerSource, /href="\/rfps"/)
})

test('entity import run route proxies queued entities into the backend pipeline endpoint', () => {
  assert.match(runRouteSource, /export async function POST/)
  assert.match(runRouteSource, /\/api\/pipeline\/run-entity/)
  assert.match(runRouteSource, /activeBatchRuns = new Map/)
  assert.match(runRouteSource, /enqueueBatchRun/)
  assert.match(runRouteSource, /ENTITY_IMPORT_QUEUE_MODE/)
  assert.match(runRouteSource, /durable_worker/)
  assert.match(runRouteSource, /status: 202/)
  assert.match(runRouteSource, /batch_id:\s*batchId/)
  assert.match(runRouteSource, /updateEntityPipelineRun/)
  assert.match(runRouteSource, /promoteImportedEntityRfps/)
  assert.match(runRouteSource, /syncEntityPipelineArtifacts/)
  assert.match(runRouteSource, /from\('cached_entities'\)/)
  assert.match(runRouteSource, /sales_readiness/)
  assert.match(runRouteSource, /rfp_count/)
  assert.match(runRouteSource, /performance_summary/)
})

test('entity import RFP helper promotes validated signals into the unified rfp_opportunities table', () => {
  assert.match(rfpHelperSource, /export async function promoteImportedEntityRfps/)
  assert.match(rfpHelperSource, /from\('rfp_opportunities'\)/)
  assert.match(rfpHelperSource, /upsert\(rows, \{ onConflict: 'id' \}\)/)
  assert.match(rfpHelperSource, /CSV Import Pipeline/)
})
