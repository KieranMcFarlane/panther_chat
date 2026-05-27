import { getSupabaseAdmin } from '@/lib/supabase-client'
import { resolveLocalBadgeUrl } from '@/lib/badge-resolver'
import { getCanonicalEntityRole } from '@/lib/entity-role-taxonomy'
import { resolveEntityUuid } from '@/lib/entity-public-id'
import { buildEntitiesTaxonomy } from '@/lib/entities-taxonomy'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export type EntityBrowserFilters = {
  entityType: string
  sport: string
  league: string
  country: string
  entityClass: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
  limit: string
}

export type EntityBrowserResponse = {
  entities: any[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
  filters: {
    entityType: string
    sport?: string
    league?: string
    country?: string
    entityClass?: string
    sortBy: string
    sortOrder: string
  }
  source: string
}

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

function normalizeFilterValue(value: string): string {
  const normalized = value.trim().toLowerCase()
  return normalized === 'all' ? '' : normalized
}

function buildLightweightDossierIndexFromEntityState(entity: any): LightweightDossierIndex {
  const properties = entity?.properties || {}
  const dossierStatus = toText(properties.dossier_status).toLowerCase()
  const pipelineStatus = toText(properties.last_pipeline_status).toLowerCase()
  const hasPersistedDossierArtifact = Boolean(toText(properties.latest_dossier_path))

  const normalizedStatus: LightweightDossierIndex['dossier_status'] =
    hasPersistedDossierArtifact && (dossierStatus === 'ready' || dossierStatus === 'stale' || dossierStatus === 'pending' || dossierStatus === 'rerun_needed')
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

const CANONICAL_ENTITY_COLUMNS = 'id, name, entity_type, sport, league, country, canonical_key, badge_path, badge_s3_url, labels, properties, source_neo4j_ids, source_graph_ids, source_entity_ids'
const FILE_ENTITY_SNAPSHOT_PATH = path.join(process.cwd(), 'data', 'all_entities_flat.json')

let fileEntitySnapshotCache: any[] | null = null

function mapDbRowToCanonicalEntity(row: any) {
  const properties = row.properties || {}
  const sourceNeo4jId = Array.isArray(row.source_neo4j_ids) && row.source_neo4j_ids.length > 0
    ? row.source_neo4j_ids[0]
    : Array.isArray(row.source_graph_ids) && row.source_graph_ids.length > 0
      ? row.source_graph_ids[0]
      : Array.isArray(row.source_entity_ids) && row.source_entity_ids.length > 0
        ? row.source_entity_ids[0]
        : row.id

  return {
    id: row.id,
    uuid: row.id,
    neo4j_id: sourceNeo4jId,
    badge_path: row.badge_path || properties.badge_path || null,
    badge_s3_url: row.badge_s3_url || properties.badge_s3_url || null,
    labels: row.labels || [],
    properties: {
      ...properties,
      name: row.name || properties.name || row.id,
      type: row.entity_type || properties.type || row.labels?.[0] || 'ENTITY',
      sport: row.sport || properties.sport || '',
      league: row.league || properties.league || '',
      country: row.country || properties.country || '',
      canonical_key: row.canonical_key || properties.canonical_key || '',
    },
  }
}

async function loadFileBackedCanonicalRows() {
  if (!fileEntitySnapshotCache) {
    const raw = await readFile(FILE_ENTITY_SNAPSHOT_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    fileEntitySnapshotCache = Array.isArray(parsed) ? parsed : []
  }

  return fileEntitySnapshotCache.map((entity) => {
    const id = toText(entity.entity_id || entity.id || entity.name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    const entityType = toText(entity.org_type || entity.entity_type || entity.type || 'organization')
    return {
      id,
      name: toText(entity.name || entity.entity_name || id),
      entity_type: entityType,
      sport: toText(entity.sport),
      league: toText(entity.league || entity.league_or_competition),
      country: toText(entity.country),
      canonical_key: id,
      badge_path: null,
      badge_s3_url: null,
      labels: [entityType || 'ENTITY'],
      properties: {
        ...entity,
        type: entityType || 'ENTITY',
        league: toText(entity.league || entity.league_or_competition),
      },
      source_neo4j_ids: [id],
      source_graph_ids: [],
      source_entity_ids: [id],
    }
  })
}

async function getFileBackedEntityBrowserPageData(options: {
  page: number
  limit: number
  entityType: string
  sport: string
  league: string
  country: string
  entityClass: string
  search: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
  originalFilters: EntityBrowserFilters
}): Promise<EntityBrowserResponse> {
  const rows = await loadFileBackedCanonicalRows()
  const search = options.search.trim().toLowerCase()
  const canonicalEntities = rows
    .map(mapDbRowToCanonicalEntity)
    .filter((entity) => {
      const properties = entity.properties
      if (options.entityType && !toText(properties.type).toLowerCase().includes(options.entityType)) return false
      if (options.sport && !toText(properties.sport).toLowerCase().includes(options.sport)) return false
      if (options.country && !toText(properties.country).toLowerCase().includes(options.country)) return false
      if (options.league && !toText(properties.league).toLowerCase().includes(options.league)) return false
      if (options.entityClass && !matchesEntityClassFilter(entity, options.entityClass)) return false
      if (!search) return true
      return [properties.name, properties.type, properties.sport, properties.country, properties.league]
        .some((value) => toText(value).toLowerCase().includes(search))
    })
    .sort((a, b) => {
      const left = toText(a.properties.name).localeCompare(toText(b.properties.name))
      return options.sortOrder === 'desc' ? -left : left
    })

  const start = (options.page - 1) * options.limit
  const paginatedEntities = canonicalEntities.slice(start, start + options.limit)
  const total = canonicalEntities.length

  return {
    entities: paginatedEntities.map(mapCanonicalEntityToResponse),
    pagination: {
      page: options.page,
      limit: options.limit,
      total,
      totalPages: Math.ceil(total / options.limit),
      hasNext: start + options.limit < total,
      hasPrev: options.page > 1,
    },
    filters: {
      entityType: options.entityType || options.originalFilters.entityType,
      sport: options.sport || undefined,
      league: options.league || undefined,
      country: options.country || undefined,
      entityClass: options.entityClass || undefined,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
    },
    source: 'file_snapshot',
  }
}

function matchesEntityClassFilter(canonicalEntity: ReturnType<typeof mapDbRowToCanonicalEntity>, entityClass: string): boolean {
  const role = getCanonicalEntityRole(canonicalEntity).toLowerCase()
  const propEntityClass = String(canonicalEntity.properties.entityClass || canonicalEntity.properties.entity_class || '').toLowerCase()
  const propType = String(canonicalEntity.properties.type || '').toLowerCase()
  return role === entityClass || propEntityClass === entityClass || propType === entityClass
}

function mapCanonicalEntityToResponse(canonical: ReturnType<typeof mapDbRowToCanonicalEntity>) {
  const entityName = canonical.properties.name
  const canonicalEntityRole = getCanonicalEntityRole(canonical)
  const uuid = resolveEntityUuid(canonical) || undefined
  const lightweightDossierIndex = buildLightweightDossierIndexFromEntityState(canonical)
  const resolvedBadgeUrl = resolveLocalBadgeUrl({
    entityId: canonical.id,
    entityName,
    badgePath: canonical.badge_path,
    badgeS3Url: canonical.badge_s3_url,
  })

  return {
    id: uuid || canonical.id,
    uuid,
    neo4j_id: canonical.neo4j_id,
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
    labels: canonical.labels,
    properties: {
      ...canonical.properties,
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
      type: canonical.properties.type,
      entity_role: canonicalEntityRole,
    },
  }
}

export async function getEntityBrowserPageData(options: {
  page: number
  search: string
  filters: EntityBrowserFilters
}): Promise<EntityBrowserResponse> {
  const { page, search, filters } = options
  const limit = Number.parseInt(filters.limit || '20', 10)
  const entityType = normalizeFilterValue(filters.entityType || '')
  const sortBy = filters.sortBy || 'name'
  const sortOrder = filters.sortOrder || 'asc'
  const sport = normalizeFilterValue(filters.sport || '')
  const league = normalizeFilterValue(filters.league || '')
  const country = normalizeFilterValue(filters.country || '')
  const entityClass = normalizeFilterValue(filters.entityClass || '')

  const supabase = getSupabaseAdmin()

  // Build base query with DB-pushable filters
  let query = supabase
    .from('canonical_entities')
    .select(CANONICAL_ENTITY_COLUMNS, { count: 'exact' })

  if (entityType) {
    query = query.ilike('entity_type', entityType)
  }
  if (sport) {
    query = query.ilike('sport', sport)
  }
  if (country) {
    query = query.ilike('country', country)
  }
  if (league) {
    query = query.ilike('league', league)
  }
  if (search.trim()) {
    const s = search.trim()
    query = query.or(`name.ilike.%${s}%,entity_type.ilike.%${s}%,sport.ilike.%${s}%,country.ilike.%${s}%`)
  }

  const ascending = sortOrder.toLowerCase() !== 'desc'
  query = query.order('name', { ascending })

  const start = (page - 1) * limit
  const fallbackOptions = {
    page,
    limit,
    entityType,
    sport,
    league,
    country,
    entityClass,
    search,
    sortBy,
    sortOrder,
    originalFilters: filters,
  }

  // entityClass requires in-memory role matching (complex pattern detection)
  // When active, fetch all DB-filtered rows and filter/paginate in memory
  if (entityClass) {
    const { data, error } = await query
    if (error) return getFileBackedEntityBrowserPageData(fallbackOptions)

    const allFiltered = (data || [])
      .map(mapDbRowToCanonicalEntity)
      .filter(entity => matchesEntityClassFilter(entity, entityClass))

    const total = allFiltered.length
    const paginatedEntities = allFiltered.slice(start, start + limit)

    return {
      entities: paginatedEntities.map(mapCanonicalEntityToResponse),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: start + limit < total,
        hasPrev: page > 1,
      },
      filters: {
        entityType: entityType || filters.entityType,
        sport: sport || undefined,
        league: league || undefined,
        country: country || undefined,
        entityClass: entityClass || undefined,
        sortBy,
        sortOrder,
      },
      source: 'supabase',
    }
  }

  // Pure DB pagination (no entityClass filter)
  query = query.range(start, start + limit - 1)
  const { data, error, count } = await query
  if (error) return getFileBackedEntityBrowserPageData(fallbackOptions)

  const total = count || 0

  return {
    entities: (data || []).map(row => mapCanonicalEntityToResponse(mapDbRowToCanonicalEntity(row))),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: start + limit < total,
      hasPrev: page > 1,
    },
    filters: {
      entityType: entityType || filters.entityType,
      sport: sport || undefined,
      league: league || undefined,
      country: country || undefined,
      entityClass: entityClass || undefined,
      sortBy,
      sortOrder,
    },
    source: 'supabase',
  }
}

export async function getEntitiesTaxonomyData() {
  const startedAt = Date.now()
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from('canonical_entities')
    .select('name, entity_type, sport, country, league, labels, properties')

  if (error) {
    const mappedEntities = (await loadFileBackedCanonicalRows()).map(mapDbRowToCanonicalEntity)

    return buildEntitiesTaxonomy(mappedEntities, {
      source: 'file_snapshot',
      latencyMs: Date.now() - startedAt,
    })
  }

  const mappedEntities = (data || []).map(mapDbRowToCanonicalEntity)

  return buildEntitiesTaxonomy(mappedEntities, {
    source: 'supabase_direct',
    latencyMs: Date.now() - startedAt,
  })
}
