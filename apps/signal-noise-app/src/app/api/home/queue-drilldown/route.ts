import { NextResponse } from 'next/server'
import scaleManifestData from '../../../../../backend/data/question_first_scale_batch_3000_live.json'
import { getCanonicalEntitiesSnapshot } from '@/lib/canonical-entities-snapshot'
import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
import { matchesEntityUuid, resolveEntityUuid } from '@/lib/entity-public-id'
import { deriveEntityPipelineLifecycle } from '@/lib/entity-pipeline-lifecycle'
import { readPipelineControlState } from '@/lib/pipeline-control-state'

export const dynamic = 'force-dynamic'

type ManifestEntity = {
  entity_id: string
  entity_name: string
  entity_type: string
  canonical_entity_id?: string | null
}

type QueueEntityRecord = {
  entity_id: string
  entity_name: string
  entity_type: string
  summary: string | null
  generated_at: string | null
  started_at?: string | null
  active_question_id?: string | null
  run_phase?: string | null
  queue_position?: number | null
  publication_status?: string | null
  next_repair_question_id?: string | null
  next_repair_status?: string | null
  next_repair_batch_id?: string | null
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

  return {
    entity_id: toText(row.entity_id),
    entity_name: toText(row.entity_name) || 'Unknown entity',
    entity_type: toText(metadata.entity_type) || 'entity',
    summary: toText(metadata.summary) || toText(metadata.quality_summary) || (toText(metadata.active_question_id) ? `Running ${toText(metadata.active_question_id)}` : null),
    generated_at: toText(row.completed_at ?? row.started_at) || null,
    started_at: toText(row.started_at) || null,
    active_question_id: toText(metadata.active_question_id) || null,
    run_phase: toText(row.phase ?? metadata.run_phase ?? row.status) || null,
    publication_status: toText(metadata.publication_status) || null,
    next_repair_question_id: toText(metadata.next_repair_question_id) || null,
    next_repair_status: toText(metadata.next_repair_status) || null,
    next_repair_batch_id: toText(metadata.next_repair_batch_id) || null,
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

export async function GET() {
  const manifestPayload = (scaleManifestData || null) as Record<string, unknown> | null
  const manifestEntities = Array.isArray(manifestPayload?.entities)
    ? manifestPayload.entities as ManifestEntity[]
    : []
  const canonicalEntities = await getCanonicalEntitiesSnapshot()

  const [control, activeRunsResponse, completedRunsResponse, dossiersResponse] = await Promise.all([
    readPipelineControlState(),
    supabase
      .from('entity_pipeline_runs')
      .select('entity_id, canonical_entity_id, entity_name, started_at, completed_at, metadata, phase, status')
      .in('status', ['queued', 'claiming', 'running', 'retrying'])
      .order('started_at', { ascending: false })
      .limit(8),
    supabase
      .from('entity_pipeline_runs')
      .select('entity_id, canonical_entity_id, entity_name, started_at, completed_at, metadata, phase, status')
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

  const runningEntities = await Promise.all(activeRuns.map(async (row, index) => ({
    ...toQueueRecord(row),
    ...(await buildCanonicalQueueEntity(row, canonicalEntities)),
    queue_position: index + 1,
  })))
  const inProgressEntity = runningEntities.length > 0 ? runningEntities[0] : null
  const completedEntities = dedupeByEntityId(await Promise.all(completedRuns.map(async (row) => ({
    ...toQueueRecord(row),
    ...(await buildCanonicalQueueEntity(row, canonicalEntities)),
  }))))

  const seenEntityIds = new Set(
    [inProgressEntity?.entity_id, ...completedEntities.map((item) => item.entity_id)].filter(Boolean) as string[],
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
      queue_position: index + 1,
      run_phase: 'queued',
    }))

  const blockedEntities = await Promise.all(dossierRows
    .filter((row) => inferQualityState(row.dossier_data) === 'blocked')
    .map(async (row) => ({
      ...toQueueRecord({
        entity_id: row.entity_id,
        canonical_entity_id: row.canonical_entity_id,
        entity_name: row.entity_name,
        entity_type: row.entity_type,
      }),
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
      next_repair_question_id: toText(extractQuestionFirstState(row.dossier_data).next_repair_question_id) || null,
      next_action: toText(extractQuestionFirstState(row.dossier_data).next_repair_question_id)
        ? `Repair question ${toText(extractQuestionFirstState(row.dossier_data).next_repair_question_id)}`
        : 'Rerun dossier',
    }))
  )
  const dedupedBlockedEntities = dedupeByEntityId(blockedEntities)
    .slice(0, 8)

  return NextResponse.json({
    control,
    loop_status: {
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
        running: runningEntities.length,
        stalled: 0,
        retryable: 0,
        resume_needed: 0,
      },
    },
    queue: {
      in_progress_entity: inProgressEntity,
      running_entities: runningEntities,
      completed_entities: completedEntities,
      resume_needed_entities: [],
      upcoming_entities: upcomingEntities,
    },
    dossier_quality: {
      incomplete_entities: dedupedBlockedEntities,
    },
  })
}
