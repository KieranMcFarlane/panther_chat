"use client"

import Link from "next/link"
import { useState, useEffect, useCallback, useRef, useDeferredValue } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { FixedSizeList, type ListChildComponentProps } from "react-window"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Skeleton } from "@/components/ui/skeleton"
import { EntityCard } from "@/components/EntityCard"
import { EntitySmokeJourney } from "@/components/entity-browser/EntitySmokeJourney"
import { FacetFilterBar, type FacetFilterField } from "@/components/filters/FacetFilterBar"
import { AppPageBody, AppPageHeader, AppPageShell } from "@/components/layout/AppPageShell"
import type { EntitySmokeJourneyItem } from "@/lib/entity-smoke-set"
import { useEntitiesBrowserData, useEntityTaxonomy } from "@/lib/swr-config"
import type { EntityBrowserFilters, EntityBrowserResponse } from "@/lib/entity-browser-data"
import type { EntitiesTaxonomyResponse } from "@/lib/entities-taxonomy"
import {
  Database,
  Filter,
  ArrowLeft,
  ArrowRight,
  Download
} from "lucide-react"

interface Entity {
  id: string
  graph_id?: string | number
  labels: string[]
  properties: Record<string, any>
}


interface AutocompleteEntity {
  id: string
  graph_id?: string | number
  name: string
  type?: string
}


interface EntityBrowserClientPageProps {
  smokeItems: EntitySmokeJourneyItem[]
  initialEntitiesData?: EntityBrowserResponse | null
  initialTaxonomy?: EntitiesTaxonomyResponse | null
}

