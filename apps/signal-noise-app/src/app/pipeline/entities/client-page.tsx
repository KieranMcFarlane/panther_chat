'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

type DossierStatus = 'ready' | 'stale' | 'pending' | 'rerun_needed' | 'missing'

type EntityRow = {
  id: string
  name: string
  type: string
  sport: string
  league: string
  country: string
  dossier_status: DossierStatus
  dossier_summary: string | null
  latest_generated_at: string | null
  review_status: string
  rerun_reason: string | null
}

type ApiResponse = {
  entities: EntityRow[]
  page: number
  totalPages: number
  total: number
  hasNext: boolean
  hasPrev: boolean
}

const STATUS_COLORS: Record<DossierStatus, string> = {
  ready: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  stale: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  pending: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  missing: 'bg-red-500/20 text-red-300 border-red-500/30',
  rerun_needed: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
}

const STATUS_LABELS: Record<DossierStatus, string> = {
  ready: 'Ready',
  stale: 'Stale',
  pending: 'Pending',
  missing: 'Missing',
  rerun_needed: 'Rerun needed',
}

const ENTITY_TYPES = ['all', 'ORG', 'PERSON', 'PRODUCT', 'INITIATIVE', 'VENUE', 'Federation', 'Club', 'League', 'Country', 'Government']
const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'ready', label: 'Ready' },
  { value: 'stale', label: 'Stale' },
  { value: 'pending', label: 'Pending' },
  { value: 'rerun_needed', label: 'Rerun needed' },
  { value: 'missing', label: 'Missing' },
]

