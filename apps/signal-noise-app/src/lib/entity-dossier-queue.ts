import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
import { getCanonicalEntitiesSnapshot } from '@/lib/canonical-entities-snapshot'
import { normalizeImportedEntityRow } from '@/lib/entity-import-schema'
import {
  createEntityImportBatch,
  createEntityPipelineRuns,
  findActivePipelineRunByEntityId,
  queueEntityImportBatch,
  storeFallbackEntityImportState,
} from '@/lib/entity-import-jobs'
import { matchesEntityUuid, resolveEntityUuid } from '@/lib/entity-public-id'
import { resolveCanonicalQuestionFirstDossier } from '@/lib/question-first-dossier'

const ENTITY_IMPORT_QUEUE_MODE = process.env.ENTITY_IMPORT_QUEUE_MODE || 'durable_worker'
const DEFAULT_REPAIR_RETRY_BUDGET = Number.parseInt(process.env.ENTITY_PIPELINE_REPAIR_RETRY_BUDGET || '3', 10) || 3

type ResolvedEntity = {
  id: string
  uuid?: string
  neo4j_id?: string | number | null
  labels?: string[] | null
  properties: Record<string, any>
}

export type DossierRefreshMode = 'full' | 'question'

export type DossierRefreshOptions = {
  rerunReason?: string | null
  mode?: DossierRefreshMode
  questionId?: string | null
  cascadeDependents?: boolean
  repairSourceRunId?: string | null
  repairSourceRunPath?: string | null
  repairSourceDossierPath?: string | null
}

function toStringValue(value: unknown, fallback: string): string {
  const normalized = String(value ?? '').trim()
  return normalized || fallback
}

