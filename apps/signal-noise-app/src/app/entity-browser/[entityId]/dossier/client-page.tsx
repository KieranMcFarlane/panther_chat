'use client'

import dynamic from "next/dynamic"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, FileText } from "lucide-react"

import { DossierError } from "@/components/entity-dossier/DossierError"
import { resolveEntityBrowserReturnUrl } from "@/lib/entity-browser-history"
import { pushWithViewTransition } from "@/lib/view-transition"
import type { Entity } from "@/lib/entity-loader"

const Header = dynamic(() => import("@/components/header/Header"), { ssr: false })
const EmailComposeModal = dynamic(() => import("@/components/email/EmailComposeModal"), { ssr: false })
const EntityDossierRouter = dynamic(() => import("@/components/entity-dossier/EntityDossierRouter"), {
  loading: () => (
    <div className="rounded-lg border border-gray-700 bg-[#1c1e2d] p-6">
      <div className="h-6 w-48 bg-gray-600 rounded animate-pulse mb-4" />
      <div className="h-4 w-full bg-gray-700 rounded animate-pulse mb-2" />
      <div className="h-4 w-5/6 bg-gray-700 rounded animate-pulse mb-2" />
      <div className="h-4 w-3/6 bg-gray-700 rounded animate-pulse" />
    </div>
  )
})

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
  const [dossier, setDossier] = useState(initialDossier)
  const [generationMessage, setGenerationMessage] = useState<string | null>(null)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationAttempt, setGenerationAttempt] = useState(0)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [isContentTransitioning, setIsContentTransitioning] = useState(false)
  const [backHref, setBackHref] = useState(fromPage !== '1' ? `/entity-browser?page=${fromPage}` : '/entity-browser')

  useEffect(() => {
    const currentFrom = new URLSearchParams(window.location.search).get('from') || fromPage
    setBackHref(resolveEntityBrowserReturnUrl(currentFrom))
  }, [fromPage])

  const backToEntityBrowser = useCallback(() => {
    const currentFrom = new URLSearchParams(window.location.search).get('from') || fromPage
    const targetUrl = resolveEntityBrowserReturnUrl(currentFrom)
    const beforeUrl = `${window.location.pathname}${window.location.search}`
    pushWithViewTransition(router, targetUrl)
    window.setTimeout(() => {
      const afterUrl = `${window.location.pathname}${window.location.search}`
      if (afterUrl === beforeUrl) {
        window.location.assign(targetUrl)
      }
    }, 300)
  }, [fromPage, router])

  useEffect(() => {
    setDossier(initialDossier)
  }, [initialDossier])

  useEffect(() => {
    setIsContentTransitioning(true)
    const timeout = setTimeout(() => setIsContentTransitioning(false), 160)
    return () => clearTimeout(timeout)
  }, [entityId])

  // Intentionally exclude `dossier` from deps to avoid regeneration loops after a successful generation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!entity) return
    if (!shouldGenerate && dossier) return

    const controller = new AbortController()

    async function generateDossier() {
      setIsGenerating(true)
      setGenerationError(null)
      setGenerationMessage(`Analyzing opportunities, connections, and signals for ${entity.properties.name}...`)

      const searchParams = new URLSearchParams({
        includeSignals: String(includeSignals),
        includeConnections: String(includeConnections),
        includePOIs: 'true',
        deepResearch: String(deepResearch)
      })

      try {
        const response = await fetch(`/api/entities/${entityId}/dossier?${searchParams.toString()}`, {
          method: shouldGenerate ? 'POST' : 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
          body: shouldGenerate ? JSON.stringify({
            includeSignals,
            includeConnections,
            includePOIs: true,
            deepResearch
          }) : undefined,
          signal: controller.signal
        })

        if (!response.ok) {
          throw new Error(`Failed to generate dossier (${response.status})`)
        }

        const data = await response.json()
        setDossier(data.dossier ?? null)
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        console.error('Failed to generate dossier:', error)
        setGenerationError(error instanceof Error ? error.message : 'Failed to generate dossier')
      } finally {
        if (!controller.signal.aborted) {
          setIsGenerating(false)
          setGenerationMessage(null)
        }
      }
    }

    generateDossier()

    return () => controller.abort()
  }, [entity, entityId, shouldGenerate, includeSignals, includeConnections, deepResearch, generationAttempt]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRetryGeneration = () => {
    setGenerationError(null)
    setGenerationAttempt((attempt) => attempt + 1)
  }

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
              <Button
                onClick={backToEntityBrowser}
                variant="outline"
                className="w-full"
                data-testid="back-to-entity-browser"
                asChild
              >
                <a href={backHref}>Back to Entity Browser</a>
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
          <div className="mb-4">
            <Button onClick={backToEntityBrowser} variant="outline" size="sm" data-testid="back-to-entity-browser" asChild>
              <a href={backHref}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Entity Browser
              </a>
            </Button>
          </div>
          {generationMessage && (
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center gap-2 text-blue-800">
                <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-blue-600"></div>
                <span>{generationMessage}</span>
              </div>
            </div>
          )}

          {generationError && !dossier && !isGenerating && (
            <div className="mb-6">
              <DossierError entityId={entityId} error={generationError} onRetry={handleRetryGeneration} />
            </div>
          )}

          <div
            className={`transition-opacity duration-200 ${isContentTransitioning ? 'opacity-0' : 'opacity-100'}`}
            style={{ viewTransitionName: "dossier-content" }}
          >
            <EntityDossierRouter
              key={dossierKey}
              entity={entity}
              onEmailEntity={handleEmailEntity}
              dossier={dossier}
            />
          </div>
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
