export interface EntityGraphEpisode {
  id: string
  summary: string
  source: string
  source_url?: string | null
  source_domain?: string | null
  category: string
  relevance: number
  created_at: string
  entities: string[]
}

function deriveSourceDomain(sourceUrl: string | null | undefined): string | null {
  if (!sourceUrl) return null

  try {
    return new URL(sourceUrl).hostname || null
  } catch {
    return null
  }
}

export function mapGraphitiResultsToEpisodes(results: any[] | null | undefined): EntityGraphEpisode[] {
  if (!Array.isArray(results)) return []

  return results
    .map((item, index) => ({
      id: String(item?.uuid || item?.id || `graph-episode-${index + 1}`),
      summary: String(item?.fact || item?.summary || '').trim(),
      source: String(item?.source || 'Graphiti'),
      source_url: item?.source_url || item?.url || null,
      source_domain: deriveSourceDomain(item?.source_url || item?.url || null),
      category: String(item?.category || 'Unknown'),
      relevance: Number(item?.relevance || 0),
      created_at: String(item?.created_at || item?.timestamp || ''),
      entities: Array.isArray(item?.entities) ? item.entities.map((entity) => String(entity)) : [],
    }))
    .filter((episode) => episode.summary.length > 0)
    .sort((left, right) => {
      const rightTimestamp = Date.parse(right.created_at || '')
      const leftTimestamp = Date.parse(left.created_at || '')
      const safeRightTimestamp = Number.isFinite(rightTimestamp) ? rightTimestamp : 0
      const safeLeftTimestamp = Number.isFinite(leftTimestamp) ? leftTimestamp : 0

      if (safeRightTimestamp !== safeLeftTimestamp) {
        return safeRightTimestamp - safeLeftTimestamp
      }

      return (right.relevance || 0) - (left.relevance || 0)
    })
}

export async function getEntityGraphEpisodes(entityName: string, entityId?: string | null): Promise<EntityGraphEpisode[]> {
  const normalizedName = String(entityName || '').trim()
  if (!normalizedName) return []

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3005'
  const params = new URLSearchParams({
    query: normalizedName,
    num_results: '5',
  })

  if (entityId) {
    params.set('entity_id', String(entityId))
  }

  try {
    const response = await fetch(`${baseUrl}/api/graphiti?${params.toString()}`, {
      cache: 'no-store',
    })
    if (!response.ok) return []

    const payload = await response.json()
    return mapGraphitiResultsToEpisodes(payload?.results)
  } catch {
    return []
  }
}
