'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ExternalLink, FileText, RefreshCw, Search } from 'lucide-react'

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
  entity_name?: string | null
}

type RfpResultsResponse = {
  success?: boolean
  opportunities?: RfpOpportunity[]
  metadata?: Record<string, unknown>
  total?: number
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

export default function UnifiedRfpPage() {
  const [rfps, setRfps] = useState<RfpOpportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

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
      return matchesSearch && matchesStatus
    })
  }, [rfps, searchTerm, statusFilter])

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

        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by organization, title, category, or entity"
              className="pl-9"
            />
          </div>
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
          {filteredRfps.map((rfp) => (
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
                    {rfp.entity_id ? (
                      <Button asChild variant="outline">
                        <Link href={`/entity-browser/${rfp.entity_id}/dossier?from=1`}>
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
          ))}
        </div>
      </div>
    </main>
  )
}
