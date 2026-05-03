type RuntimeRunState = 'queued' | 'running' | 'completed' | 'retrying' | 'reconciling' | 'published_degraded' | 'failed_terminal' | 'worker_stale'

type RuntimeRunSnapshot = {
  batch_id?: string | null
  entity_id: string
  canonical_entity_id?: string | null
  entity_name: string
  status?: string | null
  phase?: string | null
  current_section_id?: string | null
  current_section_label?: string | null
  current_section_index?: number | null
  current_section_total?: number | null
  current_substep?: string | null
  current_substep_label?: string | null
  current_substep_progress?: string | null
  current_question_id?: string | null
  current_question_text?: string | null
  current_question_index?: number | null
  current_question_total?: number | null
  current_strategy_label?: string | null
  current_execution_state?: string | null
  current_source_order?: string[] | null
  execution_backend?: string | null
  execution_model?: string | null
  execution_provider?: string | null
  brightdata_transport?: string | null
  current_action?: string | null
  current_stage?: string | null
  heartbeat_at?: string | null
  heartbeat_age_seconds?: number | null
  publication_status?: string | null
  retry_state?: string | null
  stop_reason?: string | null
  continue_pipeline_on_failure?: boolean
  error_type?: string | null
  error_message?: string | null
  queue_state?: RuntimeRunState
}

export type OperationalQueueEntity = {
  batch_id?: string | null
  status?: string | null
  entity_id: string
  entity_name: string
  entity_type: string
  summary: string | null
  generated_at: string | null
  started_at?: string | null
  heartbeat_at?: string | null
  heartbeat_age_seconds?: number | null
  heartbeat_source?: string | null
  freshness_state?: 'fresh' | 'stale' | null
  retry_state?: string | null
  stop_reason?: string | null
  continue_pipeline_on_failure?: boolean
  stop_details?: Record<string, unknown> | null
  active_question_id?: string | null
  current_question_id?: string | null
  current_question_text?: string | null
  current_section_id?: string | null
  current_section_label?: string | null
  current_section_index?: number | null
  current_section_total?: number | null
  current_question_index?: number | null
  current_question_total?: number | null
  current_strategy_label?: string | null
  current_execution_state?: string | null
  current_source_order?: string[] | null
  execution_backend?: string | null
  execution_model?: string | null
  execution_provider?: string | null
  brightdata_transport?: string | null
  current_substep?: string | null
  current_substep_label?: string | null
  current_substep_progress?: string | null
  current_action?: string | null
  run_phase?: string | null
  current_stage?: string | null
  queue_position?: number | null
  publication_status?: string | null
  next_repair_question_id?: string | null
  next_repair_question_text?: string | null
  next_repair_status?: string | null
  next_repair_batch_id?: string | null
  next_repair_batch_status?: string | null
  last_completed_question?: string | null
  last_completed_question_text?: string | null
  next_action?: string | null
}

