"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  ChevronRight
} from "lucide-react"

interface Entity {
  id: string
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

export default function EntityBrowserPage() {
  const [data, setData] = useState<EntityBrowserResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null)

  // Filter and sort state
  const [filters, setFilters] = useState({
    entityType: "all",
    sortBy: "name",
    sortOrder: "asc" as "asc" | "desc",
    limit: "20"
  })

  const [currentPage, setCurrentPage] = useState(1)

  const fetchEntities = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: filters.limit,
        entityType: filters.entityType,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch entities")
    } finally {
      setLoading(false)
    }
  }, [currentPage, filters, debouncedSearchTerm])

  // Debounce search term to prevent excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500) // 500ms delay

    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    // Only fetch on client side
    if (typeof window !== 'undefined') {
      fetchEntities()
    }
  }, [fetchEntities, filters, currentPage])

  const formatPropertyValue = (value: any): string => {
    if (value === null || value === undefined) return "null"
    if (typeof value === 'string') return value
    if (typeof value === 'number') return value.toString()
    if (typeof value === 'boolean') return value ? "true" : "false"
    if (Array.isArray(value)) return `[${value.length} items]`
    if (typeof value === 'object') return JSON.stringify(value, null, 2)
    return String(value)
  }

  const getPropertyType = (value: any): string => {
    if (value === null || value === undefined) return "null"
    if (Array.isArray(value)) return "array"
    return typeof value
  }

  const entities = data?.entities || []

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Database className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <h2 className="text-xl font-semibold mb-2">Loading Entities</h2>
          <p className="text-muted-foreground">Fetching entities from Neo4j...</p>
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
            <Button onClick={fetchEntities} variant="outline">
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
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Controls */}
        <Card className="mb-6">
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
                  <SelectItem value="10">10 per page</SelectItem>
                  <SelectItem value="20">20 per page</SelectItem>
                  <SelectItem value="50">50 per page</SelectItem>
                  <SelectItem value="100">100 per page</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 mt-4">
              <Button onClick={fetchEntities} variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Apply Filters
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

        {/* Entity Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {entities.map((entity) => (
            <Card key={entity.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg leading-tight mb-2">
                      {entity.properties.name || `Entity ${entity.id}`}
                    </CardTitle>
                    <div className="flex gap-2 flex-wrap">
                      {entity.labels.map((label) => (
                        <Badge key={label} variant="secondary" className="text-xs">
                          {label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Key Properties */}
                {entity.properties.type && (
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Type:</span>
                    <span className="ml-2 text-sm">{entity.properties.type}</span>
                  </div>
                )}

                {entity.properties.sport && (
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Sport:</span>
                    <span className="ml-2 text-sm">{entity.properties.sport}</span>
                  </div>
                )}

                {entity.properties.country && (
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Country:</span>
                    <span className="ml-2 text-sm">{entity.properties.country}</span>
                  </div>
                )}

                {entity.properties.description && (
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Description:</span>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {entity.properties.description}
                    </p>
                  </div>
                )}

                {/* Property Count */}
                <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
                  <div className="flex items-center">
                    <Hash className="inline h-3 w-3 mr-1" />
                    {Object.keys(entity.properties).length} properties
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedEntity(selectedEntity?.id === entity.id ? null : entity)}
                    className="h-6 px-2 text-xs"
                  >
                    {selectedEntity?.id === entity.id ? (
                      <>
                        <EyeOff className="h-3 w-3 mr-1" />
                        Hide
                      </>
                    ) : (
                      <>
                        <Eye className="h-3 w-3 mr-1" />
                        Show Properties
                      </>
                    )}
                  </Button>
                </div>

                {/* Full Schema (Expanded) */}
                {selectedEntity?.id === entity.id && (
                  <div className="border-t pt-4 mt-4 animate-in fade-in-0 zoom-in-95 duration-200">
                    <div className="flex items-center gap-2 mb-3">
                      <ChevronDown className="h-4 w-4 text-primary" />
                      <h4 className="text-sm font-medium">All Properties ({Object.keys(entity.properties).length})</h4>
                    </div>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {Object.entries(entity.properties).map(([key, value]) => (
                        <div key={key} className="group bg-muted/30 hover:bg-muted/50 p-3 rounded-lg border border-border/50 transition-all duration-200">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors" />
                              <span className="font-mono font-medium text-sm">{key}</span>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {getPropertyType(value)}
                            </Badge>
                          </div>
                          <div className="ml-5 text-sm text-muted-foreground break-all">
                            {formatPropertyValue(value)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pagination */}
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
      </div>
    </div>
  )
}