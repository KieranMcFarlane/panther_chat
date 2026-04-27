import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { getSupabaseAdmin } from '@/lib/supabase-client'
import { query as queryPostgres } from '@/lib/pg-client'
import { CANONICAL_GOVERNING_BODY_OVERRIDES } from '@/lib/canonical-governing-body-overrides'
import { canonicalizeEntities, type CanonicalEntity } from '@/lib/entity-canonicalization'
import { loadQuestionFirstScaleManifest } from '@/lib/question-first-manifest'

const scaleManifestData = loadQuestionFirstScaleManifest()

const SNAPSHOT_TTL_MS = 15 * 60_000
const localFalkorExportPath = path.resolve(process.cwd(), 'backend', 'falkordb_export.json')
const canonicalEntitySelectColumns = 'id, name, entity_type, sport, league, country, canonical_key, badge_path, badge_s3_url, labels, properties, source_neo4j_ids, source_graph_ids, source_entity_ids, priority_score, quality_score, alias_count, entity_category, league_canonical_entity_id, parent_canonical_entity_id'
const canonicalEntitiesInvalidationPath = path.resolve(process.cwd(), 'tmp', 'canonical-entities-cache.invalidated.json')
const hasUsableSupabaseConfiguration = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
) && Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)
const defaultSnapshotSource = (
  process.env.VERCEL
  || process.env.VERCEL_ENV
  || process.env.NODE_ENV === 'production'
) ? 'supabase' : 'local'
const preferSupabaseSnapshot = String(process.env.ENTITY_SNAPSHOT_SOURCE || defaultSnapshotSource).toLowerCase() === 'supabase'

let canonicalEntitiesCache: { entities: CanonicalEntity[]; expiresAt: number; invalidatedAt: number } | null = null
let inFlightCanonicalEntitiesRequest: Promise<CanonicalEntity[]> | null = null

function mapCanonicalEntityRow(entity: any): CanonicalEntity {
  const sourceNeo4jId = Array.isArray(entity.source_neo4j_ids) && entity.source_neo4j_ids.length > 0
    ? entity.source_neo4j_ids[0]
    : Array.isArray(entity.source_graph_ids) && entity.source_graph_ids.length > 0
      ? entity.source_graph_ids[0]
      : Array.isArray(entity.source_entity_ids) && entity.source_entity_ids.length > 0
        ? entity.source_entity_ids[0]
        : entity.id

  return {
    id: entity.id,
    uuid: entity.id,
    neo4j_id: sourceNeo4jId,
    badge_path: entity.badge_path || entity.properties?.badge_path || null,
    badge_s3_url: entity.badge_s3_url || entity.properties?.badge_s3_url || null,
    labels: entity.labels || [],
    properties: {
      ...entity.properties,
      name: entity.name || entity.properties?.name || entity.id,
      type: entity.entity_type || entity.properties?.type || entity.labels?.[0] || 'ENTITY',
      sport: entity.sport || entity.properties?.sport || '',
      league: entity.league || entity.properties?.league || '',
      country: entity.country || entity.properties?.country || '',
      canonical_key: entity.canonical_key || entity.properties?.canonical_key || '',
      priority_score: entity.priority_score || entity.properties?.priority_score || 0,
      quality_score: entity.quality_score || entity.properties?.quality_score || 0,
      alias_count: entity.alias_count || entity.properties?.alias_count || 0,
      entity_category: entity.entity_category || entity.properties?.entity_category || '',
      league_canonical_entity_id: entity.league_canonical_entity_id || entity.properties?.league_canonical_entity_id || '',
      parent_canonical_entity_id: entity.parent_canonical_entity_id || entity.properties?.parent_canonical_entity_id || '',
    },
  }
}

function applyCanonicalOverrides(entities: CanonicalEntity[]): CanonicalEntity[] {
  return canonicalizeEntities([...entities, ...CANONICAL_GOVERNING_BODY_OVERRIDES])
}

async function fetchCanonicalEntitiesFromSupabase(): Promise<CanonicalEntity[]> {
  const allEntities: any[] = []
  let offset = 0
  let hasMore = true
  const pageSize = 1000
  const supabase = getSupabaseAdmin()

  while (hasMore) {
    const { data, error } = await supabase
      .from('canonical_entities')
      .select(canonicalEntitySelectColumns)
      .order('name', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error) {
      throw error
    }

    const pageEntities = data || []
    allEntities.push(...pageEntities)
    offset += pageSize
    hasMore = pageEntities.length === pageSize
  }

  return applyCanonicalOverrides(allEntities.map(mapCanonicalEntityRow))
}

async function fetchCanonicalEntitiesFromLocalExport(): Promise<CanonicalEntity[]> {
  if (!existsSync(localFalkorExportPath)) {
    throw new Error(`Local Falkor export not found at ${localFalkorExportPath}`)
  }

  const fileContents = await readFile(localFalkorExportPath, 'utf8')
  const parsedExport = JSON.parse(fileContents) as { entities?: any[] }
  const exportEntities = Array.isArray(parsedExport.entities) ? parsedExport.entities : []

  return applyCanonicalOverrides(exportEntities.map(mapCanonicalEntityRow))
}

async function fetchCanonicalEntitiesFromLocalPostgres(): Promise<CanonicalEntity[]> {
  const { rows } = await queryPostgres(`
    select
      id,
      name,
      entity_type,
      sport,
      league,
      country,
      canonical_key,
      badge_path,
      badge_s3_url,
      labels,
      properties,
      source_neo4j_ids,
      source_graph_ids,
      source_entity_ids,
      priority_score,
      quality_score,
      alias_count,
      entity_category,
      league_canonical_entity_id,
      parent_canonical_entity_id
    from canonical_entities
    order by name asc
  `)

  return applyCanonicalOverrides((rows || []).map(mapCanonicalEntityRow))
}

