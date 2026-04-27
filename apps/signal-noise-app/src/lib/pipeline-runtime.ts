import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
import { OPERATIONAL_HEARTBEAT_STALE_SECONDS } from '@/lib/operational-heartbeat'
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
  current_section_id: string | null
  current_section_label: string | null
  current_section_index: number | null
  current_section_total: number | null
  current_substep: string | null
  current_substep_label: string | null
  current_substep_progress: string | null
  current_question_id: string | null
  current_question_text: string | null
  current_question_index: number | null
  current_question_total: number | null
  current_strategy_label: string | null
  current_execution_state: string | null
  current_source_order: string[] | null
  execution_backend: string | null
  execution_model: string | null
  execution_provider: string | null
  brightdata_transport: string | null
  current_action: string | null
  current_stage: string | null
  heartbeat_at: string | null
  heartbeat_age_seconds: number | null
  publication_status: string | null
  retry_state: string | null
  stop_reason: string | null
  continue_pipeline_on_failure: boolean
  error_type: string | null
  error_message: string | null
  queue_state: 'queued' | 'running' | 'completed' | 'retrying' | 'reconciling' | 'published_degraded' | 'failed_terminal' | 'worker_stale'
}

export type PipelineRuntimeSnapshot = {
  snapshot_at: string
  generated_at: string
  control: PipelineControlState
  worker: PipelineRuntimeWorkerState
  fastmcp: PipelineRuntimeFastMcpState
  queue_depth: number
  current_run: PipelineRuntimeRunRecord | null
  current_live_run: PipelineRuntimeRunRecord | null
  latest_noteworthy_run: PipelineRuntimeRunRecord | null
  recent_failures: PipelineRuntimeRunRecord[]
  failure_buckets: Record<PipelineRuntimeRunRecord['queue_state'], number>
}