export default function EntityBrowserClientPage({
  smokeItems,
  initialEntitiesData = null,
  initialTaxonomy = null,
}: EntityBrowserClientPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialPageFromUrl = Number.parseInt(searchParams.get('page') || '1', 10)

  const [searchTerm, setSearchTerm] = useState("")
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("")
  const deferredSearchTerm = useDeferredValue(searchTerm)
  const [autocompleteLoading, setAutocompleteLoading] = useState(false)
  const [autocompleteEntities, setAutocompleteEntities] = useState<AutocompleteEntity[]>([])
  const [autocompleteOpen, setAutocompleteOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(initialPageFromUrl)
  const [gridWidth, setGridWidth] = useState(0)
  const gridContainerRef = useRef<HTMLDivElement | null>(null)
  const [filters, setFilters] = useState<EntityBrowserFilters>({
    entityType: "all",
    sport: "all",
    league: "all",
    country: "all",
    entityClass: "all",
    sortBy: "popular",
    sortOrder: "desc" as "asc" | "desc",
    limit: "10"
  })
  const { entitiesData, entitiesError, entitiesLoading, entitiesValidating, reloadEntities } = useEntitiesBrowserData(
    currentPage,
    appliedSearchTerm,
    filters,
    currentPage === initialPageFromUrl && !appliedSearchTerm ? initialEntitiesData : null
  )
  const { taxonomy } = useEntityTaxonomy(initialTaxonomy)
  const availableSports = taxonomy?.sports ?? []
  const availableLeagues = taxonomy?.leagues ?? []
  const availableCountries = taxonomy?.countries ?? []
  const availableEntityRoles = taxonomy?.entityRoles ?? taxonomy?.entityClasses ?? []

  const syncEntityBrowserHistory = useCallback((browserUrl: string) => {
    const rawStack = sessionStorage.getItem('entityBrowserHistoryStack')
    const rawIndex = sessionStorage.getItem('entityBrowserHistoryIndex')

    const historyStack = rawStack ? JSON.parse(rawStack) as string[] : []
    const currentIndex = rawIndex ? Number.parseInt(rawIndex, 10) : -1
    const currentUrlAtIndex = currentIndex >= 0 ? historyStack[currentIndex] : null

    if (currentUrlAtIndex === browserUrl) {
      return
    }

    if (currentIndex > 0 && historyStack[currentIndex - 1] === browserUrl) {
      sessionStorage.setItem('entityBrowserHistoryIndex', String(currentIndex - 1))
      return
    }

    if (currentIndex >= 0 && currentIndex < historyStack.length - 1 && historyStack[currentIndex + 1] === browserUrl) {
      sessionStorage.setItem('entityBrowserHistoryIndex', String(currentIndex + 1))
      return
    }

    const nextHistoryStack = historyStack.slice(0, currentIndex + 1)
    nextHistoryStack.push(browserUrl)

    sessionStorage.setItem('entityBrowserHistoryStack', JSON.stringify(nextHistoryStack))
    sessionStorage.setItem('entityBrowserHistoryIndex', String(nextHistoryStack.length - 1))
  }, [])

  const updateFilters = useCallback((updater: (prev: typeof filters) => typeof filters) => {
    setCurrentPage(1)
    setFilters(updater)
  }, [])

  useEffect(() => {
    const nextPage = Number.parseInt(searchParams.get('page') || '1', 10)
    if (nextPage !== currentPage) {
      setCurrentPage(nextPage)
    }
  }, [currentPage, searchParams])

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    if (currentPage === 1) {
      params.delete('page')
    } else {
      params.set('page', currentPage.toString())
    }

    const currentUrl = `/entity-browser${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
    const nextUrl = `/entity-browser${params.toString() ? `?${params.toString()}` : ''}`
    if (nextUrl !== currentUrl) {
      router.push(nextUrl, { scroll: false })
    }
  }, [currentPage, router, searchParams])

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    if (currentPage === 1) {
      params.delete('page')
    } else {
      params.set('page', currentPage.toString())
    }

    const browserUrl = `/entity-browser${params.toString() ? `?${params.toString()}` : ''}`
    sessionStorage.setItem('lastEntityBrowserUrl', browserUrl)
    syncEntityBrowserHistory(browserUrl)
  }, [currentPage, searchParams, syncEntityBrowserHistory])

  const applyFilters = useCallback(() => {
    setAppliedSearchTerm(searchTerm)
    setCurrentPage(1)
  }, [searchTerm])

  const resetAndReload = useCallback(() => {
    setSearchTerm("")
    setAppliedSearchTerm("")
    setFilters({
      entityType: "all",
      sport: "all",
      league: "all",
      country: "all",
      entityClass: "all",
      sortBy: "popular",
      sortOrder: "desc",
      limit: "10"
    })
    setCurrentPage(1)
  }, [])

  useEffect(() => {
    const term = deferredSearchTerm.trim()
    if (term.length < 2) {
      setAutocompleteEntities([])
      setAutocompleteLoading(false)
      setAutocompleteOpen(false)
      return
    }

    const controller = new AbortController()
    const loadAutocomplete = async () => {
      setAutocompleteLoading(true)
      setAutocompleteEntities([])
      try {
        const params = new URLSearchParams({
          mode: 'autocomplete',
          search: term,
          limit: '8'
        })
        const response = await fetch(`/api/entities/search?mode=autocomplete&${params.toString()}`, { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`Autocomplete request failed: ${response.status}`)
        }
        const result = await response.json()
        const nextItems = Array.isArray(result.entities) ? result.entities.slice(0, 8) : []
        setAutocompleteEntities(nextItems)
        setAutocompleteOpen(true)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setAutocompleteEntities([])
          setAutocompleteOpen(false)
        }
      } finally {
        setAutocompleteLoading(false)
      }
    }

    loadAutocomplete()
    return () => controller.abort()
  }, [deferredSearchTerm])

  useEffect(() => {
    if (entitiesLoading) return
    const element = gridContainerRef.current
    if (!element) return

    const updateWidth = () => setGridWidth(element.clientWidth)
    updateWidth()

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth)
      return () => window.removeEventListener("resize", updateWidth)
    }

    const observer = new ResizeObserver(() => updateWidth())
    observer.observe(element)
    return () => observer.disconnect()
  }, [entitiesLoading, entitiesData?.entities?.length])

  const exportToJSON = () => {
    if (!entitiesData) return

    const exportData = {
      entities: entitiesData.entities,
      pagination,
      filters: entitiesData.filters,
      exportDate: new Date().toISOString(),
      totalEntities: pagination.total
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `entities-export-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (entitiesLoading && !entitiesData && !initialEntitiesData) {
    return (
      <AppPageShell>
        <AppPageHeader
          eyebrow="Workspace"
          title="Entity Browser"
          description="Primary workspace for persisted entity dossiers, question-driven research, and entity-first follow-up."
        />
        <AppPageBody>
          <section className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-8 w-44" />
                  <Skeleton className="h-4 w-72" />
                </div>
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-9 w-24 rounded-md" />
                <Skeleton className="h-9 w-20 rounded-md" />
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Hydrating entity browser from cached snapshot and taxonomy.
            </p>
          </section>
          <div className="mb-4 rounded-2xl border border-slate-700/80 bg-slate-950/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-2">
                <Skeleton className="h-6 w-44" />
                <Skeleton className="h-4 w-80" />
              </div>
              <Skeleton className="h-8 w-24 rounded-full" />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-3">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-5 w-14 rounded-full" />
                    </div>
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                    <div className="flex gap-2 pt-1">
                      <Skeleton className="h-8 w-24 rounded-md" />
                      <Skeleton className="h-8 w-24 rounded-md" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
                <div className="mt-4 flex gap-2">
                  <Skeleton className="h-9 w-24 rounded-md" />
                  <Skeleton className="h-9 w-28 rounded-md" />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-dashed border-slate-700/80 bg-slate-950/60 p-4">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-muted-foreground" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-3 w-72" />
              </div>
            </div>
          </div>
        </AppPageBody>
      </AppPageShell>
    )
  }

  if (entitiesError) {
    return (
      <AppPageShell size="narrow">
        <AppPageBody className="min-h-[50vh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <Database className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Error Loading Entities</h2>
            <p className="text-muted-foreground mb-4">{entitiesError.message}</p>
            <Button onClick={() => reloadEntities()} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
        </AppPageBody>
      </AppPageShell>
    )
  }

  if (!entitiesData) {
    return null
  }

  const entities = entitiesData.entities || []
  const pagination = entitiesData.pagination ?? {
    page: currentPage,
    limit: Number.parseInt(filters.limit, 10) || 10,
    total: entities.length,
    totalPages: Math.max(1, Math.ceil(entities.length / (Number.parseInt(filters.limit, 10) || 10))),
    hasNext: false,
    hasPrev: currentPage > 1,
  }
  const activeFilterChips = [
    filters.sport !== 'all' ? { key: 'sport', label: `Sport: ${filters.sport}` } : null,
    filters.league !== 'all' ? { key: 'league', label: `League: ${filters.league}` } : null,
    filters.country !== 'all' ? { key: 'country', label: `Country: ${filters.country}` } : null,
    filters.entityClass !== 'all' ? { key: 'entityClass', label: `Role: ${filters.entityClass}` } : null,
    filters.entityType !== 'all' ? { key: 'entityType', label: `Type: ${filters.entityType}` } : null,
  ].filter(Boolean) as Array<{ key: 'sport' | 'league' | 'country' | 'entityClass' | 'entityType', label: string }>
  const columnCount = gridWidth >= 1100 ? 3 : gridWidth >= 720 ? 2 : 1
  const rowCount = Math.ceil(entities.length / columnCount)
  const rowHeight = 300
  const listHeight = Math.min(900, Math.max(rowHeight, rowCount * rowHeight))
  const columnGap = 24
  const filterFields: FacetFilterField[] = [
    {
      key: 'entityType',
      label: 'Entity Type',
      value: filters.entityType,
      placeholder: 'Entity Type',
      options: [
        { value: 'all', label: 'All Types' },
        { value: 'Entity', label: 'Entity' },
        { value: 'TopTierSport', label: 'Top Tier Sport' },
        { value: 'Club', label: 'Club' },
        { value: 'League', label: 'League' },
        { value: 'Person', label: 'Person' },
      ],
      onValueChange: (value) => updateFilters((prev) => ({ ...prev, entityType: value })),
    },
    {
      key: 'sport',
      label: 'Sport',
      value: filters.sport,
      placeholder: 'Sport',
      options: [
        { value: 'all', label: 'All Sports' },
        ...availableSports.map((sport) => ({
          value: sport,
          label: sport,
          count: taxonomy?.counts?.sports?.[sport] ?? 0,
        })),
      ],
      onValueChange: (value) => updateFilters((prev) => ({ ...prev, sport: value })),
    },
    {
      key: 'league',
      label: 'League',
      value: filters.league,
      placeholder: 'League',
      options: [
        { value: 'all', label: 'All Leagues' },
        ...availableLeagues.map((league) => ({
          value: league,
          label: league,
          count: taxonomy?.counts?.leagues?.[league] ?? 0,
        })),
      ],
      onValueChange: (value) => updateFilters((prev) => ({ ...prev, league: value })),
    },
    {
      key: 'country',
      label: 'Country',
      value: filters.country,
      placeholder: 'Country',
      options: [
        { value: 'all', label: 'All Countries' },
        ...availableCountries.map((country) => ({
          value: country,
          label: country,
          count: taxonomy?.counts?.countries?.[country] ?? 0,
        })),
      ],
      onValueChange: (value) => updateFilters((prev) => ({ ...prev, country: value })),
    },
    {
      key: 'entityClass',
      label: 'Role',
      value: filters.entityClass,
      placeholder: 'Role',
      options: [
        { value: 'all', label: 'All Roles' },
        ...availableEntityRoles.map((entityRole) => ({
          value: entityRole,
          label: entityRole,
          count: taxonomy?.counts?.entityRoles?.[entityRole] ?? taxonomy?.counts?.entityClasses?.[entityRole] ?? 0,
        })),
      ],
      onValueChange: (value) => updateFilters((prev) => ({ ...prev, entityClass: value })),
    },
    {
      key: 'sortBy',
      label: 'Sort By',
      value: filters.sortBy,
      placeholder: 'Sort By',
      options: [
        { value: 'popular', label: 'Popular' },
        { value: 'name', label: 'Name' },
        { value: 'type', label: 'Type' },
        { value: 'sport', label: 'Sport' },
        { value: 'country', label: 'Country' },
        { value: 'priorityScore', label: 'Priority Score' },
        { value: 'estimatedValue', label: 'Estimated Value' },
      ],
      onValueChange: (value) => updateFilters((prev) => ({ ...prev, sortBy: value })),
    },
    {
      key: 'sortOrder',
      label: 'Sort Order',
      value: filters.sortOrder,
      placeholder: 'Sort Order',
      options: [
        { value: 'asc', label: 'Ascending' },
        { value: 'desc', label: 'Descending' },
      ],
      onValueChange: (value) => updateFilters((prev) => ({ ...prev, sortOrder: value as 'asc' | 'desc' })),
    },
    {
      key: 'limit',
      label: 'Per Page',
      value: filters.limit,
      placeholder: 'Per Page',
      options: [
        { value: '5', label: '5 per page (Fast)' },
        { value: '10', label: '10 per page (Default)' },
        { value: '20', label: '20 per page' },
        { value: '50', label: '50 per page' },
      ],
      onValueChange: (value) => updateFilters((prev) => ({ ...prev, limit: value })),
    },
  ]
  const filterChips = activeFilterChips.map((chip) => ({
    key: chip.key,
    label: chip.label,
    onRemove: () => updateFilters((prev) => ({ ...prev, [chip.key]: 'all' })),
  }))

  return (
    <AppPageShell>
      <AppPageHeader
        eyebrow="Workspace"
        title="Entity Browser"
        description="Primary workspace for persisted entity dossiers, question-driven research, and entity-first follow-up."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/entity-import">Import CSV</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/tenders">View tenders</Link>
            </Button>
          </>
        }
      />
      <AppPageBody>
        <div className="mb-4">
          <EntitySmokeJourney items={smokeItems} />
        </div>
      <FacetFilterBar
        className="mb-4"
        searchSlot={
          <div className="relative">
            <Command className="overflow-visible rounded-md border border-input bg-background shadow-sm">
              <CommandInput
                value={searchTerm}
                onValueChange={(value) => {
                  setSearchTerm(value)
                  setAutocompleteOpen(value.trim().length >= 2)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    applyFilters()
                    setAutocompleteOpen(false)
                  }
                }}
                onFocus={() => {
                  if (searchTerm.trim().length >= 2) {
                    setAutocompleteOpen(true)
                  }
                }}
                placeholder="Search club, sport, country, league..."
                className="h-11 border-0 pl-2"
              />
              {(autocompleteOpen || autocompleteLoading || autocompleteEntities.length > 0) ? (
                <CommandList className="absolute z-20 mt-1 w-full rounded-md border bg-background p-2 shadow-lg">
                  {autocompleteLoading ? (
                    <div className="px-1 py-1 text-xs text-muted-foreground">Loading suggestions...</div>
                  ) : autocompleteEntities.length === 0 ? (
                    <CommandEmpty>No matches found.</CommandEmpty>
                  ) : (
                    <CommandGroup>
                      {autocompleteEntities.map((entity) => (
                        <CommandItem
                          key={entity.id}
                          value={entity.name}
                          onSelect={(value) => {
                            setSearchTerm(value)
                            setAppliedSearchTerm(value)
                            setAutocompleteEntities([])
                            setAutocompleteOpen(false)
                            setCurrentPage(1)
                          }}
                          className="flex items-center justify-between"
                        >
                          <span className="truncate">{entity.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{entity.type || "Entity"}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </CommandList>
              ) : null}
            </Command>
          </div>
        }
          fields={filterFields}
          actions={[
            {
              key: 'apply',
              label: 'Apply Filters',
              onClick: applyFilters,
              icon: <Filter className="h-4 w-4" />,
            },
            {
              key: 'reset',
              label: 'Reset',
              onClick: resetAndReload,
            },
            {
              key: 'export',
              label: 'Export JSON',
              onClick: exportToJSON,
              icon: <Download className="h-4 w-4" />,
            },
          ]}
          chips={filterChips}
          status={
            <Badge variant="outline">
              Showing {entities.length} of {pagination.total.toLocaleString()} entities
            </Badge>
          }
        />

        <div ref={gridContainerRef} className="w-full">
          {entitiesValidating ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: parseInt(filters.limit, 10) || 10 }).map((_, index) => (
                <div key={index} className="rounded-lg border bg-card text-card-foreground shadow-sm">
                  <div className="flex flex-col space-y-1.5 p-6 pb-3">
                    <div className="flex items-start gap-4">
                      <div className="relative rounded-lg overflow-hidden w-16 h-16 bg-gray-200 animate-pulse"></div>
                      <div className="flex-1 min-w-0">
                        <div className="h-6 bg-gray-200 rounded animate-pulse mb-2"></div>
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-20"></div>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 pt-0 space-y-3">
                    <div className="border-t pt-3">
                      <div className="h-9 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                    <div className="h-3 bg-gray-200 rounded animate-pulse w-16"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : rowCount === 0 ? null : (
            <FixedSizeList
              height={listHeight}
              width={gridWidth || 1}
              itemCount={rowCount}
              itemSize={rowHeight}
            >
              {({ index, style }: ListChildComponentProps) => {
                const rowStart = index * columnCount
                const rowItems = entities.slice(rowStart, rowStart + columnCount)
                const widthForCols = gridWidth || 1
                const computedColumnWidth = Math.max(
                  280,
                  Math.floor((widthForCols - (columnCount - 1) * columnGap) / columnCount),
                )

                return (
                  <div style={style}>
                    <div
                      className="grid gap-6"
                      style={{
                        gridTemplateColumns: `repeat(${columnCount}, minmax(0, ${computedColumnWidth}px))`,
                      }}
                    >
                      {rowItems.map((entity) => (
                        <EntityCard
                          key={`${entity.id}-${String(entity.neo4j_id ?? "")}`}
                          entity={entity}
                        />
                      ))}
                    </div>
                  </div>
                )
              }}
            </FixedSizeList>
          )}
        </div>

        <div className="flex items-center justify-between mt-8">
          <Button
            variant="outline"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={!pagination.hasPrev}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>

          <div className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
            <span className="ml-2">
              ({((pagination.page - 1) * pagination.limit + 1)} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total})
            </span>
          </div>

          <Button
            variant="outline"
            onClick={() => setCurrentPage((prev) => Math.min(pagination.totalPages, prev + 1))}
            disabled={!pagination.hasNext}
          >
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </AppPageBody>
    </AppPageShell>
  )
}

function formatEmail(email: any): string {
  if (!email) return ""
  if (typeof email === 'string') return email
  if (typeof email === 'object' && email !== null) {
    if ('value' in email && email.value !== undefined) {
      return String(email.value)
    }
    if ('low' in email && 'high' in email && email.low !== undefined) {
      return String(email.low)
    }
    if ('email' in email && email.email !== undefined) {
      return String(email.email)
    }
  }
  return String(email)
}
