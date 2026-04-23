import { NextResponse } from 'next/server'
import { getCanonicalEntitiesSnapshot } from '@/lib/canonical-entities-snapshot'
import { matchesEntityUuid, resolveEntityUuid } from '@/lib/entity-public-id'
import { deriveEntityPipelineLifecycle } from '@/lib/entity-pipeline-lifecycle'
import { resolveOperationalHeartbeatDetails, type OperationalHeartbeatFreshness } from '@/lib/operational-heartbeat'
import { getNormalizedUniverseCount } from '@/lib/normalized-universe-count'
import {
  buildPipelineRuntimeSnapshot,
  loadPipelineRuntimeReadSet,
  type PipelineDossierRow,
  type PipelineRuntimeSnapshot,
} from '@/lib/pipeline-runtime'
import { deriveOperationalFreshnessCheckpoint } from '@/lib/operational-freshness'
import { normalizeTerminalFollowOnMetadata, shouldSurfaceResumeNeeded } from '@/lib/queue-drilldown-normalization'
import { loadQuestionFirstScaleManifest } from '@/lib/question-first-manifest'
import { resolveQuestionTextFromDossierData } from '@/lib/question-text-resolver'

const scaleManifestData = loadQuestionFirstScaleManifest()
const manifestSortKey = Array.isArray(scaleManifestData?.sort_key)
  ? scaleManifestData.sort_key.map((part) => String(part || '').trim()).filter(Boolean)
  : []

export const dynamic = 'force-dynamic'

type ManifestEntity = {
  entity_id: string
  entity_name: string
  entity_type: string
  canonical_entity_id?: string | null
}

type QueueEntityRecord = {
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
  freshness_state?: OperationalHeartbeatFreshness | null
  retry_state?: string | null
  stop_reason?: string | null
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
  last_completed_question?: string | null
  last_completed_question_text?: string | null
  lifecycle_stage?: string | null
  lifecycle_label?: string | null
  lifecycle_summary?: string | null
  movement_state?: string | null
}

type DossierRecord = PipelineDossierRow

type OperationalState = 'starting' | 'running' | 'retrying' | 'skipping' | 'stopping' | 'paused' | 'stopped' | 'waiting'

type LiveOperationalState = 'starting' | 'running' | 'retrying' | 'reconciling' | 'published_degraded' | 'stopping' | 'paused' | 'stopped' | 'waiting'

