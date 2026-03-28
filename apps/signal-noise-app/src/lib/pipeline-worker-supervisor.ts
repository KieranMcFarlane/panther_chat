import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

export type PipelineWorkerProcessState = 'starting' | 'running' | 'stopping' | 'stopped' | 'crashed'

export type PipelineWorkerSupervisorState = {
  worker_process_state: PipelineWorkerProcessState
  worker_pid: number | null
  worker_command: string | null
  worker_state_path: string
  worker_pid_path: string
  started_at: string | null
  stopped_at: string | null
  updated_at: string | null
  last_error: string | null
}

const WORKER_PID_PATH = path.join(process.cwd(), 'tmp', 'entity-pipeline-worker.pid')
const WORKER_STATE_PATH = path.join(process.cwd(), 'tmp', 'entity-pipeline-worker-state.json')

const DEFAULT_STATE: PipelineWorkerSupervisorState = {
  worker_process_state: 'stopped',
  worker_pid: null,
  worker_command: null,
  worker_state_path: WORKER_STATE_PATH,
  worker_pid_path: WORKER_PID_PATH,
  started_at: null,
  stopped_at: null,
  updated_at: null,
  last_error: null,
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function isProcessAlive(pid: number | null) {
  if (!pid || !Number.isFinite(pid)) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function parseTimestamp(value: string | null | undefined) {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

async function readJsonStateFile(): Promise<Partial<PipelineWorkerSupervisorState>> {
  try {
    const raw = await readFile(WORKER_STATE_PATH, 'utf8')
    return JSON.parse(raw) as Partial<PipelineWorkerSupervisorState>
  } catch {
    return {}
  }
}

async function readPidFile(): Promise<number | null> {
  try {
    const raw = await readFile(WORKER_PID_PATH, 'utf8')
    const parsed = Number.parseInt(raw.trim(), 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  } catch {
    return null
  }
}

async function persistState(state: PipelineWorkerSupervisorState) {
  await mkdir(path.dirname(WORKER_STATE_PATH), { recursive: true })
  await writeFile(WORKER_STATE_PATH, JSON.stringify(state, null, 2), 'utf8')
  if (state.worker_pid) {
    await writeFile(WORKER_PID_PATH, `${state.worker_pid}\n`, 'utf8')
  } else {
    try {
      await writeFile(WORKER_PID_PATH, '', 'utf8')
    } catch {
      // ignore pid write failures when the file cannot be cleared
    }
  }
  return state
}

function normalizeState(input: Partial<PipelineWorkerSupervisorState> & { worker_pid?: number | null }): PipelineWorkerSupervisorState {
  const pid = typeof input.worker_pid === 'number' && Number.isFinite(input.worker_pid) && input.worker_pid > 0
    ? input.worker_pid
    : null
  return {
    worker_process_state: input.worker_process_state || 'stopped',
    worker_pid: pid,
    worker_command: input.worker_command ?? null,
    worker_state_path: input.worker_state_path || WORKER_STATE_PATH,
    worker_pid_path: input.worker_pid_path || WORKER_PID_PATH,
    started_at: input.started_at ?? null,
    stopped_at: input.stopped_at ?? null,
    updated_at: input.updated_at ?? null,
    last_error: input.last_error ?? null,
  }
}

export async function readPipelineWorkerSupervisorState(): Promise<PipelineWorkerSupervisorState> {
  const pidFromFile = await readPidFile()
  const persisted = normalizeState(await readJsonStateFile())
  const pid = pidFromFile || persisted.worker_pid
  const alive = isProcessAlive(pid)

  if (!pid) {
    return { ...persisted, worker_process_state: 'stopped', worker_pid: null }
  }

  if (alive) {
    const startedAt = parseTimestamp(persisted.started_at)
    const processState = persisted.worker_process_state === 'starting'
      ? (startedAt > 0 && Date.now() - startedAt < 2500 ? 'starting' : 'running')
      : persisted.worker_process_state === 'stopping'
        ? 'stopping'
        : 'running'
    return {
      ...persisted,
      worker_process_state: processState,
      worker_pid: pid,
      updated_at: persisted.updated_at || new Date().toISOString(),
      last_error: null,
    }
  }

  const crashed = persisted.worker_process_state === 'running' || persisted.worker_process_state === 'starting'
  return {
    ...persisted,
    worker_process_state: crashed ? 'crashed' : 'stopped',
    worker_pid: null,
    stopped_at: persisted.stopped_at || new Date().toISOString(),
    updated_at: persisted.updated_at || new Date().toISOString(),
  }
}

export async function startPipelineWorker(): Promise<PipelineWorkerSupervisorState> {
  const existing = await readPipelineWorkerSupervisorState()
  if (existing.worker_process_state === 'running' && existing.worker_pid && isProcessAlive(existing.worker_pid)) {
    return existing
  }

  const startedAt = new Date().toISOString()
  const command = 'npm run worker:entity-pipeline'
  const child = spawn('bash', ['-lc', command], {
    cwd: process.cwd(),
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      ENTITY_IMPORT_QUEUE_MODE: process.env.ENTITY_IMPORT_QUEUE_MODE || 'durable_worker',
    },
  })
  child.unref()

  return persistState({
    worker_process_state: 'starting',
    worker_pid: child.pid ?? null,
    worker_command: command,
    worker_state_path: WORKER_STATE_PATH,
    worker_pid_path: WORKER_PID_PATH,
    started_at: startedAt,
    stopped_at: null,
    updated_at: startedAt,
    last_error: null,
  })
}

export async function stopPipelineWorker(reason?: string | null): Promise<PipelineWorkerSupervisorState> {
  const current = await readPipelineWorkerSupervisorState()
  const pid = current.worker_pid
  const stoppedAt = new Date().toISOString()

  if (pid && isProcessAlive(pid)) {
    try {
      process.kill(pid, 'SIGTERM')
    } catch (error) {
      return persistState({
        ...current,
        worker_process_state: 'crashed',
        worker_pid: null,
        stopped_at: stoppedAt,
        updated_at: stoppedAt,
        last_error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return persistState({
    ...current,
    worker_process_state: 'stopped',
    worker_pid: null,
    stopped_at: stoppedAt,
    updated_at: stoppedAt,
    last_error: toText(reason) || current.last_error || null,
  })
}

export async function inspectPipelineWorkerSupervisorState(): Promise<PipelineWorkerSupervisorState> {
  return readPipelineWorkerSupervisorState()
}
