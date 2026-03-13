"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EntityBadge } from "@/components/badge/EntityBadge"
import { EntityCard } from "@/components/EntityCard"
import { rememberEntityBrowserUrl } from "@/lib/entity-browser-history"
import { useSearchParams } from "next/navigation"
// import { SimpleEntityCard } from "@/components/SimpleEntityCard"
import { EmailComposeModal } from "@/components/email/EmailComposeModal"
import { 
  Database, 
  Search, 
  Filter, 
  ArrowUpDown, 
  ArrowLeft, 
  ArrowRight, 
  Download,
  Eye,
  EyeOff,
  Hash,
  ChevronDown,
  ChevronRight,
  Settings,
  Mail,
  ExternalLink,
  Sparkles
} from "lucide-react"

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
    country?: string
    entityClass?: string
    sortBy: string
    sortOrder: string
  }
}

interface EntityTaxonomyResponse {
  sports: string[]
  leagues: string[]
  countries: string[]
  entityClasses: string[]
  leaguesBySport: Record<string, string[]>
}

interface SearchSuggestion {
  id: string
  name: string
  type?: string
  sport?: string
  country?: string
  source: "lexical" | "semantic"
}

const DEFAULT_FILTERS = {
  entityType: "all",
  sport: "all",
  league: "all",
  country: "all",
  entityClass: "all",
  sortBy: "popular",
  sortOrder: "desc" as "asc" | "desc",
  limit: "10",
}

type BrowserFilters = typeof DEFAULT_FILTERS

function getInitialBrowserState() {
  if (typeof window === "undefined") {
    return {
      page: 1,
      searchTerm: "",
      debouncedSearchTerm: "",
      filters: DEFAULT_FILTERS,
    }
  }

  const params = new URLSearchParams(window.location.search)
  const parsedPage = Number.parseInt(params.get("page") || "1", 10)
  const page = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage
  const searchValue = params.get("search")?.trim() || ""
  const sortOrder = params.get("sortOrder") === "asc" ? "asc" : "desc"

  return {
    page,
    searchTerm: searchValue,
    debouncedSearchTerm: searchValue,
    filters: {
      entityType: params.get("entityType") || DEFAULT_FILTERS.entityType,
      sport: params.get("sport") || DEFAULT_FILTERS.sport,
      league: params.get("league") || DEFAULT_FILTERS.league,
      country: params.get("country") || DEFAULT_FILTERS.country,
      entityClass: params.get("entityClass") || DEFAULT_FILTERS.entityClass,
      sortBy: params.get("sortBy") || DEFAULT_FILTERS.sortBy,
      sortOrder,
      limit: params.get("limit") || DEFAULT_FILTERS.limit,
    } satisfies BrowserFilters,
  }
}

function buildBrowserUrlFromState(page: number, filters: BrowserFilters, searchValue: string) {
  const params = new URLSearchParams()
  if (page > 1) params.set("page", String(page))
  if (searchValue.trim()) params.set("search", searchValue.trim())
  if (filters.entityType !== DEFAULT_FILTERS.entityType) params.set("entityType", filters.entityType)
  if (filters.sport !== DEFAULT_FILTERS.sport) params.set("sport", filters.sport)
  if (filters.league !== DEFAULT_FILTERS.league) params.set("league", filters.league)
  if (filters.country !== DEFAULT_FILTERS.country) params.set("country", filters.country)
  if (filters.entityClass !== DEFAULT_FILTERS.entityClass) params.set("entityClass", filters.entityClass)
  if (filters.sortBy !== DEFAULT_FILTERS.sortBy) params.set("sortBy", filters.sortBy)
  if (filters.sortOrder !== DEFAULT_FILTERS.sortOrder) params.set("sortOrder", filters.sortOrder)
  if (filters.limit !== DEFAULT_FILTERS.limit) params.set("limit", filters.limit)
  const query = params.toString()
  return `/entity-browser${query ? `?${query}` : ""}`
}

