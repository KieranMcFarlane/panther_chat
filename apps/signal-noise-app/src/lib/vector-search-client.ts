export type VectorSearchRequest = {
  query: string
  limit?: number
  score_threshold?: number
  entity_types?: string[] | null
  entity_type?: string | null
  sport?: string | null
  league?: string | null
  country?: string | null
  searchType?: 'vector' | 'text'
}

export type VectorSearchResult = {
  id: string
  uuid?: string | null
  entity_id?: string | null
  name: string
  type: string
  sport?: string | null
  country?: string | null
  score: number
  lexical_score: number
  semantic_score: number
  metadata_boost: number
  final_score: number
  metadata: Record<string, any>
}

export type VectorSearchResponse = {
  query: string
  total: number
  search_strategy: string
  semantic_enabled?: boolean
  note?: string
  results: VectorSearchResult[]
}

export async function searchVectorEntities(
  request: VectorSearchRequest,
  options: { signal?: AbortSignal } = {}
): Promise<VectorSearchResponse> {
  const response = await fetch('/api/vector-search', {
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
