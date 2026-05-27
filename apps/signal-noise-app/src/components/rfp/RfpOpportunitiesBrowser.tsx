'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Building2, Calendar, ExternalLink, Radio, Sparkles, Target } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export type RfpBrowserOpportunity = {
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
  opportunity_type?: string | null
  metadata?: {
    opportunity_type?: string | null
    source_type?: string | null
  } | null
}

type CategoryFilter = {
  name: string
  count: number
}

type RfpOpportunitiesBrowserProps = {
  opportunities: RfpBrowserOpportunity[]
  categories: CategoryFilter[]
  pageSize?: number
}

function normalizeCategory(value: string | null | undefined): string {
  return (value || 'sports technology').replace(/[_-]+/g, ' ').trim() || 'sports technology'
}

function normalizeOpportunityType(opportunity: RfpBrowserOpportunity): 'rfp' | 'signal' {
  const value = (opportunity.opportunity_type || opportunity.metadata?.opportunity_type || '').toLowerCase()
  return value === 'rfp' ? 'rfp' : 'signal'
}

function formatOpportunityType(value: 'rfp' | 'signal'): string {
  return value === 'rfp' ? 'RFP' : 'Signal'
}

function formatStatus(value: string | null | undefined): string {
  if (!value) return ''
  return value.replace(/[_-]+/g, ' ').trim()
}

function isUnknownOrganization(value: string | null | undefined): boolean {
  return !value || value.trim().toLowerCase() === 'unknown organization'
}

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

function getDossierHref(entityId: string): string {
  return `/entity-browser/${entityId}/dossier?from=rfps`
}

function slugifyCategory(value: string): string {
  return normalizeCategory(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'uncategorised'
}

function readUrlState(categories: CategoryFilter[]) {
  if (typeof window === 'undefined') return { category: 'all', page: 1, type: 'rfp' as const }

  const params = new URLSearchParams(window.location.search)
  const categoryParam = params.get('category') || 'all'
  const category = categories.find((candidate) => slugifyCategory(candidate.name) === categoryParam)?.name || 'all'
  const parsedPage = Number.parseInt(params.get('page') || '1', 10)
  const typeParam = params.get('type')
  const type = typeParam === 'all' ? 'all' : typeParam === 'signals' ? 'signal' : 'rfp'

  return {
    category,
    page: Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    type,
  }
}

function writeUrlState(category: string, type: 'all' | 'rfp' | 'signal', page: number, mode: 'push' | 'replace' = 'push') {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)
  if (category === 'all') {
    url.searchParams.delete('category')
  } else {
    url.searchParams.set('category', slugifyCategory(category))
  }

  url.searchParams.set('type', type === 'rfp' ? 'rfps' : type === 'signal' ? 'signals' : 'all')

  if (page <= 1) {
    url.searchParams.delete('page')
  } else {
    url.searchParams.set('page', String(page))
  }

  const next = `${url.pathname}${url.search}${url.hash}`
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
  if (next === current) return

  window.history[mode === 'replace' ? 'replaceState' : 'pushState']({ rfpCategory: category, rfpType: type, rfpPage: page }, '', next)
}