export type OperationalDrilldownPayload = {
  snapshot_at?: string | null
  last_activity_at?: string | null
  freshness_state?: 'fresh' | 'stale'
  control?: {
    is_paused?: boolean
    pause_reason?: string | null
    stop_reason?: string | null
    stop_details?: Record<string, unknown> | null
    updated_at?: string | null
    desired_state?: 'running' | 'paused'
    requested_state?: 'running' | 'paused'
    observed_state?: 'starting' | 'running' | 'stopping' | 'paused'
    transition_state?: 'starting' | 'running' | 'stopping' | 'paused'
  }
  runtime?: {
    snapshot_at?: string | null
    generated_at?: string | null
    state?: string | null
    health_class?: string | null
    last_self_heal_action?: string | null
    last_self_heal_reason?: string | null
    last_self_heal_at?: string | null
    worker?: {
      worker_process_state?: 'starting' | 'running' | 'stopping' | 'stopped' | 'crashed'
      worker_pid?: number | null
      worker_command?: string | null
      worker_state_path?: string | null
      worker_pid_path?: string | null
      started_at?: string | null
      stopped_at?: string | null
      updated_at?: string | null
      last_error?: string | null
      worker_health?: 'healthy' | 'degraded' | 'stopped'
    }
    fastmcp?: {
      url?: string | null
      reachable?: boolean
      status_code?: number | null
      latency_ms?: number | null
      error?: string | null
    }
    queue_depth?: number
    current_run?: RuntimeRunSnapshot | null
    current_live_run?: RuntimeRunSnapshot | null
    latest_noteworthy_run?: RuntimeRunSnapshot | null
    recent_failures?: RuntimeRunSnapshot[]
    failure_buckets?: Record<RuntimeRunState, number>
  }
  live_state?: {
    operational_state?: 'starting' | 'running' | 'retrying' | 'reconciling' | 'published_degraded' | 'stopping' | 'paused' | 'stopped' | 'waiting'
    worker_process_state?: 'starting' | 'running' | 'stopping' | 'stopped' | 'crashed'
    current_run?: RuntimeRunSnapshot | null
    current_live_run?: RuntimeRunSnapshot | null
    in_progress_entity?: OperationalQueueEntity | null
    running_entities?: OperationalQueueEntity[]
  }
  backlog_health?: {
    stale_active_count?: number
    worker_stale_count?: number
    retrying_count?: number
    reconciling_count?: number
    published_degraded_count?: number
    failed_terminal_count?: number
    healthy?: boolean
  }
  loop_status: {
    universe_count?: number
    total_scheduled?: number
    completed?: number
    processed_dossiers?: number
    failed?: number
    retryable_failures?: number
    quality_counts?: {
      partial?: number
      blocked?: number
      complete?: number
      client_ready?: number
    }
    runtime_counts?: {
      running?: number
      queued?: number
      stalled?: number
      retryable?: number
      resume_needed?: number
    }
  }
  queue: {
    in_progress_entity: OperationalQueueEntity | null
    running_entities?: OperationalQueueEntity[]
    stale_active_rows?: OperationalQueueEntity[]
    latest_noteworthy_entity?: OperationalQueueEntity | null
    processed_entities?: OperationalQueueEntity[]
    completed_entities: OperationalQueueEntity[]
    resume_needed_entities: OperationalQueueEntity[]
    upcoming_entities: OperationalQueueEntity[]
    heartbeat_at?: string | null
  }
  playlist_sort_key?: string[]
  operational_state?: 'starting' | 'running' | 'retrying' | 'skipping' | 'stopping' | 'paused' | 'stopped' | 'waiting'
  stop_reason?: string | null
  stop_details?: Record<string, unknown> | null
  freshness_threshold_seconds?: number
  dossier_quality: {
    incomplete_entities: Array<Record<string, unknown>>
  }
}

let inFlightOperationalDrilldownRequest: Promise<OperationalDrilldownPayload> | null = null
let cachedOperationalDrilldownPayload: OperationalDrilldownPayload | null = null
let cachedOperationalDrilldownFetchedAt = 0
const operationalDrilldownListeners = new Set<(payload: OperationalDrilldownPayload | null) => void>()
const operationalDrilldownPollingIntervals = new Map<symbol, number>()
let operationalDrilldownPoller: number | null = null

export const OPERATIONAL_DRILLDOWN_CACHE_TTL_MS = 4_000
export const OPERATIONAL_DRILLDOWN_STORAGE_KEY = 'signal-noise.operational-drilldown.v1'
export const OPERATIONAL_DRILLDOWN_ACTIVE_GRACE_MS = 8_000

function parseTimestamp(value: unknown) {
  if (!value) return 0
  const parsed = Date.parse(String(value))
  return Number.isFinite(parsed) ? parsed : 0
}

