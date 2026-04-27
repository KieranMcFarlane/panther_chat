import { query } from '@/lib/pg-client'

export type PipelineControlRequestedState = 'running' | 'paused'
export type PipelineControlObservedState = 'starting' | 'running' | 'stopping' | 'paused'

export type PipelineControlState = {
  is_paused: boolean
  pause_reason: string | null
  stop_reason?: string | null
  stop_details?: Record<string, unknown> | null
  updated_at: string | null
  desired_state: PipelineControlRequestedState
  requested_state: PipelineControlRequestedState
  observed_state: PipelineControlObservedState
  transition_state: PipelineControlObservedState
  current_batch_id?: string | null
  current_entity_id?: string | null
  current_canonical_entity_id?: string | null
  current_entity_name?: string | null
  current_question_id?: string | null
  current_question_text?: string | null
  current_action?: string | null
  current_phase?: string | null
  current_started_at?: string | null
  current_activity_at?: string | null
  cursor_source?: string | null
}

const DEFAULT_CONTROL_STATE: PipelineControlState = {
  is_paused: false,
  pause_reason: null,
  stop_reason: null,
  stop_details: null,
  updated_at: null,
  desired_state: 'running',
  requested_state: 'running',
  observed_state: 'running',
  transition_state: 'running',
  current_batch_id: null,
  current_entity_id: null,
  current_canonical_entity_id: null,
  current_entity_name: null,
  current_question_id: null,
  current_question_text: null,
  current_action: null,
  current_phase: null,
  current_started_at: null,
  current_activity_at: null,
  cursor_source: null,
}

const PIPELINE_CONTROL_STATE_TABLE = 'pipeline_control_state'
const PIPELINE_CONTROL_STATE_ROW_ID = 'pipeline'

function isLegacyManualPauseState(parsed: Partial<PipelineControlState>) {
  const stopReason = typeof parsed.stop_reason === 'string' ? parsed.stop_reason.trim().toLowerCase() : ''
  const pauseReason = typeof parsed.pause_reason === 'string' ? parsed.pause_reason.trim().toLowerCase() : ''
  return stopReason === 'manual_stop' || (!stopReason && (pauseReason === 'paused from live ops' || pauseReason === 'manual stop'))
}

function normalizePipelineControlState(parsed: Partial<PipelineControlState>): PipelineControlState {
  if (isLegacyManualPauseState(parsed)) {
    return {
      ...DEFAULT_CONTROL_STATE,
      updated_at: typeof parsed.updated_at === 'string' && parsed.updated_at.trim().length > 0
        ? parsed.updated_at
        : null,
    }
  }

  const requestedState = parsed.requested_state === 'paused' || parsed.is_paused === true ? 'paused' : 'running'
  const observedState = parsed.observed_state === 'starting'
    || parsed.observed_state === 'running'
    || parsed.observed_state === 'stopping'
    || parsed.observed_state === 'paused'
    ? parsed.observed_state
    : requestedState
  const transitionState = parsed.transition_state === 'starting'
    || parsed.transition_state === 'running'
    || parsed.transition_state === 'stopping'
    || parsed.transition_state === 'paused'
    ? parsed.transition_state
    : observedState
  const desiredState = parsed.desired_state === 'paused'
    ? 'paused'
    : parsed.desired_state === 'running'
      ? 'running'
      : requestedState

  return {
    is_paused: parsed.is_paused === true,
    pause_reason: typeof parsed.pause_reason === 'string' && parsed.pause_reason.trim().length > 0
      ? parsed.pause_reason.trim()
      : null,
    stop_reason: typeof parsed.stop_reason === 'string' && parsed.stop_reason.trim().length > 0
      ? parsed.stop_reason.trim()
      : null,
    stop_details: parsed.stop_details && typeof parsed.stop_details === 'object'
      ? parsed.stop_details as Record<string, unknown>
      : null,
    updated_at: typeof parsed.updated_at === 'string' && parsed.updated_at.trim().length > 0
      ? parsed.updated_at
      : null,
    desired_state: desiredState,
    requested_state: requestedState,
    observed_state: observedState,
    transition_state: transitionState,
    current_batch_id: typeof parsed.current_batch_id === 'string' && parsed.current_batch_id.trim().length > 0
      ? parsed.current_batch_id.trim()
      : null,
    current_entity_id: typeof parsed.current_entity_id === 'string' && parsed.current_entity_id.trim().length > 0
      ? parsed.current_entity_id.trim()
      : null,
    current_canonical_entity_id: typeof parsed.current_canonical_entity_id === 'string' && parsed.current_canonical_entity_id.trim().length > 0
      ? parsed.current_canonical_entity_id.trim()
      : null,
    current_entity_name: typeof parsed.current_entity_name === 'string' && parsed.current_entity_name.trim().length > 0
      ? parsed.current_entity_name.trim()
      : null,
    current_question_id: typeof parsed.current_question_id === 'string' && parsed.current_question_id.trim().length > 0
      ? parsed.current_question_id.trim()
      : null,
    current_question_text: typeof parsed.current_question_text === 'string' && parsed.current_question_text.trim().length > 0
      ? parsed.current_question_text.trim()
      : null,
    current_action: typeof parsed.current_action === 'string' && parsed.current_action.trim().length > 0
      ? parsed.current_action.trim()
      : null,
    current_phase: typeof parsed.current_phase === 'string' && parsed.current_phase.trim().length > 0
      ? parsed.current_phase.trim()
      : null,
    current_started_at: typeof parsed.current_started_at === 'string' && parsed.current_started_at.trim().length > 0
      ? parsed.current_started_at.trim()
      : null,
    current_activity_at: typeof parsed.current_activity_at === 'string' && parsed.current_activity_at.trim().length > 0
      ? parsed.current_activity_at.trim()
      : null,
    cursor_source: typeof parsed.cursor_source === 'string' && parsed.cursor_source.trim().length > 0
      ? parsed.cursor_source.trim()
      : null,
  }
}

