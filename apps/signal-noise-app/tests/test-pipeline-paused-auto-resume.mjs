import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('pipeline runtime auto-resumes stale paused checkpoints through the worker supervisor', async () => {
  const autoResumeSource = await readFile(new URL('../src/lib/pipeline-paused-auto-resume.ts', import.meta.url), 'utf8')
  const runtimeSource = await readFile(new URL('../src/lib/pipeline-runtime.ts', import.meta.url), 'utf8')

  assert.match(autoResumeSource, /PIPELINE_PAUSED_AUTO_RESUME_AFTER_SECONDS/)
  assert.match(autoResumeSource, /DEFAULT_PAUSED_AUTO_RESUME_AFTER_SECONDS\s*=\s*60/)
  assert.match(autoResumeSource, /shouldAutoResumePausedPipeline/)
  assert.match(autoResumeSource, /requested_state.*paused/s)
  assert.match(autoResumeSource, /worker_process_state.*crashed.*stopped/s)
  assert.match(autoResumeSource, /manual_stop/)
  assert.match(autoResumeSource, /backend_route_missing/)
  assert.match(autoResumeSource, /provider_infrastructure_failure/)
  assert.match(autoResumeSource, /startPipelineWorker/)
  assert.match(autoResumeSource, /pipeline-paused-auto-resume\.lock/)
  assert.match(autoResumeSource, /acquireAutoResumeLock/)
  assert.match(autoResumeSource, /last_self_heal_action.*paused_checkpoint_auto_resume/s)
  assert.match(autoResumeSource, /observed_state:\s*'starting'/)

  assert.match(runtimeSource, /maybeAutoResumePausedPipeline/)
  assert.match(runtimeSource, /autoResumeResult/)
})
