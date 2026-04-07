import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
import { getCanonicalEntitiesSnapshot } from '@/lib/canonical-entities-snapshot'
import { normalizeImportedEntityRow } from '@/lib/entity-import-schema'
import {
  createEntityImportBatch,
  createEntityPipelineRuns,
  queueEntityImportBatch,
  storeFallbackEntityImportState,
} from '@/lib/entity-import-jobs'
import { matchesEntityUuid, resolveEntityUuid } from '@/lib/entity-public-id'

const ENTITY_IMPORT_QUEUE_MODE = process.env.ENTITY_IMPORT_QUEUE_MODE || 'durable_worker'

type ResolvedEntity = {
  id: string
  uuid?: string
  neo4j_id?: string | number | null
  labels?: string[] | null
  properties: Record<string, any>
}

function toStringValue(value: unknown, fallback: string): string {
  const normalized = String(value ?? '').trim()
  return normalized || fallback
}

function toNumberValue(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
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

  if (!canonicalMatch) {
    return null
  }

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

export async function queueDossierRefresh(entityId: string, trigger: string, rerunReason?: string | null) {
  const entity = await resolveEntityForDossierQueue(entityId)
  if (!entity) {
    throw new Error('Entity not found')
  }

  const row = toPipelineRow(entityId, entity)
  const batch = await createEntityImportBatch({
    filename: null,
    total_rows: 1,
    invalid_rows: 0,
    metadata: {
      source: trigger,
      queue_mode: ENTITY_IMPORT_QUEUE_MODE,
      rerun_reason: rerunReason || null,
    },
  })

  const runs = await createEntityPipelineRuns(batch.id, [row])
  await storeFallbackEntityImportState(batch, runs)
  await queueEntityImportBatch(batch.id, {
    queue_mode: ENTITY_IMPORT_QUEUE_MODE,
    queued_at: new Date().toISOString(),
    trigger,
    rerun_reason: rerunReason || null,
  })
  await markQueued(entity, entityId, batch.id)

  return {
    entity,
    batchId: batch.id,
    queuedAt: new Date().toISOString(),
    status: 'queued' as const,
  }
}
