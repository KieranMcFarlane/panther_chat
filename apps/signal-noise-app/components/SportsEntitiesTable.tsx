"use client"

import React, { useState, useEffect } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { ChevronDown, ExternalLink, Globe, Linkedin, Info } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

interface SportsEntity {
  name: string
  sport: string
  country: string
  level: string
  enriched: boolean
  type?: string
  website?: string
  linkedin?: string
  enrichment_summary?: string
  data_sources?: any
}

interface DatabaseOverview {
  total_entities: number
  sports_entities_count: number
  enriched_count: number
  success_rate: string
}

export default function SportsEntitiesTable() {
  const [entities, setEntities] = useState<SportsEntity[]>([])
  const [overview, setOverview] = useState<DatabaseOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedEntity, setExpandedEntity] = useState<string | null>(null)

  useEffect(() => {
    fetchSportsEntities()
  }, [])

  const fetchSportsEntities = async () => {
    try {
      const response = await fetch('/api/sports-entities')
      const data = await response.json()
      
      if (data.status === 'success') {
        setEntities(data.sports_entities)
        setOverview(data.database_overview)
      }
    } catch (error) {
      console.error('Failed to fetch sports entities:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleEntityExpansion = (entityName: string) => {
    setExpandedEntity(expandedEntity === entityName ? null : entityName)
  }

  const getEnrichmentData = async (entityName: string) => {
    try {
      const response = await fetch(`/api/dossier/direct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_name: entityName,
          entity_type: 'sports_club'
        })
      })
      return await response.json()
    } catch (error) {
      console.error('Failed to fetch enrichment data:', error)
      return null
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading sports entities...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Database Overview Cards */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Entities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview.total_entities}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Sports Teams
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview.sports_entities_count}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Enriched Teams
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview.enriched_count}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Success Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{overview.success_rate}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sports Entities Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>⚽ Sports Entities Knowledge Graph</span>
            <Badge variant="secondary">{entities.length} teams</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {entities.map((entity, index) => (
              <div key={index} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                {/* Entity Header */}
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg">{entity.name}</h3>
                      <Badge variant={entity.enriched ? "default" : "secondary"}>
                        {entity.enriched ? "✅ Enriched" : "⏳ Pending"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span>🏈 {entity.sport}</span>
                      <span>🌍 {entity.country}</span>
                      <span>🏆 {entity.level}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {entity.website && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={entity.website} target="_blank" rel="noopener noreferrer">
                          <Globe className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    
                    {entity.linkedin && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={entity.linkedin} target="_blank" rel="noopener noreferrer">
                          <Linkedin className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <ChevronDown className="h-4 w-4" />
                          Actions
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Entity Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => toggleEntityExpansion(entity.name)}>
                          <Info className="h-4 w-4 mr-2" />
                          {expandedEntity === entity.name ? 'Hide' : 'Show'} Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => getEnrichmentData(entity.name)}>
                          🔄 Refresh Enrichment
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          📊 View Analytics
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Expanded Entity Details */}
                {expandedEntity === entity.name && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Basic Info */}
                      <div>
                        <h4 className="font-medium mb-2">Basic Information</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Type:</span>
                            <span>{entity.type || 'Sports Club'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Sport:</span>
                            <span>{entity.sport}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Country:</span>
                            <span>{entity.country}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Level:</span>
                            <span>{entity.level}</span>
                          </div>
                        </div>
                      </div>

                      {/* Enrichment Status */}
                      <div>
                        <h4 className="font-medium mb-2">Enrichment Status</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Status:</span>
                            <Badge variant={entity.enriched ? "default" : "secondary"}>
                              {entity.enriched ? "Enriched" : "Pending"}
                            </Badge>
                          </div>
                          {entity.enriched && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Data Sources:</span>
                                <span>Perplexity + Bright Data</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Last Updated:</span>
                                <span>Recent</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Enrichment Summary */}
                    {entity.enrichment_summary && (
                      <div className="mt-4">
                        <h4 className="font-medium mb-2">AI Analysis Summary</h4>
                        <div className="bg-blue-50 p-3 rounded-lg text-sm">
                          {entity.enrichment_summary}
                        </div>
                      </div>
                    )}

                    {/* Data Sources */}
                    {entity.data_sources && (
                      <div className="mt-4">
                        <h4 className="font-medium mb-2">Data Sources</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-green-50 p-3 rounded-lg">
                            <div className="font-medium text-green-800">Perplexity AI</div>
                            <div className="text-sm text-green-600">Business analysis & insights</div>
                          </div>
                          <div className="bg-blue-50 p-3 rounded-lg">
                            <div className="font-medium text-blue-800">Bright Data</div>
                            <div className="text-sm text-blue-600">Web scraping & company data</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}



