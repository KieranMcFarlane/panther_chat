'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowUpRight, Building2, Calendar, ExternalLink, Filter, Loader2, MapPin, Sparkles, Target } from 'lucide-react'

import { AppPageBody, AppPageHeader, AppPageShell } from '@/components/layout/AppPageShell'
import { FacetFilterBar } from '@/components/filters/FacetFilterBar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Command, CommandInput } from '@/components/ui/command'
import { getEntityBrowserDossierHref } from '@/lib/entity-routing'

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
  location?: string | null
  source?: string | null
}

type ApiPayload = {
  opportunities?: FoundRfp[]
}

const FOUND_RFPS_ENDPOINT = '/api/tenders?action=opportunities&limit=50&orderBy=yellow_panther_fit&orderDirection=desc&promoted_only=true'

function formatDeadline(value: string | null): string {
  if (!value) return 'No deadline listed'
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return value
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(parsed))
}

function fitTone(score: number | null): 'default' | 'secondary' | 'outline' {
  if (typeof score !== 'number') return 'outline'
  if (score >= 90) return 'default'
  return 'secondary'
}

export default function RfpsPage() {
  const [rfps, setRfps] = useState<FoundRfp[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let ignore = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(FOUND_RFPS_ENDPOINT, { cache: 'no-store' })
        if (!response.ok) {
          throw new Error(`Request failed with ${response.status}`)
        }
        const payload = (await response.json()) as ApiPayload
        if (!ignore) {
          setRfps(Array.isArray(payload.opportunities) ? payload.opportunities : [])
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Failed to load found RFPs')
          setRfps([])
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      ignore = true
    }
  }, [])

  const filteredRfps = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return rfps
    return rfps.filter((rfp) =>
      [rfp.title, rfp.organization, rfp.description, rfp.category, rfp.entity_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery)),
    )
  }, [rfps, query])

  const highFitCount = filteredRfps.filter((rfp) => Number(rfp.yellow_panther_fit || 0) >= 90).length

  return (
    <AppPageShell>
      <AppPageHeader
        eyebrow="Found RFPs"
        title="Promoted RFP opportunities"
        description="Only verified, promoted opportunities that survived the intake and quality filters. This is the clean operator view, not the raw tenders feed."
        actions={(
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/opportunities">Open opportunities</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/tenders">Open raw tenders feed</Link>
            </Button>
          </>
        )}
      />
      <AppPageBody>
        <section className="grid gap-4 md:grid-cols-3">
          <Card className="border-border/70 bg-card/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Found RFPs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-foreground">{loading ? '...' : filteredRfps.length}</div>
              <p className="mt-2 text-sm text-muted-foreground">Promoted and entity-linked opportunities only.</p>
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">High fit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-foreground">{loading ? '...' : highFitCount}</div>
              <p className="mt-2 text-sm text-muted-foreground">Yellow Panther fit score of 90 or above.</p>
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Source policy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                <Sparkles className="h-4 w-4 text-sky-400" />
                Verified and promoted only
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Expired, weak-fit, and unlinked items stay out of this surface.</p>
            </CardContent>
          </Card>
        </section>

        <FacetFilterBar
          searchSlot={
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-foreground">Operator shortlist</h2>
                <p className="text-sm text-muted-foreground">Search across the promoted RFP set without dropping into the raw tenders intake.</p>
              </div>
              <Command className="w-full max-w-md overflow-visible rounded-md border border-input bg-background shadow-sm">
                <CommandInput
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Search organizations, titles, or categories..."
                  className="h-11 border-0 pl-2"
                />
              </Command>
            </div>
          }
          fields={[]}
          actions={query ? [{
            key: 'clear-query',
            label: 'Clear search',
            onClick: () => setQuery(''),
            variant: 'outline',
          }] : []}
          chips={query ? [{ key: 'query', label: `Search: ${query}`, onRemove: () => setQuery('') }] : []}
        />

        {loading ? (
          <section className="rounded-2xl border border-border/70 bg-card/70 p-8">
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading promoted RFP opportunities…
            </div>
          </section>
        ) : error ? (
          <section className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 text-rose-300" />
              <div>
                <h2 className="text-base font-semibold text-foreground">Could not load found RFPs</h2>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
          </section>
        ) : filteredRfps.length === 0 ? (
          <section className="rounded-2xl border border-border/70 bg-card/70 p-8">
            <div className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
              <Filter className="h-4 w-4 text-muted-foreground" />
              No promoted RFPs match the current filter
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Try clearing the search or inspect the raw tenders feed for unpromoted intake items.</p>
          </section>
        ) : (
          <section className="grid gap-4 xl:grid-cols-2">
            {filteredRfps.map((rfp) => (
              <Card key={rfp.id} className="border-border/70 bg-card/70 shadow-sm">
                <CardHeader className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <CardTitle className="text-xl leading-tight text-foreground">{rfp.title}</CardTitle>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <Building2 className="h-4 w-4" />
                          {rfp.organization}
                        </span>
                        {rfp.location ? (
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-4 w-4" />
                            {rfp.location}
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
                    {rfp.description || 'No summary was stored for this promoted RFP.'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {rfp.category ? <Badge variant="outline">{rfp.category}</Badge> : null}
                    <Badge variant="outline">
                      <Calendar className="mr-1 h-3.5 w-3.5" />
                      {formatDeadline(rfp.deadline)}
                    </Badge>
                    {rfp.entity_name ? <Badge variant="secondary">{rfp.entity_name}</Badge> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {rfp.entity_id ? (
                      <Button asChild variant="outline" size="sm">
                        <Link href={getEntityBrowserDossierHref(rfp.entity_id, '1') || `/entity-browser/${rfp.entity_id}/dossier?from=1`}>
                          Open dossier
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
          </section>
        )}
      </AppPageBody>
    </AppPageShell>
  )
}
