"use client"

import Link from "next/link"
import dynamic from "next/dynamic"
import { useState, useEffect, useCallback, useRef, useDeferredValue, startTransition, type ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EntityCard } from "@/components/EntityCard"
import { rememberEntityBrowserUrl } from "@/lib/entity-browser-history"
import {
  Database,
  Search,
  Filter,
  ArrowUpDown,
  ArrowLeft,
  ArrowRight,
  Download,
  X
} from "lucide-react"

const EmailComposeModal = dynamic(
  () => import("@/components/email/EmailComposeModal"),
  { ssr: false }
)

const DEFAULT_FILTERS = {
  entityType: "all",
  sport: "all",
  league: "all",
  sortBy: "name",
  sortOrder: "desc" as "asc" | "desc",
  limit: "10",
}

type BrowserFilters = typeof DEFAULT_FILTERS

function getInitialBrowserState() {
  if (typeof window === "undefined") {
    return {
      page: 1,
      searchTerm: "",
      appliedSearchTerm: "",
      filters: DEFAULT_FILTERS,
    }
  }

  const params = new URLSearchParams(window.location.search)
  const parsedPage = Number.parseInt(params.get("page") || "1", 10)
  const page = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage
  const appliedSearchTerm = params.get("search")?.trim() || ""
  const searchTerm = appliedSearchTerm

  const entityType = params.get("entityType") || DEFAULT_FILTERS.entityType
  const sport = params.get("sport") || DEFAULT_FILTERS.sport
  const league = params.get("league") || DEFAULT_FILTERS.league
  const sortBy = params.get("sortBy") || DEFAULT_FILTERS.sortBy
  const sortOrder = params.get("sortOrder") === "asc" ? "asc" : "desc"
  const limit = params.get("limit") || DEFAULT_FILTERS.limit

  return {
    page,
    searchTerm,
    appliedSearchTerm,
    filters: {
      entityType,
      sport,
      league,
      sortBy,
      sortOrder,
      limit,
    } satisfies BrowserFilters,
  }
}

function buildBrowserUrlFromState(page: number, filters: BrowserFilters, appliedSearchTerm: string) {
  const params = new URLSearchParams()
  if (page > 1) params.set("page", String(page))
  if (filters.limit !== DEFAULT_FILTERS.limit) params.set("limit", filters.limit)
  if (filters.entityType !== DEFAULT_FILTERS.entityType) params.set("entityType", filters.entityType)
  if (filters.sport !== DEFAULT_FILTERS.sport) params.set("sport", filters.sport)
  if (filters.league !== DEFAULT_FILTERS.league) params.set("league", filters.league)
  if (filters.sortBy !== DEFAULT_FILTERS.sortBy) params.set("sortBy", filters.sortBy)
  if (filters.sortOrder !== DEFAULT_FILTERS.sortOrder) params.set("sortOrder", filters.sortOrder)
  if (appliedSearchTerm.trim()) params.set("search", appliedSearchTerm.trim())

  const query = params.toString()
  return `/entity-browser${query ? `?${query}` : ""}`
}

interface Entity {
  id: string
  graph_id?: string | number
  labels: string[]
  properties: Record<string, any>
}

interface EntityBrowserResponse {
  entities: Entity[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
  filters: {
    entityType: string
    sport?: string
    league?: string
    sortBy: string
    sortOrder: string
  }
}

interface AutocompleteEntity {
  id: string
  graph_id?: string | number
  name: string
  type?: string
}

function ViewportDeferredCard({ children }: { children: ReactNode }) {
  const [isVisible, setIsVisible] = useState(false)
  const cardRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const element = cardRef.current
    if (!element) return
    if (typeof IntersectionObserver === "undefined") {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry?.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: "300px 0px" }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={cardRef}>
      {isVisible ? children : (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 h-[220px] animate-pulse">
          <div className="h-5 w-3/4 bg-gray-200 rounded mb-3" />
          <div className="h-4 w-1/2 bg-gray-200 rounded mb-6" />
          <div className="h-10 w-full bg-gray-200 rounded" />
        </div>
      )}
    </div>
  )
}

