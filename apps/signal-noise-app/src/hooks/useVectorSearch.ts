import { useState, useEffect } from 'react'
import { searchVectorEntities } from '@/lib/vector-search-client'
import type { VectorSearchResult } from '@/lib/vector-search-client'

export interface VectorSearchOptions {
  limit?: number
  threshold?: number
  entityType?: string
}

export const useVectorSearch = (
  query: string,
  options: VectorSearchOptions = {},
  searchType: 'vector' | 'text' = 'vector'
) => {
  const [results, setResults] = useState<VectorSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    const controller = new AbortController()
    const search = async () => {
      if (!query.trim()) {
        setResults([])
        setLoading(false)
        setError(null)
        return
      }
      
      setLoading(true)
      setError(null)
      
      try {
        const data = await searchVectorEntities(
          {
            query,
            limit: options.limit ?? 12,
            score_threshold: options.threshold ?? 0.15,
            entity_type: options.entityType || null,
            searchType,
          },
          { signal: controller.signal }
        )
        setResults(data.results || [])
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Search failed')
      } finally {
        setLoading(false)
      }
    }
    
    // Debounce the search
    const timer = setTimeout(search, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, JSON.stringify(options), searchType])
  
  return { results, loading, error }
}
