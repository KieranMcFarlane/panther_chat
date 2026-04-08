import { NextRequest, NextResponse } from 'next/server'
import { resolveLocalBadgeUrl } from '@/lib/badge-resolver'
import { getCanonicalEntitiesSnapshot } from '@/lib/canonical-entities-snapshot'
import { resolveEntityUuid } from '@/lib/entity-public-id'

export const dynamic = 'force-dynamic';

type LightweightDossierIndex = {
  dossier_status: 'ready' | 'stale' | 'pending' | 'rerun_needed' | 'missing'
  latest_run_id: string | null
  latest_generated_at: string | null
  latest_dossier_path: string | null
  dossier_source: string
  dossier_summary: string | null
  review_status: string
  rerun_reason: string | null
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function buildLightweightDossierIndexFromEntityState(entity: any): LightweightDossierIndex {
  const properties = entity?.properties || {}
  const dossierStatus = toText(properties.dossier_status).toLowerCase()
  const pipelineStatus = toText(properties.last_pipeline_status).toLowerCase()

  const normalizedStatus: LightweightDossierIndex['dossier_status'] =
    dossierStatus === 'ready' || dossierStatus === 'stale' || dossierStatus === 'pending' || dossierStatus === 'rerun_needed'
      ? dossierStatus
      : dossierStatus === 'missing'
        ? 'missing'
        : ['queued', 'running', 'pending'].includes(pipelineStatus)
          ? 'pending'
          : 'missing'

  return {
    dossier_status: normalizedStatus,
    latest_run_id: toText(properties.latest_run_id || properties.last_pipeline_batch_id) || null,
    latest_generated_at: toText(properties.latest_generated_at || properties.generated_at || properties.dossier_generated_at) || null,
    latest_dossier_path: toText(properties.latest_dossier_path) || null,
    dossier_source: toText(properties.dossier_source) || (normalizedStatus === 'missing' ? 'missing' : 'entity_state'),
    dossier_summary: toText(properties.dossier_summary) || null,
    review_status: toText(properties.review_status) || 'resolved',
    rerun_reason: toText(properties.rerun_reason) || null,
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    let entityType = searchParams.get('entityType') || ''
    if (entityType === 'all') entityType = ''
    const sortBy = searchParams.get('sortBy') || 'name'
    const sortOrder = searchParams.get('sortOrder') || 'asc'
    const search = searchParams.get('search') || ''
    const sport = (searchParams.get('sport') || '').trim()
    const league = (searchParams.get('league') || '').trim()
    const country = (searchParams.get('country') || '').trim()
    const entityClass = (searchParams.get('entityClass') || '').trim()

    console.log(`📖 Fetching entities from Supabase: page=${page}, limit=${limit}, search=${search || 'none'}`)

    const canonicalEntities = await getCanonicalEntitiesSnapshot()
    console.log(`✅ Loaded canonical entity snapshot: ${canonicalEntities.length} entities`)

    const normalizedSearch = search.trim().toLowerCase()
    const normalizedSport = sport.toLowerCase()
    const normalizedLeague = league.toLowerCase()
    const normalizedCountry = country.toLowerCase()
    const normalizedEntityClass = entityClass.toLowerCase()
    const filteredEntities = canonicalEntities.filter((entity) => {
      const properties = entity.properties || {}
      const entityLabels = (entity.labels || []).map((label: string) => String(label).toLowerCase())
      const propType = String(properties.type || '').toLowerCase()
      const propEntityClass = String(properties.entityClass || properties.entity_class || '').toLowerCase()
      const propSport = String(properties.sport || '').toLowerCase()
      const propLeague = String(properties.league || '').toLowerCase()
      const propCountry = String(properties.country || '').toLowerCase()

      if (
        entityType &&
        entityType !== 'all' &&
        !entityLabels.includes(entityType.toLowerCase()) &&
        propType !== entityType.toLowerCase() &&
        propEntityClass !== entityType.toLowerCase()
      ) {
        return false
      }

      if (normalizedSport && propSport !== normalizedSport) {
        return false
      }

      if (normalizedLeague && propLeague !== normalizedLeague) {
        return false
      }

      if (normalizedCountry && propCountry !== normalizedCountry) {
        return false
      }

      if (normalizedEntityClass && propEntityClass !== normalizedEntityClass && propType !== normalizedEntityClass) {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      const haystack = [
        properties.name,
        properties.type,
        properties.sport,
        properties.country,
        properties.description,
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ')

      return haystack.includes(normalizedSearch)
    })

    const ascending = sortOrder.toLowerCase() !== 'desc'
    filteredEntities.sort((left, right) => {
      const leftName = String(left.properties?.name || '')
      const rightName = String(right.properties?.name || '')
      return ascending ? leftName.localeCompare(rightName) : rightName.localeCompare(leftName)
    })

    const total = filteredEntities.length
    const start = (page - 1) * limit
    const paginatedEntities = filteredEntities.slice(start, start + limit)

    const transformedEntities = paginatedEntities.map((entity: any) => {
      const entityName = entity.properties?.name || entity.neo4j_id
      const uuid = resolveEntityUuid({
        id: entity.id,
        neo4j_id: entity.neo4j_id,
        graph_id: entity.graph_id,
        supabase_id: entity.supabase_id || entity.properties?.supabase_id,
        properties: entity.properties,
      }) || undefined
      const lightweightDossierIndex = buildLightweightDossierIndexFromEntityState(entity)
      const resolvedBadgeUrl = resolveLocalBadgeUrl({
        entityId: entity.id ?? entity.neo4j_id,
        entityName,
        badgePath: entity.badge_path || entity.properties?.badge_path || null,
        badgeS3Url: entity.badge_s3_url || entity.properties?.badge_s3_url || null,
      })

      return {
        id: uuid || entity.id,
        uuid,
        neo4j_id: entity.neo4j_id,
        dossier_status: lightweightDossierIndex.dossier_status,
        latest_run_id: lightweightDossierIndex.latest_run_id,
        latest_generated_at: lightweightDossierIndex.latest_generated_at,
        latest_dossier_path: lightweightDossierIndex.latest_dossier_path,
        dossier_source: lightweightDossierIndex.dossier_source,
        dossier_summary: lightweightDossierIndex.dossier_summary,
        review_status: lightweightDossierIndex.review_status,
        rerun_reason: lightweightDossierIndex.rerun_reason,
        badge_s3_url: resolvedBadgeUrl,
        badge_lookup_complete: true,
        labels: entity.labels || [],
        properties: {
          ...entity.properties,
          badge_path: resolvedBadgeUrl,
          badge_s3_url: resolvedBadgeUrl,
          badge_lookup_complete: true,
          uuid,
          dossier_status: lightweightDossierIndex.dossier_status,
          latest_run_id: lightweightDossierIndex.latest_run_id,
          latest_generated_at: lightweightDossierIndex.latest_generated_at,
          latest_dossier_path: lightweightDossierIndex.latest_dossier_path,
          dossier_source: lightweightDossierIndex.dossier_source,
          dossier_summary: lightweightDossierIndex.dossier_summary,
          review_status: lightweightDossierIndex.review_status,
          rerun_reason: lightweightDossierIndex.rerun_reason,
          name: entityName,
          type: entity.properties?.type || entity.labels?.[0] || 'ENTITY'
        }
      }
    })

    return NextResponse.json({
      entities: transformedEntities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: start + limit < total,
        hasPrev: page > 1
      },
      filters: {
        entityType,
        sport,
        league,
        country,
        entityClass,
        sortBy,
        sortOrder
      },
      source: 'supabase'
    })

  } catch (error) {
    console.error('❌ Failed to fetch entities:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch entities' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate entity data against schema
    const requiredFields = ['entity_type', 'name', 'source'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Mock entity creation
    const newEntity = {
      entity_id: `ENTITY_${Date.now()}`,
      ...body,
      last_updated: new Date().toISOString(),
      vector_embedding: body.vector_embedding || [0.1, 0.2, 0.3]
    };

    return NextResponse.json({
      entity: newEntity,
      message: 'Entity created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating entity:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create entity' },
      { status: 500 }
    );
  }
}