export type PipelineRunRow = {
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

export type PipelineDossierRow = {
  entity_id: string
  canonical_entity_id: string | null
  entity_name: string | null
  entity_type: string | null
  generated_at: string | null
  dossier_data: Record<string, unknown> | null
}

export type PipelineRuntimeReadSet = {
  snapshot_at: string
  control: PipelineControlState
  worker: PipelineRuntimeWorkerState
  fastmcp: PipelineRuntimeFastMcpState
  rows: PipelineRunRow[]
  dossiers: PipelineDossierRow[]
}

const DOSSIER_SUBSTEP_ORDER = [
  'cache_lookup',
  'collect_entity_data',
  'connect_falkordb',
  'fetch_falkordb_metadata',
  'connect_brightdata',
  'brightdata_search_official',
  'brightdata_scrape_official',
  'extract_entity_properties',
  'generate_dossier_content',
  'persist_dossier',
  'finalize_response',
] as const

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

function getRunQuestionId(metadata: Record<string, unknown> | null | undefined, row: PipelineRunRow) {
  if (!metadata || typeof metadata !== 'object') return null
  const value = getCurrentPhaseDetailValue(metadata, row, 'current_question_id')
    || metadata.current_question_id
    || metadata.active_question_id
    || metadata.next_repair_question_id
    || metadata.last_completed_question
  return toText(value) || null
}

function getRunQuestionText(
  metadata: Record<string, unknown> | null | undefined,
  row: PipelineRunRow,
  dossierData: Record<string, unknown> | null | undefined,
  questionId: string | null,
) {
  const explicitText = metadata && typeof metadata === 'object'
    ? toText(
        getCurrentPhaseDetailValue(metadata, row, 'current_question_text')
        || metadata.current_question_text
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

function getCurrentPhaseDetailValue(metadata: Record<string, unknown> | null | undefined, row: PipelineRunRow, key: string) {
  if (!metadata || typeof metadata !== 'object') return null
  const phaseDetailsByPhase = metadata.phase_details_by_phase
  const currentPhase = toText(row.phase || metadata.run_phase || row.status)
  if (phaseDetailsByPhase && typeof phaseDetailsByPhase === 'object' && currentPhase) {
    const detail = (phaseDetailsByPhase as Record<string, unknown>)[currentPhase]
    if (detail && typeof detail === 'object') {
      return (detail as Record<string, unknown>)[key]
    }
  }
  return metadata[key]
}

function isMeaningfulSubstepStatus(value: unknown) {
  const normalized = toText(value).toLowerCase()
  if (!normalized) return false
  return !['pending', 'running', 'completed', 'failed', 'skipped'].includes(normalized)
}

function getRunSubstep(metadata: Record<string, unknown> | null | undefined, row: PipelineRunRow) {
  if (!metadata || typeof metadata !== 'object') return null
  const phaseDetailsByPhase = metadata.phase_details_by_phase
  const currentPhase = toText(row.phase || metadata.run_phase || row.status)
  if (phaseDetailsByPhase && typeof phaseDetailsByPhase === 'object' && currentPhase) {
    const detail = (phaseDetailsByPhase as Record<string, unknown>)[currentPhase]
    if (detail && typeof detail === 'object') {
      const detailRecord = detail as Record<string, unknown>
      const explicitSubstep = toText(detailRecord.current_substep || detailRecord.substep)
      if (explicitSubstep) return explicitSubstep
      const detailStatus = toText(detailRecord.status)
      if (isMeaningfulSubstepStatus(detailStatus)) return detailStatus
    }
  }
  const explicitSubstep = toText(metadata.current_substep || metadata.substep)
  return explicitSubstep || null
}

function getRunSubstepLabel(metadata: Record<string, unknown> | null | undefined, row: PipelineRunRow) {
  if (!metadata || typeof metadata !== 'object') return null
  const phaseDetailsByPhase = metadata.phase_details_by_phase
  const currentPhase = toText(row.phase || metadata.run_phase || row.status)
  if (phaseDetailsByPhase && typeof phaseDetailsByPhase === 'object' && currentPhase) {
    const detail = (phaseDetailsByPhase as Record<string, unknown>)[currentPhase]
    if (detail && typeof detail === 'object') {
      const detailRecord = detail as Record<string, unknown>
      const label = toText(detailRecord.current_substep_label)
      if (label) return label
    }
  }
  const explicit = toText(metadata.current_substep_label)
  if (explicit) return explicit
  const fallbackSubstep = getRunSubstep(metadata, row)
  return fallbackSubstep ? fallbackSubstep.replace(/_/g, ' ').trim() : null
}

function getRunSubstepProgress(metadata: Record<string, unknown> | null | undefined, row: PipelineRunRow) {
  if (!metadata || typeof metadata !== 'object') return null
  const phaseDetailsByPhase = metadata.phase_details_by_phase
  const currentPhase = toText(row.phase || metadata.run_phase || row.status)
  if (phaseDetailsByPhase && typeof phaseDetailsByPhase === 'object' && currentPhase) {
    const detail = (phaseDetailsByPhase as Record<string, unknown>)[currentPhase]
    if (detail && typeof detail === 'object') {
      const detailRecord = detail as Record<string, unknown>
      const progress = toText(detailRecord.current_substep_progress)
      if (progress) return progress
    }
  }
  const explicit = toText(metadata.current_substep_progress)
  if (explicit) return explicit
  const currentSubstep = getRunSubstep(metadata, row)
  const dossierSubstepIndex = currentSubstep ? DOSSIER_SUBSTEP_ORDER.indexOf(currentSubstep as typeof DOSSIER_SUBSTEP_ORDER[number]) : -1
  if (dossierSubstepIndex >= 0) {
    return `${dossierSubstepIndex + 1}/${DOSSIER_SUBSTEP_ORDER.length} steps`
  }
  const phase0Substeps = metadata.phase0_substeps
  if (phase0Substeps && typeof phase0Substeps === 'object') {
    const substeps = Object.values(phase0Substeps as Record<string, unknown>)
      .filter((detail) => detail && typeof detail === 'object') as Array<Record<string, unknown>>
    if (substeps.length > 0) {
      const completedCount = substeps.filter((detail) => toText(detail.status).toLowerCase() === 'completed').length
      return `${completedCount + 1}/${substeps.length} steps`
    }
  }
  const questionsAnswered = Number(metadata.questions_answered)
  const questionsTotal = Number(metadata.questions_total)
  if (Number.isFinite(questionsAnswered) && Number.isFinite(questionsTotal) && questionsTotal > 0) {
    return `${questionsAnswered}/${questionsTotal} questions`
  }
  return null
}

function getRunSectionId(metadata: Record<string, unknown> | null | undefined, row: PipelineRunRow) {
  return toText(getCurrentPhaseDetailValue(metadata, row, 'current_section_id')) || null
}

function getRunSectionLabel(metadata: Record<string, unknown> | null | undefined, row: PipelineRunRow) {
  return toText(getCurrentPhaseDetailValue(metadata, row, 'current_section_label')) || null
}

function getRunSectionIndex(metadata: Record<string, unknown> | null | undefined, row: PipelineRunRow) {
  const value = Number(getCurrentPhaseDetailValue(metadata, row, 'current_section_index'))
  return Number.isFinite(value) ? value : null
}

function getRunSectionTotal(metadata: Record<string, unknown> | null | undefined, row: PipelineRunRow) {
  const value = Number(getCurrentPhaseDetailValue(metadata, row, 'current_section_total'))
  return Number.isFinite(value) ? value : null
}

function getRunQuestionIndex(metadata: Record<string, unknown> | null | undefined, row: PipelineRunRow) {
  const value = Number(getCurrentPhaseDetailValue(metadata, row, 'current_question_index'))
  return Number.isFinite(value) ? value : null
}

function getRunQuestionTotal(metadata: Record<string, unknown> | null | undefined, row: PipelineRunRow) {
  const value = Number(getCurrentPhaseDetailValue(metadata, row, 'current_question_total'))
  return Number.isFinite(value) ? value : null
}

function getRunStrategyLabel(metadata: Record<string, unknown> | null | undefined, row: PipelineRunRow) {
  return toText(getCurrentPhaseDetailValue(metadata, row, 'current_strategy_label')) || null
}

function getRunExecutionState(metadata: Record<string, unknown> | null | undefined, row: PipelineRunRow) {
  return toText(getCurrentPhaseDetailValue(metadata, row, 'current_execution_state')) || null
}

function getRunSourceOrder(metadata: Record<string, unknown> | null | undefined, row: PipelineRunRow) {
  const value = getCurrentPhaseDetailValue(metadata, row, 'current_source_order')
  if (!Array.isArray(value)) return null
  const normalized = value.map((item) => toText(item)).filter(Boolean)
  return normalized.length > 0 ? normalized : null
}

function getRunExecutionBackend(metadata: Record<string, unknown> | null | undefined, row: PipelineRunRow) {
  return toText(getCurrentPhaseDetailValue(metadata, row, 'execution_backend')) || null
}

function getRunExecutionModel(metadata: Record<string, unknown> | null | undefined, row: PipelineRunRow) {
  return toText(
    getCurrentPhaseDetailValue(metadata, row, 'execution_model')
    || getCurrentPhaseDetailValue(metadata, row, 'opencode_model'),
  ) || null
}

function getRunExecutionProvider(metadata: Record<string, unknown> | null | undefined, row: PipelineRunRow) {
  return toText(
    getCurrentPhaseDetailValue(metadata, row, 'execution_provider')
    || getCurrentPhaseDetailValue(metadata, row, 'opencode_provider'),
  ) || null
}

function getRunBrightDataTransport(metadata: Record<string, unknown> | null | undefined, row: PipelineRunRow) {
  return toText(getCurrentPhaseDetailValue(metadata, row, 'brightdata_transport')) || null
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
  if (status === 'completed') return 'completed'
  if (status === 'queued' || status === 'claiming') return 'queued'
  return 'running'
}

function hasFreshExecutionHeartbeat(row: PipelineRunRow) {
  const status = toText(row.status).toLowerCase()
  if (!['running', 'retrying', 'reconciling'].includes(status)) {
    return false
  }
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  const heartbeatAt = toText(metadata.heartbeat_at)
  if (!heartbeatAt) {
    return false
  }
  const heartbeat = resolveOperationalHeartbeatDetails({
    heartbeat_at: heartbeatAt,
    started_at: row.started_at,
    generated_at: row.completed_at ?? row.started_at,
  })
  return (heartbeat.heartbeat_age_seconds ?? Number.MAX_SAFE_INTEGER) <= OPERATIONAL_HEARTBEAT_STALE_SECONDS
}

function resolveEffectiveWorkerState(
  control: PipelineControlState,
  worker: PipelineRuntimeWorkerState,
  rows: PipelineRunRow[],
): PipelineRuntimeWorkerState {
  const workerState = worker.worker_process_state
  const controlStopping = control.observed_state === 'stopping' || control.transition_state === 'stopping'
  const controlPaused = control.is_paused === true || control.requested_state === 'paused' || control.observed_state === 'paused'
  const hasFreshExecutionEvidence = rows.some(hasFreshExecutionHeartbeat)

  if ((workerState === 'crashed' || workerState === 'stopped') && !controlStopping && !controlPaused && hasFreshExecutionEvidence) {
    return {
      ...worker,
      worker_process_state: 'running',
      worker_health: 'degraded',
    }
  }

  return worker
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
  const currentQuestionId = getRunQuestionId(metadata, row)
  return {
    batch_id: row.batch_id,
    entity_id: row.entity_id,
    canonical_entity_id: row.canonical_entity_id,
    entity_name: row.entity_name,
    status: row.status,
    phase: row.phase,
    current_section_id: getRunSectionId(metadata, row),
    current_section_label: getRunSectionLabel(metadata, row),
    current_section_index: getRunSectionIndex(metadata, row),
    current_section_total: getRunSectionTotal(metadata, row),
    current_substep: getRunSubstep(metadata, row),
    current_substep_label: getRunSubstepLabel(metadata, row),
    current_substep_progress: getRunSubstepProgress(metadata, row),
    current_question_id: currentQuestionId,
    current_question_text: getRunQuestionText(metadata, row, dossierData, currentQuestionId),
    current_question_index: getRunQuestionIndex(metadata, row),
    current_question_total: getRunQuestionTotal(metadata, row),
    current_strategy_label: getRunStrategyLabel(metadata, row),
    current_execution_state: getRunExecutionState(metadata, row),
    current_source_order: getRunSourceOrder(metadata, row),
    execution_backend: getRunExecutionBackend(metadata, row),
    execution_model: getRunExecutionModel(metadata, row),
    execution_provider: getRunExecutionProvider(metadata, row),
    brightdata_transport: getRunBrightDataTransport(metadata, row),
    current_action: getRunAction(metadata, row),
    current_stage: toText(metadata.current_stage || metadata.run_phase || row.phase || row.status) || null,
    heartbeat_at: heartbeat.heartbeat_at,
    heartbeat_age_seconds: heartbeat.heartbeat_age_seconds,
    publication_status: toText(metadata.publication_status) || null,
    retry_state: toText(metadata.retry_state) || null,
    stop_reason: toText(metadata.stop_reason) || null,
    continue_pipeline_on_failure: metadata.continue_pipeline_on_failure === true,
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

async function loadActiveRuntimeRuns(): Promise<PipelineRunRow[]> {
  const response = await supabase
    .from('entity_pipeline_runs')
    .select('batch_id, entity_id, canonical_entity_id, entity_name, status, phase, started_at, completed_at, metadata')
    .in('status', ['running', 'queued', 'retrying', 'reconciling'])
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
    .select('entity_id, canonical_entity_id, entity_name, entity_type, generated_at, dossier_data')
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
    completed: 0,
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

function isLiveQueueState(queueState: PipelineRuntimeRunRecord['queue_state']) {
  return queueState === 'running'
    || queueState === 'retrying'
    || queueState === 'reconciling'
}

function rankLiveRun(record: PipelineRuntimeRunRecord) {
  const queueStateScore = (
    record.queue_state === 'running' ? 4
      : record.queue_state === 'retrying' ? 3
        : record.queue_state === 'reconciling' ? 2
          : 0
  )
  return [queueStateScore, record.heartbeat_age_seconds ?? Number.MAX_SAFE_INTEGER] as const
}

function isCurrentLiveRun(record: PipelineRuntimeRunRecord) {
  return isLiveQueueState(record.queue_state)
    && (record.heartbeat_age_seconds ?? Number.MAX_SAFE_INTEGER) <= OPERATIONAL_HEARTBEAT_STALE_SECONDS
}

function selectCurrentLiveRun(records: PipelineRuntimeRunRecord[]) {
  return records
    .filter(isCurrentLiveRun)
    .sort((left, right) => {
      const [leftStateScore, leftFreshnessScore] = rankLiveRun(left)
      const [rightStateScore, rightFreshnessScore] = rankLiveRun(right)
      if (leftStateScore !== rightStateScore) return rightStateScore - leftStateScore
      return leftFreshnessScore - rightFreshnessScore
    })[0] ?? null
}

function rankNoteworthyRun(record: PipelineRuntimeRunRecord) {
  const queueStateScore = (
    record.queue_state === 'worker_stale' ? 7
      : record.queue_state === 'failed_terminal' ? 6
        : record.queue_state === 'published_degraded' ? 5
          : record.queue_state === 'completed' ? 4
            : record.queue_state === 'reconciling' ? 3
              : record.queue_state === 'retrying' ? 2
                : record.queue_state === 'running' ? 1
                  : 0
  )
  return [queueStateScore, -(record.heartbeat_age_seconds ?? Number.MAX_SAFE_INTEGER)] as const
}

function selectLatestNoteworthyRun(
  records: PipelineRuntimeRunRecord[],
  currentLiveRun: PipelineRuntimeRunRecord | null,
) {
  return records
    .filter((record) => {
      if (currentLiveRun && record.batch_id && record.batch_id === currentLiveRun.batch_id) {
        return false
      }
      if (record.queue_state === 'queued') {
        return false
      }
      return !isCurrentLiveRun(record)
    })
    .sort((left, right) => {
      const [leftStateScore, leftFreshnessScore] = rankNoteworthyRun(left)
      const [rightStateScore, rightFreshnessScore] = rankNoteworthyRun(right)
      if (leftStateScore !== rightStateScore) return rightStateScore - leftStateScore
      return rightFreshnessScore - leftFreshnessScore
    })[0] ?? null
}

export async function loadPipelineRuntimeSnapshot(): Promise<PipelineRuntimeSnapshot> {
  const readSet = await loadPipelineRuntimeReadSet()
  return buildPipelineRuntimeSnapshot(readSet)
}

export async function loadPipelineRuntimeReadSet(): Promise<PipelineRuntimeReadSet> {
  const snapshot_at = new Date().toISOString()
  const [control, worker, activeRows, recentRows, dossiers, fastmcp] = await Promise.all([
    readPipelineControlState(),
    inspectPipelineWorkerSupervisorState(),
    loadActiveRuntimeRuns(),
    loadRecentRuntimeRuns(),
    loadRecentRuntimeDossiers(),
    probeFastMcpHealth(),
  ])
  const rows = [...activeRows, ...recentRows].filter((row, index, allRows) => {
    const key = `${toText(row.batch_id)}::${toText(row.entity_id)}::${toText(row.started_at)}`
    return allRows.findIndex((candidate) => (
      `${toText(candidate.batch_id)}::${toText(candidate.entity_id)}::${toText(candidate.started_at)}` === key
    )) === index
  })

  const workerHealthy = worker.worker_process_state === 'running'
  const workerState: PipelineRuntimeWorkerState = {
    ...worker,
    worker_health: workerHealthy
      ? 'healthy'
      : worker.worker_process_state === 'stopped'
        ? 'stopped'
        : 'degraded',
  }

  return {
    snapshot_at,
    control,
    worker: workerState,
    fastmcp,
    rows,
    dossiers,
  }
}

export function buildPipelineRuntimeSnapshot(readSet: PipelineRuntimeReadSet): PipelineRuntimeSnapshot {
  const { snapshot_at, control, worker: rawWorker, fastmcp, rows, dossiers } = readSet
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

  const worker = resolveEffectiveWorkerState(control, rawWorker, rows)
  const workerHealthy = worker.worker_process_state === 'running'

  const runtimeRecords = rows.map((row) => {
    const dossierData = dossierLookup.get(toText(row.entity_id).toLowerCase())
      || (row.canonical_entity_id ? dossierLookup.get(toText(row.canonical_entity_id).toLowerCase()) : null)
      || null
    return toRuntimeRecord(row, workerHealthy, dossierData)
  })
  const currentLiveRun = selectCurrentLiveRun(runtimeRecords)
  const latestNoteworthyRun = selectLatestNoteworthyRun(runtimeRecords, currentLiveRun)
  const currentRun = currentLiveRun ?? latestNoteworthyRun
  const recentFailures = runtimeRecords
    .filter((record) => record.queue_state !== 'running' && record.queue_state !== 'queued')
    .sort(sortMostRelevant)
    .slice(0, 8)
  const failureBuckets = buildFailureBuckets(runtimeRecords)
  const queueDepth = runtimeRecords.filter((record) => record.queue_state !== 'failed_terminal').length

  return {
    snapshot_at,
    generated_at: snapshot_at,
    control,
    worker,
    fastmcp,
    queue_depth: queueDepth,
    current_run: currentRun,
    current_live_run: currentLiveRun,
    latest_noteworthy_run: latestNoteworthyRun,
    recent_failures: recentFailures,
    failure_buckets: failureBuckets,
  }
}
