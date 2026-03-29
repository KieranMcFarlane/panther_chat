import useSWR from 'swr'
import { useEffect } from 'react'

const fetcher = (url: string) => fetch(url).then(res => res.json())

type EntityBrowserFilters = {
  entityType: string
  sport: string
  league: string
  country: string
  entityClass: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
  limit: string
}

function buildEntityBrowserQueryUrl(page: number, searchValue: string, filters: EntityBrowserFilters) {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: filters.limit,
    entityType: filters.entityType,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder
  })

  if (filters.sport !== 'all') {
    params.append('sport', filters.sport)
  }
  if (filters.league !== 'all') {
    params.append('league', filters.league)
  }
  if (filters.country !== 'all') {
    params.append('country', filters.country)
  }
  if (filters.entityClass !== 'all') {
    params.append('entityClass', filters.entityClass)
  }

  if (searchValue.trim()) {
    params.append('search', searchValue.trim())
  }

  return `/api/entities?${params.toString()}`
}

export function useEntitiesBrowserData(
  page: number,
  searchValue: string,
  filters: EntityBrowserFilters
) {
  const url = buildEntityBrowserQueryUrl(page, searchValue, filters)

  const { data, error, isLoading, mutate, isValidating } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60_000,
    errorRetryCount: 1,
    keepPreviousData: true
  })

  return {
    entitiesData: data || null,
    entitiesError: error || null,
    entitiesLoading: isLoading,
    entitiesValidating: isValidating,
    reloadEntities: mutate,
    entitiesUrl: url,
  }
}

export function useEntities(url: string | null) {
  const { data, error, isLoading } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    errorRetryCount: 1
  })
  
  return { 
    entities: data?.entities || [], 
    pagination: data?.pagination, 
    error, 
    isLoading 
  }
}

export function useEntity(entityId: string | null) {
  const { data, error, isLoading } = useSWR(
    entityId ? `/api/entities/${entityId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // Don't refetch for 60 seconds
      errorRetryCount: 1,
      keepPreviousData: true // Keep old data while fetching new
    }
  )

  return {
    entity: data?.entity || null,
    error,
    isLoading
  }
}

export function useEntitySummaries(url: string | null) {
  const { data, error, isLoading } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 300000,
    errorRetryCount: 1
  })

  return {
    summaries: data?.entities || [],
    summary: data?.summary,
    error,
    isLoading
  }
}

export function useEntityTaxonomy() {
  const { data, error, isLoading, mutate, isValidating } = useSWR('/api/entities/taxonomy', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 300_000,
    errorRetryCount: 1,
    keepPreviousData: true
  })

  return {
    taxonomy: data || null,
    taxonomyError: error || null,
    taxonomyLoading: isLoading,
    taxonomyValidating: isValidating,
    reloadTaxonomy: mutate,
  }
}

// Prefetch entity data into SWR cache
export async function prefetchEntity(entityId: string) {
  if (entityId) {
    const url = `/api/entities/${entityId}`

    try {
      // Actually fetch the data first
      const data = await fetcher(url)

      // Then populate the SWR cache with the fetched data
      useSWR.mutate(url, data, false)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`Failed to prefetch entity ${entityId}:`, errorMessage)
    }
  }
}
