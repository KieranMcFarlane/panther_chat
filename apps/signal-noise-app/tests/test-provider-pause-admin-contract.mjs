import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const scriptPath = new URL('../scripts/admin/check-pipeline-provider-pause.cjs', import.meta.url)

test('provider pause admin script reports control state and queue counts without secrets', () => {
  assert.equal(existsSync(scriptPath), true)

  const source = readFileSync(scriptPath, 'utf8')

  assert.match(source, /process\.env\.DATABASE_URL/)
  assert.match(source, /pipeline_control_state/)
  assert.match(source, /entity_pipeline_runs/)
  assert.match(source, /status in \('running', 'retrying'\)/)
  assert.match(source, /status = 'queued'/)
  assert.match(source, /provider_infrastructure_failure/)
  assert.match(source, /active_runs/)
  assert.match(source, /queued_runs/)
  assert.match(source, /recent_provider_failures/)

  assert.doesNotMatch(source, /console\.log\(process\.env/)
  assert.doesNotMatch(source, /ZAI_API_KEY|ANTHROPIC_AUTH_TOKEN|OPENAI_API_KEY/)
})