async function readPipelineControlStateFromDatabase(): Promise<PipelineControlState | null> {
  if (!process.env.DATABASE_URL?.trim()) return null
  try {
    const result = await query(
      `select state
         from ${PIPELINE_CONTROL_STATE_TABLE}
        where id = $1
        limit 1`,
      [PIPELINE_CONTROL_STATE_ROW_ID],
    )
    const row = result.rows?.[0]
    if (!row || typeof row !== 'object') return null
    const state = (row as Record<string, unknown>).state
    if (state && typeof state === 'object') {
      return normalizePipelineControlState(state as Partial<PipelineControlState>)
    }
    return normalizePipelineControlState(row as Partial<PipelineControlState>)
  } catch {
    return null
  }
}

async function writePipelineControlStateToDatabase(state: PipelineControlState): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) return
  await query(
    `insert into ${PIPELINE_CONTROL_STATE_TABLE} (id, state, updated_at)
     values ($1, $2::jsonb, $3::timestamptz)
     on conflict (id) do update set
       state = excluded.state,
       updated_at = excluded.updated_at`,
    [PIPELINE_CONTROL_STATE_ROW_ID, JSON.stringify(state), state.updated_at ?? new Date().toISOString()],
  )
}

export async function readPipelineControlState(): Promise<PipelineControlState> {
  const databaseState = await readPipelineControlStateFromDatabase()
  if (databaseState) return databaseState
  return { ...DEFAULT_CONTROL_STATE }
}

export async function writePipelineControlState(input: {
  is_paused?: boolean
  pause_reason?: string | null
  stop_reason?: string | null
  stop_details?: Record<string, unknown> | null
  desired_state?: PipelineControlRequestedState
  requested_state?: PipelineControlRequestedState
  observed_state?: PipelineControlObservedState
  transition_state?: PipelineControlObservedState
  current_batch_id?: string | null
  current_entity_id?: string | null
  current_canonical_entity_id?: string | null
  current_entity_name?: string | null
  current_question_id?: string | null
  current_question_text?: string | null
  current_action?: string | null
  current_phase?: string | null
  current_started_at?: string | null
  current_activity_at?: string | null
  cursor_source?: string | null
}): Promise<PipelineControlState> {
  const requestedState = input.requested_state
    ?? (input.is_paused ? 'paused' : 'running')
  const transitionState = input.transition_state
    ?? (requestedState === 'paused' ? 'stopping' : 'starting')
  const observedState = input.observed_state
    ?? transitionState
  const desiredState = input.desired_state ?? requestedState
  const isPaused = input.is_paused ?? (requestedState === 'paused' || observedState === 'paused')
  const nextState: PipelineControlState = {
    is_paused: isPaused === true,
    pause_reason: isPaused && typeof input.pause_reason === 'string' && input.pause_reason.trim().length > 0
      ? input.pause_reason.trim()
      : null,
    stop_reason: typeof input.stop_reason === 'string' && input.stop_reason.trim().length > 0
      ? input.stop_reason.trim()
      : null,
    stop_details: input.stop_details && typeof input.stop_details === 'object'
      ? input.stop_details
      : null,
    updated_at: new Date().toISOString(),
    desired_state: desiredState,
    requested_state: requestedState,
    observed_state: observedState,
    transition_state: transitionState,
    current_batch_id: input.current_batch_id ?? null,
    current_entity_id: input.current_entity_id ?? null,
    current_canonical_entity_id: input.current_canonical_entity_id ?? null,
    current_entity_name: input.current_entity_name ?? null,
    current_question_id: input.current_question_id ?? null,
    current_question_text: input.current_question_text ?? null,
    current_action: input.current_action ?? null,
    current_phase: input.current_phase ?? null,
    current_started_at: input.current_started_at ?? null,
    current_activity_at: input.current_activity_at ?? null,
    cursor_source: input.cursor_source ?? null,
  }

  await writePipelineControlStateToDatabase(nextState).catch(() => undefined)
  return nextState
}
