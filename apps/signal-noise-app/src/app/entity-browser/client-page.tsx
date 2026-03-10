"use client"

import Link from "next/link"
import { useState, useEffect, useCallback, useRef, useDeferredValue, startTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { FixedSizeList, type ListChildComponentProps } from "react-window"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EntityCard } from "@/components/EntityCard"
import { EmailComposeModal } from "@/components/email/EmailComposeModal"
import {
  Database,
  Search,
  Filter,
  ArrowUpDown,
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

export default function EntityBrowserClientPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialPageFromUrl = Number.parseInt(searchParams.get('page') || '1', 10)
  const lastFetchedRequestKeyRef = useRef<string | null>(null)

  const [data, setData] = useState<EntityBrowserResponse | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [gridLoading, setGridLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dataSource, setDataSource] = useState<'cache' | 'supabase' | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("")
  const deferredSearchTerm = useDeferredValue(searchTerm)
  const [autocompleteLoading, setAutocompleteLoading] = useState(false)
  const [autocompleteEntities, setAutocompleteEntities] = useState<AutocompleteEntity[]>([])
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null)
  const [currentPage, setCurrentPage] = useState(initialPageFromUrl)
  const [gridWidth, setGridWidth] = useState(0)
  const gridContainerRef = useRef<HTMLDivElement | null>(null)

  const [filters, setFilters] = useState({
    entityType: "all",
    sortBy: "popular",
    sortOrder: "desc" as "asc" | "desc",
    limit: "10"
  })

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
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder
    })

    if (searchValue.trim()) {
      params.append('search', searchValue.trim())
    }

    return params
  }, [filters.entityType, filters.limit, filters.sortBy, filters.sortOrder])

  const fetchEntities = useCallback(async (page: number, isInitial: boolean = false) => {
    if (isInitial) {
      setInitialLoading(true)
    } else {
      setGridLoading(true)
    }
      setError(null)

    try {
      const params = buildEntityQueryParams(page, appliedSearchTerm)
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
  }, [appliedSearchTerm, buildEntityQueryParams])

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
    startTransition(() => {
      fetchEntities(1)
    })
  }, [fetchEntities, searchTerm])

  const resetAndReload = useCallback(() => {
    setCurrentPage(1)
    startTransition(() => {
      fetchEntities(1)
    })
  }, [fetchEntities])

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
  }, [])

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
  const columnCount = gridWidth >= 1280 ? 3 : gridWidth >= 1024 ? 2 : 1
  const rowCount = Math.ceil(entities.length / columnCount)
  const rowHeight = 360
  const listHeight = Math.min(900, Math.max(rowHeight, rowCount * rowHeight))
  const columnGap = 24

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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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

              <Select value={filters.entityType} onValueChange={(value) => updateFilters(prev => ({ ...prev, entityType: value }))}>
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
          </CardContent>
        </Card>

        <div ref={gridContainerRef} className="w-full">
          {gridLoading ? (
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
                          key={`${entity.id}-${formatValue(entity.neo4j_id)}`}
                          entity={entity}
                          onEmailEntity={handleEmailEntity}
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