function smoothOperationalDrilldownPayload(
  nextPayload: OperationalDrilldownPayload,
  previousPayload: OperationalDrilldownPayload | null,
  now = Date.now(),
) {
  if (!previousPayload) return nextPayload
  if (nextPayload.operational_state !== 'waiting') return nextPayload
  if (nextPayload.control?.requested_state === 'paused' || nextPayload.control?.is_paused === true) {
    return nextPayload
  }
  if (nextPayload.live_state?.current_live_run || nextPayload.queue?.in_progress_entity) {
    return nextPayload
  }

  const previousRun = previousPayload.live_state?.current_live_run
    || previousPayload.queue?.in_progress_entity
    || previousPayload.runtime?.current_live_run
    || previousPayload.runtime?.current_run
    || null
  if (!previousRun) return nextPayload

  const previousState = previousPayload.operational_state || previousPayload.live_state?.operational_state || null
  if (previousState !== 'running' && previousState !== 'retrying' && previousState !== 'reconciling') {
    return nextPayload
  }

  const previousActivityAt = parseTimestamp(
    previousPayload.last_activity_at
    || previousPayload.runtime?.worker?.current_activity_at
    || previousPayload.snapshot_at
    || previousPayload.runtime?.generated_at
    || previousPayload.runtime?.snapshot_at,
  )
  if (!previousActivityAt || (now - previousActivityAt) > OPERATIONAL_DRILLDOWN_ACTIVE_GRACE_MS) {
    return nextPayload
  }

  const previousInProgressEntity = previousPayload.live_state?.in_progress_entity
    || previousPayload.queue?.in_progress_entity
    || null
  const previousRunningEntities = previousPayload.live_state?.running_entities
    || previousPayload.queue?.running_entities
    || (previousInProgressEntity ? [previousInProgressEntity] : [])

  return {
    ...nextPayload,
    operational_state: 'running',
    live_state: {
      ...nextPayload.live_state,
      operational_state: 'running',
      current_run: previousRun,
      current_live_run: previousRun,
      in_progress_entity: previousInProgressEntity,
      running_entities: previousRunningEntities,
    },
    runtime: {
      ...nextPayload.runtime,
      current_run: previousRun,
      current_live_run: previousRun,
      latest_noteworthy_run: nextPayload.runtime?.latest_noteworthy_run || previousRun,
    },
    queue: {
      ...nextPayload.queue,
      in_progress_entity: previousInProgressEntity,
      running_entities: previousRunningEntities,
      latest_noteworthy_entity: nextPayload.queue?.latest_noteworthy_entity || previousInProgressEntity || previousRun,
    },
  }
}

