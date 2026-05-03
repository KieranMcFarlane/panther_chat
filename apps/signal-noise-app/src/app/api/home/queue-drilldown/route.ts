import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NextResponse } from 'next/server'
import { getCanonicalEntitiesSnapshot } from '@/lib/canonical-entities-snapshot'
import { matchesEntityUuid, resolveEntityUuid } from '@/lib/entity-public-id'
import { deriveEntityPipelineLifecycle } from '@/lib/entity-pipeline-lifecycle'
import { resolveOperationalHeartbeatDetails, type OperationalHeartbeatFreshness } from '@/lib/operational-heartbeat'
import { getNormalizedUniverseCount } from '@/lib/normalized-universe-count'
import { query as queryPostgres } from '@/lib/pg-client'
import {
  buildPipelineRuntimeRunRecord,
  buildPipelineRuntimeSnapshot,
  loadPipelineRuntimeReadSet,
  type PipelineDossierRow,
  type PipelineRunRow,
  type PipelineRuntimeSnapshot,
} from '@/lib/pipeline-runtime'
import { deriveOperationalFreshnessCheckpoint } from '@/lib/operational-freshness'
import { normalizeTerminalFollowOnMetadata, shouldSurfaceResumeNeeded } from '@/lib/queue-drilldown-normalization'
import { loadQuestionFirstScaleManifest } from '@/lib/question-first-manifest'
import { describeQuestionFirstQueueOrder, sortQuestionFirstManifestEntities } from '@/lib/question-first-queue-order'
import { resolveQuestionTextFromDossierData } from '@/lib/question-text-resolver'

const scaleManifestData = loadQuestionFirstScaleManifest()

export const dynamic = 'force-dynamic'
const ROUTE_CACHE_TTL_MS = 4_000
const RECENT_ACTIVE_GRACE_MS = 8_000
const FRESH_ACTIVITY_WINDOW_SECONDS = 300
const ROUTE_DIR = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_WORKER_STATE_PATH = path.resolve(ROUTE_DIR, '../../../../../tmp/entity-pipeline-worker-state.json')

let cachedQueueDrilldownPayload: Record<string, unknown> | null = null
let cachedQueueDrilldownFetchedAt = 0
let inFlightQueueDrilldownBuild: Promise<Record<string, unknown>> | null = null
let latestQueueDrilldownBuildToken = 0

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
  last_completed_question?: string | null
  last_completed_question_text?: string | null
  next_action?: string | null
  lifecycle_stage?: string | null
  lifecycle_label?: string | null
  lifecycle_summary?: string | null
  movement_state?: string | null
}

type DossierRecord = PipelineDossierRow

type ProcessedDossierRow = {
  entity_id: string
  canonical_entity_id?: string | null
  entity_name: string
  entity_type: string
  generated_at: string | null
  dossier_data?: Record<string, unknown> | null
}

type OperationalState = 'starting' | 'running' | 'retrying' | 'skipping' | 'stopping' | 'paused' | 'stopped' | 'waiting'

type LiveOperationalState = 'starting' | 'running' | 'retrying' | 'reconciling' | 'published_degraded' | 'stopping' | 'paused' | 'stopped' | 'waiting'

function isQueueDrilldownCacheFresh(now = Date.now()) {
  return Boolean(cachedQueueDrilldownPayload) && (now - cachedQueueDrilldownFetchedAt) < ROUTE_CACHE_TTL_MS
}

function isTransientReadTimeout(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '')
  return message.toLowerCase().includes('connection timeout')
}

function parseTimestamp(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return 0
  const parsed = Date.parse(text)
  return Number.isFinite(parsed) ? parsed : 0
}

