import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

export type PipelineControlRequestedState = 'running' | 'paused'
export type PipelineControlObservedState = 'starting' | 'running' | 'stopping' | 'paused'

export type PipelineControlState = {
  is_paused: boolean
  pause_reason: string | null
  updated_at: string | null
  desired_state: PipelineControlRequestedState
  requested_state: PipelineControlRequestedState
  observed_state: PipelineControlObservedState
  transition_state: PipelineControlObservedState
}

const DEFAULT_CONTROL_STATE: PipelineControlState = {
  is_paused: false,
  pause_reason: null,
  updated_at: null,
  desired_state: 'running',
  requested_state: 'running',
  observed_state: 'running',
  transition_state: 'running',
}

function resolveControlStatePath() {
  return path.join(process.cwd(), 'tmp', 'pipeline-control-state.json')
}

export async function readPipelineControlState(): Promise<PipelineControlState> {
  try {
    const raw = await readFile(resolveControlStatePath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<PipelineControlState>
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
      updated_at: typeof parsed.updated_at === 'string' && parsed.updated_at.trim().length > 0
        ? parsed.updated_at
        : null,
      desired_state: desiredState,
      requested_state: requestedState,
      observed_state: observedState,
      transition_state: transitionState,
    }
  } catch {
    return { ...DEFAULT_CONTROL_STATE }
  }
}

export async function writePipelineControlState(input: {
  is_paused?: boolean
  pause_reason?: string | null
  requested_state?: PipelineControlRequestedState
  observed_state?: PipelineControlObservedState
  transition_state?: PipelineControlObservedState
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
    updated_at: new Date().toISOString(),
    desired_state: desiredState,
    requested_state: requestedState,
    observed_state: observedState,
    transition_state: transitionState,
  }

  const filePath = resolveControlStatePath()
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(nextState, null, 2), 'utf8')
  return nextState
}