function persistOperationalDrilldownPayload(payload: OperationalDrilldownPayload | null) {
  if (typeof window === 'undefined' || !window.sessionStorage) return
  try {
    if (!payload) {
      window.sessionStorage.removeItem(OPERATIONAL_DRILLDOWN_STORAGE_KEY)
      return
    }
    window.sessionStorage.setItem(OPERATIONAL_DRILLDOWN_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Best-effort persistence only.
  }
}

function hydrateOperationalDrilldownPayloadFromStorage() {
  if (cachedOperationalDrilldownPayload || typeof window === 'undefined' || !window.sessionStorage) {
    return cachedOperationalDrilldownPayload
  }

  try {
    const rawPayload = window.sessionStorage.getItem(OPERATIONAL_DRILLDOWN_STORAGE_KEY)
    if (!rawPayload) {
      return null
    }
    const payload = JSON.parse(rawPayload) as OperationalDrilldownPayload
    cachedOperationalDrilldownPayload = payload
    cachedOperationalDrilldownFetchedAt = 0
    return payload
  } catch {
    window.sessionStorage.removeItem(OPERATIONAL_DRILLDOWN_STORAGE_KEY)
    return null
  }
}

function notifyOperationalDrilldownListeners(payload: OperationalDrilldownPayload | null) {
  for (const listener of operationalDrilldownListeners) {
    listener(payload)
  }
}

function resetOperationalDrilldownCache() {
  cachedOperationalDrilldownPayload = null
  cachedOperationalDrilldownFetchedAt = 0
  inFlightOperationalDrilldownRequest = null
}

function getOperationalDrilldownPollingIntervalMs() {
  const intervals = [...operationalDrilldownPollingIntervals.values()].filter((value) => Number.isFinite(value) && value > 0)
  if (intervals.length === 0) return null
  return Math.min(...intervals)
}

function stopOperationalDrilldownPolling() {
  if (operationalDrilldownPoller !== null && typeof window !== 'undefined') {
    window.clearInterval(operationalDrilldownPoller)
  }
  operationalDrilldownPoller = null
}

function ensureOperationalDrilldownPolling() {
  if (typeof window === 'undefined') return
  const intervalMs = getOperationalDrilldownPollingIntervalMs()
  if (!intervalMs || operationalDrilldownListeners.size === 0) {
    stopOperationalDrilldownPolling()
    return
  }
  stopOperationalDrilldownPolling()
  operationalDrilldownPoller = window.setInterval(() => {
    if (document.visibilityState !== 'visible') return
    void refreshOperationalDrilldownPayload().catch(() => {
      // Best-effort polling only.
    })
  }, intervalMs)
}

export function isOperationalDrilldownCacheFresh(now = Date.now()) {
  hydrateOperationalDrilldownPayloadFromStorage()
  if (!cachedOperationalDrilldownPayload || !cachedOperationalDrilldownFetchedAt) {
    return false
  }
  return now - cachedOperationalDrilldownFetchedAt < OPERATIONAL_DRILLDOWN_CACHE_TTL_MS
}

export function getCachedOperationalDrilldownPayload() {
  return cachedOperationalDrilldownPayload ?? hydrateOperationalDrilldownPayloadFromStorage()
}

export function subscribeOperationalDrilldown(listener: (payload: OperationalDrilldownPayload | null) => void) {
  operationalDrilldownListeners.add(listener)
  return () => {
    operationalDrilldownListeners.delete(listener)
    ensureOperationalDrilldownPolling()
  }
}

export function startOperationalDrilldownPolling(intervalMs: number) {
  const token = Symbol('operational-drilldown-polling')
  operationalDrilldownPollingIntervals.set(token, intervalMs)
  ensureOperationalDrilldownPolling()
  return () => {
    operationalDrilldownPollingIntervals.delete(token)
    ensureOperationalDrilldownPolling()
  }
}

export async function loadOperationalDrilldownPayload() {
  if (isOperationalDrilldownCacheFresh()) {
    return cachedOperationalDrilldownPayload
  }

  if (!inFlightOperationalDrilldownRequest) {
    inFlightOperationalDrilldownRequest = fetch('/api/home/queue-drilldown', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Failed to load operational drilldown')
        }
        const payload = smoothOperationalDrilldownPayload(
          await response.json() as OperationalDrilldownPayload,
          cachedOperationalDrilldownPayload,
        )
        cachedOperationalDrilldownPayload = payload
        cachedOperationalDrilldownFetchedAt = Date.now()
        persistOperationalDrilldownPayload(payload)
        notifyOperationalDrilldownListeners(payload)
        return payload
      })
      .finally(() => {
        inFlightOperationalDrilldownRequest = null
      })
  }

  return inFlightOperationalDrilldownRequest
}

export async function refreshOperationalDrilldownPayload() {
  const previousPayload = cachedOperationalDrilldownPayload ?? hydrateOperationalDrilldownPayloadFromStorage()
  resetOperationalDrilldownCache()
  if (!inFlightOperationalDrilldownRequest) {
    inFlightOperationalDrilldownRequest = fetch('/api/home/queue-drilldown?refresh=1', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Failed to refresh operational drilldown')
        }
        const payload = smoothOperationalDrilldownPayload(
          await response.json() as OperationalDrilldownPayload,
          previousPayload,
        )
        cachedOperationalDrilldownPayload = payload
        cachedOperationalDrilldownFetchedAt = Date.now()
        persistOperationalDrilldownPayload(payload)
        notifyOperationalDrilldownListeners(payload)
        return payload
      })
      .finally(() => {
        inFlightOperationalDrilldownRequest = null
      })
  }

  return inFlightOperationalDrilldownRequest
}

export function primeOperationalDrilldownPayload() {
  void loadOperationalDrilldownPayload().catch(() => {
    // Best-effort prewarm only.
  })
}
