export type OperationalDrilldownPayload = {
  control?: {
    is_paused?: boolean
    pause_reason?: string | null
    updated_at?: string | null
    desired_state?: 'running' | 'paused'
    requested_state?: 'running' | 'paused'
    observed_state?: 'starting' | 'running' | 'stopping' | 'paused'
    transition_state?: 'starting' | 'running' | 'stopping' | 'paused'
  }
  loop_status: {
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
      stalled?: number
      retryable?: number
      resume_needed?: number
    }
  }
  queue: {
    in_progress_entity: {
      entity_id: string
      entity_name: string
      entity_type: string
      summary: string | null
      generated_at: string | null
      started_at?: string | null
      active_question_id?: string | null
      current_question_id?: string | null
      run_phase?: string | null
      current_stage?: string | null
      queue_position?: number | null
      publication_status?: string | null
      next_repair_question_id?: string | null
      next_repair_status?: string | null
      next_repair_batch_id?: string | null
      next_repair_batch_status?: string | null
      next_action?: string | null
    } | null
    running_entities?: Array<Record<string, unknown>>
    completed_entities: Array<Record<string, unknown>>
    resume_needed_entities: Array<Record<string, unknown>>
    upcoming_entities: Array<Record<string, unknown>>
  }
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
    inFlightOperationalDrilldownRequest = fetch('/api/home/queue-drilldown')
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
