import Link from 'next/link'
import { ArrowUpRight, Building2, Calendar, ExternalLink, Sparkles, Target } from 'lucide-react'

import { AppPageBody, AppPageHeader, AppPageShell } from '@/components/layout/AppPageShell'
import { WideResearchRefreshButton } from '@/components/rfp/WideResearchRefreshButton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getEntityBrowserDossierHref } from '@/lib/entity-routing'
import { loadLatestWideRfpResearchBatch } from '@/lib/rfp-wide-research-store'

export const dynamic = 'force-dynamic'

type FoundRfp = {
  id: string
  title: string
  organization: string
  description: string | null
  yellow_panther_fit: number | null
  category: string | null
  deadline: string | null
  source_url: string | null
  entity_id: string | null
  entity_name: string | null
  canonical_entity_id?: string | null
  canonical_entity_name?: string | null
  location?: string | null
  status?: string | null
}

type WideResearchOpportunity = FoundRfp & {
  canonical_entity_id?: string | null
  canonical_entity_name?: string | null
}

type WideResearchBatch = {
  run_id: string
  source: string
  prompt: string
  generated_at: string
  focus_area?: string | null
  lane_label?: string | null
  seed_query?: string | null
  target_year?: number | null
  excluded_names?: string[] | null
  opportunities: WideResearchOpportunity[]
  entity_actions: Array<{
    action: 'link' | 'create' | 'reuse'
    organization: string
    canonical_entity_id?: string | null
    canonical_entity_name?: string | null
    source_url?: string | null
  }>
  summary: {
    total_opportunities: number
    linked_entities: number
    entities_to_create: number
  }
}

function formatDeadline(value: string | null): string {
  if (!value) return 'No deadline listed'
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return value
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(parsed))
}

function formatRunTimestamp(value: string | null): string {
  if (!value) return 'Awaiting first Manus batch'
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return value
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(parsed))
}

function fitTone(score: number | null): 'default' | 'secondary' | 'outline' {
  if (typeof score !== 'number') return 'outline'
  if (score >= 90) return 'default'
  return 'secondary'
}

function collectAlreadyFoundTitles(opportunities: WideResearchOpportunity[]): string[] {
  const seen = new Set<string>()
  const names: string[] = []

  for (const opportunity of opportunities) {
    const candidate = opportunity.title || opportunity.organization || opportunity.entity_name || opportunity.canonical_entity_name
    const name = candidate?.trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    names.push(name)
  }

  return names
}

export default async function RfpsPage() {
  const latest = await loadLatestWideRfpResearchBatch({})
  const wideResearchBatch = (latest?.batch || null) as WideResearchBatch | null
  const wideResearchOpportunities = wideResearchBatch?.opportunities || []
  const alreadyFoundTitles = collectAlreadyFoundTitles(wideResearchOpportunities)
  const latestWideResearchGeneratedAt = wideResearchBatch?.generated_at || null

  return (
    <AppPageShell className="opacity-100">
      <AppPageHeader
        eyebrow="Canonical RFPs"
        title="Merged Manus wide research batch"
        description="This surface shows the merged Manus wide research batch from wide_rfp_research_batches, which feeds the canonical source of truth."
      />
      <AppPageBody>
        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="min-w-0 border-border/70 bg-card">
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Merged Manus wide research batch</CardTitle>
                <Badge variant="outline">wide_rfp_research_batches</Badge>
              </div>
              <div className="text-lg font-semibold text-foreground">
                {wideResearchBatch ? `Run ${wideResearchBatch.run_id}` : 'No merged Manus batch yet'}
              </div>
              <p className="text-sm text-muted-foreground">
                Manus wide research JSON is merged into one batch so the page reflects the original broad sweep rather than a split source list.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                {wideResearchBatch ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">Target year: {wideResearchBatch.target_year || 'any'}</Badge>
                    <span>
                      Last merged run:{' '}
                      <span className="font-medium text-foreground">{formatRunTimestamp(latestWideResearchGeneratedAt)}</span>
                    </span>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Waiting for the first Manus output to be merged.</div>
                )}
                <WideResearchRefreshButton
                  alreadyFoundTitles={alreadyFoundTitles}
                  defaultTargetYear={wideResearchBatch?.target_year || new Date().getFullYear()}
                />
              </div>
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground/80">Seed prompt:</span>{' '}
                {wideResearchBatch?.seed_query || 'Awaiting first Manus batch'}
              </div>
              <div className="rounded-xl border border-dashed border-border/70 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
                Manus wide research JSON is preserved in the merged batch so the page stays aligned to the original batch contents.
              </div>
            </CardContent>
          </Card>
        </section>

        {wideResearchBatch ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Merged Manus wide research output</h2>
                <p className="text-sm text-muted-foreground">
                  This is the merged batch normalized into the same operator-friendly fields used by the RFP surface.
                </p>
              </div>
              <Badge variant="outline">canonical-first</Badge>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {wideResearchOpportunities.map((rfp) => (
                <Card key={rfp.id} className="min-w-0 border-border/70 bg-card shadow-sm">
                  <CardHeader className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <CardTitle className="break-words text-xl leading-tight text-foreground">{rfp.title}</CardTitle>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <Building2 className="h-4 w-4" />
                            {rfp.organization}
                          </span>
                          {rfp.canonical_entity_name ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Sparkles className="h-4 w-4" />
                              {rfp.canonical_entity_name}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <Badge variant={fitTone(rfp.yellow_panther_fit)}>
                        <Target className="mr-1 h-3.5 w-3.5" />
                        {typeof rfp.yellow_panther_fit === 'number' ? `${rfp.yellow_panther_fit}% fit` : 'Fit pending'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm leading-6 text-muted-foreground">
                      {rfp.description || 'No summary was stored for this merged Manus opportunity.'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {rfp.canonical_entity_id ? <Badge variant="outline">{rfp.canonical_entity_id}</Badge> : null}
                      {rfp.category ? <Badge variant="outline">{rfp.category}</Badge> : null}
                      {rfp.status ? <Badge variant="outline">{rfp.status}</Badge> : null}
                      <Badge variant="outline">
                        <Calendar className="mr-1 h-4 w-4" />
                        {formatDeadline(rfp.deadline)}
                      </Badge>
                      {rfp.entity_name ? <Badge variant="secondary">{rfp.entity_name}</Badge> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {rfp.canonical_entity_id ? (
                        <Button asChild variant="outline" size="sm">
                          <Link href={getEntityBrowserDossierHref(rfp.canonical_entity_id, '1') || `/entity-browser/${rfp.canonical_entity_id}/dossier?from=1`}>
                            Open canonical dossier
                            <ArrowUpRight className="ml-1 h-4 w-4" />
                          </Link>
                        </Button>
                      ) : null}
                      {rfp.source_url ? (
                        <Button asChild size="sm">
                          <a href={rfp.source_url} target="_blank" rel="noreferrer">
                            Open source
                            <ExternalLink className="ml-1 h-4 w-4" />
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-border/70 bg-card/50 p-8 text-sm text-muted-foreground">
            No merged Manus wide research output is available yet. Import the validated Manus JSON batches to seed the merged batch.
          </section>
        )}
      </AppPageBody>
    </AppPageShell>
  )
}
