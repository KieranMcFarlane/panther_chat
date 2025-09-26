import { useState, useEffect } from 'react'

export interface SearchResult {
  entity: {
    id: string | number
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
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    const search = async () => {
      if (!query.trim()) {
        setResults([])
        return
      }
      
      setLoading(true)
      setError(null)
      
      try {
        console.log('🔍 Searching for:', query, searchType, options)
        const response = await fetch('/api/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            searchType,
            options
          })
        })
        
        if (!response.ok) {
          throw new Error(`Search failed with status ${response.status}`)
        }
        
        const data = await response.json()
        console.log('📊 Search results:', data.results?.length || 0)
        setResults(data.results || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed')
        console.error('❌ Search error:', err)
      } finally {
        setLoading(false)
      }
    }
    
    // Debounce the search
    const timer = setTimeout(search, 300)
    return () => clearTimeout(timer)
  }, [query, JSON.stringify(options), searchType])
  
  return { results, loading, error }
}