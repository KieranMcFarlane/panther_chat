import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const scriptPath = new URL('../scripts/admin/resume-pipeline-after-provider-activation.cjs', import.meta.url)
const runbookPath = new URL('../docs/runbooks/zai-provider-resume.md', import.meta.url)

test('provider resume admin script requires smoke success and provider pause before changing control state', () => {
  assert.equal(existsSync(scriptPath), true)

  const source = readFileSync(scriptPath, 'utf8')

  assert.match(source, /smoke-zai-inference\.sh/)
  assert.match(source, /provider_infrastructure_failure/)
  assert.match(source, /active_runs/)
  assert.match(source, /--apply/)
  assert.match(source, /pipeline_control_state/)
  assert.match(source, /requested_state/)
  assert.match(source, /running/)
  assert.match(source, /safe_to_resume/)
  assert.match(source, /stop_details/)
  assert.match(source, /current_batch_id/)
  assert.match(source, /current_entity_id/)
  assert.match(source, /current_question_id/)
  assert.match(source, /current_question_text/)
  assert.match(source, /current_action/)
  assert.match(source, /current_phase/)
  assert.match(source, /current_started_at/)
  assert.match(source, /current_activity_at/)
})

test('provider resume runbook documents smoke, status, resume, and one-entity verification', () => {
  assert.equal(existsSync(runbookPath), true)

  const source = readFileSync(runbookPath, 'utf8')

  assert.match(source, /smoke-zai-inference\.sh/)
  assert.match(source, /check-pipeline-provider-pause\.cjs/)
  assert.match(source, /resume-pipeline-after-provider-activation\.cjs --apply/)
  assert.match(source, /dev-full\.sh/)
  assert.match(source, /one entity/i)
})
