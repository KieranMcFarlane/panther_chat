import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const jobsPath = new URL('../src/lib/entity-import-jobs.ts', import.meta.url)
const migrationPath = new URL('../supabase/migrations/20260302_create_entity_import_tables.sql', import.meta.url)

const jobsSource = readFileSync(jobsPath, 'utf8')
const migrationSource = readFileSync(migrationPath, 'utf8')

test('entity import jobs module defines batch and pipeline run persistence helpers', () => {
  assert.match(jobsSource, /export async function createEntityImportBatch/)
  assert.match(jobsSource, /export async function createEntityPipelineRuns/)
  assert.match(jobsSource, /export async function getEntityImportBatchStatus/)
  assert.match(jobsSource, /entity_import_batches/)
  assert.match(jobsSource, /entity_pipeline_runs/)
})

test('import job migration defines batch and pipeline run tables', () => {
  assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS entity_import_batches/i)
  assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS entity_pipeline_runs/i)
  assert.match(migrationSource, /batch_id/)
  assert.match(migrationSource, /sales_readiness/)
  assert.match(migrationSource, /rfp_count/)
})
