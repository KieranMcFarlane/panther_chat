"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, FileText, RefreshCw, ExternalLink } from "lucide-react"
import EntityDossier from "@/components/entity-dossier/EntityDossier"
import { EntityBadge } from "@/components/badge/EntityBadge"
import { supabase } from "@/lib/supabase"

interface Entity {
  id: string
  neo4j_id: string | number
  labels: string[]
  properties: Record<string, any>
}

export default function EntityDossierPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const entityId = params.entityId as string
  const fromPage = searchParams.get('from') || '1'
  const shouldGenerate = searchParams.get('generate') === 'true'
  const includeSignals = searchParams.get('includeSignals') !== 'false'
  const includeConnections = searchParams.get('includeConnections') !== 'false'
  const deepResearch = searchParams.get('deepResearch') === 'true'
  
  const [entity, setEntity] = useState<Entity | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dossierKey, setDossierKey] = useState(0) // Force refresh dossier
  const [generationMessage, setGenerationMessage] = useState<string | null>(null)

  useEffect(() => {
    fetchEntityData()
  }, [entityId])

  useEffect(() => {
    if (shouldGenerate && entity) {
      setGenerationMessage(`🚀 Initiating intelligence dossier generation for ${entity.properties.name}...`)
      
      // Trigger dossier generation with specific options
      const generationOptions = {
        includeSignals,
        includeConnections,
        deepResearch,
        forceRegeneration: true
      }
      
      console.log('📋 Dossier generation options:', generationOptions)
      setGenerationMessage(`📊 Analyzing opportunities, connections, and signals...`)
      
      // Clear message after a delay
      const timer = setTimeout(() => {
        setGenerationMessage(null)
      }, 5000)
      
      return () => clearTimeout(timer)
    }
  }, [shouldGenerate, entity, includeSignals, includeConnections, deepResearch])

  const fetchEntityData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/entities/${entityId}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch entity: ${response.statusText}`)
      }

      const data = await response.json()
      setEntity(data.entity)
    } catch (err) {
      console.error('Error fetching entity:', err)
      setError(err instanceof Error ? err.message : 'Failed to load entity')
    } finally {
      setLoading(false)
    }
  }

  const handleBackToBrowser = () => {
    const url = `/entity-browser${fromPage !== '1' ? `?page=${fromPage}` : ''}`
    router.push(url)
  }

  const handleRefreshDossier = () => {
    setDossierKey(prev => prev + 1)
  }

  const handlePinDossier = () => {
    // Implementation for pinning dossier
    console.log('Pin dossier for entity:', entityId)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">Loading Entity</h2>
          <p className="text-muted-foreground">Fetching entity data...</p>
        </div>
      </div>
    )
  }

  if (error || !entity) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <FileText className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Error Loading Entity</h2>
            <p className="text-muted-foreground mb-4">{error || 'Entity not found'}</p>
            <div className="space-y-2">
              <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
                Try Again
              </Button>
              <Button onClick={handleBackToBrowser} variant="outline" className="w-full">
                Back to Entity Browser
              </Button>
            </div>
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleBackToBrowser}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Browser
            </Button>
            
            <div className="flex items-center gap-2">
              <EntityBadge entity={entity} size="lg" />
              <div>
                <h1 className="text-3xl font-bold">{entity.properties.name}</h1>
                <div className="flex gap-2 flex-wrap mt-1">
                  {entity.labels.map((label: string) => (
                    <Badge key={label} variant="outline" className="text-xs">
                      {label}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshDossier}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh Dossier
              </Button>
              
              <Badge variant="secondary" className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                Intelligence Dossier
              </Badge>
            </div>
          </div>
          
          <p className="text-muted-foreground">
            Comprehensive intelligence dossier with opportunity scoring, connection analysis, and recommended actions
          </p>
          
          {/* Generation Message */}
          {generationMessage && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-blue-800">{generationMessage}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dossier Content */}
      <div className="container mx-auto px-4 py-8">
        <EntityDossier
          key={dossierKey}
          entityId={entityId}
          entityData={entity}
          isLoading={loading}
          onRefresh={handleRefreshDossier}
          onPinDossier={handlePinDossier}
        />
      </div>
    </div>
  )
}