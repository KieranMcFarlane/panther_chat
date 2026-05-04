import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { query } from '@/lib/pg-client'

export type PipelineControlRequestedState = 'running' | 'paused'
export type PipelineControlObservedState = 'starting' | 'running' | 'stopping' | 'paused'
export type PipelineRecoveryState =
  | 'healthy'
  | 'degraded'
  | 'recovering'
  | 'blocked_backend'
  | 'blocked_provider'
  | 'blocked_manual'
  | 'stale_state_repair'

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
  state?: PipelineRecoveryState
  health_class?: PipelineRecoveryState
  recovery_source?: string | null
  last_self_heal_action?: string | null
  last_self_heal_reason?: string | null
  last_self_heal_at?: string | null
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
  state: 'healthy',
  health_class: 'healthy',
  recovery_source: null,
  last_self_heal_action: null,
  last_self_heal_reason: null,
  last_self_heal_at: null,
}

const PIPELINE_CONTROL_STATE_TABLE = 'pipeline_control_state'
const PIPELINE_CONTROL_STATE_ROW_ID = 'pipeline'
const PIPELINE_CONTROL_STATE_PATH = path.join(process.cwd(), 'tmp', 'pipeline-control-state.json')
const PIPELINE_RECOVERY_STATE_VALUES: PipelineRecoveryState[] = [
  'healthy',
  'degraded',
  'recovering',
  'blocked_backend',
  'blocked_provider',
  'blocked_manual',
  'stale_state_repair',
]

function normalizeRecoveryState(value: unknown, fallback: PipelineRecoveryState): PipelineRecoveryState {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return PIPELINE_RECOVERY_STATE_VALUES.includes(normalized as PipelineRecoveryState)
    ? normalized as PipelineRecoveryState
    : fallback
}

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
  const stopReason = typeof parsed.stop_reason === 'string' && parsed.stop_reason.trim().length > 0
    ? parsed.stop_reason.trim()
    : null
  const fallbackState: PipelineRecoveryState = stopReason?.toLowerCase() === 'manual_stop'
    ? 'blocked_manual'
    : transitionState === 'starting' || transitionState === 'stopping'
      ? 'recovering'
      : 'healthy'
  const state = normalizeRecoveryState(parsed.state, fallbackState)
  const healthClass = normalizeRecoveryState(parsed.health_class, state)

  return {
    is_paused: parsed.is_paused === true,
    pause_reason: typeof parsed.pause_reason === 'string' && parsed.pause_reason.trim().length > 0
      ? parsed.pause_reason.trim()
      : null,
    stop_reason: stopReason,
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
    state,
    health_class: healthClass,
    recovery_source: typeof parsed.recovery_source === 'string' && parsed.recovery_source.trim().length > 0
      ? parsed.recovery_source.trim()
      : null,
    last_self_heal_action: typeof parsed.last_self_heal_action === 'string' && parsed.last_self_heal_action.trim().length > 0
      ? parsed.last_self_heal_action.trim()
      : null,
    last_self_heal_reason: typeof parsed.last_self_heal_reason === 'string' && parsed.last_self_heal_reason.trim().length > 0
      ? parsed.last_self_heal_reason.trim()
      : null,
    last_self_heal_at: typeof parsed.last_self_heal_at === 'string' && parsed.last_self_heal_at.trim().length > 0
      ? parsed.last_self_heal_at.trim()
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

async function readPipelineControlStateFromFile(): Promise<PipelineControlState | null> {
  try {
    const raw = await readFile(PIPELINE_CONTROL_STATE_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object'
      ? normalizePipelineControlState(parsed as Partial<PipelineControlState>)
      : null
  } catch {
    return null
  }
}

function chooseNewestControlState(
  databaseState: PipelineControlState | null,
  fileState: PipelineControlState | null,
): PipelineControlState | null {
  if (!databaseState) return fileState
  if (!fileState) return databaseState
  const databaseUpdatedAt = databaseState.updated_at ? Date.parse(databaseState.updated_at) : 0
  const fileUpdatedAt = fileState.updated_at ? Date.parse(fileState.updated_at) : 0
  return fileUpdatedAt > databaseUpdatedAt ? fileState : databaseState
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

async function writePipelineControlStateToFile(state: PipelineControlState): Promise<void> {
  await mkdir(path.dirname(PIPELINE_CONTROL_STATE_PATH), { recursive: true })
  await writeFile(PIPELINE_CONTROL_STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

export async function readPipelineControlState(): Promise<PipelineControlState> {
  const [databaseState, fileState] = await Promise.all([
    readPipelineControlStateFromDatabase(),
    readPipelineControlStateFromFile(),
  ])
  const state = chooseNewestControlState(databaseState, fileState)
  if (state) return state
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
  state?: PipelineRecoveryState
  health_class?: PipelineRecoveryState
  recovery_source?: string | null
  last_self_heal_action?: string | null
  last_self_heal_reason?: string | null
  last_self_heal_at?: string | null
}): Promise<PipelineControlState> {
  const requestedState = input.requested_state
    ?? (input.is_paused ? 'paused' : 'running')
  const transitionState = input.transition_state
    ?? (requestedState === 'paused' ? 'stopping' : 'starting')
  const observedState = input.observed_state
    ?? transitionState
  const desiredState = input.desired_state ?? requestedState
  const isPaused = input.is_paused ?? (requestedState === 'paused' || observedState === 'paused')
  const fallbackState: PipelineRecoveryState = typeof input.stop_reason === 'string' && input.stop_reason.trim().toLowerCase() === 'manual_stop'
    ? 'blocked_manual'
    : transitionState === 'starting' || transitionState === 'stopping'
      ? 'recovering'
      : 'healthy'
  const state = normalizeRecoveryState(input.state, fallbackState)
  const healthClass = normalizeRecoveryState(input.health_class, state)
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
    state,
    health_class: healthClass,
    recovery_source: input.recovery_source ?? null,
    last_self_heal_action: input.last_self_heal_action ?? null,
    last_self_heal_reason: input.last_self_heal_reason ?? null,
    last_self_heal_at: input.last_self_heal_at ?? null,
  }

  await Promise.all([
    writePipelineControlStateToDatabase(nextState).catch(() => undefined),
    writePipelineControlStateToFile(nextState).catch(() => undefined),
  ])
  return nextState
}
