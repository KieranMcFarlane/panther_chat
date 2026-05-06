import EntityBrowserClientPage from "./client-page"
import { getEntityBrowserPageData, getEntitiesTaxonomyData, type EntityBrowserFilters, type EntityBrowserResponse } from '@/lib/entity-browser-data'
import { requirePageSession } from "@/lib/server-auth"

export const dynamic = 'force-dynamic'

type SearchParams = Record<string, string | string[] | undefined>

function getFirst(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function createEmptyEntityBrowserResponse(page: number, filters: EntityBrowserFilters): EntityBrowserResponse {
  const limit = Number.parseInt(filters.limit || '10', 10)

  return {
    entities: [],
    pagination: {
      page,
      limit,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: page > 1,
    },
    filters: {
      entityType: filters.entityType,
      sport: filters.sport === 'all' ? undefined : filters.sport,
      league: filters.league === 'all' ? undefined : filters.league,
      country: filters.country === 'all' ? undefined : filters.country,
      entityClass: filters.entityClass === 'all' ? undefined : filters.entityClass,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    },
    source: 'error_fallback',
  }
}

export default async function EntityBrowserPage({ searchParams = {} }: { searchParams?: SearchParams }) {
  await requirePageSession('/entity-browser')

  const page = Number.parseInt(getFirst(searchParams.page) || '1', 10)
  const search = getFirst(searchParams.search) || ''
  const filters: EntityBrowserFilters = {
    entityType: getFirst(searchParams.entityType) || 'all',
    sport: getFirst(searchParams.sport) || 'all',
    league: getFirst(searchParams.league) || 'all',
    country: getFirst(searchParams.country) || 'all',
    entityClass: getFirst(searchParams.entityClass) || 'all',
    sortBy: getFirst(searchParams.sortBy) || 'popular',
    sortOrder: ((getFirst(searchParams.sortOrder) || 'desc') as 'asc' | 'desc'),
    limit: getFirst(searchParams.limit) || '10',
  }
  let initialEntitiesData: EntityBrowserResponse | null = null
  let initialTaxonomy: Awaited<ReturnType<typeof getEntitiesTaxonomyData>> | null = null
  let initialLoadError: string | null = null

  try {
    const [entitiesData, taxonomy] = await Promise.all([
      getEntityBrowserPageData({ page, search, filters }),
      getEntitiesTaxonomyData(),
    ])
    initialEntitiesData = entitiesData
    initialTaxonomy = taxonomy
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Initial entity browser data load failed'
    console.error('[entity-browser] Initial data load failed', { message })
    initialEntitiesData = createEmptyEntityBrowserResponse(page, filters)
    initialLoadError = message
  }

  return (
    <>
      <EntityBrowserClientPage
        initialEntitiesData={initialEntitiesData}
        initialTaxonomy={initialTaxonomy}
        initialLoadError={initialLoadError}
      />
    </>
  )
}