function formatTime(iso: string | null): string {
  if (!iso) return '-'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

export default function PipelineEntitiesClientPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const sortBy = searchParams.get('sortBy') || 'pipeline'
  const sortOrder = searchParams.get('sortOrder') || 'desc'
  const status = searchParams.get('status') || 'all'
  const search = searchParams.get('search') || ''
  const entityType = searchParams.get('entityType') || 'all'

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit), sortBy, sortOrder, status, search, entityType })
      const res = await fetch(`/api/pipeline/entities?${params}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`Failed to load (${res.status})`)
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load entities')
    } finally {
      setLoading(false)
    }
  }, [page, limit, sortBy, sortOrder, status, search, entityType])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value && value !== 'all') {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    }
    // Reset to page 1 when filters change (unless changing page itself)
    if (!('page' in updates)) params.set('page', '1')
    router.push(`/pipeline/entities?${params.toString()}`)
  }

  const totalPages = data?.totalPages ?? 1

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Pipeline Entities</h1>
        <p className="mt-1 text-sm text-fm-light-grey">
          Audit all {data?.total ?? '...'} entities against dossier completion status.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search entities..."
          value={search}
          onChange={(e) => updateParams({ search: e.target.value })}
          className="rounded-md border border-custom-border bg-custom-bg px-3 py-2 text-sm text-white placeholder-fm-light-grey focus:border-yellow-400 focus:outline-none"
        />
        <select
          value={entityType}
          onChange={(e) => updateParams({ entityType: e.target.value })}
          className="rounded-md border border-custom-border bg-custom-bg px-3 py-2 text-sm text-white"
        >
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>{t === 'all' ? 'All types' : t}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => updateParams({ status: e.target.value })}
          className="rounded-md border border-custom-border bg-custom-bg px-3 py-2 text-sm text-white"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={`${sortBy}-${sortOrder}`}
          onChange={(e) => {
            const [by, order] = e.target.value.split('-')
            updateParams({ sortBy: by, sortOrder: order })
          }}
          className="rounded-md border border-custom-border bg-custom-bg px-3 py-2 text-sm text-white"
        >
          <option value="pipeline-desc">Pipeline order</option>
          <option value="name-asc">Name A-Z</option>
          <option value="name-desc">Name Z-A</option>
          <option value="type-asc">Type A-Z</option>
          <option value="sport-asc">Sport A-Z</option>
          <option value="status-asc">Status (missing first)</option>
          <option value="status-desc">Status (ready first)</option>
          <option value="lastGenerated-desc">Last generated (newest)</option>
          <option value="lastGenerated-asc">Last generated (oldest)</option>
        </select>
        <select
          value={String(limit)}
          onChange={(e) => updateParams({ limit: e.target.value })}
          className="rounded-md border border-custom-border bg-custom-bg px-3 py-2 text-sm text-white"
        >
          <option value="25">25 per page</option>
          <option value="50">50 per page</option>
          <option value="100">100 per page</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-custom-border bg-custom-box overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-custom-border hover:bg-transparent">
              <TableHead className="text-slate-400 w-12">#</TableHead>
              <TableHead className="text-slate-400">Entity</TableHead>
              <TableHead className="text-slate-400">Type</TableHead>
              <TableHead className="text-slate-400">Sport</TableHead>
              <TableHead className="text-slate-400">Dossier</TableHead>
              <TableHead className="text-slate-400">Generated</TableHead>
              <TableHead className="text-slate-400 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && !data ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-fm-light-grey">
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-yellow-400" />
                    Loading...
                  </div>
                </TableCell>
              </TableRow>
            ) : data?.entities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-fm-light-grey">No entities match your filters.</TableCell>
              </TableRow>
            ) : (
              data?.entities.map((entity, idx) => (
                <TableRow
                  key={entity.id}
                  className="border-custom-border cursor-pointer hover:bg-white/5"
                  onClick={() => router.push(`/entity-browser/${encodeURIComponent(entity.id)}/dossier?from=1`)}
                >
                  <TableCell className="text-fm-light-grey text-xs">{(page - 1) * limit + idx + 1}</TableCell>
                  <TableCell>
                    <div className="font-medium text-white">{entity.name}</div>
                    {entity.league && <div className="text-xs text-fm-light-grey">{entity.league}</div>}
                  </TableCell>
                  <TableCell className="text-fm-light-grey text-sm">{entity.type}</TableCell>
                  <TableCell className="text-fm-light-grey text-sm">{entity.sport || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${STATUS_COLORS[entity.dossier_status]}`}>
                      {STATUS_LABELS[entity.dossier_status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-fm-light-grey text-sm">{formatTime(entity.latest_generated_at)}</TableCell>
                  <TableCell className="text-right">
                    <a
                      href={`/entity-browser/${encodeURIComponent(entity.id)}/dossier?from=1`}
                      className="text-xs text-sky-300 underline underline-offset-2 hover:text-white"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Dossier
                    </a>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-fm-light-grey">
          <div>
            Page {page} of {totalPages} ({data.total} entities)
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={!data.hasPrev}
              onClick={() => updateParams({ page: String(page - 1) })}
              className="rounded-md border border-custom-border bg-custom-bg px-3 py-1.5 text-sm text-white disabled:opacity-30 disabled:cursor-not-allowed hover:border-white/30"
            >
              Previous
            </button>
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              let pageNum: number
              if (totalPages <= 7) {
                pageNum = i + 1
              } else if (page <= 4) {
                pageNum = i + 1
              } else if (page >= totalPages - 3) {
                pageNum = totalPages - 6 + i
              } else {
                pageNum = page - 3 + i
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => updateParams({ page: String(pageNum) })}
                  className={`rounded-md border px-3 py-1.5 text-sm ${pageNum === page ? 'border-yellow-400 text-yellow-300' : 'border-custom-border text-fm-light-grey hover:border-white/30'}`}
                >
                  {pageNum}
                </button>
              )
            })}
            <button
              disabled={!data.hasNext}
              onClick={() => updateParams({ page: String(page + 1) })}
              className="rounded-md border border-custom-border bg-custom-bg px-3 py-1.5 text-sm text-white disabled:opacity-30 disabled:cursor-not-allowed hover:border-white/30"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
