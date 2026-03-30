'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type AuditRow = {
  id: string
  sync_run_id: string
  trigger: string
  status: 'passed' | 'failed' | 'skipped'
  started_at: string
  completed_at: string | null
  duration_ms: number | null
  steps: Array<{ command: string; durationMs: number }>
  error_message: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export default function CanonicalMaintenanceAuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [status, setStatus] = useState<'all' | 'passed' | 'failed' | 'skipped'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadRows = useCallback(async (nextStatus: string) => {
    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams({
        limit: '100',
        status: nextStatus,
      })
      const response = await fetch(`/api/admin/canonical-maintenance-audit?${query.toString()}`)
      if (!response.ok) {
        throw new Error(`Failed to load audits (${response.status})`)
      }
      const data = await response.json()
      setRows(Array.isArray(data.rows) ? data.rows : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audits')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRows(status)
  }, [status, loadRows])

  return (
    <div className="container mx-auto px-4 py-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Canonical Maintenance Audit</h1>
          <p className="text-sm text-muted-foreground">Latest post-sync remediation and QA runs</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/entity-pipeline">Entity Pipeline</Link>
          </Button>
          <Button onClick={() => loadRows(status)} variant="outline" size="sm">Refresh</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="passed">Passed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="skipped">Skipped</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline">{rows.length} rows</Badge>
        </CardContent>
      </Card>

      {loading && <p className="text-sm text-muted-foreground">Loading audits...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-3">
        {!loading && rows.length === 0 && (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">No audit rows found for this filter.</CardContent>
          </Card>
        )}
        {rows.map((row) => (
          <Card key={row.id}>
            <CardContent className="py-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={row.status === 'failed' ? 'destructive' : row.status === 'passed' ? 'default' : 'secondary'}
                >
                  {row.status}
                </Badge>
                <Badge variant="outline">{row.trigger}</Badge>
                <span className="text-xs text-muted-foreground">syncRunId: {row.sync_run_id}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                started {new Date(row.started_at).toLocaleString()} · duration {row.duration_ms ?? 0}ms
              </div>
              {row.error_message && (
                <div className="text-sm text-red-600">{row.error_message}</div>
              )}
              <div className="space-y-1">
                {Array.isArray(row.steps) && row.steps.length > 0 ? (
                  row.steps.map((step, idx) => (
                    <div key={`${row.id}-${idx}`} className="text-xs">
                      <code>{step.command}</code> · {step.durationMs}ms
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-muted-foreground">No steps recorded.</div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
