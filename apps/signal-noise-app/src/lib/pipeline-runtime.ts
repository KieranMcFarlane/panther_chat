import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
import { resolveOperationalHeartbeatDetails } from '@/lib/operational-heartbeat'
import { readPipelineControlState, type PipelineControlState } from '@/lib/pipeline-control-state'
import {
  inspectPipelineWorkerSupervisorState,
  type PipelineWorkerSupervisorState,
} from '@/lib/pipeline-worker-supervisor'
import { resolveQuestionTextFromDossierData } from '@/lib/question-text-resolver'

export type PipelineRuntimeWorkerState = PipelineWorkerSupervisorState & {
  worker_health: 'healthy' | 'degraded' | 'stopped'
}

export type PipelineRuntimeFastMcpState = {
  url: string
  reachable: boolean
  status_code: number | null
  latency_ms: number | null
  error: string | null
}

export type PipelineRuntimeRunRecord = {
  batch_id: string | null
  entity_id: string
  canonical_entity_id: string | null
  entity_name: string
  status: string | null
  phase: string | null
  current_question_id: string | null
  current_question_text: string | null
  current_action: string | null
  current_stage: string | null
  heartbeat_at: string | null
  heartbeat_age_seconds: number | null
  publication_status: string | null
  retry_state: string | null
  stop_reason: string | null
  error_type: string | null
  error_message: string | null
  queue_state: 'queued' | 'running' | 'retrying' | 'reconciling' | 'published_degraded' | 'failed_terminal' | 'worker_stale'
}

export type PipelineRuntimeSnapshot = {
  generated_at: string
  control: PipelineControlState
  worker: PipelineRuntimeWorkerState
  fastmcp: PipelineRuntimeFastMcpState
  queue_depth: number
  current_run: PipelineRuntimeRunRecord | null
  recent_failures: PipelineRuntimeRunRecord[]
  failure_buckets: Record<PipelineRuntimeRunRecord['queue_state'], number>
}

type PipelineRunRow = {
  batch_id: string | null
  entity_id: string
  canonical_entity_id: string | null
  entity_name: string
  status: string | null
  phase: string | null
  started_at: string | null
  completed_at: string | null
  metadata: Record<string, unknown> | null
}

type PipelineDossierRow = {
  entity_id: string
  canonical_entity_id: string | null
  dossier_data: Record<string, unknown> | null
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function isTerminalFailure(row: PipelineRunRow) {
  const status = toText(row.status).toLowerCase()
  return status === 'failed'
    || status === 'error'
    || status === 'cancelled'
    || status === 'canceled'
}

function getRunQuestionId(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata || typeof metadata !== 'object') return null
  const value = metadata.current_question_id
    || metadata.active_question_id
    || metadata.next_repair_question_id
    || metadata.last_completed_question
  return toText(value) || null
}

function getRunQuestionText(metadata: Record<string, unknown> | null | undefined, dossierData: Record<string, unknown> | null | undefined, questionId: string | null) {
  const explicitText = metadata && typeof metadata === 'object'
    ? toText(
        metadata.current_question_text
        || metadata.active_question_text
        || metadata.next_repair_question_text
        || metadata.last_completed_question_text,
      )
    : ''
  if (explicitText) return explicitText
  if (!questionId) return null
  return resolveQuestionTextFromDossierData(dossierData ?? null, questionId)
}

function getRunAction(metadata: Record<string, unknown> | null | undefined, row: PipelineRunRow) {
  if (!metadata || typeof metadata !== 'object') {
    return toText(row.phase || row.status) || null
  }
  const phaseDetailsByPhase = metadata.phase_details_by_phase
  if (phaseDetailsByPhase && typeof phaseDetailsByPhase === 'object') {
    const currentPhase = toText(row.phase || metadata.run_phase || row.status)
    const detail = (phaseDetailsByPhase as Record<string, unknown>)[currentPhase]
    if (detail && typeof detail === 'object') {
      const detailRecord = detail as Record<string, unknown>
      const phaseTitle = toText(detailRecord.title || detailRecord.summary || detailRecord.description)
      if (phaseTitle) {
        return phaseTitle
      }
    }
  }
  return toText(metadata.current_action || metadata.next_action || metadata.run_phase || row.phase || row.status) || null
}

