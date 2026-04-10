import type { VectorSearchRequest, VectorSearchResponse } from './vector-search-client'

export type LegacySearchResult = {
  entity: {
    id: string
    labels: string[]
    properties: Record<string, any>
  }
  similarity: number
  connections: Array<{
    relationship: string
    target: string
    target_type: string
  }>
}

export type LegacySearchResponse = {
  results: LegacySearchResult[]
  searchType: string
  query: string
  options: Record<string, any>
  total?: number
  search_strategy?: string
}

export async function searchVectorEntities(
  request: VectorSearchRequest,
  options: { baseUrl?: string; signal?: AbortSignal } = {}
): Promise<VectorSearchResponse> {
  const baseUrl = options.baseUrl || process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'http://127.0.0.1:3000'
  const endpoint = new URL('/api/vector-search', baseUrl)

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
    signal: options.signal,
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error(`Vector search failed with status ${response.status}`)
  }

  return response.json()
}

export function toLegacySearchResponse(
  response: VectorSearchResponse,
  searchType = 'vector',
  options: Record<string, any> = {}
): LegacySearchResponse {
  return {
    results: response.results.map((result) => ({
      entity: {
        id: String(result.uuid || result.entity_id || result.id),
        labels: [result.type].filter(Boolean),
        properties: {
          ...(result.metadata || {}),
          name: result.name,
          type: result.type,
          sport: result.sport || '',
          country: result.country || '',
          uuid: result.uuid || '',
          entity_id: result.entity_id || '',
        },
      },
      similarity: result.score,
      connections: [],
    })),
    searchType,
    query: response.query,
    options,
    total: response.total,
    search_strategy: response.search_strategy,
  }
}
