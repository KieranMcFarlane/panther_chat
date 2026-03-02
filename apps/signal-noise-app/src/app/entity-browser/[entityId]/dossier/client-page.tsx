'use client'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText } from "lucide-react"

import EntityDossierRouter from "@/components/entity-dossier/EntityDossierRouter"
import Header from "@/components/header/Header"
import EmailComposeModal from "@/components/email/EmailComposeModal"
import type { Entity } from "@/lib/entity-loader"

interface EntityDossierClientPageProps {
  entityId: string
  fromPage: string
  shouldGenerate: boolean
  includeSignals: boolean
  includeConnections: boolean
  deepResearch: boolean
  initialEntity?: Entity | null
  initialDossier?: any | null
  initialError?: string | null
}

export default function EntityDossierClientPage({
  entityId,
  fromPage,
  shouldGenerate,
  includeSignals,
  includeConnections,
  deepResearch,
  initialEntity = null,
  initialDossier = null,
  initialError = null
}: EntityDossierClientPageProps) {
  const router = useRouter()
  const entity = initialEntity
  const dossierKey = 0
  const [generationMessage, setGenerationMessage] = useState<string | null>(null)
  const [showEmailModal, setShowEmailModal] = useState(false)

  useEffect(() => {
    if (!shouldGenerate || !entity) return

    const generationOptions = {
      includeSignals,
      includeConnections,
      deepResearch,
      forceRegeneration: true
    }

    console.log('📋 Dossier generation options:', generationOptions)
    setGenerationMessage(`📊 Analyzing opportunities, connections, and signals for ${entity.properties.name}...`)

    const timer = setTimeout(() => {
      setGenerationMessage(null)
    }, 5000)

    return () => clearTimeout(timer)
  }, [shouldGenerate, entity, includeSignals, includeConnections, deepResearch])

  const handleEmailEntity = () => {
    setShowEmailModal(true)
  }

  const getContactFromEntity = () => {
    if (!entity) return null

    const properties = entity.properties

    return {
      id: entity.id,
      name: properties.name || `Entity ${entity.id}`,
      email: properties.email || `contact@${(properties.name?.toLowerCase().replace(/\s+/g, '-') || 'unknown')}.com`,
      role: properties.type || 'Professional',
      affiliation: properties.sport ? `${properties.sport} Organization` : 'Sports Organization',
      tags: [
        properties.type || 'Organization',
        properties.sport || 'Sports',
        properties.league || 'Professional',
        ...(Array.isArray(properties.digitalOpportunities) ? properties.digitalOpportunities.slice(0, 2) : [])
      ].filter(Boolean)
    }
  }

  if (initialError || !entity) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <FileText className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Error Loading Entity</h2>
            <p className="text-muted-foreground mb-4">{initialError || `Entity ${entityId} not found`}</p>
            <div className="space-y-2">
              <Button onClick={() => router.push(`/entity-browser${fromPage !== '1' ? `?page=${fromPage}` : ''}`)} variant="outline" className="w-full">
                Back to Entity Browser
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header currentEntity={entity} />

      <div className="flex-1 bg-[#1c1e2d]">
        <div className="container mx-auto px-4 py-8">
          {generationMessage && (
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center gap-2 text-blue-800">
                <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-blue-600"></div>
                <span>{generationMessage}</span>
              </div>
            </div>
          )}

          <EntityDossierRouter
            key={dossierKey}
            entity={entity}
            onEmailEntity={handleEmailEntity}
            dossier={initialDossier}
          />
        </div>
      </div>

      {showEmailModal && (
        <EmailComposeModal
          contact={getContactFromEntity()}
          entity={entity}
          isOpen={showEmailModal}
          onClose={() => setShowEmailModal(false)}
        />
      )}
    </div>
  )
}