function carryForwardRecentActiveEntity(
  payload: Record<string, unknown>,
  previousPayload: Record<string, unknown> | null,
  now = Date.now(),
) {
  if (!previousPayload) return payload

  const nextLiveState = payload.live_state && typeof payload.live_state === 'object'
    ? payload.live_state as Record<string, unknown>
    : null
  const nextQueue = payload.queue && typeof payload.queue === 'object'
    ? payload.queue as Record<string, unknown>
    : null
  const nextRuntime = payload.runtime && typeof payload.runtime === 'object'
    ? payload.runtime as Record<string, unknown>
    : null
  const nextControl = payload.control && typeof payload.control === 'object'
    ? payload.control as Record<string, unknown>
    : null

  if (!nextLiveState || !nextQueue || !nextRuntime || !nextControl) return payload
  if (nextLiveState.current_live_run || nextQueue.in_progress_entity) return payload
  if (String(payload.operational_state || '') !== 'waiting') return payload
  if (String(nextControl.requested_state || '') === 'paused' || nextControl.is_paused === true) return payload

  const nextRuntimeWorker = nextRuntime.worker && typeof nextRuntime.worker === 'object'
    ? nextRuntime.worker as Record<string, unknown>
    : null
  const workerState = String(nextLiveState.worker_process_state || nextRuntimeWorker?.worker_process_state || '')
  if (workerState !== 'running' && workerState !== 'starting') return payload

  const previousLiveState = previousPayload.live_state && typeof previousPayload.live_state === 'object'
    ? previousPayload.live_state as Record<string, unknown>
    : null
  const previousQueue = previousPayload.queue && typeof previousPayload.queue === 'object'
    ? previousPayload.queue as Record<string, unknown>
    : null
  const previousRuntime = previousPayload.runtime && typeof previousPayload.runtime === 'object'
    ? previousPayload.runtime as Record<string, unknown>
    : null

  const previousRun = previousLiveState?.current_live_run
    || previousQueue?.in_progress_entity
    || previousRuntime?.current_live_run
    || null
  if (!previousRun || typeof previousRun !== 'object') return payload

  const recentActivityAt = parseTimestamp(
    previousPayload.last_activity_at
    || previousPayload.snapshot_at
    || previousRuntime?.generated_at
    || previousRuntime?.snapshot_at,
  )
  if (!recentActivityAt || (now - recentActivityAt) > RECENT_ACTIVE_GRACE_MS) return payload

  return {
    ...payload,
    operational_state: 'running',
    live_state: {
      ...nextLiveState,
      operational_state: 'running',
      current_run: previousRun,
      current_live_run: previousRun,
      in_progress_entity: previousQueue?.in_progress_entity || previousRun,
      running_entities: previousQueue?.running_entities || [previousQueue?.in_progress_entity || previousRun],
    },
    runtime: {
      ...nextRuntime,
      current_run: previousRun,
      current_live_run: previousRun,
      latest_noteworthy_run: nextRuntime.latest_noteworthy_run || previousRun,
    },
    queue: {
      ...nextQueue,
      in_progress_entity: previousQueue?.in_progress_entity || previousRun,
      running_entities: previousQueue?.running_entities || [previousQueue?.in_progress_entity || previousRun],
      latest_noteworthy_entity: nextQueue.latest_noteworthy_entity || previousQueue?.in_progress_entity || previousRun,
    },
  }
}

function __resetQueueDrilldownRouteCacheForTests() {
  cachedQueueDrilldownPayload = null
  cachedQueueDrilldownFetchedAt = 0
  inFlightQueueDrilldownBuild = null
  latestQueueDrilldownBuildToken = 0
}

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

