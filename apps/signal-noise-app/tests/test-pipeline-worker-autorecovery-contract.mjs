import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync } from 'node:fs'

const autoRecoveryPath = new URL('../src/lib/pipeline-worker-auto-recovery.ts', import.meta.url)
const runtimePath = new URL('../src/lib/pipeline-runtime.ts', import.meta.url)
const cronRoutePath = new URL('../src/app/api/cron/pipeline/recover/route.ts', import.meta.url)
const vercelConfigPath = new URL('../vercel.json', import.meta.url)

test('pipeline worker auto recovery restarts crashed workers only when control wants running', () => {
  assert.equal(existsSync(autoRecoveryPath), true)
  const source = readFileSync(autoRecoveryPath, 'utf8')

  assert.match(source, /shouldAutoRecoverPipelineWorker/)
  assert.match(source, /maybeAutoRecoverPipelineWorker/)
  assert.match(source, /PIPELINE_WORKER_AUTO_RECOVERY_ENABLED/)
  assert.match(source, /requested_state\s*!==\s*'running'/)
  assert.match(source, /is_paused\s*===\s*true/)
  assert.match(source, /worker_process_state\s*!==\s*'crashed'[\s\S]*worker_process_state\s*!==\s*'stopped'/)
  assert.match(source, /startPipelineWorker/)
  assert.match(source, /writePipelineControlState/)
  assert.match(source, /last_self_heal_action:\s*'pipeline_worker_auto_recovery'/)
})

test('pipeline runtime invokes worker auto recovery before building the snapshot', () => {
  const source = readFileSync(runtimePath, 'utf8')

  assert.match(source, /maybeAutoRecoverPipelineWorker/)
  assert.match(source, /workerAutoRecovery/)
  assert.match(source, /autoRecoveryResult\.worker/)
})

test('cron exposes a scheduled worker recovery endpoint for continuous self healing', () => {
  assert.equal(existsSync(cronRoutePath), true)
  const routeSource = readFileSync(cronRoutePath, 'utf8')
  const vercelConfig = JSON.parse(readFileSync(vercelConfigPath, 'utf8'))

  assert.match(routeSource, /requireCronSecret/)
  assert.match(routeSource, /export async function GET/)
  assert.match(routeSource, /export async function POST/)
  assert.match(routeSource, /maybeAutoRecoverPipelineWorker/)
  assert.match(routeSource, /readPipelineControlState/)
  assert.match(routeSource, /readPipelineWorkerSupervisorState/)
  assert.match(routeSource, /worker_auto_recovery/)

  const scheduledPaths = vercelConfig.crons.map((cron) => cron.path)
  assert.ok(scheduledPaths.includes('/api/cron/pipeline/recover'))
})
