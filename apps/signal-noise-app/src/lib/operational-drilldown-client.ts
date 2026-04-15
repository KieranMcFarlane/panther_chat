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
  stop_details?: Record<string, unknown> | null
  active_question_id?: string | null
  current_question_id?: string | null
  current_question_text?: string | null
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
    generated_at?: string | null
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
    current_run?: {
      batch_id?: string | null
      entity_id: string
      canonical_entity_id?: string | null
      entity_name: string
      status?: string | null
      phase?: string | null
      current_question_id?: string | null
      current_question_text?: string | null
      current_action?: string | null
      current_stage?: string | null
      heartbeat_at?: string | null
      heartbeat_age_seconds?: number | null
      publication_status?: string | null
      retry_state?: string | null
      stop_reason?: string | null
      error_type?: string | null
      error_message?: string | null
      queue_state?: 'queued' | 'running' | 'retrying' | 'reconciling' | 'published_degraded' | 'failed_terminal' | 'worker_stale'
    } | null
    recent_failures?: Array<{
      batch_id?: string | null
      entity_id: string
      canonical_entity_id?: string | null
      entity_name: string
      status?: string | null
      phase?: string | null
      current_question_id?: string | null
      current_question_text?: string | null
      current_action?: string | null
      current_stage?: string | null
      heartbeat_at?: string | null
      heartbeat_age_seconds?: number | null
      publication_status?: string | null
      retry_state?: string | null
      stop_reason?: string | null
      error_type?: string | null
      error_message?: string | null
      queue_state?: 'queued' | 'running' | 'retrying' | 'reconciling' | 'published_degraded' | 'failed_terminal' | 'worker_stale'
    }>
    failure_buckets?: Record<'queued' | 'running' | 'retrying' | 'reconciling' | 'published_degraded' | 'failed_terminal' | 'worker_stale', number>
  }
  live_state?: {
    operational_state?: 'starting' | 'running' | 'retrying' | 'reconciling' | 'published_degraded' | 'stopping' | 'paused' | 'stopped' | 'waiting'
    worker_process_state?: 'starting' | 'running' | 'stopping' | 'stopped' | 'crashed'
    current_run?: {
      batch_id?: string | null
      entity_id: string
      canonical_entity_id?: string | null
      entity_name: string
      status?: string | null
      phase?: string | null
      current_question_id?: string | null
      current_question_text?: string | null
      current_action?: string | null
      current_stage?: string | null
      heartbeat_at?: string | null
      heartbeat_age_seconds?: number | null
      publication_status?: string | null
      retry_state?: string | null
      stop_reason?: string | null
      error_type?: string | null
      error_message?: string | null
      queue_state?: 'queued' | 'running' | 'retrying' | 'reconciling' | 'published_degraded' | 'failed_terminal' | 'worker_stale'
    } | null
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

export function getCachedOperationalDrilldownPayload() {
  return cachedOperationalDrilldownPayload
}

export async function loadOperationalDrilldownPayload() {
  if (cachedOperationalDrilldownPayload) {
    return cachedOperationalDrilldownPayload
  }

  if (!inFlightOperationalDrilldownRequest) {
    inFlightOperationalDrilldownRequest = fetch('/api/home/queue-drilldown', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Failed to load operational drilldown')
        }
        const payload = await response.json() as OperationalDrilldownPayload
        cachedOperationalDrilldownPayload = payload
        return payload
      })
      .finally(() => {
        inFlightOperationalDrilldownRequest = null
      })
  }

  return inFlightOperationalDrilldownRequest
}

export async function refreshOperationalDrilldownPayload() {
  cachedOperationalDrilldownPayload = null
  inFlightOperationalDrilldownRequest = null
  return loadOperationalDrilldownPayload()
}

export function primeOperationalDrilldownPayload() {
  void loadOperationalDrilldownPayload().catch(() => {
    // Best-effort prewarm only.
  })
}
