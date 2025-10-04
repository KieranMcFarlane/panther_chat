"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EntityBadge } from "@/components/badge/EntityBadge"
import { EntityCard } from "@/components/EntityCard"
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
  SearchIcon,
  ChevronDown,
  ChevronRight,
  Settings,
  Image,
  FileText,
  BarChart3
} from "lucide-react"
import { useRouter } from "next/navigation"
import { usePaginatedEntities, usePaginatedPrefetch } from "@/lib/swr-config"
import { useDossierCopilotActions } from "@/lib/dossier-copilot-actions"

interface Entity {
  id: string
  neo4j_id: string | number
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

function EntityBrowserPageContent() {
  console.log("🔍 EntityBrowserPage: Component mounting with SWR")
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const { prefetchPage } = usePaginatedPrefetch()
  
  // Initialize CopilotKit actions for dossier generation
  useDossierCopilotActions()
  
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [showBadgeInfo, setShowBadgeInfo] = useState(false)

  // Get page from URL or default to 1
  const urlPage = searchParams.get('page')
  const currentPage = parseInt(urlPage) || 1

  // Filter and sort state
  const [filters, setFilters] = useState({
    entityType: "all",
    sortBy: "name",
    sortOrder: "asc" as "asc" | "desc",
    limit: "10" // Show 10 per page
  })

  // Memoize filters to prevent unnecessary re-fetches
  const memoizedFilters = useMemo(() => filters, [filters.entityType, filters.sortBy, filters.sortOrder, filters.limit])

  // Use SWR for paginated entities
  const { data, error, isLoading, isValidating } = usePaginatedEntities(currentPage, memoizedFilters, debouncedSearchTerm)
  
  const entities = data?.entities || []
  const dataSource = data?.source || null

  
  // Debounce search term to prevent excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300) // Reduced to 300ms for better UX

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Update URL when page changes (internal navigation)
  const updatePageInUrl = useCallback((newPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (newPage === 1) {
      params.delete('page')
    } else {
      params.set('page', newPage.toString())
    }
    
    const newUrl = `/entity-browser${params.toString() ? `?${params.toString()}` : ''}`
    router.push(newUrl, { scroll: false })
  }, [searchParams, router])

  // Reset to page 1 when search term or filters change
  useEffect(() => {
    updatePageInUrl(1)
  }, [debouncedSearchTerm, filters.entityType, filters.sortBy, filters.sortOrder, filters.limit])

  // Reset and reload when filters change
  const resetAndReload = useCallback(() => {
    updatePageInUrl(1)
  }, [updatePageInUrl])

  // Prefetch next page when hovering or after a delay
  const prefetchNextPage = useCallback(() => {
    if (data?.pagination?.hasNext) {
      prefetchPage(currentPage + 1, memoizedFilters, debouncedSearchTerm)
    }
  }, [currentPage, data?.pagination?.hasNext, memoizedFilters, debouncedSearchTerm, prefetchPage])

  // Auto-prefetch next page after 2 seconds of inactivity
  useEffect(() => {
    const timer = setTimeout(() => {
      prefetchNextPage()
    }, 2000)

    return () => clearTimeout(timer)
  }, [prefetchNextPage])

  const exportToJSON = () => {
    if (!data) return
    
    const exportData = {
      entities: entities,
      metadata: {
        total: data.pagination.total,
        page: data.pagination.page,
        filters: data.filters,
        exportedAt: new Date().toISOString()
      }
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

  if (isLoading && !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Database className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <h2 className="text-xl font-semibold mb-2">Loading Entities</h2>
          <p className="text-muted-foreground">Loading with SWR caching...</p>
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
            <p className="text-muted-foreground mb-4">{error instanceof Error ? error.message : String(error)}</p>
            <Button onClick={() => window.location.reload()} variant="outline">
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
            <div className="flex items-center gap-2 ml-auto">
              {/* Cache Status Indicator */}
              {dataSource && (
                <Badge 
                  variant={dataSource === 'cache' ? 'default' : 'secondary'}
                  className="flex items-center gap-1"
                >
                  <Database className="h-3 w-3" />
                  {dataSource === 'cache' ? 'Cached' : 'Live'}
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBadgeInfo(!showBadgeInfo)}
                className="flex items-center gap-2"
              >
                <Image className="h-4 w-4" />
                {showBadgeInfo ? 'Hide' : 'Show'} Badge Info
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.href = '/knowledge-graph'}
                className="flex items-center gap-2"
              >
                <SearchIcon className="h-4 w-4" />
                Back to Search
              </Button>
              <Badge variant="secondary">
                {data.pagination.total.toLocaleString()} entities
              </Badge>
            </div>
          </div>
          <p className="text-muted-foreground">
            Browse all entities in your Neo4j knowledge graph with their complete schemas
          </p>
          
          {/* Intelligence Features */}
          <div className="flex items-center gap-2 mt-4">
            <Badge variant="outline" className="flex items-center gap-1 text-blue-600 border-blue-600">
              <BarChart3 className="h-3 w-3" />
              Intelligence Dossiers Available
            </Badge>
            <span className="text-sm text-muted-foreground">
              Click "Generate Intelligence Dossier" on any entity card for comprehensive analysis
            </span>
          </div>
          
          {/* Badge Info Panel */}
          {showBadgeInfo && (
            <Card className="mt-4 border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Image className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-blue-800">Badge System Active</h3>
                </div>
                <div className="text-sm text-blue-700 space-y-1">
                  <p>• Entity badges are automatically displayed for each entity</p>
                  <p>• Badges are sourced from TheSportsDB and local files</p>
                  <p>• Fallback initials/icons show when badges aren't available</p>
                  <p>• Badge colors indicate entity type: <span className="font-medium">Blue=Club, Yellow=League, Green=Event, Gray=Organization</span></p>
                </div>
                <div className="flex gap-2 mt-3">
                  <Badge variant="outline" className="text-xs">
                    5 Badges Loaded
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Auto-mapping Active
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Smart Fallbacks
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 min-h-screen flex flex-col">
        {/* Controls - Fixed Header */}
        <Card className="mb-6 flex-shrink-0">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search entities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
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

              {/* Sort By */}
              <Select value={filters.sortBy} onValueChange={(value) => setFilters(prev => ({ ...prev, sortBy: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
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

        {/* Main Content Area - Takes remaining space */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Entity Grid - Scrollable if needed */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          {isValidating && data ? (
            // Show loading overlay while keeping existing data
            entities.map((entity) => (
              <div key={`${entity.id}-${entity.neo4j_id}`} className="relative">
                <EntityCard entity={entity} />
                {isValidating && (
                  <div className="absolute inset-0 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                    <Database className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
              </div>
            ))
          ) : (
            entities.map((entity) => (
              <EntityCard
                key={`${entity.id}-${entity.neo4j_id}`}
                entity={entity}
              />
            ))
          )}
          </div>

          {/* Pagination - Fixed Bottom */}
          <div className="flex-shrink-0 border-t pt-6 mt-6">
            {data && (
              <>
                {/* Quick Page Navigation */}
                {data.pagination.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mb-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updatePageInUrl(1)}
                  disabled={currentPage === 1 || isLoading}
                  onMouseEnter={() => currentPage !== 1 && prefetchPage(1, memoizedFilters, debouncedSearchTerm)}
                >
                  First
                </Button>
                
                {/* Page numbers */}
                {Array.from({ length: Math.min(5, data.pagination.totalPages) }, (_, i) => {
                  let pageNum
                  if (data.pagination.totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= data.pagination.totalPages - 2) {
                    pageNum = data.pagination.totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "ghost"}
                      size="sm"
                      onClick={() => updatePageInUrl(pageNum)}
                      disabled={isLoading}
                      onMouseEnter={() => currentPage !== pageNum && prefetchPage(pageNum, memoizedFilters, debouncedSearchTerm)}
                    >
                      {pageNum}
                    </Button>
                  )
                })}
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updatePageInUrl(data.pagination.totalPages)}
                  disabled={currentPage === data.pagination.totalPages || isLoading}
                  onMouseEnter={() => currentPage !== data.pagination.totalPages && prefetchPage(data.pagination.totalPages, memoizedFilters, debouncedSearchTerm)}
                >
                  Last
                </Button>
              </div>
            )}

            {/* Traditional Pagination (for accessibility) */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => updatePageInUrl(Math.max(1, currentPage - 1))}
                disabled={!data.pagination.hasPrev || isLoading}
                onMouseEnter={() => data.pagination.hasPrev && prefetchPage(currentPage - 1, memoizedFilters, debouncedSearchTerm)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
                {isLoading && currentPage === currentPage - 1 && (
                  <Database className="h-4 w-4 ml-2 animate-spin" />
                )}
              </Button>

              <div className="text-sm text-muted-foreground">
                Page {data.pagination.page} of {data.pagination.totalPages}
                <span className="ml-2">
                  ({((data.pagination.page - 1) * data.pagination.limit + 1)} - {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)} of {data.pagination.total})
                </span>
                {isValidating && (
                  <span className="ml-2 text-blue-600">
                    <Database className="h-3 w-3 inline animate-spin" />
                    Updating...
                  </span>
                )}
              </div>

              <Button
                variant="outline"
                onClick={() => updatePageInUrl(Math.min(data.pagination.totalPages, currentPage + 1))}
                disabled={!data.pagination.hasNext || isLoading}
                onMouseEnter={() => data.pagination.hasNext && prefetchPage(currentPage + 1, memoizedFilters, debouncedSearchTerm)}
              >
                Next
                {isLoading && currentPage === currentPage + 1 && (
                  <Database className="h-4 w-4 ml-2 animate-spin" />
                )}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  </div>
  )
}

export default function EntityBrowserPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Database className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <h2 className="text-xl font-semibold mb-2">Loading Entities</h2>
          <p className="text-muted-foreground">Loading search parameters...</p>
        </div>
      </div>
    }>
      <EntityBrowserPageContent />
    </Suspense>
  )
}