import { mkdir, open, rm, stat } from 'node:fs/promises'
import path from 'node:path'

import { type PipelineControlState, writePipelineControlState } from '@/lib/pipeline-control-state'
import {
  startPipelineWorker,
  type PipelineWorkerSupervisorState,
} from '@/lib/pipeline-worker-supervisor'

export const DEFAULT_PAUSED_AUTO_RESUME_AFTER_SECONDS = 60
const PAUSED_AUTO_RESUME_LOCK_PATH = path.join(process.cwd(), 'tmp', 'pipeline-paused-auto-resume.lock')
const PAUSED_AUTO_RESUME_LOCK_STALE_SECONDS = 120

type AutoResumeDecisionInput = {
  control: PipelineControlState
  worker: PipelineWorkerSupervisorState
  now?: Date
}

export type PausedAutoResumeResult = {
  resumed: boolean
  reason: string | null
  control?: PipelineControlState
  worker?: PipelineWorkerSupervisorState
}

function normalizedText(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function parseAutoResumeAfterSeconds(): number {
  const raw = process.env.PIPELINE_PAUSED_AUTO_RESUME_AFTER_SECONDS
  if (raw === undefined || raw === null || raw.trim() === '') {
    return DEFAULT_PAUSED_AUTO_RESUME_AFTER_SECONDS
  }
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : DEFAULT_PAUSED_AUTO_RESUME_AFTER_SECONDS
}

function controlAgeSeconds(control: PipelineControlState, now: Date): number | null {
  if (!control.updated_at) return null
  const parsed = Date.parse(control.updated_at)
  if (!Number.isFinite(parsed)) return null
  return Math.max(0, Math.floor((now.getTime() - parsed) / 1000))
}

function isManualPause(control: PipelineControlState) {
  const stopReason = normalizedText(control.stop_reason)
  const pauseReason = normalizedText(control.pause_reason)
  return stopReason === 'manual_stop'
    || pauseReason === 'manual stop'
    || pauseReason === 'paused from live ops'
}

function isTimedAutoResumePause(control: PipelineControlState) {
  const reason = normalizedText(control.stop_reason) || normalizedText(control.pause_reason)
  return reason === 'operator_pause_after_fix' || !reason || hasResumableCheckpointSignal(control)
}

function isInfrastructureBlockedPause(control: PipelineControlState) {
  const reason = normalizedText(control.stop_reason) || normalizedText(control.pause_reason)
  return reason === 'backend_route_missing'
    || reason === 'orchestrator_unhealthy'
    || reason === 'provider_infrastructure_failure'
    || reason === 'blocked_backend'
    || reason === 'blocked_provider'
}

function hasResumableCheckpointSignal(control: PipelineControlState) {
  const text = [
    control.pause_reason,
    control.stop_reason,
    control.current_batch_id,
    control.current_entity_id,
    control.current_canonical_entity_id,
    control.current_entity_name,
    control.current_question_id,
    control.current_question_text,
  ].map((value) => normalizedText(value)).join(' ')

  return /\bcheckpoint\b/.test(text)
    || /\brerun\b/.test(text)
    || /\bresume\b/.test(text)
    || /\bcanary\b/.test(text)
    || /\btimeout\b/.test(text)
    || /\bqueue_exhausted\b/.test(text)
    || /\bquestion_retry_exhausted\b/.test(text)
}

async function acquireAutoResumeLock(): Promise<(() => Promise<void>) | null> {
  await mkdir(path.dirname(PAUSED_AUTO_RESUME_LOCK_PATH), { recursive: true })
  try {
    const handle = await open(PAUSED_AUTO_RESUME_LOCK_PATH, 'wx')
    await handle.writeFile(`${process.pid}:${new Date().toISOString()}\n`, 'utf8')
    await handle.close()
    return async () => {
      await rm(PAUSED_AUTO_RESUME_LOCK_PATH, { force: true })
    }
  } catch {
    try {
      const details = await stat(PAUSED_AUTO_RESUME_LOCK_PATH)
      if (Date.now() - details.mtimeMs > PAUSED_AUTO_RESUME_LOCK_STALE_SECONDS * 1000) {
        await rm(PAUSED_AUTO_RESUME_LOCK_PATH, { force: true })
        return acquireAutoResumeLock()
      }
    } catch {
      return null
    }
    return null
  }
}

export function shouldAutoResumePausedPipeline(input: AutoResumeDecisionInput): boolean {
  const { control, worker } = input
  if (control.requested_state !== 'paused' || control.is_paused !== true) return false
  if (isManualPause(control)) return false
  if (isInfrastructureBlockedPause(control)) return false

  const autoResumeAfterSeconds = parseAutoResumeAfterSeconds()
  if (autoResumeAfterSeconds <= 0) return false

  const ageSeconds = controlAgeSeconds(control, input.now ?? new Date())
  if (ageSeconds === null || ageSeconds < autoResumeAfterSeconds) return false

  if (worker.worker_process_state !== 'crashed' && worker.worker_process_state !== 'stopped') return false
  return isTimedAutoResumePause(control)
}

export async function maybeAutoResumePausedPipeline(input: AutoResumeDecisionInput): Promise<PausedAutoResumeResult> {
  if (!shouldAutoResumePausedPipeline(input)) {
    return { resumed: false, reason: null }
  }

  const releaseLock = await acquireAutoResumeLock()
  if (!releaseLock) {
    return { resumed: false, reason: 'paused_checkpoint_auto_resume_in_progress' }
  }

  try {
    const nowIso = (input.now ?? new Date()).toISOString()
    const worker = await startPipelineWorker()
    const control = await writePipelineControlState({
      is_paused: false,
      pause_reason: null,
      stop_reason: null,
      stop_details: null,
      desired_state: 'running',
      requested_state: 'running',
      observed_state: 'starting',
      transition_state: 'starting',
      state: 'recovering',
      health_class: 'recovering',
      recovery_source: 'paused_checkpoint_auto_resume',
      last_self_heal_action: 'paused_checkpoint_auto_resume',
      last_self_heal_reason: 'paused checkpoint exceeded auto-resume timeout',
      last_self_heal_at: nowIso,
    })

    return {
      resumed: true,
      reason: 'paused_checkpoint_auto_resume',
      control,
      worker,
    }
  } finally {
    await releaseLock()
  }
}
