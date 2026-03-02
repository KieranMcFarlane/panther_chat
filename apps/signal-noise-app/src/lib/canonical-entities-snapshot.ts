import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
import { canonicalizeEntities, type CanonicalEntity } from '@/lib/entity-canonicalization'

const SNAPSHOT_TTL_MS = 15 * 60_000

let canonicalEntitiesCache: { entities: CanonicalEntity[]; expiresAt: number } | null = null
let inFlightCanonicalEntitiesRequest: Promise<CanonicalEntity[]> | null = null

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
