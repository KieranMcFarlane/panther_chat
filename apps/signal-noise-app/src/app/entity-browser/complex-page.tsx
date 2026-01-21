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
  ChevronDown,
  ChevronRight,
  Settings,
  FileText,
  BarChart3
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useEntities, prefetchEntity } from "@/lib/swr-config"
import { useDossierCopilotActions } from "@/lib/dossier-copilot-actions"
import { Entity as BaseEntity } from "@/lib/neo4j"

interface Entity extends BaseEntity {
  neo4j_id: string | number
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
  // Initialize CopilotKit actions for dossier generation
  useDossierCopilotActions()
  
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [debugInfo, setDebugInfo] = useState("Initializing...")

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

  // Use SWR for paginated entities - simplified approach
  console.log("🔍 SWR hook call parameters:", {
    isClient,
    currentPage,
    memoizedFilters,
    debouncedSearchTerm
  })
  
  // Build URL for entities API
  const params = new URLSearchParams({
    page: currentPage.toString(),
    limit: filters.limit,
    entityType: filters.entityType,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder
  })
  
  if (debouncedSearchTerm.trim()) {
    params.append('search', debouncedSearchTerm.trim())
  }
  
  const url = `/api/entities?${params}`
  
  const { entities, pagination, error, isLoading } = useEntities(url)
  
  console.log("🔍 SWR result:", {
    entities: entities ? `Found ${entities.length} entities` : 'No data',
    error: error ? error.message : 'No error',
    isLoading
  })
  
  // Update debug info
  useEffect(() => {
    if (isLoading) {
      setDebugInfo(`Loading... (Page ${currentPage})`)
    } else if (error) {
      setDebugInfo(`Error: ${error.message}`)
    } else if (entities.length > 0) {
      setDebugInfo(`Loaded ${entities.length} entities (Page ${currentPage} of ${pagination?.totalPages || 1})`)
    } else {
      setDebugInfo("Ready to load data")
    }
  }, [entities, pagination, error, isLoading, currentPage])