function fetchCanonicalEntitiesFromBundledManifest(): CanonicalEntity[] {
  const manifestEntities = Array.isArray(scaleManifestData?.entities) ? scaleManifestData.entities : []
  return applyCanonicalOverrides(
    manifestEntities.map((entity: any) => ({
      id: entity.entity_id,
      uuid: entity.entity_uuid || entity.entity_id,
      neo4j_id: entity.entity_id,
      badge_path: null,
      badge_s3_url: null,
      labels: [String(entity.entity_type || 'ENTITY')],
      properties: {
        name: entity.entity_name || entity.entity_id,
        type: entity.entity_type || 'ENTITY',
        entityClass: entity.entity_type || 'ENTITY',
      },
    })),
  )
}

async function fetchCanonicalEntitiesFromBestAvailableSource(): Promise<CanonicalEntity[]> {
  if (!hasUsableSupabaseConfiguration) {
    console.log('Supabase configuration is not available in this environment')
    if (process.env.DATABASE_URL?.trim()) {
      console.log('Falling back to local Postgres for canonical entities snapshot')
      return fetchCanonicalEntitiesFromLocalPostgres()
    }
    if (existsSync(localFalkorExportPath)) {
      console.log('Falling back to local Falkor export for canonical entities snapshot')
      return fetchCanonicalEntitiesFromLocalExport()
    }
    console.log('Falling back to bundled manifest for canonical entities snapshot')
    return fetchCanonicalEntitiesFromBundledManifest()
  }

  if (!preferSupabaseSnapshot && existsSync(localFalkorExportPath)) {
    console.log('Falling back to local Falkor export for canonical entities snapshot')
    try {
      return await fetchCanonicalEntitiesFromLocalExport()
    } catch (localExportError) {
      console.warn('⚠️ Failed to load local Falkor export, falling back to Supabase snapshot:', localExportError)
    }
  }

  if (!preferSupabaseSnapshot && process.env.DATABASE_URL?.trim()) {
    console.log('Falling back to local Postgres for canonical entities snapshot')
    try {
      return await fetchCanonicalEntitiesFromLocalPostgres()
    } catch (localPostgresError) {
      console.warn('⚠️ Failed to load local Postgres snapshot, falling back to Supabase snapshot:', localPostgresError)
    }
  }

  try {
    return await fetchCanonicalEntitiesFromSupabase()
  } catch (supabaseError) {
    if (process.env.DATABASE_URL?.trim()) {
      console.log('Falling back to local Postgres for canonical entities snapshot')
      try {
        return await fetchCanonicalEntitiesFromLocalPostgres()
      } catch (localPostgresError) {
        console.warn('⚠️ Failed to load local Postgres snapshot, falling back to local Falkor export:', localPostgresError)
      }
    }
    if (existsSync(localFalkorExportPath)) {
      console.log('Falling back to local Falkor export for canonical entities snapshot')
      return fetchCanonicalEntitiesFromLocalExport()
    }

    console.warn('⚠️ Failed to load Supabase snapshot, falling back to bundled manifest:', supabaseError)
    return fetchCanonicalEntitiesFromBundledManifest()
  }
}

async function readCanonicalEntitiesInvalidationStamp(): Promise<number> {
  if (!existsSync(canonicalEntitiesInvalidationPath)) {
    return 0
  }

  try {
    const fileContents = await readFile(canonicalEntitiesInvalidationPath, 'utf8')
    const parsed = JSON.parse(fileContents) as { invalidated_at?: string }
    const invalidatedAt = Date.parse(String(parsed.invalidated_at || ''))
    return Number.isFinite(invalidatedAt) ? invalidatedAt : 0
  } catch {
    return 0
  }
}

export async function getCanonicalEntitiesSnapshot(): Promise<CanonicalEntity[]> {
  const invalidationStamp = await readCanonicalEntitiesInvalidationStamp()

  if (
    canonicalEntitiesCache
    && canonicalEntitiesCache.expiresAt > Date.now()
    && canonicalEntitiesCache.invalidatedAt >= invalidationStamp
  ) {
    return canonicalEntitiesCache.entities
  }

  if (inFlightCanonicalEntitiesRequest) {
    return inFlightCanonicalEntitiesRequest
  }

  inFlightCanonicalEntitiesRequest = fetchCanonicalEntitiesFromBestAvailableSource()

  try {
    const entities = await inFlightCanonicalEntitiesRequest
    canonicalEntitiesCache = {
      entities,
      expiresAt: Date.now() + SNAPSHOT_TTL_MS,
      invalidatedAt: invalidationStamp,
    }
    return entities
  } finally {
    inFlightCanonicalEntitiesRequest = null
  }
}

export async function prewarmCanonicalEntitiesSnapshot(): Promise<void> {
  await getCanonicalEntitiesSnapshot()
}

export function clearCanonicalEntitiesSnapshot(): void {
  canonicalEntitiesCache = null
}

export async function invalidateCanonicalEntitiesSnapshot(reason = 'manual'): Promise<void> {
  await mkdir(path.dirname(canonicalEntitiesInvalidationPath), { recursive: true })
  await writeFile(
    canonicalEntitiesInvalidationPath,
    JSON.stringify({
      invalidated_at: new Date().toISOString(),
      reason,
    }, null, 2) + '\n',
    'utf8',
  )
  clearCanonicalEntitiesSnapshot()
}
