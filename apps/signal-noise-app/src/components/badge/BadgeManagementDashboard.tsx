"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { badgeManager } from '@/services/badge-manager'
import { BadgeMapping } from '@/types/badge'
import { Download, Upload, Plus, Search, RefreshCw } from 'lucide-react'

export function BadgeManagementDashboard() {
  const [mappings, setMappings] = useState<BadgeMapping[]>(badgeManager.getAllMappings())
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSource, setSelectedSource] = useState<string>('all')

  const filteredMappings = mappings.filter(mapping => {
    const matchesSearch = mapping.entityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         mapping.entityId.toString().includes(searchTerm)
    const matchesSource = selectedSource === 'all' || mapping.source === selectedSource
    return matchesSearch && matchesSource
  })

  const sources = ['all', ...new Set(mappings.map(m => m.source))]

  const handleRefresh = () => {
    setMappings(badgeManager.getAllMappings())
  }

  const handleExport = () => {
    const data = badgeManager.exportMappings()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'badge-mappings.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        if (badgeManager.importMappings(content)) {
          setMappings(badgeManager.getAllMappings())
          alert('Badge mappings imported successfully!')
        } else {
          alert('Failed to import badge mappings')
        }
      }
      reader.readAsText(file)
    }
  }

  const stats = badgeManager.getStatistics()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Badge Management</h2>
          <p className="text-muted-foreground">Manage entity badge mappings and configurations</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <label className="cursor-pointer">
            <Button variant="outline" asChild>
              <span>
                <Upload className="w-4 h-4 mr-2" />
                Import
              </span>
            </Button>
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

      {/* Main Content */}
      <Tabs defaultValue="badges" className="space-y-4">
        <TabsList>
          <TabsTrigger value="badges">Badge Gallery</TabsTrigger>
          <TabsTrigger value="mappings">Mappings</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="badges" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Badge Gallery</CardTitle>
              <div className="flex gap-4 items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search badges..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <select
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  className="px-3 py-2 border rounded-md bg-background"
                >
                  {sources.map(source => (
                    <option key={source} value={source}>
                      {source.charAt(0).toUpperCase() + source.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </CardHeader>
            <CardContent>
              <EntityBadgeGrid
                entities={filteredMappings.map(mapping => ({
                  id: mapping.entityId,
                  name: mapping.entityName,
                  properties: { name: mapping.entityName },
                  labels: []
                }))}
                size="lg"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mappings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Badge Mappings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredMappings.map((mapping) => (
                  <div key={`${mapping.entityId}-${mapping.entityName}`} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
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
                        <div className="font-medium">{mapping.entityName}</div>
                        <div className="text-sm text-muted-foreground">ID: {mapping.entityId}</div>
                        <div className="text-xs text-muted-foreground">{mapping.badgePath}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{mapping.source}</Badge>
                      <Badge variant="secondary">
                        {new Date(mapping.lastUpdated).toLocaleDateString()}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Badge Storage</h4>
                  <p className="text-sm text-muted-foreground">
                    Badges are stored in the <code className="bg-muted px-1 rounded">/badges</code> directory with the naming convention:
                    <code className="bg-muted px-1 rounded ml-1">[entity-name]-badge.png</code>
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Mapping Rules</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Entity ID and name are used for badge lookup</li>
                    <li>• Multiple badge sources supported (TheSportsDB, local, custom)</li>
                    <li>• Automatic fallback to initials/icon if badge not found</li>
                    <li>• Caching enabled for performance (1 hour TTL)</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Integration Points</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• EntityCard component - automatically displays badges</li>
                    <li>• EntityBadge component - standalone badge display</li>
                    <li>• Badge service - programmatic badge management</li>
                    <li>• Badge manager - persistent storage and configuration</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}