function applyCanonicalQueuePositions<T extends { entity_id: string; queue_position?: number | null }>(
  items: T[],
  canonicalQueuePositionByEntityId: Map<string, number>,
) {
  return items.map((item) => {
    if (typeof item.queue_position === 'number') {
      return item
    }
    const queuePosition = canonicalQueuePositionByEntityId.get(item.entity_id)
    return typeof queuePosition === 'number'
      ? { ...item, queue_position: queuePosition }
      : item
  })
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function normalizeType(value: unknown): string {
  return toText(value).toLowerCase()
}

function normalizeQueueIdentity(record: {
  entity_id?: unknown
  canonical_entity_id?: unknown
  entity_name?: unknown
  entity_type?: unknown
  metadata?: unknown
}) {
  const metadata = record.metadata && typeof record.metadata === 'object'
    ? record.metadata as Record<string, unknown>
    : {}
  const entityId = toText(record.entity_id) || toText(metadata.entity_id) || toText(metadata.auto_advance_target_entity_id)
  const canonicalEntityId = toText(record.canonical_entity_id)
    || toText(metadata.canonical_entity_id)
    || toText(metadata.auto_advance_target_entity_id)
    || entityId
  const entityName = toText(record.entity_name)
    || toText(metadata.entity_name)
    || toText(metadata.auto_advance_target_entity_name)
    || canonicalEntityId
    || entityId
  const entityType = toText(record.entity_type)
    || toText(metadata.entity_type)
    || toText(metadata.auto_advance_target_entity_type)
    || 'Entity'

  return {
    entity_id: entityId,
    canonical_entity_id: canonicalEntityId,
    entity_name: entityName,
    entity_type: entityType,
  }
}

function resolveCanonicalQueueEntity(
  record: {
    entity_id?: unknown
    canonical_entity_id?: unknown
    entity_name?: unknown
    entity_type?: unknown
    metadata?: unknown
  },
  canonicalEntities: any[],
) {
  const normalizedRecord = normalizeQueueIdentity(record)
  const sourceEntityId = normalizedRecord.entity_id
  const explicitCanonicalEntityId = normalizedRecord.canonical_entity_id
  const sourceEntityName = normalizedRecord.entity_name
  const sourceEntityType = normalizedRecord.entity_type

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
  metadata?: unknown
}, canonicalEntities: any[]) {
  const normalizedRecord = normalizeQueueIdentity(record)
  const sourceEntityId = normalizedRecord.entity_id
  const explicitCanonicalEntityId = normalizedRecord.canonical_entity_id
  const sourceEntityName = normalizedRecord.entity_name.toLowerCase()
  const sourceEntityType = normalizedRecord.entity_type.toLowerCase()

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
	    generated_at?: unknown
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
  const queueIdentity = normalizeQueueIdentity({ ...row, metadata })
  const runtimeRecord = buildPipelineRuntimeRunRecord(
    {
      batch_id: toText(row.batch_id ?? row.id) || null,
      entity_id: queueIdentity.entity_id,
      canonical_entity_id: queueIdentity.canonical_entity_id || null,
      entity_name: queueIdentity.entity_name || 'Unknown entity',
      status: toText(row.status) || null,
      phase: toText(row.phase) || null,
      started_at: toText(row.started_at) || null,
      completed_at: toText(row.completed_at) || null,
      metadata,
    } satisfies PipelineRunRow,
    true,
  )
  const heartbeat = resolveOperationalHeartbeatDetails({
    heartbeat_at: metadata.heartbeat_at || row.heartbeat_at,
    started_at: row.started_at,
    generated_at: row.completed_at ?? row.started_at,
  })

  return {
    batch_id: toText(row.batch_id ?? row.id) || null,
    status: toText(row.status) || null,
    entity_id: queueIdentity.canonical_entity_id || queueIdentity.entity_id,
    entity_name: queueIdentity.entity_name || 'Unknown entity',
    entity_type: queueIdentity.entity_type || 'entity',
    summary: runtimeRecord.current_question_text
      || runtimeRecord.current_execution_state
      || runtimeRecord.current_substep_label
      || runtimeRecord.current_action
      || toText(metadata.summary)
      || toText(metadata.quality_summary)
      || toText(metadata.error_message)
      || toText((metadata.stop_details && typeof metadata.stop_details === 'object'
        ? (metadata.stop_details as Record<string, unknown>).error_message
        : null))
      || (toText(metadata.active_question_id) ? `Running ${toText(metadata.active_question_id)}` : null),
    generated_at: toText(row.completed_at ?? row.started_at) || null,
    started_at: toText(row.started_at) || null,
    heartbeat_at: heartbeat.heartbeat_at,
    heartbeat_age_seconds: heartbeat.heartbeat_age_seconds,
    heartbeat_source: heartbeat.heartbeat_source,
    freshness_state: heartbeat.freshness_state,
    retry_state: toText(metadata.retry_state) || null,
    stop_reason: toText(metadata.stop_reason) || null,
    continue_pipeline_on_failure: metadata.continue_pipeline_on_failure === true,
    stop_details: metadata.stop_details && typeof metadata.stop_details === 'object'
      ? metadata.stop_details as Record<string, unknown>
      : null,
    active_question_id: runtimeRecord.current_question_id || null,
    current_question_id: runtimeRecord.current_question_id || null,
    current_question_text: runtimeRecord.current_question_text || null,
    current_section_id: runtimeRecord.current_section_id || null,
    current_section_label: runtimeRecord.current_section_label || null,
    current_section_index: runtimeRecord.current_section_index,
    current_section_total: runtimeRecord.current_section_total,
    current_question_index: runtimeRecord.current_question_index,
    current_question_total: runtimeRecord.current_question_total,
    current_strategy_label: runtimeRecord.current_strategy_label || null,
    current_execution_state: runtimeRecord.current_execution_state || null,
    current_source_order: runtimeRecord.current_source_order || null,
    execution_backend: runtimeRecord.execution_backend || null,
    execution_model: runtimeRecord.execution_model || null,
    execution_provider: runtimeRecord.execution_provider || null,
    brightdata_transport: runtimeRecord.brightdata_transport || null,
    current_substep: runtimeRecord.current_substep || null,
    current_substep_label: runtimeRecord.current_substep_label || null,
    current_substep_progress: runtimeRecord.current_substep_progress || null,
    current_action: runtimeRecord.current_execution_state || runtimeRecord.current_action || null,
    run_phase: runtimeRecord.phase || null,
    current_stage: runtimeRecord.current_stage || null,
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
    continue_pipeline_on_failure: runtimeRun.continue_pipeline_on_failure === true,
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

function buildSyntheticLiveRunFromWorker(runtime: PipelineRuntimeSnapshot['worker']) {
  const runtimeRecord = runtime && typeof runtime === 'object' ? runtime as Record<string, unknown> : null
  if (!runtimeRecord) return null
  const workerState = toText(runtimeRecord.worker_process_state).toLowerCase()
  if (workerState !== 'running' && workerState !== 'starting') return null

  const entityId = toText(runtimeRecord.current_entity_id)
  const entityName = toText(runtimeRecord.current_entity_name)
  if (!entityId || !entityName) return null

  const heartbeatAt = toText(runtimeRecord.current_activity_at || runtimeRecord.updated_at) || null
  const heartbeat = resolveOperationalHeartbeatDetails({
    heartbeat_at: heartbeatAt,
    started_at: toText(runtimeRecord.current_started_at) || heartbeatAt,
    generated_at: heartbeatAt,
  })
  if ((heartbeat.heartbeat_age_seconds ?? Number.MAX_SAFE_INTEGER) > FRESH_ACTIVITY_WINDOW_SECONDS) {
    return null
  }

  return {
    batch_id: toText(runtimeRecord.current_batch_id) || null,
    entity_id: entityId,
    canonical_entity_id: toText(runtimeRecord.current_canonical_entity_id) || entityId,
    entity_name: entityName,
    status: 'running',
    phase: toText(runtimeRecord.current_phase) || 'entity_registration',
    current_section_id: null,
    current_section_label: null,
    current_section_index: null,
    current_section_total: null,
    current_substep: null,
    current_substep_label: null,
    current_substep_progress: null,
    current_question_id: toText(runtimeRecord.current_question_id) || null,
    current_question_text: toText(runtimeRecord.current_question_text) || null,
    current_question_index: null,
    current_question_total: null,
    current_strategy_label: null,
    current_execution_state: null,
    current_source_order: null,
    execution_backend: null,
    execution_model: null,
    execution_provider: null,
    brightdata_transport: null,
    current_action: toText(runtimeRecord.current_action) || toText(runtimeRecord.current_phase) || null,
    current_stage: toText(runtimeRecord.current_phase) || 'entity_registration',
    heartbeat_at: heartbeatAt,
    heartbeat_age_seconds: heartbeat.heartbeat_age_seconds ?? null,
    publication_status: null,
    retry_state: null,
    stop_reason: null,
    continue_pipeline_on_failure: false,
    error_type: null,
    error_message: null,
    queue_state: 'running' as const,
  }
}

async function loadWorkerActivityOverlay(workerStatePath: unknown) {
  const workerStateFile = toText(workerStatePath)
  if (!workerStateFile) return null

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const raw = await readFile(workerStateFile, 'utf8')
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const entityId = toText(parsed.current_entity_id)
      const entityName = toText(parsed.current_entity_name)
      if (entityId && entityName) {
        return {
          current_batch_id: toText(parsed.current_batch_id) || null,
          current_entity_id: entityId,
          current_canonical_entity_id: toText(parsed.current_canonical_entity_id) || entityId,
          current_entity_name: entityName,
          current_question_id: toText(parsed.current_question_id) || null,
          current_question_text: toText(parsed.current_question_text) || null,
          current_action: toText(parsed.current_action) || null,
          current_phase: toText(parsed.current_phase) || null,
          current_started_at: toText(parsed.current_started_at) || null,
          current_activity_at: toText(parsed.current_activity_at) || null,
          updated_at: toText(parsed.updated_at) || null,
        }
      }
    } catch {
      // Best-effort retry during rapid worker-state rewrites.
    }
    if (attempt < 7) {
      await new Promise((resolve) => setTimeout(resolve, 30))
    }
  }
  return null
}

