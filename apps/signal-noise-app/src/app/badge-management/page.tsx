"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { EntityBadgeGrid } from "@/components/badge/EntityBadge"
import { BadgeManagementDashboard } from "@/components/badge/BadgeManagementDashboard"
import { ArrowLeft, Plus, Download, Upload, RefreshCw } from "lucide-react"
import { badgeManager } from "@/services/badge-manager"

interface BadgeEntity {
  id: string | number
  name: string
  labels: string[]
  properties: Record<string, any>
}

export default function BadgeManagementPage() {
  const [entities, setEntities] = useState<BadgeEntity[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [mappings, setMappings] = useState(badgeManager.getAllMappings())

  useEffect(() => {
    loadEntities()
  }, [])

  useEffect(() => {
    setMappings(badgeManager.getAllMappings())
  }, [])

  const loadEntities = async () => {
    try {
      const response = await fetch('/api/entities?limit=100')
      if (response.ok) {
        const data = await response.json()
        setEntities(data.entities || [])
      }
    } catch (error) {
      console.error('Failed to load entities:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredEntities = entities.filter(entity => {
    const matchesSearch = entity.properties.name?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = selectedType === "all" || entity.labels.includes(selectedType)
    return matchesSearch && matchesType
  })

  const entityTypes = ["all", ...new Set(entities.flatMap(e => e.labels))]

  const stats = badgeManager.getStatistics()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">🏆</span>
              </div>
              <h1 className="text-3xl font-bold">Badge Management</h1>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.href = '/entity-browser'}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Browser
              </Button>
              <Badge variant="secondary">
                {stats.total} badges mapped
              </Badge>
            </div>
          </div>
          <p className="text-muted-foreground">
            Manage entity badges, mappings, and configurations for your knowledge graph
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Badges</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          
          {Object.entries(stats.bySource).map(([source, count]) => (
            <Card key={source}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{source}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{count}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 flex-wrap">
              <Button onClick={loadEntities} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Entities
              </Button>
              <Button onClick={() => {
                const data = badgeManager.exportMappings()
                const blob = new Blob([data], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'badge-mappings.json'
                a.click()
                URL.revokeObjectURL(url)
              }} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export Mappings
              </Button>
              <label className="cursor-pointer">
                <Button variant="outline" asChild>
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    Import Mappings
                  </span>
                </Button>
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      const reader = new FileReader()
                      reader.onload = (event) => {
                        const content = event.target?.result as string
                        if (badgeManager.importMappings(content)) {
                          setMappings(badgeManager.getAllMappings())
                          alert('Badge mappings imported successfully!')
                        } else {
                          alert('Failed to import badge mappings')
                        }
                      }
                      reader.readAsText(file)
                    }
                  }}
                  className="hidden"
                />
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Entity Browser with Badges */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Entity Browser Section */}
          <Card>
            <CardHeader>
              <CardTitle>Entity Browser</CardTitle>
              <div className="flex gap-4">
                <Input
                  placeholder="Search entities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1"
                />
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="px-3 py-2 border rounded-md bg-background"
                >
                  {entityTypes.map(type => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="text-center py-8">Loading entities...</div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {filteredEntities.slice(0, 20).map((entity) => (
                      <div key={entity.id} className="flex flex-col items-center space-y-2 p-3 border rounded-lg">
                        <EntityBadgeGrid
                          entities={[entity]}
                          size="sm"
                          className="!grid-cols-1"
                        />
                        <div className="text-xs text-center text-gray-600 font-medium line-clamp-2">
                          {entity.properties.name}
                        </div>
                        <div className="flex gap-1">
                          {entity.labels.slice(0, 2).map(label => (
                            <Badge key={label} variant="outline" className="text-xs">
                              {label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Badge Mappings Section */}
          <Card>
            <CardHeader>
              <CardTitle>Badge Mappings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto space-y-3">
                {mappings.map((mapping) => (
                  <div key={`${mapping.entityId}-${mapping.entityName}`} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <EntityBadgeGrid
                        entities={[{
                          id: mapping.entityId,
                          name: mapping.entityName,
                          properties: { name: mapping.entityName },
                          labels: []
                        }]}
                        size="sm"
                        className="!grid-cols-1"
                      />
                      <div>
                        <div className="font-medium text-sm">{mapping.entityName}</div>
                        <div className="text-xs text-muted-foreground">{mapping.badgePath}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {mapping.source}
                      </Badge>
                    </div>
                  </div>
                ))}
                {mappings.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No badge mappings found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Full Badge Management Dashboard */}
        <div className="mt-8">
          <BadgeManagementDashboard />
        </div>
      </div>
    </div>
  )
}