export default function EntityBrowserPage() {
  const initialState = getInitialBrowserState()
  const searchParams = useSearchParams()
  
  const [data, setData] = useState<EntityBrowserResponse | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [gridLoading, setGridLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dataSource, setDataSource] = useState<'cache' | 'supabase' | null>(null)
  const [searchTerm, setSearchTerm] = useState(initialState.searchTerm)
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(initialState.debouncedSearchTerm)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null)
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isUrlStateReady, setIsUrlStateReady] = useState(false)

  const [currentPage, setCurrentPage] = useState(initialState.page)
  const [taxonomy, setTaxonomy] = useState<EntityTaxonomyResponse>({
    sports: [],
    leagues: [],
    countries: [],
    entityClasses: [],
    leaguesBySport: {}
  })

  // Filter and sort state
  const [filters, setFilters] = useState<BrowserFilters>(initialState.filters)

  const fetchEntities = useCallback(async (page: number, isInitial: boolean = false) => {
    if (isInitial) {
      setInitialLoading(true)
    } else {
      setGridLoading(true)
    }
    setError(null)
    
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: filters.limit,
        entityType: filters.entityType,
        sport: filters.sport,
        league: filters.league,
        country: filters.country,
        entityClass: filters.entityClass,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder
        // useCache defaults to true
      })

      // Add search term if provided
      if (debouncedSearchTerm.trim()) {
        params.append('search', debouncedSearchTerm.trim())
      }

      const response = await fetch(`/api/entities?${params}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch entities: ${response.status}`)
      }
      
      const result = await response.json()
      
      setData(result)
      setDataSource(result.source || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch entities")
    } finally {
      if (isInitial) {
        setInitialLoading(false)
      } else {
        setGridLoading(false)
      }
    }
  }, [filters.entityType, filters.sport, filters.league, filters.country, filters.entityClass, filters.sortBy, filters.sortOrder, filters.limit, debouncedSearchTerm])

  useEffect(() => {
    const loadTaxonomy = async () => {
      try {
        const response = await fetch('/api/entities/taxonomy')
        if (!response.ok) return
        const payload = await response.json()
        setTaxonomy({
          sports: Array.isArray(payload.sports) ? payload.sports : [],
          leagues: Array.isArray(payload.leagues) ? payload.leagues : [],
          countries: Array.isArray(payload.countries) ? payload.countries : [],
          entityClasses: Array.isArray(payload.entityClasses) ? payload.entityClasses : [],
          leaguesBySport: payload.leaguesBySport || {}
        })
      } catch {
        // Non-blocking: filters still work with free text and type selector
      }
    }
    loadTaxonomy()
  }, [])

  // Reset and reload when filters change
  const resetAndReload = useCallback(() => {
    setCurrentPage(1)
  }, [])

  // Debounce search term to prevent excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500) // 500ms delay

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch entities when page or filters change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isInitial = initialLoading && currentPage === 1
      fetchEntities(currentPage, isInitial)
    }
  }, [currentPage, fetchEntities, initialLoading])

  useEffect(() => {
    if (!isUrlStateReady) return
    const browserUrl = buildBrowserUrlFromState(currentPage, filters, debouncedSearchTerm)
    const currentUrl = `${window.location.pathname}${window.location.search}`
    if (browserUrl !== currentUrl) {
      window.history.pushState({ ...(window.history.state || {}), entityBrowserUrl: browserUrl }, "", browserUrl)
    }
    rememberEntityBrowserUrl(browserUrl)
  }, [currentPage, debouncedSearchTerm, filters, isUrlStateReady])

  useEffect(() => {
    const onPopState = () => {
      const next = getInitialBrowserState()
      setCurrentPage(next.page)
      setSearchTerm(next.searchTerm)
      setDebouncedSearchTerm(next.debouncedSearchTerm)
      setFilters(next.filters)
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  useEffect(() => {
    const next = getInitialBrowserState()
    setCurrentPage((prev) => (prev === next.page ? prev : next.page))
    setSearchTerm((prev) => (prev === next.searchTerm ? prev : next.searchTerm))
    setDebouncedSearchTerm((prev) => (prev === next.debouncedSearchTerm ? prev : next.debouncedSearchTerm))
    setFilters((prev) => {
      const same =
        prev.entityType === next.filters.entityType &&
        prev.sport === next.filters.sport &&
        prev.league === next.filters.league &&
        prev.country === next.filters.country &&
        prev.entityClass === next.filters.entityClass &&
        prev.sortBy === next.filters.sortBy &&
        prev.sortOrder === next.filters.sortOrder &&
        prev.limit === next.filters.limit
      return same ? prev : next.filters
    })
    setIsUrlStateReady(true)
  }, [searchParams])

  useEffect(() => {
    if (filters.sortBy === 'popular' && filters.sortOrder !== 'desc') {
      setFilters((prev) => ({ ...prev, sortOrder: 'desc' }))
    }
  }, [filters.sortBy, filters.sortOrder])

  useEffect(() => {
    const query = debouncedSearchTerm.trim()
    if (query.length < 2) {
      setSuggestions([])
      setSuggestionsLoading(false)
      return
    }

    const controller = new AbortController()
    setSuggestionsLoading(true)

    const loadSuggestions = async () => {
      try {
        const [lexicalRes, semanticRes] = await Promise.all([
          fetch(`/api/entities/search?search=${encodeURIComponent(query)}&limit=6`, { signal: controller.signal }),
          fetch('/api/vector-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query,
              limit: 6,
              score_threshold: 0.15
            }),
            signal: controller.signal
          })
        ])

        const lexicalPayload = lexicalRes.ok ? await lexicalRes.json() : { entities: [] }
        const semanticPayload = semanticRes.ok ? await semanticRes.json() : { results: [] }

        const lexical: SearchSuggestion[] = (lexicalPayload.entities || []).map((entity: any) => ({
          id: String(entity.graph_id || entity.id || entity.entity_id || entity.name),
          name: String(entity.name || 'Unknown'),
          type: entity.type || '',
          sport: entity.sport || '',
          country: entity.country || '',
          source: 'lexical'
        }))

        const semantic: SearchSuggestion[] = (semanticPayload.results || []).map((result: any) => ({
          id: String(result.entity_id || result.id || result.name),
          name: String(result.name || 'Unknown'),
          type: result.type || '',
          source: 'semantic'
        }))

        const merged = [...lexical, ...semantic]
        const deduped: SearchSuggestion[] = []
        const seen = new Set<string>()
        for (const item of merged) {
          const key = `${item.id}::${item.name}`.toLowerCase()
          if (!seen.has(key)) {
            seen.add(key)
            deduped.push(item)
          }
          if (deduped.length >= 8) break
        }
        setSuggestions(deduped)
      } catch {
        setSuggestions([])
      } finally {
        setSuggestionsLoading(false)
      }
    }

    loadSuggestions()
    return () => controller.abort()
  }, [debouncedSearchTerm])

  // Email handling functions
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
  const sportScopedLeagues = filters.sport !== 'all'
    ? (taxonomy.leaguesBySport?.[filters.sport] || [])
    : taxonomy.leagues

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Controls */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-8 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search entities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => {
                    // Delay allows suggestion click to register first.
                    setTimeout(() => setShowSuggestions(false), 150)
                  }}
                  className="pl-10"
                />
                {showSuggestions && (searchTerm.trim().length >= 2 || suggestionsLoading) && (
                  <div className="absolute z-30 mt-1 w-full rounded-md border bg-background shadow-lg">
                    {suggestionsLoading ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">Searching...</div>
                    ) : suggestions.length > 0 ? (
                      <div className="max-h-72 overflow-y-auto">
                        {suggestions.map((suggestion) => (
                          <button
                            key={`${suggestion.source}-${suggestion.id}-${suggestion.name}`}
                            className="w-full px-3 py-2 text-left hover:bg-accent"
                            onMouseDown={(event) => {
                              event.preventDefault()
                              setSearchTerm(suggestion.name)
                              setDebouncedSearchTerm(suggestion.name)
                              setCurrentPage(1)
                              setShowSuggestions(false)
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-medium">{suggestion.name}</span>
                              <span className="inline-flex items-center text-[10px] text-muted-foreground">
                                {suggestion.source === 'semantic' && <Sparkles className="h-3 w-3 mr-1" />}
                                {suggestion.source}
                              </span>
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {[suggestion.type, suggestion.sport, suggestion.country].filter(Boolean).join(' • ')}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="px-3 py-2 text-xs text-muted-foreground">No suggestions found</div>
                    )}
                  </div>
                )}
              </div>

              {/* Entity Type Filter */}
              <Select value={filters.entityType} onValueChange={(value) => setFilters(prev => ({ ...prev, entityType: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Entity Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Entity">Entity</SelectItem>
                  <SelectItem value="TopTierSport">Top Tier Sport</SelectItem>
                  <SelectItem value="Club">Club</SelectItem>
                  <SelectItem value="League">League</SelectItem>
                  <SelectItem value="Person">Person</SelectItem>
                </SelectContent>
              </Select>

              {/* Sport Filter */}
              <Select value={filters.sport} onValueChange={(value) => setFilters(prev => ({ ...prev, sport: value, league: 'all' }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Sport" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sports</SelectItem>
                  {taxonomy.sports.map((sport) => (
                    <SelectItem key={sport} value={sport}>{sport}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* League Filter */}
              <Select value={filters.league} onValueChange={(value) => setFilters(prev => ({ ...prev, league: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="League" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Leagues</SelectItem>
                  {sportScopedLeagues.map((league) => (
                    <SelectItem key={league} value={league}>{league}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Entity Class Filter */}
              <Select value={filters.entityClass} onValueChange={(value) => setFilters(prev => ({ ...prev, entityClass: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {taxonomy.entityClasses.map((entityClass) => (
                    <SelectItem key={entityClass} value={entityClass}>{entityClass}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Country Filter */}
              <Select value={filters.country} onValueChange={(value) => setFilters(prev => ({ ...prev, country: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  {taxonomy.countries.map((country) => (
                    <SelectItem key={country} value={country}>{country}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Sort By */}
              <Select value={filters.sortBy} onValueChange={(value) => setFilters(prev => ({ ...prev, sortBy: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="popular">Most Popular</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="type">Type</SelectItem>
                  <SelectItem value="sport">Sport</SelectItem>
                  <SelectItem value="country">Country</SelectItem>
                  <SelectItem value="priorityScore">Priority Score</SelectItem>
                  <SelectItem value="estimatedValue">Estimated Value</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort Order */}
              <Select value={filters.sortOrder} onValueChange={(value) => setFilters(prev => ({ ...prev, sortOrder: value as "asc" | "desc" }))}>
                <SelectTrigger>
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascending</SelectItem>
                  <SelectItem value="desc">Descending</SelectItem>
                </SelectContent>
              </Select>

              {/* Results Per Page */}
              <Select value={filters.limit} onValueChange={(value) => setFilters(prev => ({ ...prev, limit: value }))}>
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

            {/* Action Buttons */}
            <div className="flex gap-2 mt-4">
              <Button onClick={resetAndReload} variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Apply Filters
              </Button>
              <Button onClick={exportToJSON} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export JSON
              </Button>
              <Badge variant="outline" className="ml-auto">
                Showing {entities.length} of {data?.pagination.total?.toLocaleString() || '...'} entities
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Entity Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {gridLoading ? (
            // Show loading placeholders while maintaining grid layout
            Array.from({ length: parseInt(filters.limit) || 10 }).map((_, index) => (
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
            entities.map((entity) => (
              <EntityCard
                key={`${entity.id}-${String(entity.graph_id ?? entity.id)}`}
                entity={entity}
                onEmailEntity={handleEmailEntity}
              />
            ))
          )}
        </div>

        {!gridLoading && entities.length === 0 && (
          <Card className="mt-6">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No entities matched this filter combination. Try broadening sport, league, or class filters.
              </p>
            </CardContent>
          </Card>
        )}


        {/* Traditional Pagination (for accessibility) */}
        {data && (
          <div className="flex items-center justify-between mt-8">
            <Button
              variant="outline"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
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
              onClick={() => setCurrentPage(prev => Math.min(data.pagination.totalPages, prev + 1))}
              disabled={!data.pagination.hasNext}
            >
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </div>

      {/* Email Compose Modal */}
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

// Helper function to format email
function formatEmail(email: any): string {
  if (!email) return ""
  if (typeof email === 'string') return email
  if (typeof email === 'object' && email !== null) {
    // Handle Neo4j string type or similar objects
    if ('value' in email && email.value !== undefined) {
      return String(email.value)
    }
    if ('low' in email && 'high' in email && email.low !== undefined) {
      return String(email.low)
    }
    // If it's an object with email property
    if ('email' in email && email.email !== undefined) {
      return String(email.email)
    }
  }
  return String(email)
}