function classifyQueueState(row: PipelineRunRow, workerRunning: boolean): PipelineRuntimeRunRecord['queue_state'] {
  const status = toText(row.status).toLowerCase()
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  const publicationStatus = toText(metadata.publication_status).toLowerCase()
  const reconciliationState = toText(metadata.reconciliation_state).toLowerCase()
  const retryState = toText(metadata.retry_state).toLowerCase()
  if (!workerRunning && (status === 'running' || status === 'claiming' || status === 'queued' || status === 'retrying')) {
    return 'worker_stale'
  }
  if (publicationStatus === 'published_degraded') return 'published_degraded'
  if (reconciliationState === 'reconciling') return 'reconciling'
  if (retryState === 'retrying' || status === 'retrying') return 'retrying'
  if (isTerminalFailure(row)) return 'failed_terminal'
  if (status === 'queued' || status === 'claiming') return 'queued'
  return 'running'
}

function toRuntimeRecord(
  row: PipelineRunRow,
  workerRunning: boolean,
  dossierData?: Record<string, unknown> | null,
): PipelineRuntimeRunRecord {
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  const stopDetails = metadata.stop_details && typeof metadata.stop_details === 'object'
    ? metadata.stop_details as Record<string, unknown>
    : null
  const heartbeat = resolveOperationalHeartbeatDetails({
    heartbeat_at: metadata.heartbeat_at || row.completed_at || row.started_at,
    started_at: row.started_at,
    generated_at: row.completed_at ?? row.started_at,
  })
  const queueState = classifyQueueState(row, workerRunning)
  const currentQuestionId = getRunQuestionId(metadata)
  return {
    batch_id: row.batch_id,
    entity_id: row.entity_id,
    canonical_entity_id: row.canonical_entity_id,
    entity_name: row.entity_name,
    status: row.status,
    phase: row.phase,
    current_question_id: currentQuestionId,
    current_question_text: getRunQuestionText(metadata, dossierData, currentQuestionId),
    current_action: getRunAction(metadata, row),
    current_stage: toText(metadata.current_stage || metadata.run_phase || row.phase || row.status) || null,
    heartbeat_at: heartbeat.heartbeat_at,
    heartbeat_age_seconds: heartbeat.heartbeat_age_seconds,
    publication_status: toText(metadata.publication_status) || null,
    retry_state: toText(metadata.retry_state) || null,
    stop_reason: toText(metadata.stop_reason) || null,
    error_type: toText(metadata.error_type || metadata.failure_type) || null,
    error_message: toText(metadata.error_message || stopDetails?.error_message || stopDetails?.message) || null,
    queue_state: queueState,
  }
}

