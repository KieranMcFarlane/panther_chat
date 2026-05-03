import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const providerScriptPath = new URL('../scripts/admin/verify-provider-auto-resume.cjs', import.meta.url)
const staleScriptPath = new URL('../scripts/admin/verify-stale-run-quarantine.cjs', import.meta.url)

test('provider auto-resume verification script seeds a real provider pause and runs a claim cycle', () => {
  assert.equal(existsSync(providerScriptPath), true)

  const source = readFileSync(providerScriptPath, 'utf8')

  assert.match(source, /smoke-zai-inference\.sh/)
  assert.match(source, /\/health/)
  assert.match(source, /\/openapi\.json/)
  assert.match(source, /provider_infrastructure_failure/)
  assert.match(source, /current_batch_id/)
  assert.match(source, /current_entity_id/)
  assert.match(source, /current_question_id/)
  assert.match(source, /last_self_heal_action/)
  assert.match(source, /provider_auto_resume/)
  assert.match(source, /EntityPipelineWorker/)
  assert.match(source, /claim_next_batch\(\)/)
  assert.match(source, /--timeout-seconds=/)
})

test('stale-run quarantine verification script seeds a stale running row and waits for quarantine metadata', () => {
  assert.equal(existsSync(staleScriptPath), true)

  const source = readFileSync(staleScriptPath, 'utf8')

  assert.match(source, /entity_import_batches/)
  assert.match(source, /entity_pipeline_runs/)
  assert.match(source, /lease_expires_at/)
  assert.match(source, /heartbeat_at/)
  assert.match(source, /stale_pipeline_run_quarantined/)
  assert.match(source, /continue_pipeline_on_failure/)
  assert.match(source, /retry_state/)
  assert.match(source, /recovery_source/)
  assert.match(source, /stale_run_quarantine/)
  assert.match(source, /EntityPipelineWorker/)
  assert.match(source, /claim_next_batch\(\)/)
})
