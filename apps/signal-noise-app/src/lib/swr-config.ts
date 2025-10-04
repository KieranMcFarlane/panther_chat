import useSWR, { useSWRConfig, SWRConfig, SWRConfiguration } from 'swr'

export const fetcher = async (url: string) => {
  console.log(`🔄 fetcher called with url: ${url}`, {
    isClient: typeof window !== 'undefined',
    isServer: typeof window === 'undefined',
    timestamp: new Date().toISOString(),
    userAgent: typeof window !== 'undefined' ? window.navigator?.userAgent : 'server'
  })
  
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
    console.log(`✅ fetcher successfully fetched ${data.entities?.length || 0} entities from ${url}`)
    console.log(`🔍 Raw data structure:`, {
      hasEntities: !!data.entities,
      entitiesLength: data.entities?.length,
      hasPagination: !!data.pagination,
      paginationKeys: data.pagination ? Object.keys(data.pagination) : null,
      sampleEntity: data.entities?.[0] ? {
        id: data.entities[0].id,
        name: data.entities[0].properties?.name,
        type: data.entities[0].properties?.type
      } : null
    })
    return data
  } catch (parseError) {
    console.error(`❌ Parse error for ${url}:`, parseError)
    throw new Error(`Failed to parse response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
  }
}

// Global SWR configuration - serializable part only
export const swrConfig: SWRConfiguration = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  refreshInterval: 300000, // 5 minutes
  dedupingInterval: 2000, // 2 seconds
  errorRetryCount: 3,
  errorRetryInterval: 5000,
  loadingTimeout: 10000, // 10 seconds
}

// Custom hook for API calls with caching
export function useApi<T>(url: string | null, config?: SWRConfiguration) {
  const isClient = typeof window !== 'undefined'
  const isServer = typeof window === 'undefined'
  
  console.log(`🔄 useApi called with url: ${url}`, {
    isClient,
    isServer,
    timestamp: new Date().toISOString(),
    config: config
  })
  
  const result = useSWR<T>(url, fetcher, {
    ...swrConfig,
    // Force revalidation on client side to fix SSR hydration issues
    revalidateOnMount: true,
    // Always revalidate on focus to ensure fresh data
    revalidateOnFocus: true,
    // Disable SSR caching for this hook to ensure client-side data fetching
    fallbackData: undefined,
    // Ensure no caching that prevents client-side calls
    dedupingInterval: 0,
    // Disable suspense to force normal loading behavior
    suspense: false,
    onError: (error, key) => {
      console.error(`❌ SWR Error for key "${key}":`, error)
    },
    onLoadingSlow: (key, config) => {
      console.warn(`⏰ SWR Loading Slow for key "${key}" with config:`, config)
    },
    onSuccess: (data, key) => {
      console.log(`✅ SWR Success for key "${key}":`, {
        dataType: typeof data,
        hasData: !!data,
        dataLength: Array.isArray(data) ? data.length : 
                   (data && typeof data === 'object' && 'entities' in data) ? data.entities?.length : 
                   'N/A',
        timestamp: new Date().toISOString(),
        isClient
      })
    },
    ...config
  })
  
  console.log(`🔄 useApi returning result for ${url}:`, {
    data: result.data,
    error: result.error,
    isLoading: result.isLoading,
    isValidating: result.isValidating,
    mutate: result.mutate ? 'function' : 'undefined'
  })
  
  return result
}

// Hook for entity data with longer cache time
export function useEntity(entityId: string | null) {
  return useApi(`/api/entities/${entityId}`, {
    revalidateOnFocus: false,
    refreshInterval: 600000, // 10 minutes for entity data
    dedupingInterval: 5000,
  })
}

// Hook for sports entities with aggressive caching
export function useSportsEntities() {
  return useApi('/api/entities?limit=1000', {
    revalidateOnFocus: false,
    refreshInterval: 300000, // 5 minutes
    dedupingInterval: 1000,
  })
}

// Hook for paginated entities
export function usePaginatedEntities(page: number = 1, filters: any = {}, searchTerm: string = '') {
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
    refreshInterval: 600000, // 10 minutes for paginated data
    dedupingInterval: 2000,
    keepPreviousData: true, // Keep showing previous data while loading new page
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