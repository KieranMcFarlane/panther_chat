import { NextRequest, NextResponse } from 'next/server'
import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
import { getCanonicalEntitiesSnapshot } from '@/lib/canonical-entities-snapshot'
import { normalizeImportedEntityRow } from '@/lib/entity-import-schema'
import { requireApiSession, UnauthorizedError } from '@/lib/server-auth'
import {
  createEntityImportBatch,
  createEntityPipelineRuns,
  findActivePipelineRunByEntityId,
  queueEntityImportBatch,
  storeFallbackEntityImportState,
} from '@/lib/entity-import-jobs'
import { getEntityBrowserDossierHref } from '@/lib/entity-routing'
import { matchesEntityUuid, resolveEntityUuid } from '@/lib/entity-public-id'
import {
  normalizeQuestionFirstDossier,
  resolveCanonicalQuestionFirstDossier,
} from '@/lib/question-first-dossier'

const ENTITY_IMPORT_QUEUE_MODE = process.env.ENTITY_IMPORT_QUEUE_MODE || 'durable_worker'

interface ResolvedEntity {
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

async function resolveEntity(entityId: string): Promise<ResolvedEntity | null> {
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

  if (!normalizedName) {
    return null
  }

  const nameResult = await supabase
    .from('cached_entities')
    .select('id, neo4j_id, labels, properties')
    .ilike('properties->>name', `%${normalizedName}%`)
    .limit(1)
    .maybeSingle()

  if (!nameResult.data) {
    const canonicalEntities = await getCanonicalEntitiesSnapshot()
    const canonicalMatch = canonicalEntities.find((candidate) =>
      matchesEntityUuid(candidate, normalizedId) ||
      String(candidate.id || '') === normalizedId ||
      String(candidate.neo4j_id || '') === normalizedId,
    )

    if (!canonicalMatch) {
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

  return {
    id: String(nameResult.data.id ?? normalizedId),
    uuid: resolveEntityUuid({
      id: nameResult.data.id,
      neo4j_id: nameResult.data.neo4j_id,
      graph_id: nameResult.data.graph_id,
      supabase_id: nameResult.data.supabase_id || nameResult.data.properties?.supabase_id,
      properties: nameResult.data.properties,
    }) || undefined,
    neo4j_id: nameResult.data.neo4j_id,
    labels: nameResult.data.labels,
    properties: typeof nameResult.data.properties === 'object' && nameResult.data.properties !== null
      ? nameResult.data.properties
      : {},
  }
}

async function getPersistedDossier(entityId: string, entity?: ResolvedEntity | null) {
  const candidateIds = [
    entityId,
    entity?.uuid ? String(entity.uuid) : null,
    entity?.id ? String(entity.id) : null,
    entity?.neo4j_id != null ? String(entity.neo4j_id) : null,
  ].filter((value, index, arr): value is string => Boolean(value) && arr.indexOf(value) === index)

  for (const candidateId of candidateIds) {
    const { data } = await supabase
      .from('entity_dossiers')
      .select('dossier_data, created_at, entity_id')
      .eq('entity_id', candidateId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data?.dossier_data && isCanonicalPersistedDossierCandidate(data.dossier_data)) {
      return data.dossier_data
    }
  }

  const entityName = String(entity?.properties?.name ?? '').trim()
  if (entityName) {
    const { data } = await supabase
      .from('entity_dossiers')
      .select('dossier_data, created_at, entity_id')
      .ilike('entity_name', entityName)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data?.dossier_data && isCanonicalPersistedDossierCandidate(data.dossier_data)) {
      return data.dossier_data
    }
  }

  return null
}

function isCanonicalPersistedDossierCandidate(dossier: unknown) {
  if (!dossier || typeof dossier !== 'object') {
    return false
  }

  const payload = dossier as Record<string, unknown>
  const mergedDossier = payload.merged_dossier && typeof payload.merged_dossier === 'object'
    ? payload.merged_dossier as Record<string, unknown>
    : null
  const questionFirst = payload.question_first && typeof payload.question_first === 'object'
    ? payload.question_first as Record<string, unknown>
    : mergedDossier?.question_first && typeof mergedDossier.question_first === 'object'
      ? mergedDossier.question_first as Record<string, unknown>
      : null
  const hasQuestionFirstAnswers = Boolean(
    questionFirst
    && Array.isArray(questionFirst.answers)
    && (questionFirst.answers as unknown[]).length > 0,
  )
  const hasTopLevelQuestions = (
    Array.isArray(payload.questions) && payload.questions.length > 0
  ) || (
    Array.isArray(mergedDossier?.questions) && mergedDossier.questions.length > 0
  )
  const hasIdentity = Boolean(String(payload.entity_name ?? mergedDossier?.entity_name ?? '').trim())
    && Boolean(String(payload.entity_id ?? mergedDossier?.entity_id ?? '').trim())

  return hasIdentity && (hasQuestionFirstAnswers || hasTopLevelQuestions)
}

async function getLatestRun(entityId: string) {
  const { data } = await supabase
    .from('entity_pipeline_runs')
    .select('batch_id, status, phase, completed_at, error_message')
    .eq('entity_id', entityId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ?? null
}

function buildQueuePayload(entityId: string, batchId: string, state: string, message: string) {
  return {
    entityId,
    batchId,
    status: state,
    statusUrl: `/api/entity-import/${batchId}`,
    runDetailUrl: `/entity-import/${batchId}/${entityId}`,
    dossierUrl: getEntityBrowserDossierHref(entityId, '1') || '/entity-browser',
    dossierApiUrl: `/api/entities/${entityId}/dossier`,
    message,
  }
}

function buildCanonicalDossierResponse(dossier: Record<string, any>, source: string) {
  return {
    success: true,
    persisted: true,
    source,
    dossier: {
      ...dossier,
      entity_id: dossier.entity_id,
      entity_name: dossier.entity_name,
      entity_type: dossier.entity_type,
      question_first: dossier.question_first,
      metadata: dossier.metadata,
      run_rollup: dossier.run_rollup,
      categories: dossier.categories,
      answers: dossier.answers,
      question_timings: dossier.question_timings,
      poi_graph: dossier.poi_graph,
      tabs: dossier.tabs,
      publish_status: dossier.publish_status,
      run_id: dossier.run_id,
      last_completed_question: dossier.last_completed_question,
      resume_from_question: dossier.resume_from_question,
      failure_reason: dossier.failure_reason,
      failure_category: dossier.failure_category,
      retryable: dossier.retryable,
      heartbeat_at: dossier.heartbeat_at,
      checkpoint_consistent: dossier.checkpoint_consistent,
      non_terminal_question_ids: dossier.non_terminal_question_ids,
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

async function markAutoQueued(entity: ResolvedEntity, entityId: string, batchId: string) {
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

async function queueRun(entityId: string, entity: ResolvedEntity) {
  const row = toPipelineRow(entityId, entity)

  const batch = await createEntityImportBatch({
    filename: null,
    total_rows: 1,
    invalid_rows: 0,
    metadata: {
      source: 'entity_dossier_autoqueue',
      queue_mode: ENTITY_IMPORT_QUEUE_MODE,
    },
  })

  const runs = await createEntityPipelineRuns(batch.id, [row])
  await storeFallbackEntityImportState(batch, runs)
  await queueEntityImportBatch(batch.id, {
    queue_mode: ENTITY_IMPORT_QUEUE_MODE,
    queued_at: new Date().toISOString(),
    trigger: 'entity_dossier_missing_persisted',
  })
  await markAutoQueued(entity, entityId, batch.id)

  return batch.id
}

async function handleRequest(entityId: string, forceQueue: boolean) {
  const entity = await resolveEntity(entityId)
  if (!entity) {
    return NextResponse.json({ error: 'Entity not found', entityId }, { status: 404 })
  }

  if (!forceQueue) {
    const persisted = await getPersistedDossier(entityId, entity)
    if (persisted) {
      const dossier = normalizeQuestionFirstDossier(persisted, entityId, entity)
      return NextResponse.json(buildCanonicalDossierResponse(dossier, 'supabase_persisted_dossier'))
    }

    const canonicalQuestionFirst = await resolveCanonicalQuestionFirstDossier(entityId, entity)
    if (canonicalQuestionFirst.dossier) {
      return NextResponse.json(buildCanonicalDossierResponse(canonicalQuestionFirst.dossier, canonicalQuestionFirst.source))
    }
  }

  const activeRun = await findActivePipelineRunByEntityId(entityId)
  if (activeRun.run && activeRun.batch) {
    return NextResponse.json(
      buildQueuePayload(entityId, activeRun.batch.id, 'running', 'Dossier pipeline already queued or running'),
      { status: 202 },
    )
  }

  const autoQueueAlreadyRequested = Boolean(entity.properties?.dossier_autoqueue_requested_at)
  if (!forceQueue && autoQueueAlreadyRequested) {
    const latestRun = await getLatestRun(entityId)
    if (latestRun?.batch_id) {
      return NextResponse.json(
        buildQueuePayload(
          entityId,
          latestRun.batch_id,
          latestRun.status || 'pending',
          'Dossier auto-queue already requested for this entity',
        ),
        { status: 202 },
      )
    }

    return NextResponse.json(
      {
        entityId,
        status: 'pending',
        message: 'Dossier auto-queue already requested for this entity',
      },
      { status: 202 },
    )
  }

  const batchId = await queueRun(entityId, entity)
  return NextResponse.json(
    buildQueuePayload(entityId, batchId, 'queued', 'Dossier pipeline queued'),
    { status: 202 },
  )
}

export async function GET(
  request: NextRequest,
  { params }: { params: { entityId: string } },
) {
  try {
    await requireApiSession(request)
    return await handleRequest(params.entityId, false)
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch dossier' },
      { status: 500 },
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { entityId: string } },
) {
  try {
    await requireApiSession(request)
    return await handleRequest(params.entityId, true)
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to queue dossier pipeline' },
      { status: 500 },
    )
  }
}
