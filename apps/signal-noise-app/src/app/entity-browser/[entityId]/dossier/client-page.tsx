'use client'

import dynamic from "next/dynamic"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, CheckCircle2, Clock3, FileText, Info, Layers3, Target } from "lucide-react"

import { DossierError } from "@/components/entity-dossier/DossierError"
import { EntityEnrichmentSummaryCard } from "@/components/entity-enrichment/EntityEnrichmentSummaryCard"
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

const POLL_INTERVAL_MS = 2500
const POLL_TIMEOUT_MS = 15 * 60 * 1000

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
  const dossierMetadata = dossier?.metadata || {}
  const isPersistedDossier = Boolean(dossier)
  const dossierConfidence = typeof dossierMetadata?.confidence_score === 'number'
    ? `${Math.round(dossierMetadata.confidence_score * 100)}%`
    : 'n/a'
  const dossierFreshness = dossierMetadata?.information_freshness || 'N/A'
  const nextReview = dossierMetadata?.next_review_date || 'Not scheduled'
  const pipelineStatus = String(entity?.properties?.last_pipeline_status || dossierMetadata?.pipeline_status || '').trim()
  const hasEntityPipelineState = Boolean(
    entity?.properties?.last_pipeline_status ||
      entity?.properties?.last_pipeline_run_at ||
      entity?.properties?.dossier_autoqueue_request_count
  )
  const persistenceLabel = isPersistedDossier
    ? 'Persisted dossier loaded'
    : hasEntityPipelineState
      ? 'Persisted entity state loaded'
      : 'Dossier shell loaded'
  const dossierReadout = pipelineStatus || (hasEntityPipelineState ? 'entity_state_loaded' : 'pending')
  const enrichmentStatusLabel = String(
    entity?.properties?.enrichment_status ||
      dossierMetadata?.enrichment_status ||
      entity?.properties?.last_enrichment_status ||
      (dossier?.linkedin_connection_analysis ? 'LinkedIn enrichment ready' : '')
  ).trim() || 'Awaiting enrichment'
  const enrichmentLastUpdatedLabel = String(
    entity?.properties?.last_enriched ||
      entity?.properties?.enriched_at ||
      dossierMetadata?.last_enriched ||
      dossierMetadata?.generated_at ||
      dossierMetadata?.updated_at ||
      'Not available'
  ).trim()
  const recentEnrichmentAdditions = [
    Array.isArray(entity?.properties?.keyContacts) && entity?.properties?.keyContacts[0]?.name
      ? `Contact: ${entity.properties.keyContacts[0].name}`
      : null,
    entity?.properties?.company ? `Company: ${entity.properties.company}` : null,
    entity?.properties?.website ? `Website: ${entity.properties.website}` : null,
    entity?.properties?.linkedin ? `LinkedIn: ${entity.properties.linkedin}` : null,
    Array.isArray(dossier?.linkedin_connection_analysis?.yellow_panther_uk_team?.team_members) &&
      dossier.linkedin_connection_analysis.yellow_panther_uk_team.team_members.length > 0
      ? `Team member: ${String(dossier.linkedin_connection_analysis.yellow_panther_uk_team.team_members[0])}`
      : null,
  ].filter(Boolean) as string[]

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

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms)
      })

    async function pollQueuedPipeline(statusUrl: string) {
      const startedAt = Date.now()

      while (!controller.signal.aborted) {
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          throw new Error('Timed out waiting for pipeline dossier generation')
        }

        const statusResponse = await fetch(statusUrl, { signal: controller.signal })
        if (statusResponse.ok) {
          const statusData = await statusResponse.json()
          const pipelineRuns = Array.isArray(statusData?.pipeline_runs) ? statusData.pipeline_runs : []
          const matchingRun =
            pipelineRuns.find((run: any) => String(run?.entity_id) === String(entityId)) ??
            pipelineRuns[0]
          const runStatus = String(matchingRun?.status || statusData?.batch?.status || 'queued')
          const runPhase = String(matchingRun?.phase || '')

          setGenerationMessage(
            runPhase
              ? `Pipeline run ${runStatus} (${runPhase}) for ${entity.properties.name}...`
              : `Pipeline run ${runStatus} for ${entity.properties.name}...`,
          )

          if (runStatus === 'failed') {
            const errorMessage = matchingRun?.error_message
            throw new Error(errorMessage || 'Pipeline run failed to generate dossier')
          }

          if (runStatus === 'completed') {
            const dossierResponse = await fetch(`/api/entities/${entityId}/dossier`, {
              signal: controller.signal,
            })
            if (dossierResponse.ok) {
              const dossierPayload = await dossierResponse.json()
              if (dossierPayload?.dossier) {
                setDossier(dossierPayload.dossier)
                return
              }
            }
          }
        }

        await sleep(POLL_INTERVAL_MS)
      }
    }

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

        if (response.status === 202) {
          const queuedData = await response.json()
          const statusUrl = queuedData?.statusUrl
          if (!statusUrl) {
            throw new Error('Pipeline queued but no status URL returned')
          }
          setGenerationMessage(`Pipeline run queued for ${entity.properties.name}...`)
          await pollQueuedPipeline(statusUrl)
          return
        }

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

          <Card className="mb-6 border border-slate-700 bg-slate-950/90 text-slate-50 shadow-lg">
            <CardContent className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm uppercase tracking-[0.18em] text-slate-400">
                    <Layers3 className="h-4 w-4 text-sky-400" />
                    Dossier persistence status
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-semibold text-emerald-300">
                      {persistenceLabel}
                    </span>
                    <span className="rounded-full bg-sky-500/15 px-3 py-1 text-sm font-semibold text-sky-300">
                      {dossierReadout}
                    </span>
                    <span className="rounded-full bg-violet-500/15 px-3 py-1 text-sm font-semibold text-violet-300">
                      Confidence {dossierConfidence}
                    </span>
                  </div>
                  <p className="max-w-3xl text-sm leading-6 text-slate-300">
                    This page is reading the persisted dossier first, then layering the entity browser, question rail, and
                    downstream enrichment state on top. The goal is to make the stored dossier obvious immediately.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[360px]">
                  <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-3">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      Freshness
                    </div>
                    <div className="mt-2 text-base font-semibold text-slate-100">{dossierFreshness}</div>
                  </div>
                  <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-3">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                      <Clock3 className="h-3.5 w-3.5 text-amber-400" />
                      Next review
                    </div>
                    <div className="mt-2 text-base font-semibold text-slate-100">{nextReview}</div>
                  </div>
                  <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-3">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                      <Info className="h-3.5 w-3.5 text-sky-400" />
                      Source state
                    </div>
                    <div className="mt-2 text-base font-semibold text-slate-100">
                      {pipelineStatus || 'No pipeline update'}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="mb-6">
            <EntityEnrichmentSummaryCard
              title="Shown before the dossier tabs so the latest enrichment state is visible immediately."
              statusLabel={enrichmentStatusLabel}
              lastUpdatedLabel={enrichmentLastUpdatedLabel}
              recentAdditions={recentEnrichmentAdditions}
              onRunEnrichment={() => {
                const target = `/entity-enrichment?entityId=${encodeURIComponent(entityId)}`
                pushWithViewTransition(router, target)
              }}
              advancedHref={`/entity-enrichment?entityId=${encodeURIComponent(entityId)}`}
            />
          </div>

          <Card className="mb-6 border border-emerald-700/40 bg-emerald-950/40 text-emerald-50 shadow-lg">
            <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-emerald-300">
                  <Target className="h-4 w-4" />
                  Opportunity decision
                </div>
                <p className="text-sm leading-6 text-emerald-100/85">
                  The dossier and enrichment are attached. Review opportunity fit to decide whether this entity belongs in the active shortlist.
                </p>
              </div>
              <Button
                variant="outline"
                className="border-emerald-500/40 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20"
                asChild
              >
                <a
                  href={`/opportunities?entityId=${encodeURIComponent(entityId)}&entityName=${encodeURIComponent(entity?.properties?.name || entityId)}`}
                >
                  Review opportunity fit
                </a>
              </Button>
            </CardContent>
          </Card>

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