export default function EntityBrowserClientPage() {
  const initialState = getInitialBrowserState()
  const lastFetchedRequestKeyRef = useRef<string | null>(null)
  const inMemoryResponseCacheRef = useRef<Map<string, EntityBrowserResponse>>(new Map())
  const inFlightControllerRef = useRef<AbortController | null>(null)

  const [data, setData] = useState<EntityBrowserResponse | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [gridLoading, setGridLoading] = useState(false)
  const [showGridSkeleton, setShowGridSkeleton] = useState(false)
  const [visibleCount, setVisibleCount] = useState(12)
  const [error, setError] = useState<string | null>(null)
  const [dataSource, setDataSource] = useState<'cache' | 'supabase' | null>(null)
  const [searchTerm, setSearchTerm] = useState(initialState.searchTerm)
  const [appliedSearchTerm, setAppliedSearchTerm] = useState(initialState.appliedSearchTerm)
  const deferredSearchTerm = useDeferredValue(searchTerm)
  const [autocompleteLoading, setAutocompleteLoading] = useState(false)
  const [autocompleteEntities, setAutocompleteEntities] = useState<AutocompleteEntity[]>([])
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null)
  const [currentPage, setCurrentPage] = useState(initialState.page)

  const [taxonomy, setTaxonomy] = useState<{
    sports: string[]
    leagues: string[]
    leaguesBySport: Record<string, string[]>
  }>({
    sports: [],
    leagues: [],
    leaguesBySport: {},
  })

  const [filters, setFilters] = useState<BrowserFilters>(initialState.filters)

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

  const buildEntityQueryParams = useCallback((page: number, searchValue: string) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: filters.limit,
      entityType: filters.entityType,
      sport: filters.sport,
      league: filters.league,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder
    })

    if (searchValue.trim()) {
      params.append('search', searchValue.trim())
    }

    return params
  }, [filters.entityType, filters.sport, filters.league, filters.limit, filters.sortBy, filters.sortOrder])

  useEffect(() => {
    const loadTaxonomy = async () => {
      try {
        const response = await fetch('/api/entities/taxonomy')
        if (!response.ok) return
        const result = await response.json()
        setTaxonomy({
          sports: Array.isArray(result.sports) ? result.sports : [],
          leagues: Array.isArray(result.leagues) ? result.leagues : [],
          leaguesBySport: result.leaguesBySport || {},
        })
      } catch (err) {
        console.error('Failed to load entity taxonomy:', err)
      }
    }

    loadTaxonomy()
  }, [])

  const fetchEntities = useCallback(async (page: number, isInitial: boolean = false) => {
    const params = buildEntityQueryParams(page, appliedSearchTerm)
    const requestKey = params.toString()
    const cached = inMemoryResponseCacheRef.current.get(requestKey)
    if (cached) {
      setData(cached)
      setDataSource((cached as any).source || null)
      setError(null)
      if (isInitial) {
        setInitialLoading(false)
      } else {
        setGridLoading(false)
      }
      return
    }

    inFlightControllerRef.current?.abort()
    const controller = new AbortController()
    inFlightControllerRef.current = controller

    if (isInitial) {
      setInitialLoading(true)
    } else {
      setGridLoading(true)
    }
    setError(null)

    try {
      const response = await fetch(`/api/entities?${requestKey}`, { signal: controller.signal })
      if (!response.ok) {
        throw new Error(`Failed to fetch entities: ${response.status}`)
      }

      const result = await response.json()
      inMemoryResponseCacheRef.current.set(requestKey, result)
      setData(result)
      setDataSource(result.source || null)
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return
      }
      setError(err instanceof Error ? err.message : "Failed to fetch entities")
    } finally {
      if (isInitial) {
        setInitialLoading(false)
      } else {
        setGridLoading(false)
      }
      if (inFlightControllerRef.current === controller) {
        inFlightControllerRef.current = null
      }
    }
  }, [appliedSearchTerm, buildEntityQueryParams])

  const updateFilters = useCallback((updater: (prev: typeof filters) => typeof filters) => {
    setCurrentPage(1)
    setFilters(updater)
  }, [])

  useEffect(() => {
    const onPopState = () => {
      const next = getInitialBrowserState()
      setCurrentPage(next.page)
      setSearchTerm(next.searchTerm)
      setAppliedSearchTerm(next.appliedSearchTerm)
      setFilters(next.filters)
      lastFetchedRequestKeyRef.current = null
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    const browserUrl = buildBrowserUrlFromState(currentPage, filters, appliedSearchTerm)
    const currentUrl = `${window.location.pathname}${window.location.search}`

    if (browserUrl !== currentUrl) {
      window.history.pushState({ ...(window.history.state || {}), entityBrowserUrl: browserUrl }, '', browserUrl)
    }

    rememberEntityBrowserUrl(browserUrl)
    syncEntityBrowserHistory(browserUrl)
  }, [appliedSearchTerm, currentPage, filters, syncEntityBrowserHistory])

  const applyFilters = useCallback(() => {
    setAppliedSearchTerm(searchTerm)
    setCurrentPage(1)
    startTransition(() => {
      fetchEntities(1)
    })
  }, [fetchEntities, searchTerm])

  const resetAndReload = useCallback(() => {
    setSearchTerm("")
    setAppliedSearchTerm("")
    lastFetchedRequestKeyRef.current = null
    setFilters(DEFAULT_FILTERS)
    setCurrentPage(1)
  }, [])

  useEffect(() => {
    const term = deferredSearchTerm.trim()
    if (term.length < 2) {
      setAutocompleteEntities([])
      setAutocompleteLoading(false)
      return
    }

    const controller = new AbortController()
    const loadAutocomplete = async () => {
      setAutocompleteLoading(true)
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
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setAutocompleteEntities([])
        }
      } finally {
        setAutocompleteLoading(false)
      }
    }

    loadAutocomplete()
    return () => controller.abort()
  }, [deferredSearchTerm])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const requestKey = buildEntityQueryParams(currentPage, appliedSearchTerm).toString()
      if (lastFetchedRequestKeyRef.current === requestKey) {
        return
      }

      lastFetchedRequestKeyRef.current = requestKey
      const isInitial = !data
      fetchEntities(currentPage, isInitial)
    }
  }, [appliedSearchTerm, buildEntityQueryParams, currentPage, data, fetchEntities])

  useEffect(() => {
    if (!gridLoading) {
      setShowGridSkeleton(false)
      return
    }
    const timeout = setTimeout(() => setShowGridSkeleton(true), 140)
    return () => clearTimeout(timeout)
  }, [gridLoading])

  useEffect(() => {
    setVisibleCount(12)
  }, [data?.pagination?.page, data?.pagination?.total, filters.limit, showGridSkeleton])

  useEffect(() => {
    if (showGridSkeleton) return
    const total = data?.entities?.length ?? 0
    if (visibleCount >= total) return

    let timeout: ReturnType<typeof setTimeout> | null = null
    timeout = setTimeout(() => {
      setVisibleCount((prev) => Math.min(total, prev + 12))
    }, 32)

    return () => {
      if (timeout) clearTimeout(timeout)
    }
  }, [data?.entities?.length, showGridSkeleton, visibleCount])

  useEffect(() => {
    if (!data?.pagination?.hasNext) return
    const nextPage = data.pagination.page + 1
    const params = buildEntityQueryParams(nextPage, appliedSearchTerm)
    const requestKey = params.toString()
    if (inMemoryResponseCacheRef.current.has(requestKey)) return

    const controller = new AbortController()
    fetch(`/api/entities?${requestKey}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (result) {
          inMemoryResponseCacheRef.current.set(requestKey, result)
        }
      })
      .catch(() => {})

    return () => controller.abort()
  }, [appliedSearchTerm, buildEntityQueryParams, data?.pagination?.hasNext, data?.pagination?.page])

  const handleEmailEntity = (entity: Entity) => {
    setSelectedEntity(entity)
    setShowEmailModal(true)
  }

  const exportToJSON = () => {
    if (!data) return

    const exportData = {
      entities: data.entities,
      pagination: data.pagination,
      filters: data.filters,
      exportDate: new Date().toISOString(),
      totalEntities: data.pagination.total
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

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Database className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <h2 className="text-xl font-semibold mb-2">Loading Entities</h2>
          <p className="text-muted-foreground">Loading first page quickly...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <Database className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Error Loading Entities</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => fetchEntities(currentPage, false)} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) {
    return null
  }

  const entities = data.entities || []
  const visibleEntities = entities.slice(0, visibleCount)
  const availableLeagues = filters.sport !== 'all'
    ? taxonomy.leaguesBySport[filters.sport] || []
    : taxonomy.leagues

  const activeFilters: Array<{ key: 'sport' | 'entityType' | 'league' | 'search'; label: string }> = []
  if (filters.sport !== 'all') {
    activeFilters.push({ key: 'sport', label: `Sport: ${filters.sport}` })
  }
  if (filters.entityType !== 'all') {
    activeFilters.push({ key: 'entityType', label: `Type: ${filters.entityType}` })
  }
  if (filters.league !== 'all') {
    activeFilters.push({ key: 'league', label: `League: ${filters.league}` })
  }
  if (appliedSearchTerm.trim()) {
    activeFilters.push({ key: 'search', label: `Search: ${appliedSearchTerm.trim()}` })
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Database className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">Entity Browser</h1>
            </div>
          </div>
          <p className="text-muted-foreground">
            Browse all entities in your graph intelligence store with their complete schemas
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/entity-import">Import CSV</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/rfps">View RFPs</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="mb-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sport</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={filters.sport === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateFilters((prev) => ({ ...prev, sport: 'all', league: 'all' }))}
                >
                  All Sports
                </Button>
                {taxonomy.sports.map((sport) => (
                  <Button
                    key={sport}
                    variant={filters.sport === sport ? 'default' : 'outline'}
                    size="sm"
                    onClick={() =>
                      updateFilters((prev) => ({
                        ...prev,
                        sport,
                        league: (taxonomy.leaguesBySport[sport] || []).includes(prev.league) ? prev.league : 'all',
                      }))
                    }
                  >
                    {sport}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search entities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      applyFilters()
                    }
                  }}
                  className="pl-10"
                />
                {(autocompleteLoading || autocompleteEntities.length > 0) && (
                  <div className="absolute z-20 mt-1 w-full rounded-md border bg-background p-2 shadow-lg">
                    {autocompleteLoading ? (
                      <p className="text-xs text-muted-foreground px-1 py-1">Loading suggestions...</p>
                    ) : (
                      autocompleteEntities.map((entity) => (
                        <button
                          key={entity.id}
                          className="flex w-full items-center justify-between rounded-sm px-2 py-1 text-left text-sm hover:bg-accent"
                          onClick={() => {
                            setSearchTerm(entity.name || "")
                            setAppliedSearchTerm(entity.name || "")
                            setAutocompleteEntities([])
                            setCurrentPage(1)
                            startTransition(() => fetchEntities(1))
                          }}
                          type="button"
                        >
                          <span className="truncate">{entity.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{entity.type || "Entity"}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <Select
                value={filters.sport}
                onValueChange={(value) => {
                  updateFilters((prev) => ({
                    ...prev,
                    sport: value,
                    league: value === 'all'
                      ? 'all'
                      : ((taxonomy.leaguesBySport[value] || []).includes(prev.league) ? prev.league : 'all'),
                  }))
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sport" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sports</SelectItem>
                  {taxonomy.sports.map((sport) => (
                    <SelectItem key={sport} value={sport}>
                      {sport}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.entityType} onValueChange={(value) => updateFilters(prev => ({ ...prev, entityType: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Entity Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="team">Team</SelectItem>
                  <SelectItem value="league">League</SelectItem>
                  <SelectItem value="federation">Federation</SelectItem>
                  <SelectItem value="rights_holder">Rights Holder</SelectItem>
                  <SelectItem value="organisation">Organisation</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.league} onValueChange={(value) => updateFilters(prev => ({ ...prev, league: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="League / Parent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Leagues</SelectItem>
                  {availableLeagues.map((league) => (
                    <SelectItem key={league} value={league}>
                      {league}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.sortBy} onValueChange={(value) => updateFilters(prev => ({ ...prev, sortBy: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="popular">Popular</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="type">Type</SelectItem>
                  <SelectItem value="sport">Sport</SelectItem>
                  <SelectItem value="country">Country</SelectItem>
                  <SelectItem value="priorityScore">Priority Score</SelectItem>
                  <SelectItem value="estimatedValue">Estimated Value</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.sortOrder} onValueChange={(value) => updateFilters(prev => ({ ...prev, sortOrder: value as "asc" | "desc" }))}>
                <SelectTrigger>
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascending</SelectItem>
                  <SelectItem value="desc">Descending</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.limit} onValueChange={(value) => updateFilters(prev => ({ ...prev, limit: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Per Page" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 per page (Fast)</SelectItem>
                  <SelectItem value="10">10 per page (Default)</SelectItem>
                  <SelectItem value="20">20 per page</SelectItem>
                  <SelectItem value="50">50 per page</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 mt-4">
              <Button onClick={applyFilters} variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Apply Filters
              </Button>
              <Button onClick={resetAndReload} variant="outline" size="sm">
                Reset
              </Button>
              <Button onClick={exportToJSON} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export JSON
              </Button>
              <Badge variant="outline" className="ml-auto">
                Showing {entities.length} of {data.pagination.total.toLocaleString()} entities
              </Badge>
            </div>

            {activeFilters.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {activeFilters.map((chip) => (
                  <Button
                    key={chip.key}
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (chip.key === 'search') {
                        setSearchTerm('')
                        setAppliedSearchTerm('')
                        setCurrentPage(1)
                        return
                      }
                      if (chip.key === 'sport') {
                        updateFilters((prev) => ({ ...prev, sport: 'all', league: 'all' }))
                        return
                      }
                      if (chip.key === 'entityType') {
                        updateFilters((prev) => ({ ...prev, entityType: 'all' }))
                        return
                      }
                      updateFilters((prev) => ({ ...prev, league: 'all' }))
                    }}
                  >
                    {chip.label}
                    <X className="ml-2 h-3 w-3" />
                  </Button>
                ))}
                <Button onClick={resetAndReload} variant="ghost" size="sm">
                  Clear all
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {showGridSkeleton ? (
            Array.from({ length: parseInt(filters.limit, 10) || 10 }).map((_, index) => (
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
            ))
          ) : (
                visibleEntities.map((entity) => (
                  <ViewportDeferredCard key={`${entity.id}-${String(entity.graph_id ?? entity.id)}`}>
                    <EntityCard
                      entity={entity}
                      onEmailEntity={handleEmailEntity}
                    />
                  </ViewportDeferredCard>
                ))
              )}
            </div>

        <div className="flex items-center justify-between mt-8">
          <Button
            variant="outline"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={!data.pagination.hasPrev}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>

          <div className="text-sm text-muted-foreground">
            Page {data.pagination.page} of {data.pagination.totalPages}
            <span className="ml-2">
              ({((data.pagination.page - 1) * data.pagination.limit + 1)} - {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)} of {data.pagination.total})
            </span>
          </div>

          <Button
            variant="outline"
            onClick={() => setCurrentPage((prev) => Math.min(data.pagination.totalPages, prev + 1))}
            disabled={!data.pagination.hasNext}
          >
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>

      {showEmailModal && selectedEntity && (
        <EmailComposeModal
          isOpen={showEmailModal}
          onClose={() => {
            setShowEmailModal(false)
            setSelectedEntity(null)
          }}
          contact={{
            id: selectedEntity.id.toString(),
            name: selectedEntity.properties.name || 'Unknown',
            email: formatEmail(selectedEntity.properties.email) || 'no-email@example.com',
            role: selectedEntity.properties.title || 'Contact',
            affiliation: selectedEntity.properties.company || selectedEntity.labels.join(', ') || 'Organization',
            tags: selectedEntity.labels
          }}
        />
      )}
    </div>
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
