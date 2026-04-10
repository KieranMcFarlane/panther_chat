'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowUpRight, Building2, Calendar, ExternalLink, Filter, Loader2, MapPin, Sparkles, Target } from 'lucide-react'

import { AppPageBody, AppPageHeader, AppPageShell } from '@/components/layout/AppPageShell'
import { FacetFilterBar, type FacetFilterField } from '@/components/filters/FacetFilterBar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Command, CommandInput } from '@/components/ui/command'
import { buildCanonicalOpportunitySearchText, matchesCanonicalSearch } from '@/lib/canonical-search'
import { getEntityBrowserDossierHref } from '@/lib/entity-routing'
import { buildOpportunityFacetOptions, getOpportunityTaxonomyDisplayValues, normalizeOpportunityTaxonomy } from '@/lib/opportunity-taxonomy.mjs'

type OpportunityTaxonomy = {
  sport: string
  competition: string
  entity_role: string
  opportunity_kind: string
  theme: string
}

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
  sport?: string | null
  competition?: string | null
  entity_role?: string | null
  opportunity_kind?: string | null
  theme?: string | null
  taxonomy?: OpportunityTaxonomy | null
  metadata?: Record<string, unknown> | null
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

function normalizeRfp(opportunity: FoundRfp) {
  const taxonomy = opportunity.taxonomy || normalizeOpportunityTaxonomy({
    ...opportunity,
    title: opportunity.title,
    organization: opportunity.organization,
    description: opportunity.description,
    category: opportunity.category,
    metadata: opportunity.metadata || undefined,
  })
  const displayTaxonomy = getOpportunityTaxonomyDisplayValues(taxonomy)

  return {
    ...opportunity,
    taxonomy,
    sport: displayTaxonomy.sport,
    competition: displayTaxonomy.competition,
    entity_role: displayTaxonomy.entity_role,
    opportunity_kind: displayTaxonomy.opportunity_kind,
    theme: displayTaxonomy.theme,
  }
}

function getCanonicalContext(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' · ')
}

export default function RfpsPage() {
  const [rfps, setRfps] = useState<ReturnType<typeof normalizeRfp>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sportFilter, setSportFilter] = useState('all')
  const [competitionFilter, setCompetitionFilter] = useState('all')
  const [entityRoleFilter, setEntityRoleFilter] = useState('all')
  const [opportunityKindFilter, setOpportunityKindFilter] = useState('all')

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
          setRfps(Array.isArray(payload.opportunities) ? payload.opportunities.map(normalizeRfp) : [])
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
    let filtered = [...rfps]

    if (normalizedQuery) {
      filtered = filtered.filter((rfp) =>
        matchesCanonicalSearch(normalizedQuery, buildCanonicalOpportunitySearchText(rfp)),
      )
    }

    if (sportFilter !== 'all') filtered = filtered.filter((rfp) => rfp.sport === sportFilter)
    if (competitionFilter !== 'all') filtered = filtered.filter((rfp) => rfp.competition === competitionFilter)
    if (entityRoleFilter !== 'all') filtered = filtered.filter((rfp) => rfp.entity_role === entityRoleFilter)
    if (opportunityKindFilter !== 'all') filtered = filtered.filter((rfp) => rfp.opportunity_kind === opportunityKindFilter)
    return filtered
  }, [competitionFilter, entityRoleFilter, opportunityKindFilter, query, rfps, sportFilter])

  const taxonomyFacetOptions = useMemo(() => buildOpportunityFacetOptions(rfps), [rfps])
  const filterFields: FacetFilterField[] = [
    {
      key: 'sport',
      label: 'Sport',
      value: sportFilter,
      placeholder: 'Sport',
      options: taxonomyFacetOptions.sport,
      onValueChange: setSportFilter,
    },
    {
      key: 'competition',
      label: 'Competition',
      value: competitionFilter,
      placeholder: 'Competition',
      options: taxonomyFacetOptions.competition,
      onValueChange: setCompetitionFilter,
    },
    {
      key: 'entity-role',
      label: 'Role',
      value: entityRoleFilter,
      placeholder: 'Role',
      options: taxonomyFacetOptions.entity_role,
      onValueChange: setEntityRoleFilter,
    },
    {
      key: 'opportunity-kind',
      label: 'Opportunity Kind',
      value: opportunityKindFilter,
      placeholder: 'Opportunity Kind',
      options: taxonomyFacetOptions.opportunity_kind,
      onValueChange: setOpportunityKindFilter,
    },
  ]

  const chips = [
    query ? { key: 'query', label: `Search: ${query}`, onRemove: () => setQuery('') } : null,
    sportFilter !== 'all' ? { key: 'sport', label: `Sport: ${sportFilter}`, onRemove: () => setSportFilter('all') } : null,
    competitionFilter !== 'all' ? { key: 'competition', label: `Competition: ${competitionFilter}`, onRemove: () => setCompetitionFilter('all') } : null,
    entityRoleFilter !== 'all' ? { key: 'entity-role', label: `Role: ${entityRoleFilter}`, onRemove: () => setEntityRoleFilter('all') } : null,
    opportunityKindFilter !== 'all' ? { key: 'opportunity-kind', label: `Opportunity Kind: ${opportunityKindFilter}`, onRemove: () => setOpportunityKindFilter('all') } : null,
  ].filter(Boolean) as { key: string; label: string; onRemove: () => void }[]

  const highFitCount = filteredRfps.filter((rfp) => Number(rfp.yellow_panther_fit || 0) >= 90).length

  const resetFilters = () => {
    setQuery('')
    setSportFilter('all')
    setCompetitionFilter('all')
    setEntityRoleFilter('all')
    setOpportunityKindFilter('all')
  }

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
          searchSlot={(
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-foreground">Operator shortlist</h2>
                <p className="text-sm text-muted-foreground">Search and filter the promoted RFP set without dropping into the raw intake feed.</p>
              </div>
              <Command className="w-full max-w-md overflow-visible rounded-md border border-input bg-background shadow-sm">
                <CommandInput
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Search club, sport, country, league..."
                  className="h-11 border-0 pl-2"
                />
              </Command>
            </div>
          )}
          fields={filterFields}
          actions={query || sportFilter !== 'all' || competitionFilter !== 'all' || entityRoleFilter !== 'all' || opportunityKindFilter !== 'all' ? [{
            key: 'clear-filters',
            label: 'Clear filters',
            onClick: resetFilters,
            variant: 'outline',
          }] : []}
          chips={chips}
          status={(
            <div className="flex items-center text-sm text-fm-light-grey">
              <Filter className="mr-2 h-4 w-4" />
              {filteredRfps.length} of {rfps.length}
            </div>
          )}
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
            <p className="mt-2 text-sm text-muted-foreground">Try clearing the filters or inspect the raw tenders feed for unpromoted intake items.</p>
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
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground/80">Canonical context:</span>{' '}
                        {getCanonicalContext([rfp.sport, rfp.competition, rfp.entity_role, rfp.theme])}
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
                    {rfp.sport ? <Badge variant="outline">{rfp.sport}</Badge> : null}
                    {rfp.competition ? <Badge variant="outline">{rfp.competition}</Badge> : null}
                    {rfp.entity_role ? <Badge variant="outline">{rfp.entity_role}</Badge> : null}
                    {rfp.opportunity_kind ? <Badge variant="outline">{rfp.opportunity_kind}</Badge> : null}
                    {rfp.theme ? <Badge variant="outline">{rfp.theme}</Badge> : null}
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
