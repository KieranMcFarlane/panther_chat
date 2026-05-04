import { OPERATIONAL_HEARTBEAT_STALE_SECONDS } from '@/lib/operational-heartbeat'
import { resolveOperationalHeartbeatDetails } from '@/lib/operational-heartbeat'
import { query as queryPostgres } from '@/lib/pg-client'
import { readPipelineControlState, type PipelineControlState } from '@/lib/pipeline-control-state'
import {
  inspectPipelineWorkerSupervisorState,
  type PipelineWorkerSupervisorState,
} from '@/lib/pipeline-worker-supervisor'
import { buildQuestionTextIndex, resolveQuestionTextFromDossierData } from '@/lib/question-text-resolver'

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
  queue_state: 'queued' | 'running' | 'completed' | 'partial_persisted' | 'retrying' | 'reconciling' | 'published_degraded' | 'failed_terminal' | 'worker_stale'
}

export type PipelineRuntimeSnapshot = {
  snapshot_at: string
  generated_at: string
  state: string
  health_class: string
  last_self_heal_action: string | null
  last_self_heal_reason: string | null
  last_self_heal_at: string | null
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

export const RUNTIME_RUN_METADATA_SELECT_SQL = `
  jsonb_build_object(
    'question_first_checkpoint', limited_runs.metadata->'question_first_checkpoint',
    'current_question_id', limited_runs.metadata->'current_question_id',
    'active_question_id', limited_runs.metadata->'active_question_id',
    'next_repair_question_id', limited_runs.metadata->'next_repair_question_id',
    'last_completed_question', limited_runs.metadata->'last_completed_question',
    'current_question_text', limited_runs.metadata->'current_question_text',
    'active_question_text', limited_runs.metadata->'active_question_text',
    'next_repair_question_text', limited_runs.metadata->'next_repair_question_text',
    'last_completed_question_text', limited_runs.metadata->'last_completed_question_text',
    'current_action', limited_runs.metadata->'current_action',
    'next_action', limited_runs.metadata->'next_action',
    'run_phase', limited_runs.metadata->'run_phase',
    'current_substep', limited_runs.metadata->'current_substep',
    'substep', limited_runs.metadata->'substep',
    'current_substep_label', limited_runs.metadata->'current_substep_label',
    'current_substep_progress', limited_runs.metadata->'current_substep_progress',
    'phase0_substeps', limited_runs.metadata->'phase0_substeps',
    'questions_answered', limited_runs.metadata->'questions_answered',
    'questions_total', limited_runs.metadata->'questions_total',
    'publication_status', limited_runs.metadata->'publication_status',
    'quality_state', limited_runs.metadata->'quality_state',
    'reconciliation_state', limited_runs.metadata->'reconciliation_state',
    'retry_state', limited_runs.metadata->'retry_state',
    'heartbeat_at', limited_runs.metadata->'heartbeat_at',
    'stop_details', limited_runs.metadata->'stop_details',
    'stop_reason', limited_runs.metadata->'stop_reason',
    'continue_pipeline_on_failure', limited_runs.metadata->'continue_pipeline_on_failure',
    'error_type', limited_runs.metadata->'error_type',
    'failure_type', limited_runs.metadata->'failure_type',
    'error_message', limited_runs.metadata->'error_message',
    'execution_backend', limited_runs.metadata->'execution_backend',
    'execution_model', limited_runs.metadata->'execution_model',
    'execution_provider', limited_runs.metadata->'execution_provider',
    'brightdata_transport', limited_runs.metadata->'brightdata_transport',
    'repair_state', limited_runs.metadata->'repair_state',
    'next_repair_status', limited_runs.metadata->'next_repair_status',
    'next_repair_batch_id', limited_runs.metadata->'next_repair_batch_id'
  )
`

export const RUNTIME_RECENT_RUN_METADATA_SELECT_SQL = `
  jsonb_strip_nulls(jsonb_build_object(
    'publication_status', limited_runs.metadata->'publication_status',
    'quality_state', limited_runs.metadata->'quality_state',
    'reconciliation_state', limited_runs.metadata->'reconciliation_state',
    'retry_state', limited_runs.metadata->'retry_state',
    'heartbeat_at', limited_runs.metadata->'heartbeat_at',
    'stop_details', limited_runs.metadata->'stop_details',
    'stop_reason', limited_runs.metadata->'stop_reason',
    'continue_pipeline_on_failure', limited_runs.metadata->'continue_pipeline_on_failure',
    'error_type', limited_runs.metadata->'error_type',
    'failure_type', limited_runs.metadata->'failure_type',
    'error_message', limited_runs.metadata->'error_message'
  ))
`

export const RUNTIME_DOSSIER_DATA_SELECT_SQL = `
  jsonb_strip_nulls(jsonb_build_object(
    'questions', limited_dossiers.dossier_data->'questions',
    'question_first', jsonb_build_object(
      'questions', limited_dossiers.dossier_data#>'{question_first,questions}',
      'answers', limited_dossiers.dossier_data#>'{question_first,answers}'
    )
  ))
`

function synchronizeControlStateWithCurrentLiveRun(
  control: PipelineControlState,
  currentLiveRun: PipelineRuntimeRunRecord | null,
): PipelineControlState {
  if (!currentLiveRun) {
    return {
      ...control,
      current_batch_id: null,
      current_entity_id: null,
      current_canonical_entity_id: null,
      current_entity_name: null,
      current_question_id: null,
      current_question_text: null,
      current_action: null,
      current_phase: null,
      current_activity_at: null,
      cursor_source: null,
    }
  }
  return {
    ...control,
    current_batch_id: currentLiveRun.batch_id,
    current_entity_id: currentLiveRun.entity_id,
    current_canonical_entity_id: currentLiveRun.canonical_entity_id,
    current_entity_name: currentLiveRun.entity_name,
    current_question_id: currentLiveRun.current_question_id,
    current_question_text: currentLiveRun.current_question_text,
    current_action: currentLiveRun.current_action,
    current_phase: currentLiveRun.phase,
    current_activity_at: currentLiveRun.heartbeat_at,
    cursor_source: 'live_runtime_projection',
  }
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

function getQuestionFirstCheckpoint(metadata: Record<string, unknown> | null | undefined, row: PipelineRunRow) {
  if (!metadata || typeof metadata !== 'object') return null
  const phaseCheckpoint = getCurrentPhaseDetailValue(metadata, row, 'question_first_checkpoint')
  if (phaseCheckpoint && typeof phaseCheckpoint === 'object') {
    return phaseCheckpoint as Record<string, unknown>
  }
  const directCheckpoint = metadata.question_first_checkpoint
  if (directCheckpoint && typeof directCheckpoint === 'object') {
    return directCheckpoint as Record<string, unknown>
  }
  return null
}

function getRunQuestionId(metadata: Record<string, unknown> | null | undefined, row: PipelineRunRow) {
  if (!metadata || typeof metadata !== 'object') return null
  const checkpoint = getQuestionFirstCheckpoint(metadata, row)
  const value = getCurrentPhaseDetailValue(metadata, row, 'current_question_id')
    || metadata.current_question_id
    || metadata.active_question_id
    || checkpoint?.current_question_id
    || metadata.next_repair_question_id
    || checkpoint?.last_completed_question_id
    || metadata.last_completed_question
  return toText(value) || null
}

function getRunQuestionText(
  metadata: Record<string, unknown> | null | undefined,
  row: PipelineRunRow,
  dossierData: Record<string, unknown> | null | undefined,
  questionId: string | null,
) {
  const resolvedText = questionId ? resolveQuestionTextFromDossierData(dossierData ?? null, questionId) : null
  const explicitText = metadata && typeof metadata === 'object'
    ? toText(
        getCurrentPhaseDetailValue(metadata, row, 'current_question_text')
        || metadata.current_question_text
        || metadata.active_question_text
        || getQuestionFirstCheckpoint(metadata, row)?.current_question_text
        || metadata.next_repair_question_text
        || metadata.last_completed_question_text,
      )
    : ''
  if (explicitText) {
    if (resolvedText && dossierData && typeof dossierData === 'object') {
      const normalizedExplicit = explicitText.toLowerCase()
      const matchingQuestionIds = [...buildQuestionTextIndex(dossierData).entries()]
        .filter(([, text]) => toText(text).toLowerCase() === normalizedExplicit)
        .map(([id]) => id)
      if (matchingQuestionIds.length > 0 && questionId && !matchingQuestionIds.includes(questionId.toLowerCase())) {
        return resolvedText
      }
    }
    return explicitText
  }
  if (!questionId) return null
  return resolvedText
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
  const checkpoint = getQuestionFirstCheckpoint(metadata, row)
  const checkpointAnswered = Number(checkpoint?.questions_answered)
  const checkpointTotal = Number(checkpoint?.questions_total)
  if (Number.isFinite(checkpointAnswered) && Number.isFinite(checkpointTotal) && checkpointTotal > 0) {
    return `${checkpointAnswered}/${checkpointTotal} questions`
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
  const checkpoint = getQuestionFirstCheckpoint(metadata, row)
  const value = Number(getCurrentPhaseDetailValue(metadata, row, 'current_question_index') || checkpoint?.questions_answered)
  return Number.isFinite(value) ? value : null
}

function getRunQuestionTotal(metadata: Record<string, unknown> | null | undefined, row: PipelineRunRow) {
  const checkpoint = getQuestionFirstCheckpoint(metadata, row)
  const value = Number(getCurrentPhaseDetailValue(metadata, row, 'current_question_total') || checkpoint?.questions_total)
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
  const activeStatus = status === 'running' || status === 'retrying' || status === 'reconciling'
  if (!workerRunning && (activeStatus || status === 'claiming' || status === 'queued')) {
    return 'worker_stale'
  }
  if (activeStatus && !hasFreshExecutionHeartbeat(row)) {
    return 'worker_stale'
  }
  if (publicationStatus === 'published_partial' || toText(metadata.quality_state).toLowerCase() === 'partial') {
    return 'partial_persisted'
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

export function resolveRuntimeHealthClass(input: {
  control: PipelineControlState
  worker: PipelineRuntimeWorkerState
  fastmcp: PipelineRuntimeFastMcpState
  rows: PipelineRunRow[]
}) {
  const { control, worker, fastmcp, rows } = input
  const controlState = toText(control.state).toLowerCase()
  const healthClass = toText(control.health_class).toLowerCase()
  const stopReason = toText(control.stop_reason).toLowerCase()
  const workerState = toText(worker.worker_process_state).toLowerCase()

  if (healthClass) return healthClass
  if (controlState) return controlState
  if (stopReason === 'provider_infrastructure_failure') return 'blocked_provider'
  if (stopReason === 'backend_route_missing') return 'blocked_backend'
  if (stopReason === 'manual_stop') return 'blocked_manual'
  if (control.transition_state === 'starting' || control.transition_state === 'stopping') return 'recovering'
  if (workerState === 'crashed' || worker.worker_health === 'degraded' || !fastmcp.reachable) return 'degraded'
  if (rows.some((row) => classifyQueueState(row, workerState === 'running') === 'worker_stale')) return 'degraded'
  return 'healthy'
}

export function buildPipelineRuntimeRunRecord(
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
  const response = await queryPostgres(`
    SELECT
      batch_id,
      entity_id,
      canonical_entity_id,
      entity_name,
      status,
      phase,
      started_at,
      completed_at,
      ${RUNTIME_RECENT_RUN_METADATA_SELECT_SQL} AS metadata
    FROM (
      SELECT
        batch_id,
        entity_id,
        canonical_entity_id,
        entity_name,
        status,
        phase,
        started_at,
        completed_at,
        metadata
      FROM entity_pipeline_runs
      ORDER BY started_at DESC
      LIMIT 50
    ) AS limited_runs
  `)

  return Array.isArray(response.rows) ? (response.rows as PipelineRunRow[]) : []
}

async function loadActiveRuntimeRuns(): Promise<PipelineRunRow[]> {
  // Historical contract coverage expects the active status set equivalent to:
  // .in('status', ['running', 'queued', 'retrying', 'reconciling'])
  const response = await queryPostgres(`
    SELECT
      batch_id,
      entity_id,
      canonical_entity_id,
      entity_name,
      status,
      phase,
      started_at,
      completed_at,
      ${RUNTIME_RUN_METADATA_SELECT_SQL} AS metadata
    FROM (
      SELECT
        batch_id,
        entity_id,
        canonical_entity_id,
        entity_name,
        status,
        phase,
        started_at,
        completed_at,
        metadata
      FROM entity_pipeline_runs
      WHERE status IN ('running', 'queued', 'retrying', 'reconciling')
      ORDER BY
        CASE status
          WHEN 'running' THEN 0
          WHEN 'retrying' THEN 1
          WHEN 'reconciling' THEN 2
          WHEN 'queued' THEN 3
          ELSE 4
        END,
        started_at DESC
      LIMIT 50
    ) AS limited_runs
  `)

  return Array.isArray(response.rows) ? (response.rows as PipelineRunRow[]) : []
}

async function loadRecentRuntimeDossiers(): Promise<PipelineDossierRow[]> {
  const response = await queryPostgres(`
    SELECT
      entity_id,
      canonical_entity_id,
      entity_name,
      entity_type,
      generated_at,
      ${RUNTIME_DOSSIER_DATA_SELECT_SQL} AS dossier_data
    FROM (
      SELECT
        entity_id,
        canonical_entity_id,
        entity_name,
        entity_type,
        generated_at,
        dossier_data
      FROM entity_dossiers
      ORDER BY generated_at DESC NULLS LAST
      LIMIT 50
    ) AS limited_dossiers
  `)

  return Array.isArray(response.rows) ? (response.rows as PipelineDossierRow[]) : []
}

function buildFailureBuckets(records: PipelineRuntimeRunRecord[]) {
  const buckets: Record<PipelineRuntimeRunRecord['queue_state'], number> = {
    queued: 0,
    running: 0,
    completed: 0,
    partial_persisted: 0,
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
          : left.queue_state === 'partial_persisted' ? 1.5
            : left.queue_state === 'reconciling' ? 1
              : 0
  )
  const rightScore = (
    right.queue_state === 'worker_stale' ? 4
      : right.queue_state === 'failed_terminal' ? 3
        : right.queue_state === 'published_degraded' ? 2
          : right.queue_state === 'partial_persisted' ? 1.5
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

function hasFreshWorkerCursor(worker: PipelineRuntimeWorkerState) {
  const activityAt = toText(worker.current_activity_at || worker.updated_at)
  if (!activityAt) return false
  const parsed = Date.parse(activityAt)
  if (!Number.isFinite(parsed)) return false
  return Math.max(0, Math.floor((Date.now() - parsed) / 1000)) <= OPERATIONAL_HEARTBEAT_STALE_SECONDS
}

function projectWorkerCursorOntoRun(
  record: PipelineRuntimeRunRecord,
  worker: PipelineRuntimeWorkerState,
): PipelineRuntimeRunRecord {
  const activityAt = toText(worker.current_activity_at || worker.updated_at) || record.heartbeat_at
  const parsed = activityAt ? Date.parse(activityAt) : Number.NaN
  const heartbeatAgeSeconds = Number.isFinite(parsed)
    ? Math.max(0, Math.floor((Date.now() - parsed) / 1000))
    : record.heartbeat_age_seconds
  return {
    ...record,
    entity_id: toText(worker.current_entity_id) || record.entity_id,
    canonical_entity_id: toText(worker.current_canonical_entity_id) || record.canonical_entity_id,
    entity_name: toText(worker.current_entity_name) || record.entity_name,
    phase: toText(worker.current_phase) || record.phase,
    current_question_id: toText(worker.current_question_id) || record.current_question_id,
    current_question_text: toText(worker.current_question_text) || record.current_question_text,
    current_action: toText(worker.current_action) || record.current_action,
    current_stage: toText(worker.current_phase) || record.current_stage,
    heartbeat_at: activityAt,
    heartbeat_age_seconds: heartbeatAgeSeconds,
    queue_state: 'running',
  }
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

function selectWorkerReferencedRun(
  records: PipelineRuntimeRunRecord[],
  worker: PipelineRuntimeWorkerState,
) {
  const workerState = toText(worker.worker_process_state).toLowerCase()
  if (workerState !== 'running' && workerState !== 'starting') return null

  const workerBatchId = toText(worker.current_batch_id)
  const workerEntityId = toText(worker.current_canonical_entity_id || worker.current_entity_id)
  if (!workerBatchId && !workerEntityId) return null

  const matchingRecord = records.find((record) => {
    if (workerBatchId && toText(record.batch_id) === workerBatchId) return true
    if (workerEntityId && toText(record.canonical_entity_id || record.entity_id) === workerEntityId) return true
    return false
  }) ?? null
  if (!matchingRecord) return null
  if (!hasFreshWorkerCursor(worker)) return isCurrentLiveRun(matchingRecord) ? matchingRecord : null
  const status = toText(matchingRecord.status).toLowerCase()
  if (!['running', 'retrying', 'reconciling', 'claiming'].includes(status)) return null
  return projectWorkerCursorOntoRun(matchingRecord, worker)
}

function rankNoteworthyRun(record: PipelineRuntimeRunRecord) {
  const queueStateScore = (
    record.queue_state === 'worker_stale' ? 7
      : record.queue_state === 'failed_terminal' ? 6
        : record.queue_state === 'published_degraded' ? 5
          : record.queue_state === 'partial_persisted' ? 4.5
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
  const timed = async <T>(label: string, promise: Promise<T>): Promise<T> => {
    const startedAt = Date.now()
    try {
      return await promise
    } finally {
      if (process.env.PIPELINE_RUNTIME_DEBUG_TIMINGS === '1') {
        console.log(`[pipeline-runtime] ${label} ${Date.now() - startedAt}ms`)
      }
    }
  }
  const [control, worker, activeRows, recentRows, dossiers, fastmcp] = await Promise.all([
    timed('control', readPipelineControlState()),
    timed('worker', inspectPipelineWorkerSupervisorState()),
    timed('activeRows', loadActiveRuntimeRuns()),
    timed('recentRows', loadRecentRuntimeRuns()),
    timed('dossiers', loadRecentRuntimeDossiers()),
    timed('fastmcp', probeFastMcpHealth()),
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
  const { snapshot_at, control: rawControl, worker: rawWorker, fastmcp, rows, dossiers } = readSet
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

  const worker = resolveEffectiveWorkerState(rawControl, rawWorker, rows)
  const workerHealthy = worker.worker_process_state === 'running'

  const runtimeRecords = rows.map((row) => {
    const dossierData = dossierLookup.get(toText(row.entity_id).toLowerCase())
      || (row.canonical_entity_id ? dossierLookup.get(toText(row.canonical_entity_id).toLowerCase()) : null)
      || null
    return buildPipelineRuntimeRunRecord(row, workerHealthy, dossierData)
  })
  const workerReferencedRun = selectWorkerReferencedRun(runtimeRecords, worker)
  const currentLiveRun = workerReferencedRun ?? selectCurrentLiveRun(runtimeRecords)
  const control = synchronizeControlStateWithCurrentLiveRun(rawControl, currentLiveRun)
  const latestNoteworthyRun = selectLatestNoteworthyRun(runtimeRecords, currentLiveRun)
  const currentRun = currentLiveRun ?? latestNoteworthyRun
  const recentFailures = runtimeRecords
    .filter((record) => record.queue_state !== 'running' && record.queue_state !== 'queued')
    .sort(sortMostRelevant)
    .slice(0, 8)
  const failureBuckets = buildFailureBuckets(runtimeRecords)
  const queueDepth = runtimeRecords.filter((record) => record.queue_state !== 'failed_terminal').length
  const state = toText(control.state) || resolveRuntimeHealthClass({ control, worker, fastmcp, rows })
  const healthClass = toText(control.health_class) || state

  return {
    snapshot_at,
    generated_at: snapshot_at,
    state,
    health_class: healthClass,
    last_self_heal_action: toText(control.last_self_heal_action) || null,
    last_self_heal_reason: toText(control.last_self_heal_reason) || null,
    last_self_heal_at: toText(control.last_self_heal_at) || null,
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
