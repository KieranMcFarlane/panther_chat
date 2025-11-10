"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EntityBadge } from "@/components/badge/EntityBadge"
import { EntityCard } from "@/components/EntityCard"
// import { SimpleEntityCard } from "@/components/SimpleEntityCard"
import { EmailComposeModal } from "@/components/email/EmailComposeModal"
import { formatValue } from "@/lib/formatValue"
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
  ExternalLink
} from "lucide-react"

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

export default function EntityBrowserPage() {
  console.log("🔍 EntityBrowserPage: Component mounting")
  
  const [data, setData] = useState<EntityBrowserResponse | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [gridLoading, setGridLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dataSource, setDataSource] = useState<'cache' | 'neo4j' | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null)

  const [currentPage, setCurrentPage] = useState(1)

  // Filter and sort state
  const [filters, setFilters] = useState({
    entityType: "all",
    sortBy: "name",
    sortOrder: "asc" as "asc" | "desc",
    limit: "10" // Show 10 per page
  })

  const fetchEntities = useCallback(async (page: number = currentPage, isInitial: boolean = false) => {
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
  }, [currentPage, filters.entityType, filters.sortBy, filters.sortOrder, filters.limit, debouncedSearchTerm])

  // Reset and reload when filters change
  const resetAndReload = useCallback(() => {
    setCurrentPage(1)
    fetchEntities(1)
  }, [fetchEntities])

  // Debounce search term to prevent excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500) // 500ms delay

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Reset page when filters change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentPage(1)
    }
  }, [filters.entityType, filters.sortBy, filters.sortOrder, filters.limit, debouncedSearchTerm])

  // Fetch entities when page or filters change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isInitial = !data
      fetchEntities(currentPage, isInitial)
    }
  }, [currentPage, filters.entityType, filters.sortBy, filters.sortOrder, filters.limit, debouncedSearchTerm])

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
                key={`${entity.id}-${formatValue(entity.neo4j_id)}`}
                entity={entity}
                onEmailEntity={handleEmailEntity}
              />
            ))
          )}
        </div>


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