function toNumberValue(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function hasLiveLease(metadata: Record<string, unknown>, runStartedAt?: string | null): boolean {
  const leaseExpiresAt = String(metadata.lease_expires_at ?? '').trim()
  if (leaseExpiresAt) {
    const leaseExpiry = new Date(String(metadata.lease_expires_at)).getTime()
    if (Number.isFinite(leaseExpiry)) {
      return leaseExpiry > Date.now()
    }
  }

  const startedAtMs = runStartedAt ? new Date(runStartedAt).getTime() : Number.NaN
  if (Number.isFinite(startedAtMs)) {
    return startedAtMs > Date.now() - (5 * 60 * 1000)
  }

  return true
}

export async function resolveEntityForDossierQueue(entityId: string): Promise<ResolvedEntity | null> {
  const normalizedId = String(entityId || '').trim()
  if (!normalizedId) {
    return null
  }

  const parsedId = Number.parseInt(normalizedId, 10)
  const idFilters = [`id.eq.${normalizedId}`, `neo4j_id.eq.${normalizedId}`]
  if (Number.isFinite(parsedId)) {
    idFilters.push(`neo4j_id.eq.${parsedId}`)
  }

  const directResult = await supabase
    .from('cached_entities')
    .select('id, neo4j_id, labels, properties')
    .or(idFilters.join(','))
    .limit(1)
    .maybeSingle()

  if (directResult.data) {
    return {
      id: String(directResult.data.id ?? normalizedId),
      uuid: resolveEntityUuid({
        id: directResult.data.id,
        neo4j_id: directResult.data.neo4j_id,
        graph_id: directResult.data.graph_id,
        supabase_id: directResult.data.supabase_id || directResult.data.properties?.supabase_id,
        properties: directResult.data.properties,
      }) || undefined,
      neo4j_id: directResult.data.neo4j_id,
      labels: directResult.data.labels,
      properties: typeof directResult.data.properties === 'object' && directResult.data.properties !== null
        ? directResult.data.properties
        : {},
    }
  }

  const normalizedName = normalizedId
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .replace(/%26/g, '&')
    .trim()

  const canonicalEntities = await getCanonicalEntitiesSnapshot()
  const canonicalMatch = canonicalEntities.find((candidate) =>
    matchesEntityUuid(candidate, normalizedId) ||
    String(candidate.id || '') === normalizedId ||
    String(candidate.neo4j_id || '') === normalizedId ||
    String(candidate.properties?.name || '').trim().toLowerCase() === normalizedName.toLowerCase(),
  )

  if (canonicalMatch) {
    return {
      id: String(canonicalMatch.id),
      uuid: resolveEntityUuid(canonicalMatch) || undefined,
      neo4j_id: canonicalMatch.neo4j_id,
      labels: canonicalMatch.labels,
      properties: typeof canonicalMatch.properties === 'object' && canonicalMatch.properties !== null
        ? canonicalMatch.properties
        : {},
    }
  }

  const canonicalQuestionFirst = await resolveCanonicalQuestionFirstDossier(normalizedId, null)
  if (!canonicalQuestionFirst.dossier) {
    return null
  }

  const dossier = canonicalQuestionFirst.dossier
  return {
    id: String(dossier.entity_id ?? normalizedId),
    uuid: resolveEntityUuid({
      id: dossier.entity_id ?? normalizedId,
      neo4j_id: dossier.entity_id ?? normalizedId,
      supabase_id: dossier.entity_id ?? normalizedId,
      properties: {
        name: dossier.entity_name ?? normalizedName,
        type: dossier.entity_type ?? 'ENTITY',
      },
    }) || undefined,
    neo4j_id: dossier.entity_id ?? normalizedId,
    labels: [dossier.entity_type ?? 'ENTITY'],
    properties: {
      name: dossier.entity_name ?? normalizedName,
      type: dossier.entity_type ?? 'ENTITY',
      sport: dossier.sport ?? 'Unknown',
      dossier_data: JSON.stringify(dossier),
    },
  }
}

function toPipelineRow(entityId: string, entity: ResolvedEntity) {
  const input = {
    name: toStringValue(entity.properties?.name, entityId),
    entity_type: toStringValue(entity.properties?.type, entity.labels?.[0] || 'ORG'),
    sport: toStringValue(entity.properties?.sport, 'Unknown'),
    country: toStringValue(entity.properties?.country, 'Unknown'),
    source: 'entity_browser_dossier_autoqueue',
    external_id: String(entity.neo4j_id ?? entity.id ?? entityId),
    website: toStringValue(entity.properties?.website, ''),
    league: toStringValue(entity.properties?.league_name ?? entity.properties?.league, ''),
    priority_score: toNumberValue(
      entity.properties?.priority_score ?? entity.properties?.priority,
      50,
    ),
  }

  const normalized = normalizeImportedEntityRow(input)
  if (!normalized.valid || !normalized.row) {
    throw new Error(`Unable to normalize entity for pipeline queue: ${normalized.errors.join('; ')}`)
  }

  return {
    ...normalized.row,
    entity_id: entityId,
  }
}

async function markQueued(entity: ResolvedEntity, entityId: string, batchId: string) {
  const nowIso = new Date().toISOString()
  const properties = {
    ...(entity.properties ?? {}),
    dossier_autoqueue_requested_at: entity.properties?.dossier_autoqueue_requested_at || nowIso,
    dossier_autoqueue_batch_id: batchId,
    dossier_autoqueue_request_count: toNumberValue(entity.properties?.dossier_autoqueue_request_count, 0) + 1,
    last_pipeline_batch_id: batchId,
    last_pipeline_run_detail_url: `/entity-import/${batchId}/${entityId}`,
    last_pipeline_status: 'queued',
    last_pipeline_run_at: nowIso,
  }

  await supabase
    .from('cached_entities')
    .update({ properties })
    .eq('id', entity.id)
}

export async function queueDossierRefresh(entityId: string, trigger: string, options: DossierRefreshOptions = {}) {
  const entity = await resolveEntityForDossierQueue(entityId)
  if (!entity) {
    throw new Error('Entity not found')
  }

  const rerunMode: DossierRefreshMode = options.mode === 'question' ? 'question' : 'full'
  const questionId = typeof options.questionId === 'string' ? options.questionId.trim() : ''
  const cascadeDependents = options.cascadeDependents !== false
  const rerunReason = typeof options.rerunReason === 'string' ? options.rerunReason.trim() : null
  const repairMetadata = rerunMode === 'question'
      ? {
        rerun_mode: 'question',
        question_id: questionId || null,
        cascade_dependents: cascadeDependents,
        repair_queue_source: 'manual',
        repair_state: 'queued',
        repair_retry_count: 0,
        repair_retry_budget: DEFAULT_REPAIR_RETRY_BUDGET,
        next_repair_question_id: questionId || null,
        reconciliation_state: 'healthy',
        repair_source_run_id: options.repairSourceRunId || null,
        repair_source_run_path: options.repairSourceRunPath || null,
        repair_source_dossier_path: options.repairSourceDossierPath || null,
      }
    : {
        rerun_mode: 'full',
        repair_queue_source: 'manual',
      }
  const row = {
    ...toPipelineRow(entityId, entity),
    pipeline_metadata: repairMetadata,
  }
  const activeRunState = await findActivePipelineRunByEntityId(entityId)
  const activeRunMetadata = typeof activeRunState.run?.metadata === 'object' && activeRunState.run?.metadata !== null
    ? activeRunState.run.metadata as Record<string, unknown>
    : {}
  const activeBatchStillActive = activeRunState.batch
    ? !['completed', 'failed'].includes(String(activeRunState.batch.status || '').trim().toLowerCase())
    : true
  const activeRunStillLeased = activeRunState.run
    ? hasLiveLease(activeRunMetadata, activeRunState.run.started_at ?? activeRunState.batch?.started_at ?? null)
    : false
  const isSameRepairRequest =
    activeRunState.run
    && activeBatchStillActive
    && activeRunStillLeased
    && String(activeRunMetadata.rerun_mode ?? 'full') === repairMetadata.rerun_mode
    && String(activeRunMetadata.question_id ?? '') === String(repairMetadata.question_id ?? '')
    && Boolean(activeRunMetadata.cascade_dependents ?? true) === Boolean(repairMetadata.cascade_dependents ?? true)

  if (isSameRepairRequest) {
    return {
      entity,
      batchId: activeRunState.run.batch_id,
      queuedAt: String(activeRunState.batch?.started_at ?? activeRunState.run.started_at ?? new Date().toISOString()),
      status: activeRunState.run.status as 'queued' | 'claiming' | 'running' | 'retrying',
      reusedBatch: true,
      reusedBatchId: activeRunState.run.batch_id,
    }
  }

  const batch = await createEntityImportBatch({
    filename: null,
    total_rows: 1,
    invalid_rows: 0,
    metadata: {
      source: trigger,
      queue_mode: ENTITY_IMPORT_QUEUE_MODE,
      rerun_reason: rerunReason || null,
      ...repairMetadata,
    },
  })

  const runs = await createEntityPipelineRuns(batch.id, [row])
  await storeFallbackEntityImportState(batch, runs)
  await queueEntityImportBatch(batch.id, {
    queue_mode: ENTITY_IMPORT_QUEUE_MODE,
    queued_at: new Date().toISOString(),
    trigger,
    rerun_reason: rerunReason || null,
    ...repairMetadata,
  })
  await markQueued(entity, entityId, batch.id)

  return {
    entity,
    batchId: batch.id,
    queuedAt: new Date().toISOString(),
    status: 'queued' as const,
    reusedBatch: false,
    reusedBatchId: null,
  }
}
