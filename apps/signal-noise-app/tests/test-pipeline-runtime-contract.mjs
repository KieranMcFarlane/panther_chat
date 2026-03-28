import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('pipeline runtime surface exposes worker and fast mcp state', async () => {
  const runtimeRouteSource = await readFile(new URL('../src/app/api/home/pipeline-runtime/route.ts', import.meta.url), 'utf8')
  const queueDrilldownSource = await readFile(new URL('../src/app/api/home/queue-drilldown/route.ts', import.meta.url), 'utf8')
  const runtimeLibSource = await readFile(new URL('../src/lib/pipeline-runtime.ts', import.meta.url), 'utf8')
  const questionTextResolverSource = await readFile(new URL('../src/lib/question-text-resolver.ts', import.meta.url), 'utf8')
  const supervisorSource = await readFile(new URL('../src/lib/pipeline-worker-supervisor.ts', import.meta.url), 'utf8')

  assert.match(runtimeRouteSource, /pipeline-runtime/)
  assert.match(runtimeRouteSource, /worker_process_state/)
  assert.match(runtimeRouteSource, /fastmcp_health/)
  assert.match(runtimeRouteSource, /current_run/)
  assert.match(runtimeRouteSource, /recent_failures/)

  assert.match(runtimeLibSource, /worker_process_state/)
  assert.match(runtimeLibSource, /worker_health/)
  assert.match(runtimeLibSource, /recent_failures/)
  assert.match(runtimeLibSource, /current_run/)
  assert.match(runtimeLibSource, /current_question_text/)

  assert.match(questionTextResolverSource, /resolveQuestionTextFromDossierData/)
  assert.match(questionTextResolverSource, /question_first/)
  assert.match(questionTextResolverSource, /question_text/)

  assert.match(queueDrilldownSource, /current_question_text/)
  assert.match(queueDrilldownSource, /next_repair_question_text/)
  assert.match(queueDrilldownSource, /last_completed_question_text/)
  assert.match(queueDrilldownSource, /live_state/)
  assert.match(queueDrilldownSource, /backlog_health/)
  assert.match(queueDrilldownSource, /runtime\.current_run/)

  assert.match(supervisorSource, /entity-pipeline-worker\.pid/)
  assert.match(supervisorSource, /spawn\(/)
  assert.match(supervisorSource, /kill\(/)
  assert.match(supervisorSource, /worker_process_state/)
})

test('pipeline control route manages worker lifecycle instead of only a pause file', async () => {
  const controlRouteSource = await readFile(new URL('../src/app/api/home/pipeline-control/route.ts', import.meta.url), 'utf8')
  const stripSource = await readFile(new URL('../src/components/layout/OperationalStatusStrip.tsx', import.meta.url), 'utf8')
  const devFullSource = await readFile(new URL('../scripts/dev-full.sh', import.meta.url), 'utf8')

  assert.match(controlRouteSource, /startPipelineWorker|stopPipelineWorker/)
  assert.match(controlRouteSource, /worker_process_state/)

  assert.match(stripSource, /Fast MCP|fastmcp/i)
  assert.match(stripSource, /worker_process_state|workerState/i)
  assert.match(stripSource, /current_action|current_question_id|current_question_text/)
  assert.match(stripSource, /Question ID/)
  assert.match(stripSource, /Backlog diagnostics/)
  assert.match(stripSource, /loadOperationalDrilldownPayload/)

  assert.match(devFullSource, /worker:entity-pipeline/)
  assert.match(devFullSource, /entity-pipeline-worker/)
})
