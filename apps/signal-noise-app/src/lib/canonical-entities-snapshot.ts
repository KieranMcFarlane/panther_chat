import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
import { CANONICAL_GOVERNING_BODY_OVERRIDES } from '@/lib/canonical-governing-body-overrides'
import { canonicalizeEntities, type CanonicalEntity } from '@/lib/entity-canonicalization'
import { resolveEntityUuid } from '@/lib/entity-public-id'

const SNAPSHOT_TTL_MS = 15 * 60_000
const localFalkorExportPath = path.resolve(process.cwd(), 'backend', 'falkordb_export.json')
const hasUsableSupabaseConfiguration = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
) && Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)
const defaultSnapshotSource = (
  process.env.VERCEL
  || process.env.VERCEL_ENV
  || process.env.NODE_ENV === 'production'
) ? 'supabase' : 'local'
const preferSupabaseSnapshot = String(process.env.ENTITY_SNAPSHOT_SOURCE || defaultSnapshotSource).toLowerCase() === 'supabase'

let canonicalEntitiesCache: { entities: CanonicalEntity[]; expiresAt: number } | null = null
let inFlightCanonicalEntitiesRequest: Promise<CanonicalEntity[]> | null = null

function mapExportEntity(entity: any): CanonicalEntity {
  const uuid = resolveEntityUuid({
    id: entity.id,
    neo4j_id: entity.neo4j_id,
    graph_id: entity.graph_id,
    supabase_id: entity.supabase_id || entity.properties?.supabase_id,
    properties: entity.properties,
  }) || undefined

  return {
    id: entity.id,
    uuid,
    neo4j_id: entity.neo4j_id,
    badge_path: entity.badge_path || entity.properties?.badge_path || null,
    badge_s3_url: entity.badge_s3_url || entity.properties?.badge_s3_url || null,
    labels: entity.labels || [],
    properties: {
      ...entity.properties,
      name: entity.properties?.name || entity.neo4j_id,
      type: entity.properties?.type || entity.labels?.[0] || 'ENTITY',
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

  while (hasMore) {
    const { data, error } = await supabase
      .from('cached_entities')
      .select('*')
      .order('properties->>name', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error) {
      throw error
    }

    const pageEntities = data || []
    allEntities.push(...pageEntities)
    offset += pageSize
    hasMore = pageEntities.length === pageSize
  }

  return applyCanonicalOverrides(allEntities.map(mapExportEntity))
}

async function fetchCanonicalEntitiesFromLocalExport(): Promise<CanonicalEntity[]> {
  if (!existsSync(localFalkorExportPath)) {
    throw new Error(`Local Falkor export not found at ${localFalkorExportPath}`)
  }

  const fileContents = await readFile(localFalkorExportPath, 'utf8')
  const parsedExport = JSON.parse(fileContents) as { entities?: any[] }
  const exportEntities = Array.isArray(parsedExport.entities) ? parsedExport.entities : []

  return applyCanonicalOverrides(exportEntities.map(mapExportEntity))
}

async function fetchCanonicalEntitiesFromBestAvailableSource(): Promise<CanonicalEntity[]> {
  if (!hasUsableSupabaseConfiguration) {
    console.log('Supabase configuration is not available in this environment')
    console.log('Falling back to local Falkor export for canonical entities snapshot')
    return fetchCanonicalEntitiesFromLocalExport()
  }

  if (!preferSupabaseSnapshot && existsSync(localFalkorExportPath)) {
    console.log('Falling back to local Falkor export for canonical entities snapshot')
    try {
      return await fetchCanonicalEntitiesFromLocalExport()
    } catch (localExportError) {
      console.warn('⚠️ Failed to load local Falkor export, falling back to Supabase snapshot:', localExportError)
    }
  }

  try {
    return await fetchCanonicalEntitiesFromSupabase()
  } catch (supabaseError) {
    if (existsSync(localFalkorExportPath)) {
      console.log('Falling back to local Falkor export for canonical entities snapshot')
      return fetchCanonicalEntitiesFromLocalExport()
    }

    throw supabaseError
  }
}

export async function getCanonicalEntitiesSnapshot(): Promise<CanonicalEntity[]> {
  if (canonicalEntitiesCache && canonicalEntitiesCache.expiresAt > Date.now()) {
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
