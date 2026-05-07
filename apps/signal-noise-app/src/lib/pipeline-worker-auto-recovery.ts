import { readPipelineControlState, writePipelineControlState, type PipelineControlState } from '@/lib/pipeline-control-state'
import {
  readPipelineWorkerSupervisorState,
  startPipelineWorker,
  type PipelineWorkerSupervisorState,
} from '@/lib/pipeline-worker-supervisor'

export type PipelineWorkerAutoRecoveryResult = {
  recovered: boolean
  reason: string | null
  control?: PipelineControlState
  worker?: PipelineWorkerSupervisorState
}

function isAutoRecoveryEnabled() {
  return process.env.PIPELINE_WORKER_AUTO_RECOVERY_ENABLED !== '0'
}

function isManualStop(control: PipelineControlState) {
  const reason = String(control.stop_reason || control.pause_reason || '').trim().toLowerCase()
  return reason === 'manual_stop' || reason === 'manual stop' || reason === 'paused from live ops'
}

export function shouldAutoRecoverPipelineWorker(input: {
  control: PipelineControlState
  worker: PipelineWorkerSupervisorState
}): boolean {
  const { control, worker } = input
  if (!isAutoRecoveryEnabled()) return false
  if (control.requested_state !== 'running') return false
  if (control.is_paused === true) return false
  if (isManualStop(control)) return false
  if (worker.worker_process_state !== 'crashed' && worker.worker_process_state !== 'stopped') return false
  return true
}

export async function maybeAutoRecoverPipelineWorker(input?: {
  control?: PipelineControlState
  worker?: PipelineWorkerSupervisorState
}): Promise<PipelineWorkerAutoRecoveryResult> {
  const control = input?.control ?? await readPipelineControlState()
  const worker = input?.worker ?? await readPipelineWorkerSupervisorState()

  if (!shouldAutoRecoverPipelineWorker({ control, worker })) {
    return { recovered: false, reason: null, control, worker }
  }

  const nowIso = new Date().toISOString()
  const recoveredWorker = await startPipelineWorker()
  const recoveredControl = await writePipelineControlState({
    is_paused: false,
    pause_reason: null,
    stop_reason: null,
    stop_details: null,
    desired_state: 'running',
    requested_state: 'running',
    observed_state: 'starting',
    transition_state: 'starting',
    current_batch_id: control.current_batch_id ?? null,
    current_entity_id: control.current_entity_id ?? null,
    current_canonical_entity_id: control.current_canonical_entity_id ?? null,
    current_entity_name: control.current_entity_name ?? null,
    current_question_id: control.current_question_id ?? null,
    current_question_text: control.current_question_text ?? null,
    current_action: control.current_action ?? null,
    current_phase: control.current_phase ?? null,
    current_started_at: control.current_started_at ?? null,
    current_activity_at: control.current_activity_at ?? null,
    cursor_source: control.cursor_source ?? null,
    state: 'recovering',
    health_class: 'recovering',
    recovery_source: 'pipeline_worker_auto_recovery',
    last_self_heal_action: 'pipeline_worker_auto_recovery',
    last_self_heal_reason: `worker was ${worker.worker_process_state} while control requested running`,
    last_self_heal_at: nowIso,
  })

  return {
    recovered: true,
    reason: 'pipeline_worker_auto_recovery',
    control: recoveredControl,
    worker: recoveredWorker,
  }
}