function dedupeByEntityId<T extends { entity_id: string }>(items: T[]) {
  const seen = new Set<string>()
  const deduped: T[] = []
  for (const item of items) {
    if (!item.entity_id || seen.has(item.entity_id)) continue
    seen.add(item.entity_id)
    deduped.push(item)
  }
  return deduped
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function normalizeType(value: unknown): string {
  return toText(value).toLowerCase()
}

function resolveCanonicalQueueEntity(
  record: {
    entity_id?: unknown
    canonical_entity_id?: unknown
    entity_name?: unknown
    entity_type?: unknown
  },
  canonicalEntities: any[],
) {
  const sourceEntityId = toText(record.entity_id)
  const explicitCanonicalEntityId = toText(record.canonical_entity_id)
  const sourceEntityName = toText(record.entity_name)
  const sourceEntityType = toText(record.entity_type)

  const exactIdCandidates = [explicitCanonicalEntityId, sourceEntityId].filter(Boolean)
  let canonicalMatch = exactIdCandidates
    .map((candidate) => canonicalEntities.find((entity) => matchesEntityUuid(entity, candidate)))
    .find(Boolean)

  if (!canonicalMatch) {
    canonicalMatch = canonicalEntities.find((candidate) => {
      const candidateName = toText(candidate?.properties?.name).toLowerCase()
      const candidateType = normalizeType(candidate?.properties?.type || candidate?.labels?.[0])
      return candidateName === sourceEntityName.toLowerCase() && (!sourceEntityType || candidateType === sourceEntityType.toLowerCase())
    }) || null
  }

  const canonicalEntityId = canonicalMatch
    ? (resolveEntityUuid(canonicalMatch) || toText(canonicalMatch?.id) || sourceEntityId)
    : (explicitCanonicalEntityId || sourceEntityId)
  const canonicalEntityName = canonicalMatch
    ? toText(canonicalMatch?.properties?.name) || sourceEntityName || canonicalEntityId
    : sourceEntityName || canonicalEntityId
  const canonicalEntityType = canonicalMatch
    ? toText(canonicalMatch?.properties?.type || canonicalMatch?.labels?.[0]) || sourceEntityType || 'Entity'
    : sourceEntityType || 'Entity'

  return {
    entity_id: canonicalEntityId,
    canonical_entity_id: canonicalEntityId,
    browser_entity_id: canonicalEntityId,
    source_entity_id: sourceEntityId || null,
    source_entity_name: sourceEntityName || null,
    source_entity_type: sourceEntityType || null,
    entity_name: canonicalEntityName,
    entity_type: canonicalEntityType,
  }
}

function resolveCanonicalQueueEntityObject(record: {
  entity_id?: unknown
  canonical_entity_id?: unknown
  entity_name?: unknown
  entity_type?: unknown
}, canonicalEntities: any[]) {
  const sourceEntityId = toText(record.entity_id)
  const explicitCanonicalEntityId = toText(record.canonical_entity_id)
  const sourceEntityName = toText(record.entity_name).toLowerCase()
  const sourceEntityType = toText(record.entity_type).toLowerCase()

  const exactIdCandidates = [explicitCanonicalEntityId, sourceEntityId].filter(Boolean)
  const idMatch = exactIdCandidates
    .map((candidate) => canonicalEntities.find((entity) => matchesEntityUuid(entity, candidate)))
    .find(Boolean) || null

  if (idMatch) return idMatch

  return canonicalEntities.find((candidate) => {
    const candidateName = toText(candidate?.properties?.name).toLowerCase()
    const candidateType = normalizeType(candidate?.properties?.type || candidate?.labels?.[0])
    return candidateName === sourceEntityName && (!sourceEntityType || candidateType === sourceEntityType)
  }) || null
}

async function buildCanonicalQueueEntity(
  record: {
    entity_id?: unknown
    canonical_entity_id?: unknown
    entity_name?: unknown
    entity_type?: unknown
    started_at?: unknown
    completed_at?: unknown
    metadata?: unknown
    phase?: unknown
    status?: unknown
  },
  canonicalEntities: any[],
) {
  const canonicalEntity = resolveCanonicalQueueEntityObject(record, canonicalEntities)
  const canonical = resolveCanonicalQueueEntity(record, canonicalEntities)
  const runRecord = {
    entity_id: toText(record.entity_id),
    status: toText(record.status),
    phase: toText(record.phase),
    started_at: toText(record.started_at),
    completed_at: toText(record.completed_at),
    metadata: record.metadata && typeof record.metadata === 'object' ? record.metadata as Record<string, unknown> : {},
  }
  const lifecycle = await deriveEntityPipelineLifecycle({
    entityId: canonical.entity_id,
    run: runRecord as any,
    entity: canonicalEntity ? {
      id: canonicalEntity.id,
      uuid: resolveEntityUuid(canonicalEntity) || canonical.entity_id,
      neo4j_id: canonicalEntity.neo4j_id,
      labels: canonicalEntity.labels,
      properties: canonicalEntity.properties,
    } : null,
  })

  const movementState =
    lifecycle.stage === 'running' || lifecycle.stage === 'repairing' || lifecycle.stage === 'reconciling'
      ? 'moving'
      : lifecycle.stage === 'queued'
        ? 'queued'
        : lifecycle.stage === 'client_ready' || lifecycle.stage === 'dossier_persisted' || lifecycle.stage === 'complete_blocked'
          ? 'review'
          : 'blocked'

  return {
    ...canonical,
    lifecycle_stage: lifecycle.stage,
    lifecycle_label: lifecycle.label,
    lifecycle_summary: lifecycle.summary,
    movement_state: movementState,
    last_completed_question: lifecycle.last_completed_question || null,
  }
}

function inferQualityState(dossierData: unknown): string | null {
  if (!dossierData || typeof dossierData !== 'object') return null
  const payload = dossierData as Record<string, unknown>
  const merged = payload.merged_dossier && typeof payload.merged_dossier === 'object'
    ? payload.merged_dossier as Record<string, unknown>
    : null
  return toText(
    payload.quality_state
    ?? payload.qualityState
    ?? merged?.quality_state
    ?? merged?.qualityState,
  ).toLowerCase() || null
}

function inferQualitySummary(dossierData: unknown): string | null {
  if (!dossierData || typeof dossierData !== 'object') return null
  const payload = dossierData as Record<string, unknown>
  const merged = payload.merged_dossier && typeof payload.merged_dossier === 'object'
    ? payload.merged_dossier as Record<string, unknown>
    : null
  return toText(
    payload.quality_summary
    ?? payload.qualitySummary
    ?? payload.summary
    ?? merged?.quality_summary
    ?? merged?.qualitySummary
    ?? merged?.summary,
  ) || null
}

function toQueueRecord(row: Record<string, unknown>): QueueEntityRecord {
  const metadata = row.metadata && typeof row.metadata === 'object'
    ? row.metadata as Record<string, unknown>
    : {}
  const heartbeat = resolveOperationalHeartbeatDetails({
    heartbeat_at: metadata.heartbeat_at || row.heartbeat_at,
    started_at: row.started_at,
    generated_at: row.completed_at ?? row.started_at,
  })

  return {
    batch_id: toText(row.batch_id ?? row.id) || null,
    status: toText(row.status) || null,
    entity_id: toText(row.entity_id),
    entity_name: toText(row.entity_name) || 'Unknown entity',
    entity_type: toText(metadata.entity_type) || 'entity',
    summary: toText(metadata.summary)
      || toText(metadata.current_question_text)
      || toText(metadata.current_execution_state)
      || toText(metadata.current_substep_label)
      || toText(metadata.quality_summary)
      || (toText(metadata.active_question_id) ? `Running ${toText(metadata.active_question_id)}` : null),
    generated_at: toText(row.completed_at ?? row.started_at) || null,
    started_at: toText(row.started_at) || null,
    heartbeat_at: heartbeat.heartbeat_at,
    heartbeat_age_seconds: heartbeat.heartbeat_age_seconds,
    heartbeat_source: heartbeat.heartbeat_source,
    freshness_state: heartbeat.freshness_state,
    retry_state: toText(metadata.retry_state) || null,
    stop_reason: toText(metadata.stop_reason) || null,
    stop_details: metadata.stop_details && typeof metadata.stop_details === 'object'
      ? metadata.stop_details as Record<string, unknown>
      : null,
    active_question_id: toText(
      metadata.active_question_id
      || metadata.current_question_id
      || metadata.next_repair_question_id
      || metadata.last_completed_question
    ) || null,
    current_question_id: toText(
      metadata.current_question_id
      || metadata.active_question_id
      || metadata.next_repair_question_id
      || metadata.last_completed_question
    ) || null,
    current_section_id: toText(metadata.current_section_id) || null,
    current_section_label: toText(metadata.current_section_label) || null,
    current_section_index: Number.isFinite(Number(metadata.current_section_index)) ? Number(metadata.current_section_index) : null,
    current_section_total: Number.isFinite(Number(metadata.current_section_total)) ? Number(metadata.current_section_total) : null,
    current_question_index: Number.isFinite(Number(metadata.current_question_index)) ? Number(metadata.current_question_index) : null,
    current_question_total: Number.isFinite(Number(metadata.current_question_total)) ? Number(metadata.current_question_total) : null,
    current_strategy_label: toText(metadata.current_strategy_label) || null,
    current_execution_state: toText(metadata.current_execution_state) || null,
    current_source_order: Array.isArray(metadata.current_source_order)
      ? metadata.current_source_order.map((item) => toText(item)).filter(Boolean)
      : null,
    execution_backend: toText(metadata.execution_backend || metadata.question_first_backend) || null,
    execution_model: toText(metadata.execution_model || metadata.opencode_model) || null,
    execution_provider: toText(metadata.execution_provider || metadata.opencode_provider) || null,
    brightdata_transport: toText(metadata.brightdata_transport) || null,
    current_substep: toText(metadata.current_substep) || null,
    current_substep_label: toText(metadata.current_substep_label) || null,
    current_substep_progress: toText(metadata.current_substep_progress) || null,
    current_action: toText(metadata.current_execution_state) || toText(metadata.current_action) || toText(metadata.next_action) || toText(metadata.run_phase) || null,
    run_phase: toText(row.phase ?? metadata.run_phase ?? row.status) || null,
    current_stage: toText(metadata.current_stage || metadata.run_phase || row.phase || row.status) || null,
    publication_status: toText(metadata.publication_status) || null,
    next_repair_question_id: toText(metadata.next_repair_question_id) || null,
    next_repair_status: toText(metadata.next_repair_status) || null,
    next_repair_batch_id: toText(metadata.next_repair_batch_id) || null,
    last_completed_question: toText(metadata.last_completed_question) || null,
    next_action: toText(metadata.next_action) || null,
  }
}

function extractQuestionFirstState(dossierData: unknown): Record<string, unknown> {
  if (!dossierData || typeof dossierData !== 'object') return {}
  const payload = dossierData as Record<string, unknown>
  const questionFirst = payload.question_first && typeof payload.question_first === 'object'
    ? payload.question_first as Record<string, unknown>
    : {}
  const metadataQuestionFirst = payload.metadata && typeof payload.metadata === 'object'
    && (payload.metadata as Record<string, unknown>).question_first
    && typeof (payload.metadata as Record<string, unknown>).question_first === 'object'
      ? (payload.metadata as Record<string, unknown>).question_first as Record<string, unknown>
      : {}

  return {
    ...metadataQuestionFirst,
    ...questionFirst,
  }
}

function buildDossierLookup(rows: DossierRecord[]) {
  const lookup = new Map<string, DossierRecord>()
  for (const row of rows) {
    const keys = [row.entity_id, row.canonical_entity_id, row.entity_name]
      .map((value) => toText(value).toLowerCase())
      .filter(Boolean)
    for (const key of keys) {
      if (!lookup.has(key)) {
        lookup.set(key, row)
      }
    }
  }
  return lookup
}

function findDossierForRow(row: { entity_id?: unknown; canonical_entity_id?: unknown; entity_name?: unknown }, dossierLookup: Map<string, DossierRecord>) {
  const keys = [row.entity_id, row.canonical_entity_id, row.entity_name]
    .map((value) => toText(value).toLowerCase())
    .filter(Boolean)
  for (const key of keys) {
    const match = dossierLookup.get(key)
    if (match) return match
  }
  return null
}

function enrichQuestionTextFields<T extends QueueEntityRecord>(
  item: T,
  dossierData: unknown,
): T {
  const currentQuestionId = toText(
    item.current_question_id
    || item.active_question_id
    || item.next_repair_question_id
    || item.last_completed_question,
  ) || null
  const currentQuestionText = resolveQuestionTextFromDossierData(dossierData, currentQuestionId)
    || toText(extractQuestionFirstState(dossierData).current_question_text)
    || toText(extractQuestionFirstState(dossierData).active_question_text)
    || null
  const nextRepairQuestionText = resolveQuestionTextFromDossierData(dossierData, item.next_repair_question_id)
    || toText(extractQuestionFirstState(dossierData).next_repair_question_text)
    || null
  const lastCompletedQuestionText = resolveQuestionTextFromDossierData(dossierData, item.last_completed_question)
    || toText(extractQuestionFirstState(dossierData).last_completed_question_text)
    || null

  return {
    ...item,
    current_question_id: currentQuestionId,
    current_question_text: currentQuestionText,
    active_question_id: item.active_question_id || currentQuestionId,
    current_section_id: item.current_section_id || toText(extractQuestionFirstState(dossierData).current_section_id) || null,
    current_section_label: item.current_section_label || toText(extractQuestionFirstState(dossierData).current_section_label) || null,
    current_section_index: item.current_section_index ?? (Number.isFinite(Number(extractQuestionFirstState(dossierData).current_section_index)) ? Number(extractQuestionFirstState(dossierData).current_section_index) : null),
    current_section_total: item.current_section_total ?? (Number.isFinite(Number(extractQuestionFirstState(dossierData).current_section_total)) ? Number(extractQuestionFirstState(dossierData).current_section_total) : null),
    current_question_index: item.current_question_index ?? (Number.isFinite(Number(extractQuestionFirstState(dossierData).current_question_index)) ? Number(extractQuestionFirstState(dossierData).current_question_index) : null),
    current_question_total: item.current_question_total ?? (Number.isFinite(Number(extractQuestionFirstState(dossierData).current_question_total)) ? Number(extractQuestionFirstState(dossierData).current_question_total) : null),
    current_strategy_label: item.current_strategy_label || toText(extractQuestionFirstState(dossierData).current_strategy_label) || null,
    current_execution_state: item.current_execution_state || toText(extractQuestionFirstState(dossierData).current_execution_state) || null,
    current_source_order: item.current_source_order || (Array.isArray(extractQuestionFirstState(dossierData).current_source_order)
      ? (extractQuestionFirstState(dossierData).current_source_order as unknown[]).map((entry) => toText(entry)).filter(Boolean)
      : null),
    execution_backend: item.execution_backend || toText(extractQuestionFirstState(dossierData).execution_backend) || null,
    execution_model: item.execution_model || toText(extractQuestionFirstState(dossierData).execution_model) || null,
    execution_provider: item.execution_provider || toText(extractQuestionFirstState(dossierData).execution_provider) || null,
    brightdata_transport: item.brightdata_transport || toText(extractQuestionFirstState(dossierData).brightdata_transport) || null,
    current_substep_label: item.current_substep_label || null,
    current_substep_progress: item.current_substep_progress || null,
    next_repair_question_text: nextRepairQuestionText,
    last_completed_question_text: lastCompletedQuestionText,
    current_action: item.current_action || currentQuestionText || (currentQuestionId ? `Question ${currentQuestionId}` : null),
    next_action: item.next_action
      || (nextRepairQuestionText
        ? `Repair question: ${nextRepairQuestionText}`
        : item.next_repair_question_id
          ? `Repair question ${item.next_repair_question_id}`
          : null),
    summary: item.summary
      || currentQuestionText
      || nextRepairQuestionText
      || lastCompletedQuestionText
      || item.current_execution_state
      || null,
  }
}

function buildQueueEntityFromRuntimeRun(
  runtimeRun: NonNullable<PipelineRuntimeSnapshot['current_live_run'] | PipelineRuntimeSnapshot['latest_noteworthy_run']>,
): QueueEntityRecord {
  return {
    batch_id: runtimeRun.batch_id,
    status: runtimeRun.status,
    entity_id: runtimeRun.canonical_entity_id || runtimeRun.entity_id,
    entity_name: runtimeRun.entity_name,
    entity_type: 'Entity',
    summary: runtimeRun.current_question_text || runtimeRun.current_substep_label || runtimeRun.current_action || runtimeRun.phase || null,
    generated_at: runtimeRun.heartbeat_at || null,
    started_at: runtimeRun.heartbeat_at || null,
    heartbeat_at: runtimeRun.heartbeat_at || null,
    heartbeat_age_seconds: runtimeRun.heartbeat_age_seconds || null,
    heartbeat_source: 'pipeline_runtime',
    freshness_state: runtimeRun.queue_state === 'worker_stale' ? 'stale' : 'fresh',
    retry_state: runtimeRun.retry_state || null,
    stop_reason: runtimeRun.stop_reason || null,
    stop_details: runtimeRun.error_message ? { error_message: runtimeRun.error_message } : null,
    active_question_id: runtimeRun.current_question_id || null,
    current_question_id: runtimeRun.current_question_id || null,
    current_question_text: runtimeRun.current_question_text || null,
    current_section_id: runtimeRun.current_section_id || null,
    current_section_label: runtimeRun.current_section_label || null,
    current_section_index: runtimeRun.current_section_index ?? null,
    current_section_total: runtimeRun.current_section_total ?? null,
    current_question_index: runtimeRun.current_question_index ?? null,
    current_question_total: runtimeRun.current_question_total ?? null,
    current_strategy_label: runtimeRun.current_strategy_label || null,
    current_execution_state: runtimeRun.current_execution_state || null,
    current_source_order: runtimeRun.current_source_order || null,
    execution_backend: runtimeRun.execution_backend || null,
    execution_model: runtimeRun.execution_model || null,
    execution_provider: runtimeRun.execution_provider || null,
    brightdata_transport: runtimeRun.brightdata_transport || null,
    current_substep: runtimeRun.current_substep || null,
    current_substep_label: runtimeRun.current_substep_label || null,
    current_substep_progress: runtimeRun.current_substep_progress || null,
    current_action: runtimeRun.current_action || runtimeRun.phase || null,
    run_phase: runtimeRun.phase || null,
    current_stage: runtimeRun.current_stage || runtimeRun.phase || null,
    publication_status: runtimeRun.publication_status || null,
    next_repair_question_id: null,
    next_repair_question_text: null,
    next_repair_status: null,
    next_repair_batch_id: null,
    last_completed_question: null,
    last_completed_question_text: null,
    next_action: runtimeRun.current_action || runtimeRun.phase || null,
  }
}

function buildBacklogHealth(runtime: PipelineRuntimeSnapshot, staleActiveRows: QueueEntityRecord[]) {
  const failureBuckets = runtime.failure_buckets
  return {
    stale_active_count: staleActiveRows.length,
    worker_stale_count: failureBuckets.worker_stale ?? 0,
    retrying_count: failureBuckets.retrying ?? 0,
    reconciling_count: failureBuckets.reconciling ?? 0,
    published_degraded_count: failureBuckets.published_degraded ?? 0,
    failed_terminal_count: failureBuckets.failed_terminal ?? 0,
    healthy: staleActiveRows.length === 0
      && (failureBuckets.worker_stale ?? 0) === 0
      && (failureBuckets.retrying ?? 0) === 0
      && (failureBuckets.reconciling ?? 0) === 0
      && (failureBuckets.published_degraded ?? 0) === 0
      && (failureBuckets.failed_terminal ?? 0) === 0,
  }
}

function deriveLiveState(
  runtime: PipelineRuntimeSnapshot,
  control: PipelineRuntimeSnapshot['control'],
): LiveOperationalState {
  const workerState = runtime.worker.worker_process_state
  const queueState = runtime.current_live_run?.queue_state

  if (control?.observed_state === 'starting' || control?.transition_state === 'starting' || workerState === 'starting') {
    return 'starting'
  }
  if (control?.observed_state === 'stopping' || control?.transition_state === 'stopping' || workerState === 'stopping') {
    return 'stopping'
  }
  if (control?.requested_state === 'paused' || control?.is_paused === true || control?.observed_state === 'paused') {
    return 'paused'
  }
  if (workerState !== 'running') {
    return 'stopped'
  }
  if (queueState === 'retrying') return 'retrying'
  if (queueState === 'reconciling') return 'reconciling'
  if (queueState === 'published_degraded') return 'published_degraded'
  if (queueState === 'running') return 'running'
  return 'waiting'
}

export async function GET() {
  const manifestPayload = (scaleManifestData || null) as Record<string, unknown> | null
  const manifestEntities = Array.isArray(manifestPayload?.entities)
    ? manifestPayload.entities as ManifestEntity[]
    : []
  const canonicalEntities = await getCanonicalEntitiesSnapshot()
  const normalizedUniverseCount = await getNormalizedUniverseCount()
  const universeCount = normalizedUniverseCount ?? manifestEntities.length

  const runtimeReadSet = await loadPipelineRuntimeReadSet()
  const runtimeSnapshot = buildPipelineRuntimeSnapshot(runtimeReadSet)
  const control = runtimeSnapshot.control
  const activeRuns = runtimeReadSet.rows
    .filter((row) => ['queued', 'claiming', 'running', 'retrying'].includes(toText(row.status).toLowerCase()))
    .slice(0, 8) as Record<string, unknown>[]
  const completedRuns = runtimeReadSet.rows
    .filter((row) => toText(row.status).toLowerCase() === 'completed')
    .slice(0, 8) as Record<string, unknown>[]
  const dossierRows = runtimeReadSet.dossiers as DossierRecord[]
  const dossierLookup = buildDossierLookup(dossierRows)
  const workerProcessState = runtimeSnapshot.worker.worker_process_state
  const workerRunning = workerProcessState === 'running'
  const workerStarting = workerProcessState === 'starting'
  const workerStopping = workerProcessState === 'stopping'
  const workerStopped = workerProcessState === 'stopped' || workerProcessState === 'crashed'
  const activeBatchIds = new Set(
    activeRuns
      .map((row) => toText(row.batch_id ?? row.id))
      .filter(Boolean),
  )

  const activeEntities = await Promise.all(activeRuns.map(async (row, index) => {
    const queueRecord = toQueueRecord(row)
    const canonicalRecord = await buildCanonicalQueueEntity(row, canonicalEntities)
    const dossierRow = findDossierForRow(row, dossierLookup)
    return {
      ...queueRecord,
      ...canonicalRecord,
      ...enrichQuestionTextFields(queueRecord, dossierRow?.dossier_data ?? null),
      queue_position: index + 1,
    }
  }))
  const runningEntities = activeEntities.filter((item) => item.freshness_state !== 'stale')
  const staleActiveRows = activeEntities.filter((item) => item.freshness_state === 'stale')
  const retryingEntity = runningEntities.find((item) => toText(item.retry_state).toLowerCase() === 'retrying') || null
  const skippingEntity = activeEntities.find((item) => toText(item.retry_state).toLowerCase() === 'skipping') || null
  const inProgressEntity = workerRunning && runningEntities.length > 0 ? runningEntities[0] : null
  const visibleStaleActiveRows = workerRunning
    ? staleActiveRows
    : activeEntities.length > 0
      ? activeEntities
      : staleActiveRows
  const completedEntities = dedupeByEntityId(await Promise.all(completedRuns.map(async (row) => {
    const queueRecord = normalizeTerminalFollowOnMetadata(toQueueRecord(row), activeBatchIds)
    const dossierRow = findDossierForRow(row, dossierLookup)
    return {
      ...queueRecord,
      ...(await buildCanonicalQueueEntity(row, canonicalEntities)),
      ...enrichQuestionTextFields(queueRecord, dossierRow?.dossier_data ?? null),
    }
  })))
  const resumeNeededEntities = dedupeByEntityId(
    completedEntities
      .filter((item) => shouldSurfaceResumeNeeded(item, activeBatchIds))
      .map((item) => ({
        ...item,
        summary: item.summary || 'Resume required.',
        current_stage: item.current_stage || 'resume_needed',
        run_phase: item.run_phase || 'resume_needed',
      })),
  ).slice(0, 8)

  const seenEntityIds = new Set(
    [
      ...runningEntities.map((item) => item.entity_id),
      ...staleActiveRows.map((item) => item.entity_id),
      ...completedEntities.map((item) => item.entity_id),
      ...resumeNeededEntities.map((item) => item.entity_id),
    ].filter(Boolean) as string[],
  )
  const canonicalManifestEntities = manifestEntities.map((entity) => ({
    ...resolveCanonicalQueueEntity(entity, canonicalEntities),
    source_entity_id: entity.entity_id,
    source_entity_name: entity.entity_name,
    source_entity_type: entity.entity_type,
  }))
  const upcomingEntities = canonicalManifestEntities
    .filter((entity) => !seenEntityIds.has(entity.entity_id))
    .slice(0, 8)
    .map((entity, index) => ({
      ...entity,
      summary: 'Waiting in the serialized live loop.',
      generated_at: null,
      started_at: null,
      heartbeat_at: null,
      queue_position: index + 1,
      current_question_id: null,
      current_question_text: null,
      current_action: null,
      current_stage: 'queued',
      next_action: 'Queue this entity',
      last_completed_question: null,
      last_completed_question_text: null,
      batch_id: null,
      stop_reason: null,
      stop_details: null,
      next_repair_question_text: null,
      run_phase: 'queued',
    }))

  const blockedEntities = await Promise.all(dossierRows
    .filter((row) => inferQualityState(row.dossier_data) === 'blocked')
    .map(async (row) => ({
      ...enrichQuestionTextFields(toQueueRecord({
        entity_id: row.entity_id,
        canonical_entity_id: row.canonical_entity_id,
        entity_name: row.entity_name,
        entity_type: row.entity_type,
      }), row.dossier_data),
      ...(await buildCanonicalQueueEntity({
        entity_id: row.entity_id,
        canonical_entity_id: row.canonical_entity_id,
        entity_name: row.entity_name,
        entity_type: row.entity_type,
        generated_at: row.generated_at,
        metadata: {},
      }, canonicalEntities)),
      quality_state: 'blocked',
      quality_summary: inferQualitySummary(row.dossier_data) || 'Blocked dossier.',
      generated_at: row.generated_at,
      current_question_id: toText(extractQuestionFirstState(row.dossier_data).active_question_id || extractQuestionFirstState(row.dossier_data).question_id) || null,
      current_question_text: resolveQuestionTextFromDossierData(
        row.dossier_data,
        toText(extractQuestionFirstState(row.dossier_data).active_question_id || extractQuestionFirstState(row.dossier_data).question_id) || null,
      ),
      current_action: toText(extractQuestionFirstState(row.dossier_data).next_action)
        || toText(extractQuestionFirstState(row.dossier_data).current_action)
        || (resolveQuestionTextFromDossierData(
          row.dossier_data,
          toText(extractQuestionFirstState(row.dossier_data).active_question_id || extractQuestionFirstState(row.dossier_data).question_id) || null,
        ) || null)
        || (toText(extractQuestionFirstState(row.dossier_data).active_question_id || extractQuestionFirstState(row.dossier_data).question_id)
          ? `Question ${toText(extractQuestionFirstState(row.dossier_data).active_question_id || extractQuestionFirstState(row.dossier_data).question_id)}`
          : toText(row.phase) || null),
      last_completed_question: toText(extractQuestionFirstState(row.dossier_data).last_completed_question) || null,
      last_completed_question_text: resolveQuestionTextFromDossierData(
        row.dossier_data,
        toText(extractQuestionFirstState(row.dossier_data).last_completed_question) || null,
      ),
      next_repair_question_id: toText(extractQuestionFirstState(row.dossier_data).next_repair_question_id) || null,
      next_repair_question_text: resolveQuestionTextFromDossierData(
        row.dossier_data,
        toText(extractQuestionFirstState(row.dossier_data).next_repair_question_id) || null,
      ),
      next_action: toText(extractQuestionFirstState(row.dossier_data).next_repair_question_id)
        ? `Repair question ${resolveQuestionTextFromDossierData(
            row.dossier_data,
            toText(extractQuestionFirstState(row.dossier_data).next_repair_question_id) || null,
          ) || toText(extractQuestionFirstState(row.dossier_data).next_repair_question_id)}`
        : 'Rerun dossier',
    }))
  )
  const dedupedBlockedEntities = dedupeByEntityId(blockedEntities)
    .slice(0, 8)
  const backlogHealth = buildBacklogHealth(runtimeSnapshot, staleActiveRows)
  const liveState = deriveLiveState(runtimeSnapshot, control)
  const runtimeCurrentLiveRun = runtimeSnapshot.current_live_run
  const runtimeLatestNoteworthyRun = runtimeSnapshot.latest_noteworthy_run
  const liveEntityFromActiveRuns = runtimeCurrentLiveRun
    ? activeEntities.find((item) => (
      (runtimeCurrentLiveRun.batch_id && toText(item.batch_id) === toText(runtimeCurrentLiveRun.batch_id))
      || toText(item.entity_id) === toText(runtimeCurrentLiveRun.canonical_entity_id || runtimeCurrentLiveRun.entity_id)
    )) || null
    : null
  const liveInProgressEntity = runtimeCurrentLiveRun
      ? {
        ...(liveEntityFromActiveRuns || buildQueueEntityFromRuntimeRun(runtimeCurrentLiveRun)),
        current_section_id: runtimeCurrentLiveRun.current_section_id || liveEntityFromActiveRuns?.current_section_id || null,
        current_section_label: runtimeCurrentLiveRun.current_section_label || liveEntityFromActiveRuns?.current_section_label || null,
        current_section_index: runtimeCurrentLiveRun.current_section_index ?? liveEntityFromActiveRuns?.current_section_index ?? null,
        current_section_total: runtimeCurrentLiveRun.current_section_total ?? liveEntityFromActiveRuns?.current_section_total ?? null,
        current_question_index: runtimeCurrentLiveRun.current_question_index ?? liveEntityFromActiveRuns?.current_question_index ?? null,
        current_question_total: runtimeCurrentLiveRun.current_question_total ?? liveEntityFromActiveRuns?.current_question_total ?? null,
        current_strategy_label: runtimeCurrentLiveRun.current_strategy_label || liveEntityFromActiveRuns?.current_strategy_label || null,
        current_execution_state: runtimeCurrentLiveRun.current_execution_state || liveEntityFromActiveRuns?.current_execution_state || null,
        current_source_order: runtimeCurrentLiveRun.current_source_order || liveEntityFromActiveRuns?.current_source_order || null,
        execution_backend: runtimeCurrentLiveRun.execution_backend || liveEntityFromActiveRuns?.execution_backend || null,
        execution_model: runtimeCurrentLiveRun.execution_model || liveEntityFromActiveRuns?.execution_model || null,
        execution_provider: runtimeCurrentLiveRun.execution_provider || liveEntityFromActiveRuns?.execution_provider || null,
        brightdata_transport: runtimeCurrentLiveRun.brightdata_transport || liveEntityFromActiveRuns?.brightdata_transport || null,
        current_substep: runtimeCurrentLiveRun.current_substep || liveEntityFromActiveRuns?.current_substep || null,
        current_substep_label: runtimeCurrentLiveRun.current_substep_label || liveEntityFromActiveRuns?.current_substep_label || null,
        current_substep_progress: runtimeCurrentLiveRun.current_substep_progress || liveEntityFromActiveRuns?.current_substep_progress || null,
        current_action: runtimeCurrentLiveRun.current_execution_state || runtimeCurrentLiveRun.current_substep_label || runtimeCurrentLiveRun.current_action || liveEntityFromActiveRuns?.current_action || null,
        freshness_state: 'fresh' as const,
      }
    : null
  const controlRecord = (control && typeof control === 'object') ? control as Record<string, unknown> : null
  const controlStopReason = toText(controlRecord?.stop_reason)
  const controlStopDetails = controlRecord?.stop_details && typeof controlRecord.stop_details === 'object'
    ? controlRecord.stop_details as Record<string, unknown>
    : null
  const hasFreshRunningEntities = Boolean(runtimeCurrentLiveRun)
  const hasStaleOnlyActiveRows = visibleStaleActiveRows.length > 0 && !hasFreshRunningEntities
  const requestedPaused = control?.requested_state === 'paused' || control?.is_paused === true
  const observedStarting = control?.observed_state === 'starting' || control?.transition_state === 'starting' || workerStarting
  const observedStopping = control?.observed_state === 'stopping' || control?.transition_state === 'stopping' || workerStopping
  const observedPaused = control?.observed_state === 'paused'
  const stopReason = hasFreshRunningEntities
    ? null
    : controlStopReason || ((workerStopped || workerProcessState === 'crashed') && hasStaleOnlyActiveRows && !observedStarting && !observedStopping ? 'worker_heartbeat_stale' : null)
  const operationalState: OperationalState = observedStarting
    ? 'starting'
    : observedStopping
      ? 'stopping'
      : requestedPaused || observedPaused
      ? 'paused'
      : skippingEntity
          ? 'skipping'
          : liveState === 'retrying' || retryingEntity
            ? 'retrying'
            : liveState === 'running' || liveState === 'reconciling' || hasFreshRunningEntities
              ? 'running'
                : workerStopped
                  ? 'stopped'
                  : hasStaleOnlyActiveRows
                  ? 'stopped'
                  : 'waiting'
  const stopDetails = controlStopDetails || (
    hasStaleOnlyActiveRows && operationalState === 'stopped'
      ? {
          reason: 'worker_heartbeat_stale',
          entity_id: visibleStaleActiveRows[0]?.entity_id ?? null,
          entity_name: visibleStaleActiveRows[0]?.entity_name ?? null,
          question_id: visibleStaleActiveRows[0]?.active_question_id ?? null,
          current_action: visibleStaleActiveRows[0]?.current_action ?? visibleStaleActiveRows[0]?.run_phase ?? null,
          phase: visibleStaleActiveRows[0]?.run_phase ?? null,
          batch_id: visibleStaleActiveRows[0]?.batch_id ?? null,
        }
      : null
  )
  const visibleRunningEntities = liveInProgressEntity
    ? [liveInProgressEntity]
    : hasFreshRunningEntities
      ? runningEntities
      : []
  const visibleRetryingEntity = hasFreshRunningEntities ? retryingEntity : null
  const visibleInProgressEntity = liveInProgressEntity || (hasFreshRunningEntities ? inProgressEntity : null)
  const latestNoteworthyEntityFromCompleted = runtimeLatestNoteworthyRun
    ? completedEntities.find((item) => (
      (runtimeLatestNoteworthyRun.batch_id && toText(item.batch_id) === toText(runtimeLatestNoteworthyRun.batch_id))
      || toText(item.entity_id) === toText(runtimeLatestNoteworthyRun.canonical_entity_id || runtimeLatestNoteworthyRun.entity_id)
    )) || visibleStaleActiveRows.find((item) => (
      (runtimeLatestNoteworthyRun.batch_id && toText(item.batch_id) === toText(runtimeLatestNoteworthyRun.batch_id))
      || toText(item.entity_id) === toText(runtimeLatestNoteworthyRun.canonical_entity_id || runtimeLatestNoteworthyRun.entity_id)
    )) || null
    : null
  const latestNoteworthyEntity = runtimeLatestNoteworthyRun
    ? {
      ...(latestNoteworthyEntityFromCompleted || buildQueueEntityFromRuntimeRun(runtimeLatestNoteworthyRun)),
      current_section_id: runtimeLatestNoteworthyRun.current_section_id || latestNoteworthyEntityFromCompleted?.current_section_id || null,
      current_section_label: runtimeLatestNoteworthyRun.current_section_label || latestNoteworthyEntityFromCompleted?.current_section_label || null,
      current_section_index: runtimeLatestNoteworthyRun.current_section_index ?? latestNoteworthyEntityFromCompleted?.current_section_index ?? null,
      current_section_total: runtimeLatestNoteworthyRun.current_section_total ?? latestNoteworthyEntityFromCompleted?.current_section_total ?? null,
      current_question_index: runtimeLatestNoteworthyRun.current_question_index ?? latestNoteworthyEntityFromCompleted?.current_question_index ?? null,
      current_question_total: runtimeLatestNoteworthyRun.current_question_total ?? latestNoteworthyEntityFromCompleted?.current_question_total ?? null,
      current_strategy_label: runtimeLatestNoteworthyRun.current_strategy_label || latestNoteworthyEntityFromCompleted?.current_strategy_label || null,
      current_execution_state: runtimeLatestNoteworthyRun.current_execution_state || latestNoteworthyEntityFromCompleted?.current_execution_state || null,
      current_source_order: runtimeLatestNoteworthyRun.current_source_order || latestNoteworthyEntityFromCompleted?.current_source_order || null,
      execution_backend: runtimeLatestNoteworthyRun.execution_backend || latestNoteworthyEntityFromCompleted?.execution_backend || null,
      execution_model: runtimeLatestNoteworthyRun.execution_model || latestNoteworthyEntityFromCompleted?.execution_model || null,
      execution_provider: runtimeLatestNoteworthyRun.execution_provider || latestNoteworthyEntityFromCompleted?.execution_provider || null,
      brightdata_transport: runtimeLatestNoteworthyRun.brightdata_transport || latestNoteworthyEntityFromCompleted?.brightdata_transport || null,
      current_substep: runtimeLatestNoteworthyRun.current_substep || latestNoteworthyEntityFromCompleted?.current_substep || null,
      current_substep_label: runtimeLatestNoteworthyRun.current_substep_label || latestNoteworthyEntityFromCompleted?.current_substep_label || null,
      current_substep_progress: runtimeLatestNoteworthyRun.current_substep_progress || latestNoteworthyEntityFromCompleted?.current_substep_progress || null,
      current_action: runtimeLatestNoteworthyRun.current_execution_state || runtimeLatestNoteworthyRun.current_substep_label || runtimeLatestNoteworthyRun.current_action || latestNoteworthyEntityFromCompleted?.current_action || null,
      freshness_state: runtimeLatestNoteworthyRun.queue_state === 'worker_stale' ? 'stale' as const : 'fresh' as const,
    }
    : null
  const freshnessThresholdSeconds = 5 * 60
  const freshnessCheckpoint = deriveOperationalFreshnessCheckpoint({
    snapshotAt: runtimeSnapshot.snapshot_at,
    freshnessThresholdSeconds,
    currentRun: visibleInProgressEntity,
    runningEntities: visibleRunningEntities,
    staleActiveRows: latestNoteworthyEntity ? [latestNoteworthyEntity, ...visibleStaleActiveRows] : visibleStaleActiveRows,
    completedEntities,
  })

  return NextResponse.json({
    snapshot_at: runtimeSnapshot.snapshot_at,
    last_activity_at: freshnessCheckpoint.last_activity_at,
    freshness_state: freshnessCheckpoint.freshness_state,
    control,
    runtime: {
      snapshot_at: runtimeSnapshot.snapshot_at,
      generated_at: runtimeSnapshot.generated_at,
      worker: runtimeSnapshot.worker,
      fastmcp: runtimeSnapshot.fastmcp,
      queue_depth: runtimeSnapshot.queue_depth,
      current_run: runtimeSnapshot.current_run,
      current_live_run: runtimeSnapshot.current_live_run,
      latest_noteworthy_run: runtimeSnapshot.latest_noteworthy_run,
      recent_failures: runtimeSnapshot.recent_failures,
      failure_buckets: runtimeSnapshot.failure_buckets,
    },
    live_state: {
      operational_state: liveState,
      worker_process_state: runtimeSnapshot.worker.worker_process_state,
      current_run: runtimeSnapshot.current_live_run,
      current_live_run: runtimeSnapshot.current_live_run,
      in_progress_entity: visibleInProgressEntity,
      running_entities: visibleRunningEntities,
    },
    backlog_health: backlogHealth,
    operational_state: operationalState,
    stop_reason: stopReason,
    stop_details: stopDetails,
    freshness_threshold_seconds: freshnessThresholdSeconds,
    playlist_sort_key: manifestSortKey.length > 0
      ? manifestSortKey
      : ['priority_score DESC', 'entity_type ASC', 'entity_name ASC', 'entity_id ASC'],
    loop_status: {
      universe_count: universeCount,
      total_scheduled: manifestEntities.length,
      completed: completedEntities.length,
      failed: 0,
      retryable_failures: 0,
      quality_counts: {
        partial: 0,
        blocked: dedupedBlockedEntities.length,
        complete: 0,
        client_ready: 0,
      },
      runtime_counts: {
        running: visibleRunningEntities.length,
        stalled: visibleStaleActiveRows.length,
        retryable: visibleRetryingEntity ? 1 : 0,
        resume_needed: resumeNeededEntities.length,
      },
    },
    queue: {
      in_progress_entity: visibleInProgressEntity,
      running_entities: visibleRunningEntities,
      stale_active_rows: visibleStaleActiveRows,
      latest_noteworthy_entity: latestNoteworthyEntity,
      completed_entities: completedEntities,
      resume_needed_entities: resumeNeededEntities,
      upcoming_entities: upcomingEntities,
    },
    dossier_quality: {
      incomplete_entities: dedupedBlockedEntities,
    },
  })
}