async function probeFastMcpHealth(): Promise<PipelineRuntimeFastMcpState> {
  const baseUrl = (
    process.env.FASTAPI_URL
    || process.env.PYTHON_BACKEND_URL
    || process.env.NEXT_PUBLIC_FASTAPI_URL
    || 'http://127.0.0.1:8000'
  ).replace(/\/$/, '')
  const url = `${baseUrl}/health`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 1500)
  const startedAt = Date.now()
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' })
    return {
      url,
      reachable: response.ok,
      status_code: response.status,
      latency_ms: Date.now() - startedAt,
      error: response.ok ? null : `health check failed with ${response.status}`,
    }
  } catch (error) {
    return {
      url,
      reachable: false,
      status_code: null,
      latency_ms: null,
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function loadRecentRuntimeRuns(): Promise<PipelineRunRow[]> {
  const response = await supabase
    .from('entity_pipeline_runs')
    .select('batch_id, entity_id, canonical_entity_id, entity_name, status, phase, started_at, completed_at, metadata')
    .order('started_at', { ascending: false })
    .limit(50)

  if (response.error) {
    throw response.error
  }

  return Array.isArray(response.data) ? (response.data as PipelineRunRow[]) : []
}

async function loadRecentRuntimeDossiers(): Promise<PipelineDossierRow[]> {
  const response = await supabase
    .from('entity_dossiers')
    .select('entity_id, canonical_entity_id, dossier_data')
    .order('generated_at', { ascending: false })
    .limit(50)

  if (response.error) {
    throw response.error
  }

  return Array.isArray(response.data) ? (response.data as PipelineDossierRow[]) : []
}

function buildFailureBuckets(records: PipelineRuntimeRunRecord[]) {
  const buckets: Record<PipelineRuntimeRunRecord['queue_state'], number> = {
    queued: 0,
    running: 0,
    retrying: 0,
    reconciling: 0,
    published_degraded: 0,
    failed_terminal: 0,
    worker_stale: 0,
  }
  for (const record of records) {
    buckets[record.queue_state] += 1
  }
  return buckets
}

function sortMostRelevant(left: PipelineRuntimeRunRecord, right: PipelineRuntimeRunRecord) {
  const leftScore = (
    left.queue_state === 'worker_stale' ? 4
      : left.queue_state === 'failed_terminal' ? 3
        : left.queue_state === 'published_degraded' ? 2
          : left.queue_state === 'reconciling' ? 1
            : 0
  )
  const rightScore = (
    right.queue_state === 'worker_stale' ? 4
      : right.queue_state === 'failed_terminal' ? 3
        : right.queue_state === 'published_degraded' ? 2
          : right.queue_state === 'reconciling' ? 1
            : 0
  )
  if (leftScore !== rightScore) return rightScore - leftScore
  return (right.heartbeat_age_seconds ?? 0) - (left.heartbeat_age_seconds ?? 0)
}

function rankCurrentRun(record: PipelineRuntimeRunRecord) {
  const queueStateScore = (
    record.queue_state === 'running' ? 6
      : record.queue_state === 'retrying' ? 5
        : record.queue_state === 'reconciling' ? 4
          : record.queue_state === 'published_degraded' ? 3
            : record.queue_state === 'queued' ? 2
              : record.queue_state === 'worker_stale' ? 1
                : 0
  )

  const freshnessScore = -1 * (record.heartbeat_age_seconds ?? Number.MAX_SAFE_INTEGER)
  return [queueStateScore, freshnessScore] as const
}

function selectCurrentRun(records: PipelineRuntimeRunRecord[]) {
  return [...records].sort((left, right) => {
    const [leftStateScore, leftFreshnessScore] = rankCurrentRun(left)
    const [rightStateScore, rightFreshnessScore] = rankCurrentRun(right)
    if (leftStateScore !== rightStateScore) return rightStateScore - leftStateScore
    return rightFreshnessScore - leftFreshnessScore
  })[0] ?? null
}

export async function loadPipelineRuntimeSnapshot(): Promise<PipelineRuntimeSnapshot> {
  const [control, worker, rows, dossiers] = await Promise.all([
    readPipelineControlState(),
    inspectPipelineWorkerSupervisorState(),
    loadRecentRuntimeRuns(),
    loadRecentRuntimeDossiers(),
  ])

  const dossierLookup = new Map<string, Record<string, unknown>>()
  for (const dossierRow of dossiers) {
    const dossierData = dossierRow.dossier_data && typeof dossierRow.dossier_data === 'object'
      ? dossierRow.dossier_data
      : null
    if (!dossierData) continue
    const keys = [dossierRow.entity_id, dossierRow.canonical_entity_id]
      .map((value) => toText(value).toLowerCase())
      .filter(Boolean)
    for (const key of keys) {
      if (!dossierLookup.has(key)) {
        dossierLookup.set(key, dossierData)
      }
    }
  }

  const workerHealthy = worker.worker_process_state === 'running'
  const workerState: PipelineRuntimeWorkerState = {
    ...worker,
    worker_health: workerHealthy
      ? 'healthy'
      : worker.worker_process_state === 'stopped'
        ? 'stopped'
        : 'degraded',
  }

  const runtimeRecords = rows.map((row) => {
    const dossierData = dossierLookup.get(toText(row.entity_id).toLowerCase())
      || (row.canonical_entity_id ? dossierLookup.get(toText(row.canonical_entity_id).toLowerCase()) : null)
      || null
    return toRuntimeRecord(row, workerHealthy, dossierData)
  })
  const currentRun = selectCurrentRun(runtimeRecords)
  const recentFailures = runtimeRecords
    .filter((record) => record.queue_state !== 'running' && record.queue_state !== 'queued')
    .sort(sortMostRelevant)
    .slice(0, 8)
  const failureBuckets = buildFailureBuckets(runtimeRecords)

  const fastmcp = await probeFastMcpHealth()
  const queueDepth = runtimeRecords.filter((record) => record.queue_state !== 'failed_terminal').length

  return {
    generated_at: new Date().toISOString(),
    control,
    worker: workerState,
    fastmcp,
    queue_depth: queueDepth,
    current_run: currentRun,
    recent_failures: recentFailures,
    failure_buckets: failureBuckets,
  }
}
