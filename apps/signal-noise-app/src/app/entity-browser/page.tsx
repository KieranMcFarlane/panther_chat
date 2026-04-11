import { Suspense } from "react"

import EntityBrowserClientPage from "./client-page"
import { getEntityBrowserPageData, getEntitiesTaxonomyData, type EntityBrowserFilters } from '@/lib/entity-browser-data'
import { requirePageSession } from "@/lib/server-auth"

export const dynamic = 'force-dynamic'

type SearchParams = Record<string, string | string[] | undefined>

function getFirst(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
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
  const initialEntitiesData = await getEntityBrowserPageData({ page, search, filters })
  const initialTaxonomy = await getEntitiesTaxonomyData()

  return (
    <>
      <EntityBrowserClientPage
        initialEntitiesData={initialEntitiesData}
        initialTaxonomy={initialTaxonomy}
      />
    </>
  )
}
