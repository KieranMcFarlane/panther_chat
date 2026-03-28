import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'

const CACHE_TTL_MS = 60_000

let cachedUniverseCount: { count: number; expiresAt: number } | null = null
let inFlightUniverseCountRequest: Promise<number | null> | null = null

async function fetchNormalizedUniverseCount(): Promise<number | null> {
  const { count, error } = await supabase
    .from('cached_entities')
    .select('id', { count: 'exact', head: true })

  if (error) {
    console.warn('Failed to load normalized universe count from cached_entities:', error)
    return null
  }

  return typeof count === 'number' ? count : null
}

export async function getNormalizedUniverseCount(): Promise<number | null> {
  if (cachedUniverseCount && cachedUniverseCount.expiresAt > Date.now()) {
    return cachedUniverseCount.count
  }

  if (!inFlightUniverseCountRequest) {
    inFlightUniverseCountRequest = fetchNormalizedUniverseCount()
      .finally(() => {
        inFlightUniverseCountRequest = null
      })
  }

  const count = await inFlightUniverseCountRequest
  if (typeof count === 'number') {
    cachedUniverseCount = {
      count,
      expiresAt: Date.now() + CACHE_TTL_MS,
    }
  }
  return count
}