  // Temporary direct fetch test to bypass SWR issues
  const [directData, setDirectData] = useState<any>(null)
  const [directLoading, setDirectLoading] = useState(true)
  const [directError, setDirectError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDirect = async () => {
      try {
        setDirectLoading(true)
        setDirectError(null)
        const params = new URLSearchParams({
          page: currentPage.toString(),
          limit: '10',
          entityType: 'all',
          sortBy: 'name',
          sortOrder: 'asc'
        })
        
        const response = await fetch(`/api/entities?${params}`)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const data = await response.json()
        console.log('🔍 Direct fetch result:', data)
        setDirectData(data)
      } catch (err) {
        console.error('🔍 Direct fetch error:', err)
        setDirectError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setDirectLoading(false)
      }
    }

    fetchDirect()
  }, [currentPage])

  
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

  
  
  const exportToJSON = () => {
    if (displayEntities.length === 0) return
    
    const exportData = {
      entities: entities,
      metadata: {
        total: displayPagination.total,
        page: displayPagination.page,
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

  // Use direct fetch data as fallback if SWR is not working
  const displayEntities = entities.length > 0 ? entities : (directData?.entities || [])
  const displayPagination = pagination || directData?.pagination
  const displayLoading = isLoading || directLoading
  const displayError = error || directError
  const displayDataSource = directData?.source || 'SWR'

  // Update debug info with direct fetch info
  useEffect(() => {
    if (directLoading) {
      setDebugInfo(`Direct loading... (Page ${currentPage})`)
    } else if (directError) {
      setDebugInfo(`Direct error: ${directError}`)
    } else if (directData) {
      setDebugInfo(`Direct loaded ${directData.entities?.length || 0} entities (Page ${currentPage})`)
    }
  }, [directData, directError, directLoading, currentPage])

  // Prefetch entity detail data for current page and next page
  useEffect(() => {
    if (displayEntities.length > 0 && !displayLoading && !isLoading) {
      // Prefetch current page (first 10) and next page (next 10)
      const entitiesToPrefetch = displayEntities.slice(0, 20)

      // Batch prefetch to avoid overwhelming the server
      const batchSize = 5
      entitiesToPrefetch.forEach((entity, index) => {
        const batchIndex = Math.floor(index / batchSize)
        setTimeout(() => {
          prefetchEntity(entity.neo4j_id.toString())
        }, batchIndex * 50) // Small delay between batches (50ms)
      })
    }
  }, [displayEntities, displayLoading, isLoading])

  if (displayLoading && !displayData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Database className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <h2 className="text-xl font-semibold mb-2">Loading Entities</h2>
          <p className="text-muted-foreground">Debug: {debugInfo}</p>
        </div>
      </div>
    )
  }

  if (displayError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <Database className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Error Loading Entities</h2>
            <p className="text-muted-foreground mb-4">{displayError}</p>
            <Button onClick={() => window.location.reload()} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!displayData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <Database className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Data Available</h2>
            <p className="text-muted-foreground mb-4">Debug info: {debugInfo}</p>
            <Button onClick={() => window.location.reload()} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Database className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold page-title">Entity Browser</h1>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Badge variant="outline" className="text-yellow-400">
                Debug: {debugInfo}
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
        </div>
      </div>

      {/* Sports Navigation */}
      <div className="flex items-center justify-center py-3 border-t border-white/10" style={{ background: '#1c1e2d' }}>
        <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
          <a href="/matches">
            <button className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 bg-white text-gray-900 shadow-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <span>Matches</span>
            </button>
          </a>
          <a href="/standings">
            <button className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 text-white/80 hover:text-white hover:bg-white/10">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="20" x2="12" y2="10"></line>
                <line x1="18" y1="20" x2="18" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="16"></line>
              </svg>
              <span>Standings</span>
            </button>
          </a>
          <a href="/players">
            <button className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 text-white/80 hover:text-white hover:bg-white/10">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="m22 21-3-3 3-3"></path>
                <path d="M16 11h4"></path>
              </svg>
              <span>Players</span>
            </button>
          </a>
          <a href="/transfers">
            <button className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 text-white/80 hover:text-white hover:bg-white/10">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 18h3l2-2-7-7 7-7V2l9 9-9 9z"></path>
                <path d="M22 6h-3l-2 2 7 7-7 7v-3L8 12l9-9z"></path>
              </svg>
              <span>Transfers</span>
            </button>
          </a>
          <a href="/news">
            <button className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 text-white/80 hover:text-white hover:bg-white/10">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"></path>
                <path d="M18 14h-8"></path>
                <path d="M15 18h-5"></path>
                <path d="M10 6h8v4h-8Z"></path>
              </svg>
              <span>News</span>
            </button>
          </a>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 min-h-screen flex flex-col" style={{ background: '#1c1e2d', position: 'relative', top: '-42px' }}>
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
          {/* Debug Info */}
          <Card className="mb-4 bg-yellow-50 border-yellow-200">
            <CardContent className="p-4">
              <div className="text-sm">
                <p><strong>Debug Info:</strong> {debugInfo}</p>
                <p><strong>Entities Count:</strong> {displayEntities.length}</p>
                <p><strong>SWR Loading:</strong> {isLoading ? 'Yes' : 'No'}</p>
                <p><strong>Direct Loading:</strong> {directLoading ? 'Yes' : 'No'}</p>
                                <p><strong>SWR Error:</strong> {error ? error.message : 'No'}</p>
                <p><strong>Direct Error:</strong> {directError || 'No'}</p>
                <p><strong>Data Source:</strong> {displayDataSource || 'None'}</p>
                <p><strong>Current Page:</strong> {currentPage}</p>
                {displayEntities.length > 0 && (
                  <p><strong>First Entity:</strong> {displayEntities[0]?.properties?.name || 'N/A'}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Entity Grid - Scrollable if needed */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          {isLoading && displayEntities.length > 0 ? (
            // Show loading overlay while keeping existing data
            displayEntities.map((entity) => (
              <div key={`${entity.id}-${entity.neo4j_id}`} className="relative">
                <EntityCard entity={entity} />
                {isLoading && (
                  <div className="absolute inset-0 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                    <Database className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
              </div>
            ))
          ) : (
            displayEntities.map((entity) => (
              <EntityCard
                key={`${entity.id}-${entity.neo4j_id}`}
                entity={entity}
              />
            ))
          )}
          
          {/* Show message if no entities */}
          {displayEntities.length === 0 && !displayLoading && !displayError && (
            <div className="col-span-full text-center py-12">
              <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No entities found</h3>
              <p className="text-muted-foreground">Try adjusting your filters or search terms.</p>
            </div>
          )}
          </div>

          {/* Pagination - Fixed Bottom */}
          <div className="flex-shrink-0 border-t pt-6 mt-6">
            {displayPagination && (
              <>
                {/* Quick Page Navigation */}
                {displayPagination.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mb-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updatePageInUrl(1)}
                  disabled={currentPage === 1 || isLoading}
                                  >
                  First
                </Button>
                
                {/* Page numbers */}
                {Array.from({ length: Math.min(5, displayPagination.totalPages) }, (_, i) => {
                  let pageNum
                  if (displayPagination.totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= displayPagination.totalPages - 2) {
                    pageNum = displayPagination.totalPages - 4 + i
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
                                          >
                      {pageNum}
                    </Button>
                  )
                })}
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updatePageInUrl(displayPagination.totalPages)}
                  disabled={currentPage === displayPagination.totalPages || isLoading}
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
                disabled={!displayPagination.hasPrev || isLoading}
                              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
                {isLoading && currentPage === currentPage - 1 && (
                  <Database className="h-4 w-4 ml-2 animate-spin" />
                )}
              </Button>

              <div className="text-sm text-muted-foreground">
                Page {displayPagination.page} of {displayPagination.totalPages}
                <span className="ml-2">
                  ({((displayPagination.page - 1) * displayPagination.limit + 1)} - {Math.min(displayPagination.page * displayPagination.limit, displayPagination.total)} of {displayPagination.total})
                </span>
                {isLoading && (
                  <span className="ml-2 text-blue-600">
                    <Database className="h-3 w-3 inline animate-spin" />
                    Updating...
                  </span>
                )}
              </div>

              <Button
                variant="outline"
                onClick={() => updatePageInUrl(Math.min(displayPagination.totalPages, currentPage + 1))}
                disabled={!displayPagination.hasNext || isLoading}
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