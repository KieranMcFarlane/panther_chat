'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ExternalLink, FileText, RefreshCw, Search } from 'lucide-react'
import { useEntitySummaries } from '@/lib/swr-config'
import { canonicalizeEntityType, canonicalizeLeagueName } from '@/lib/entity-taxonomy'

type RfpOpportunity = {
  id: string
  title: string
  organization: string
  description?: string | null
  location?: string | null
  value?: string | null
  deadline?: string | null
  published?: string | null
  source?: string | null
  source_url?: string | null
  category?: string | null
  status?: string | null
  type?: string | null
  confidence?: number | null
  yellow_panther_fit?: number | null
  priority_score?: number | null
  detected_at?: string | null
  entity_id?: string | null
  entity_graph_id?: string | null
  graph_id?: string | null
  neo4j_id?: string | null
  entity_name?: string | null
}

type RfpResultsResponse = {
  success?: boolean
  opportunities?: RfpOpportunity[]
  metadata?: Record<string, unknown>
  total?: number
}

type EntitySummary = {
  id: string
  graph_id?: string | number
  neo4j_id?: string | number
  name: string
  type?: string
  entity_type?: string
  sport?: string
  country?: string
  league?: string
  level?: string
}

type EntityTaxonomyResponse = {
  sports: string[]
  leagues: string[]
  leaguesBySport: Record<string, string[]>
}

