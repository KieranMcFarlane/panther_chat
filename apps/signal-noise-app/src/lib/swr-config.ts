import useSWR, { useSWRConfig, SWRConfig, SWRConfiguration } from 'swr'

export const fetcher = async (url: string) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔄 fetcher called with url: ${url}`)
  }
  
  const res = await fetch(url)
  if (!res.ok) {
    const error = new Error(`HTTP Error: ${res.status} ${res.statusText}`)
    try {
      // Try to get error details from JSON response
      const errorData = await res.json()
      // @ts-ignore
      error.info = errorData
      // @ts-ignore
      error.status = res.status
      if (errorData.error) {
        error.message = errorData.error
      }
    } catch {
      // If response is not JSON (e.g., HTML error page), just use status text
      error.message = `HTTP ${res.status}: ${res.statusText}`
    }
    throw error
  }
  
  try {
    const data = await res.json()
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ fetcher successfully fetched ${data.entities?.length || 0} entities from ${url}`)
    }
    return data
  } catch (parseError) {
    console.error(`❌ Parse error for ${url}:`, parseError)
    throw new Error(`Failed to parse response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
  }
}

// Global SWR configuration - serializable part only
export const swrConfig: SWRConfiguration = {
  revalidateOnFocus: false, // Disable to prevent excessive revalidation
  revalidateOnReconnect: true,
  refreshInterval: 0, // Disable auto-refresh
  dedupingInterval: 10000, // Increase to prevent rapid re-calls
  errorRetryCount: 2,
  errorRetryInterval: 1000,
  loadingTimeout: 15000, // 15 seconds
}

// Custom hook for API calls with caching
export function useApi<T>(url: string | null, config?: SWRConfiguration) {
  // Don't call SWR with null URL
  if (!url) {
    return {
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: () => {}
    } as any
  }
  
  const result = useSWR<T>(url, fetcher, {
    ...swrConfig,
    // More conservative settings to prevent infinite loading
    revalidateOnMount: true,
    revalidateOnFocus: false, // Keep disabled to prevent excessive calls
    fallbackData: undefined,
    suspense: false,
    onError: (error, key) => {
      if (process.env.NODE_ENV === 'development') {
        console.error(`❌ SWR Error for key "${key}":`, error)
      }
    },
    onLoadingSlow: (key, config) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`⏰ SWR Loading Slow for key "${key}"`)
      }
    },
    ...config
  })
  
  return result
}

// Hook for entity data with longer cache time
export function useEntity(entityId: string | null) {
  return useApi(entityId ? `/api/entities/${entityId}` : null, {
    revalidateOnFocus: false,
    refreshInterval: 0, // Disable auto-refresh for entity data
    dedupingInterval: 60000, // Increase deduplication to prevent rapid re-calls
    revalidateOnMount: true,
    errorRetryCount: 2,
    errorRetryInterval: 1000,
    loadingTimeout: 15000, // 15 seconds timeout
  })
}

// Hook for sports entities with aggressive caching
export function useSportsEntities() {
  return useApi('/api/entities?limit=1000', {
    revalidateOnFocus: false,
    refreshInterval: 0, // Disable auto-refresh to prevent constant API calls
    dedupingInterval: 60000, // 1 minute deduplication
  })
}

// Hook for paginated entities
export function usePaginatedEntities(page: number | null, filters: any = {}, searchTerm: string = '') {
  // Ensure we have valid parameters
  if (!page || page < 1) {
    page = 1
  }

  const params = new URLSearchParams({
    page: page.toString(),
    limit: filters.limit || '10',
    entityType: filters.entityType || 'all',
    sortBy: filters.sortBy || 'name',
    sortOrder: filters.sortOrder || 'asc'
  })

  if (searchTerm.trim()) {
    params.append('search', searchTerm.trim())
  }

  const url = `/api/entities?${params}`
  
  return useApi(url, {
    revalidateOnFocus: false,
    refreshInterval: 0, // Disable auto-refresh to prevent constant API calls
    dedupingInterval: 30000, // Increase deduplication to 30 seconds
    keepPreviousData: true, // Keep showing previous data while loading new page
    errorRetryCount: 2,
    errorRetryInterval: 1000,
    loadingTimeout: 8000, // 8 seconds
  })
}

// Hook for prefetching data
export function usePrefetch() {
  const { mutate } = useSWRConfig()
  
  const prefetch = (url: string) => {
    // Prefetch in the background
    mutate(url, undefined, { revalidate: true })
  }
  
  return { prefetch }
}

// Hook for prefetching next page
export function usePaginatedPrefetch() {
  const { mutate } = useSWRConfig()
  
  const prefetchPage = (page: number, filters: any = {}, searchTerm: string = '') => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: filters.limit || '10',
      entityType: filters.entityType || 'all',
      sortBy: filters.sortBy || 'name',
      sortOrder: filters.sortOrder || 'asc'
    })

    if (searchTerm.trim()) {
      params.append('search', searchTerm.trim())
    }

    const url = `/api/entities?${params}`
    mutate(url, undefined, { revalidate: true })
  }
  
  return { prefetchPage }
}

// Hook for prefetching navigation pages
export function useNavigationPrefetch() {
  const { mutate } = useSWRConfig()
  
  const prefetchPage = (path: string) => {
    // Prefetch common API endpoints for different pages
    const apiEndpoints: Record<string, string[]> = {
      '/': ['/api/entities?limit=10'],
      '/entity-browser': ['/api/entities?limit=20'],
      '/tenders': ['/api/entities?limit=50'],
      '/rfp-intelligence': ['/api/entities?limit=100'],
      '/graph': ['/api/entities?limit=200']
    }
    
    const endpoints = apiEndpoints[path]
    if (endpoints) {
      endpoints.forEach(endpoint => {
        mutate(endpoint, undefined, { revalidate: true })
      })
    }
  }
  
  return { prefetchPage }
}