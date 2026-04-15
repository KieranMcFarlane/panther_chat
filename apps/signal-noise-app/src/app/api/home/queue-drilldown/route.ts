import { NextResponse } from 'next/server'
import { getCanonicalEntitiesSnapshot } from '@/lib/canonical-entities-snapshot'
import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
import { matchesEntityUuid, resolveEntityUuid } from '@/lib/entity-public-id'
import { deriveEntityPipelineLifecycle } from '@/lib/entity-pipeline-lifecycle'
import { resolveOperationalHeartbeatDetails, type OperationalHeartbeatFreshness } from '@/lib/operational-heartbeat'
import { getNormalizedUniverseCount } from '@/lib/normalized-universe-count'
import { loadPipelineRuntimeSnapshot } from '@/lib/pipeline-runtime'
import { readPipelineControlState } from '@/lib/pipeline-control-state'
import { normalizeTerminalFollowOnMetadata } from '@/lib/queue-drilldown-normalization'
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

type DossierRecord = {
  entity_id: string
  canonical_entity_id?: string | null
  entity_name: string
  entity_type: string
  generated_at: string | null
  dossier_data?: Record<string, unknown> | null
}

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
    summary: toText(metadata.summary) || toText(metadata.quality_summary) || (toText(metadata.active_question_id) ? `Running ${toText(metadata.active_question_id)}` : null),
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
    current_action: toText(metadata.current_action) || toText(metadata.next_action) || toText(metadata.run_phase) || null,
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
      || null,
  }
}

function buildQueueEntityFromRuntimeRun(
  runtimeRun: NonNullable<Awaited<ReturnType<typeof loadPipelineRuntimeSnapshot>>['current_run']>,
): QueueEntityRecord {
  return {
    batch_id: runtimeRun.batch_id,
    status: runtimeRun.status,
    entity_id: runtimeRun.canonical_entity_id || runtimeRun.entity_id,
    entity_name: runtimeRun.entity_name,
    entity_type: 'Entity',
    summary: runtimeRun.current_question_text || runtimeRun.current_action || runtimeRun.phase || null,
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

function buildBacklogHealth(runtime: Awaited<ReturnType<typeof loadPipelineRuntimeSnapshot>>, staleActiveRows: QueueEntityRecord[]) {
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
  runtime: Awaited<ReturnType<typeof loadPipelineRuntimeSnapshot>>,
  control: Awaited<ReturnType<typeof readPipelineControlState>>,
): LiveOperationalState {
  const workerState = runtime.worker.worker_process_state
  const queueState = runtime.current_run?.queue_state

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

  const [control, runtime, activeRunsResponse, completedRunsResponse, dossiersResponse] = await Promise.all([
    readPipelineControlState(),
    loadPipelineRuntimeSnapshot(),
    supabase
      .from('entity_pipeline_runs')
      .select('batch_id, entity_id, canonical_entity_id, entity_name, started_at, completed_at, metadata, phase, status')
      .in('status', ['queued', 'claiming', 'running', 'retrying'])
      .order('started_at', { ascending: false })
      .limit(8),
    supabase
      .from('entity_pipeline_runs')
      .select('batch_id, entity_id, canonical_entity_id, entity_name, started_at, completed_at, metadata, phase, status')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(8),
    supabase
      .from('entity_dossiers')
      .select('entity_id, canonical_entity_id, entity_name, entity_type, generated_at, dossier_data')
      .order('generated_at', { ascending: false })
      .limit(40),
  ])

  const activeRuns = Array.isArray(activeRunsResponse.data) ? activeRunsResponse.data as Record<string, unknown>[] : []
  const completedRuns = Array.isArray(completedRunsResponse.data) ? completedRunsResponse.data as Record<string, unknown>[] : []
  const dossierRows = Array.isArray(dossiersResponse.data) ? dossiersResponse.data as DossierRecord[] : []
  const dossierLookup = buildDossierLookup(dossierRows)
  const workerProcessState = runtime.worker.worker_process_state
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

  const seenEntityIds = new Set(
    [
      ...runningEntities.map((item) => item.entity_id),
      ...staleActiveRows.map((item) => item.entity_id),
      ...completedEntities.map((item) => item.entity_id),
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
  const backlogHealth = buildBacklogHealth(runtime, staleActiveRows)
  const liveState = deriveLiveState(runtime, control)
  const runtimeCurrentRun = runtime.current_run
  const liveEntityFromActiveRuns = runtimeCurrentRun
    ? activeEntities.find((item) => (
      (runtimeCurrentRun.batch_id && toText(item.batch_id) === toText(runtimeCurrentRun.batch_id))
      || toText(item.entity_id) === toText(runtimeCurrentRun.canonical_entity_id || runtimeCurrentRun.entity_id)
    )) || null
    : null
  const liveInProgressEntity = runtimeCurrentRun
    ? {
        ...(liveEntityFromActiveRuns || buildQueueEntityFromRuntimeRun(runtimeCurrentRun)),
        freshness_state: 'fresh' as const,
      }
    : null

  const controlRecord = (control && typeof control === 'object') ? control as Record<string, unknown> : null
  const controlStopReason = toText(controlRecord?.stop_reason)
  const controlStopDetails = controlRecord?.stop_details && typeof controlRecord.stop_details === 'object'
    ? controlRecord.stop_details as Record<string, unknown>
    : null
  const hasFreshRunningEntities = liveState === 'running' || liveState === 'retrying' || liveState === 'reconciling' || liveState === 'published_degraded'
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
            : liveState === 'running' || liveState === 'reconciling' || liveState === 'published_degraded' || hasFreshRunningEntities
              ? 'running'
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

  return NextResponse.json({
    control,
    runtime: {
      generated_at: runtime.generated_at,
      worker: runtime.worker,
      fastmcp: runtime.fastmcp,
      queue_depth: runtime.queue_depth,
      current_run: runtime.current_run,
      recent_failures: runtime.recent_failures,
      failure_buckets: runtime.failure_buckets,
    },
    live_state: {
      operational_state: liveState,
      worker_process_state: runtime.worker.worker_process_state,
      current_run: runtime.current_run,
      in_progress_entity: visibleInProgressEntity,
      running_entities: visibleRunningEntities,
    },
    backlog_health: backlogHealth,
    operational_state: operationalState,
    stop_reason: stopReason,
    stop_details: stopDetails,
    freshness_threshold_seconds: 5 * 60,
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
        resume_needed: 0,
      },
    },
    queue: {
      in_progress_entity: visibleInProgressEntity,
      running_entities: visibleRunningEntities,
      stale_active_rows: visibleStaleActiveRows,
      completed_entities: completedEntities,
      resume_needed_entities: [],
      upcoming_entities: upcomingEntities,
    },
    dossier_quality: {
      incomplete_entities: dedupedBlockedEntities,
    },
  })
}