function buildBacklogHealth(runtime: PipelineRuntimeSnapshot, staleActiveRows: QueueEntityRecord[]) {
  const failureBuckets = runtime.failure_buckets
  const hasFreshLiveRun = Boolean(runtime.current_live_run)
  return {
    stale_active_count: staleActiveRows.length,
    worker_stale_count: failureBuckets.worker_stale ?? 0,
    retrying_count: failureBuckets.retrying ?? 0,
    reconciling_count: failureBuckets.reconciling ?? 0,
    published_degraded_count: failureBuckets.published_degraded ?? 0,
    failed_terminal_count: failureBuckets.failed_terminal ?? 0,
    healthy: hasFreshLiveRun
      ? (failureBuckets.retrying ?? 0) === 0
        && (failureBuckets.reconciling ?? 0) === 0
      : staleActiveRows.length === 0
      && (failureBuckets.worker_stale ?? 0) === 0
      && (failureBuckets.retrying ?? 0) === 0
      && (failureBuckets.reconciling ?? 0) === 0
      && (failureBuckets.published_degraded ?? 0) === 0
      && (failureBuckets.failed_terminal ?? 0) === 0,
  }
}

async function loadProcessedDossierCount(): Promise<number> {
  try {
    const result = await queryPostgres(`
      select count(distinct canonical_entity_id)::int as processed_dossiers
      from entity_dossiers
      where canonical_entity_id is not null
    `)
    const rawValue = result.rows?.[0]?.processed_dossiers
    const processedDossiers = Number(rawValue)
    return Number.isFinite(processedDossiers) ? processedDossiers : 0
  } catch {
    return 0
  }
}

