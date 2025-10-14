"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Database, ExternalLink, Mail } from "lucide-react"
import Link from "next/link"
import { EmailComposeModal } from "@/components/email/EmailComposeModal"

interface Entity {
  id: string
  neo4j_id: string
  labels: string[]
  properties: Record<string, any>
}

interface EntityData {
  entities: Entity[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export default function SimpleTestPage() {
  const [data, setData] = useState<EntityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        console.log('🔍 Simple test: Fetching entities...')
        const response = await fetch('/api/entities?page=1&limit=10')
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const result = await response.json()
        console.log('✅ Simple test: Successfully fetched data:', result)
        setData(result)
      } catch (err) {
        console.error('❌ Simple test: Error fetching data:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleSendEmail = async (emailData: { to: string; subject: string; body: string }) => {
    try {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData)
      });

      if (!response.ok) throw new Error('Failed to send email');
      
      console.log('Email sent successfully');
    } catch (error) {
      console.error('Error sending email:', error);
    }
  };

  const openEmailModal = (entity: Entity) => {
    setSelectedEntity(entity);
    setShowEmailModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Database className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <h2 className="text-xl font-semibold mb-2">Loading Entities (Simple Test)</h2>
          <p className="text-muted-foreground">Fetching data...</p>
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
            <Button onClick={() => window.location.reload()} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <Database className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Data Available</h2>
            <p className="text-muted-foreground mb-4">No data was loaded.</p>
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
              <h1 className="text-3xl font-bold page-title">Entity Browser (Simple Test)</h1>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Badge variant="secondary">
                {data.pagination.total.toLocaleString()} entities
              </Badge>
              <Badge variant="outline" className="text-green-600">
                Simple Test Working!
              </Badge>
            </div>
          </div>
          <p className="text-muted-foreground">
            Simple test version to verify entity loading works
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Debug Info */}
        <Card className="mb-6 bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="text-sm">
              <p><strong>✅ Simple Test Status:</strong> Working!</p>
              <p><strong>Entities Count:</strong> {data.entities.length}</p>
              <p><strong>Total Pages:</strong> {data.pagination.totalPages}</p>
              <p><strong>Current Page:</strong> {data.pagination.page}</p>
              {data.entities.length > 0 && (
                <p><strong>First Entity:</strong> {data.entities[0]?.properties?.name || 'N/A'}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Entity Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {data.entities.map((entity) => (
            <Card key={entity.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{entity.properties.name}</CardTitle>
                  <Link href={`/entity/${entity.id}`}>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {entity.labels.map((label: string) => (
                    <Badge key={label} variant="outline" className="text-xs">
                      {label}
                    </Badge>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  <strong>Type:</strong> {entity.properties.type || 'N/A'}
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Sport:</strong> {entity.properties.sport || 'N/A'}
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Country:</strong> {entity.properties.country || 'N/A'}
                </p>
                {entity.properties.website && (
                  <p className="text-sm">
                    <a 
                      href={entity.properties.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Website →
                    </a>
                  </p>
                )}
                <div className="pt-2 flex gap-2">
                  <Link href={`/entity/${entity.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Details
                    </Button>
                  </Link>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => openEmailModal(entity)}
                    className="flex items-center gap-1"
                  >
                    <Mail className="h-4 w-4" />
                    Email
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Email Compose Modal */}
        {selectedEntity && (
          <EmailComposeModal
            isOpen={showEmailModal}
            onClose={() => {
              setShowEmailModal(false);
              setSelectedEntity(null);
            }}
            contact={{
              id: selectedEntity.id,
              name: selectedEntity.properties.name || 'Unknown',
              email: selectedEntity.properties.email || `contact@${selectedEntity.properties.name?.replace(/\s+/g, '').toLowerCase()}.com`,
              role: selectedEntity.properties.type || 'Representative',
              affiliation: selectedEntity.properties.name || 'Organization',
              tags: [selectedEntity.properties.sport, selectedEntity.properties.country].filter(Boolean)
            }}
            onSendEmail={handleSendEmail}
          />
        )}
      </div>
    </div>
  )
}