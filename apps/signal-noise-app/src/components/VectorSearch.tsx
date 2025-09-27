"use client"

import { useState } from "react"
import { useVectorSearch, VectorSearchOptions } from "@/hooks/useVectorSearch"
import { EntityCard } from "@/components/EntityCard"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, Filter, RefreshCw, Database, Zap, Grid3X3 } from "lucide-react"


export function VectorSearch() {
  const [query, setQuery] = useState("")
  const [searchType, setSearchType] = useState<'vector' | 'text'>('vector')
  const [filters, setFilters] = useState<VectorSearchOptions>({
    limit: 12,
    threshold: 0.7,
    entityType: ''
  })
  
  const { results, loading, error } = useVectorSearch(query, filters, searchType)
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Database className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">Knowledge Graph Search</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.href = '/entity-browser'}
                className="flex items-center gap-2"
              >
                <Grid3X3 className="h-4 w-4" />
                Browse All Entities
              </Button>
              <Badge variant="secondary">
                {results.length} results
              </Badge>
            </div>
          </div>
          <p className="text-muted-foreground">
            AI-powered semantic search across your Neo4j knowledge graph
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Search Interface */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Knowledge Graph
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Main Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search for contacts, organizations, or entities... (e.g., 'Arsenal commercial director')"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10 h-12 text-base"
              />
            </div>

            {/* Search Type Toggle */}
            <div className="flex gap-2">
              <Button
                variant={searchType === 'vector' ? 'default' : 'outline'}
                onClick={() => setSearchType('vector')}
                className="flex items-center gap-2"
              >
                <Zap className="h-4 w-4" />
                Vector Search (AI)
              </Button>
              <Button
                variant={searchType === 'text' ? 'default' : 'outline'}
                onClick={() => setSearchType('text')}
                className="flex items-center gap-2"
              >
                <Search className="h-4 w-4" />
                Text Search
              </Button>
            </div>

            {/* Quick Filters */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <span className="text-sm font-medium">Quick Filters:</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge 
                  variant={filters.entityType === '' ? 'default' : 'secondary'}
                  className="cursor-pointer"
                  onClick={() => setFilters(prev => ({ 
                    ...prev, 
                    entityType: '' 
                  }))}
                >
                  All Entities
                </Badge>
                <Badge 
                  variant={filters.entityType === 'Person' ? 'default' : 'secondary'}
                  className="cursor-pointer"
                  onClick={() => setFilters(prev => ({ 
                    ...prev, 
                    entityType: prev.entityType === 'Person' ? '' : 'Person' 
                  }))}
                >
                  People
                </Badge>
                <Badge 
                  variant={filters.entityType === 'Organization' ? 'default' : 'secondary'}
                  className="cursor-pointer"
                  onClick={() => setFilters(prev => ({ 
                    ...prev, 
                    entityType: prev.entityType === 'Organization' ? '' : 'Organization' 
                  }))}
                >
                  Organizations
                </Badge>
                <Badge 
                  variant={filters.entityType === 'Contact' ? 'default' : 'secondary'}
                  className="cursor-pointer"
                  onClick={() => setFilters(prev => ({ 
                    ...prev, 
                    entityType: prev.entityType === 'Contact' ? '' : 'Contact' 
                  }))}
                >
                  Contacts
                </Badge>
                <Badge 
                  variant={filters.entityType === 'Club' ? 'default' : 'secondary'}
                  className="cursor-pointer"
                  onClick={() => setFilters(prev => ({ 
                    ...prev, 
                    entityType: prev.entityType === 'Club' ? '' : 'Club' 
                  }))}
                >
                  Sports Clubs
                </Badge>
              </div>
            </div>

            {/* Search Info */}
            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Database className="h-4 w-4" />
                <span className="font-medium">Search Information:</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium">Type:</span> {searchType === 'vector' ? 'AI Vector Search' : 'Text Search'}
                </div>
                <div>
                  <span className="font-medium">Threshold:</span> {(filters.threshold! * 100).toFixed(0)}%
                </div>
                <div>
                  <span className="font-medium">Limit:</span> {filters.limit} results
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Section */}
        {loading && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-primary mb-4" />
              <h3 className="text-lg font-medium mb-2">Searching Knowledge Graph...</h3>
              <p className="text-muted-foreground">
                {searchType === 'vector' 
                  ? 'Running AI-powered semantic search across your data' 
                  : 'Searching through entity names and descriptions'
                }
              </p>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="border-destructive">
            <CardContent className="p-6">
              <h3 className="text-lg font-medium text-destructive mb-2">Search Error</h3>
              <p className="text-sm text-destructive/80">{error}</p>
            </CardContent>
          </Card>
        )}

        {results.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">
                Search Results
              </h2>
              <p className="text-sm text-muted-foreground">
                Found {results.length} entities matching "{query}"
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {results.map((result, index) => (
                <EntityCard
                  key={result.entity.id}
                  entity={result.entity}
                  similarity={result.similarity}
                  connections={result.connections}
                  rank={index + 1}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && results.length === 0 && query && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-xl font-medium mb-2">No Results Found</h3>
              <p className="text-muted-foreground text-center max-w-md">
                We couldn't find any entities matching "{query}". Try:
              </p>
              <ul className="text-sm text-muted-foreground mt-4 text-center space-y-1">
                <li>• Using different keywords</li>
                <li>• Adjusting the search filters</li>
                <li>• Switching between Vector and Text search</li>
                <li>• Checking your spelling</li>
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Welcome State */}
        {!loading && !error && results.length === 0 && !query && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="text-6xl mb-4">🧠</div>
              <h3 className="text-2xl font-bold mb-4">Welcome to Knowledge Graph Search</h3>
              <p className="text-muted-foreground text-center max-w-2xl mb-6">
                This interface allows you to search through your Neo4j knowledge graph using AI-powered vector search. 
                Find similar entities, discover relationships, and explore your data in new ways.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left max-w-2xl">
                <div className="space-y-2">
                  <h4 className="font-medium">Try searching for:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• "Arsenal commercial director"</li>
                    <li>• "Sports intelligence contacts"</li>
                    <li>• "Premier League digital teams"</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Search Features:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• AI-powered semantic search</li>
                    <li>• Relationship discovery</li>
                    <li>• Entity type filtering</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}