function formatDate(value?: string | null) {
  if (!value) {
    return 'Unknown'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatConfidence(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'N/A'
  }

  const normalized = value <= 1 ? value * 100 : value
  return `${Math.round(normalized)}%`
}

function resolveDossierEntityId(rfp: RfpOpportunity): string | null {
  const candidate =
    rfp.entity_graph_id ||
    rfp.graph_id ||
    rfp.entity_id ||
    null

  if (!candidate) {
    return null
  }

  return String(candidate)
}

export default function UnifiedRfpPage() {
  const [rfps, setRfps] = useState<RfpOpportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sportFilter, setSportFilter] = useState('all')
  const [entityTypeFilter, setEntityTypeFilter] = useState('all')
  const [leagueFilter, setLeagueFilter] = useState('all')
  const [taxonomy, setTaxonomy] = useState<EntityTaxonomyResponse>({
    sports: [],
    leagues: [],
    leaguesBySport: {},
  })

  const { summaries } = useEntitySummaries('/api/entities/summary')

  const loadRfps = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/rfp-results?action=latest-rfps')
      const result = (await response.json()) as RfpResultsResponse & { error?: string }

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to load RFP opportunities')
      }

      setRfps(Array.isArray(result.opportunities) ? result.opportunities : [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load RFP opportunities')
      setRfps([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadRfps()
  }, [])

  useEffect(() => {
    const loadTaxonomy = async () => {
      try {
        const response = await fetch('/api/entities/taxonomy')
        if (!response.ok) return
        const payload = await response.json()
        setTaxonomy({
          sports: Array.isArray(payload.sports) ? payload.sports : [],
          leagues: Array.isArray(payload.leagues) ? payload.leagues : [],
          leaguesBySport: payload.leaguesBySport || {},
        })
      } catch {
        // non-blocking taxonomy fetch
      }
    }

    void loadTaxonomy()
  }, [])

  const summaryById = useMemo(() => {
    const map = new Map<string, EntitySummary>()
    const rows = Array.isArray(summaries) ? (summaries as EntitySummary[]) : []
    for (const row of rows) {
      if (row.id) map.set(String(row.id), row)
      if (row.graph_id) map.set(String(row.graph_id), row)
      if (row.neo4j_id) map.set(String(row.neo4j_id), row)
    }
    return map
  }, [summaries])

  const rfpEntityMeta = useMemo(() => {
    const meta = new Map<string, { sport: string; entityType: string; league: string }>()
    for (const rfp of rfps) {
      const lookupId = resolveDossierEntityId(rfp)
      const summary = lookupId ? summaryById.get(lookupId) : null
      const fallbackLeague = canonicalizeLeagueName(rfp.category || '')
      meta.set(rfp.id, {
        sport: String(summary?.sport || '').trim(),
        entityType: summary ? canonicalizeEntityType({ properties: { entity_type: summary.entity_type, type: summary.type } }) : '',
        league: canonicalizeLeagueName(summary?.league || summary?.level || fallbackLeague || ''),
      })
    }
    return meta
  }, [rfps, summaryById])

  const availableLeagues = sportFilter !== 'all'
    ? (taxonomy.leaguesBySport[sportFilter] || [])
    : taxonomy.leagues

  const filteredRfps = useMemo(() => {
    return rfps.filter((rfp) => {
      const haystack = [
        rfp.title,
        rfp.organization,
        rfp.description,
        rfp.entity_name,
        rfp.category,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesSearch = haystack.includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === 'all' || String(rfp.status || '').toLowerCase() === statusFilter
      const meta = rfpEntityMeta.get(rfp.id)
      const matchesSport = sportFilter === 'all' || meta?.sport === sportFilter
      const matchesType = entityTypeFilter === 'all' || meta?.entityType === entityTypeFilter
      const matchesLeague = leagueFilter === 'all' || meta?.league === leagueFilter
      return matchesSearch && matchesStatus && matchesSport && matchesType && matchesLeague
    })
  }, [rfps, searchTerm, statusFilter, sportFilter, entityTypeFilter, leagueFilter, rfpEntityMeta])

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl bg-slate-950 px-8 py-10 text-white shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">Unified RFP intelligence</p>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-4xl font-semibold">All surfaced RFPs in one place</h1>
              <p className="mt-3 text-base text-slate-300">
                This page reads the shared unified RFP table and links each opportunity back to the source entity dossier.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge className="bg-white/10 px-3 py-1 text-white hover:bg-white/10">
                {filteredRfps.length} visible
              </Badge>
              <Button onClick={() => void loadRfps()} variant="secondary" disabled={loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2 lg:grid-cols-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by organization, title, category, or entity"
              className="pl-9"
            />
          </div>
          <Select value={sportFilter} onValueChange={(value) => {
            setSportFilter(value)
            if (value === 'all') {
              setLeagueFilter('all')
            } else if (!(taxonomy.leaguesBySport[value] || []).includes(leagueFilter)) {
              setLeagueFilter('all')
            }
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by sport" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sports</SelectItem>
              {taxonomy.sports.map((sport) => (
                <SelectItem key={sport} value={sport}>{sport}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="team">Team</SelectItem>
              <SelectItem value="league">League</SelectItem>
              <SelectItem value="federation">Federation</SelectItem>
              <SelectItem value="rights_holder">Rights Holder</SelectItem>
              <SelectItem value="organisation">Organisation</SelectItem>
            </SelectContent>
          </Select>
          <Select value={leagueFilter} onValueChange={setLeagueFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by league" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Leagues</SelectItem>
              {availableLeagues.map((league) => (
                <SelectItem key={league} value={league}>{league}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="detected">Detected</SelectItem>
              <SelectItem value="qualified">Qualified</SelectItem>
              <SelectItem value="responded">Responded</SelectItem>
            </SelectContent>
          </Select>
        </section>

        {error ? (
          <Card>
            <CardContent className="py-8 text-sm text-red-600">{error}</CardContent>
          </Card>
        ) : null}

        {loading ? (
          <Card>
            <CardContent className="py-12 text-center text-slate-500">Loading unified RFP opportunities...</CardContent>
          </Card>
        ) : null}

        {!loading && !filteredRfps.length ? (
          <Card>
            <CardContent className="py-12 text-center text-slate-500">
              No RFP opportunities match the current filters.
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4">
          {filteredRfps.map((rfp) => {
            const dossierEntityId = resolveDossierEntityId(rfp)
            return (
            <Card key={rfp.id} className="border-slate-200 shadow-sm">
              <CardHeader className="gap-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-xl text-slate-950">{rfp.title}</CardTitle>
                      {rfp.status ? <Badge variant="outline">{rfp.status}</Badge> : null}
                      {rfp.category ? <Badge className="bg-slate-900 text-white hover:bg-slate-900">{rfp.category}</Badge> : null}
                    </div>
                    <p className="text-sm text-slate-600">{rfp.organization}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {dossierEntityId ? (
                      <Button asChild variant="outline">
                        <Link href={`/entity-browser/${dossierEntityId}/dossier?from=1`}>
                          <FileText className="mr-2 h-4 w-4" />
                          Open dossier
                        </Link>
                      </Button>
                    ) : null}
                    {rfp.source_url ? (
                      <Button asChild variant="outline">
                        <a href={rfp.source_url} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Source
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-6 text-slate-700">
                  {rfp.description || 'No description available.'}
                </p>
                <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <span className="font-semibold text-slate-900">Detected</span>
                    <div>{formatDate(rfp.detected_at || rfp.published)}</div>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Deadline</span>
                    <div>{formatDate(rfp.deadline)}</div>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Confidence</span>
                    <div>{formatConfidence(rfp.confidence)}</div>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Value</span>
                    <div>{rfp.value || 'Unknown'}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            )
          })}
        </div>
      </div>
    </main>
  )
}