function extractProcessedDossierSummary(dossierData: Record<string, unknown> | null): string | null {
  if (!dossierData || typeof dossierData !== 'object') return null

  const questionFirst = dossierData.question_first && typeof dossierData.question_first === 'object'
    ? dossierData.question_first as Record<string, unknown>
    : null
  const discoverySummary = questionFirst?.discovery_summary && typeof questionFirst.discovery_summary === 'object'
    ? questionFirst.discovery_summary as Record<string, unknown>
    : null
  const graphiti = discoverySummary?.graphiti_sales_brief && typeof discoverySummary.graphiti_sales_brief === 'object'
    ? discoverySummary.graphiti_sales_brief as Record<string, unknown>
    : null

  const candidates = [
    graphiti?.outreach_angle,
    graphiti?.outreach_target,
    discoverySummary?.recommended_approach,
    discoverySummary?.opportunity_summary,
    discoverySummary?.summary,
    dossierData.recommended_approach,
    dossierData.overall_assessment,
    questionFirst?.summary,
    questionFirst?.recommended_approach,
  ]
  for (const candidate of candidates) {
    const text = toText(candidate)
    if (text) return text
  }
  return null
}

async function loadProcessedDossierRows(limit = 200): Promise<ProcessedDossierRow[]> {
  try {
    const result = await queryPostgres(
      `
        select entity_id, canonical_entity_id, entity_name, entity_type, generated_at, dossier_data
        from entity_dossiers
        where canonical_entity_id is not null
        order by generated_at desc nulls last, entity_name asc
        limit $1
      `,
      [limit],
    )
    return Array.isArray(result.rows)
      ? result.rows.map((row) => ({
        entity_id: toText(row.entity_id),
        canonical_entity_id: toText(row.canonical_entity_id) || null,
        entity_name: toText(row.entity_name),
        entity_type: toText(row.entity_type) || 'Entity',
        generated_at: toText(row.generated_at) || null,
        dossier_data: (row.dossier_data && typeof row.dossier_data === 'object') ? row.dossier_data as Record<string, unknown> : null,
      }))
      : []
  } catch {
    return []
  }
}

