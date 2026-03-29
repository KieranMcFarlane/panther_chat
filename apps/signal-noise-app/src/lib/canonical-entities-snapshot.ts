import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
import { canonicalizeEntities, type CanonicalEntity } from '@/lib/entity-canonicalization'

const SNAPSHOT_TTL_MS = 15 * 60_000

let canonicalEntitiesCache: { entities: CanonicalEntity[]; expiresAt: number } | null = null
let inFlightCanonicalEntitiesRequest: Promise<CanonicalEntity[]> | null = null
const localFalkorExportPath = path.resolve(process.cwd(), 'backend', 'falkordb_export.json')

function hasUsableSupabaseConfiguration(): boolean {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').trim()
  const key = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim()

  if (!url || !key) return false
  if (url.includes('example.supabase.co')) return false
  if (key.includes('development-anon-key')) return false

  return true
}

function normalizeLocalEntityId(entity: any): string {
  const properties = entity?.properties || {}
  return String(
    properties.supabase_id ||
    properties.neo4j_id ||
    entity?.id ||
    entity?.neo4j_id ||
    properties.name ||
    ''
  ).trim()
}

function normalizeBadgeUrl(entity: any): string | null {
  const properties = entity?.properties || {}
  return (
    entity?.badge_s3_url ||
    properties.badge_s3_url ||
    entity?.badge_path ||
    properties.badge_path ||
    properties.badge_url ||
    null
  )
}

async function fetchCanonicalEntitiesFromSupabase(): Promise<CanonicalEntity[]> {
  if (!hasUsableSupabaseConfiguration()) {
    throw new Error('Supabase configuration is not available in this environment')
  }

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

  return canonicalizeEntities(
    allEntities.map((entity: any) => ({
      id: entity.id,
      neo4j_id: entity.neo4j_id,
      badge_path: entity.badge_path || entity.properties?.badge_path || null,
      badge_s3_url: entity.badge_s3_url || entity.properties?.badge_s3_url || null,
      labels: entity.labels || [],
      properties: {
        ...entity.properties,
        name: entity.properties?.name || entity.neo4j_id,
        type: entity.properties?.type || entity.labels?.[0] || 'ENTITY',
      }
    }))
  )
}

async function fetchCanonicalEntitiesFromLocalExport(): Promise<CanonicalEntity[]> {
  const raw = await readFile(localFalkorExportPath, 'utf8')
  const payload = JSON.parse(raw) as { entities?: any[] }
  const exportEntities = Array.isArray(payload.entities) ? payload.entities : []

  return canonicalizeEntities(
    exportEntities.map((entity: any) => ({
      id: normalizeLocalEntityId(entity),
      neo4j_id: normalizeLocalEntityId(entity) || String(entity?.neo4j_id || ''),
      badge_path: entity?.badge_path || entity?.properties?.badge_path || null,
      badge_s3_url: normalizeBadgeUrl(entity),
      labels: entity?.labels || [],
      properties: {
        ...(entity?.properties || {}),
        name: entity?.properties?.name || entity?.name || entity?.neo4j_id || 'Unnamed entity',
        type: entity?.properties?.type || entity?.labels?.[0] || 'ENTITY',
      }
    }))
  )
}

export async function getCanonicalEntitiesSnapshot(): Promise<CanonicalEntity[]> {
  if (canonicalEntitiesCache && canonicalEntitiesCache.expiresAt > Date.now()) {
    return canonicalEntitiesCache.entities
  }

  if (inFlightCanonicalEntitiesRequest) {
    return inFlightCanonicalEntitiesRequest
  }

  inFlightCanonicalEntitiesRequest = fetchCanonicalEntitiesFromSupabase()

  try {
    const entities = await inFlightCanonicalEntitiesRequest
    if (!entities.length) {
      throw new Error('Supabase returned an empty canonical entity snapshot')
    }
    canonicalEntitiesCache = {
      entities,
      expiresAt: Date.now() + SNAPSHOT_TTL_MS,
    }
    return entities
  } catch (error) {
    console.warn('⚠️ Falling back to local Falkor export for canonical entities snapshot', error)
    const entities = await fetchCanonicalEntitiesFromLocalExport()
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