export function RfpOpportunitiesBrowser({
  opportunities,
  categories,
  pageSize = 24,
}: RfpOpportunitiesBrowserProps) {
  const initialState = useMemo(() => readUrlState(categories), [categories])
  const [activeCategory, setActiveCategory] = useState<string>(initialState.category)
  const [activeType, setActiveType] = useState<'all' | 'rfp' | 'signal'>(initialState.type)
  const [page, setPage] = useState(initialState.page)
  const hasMounted = useRef(false)

  const typeCounts = useMemo(() => {
    return opportunities.reduce(
      (counts, opportunity) => {
        counts[normalizeOpportunityType(opportunity)] += 1
        return counts
      },
      { rfp: 0, signal: 0 } as Record<'rfp' | 'signal', number>,
    )
  }, [opportunities])

  const typeFilteredOpportunities = useMemo(() => {
    if (activeType === 'all') return opportunities
    return opportunities.filter((opportunity) => normalizeOpportunityType(opportunity) === activeType)
  }, [activeType, opportunities])

  const visibleCategories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const opportunity of typeFilteredOpportunities) {
      const category = normalizeCategory(opportunity.category)
      counts.set(category, (counts.get(category) || 0) + 1)
    }

    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
      .slice(0, 6)
  }, [typeFilteredOpportunities])

  const filteredOpportunities = useMemo(() => {
    if (activeCategory === 'all') return typeFilteredOpportunities
    return typeFilteredOpportunities.filter((opportunity) => normalizeCategory(opportunity.category) === activeCategory)
  }, [activeCategory, typeFilteredOpportunities])

  const totalPages = Math.max(1, Math.ceil(filteredOpportunities.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * pageSize
  const visibleOpportunities = filteredOpportunities.slice(pageStart, pageStart + pageSize)

  function selectCategory(category: string) {
    setActiveCategory(category)
    setPage(1)
  }

  function selectType(type: 'all' | 'rfp' | 'signal') {
    setActiveType(type)
    setActiveCategory('all')
    setPage(1)
  }

  function setPagedUrl(nextPage: number) {
    setPage(nextPage)
  }

  useEffect(() => {
    const onPopState = () => {
      const nextState = readUrlState(categories)
      setActiveCategory(nextState.category)
      setActiveType(nextState.type)
      setPage(nextState.page)
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [categories])

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true
      writeUrlState(activeCategory, activeType, safePage, 'replace')
      return
    }

    writeUrlState(activeCategory, activeType, safePage, 'push')
  }, [activeCategory, activeType, safePage])

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {activeType === 'signal' ? 'Market signals' : activeType === 'all' ? 'All recovered opportunities' : 'Direct RFPs'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {activeType === 'signal'
              ? 'Partnerships, deployments, hiring, awards, and planning signals worth monitoring.'
              : activeType === 'all'
                ? 'Direct procurement and softer market signals, deduplicated by source URL and title.'
                : 'Open or concrete procurement items separated from softer market signals.'}
          </p>
        </div>
        <Badge variant="outline">{filteredOpportunities.length} shown</Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={activeType === 'rfp' ? 'default' : 'outline'}
          onClick={() => selectType('rfp')}
        >
          RFPs · {typeCounts.rfp}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={activeType === 'signal' ? 'default' : 'outline'}
          onClick={() => selectType('signal')}
        >
          Signals · {typeCounts.signal}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={activeType === 'all' ? 'default' : 'outline'}
          onClick={() => selectType('all')}
        >
          All · {opportunities.length}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={activeCategory === 'all' ? 'default' : 'outline'}
          onClick={() => selectCategory('all')}
        >
          Any category · {typeFilteredOpportunities.length}
        </Button>
        {visibleCategories.map((category) => (
          <Button
            key={category.name}
            type="button"
            size="sm"
            variant={activeCategory === category.name ? 'default' : 'outline'}
            className="capitalize"
            onClick={() => selectCategory(category.name)}
          >
            {category.name} · {category.count}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {visibleOpportunities.map((rfp) => (
          <Card
            key={`${rfp.source_url || rfp.id}-${rfp.title}`}
            className={`min-w-0 shadow-sm ${
              normalizeOpportunityType(rfp) === 'rfp'
                ? 'border-yellow-500/30 bg-card'
                : 'border-sky-500/20 bg-card/80'
            }`}
          >
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <CardTitle className="break-words text-lg leading-tight text-foreground sm:text-xl">{rfp.title}</CardTitle>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    {!isUnknownOrganization(rfp.organization) ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Building2 className="h-4 w-4" />
                        {rfp.organization}
                      </span>
                    ) : null}
                    {rfp.canonical_entity_name ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4" />
                        {rfp.canonical_entity_name}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={normalizeOpportunityType(rfp) === 'rfp' ? 'default' : 'secondary'}>
                    {normalizeOpportunityType(rfp) === 'rfp' ? <Target className="mr-1 h-3.5 w-3.5" /> : <Radio className="mr-1 h-3.5 w-3.5" />}
                    {formatOpportunityType(normalizeOpportunityType(rfp))}
                  </Badge>
                  <Badge variant={fitTone(rfp.yellow_panther_fit)}>
                    {typeof rfp.yellow_panther_fit === 'number' ? `${rfp.yellow_panther_fit}% fit` : 'Fit pending'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="overflow-hidden text-sm leading-6 text-muted-foreground [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]">
                {rfp.description || 'No summary was stored for this merged Manus opportunity.'}
              </p>
              <div className="flex flex-wrap gap-2">
                {rfp.category ? <Badge variant="outline" className="capitalize">{normalizeCategory(rfp.category)}</Badge> : null}
                {rfp.status ? <Badge variant="outline" className="capitalize">{formatStatus(rfp.status)}</Badge> : null}
                {rfp.deadline || normalizeOpportunityType(rfp) === 'rfp' ? (
                  <Badge variant="outline">
                    <Calendar className="mr-1 h-4 w-4" />
                    {formatDeadline(rfp.deadline)}
                  </Badge>
                ) : null}
                {rfp.entity_name && !isUnknownOrganization(rfp.entity_name) ? <Badge variant="secondary">{rfp.entity_name}</Badge> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {rfp.canonical_entity_id ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={getDossierHref(rfp.canonical_entity_id)}>
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

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 bg-card px-4 py-3">
        <div className="text-sm text-muted-foreground">
          Page <span className="font-medium text-foreground">{safePage}</span> of{' '}
          <span className="font-medium text-foreground">{totalPages}</span>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setPagedUrl(Math.max(1, safePage - 1))} disabled={safePage <= 1}>
            Previous
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setPagedUrl(Math.min(totalPages, safePage + 1))} disabled={safePage >= totalPages}>
            Next
          </Button>
        </div>
      </div>
    </section>
  )
}