function mapProcessedDossierRowsToQueueEntities(rows: ProcessedDossierRow[]): QueueEntityRecord[] {
  return rows.map((row, index) => ({
    entity_id: row.canonical_entity_id || row.entity_id,
    entity_name: row.entity_name || row.canonical_entity_id || row.entity_id,
    entity_type: row.entity_type || 'Entity',
    summary: extractProcessedDossierSummary(row.dossier_data ?? null),
    generated_at: row.generated_at,
    heartbeat_at: row.generated_at,
    heartbeat_age_seconds: null,
    heartbeat_source: 'entity_dossiers',
    freshness_state: 'fresh',
    status: 'completed',
    started_at: row.generated_at,
    completed_at: row.generated_at,
    run_phase: 'completed',
    current_stage: 'completed',
    queue_position: index + 1,
    publication_status: 'published',
    current_question_id: 'completed',
    current_question_text: 'Completed dossier',
    current_action: 'completed',
    next_action: 'Open the completed dossier',
  }))
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

async function buildQueueDrilldownPayload() {
  const preloadedWorkerActivityOverlay = await loadWorkerActivityOverlay(DEFAULT_WORKER_STATE_PATH)
  const manifestPayload = (scaleManifestData || null) as Record<string, unknown> | null
  const manifestEntities = Array.isArray(manifestPayload?.entities)
    ? manifestPayload.entities as ManifestEntity[]
    : []
  const canonicalEntities = await getCanonicalEntitiesSnapshot()
  const normalizedUniverseCount = await getNormalizedUniverseCount()
  const orderedManifestEntities = sortQuestionFirstManifestEntities(manifestEntities, canonicalEntities)
  const universeCount = normalizedUniverseCount ?? orderedManifestEntities.length
  const processedDossierCount = await loadProcessedDossierCount()
  const processedEntities = mapProcessedDossierRowsToQueueEntities(await loadProcessedDossierRows(200))

  const runtimeReadSet = await loadPipelineRuntimeReadSet()
  const runtimeSnapshot = buildPipelineRuntimeSnapshot(runtimeReadSet)
  const workerActivityOverlay = preloadedWorkerActivityOverlay
    || await loadWorkerActivityOverlay(runtimeSnapshot.worker.worker_state_path)
  const effectiveWorker = workerActivityOverlay
    ? {
        ...runtimeSnapshot.worker,
        ...workerActivityOverlay,
      }
    : runtimeSnapshot.worker
  const control = runtimeSnapshot.control
  const activeRuns = runtimeReadSet.rows
    .filter((row) => ['claiming', 'running', 'retrying'].includes(toText(row.status).toLowerCase()))
    .slice(0, 8) as Record<string, unknown>[]
  const queuedRuns = runtimeReadSet.rows
    .filter((row) => toText(row.status).toLowerCase() === 'queued')
    .slice(0, 8) as Record<string, unknown>[]
  const completedRuns = runtimeReadSet.rows
    .filter((row) => {
      const status = toText(row.status).toLowerCase()
      if (status === 'completed') return true
      if (status !== 'failed') return false
      const metadata = row.metadata && typeof row.metadata === 'object'
        ? row.metadata as Record<string, unknown>
        : {}
      return metadata.continue_pipeline_on_failure === true
    })
    .slice(0, 8) as Record<string, unknown>[]
  const dossierRows = runtimeReadSet.dossiers as DossierRecord[]
  const dossierLookup = buildDossierLookup(dossierRows)
  const workerProcessState = effectiveWorker.worker_process_state
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
  const queuedEntities = dedupeByEntityId(await Promise.all(queuedRuns.map(async (row, index) => {
    const queueRecord = toQueueRecord(row)
    const canonicalRecord = await buildCanonicalQueueEntity(row, canonicalEntities)
    const dossierRow = findDossierForRow(row, dossierLookup)
    return {
      ...queueRecord,
      ...canonicalRecord,
      ...enrichQuestionTextFields(queueRecord, dossierRow?.dossier_data ?? null),
      current_stage: 'queued',
      run_phase: 'queued',
      next_action: queueRecord.next_action || 'Waiting for claim',
      queue_position: index + 1,
    }
  })))
  const resumeNeededEntities = dedupeByEntityId(
    completedEntities
      .filter((item) => item.continue_pipeline_on_failure !== true)
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
      ...queuedEntities.map((item) => item.entity_id),
    ].filter(Boolean) as string[],
  )
  const canonicalManifestEntities = orderedManifestEntities.map((entity) => ({
    ...resolveCanonicalQueueEntity(entity, canonicalEntities),
    source_entity_id: entity.entity_id,
    source_entity_name: entity.entity_name,
    source_entity_type: entity.entity_type,
  }))
  const canonicalQueuePositionByEntityId = new Map(
    canonicalManifestEntities.map((entity, index) => [entity.entity_id, index + 1] as const),
  )
  const positionedCompletedEntities = applyCanonicalQueuePositions(completedEntities, canonicalQueuePositionByEntityId)
  const positionedResumeNeededEntities = applyCanonicalQueuePositions(resumeNeededEntities, canonicalQueuePositionByEntityId)
  const manifestUpcomingEntities = canonicalManifestEntities
    .filter((entity) => !seenEntityIds.has(entity.entity_id))
    .map((entity) => ({
      ...entity,
      summary: 'Waiting in the serialized live loop.',
      generated_at: null,
      started_at: null,
      heartbeat_at: null,
      queue_position: canonicalQueuePositionByEntityId.get(entity.entity_id) ?? null,
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
  const upcomingEntities = dedupeByEntityId([
    ...queuedEntities,
    ...manifestUpcomingEntities,
  ]).slice(0, 24)

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
	          : null),
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
  const dedupedBlockedEntities = applyCanonicalQueuePositions(
    dedupeByEntityId(blockedEntities),
    canonicalQueuePositionByEntityId,
  )
    .slice(0, 8)
  const backlogHealth = buildBacklogHealth(runtimeSnapshot, staleActiveRows)
  const liveState = deriveLiveState(runtimeSnapshot, control)
  const runtimeCurrentLiveRun = runtimeSnapshot.current_live_run ?? buildSyntheticLiveRunFromWorker(effectiveWorker)
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
        active_question_id: runtimeCurrentLiveRun.current_question_id || liveEntityFromActiveRuns?.active_question_id || null,
        current_question_id: runtimeCurrentLiveRun.current_question_id || liveEntityFromActiveRuns?.current_question_id || null,
        current_question_text: runtimeCurrentLiveRun.current_question_text || liveEntityFromActiveRuns?.current_question_text || null,
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
  const workerShowsActiveProcessing = workerProcessState === 'running' || workerProcessState === 'starting'
  const hasActiveProcessingEvidence = !requestedPaused && !observedPaused && (
    hasFreshRunningEntities
    || workerShowsActiveProcessing
  )
  const stopReason = hasFreshRunningEntities
    ? null
    : hasActiveProcessingEvidence
      ? null
      : controlStopReason || (workerStopped && hasStaleOnlyActiveRows && !observedStarting && !observedStopping ? 'worker_heartbeat_stale' : null)
  const operationalState: OperationalState = observedStarting
    ? 'starting'
    : observedStopping
      ? 'stopping'
      : requestedPaused || observedPaused
        ? 'paused'
        : hasFreshRunningEntities
          ? (skippingEntity
          ? 'skipping'
          : liveState === 'retrying' || retryingEntity
            ? 'retrying'
            : liveState === 'running' || liveState === 'reconciling' || hasFreshRunningEntities
              ? 'running'
              : 'waiting')
          : hasActiveProcessingEvidence
            ? 'waiting'
            : workerStopped || hasStaleOnlyActiveRows
              ? 'stopped'
              : 'waiting'
  const stopDetails = controlStopDetails || (
    hasStaleOnlyActiveRows && operationalState === 'stopped' && !hasActiveProcessingEvidence
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
    ? positionedCompletedEntities.find((item) => (
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
    completedEntities: positionedCompletedEntities,
  })

  return {
    snapshot_at: runtimeSnapshot.snapshot_at,
    last_activity_at: freshnessCheckpoint.last_activity_at,
    freshness_state: freshnessCheckpoint.freshness_state,
    control,
    runtime: {
      snapshot_at: runtimeSnapshot.snapshot_at,
      generated_at: runtimeSnapshot.generated_at,
      worker: effectiveWorker,
      fastmcp: runtimeSnapshot.fastmcp,
      queue_depth: runtimeSnapshot.queue_depth,
      current_run: runtimeCurrentLiveRun || runtimeSnapshot.current_run,
      current_live_run: runtimeCurrentLiveRun,
      latest_noteworthy_run: runtimeSnapshot.latest_noteworthy_run,
      recent_failures: runtimeSnapshot.recent_failures,
      failure_buckets: runtimeSnapshot.failure_buckets,
    },
    live_state: {
      operational_state: liveState,
      worker_process_state: effectiveWorker.worker_process_state,
      current_run: runtimeCurrentLiveRun,
      current_live_run: runtimeCurrentLiveRun,
      in_progress_entity: visibleInProgressEntity,
      running_entities: visibleRunningEntities,
    },
    backlog_health: backlogHealth,
    operational_state: operationalState,
    stop_reason: stopReason,
    stop_details: stopDetails,
    freshness_threshold_seconds: freshnessThresholdSeconds,
    playlist_sort_key: describeQuestionFirstQueueOrder(),
    loop_status: {
      universe_count: universeCount,
      total_scheduled: orderedManifestEntities.length,
      completed: positionedCompletedEntities.filter((item) => toText(item.status).toLowerCase() === 'completed').length,
      processed_dossiers: processedDossierCount,
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
        resume_needed: positionedResumeNeededEntities.length,
      },
    },
    queue: {
      in_progress_entity: visibleInProgressEntity,
      running_entities: visibleRunningEntities,
      stale_active_rows: visibleStaleActiveRows,
      latest_noteworthy_entity: latestNoteworthyEntity,
      completed_entities: positionedCompletedEntities,
      processed_entities: processedEntities,
      resume_needed_entities: positionedResumeNeededEntities,
      upcoming_entities: upcomingEntities,
    },
    dossier_quality: {
      incomplete_entities: dedupedBlockedEntities,
    },
  }
}

export async function GET(request: Request) {
  const requestUrl = request?.url ? new URL(request.url) : null
  const forceRefresh = requestUrl?.searchParams.get('refresh') === '1'
  const runBuild = () => {
    const buildToken = ++latestQueueDrilldownBuildToken
    return buildQueueDrilldownPayload()
      .then((payload) => {
        const smoothedPayload = carryForwardRecentActiveEntity(payload, cachedQueueDrilldownPayload)
        if (buildToken === latestQueueDrilldownBuildToken) {
          cachedQueueDrilldownPayload = smoothedPayload
          cachedQueueDrilldownFetchedAt = Date.now()
        }
        return smoothedPayload
      })
      .catch((error) => {
        if (cachedQueueDrilldownPayload && isTransientReadTimeout(error)) {
          return cachedQueueDrilldownPayload
        }
        throw error
      })
  }

  if (!forceRefresh && isQueueDrilldownCacheFresh()) {
    return NextResponse.json(cachedQueueDrilldownPayload)
  }

  if (forceRefresh) {
    return NextResponse.json(await runBuild())
  }

  if (!inFlightQueueDrilldownBuild) {
    inFlightQueueDrilldownBuild = runBuild()
      .finally(() => {
        inFlightQueueDrilldownBuild = null
      })
  }

  return NextResponse.json(await inFlightQueueDrilldownBuild)
}
