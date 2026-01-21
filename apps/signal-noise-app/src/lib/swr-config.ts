import useSWR from 'swr'
import { useEffect } from 'react'

const fetcher = (url: string) => fetch(url).then(res => res.json())

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
    errorRetryCount: 1
  })

  return {
    summaries: data?.entities || [],
    summary: data?.summary,
    error,
    isLoading
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