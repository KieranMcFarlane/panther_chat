"use client"

import { useState, useEffect } from "react"
import { VectorSearchOptions, SearchResult } from "@/lib/neo4j"

interface UseVectorSearchReturn {
  results: SearchResult[]
  loading: boolean
  error: string | null
}

export function useVectorSearch(
  query: string, 
  filters: VectorSearchOptions, 
  searchType: 'vector' | 'text'
): UseVectorSearchReturn {
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const performSearch = async () => {
      if (!query.trim()) {
        setResults([])
        setError(null)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const endpoint = searchType === 'vector' ? '/api/vector-search' : '/api/search'
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            ...filters,
          }),
        })

        if (!response.ok) {
          throw new Error(`Search failed: ${response.status}`)
        }

        const data = await response.json()
        setResults(data.results || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed')
        setResults([])
      } finally {
        setLoading(false)
      }
    }

    performSearch()
  }, [query, filters, searchType])

  return { results, loading, error }
}