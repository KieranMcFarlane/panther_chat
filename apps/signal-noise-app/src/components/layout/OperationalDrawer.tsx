'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Clock3, ListChecks, Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { OperationalSummary } from '@/lib/operational-summary'

interface OperationalDrawerProps {
  open: boolean
}

const fallbackSummary: OperationalSummary = {
  updatedAt: 'Loading...',
  cards: {
    entitiesActive: '…',
    pipelineLive: '…',
    blocked: '…',
    recentCompletions: '…',
  },
  scout: {
    statusLabel: 'Loading',
    detail: 'Waiting for scout summary',
  },
  enrichment: {
    statusLabel: 'Loading',
    detail: 'Waiting for enrichment summary',
  },
  pipeline: {
    statusLabel: 'Loading',
    detail: 'Waiting for pipeline summary',
  },
}

export function OperationalDrawer({ open }: OperationalDrawerProps) {
  const [summary, setSummary] = useState<OperationalSummary>(fallbackSummary)

  useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false

    async function loadSummary() {
      try {
        const response = await fetch('/api/operational-summary')
        if (!response.ok) {
          throw new Error(`Failed to load operational summary (${response.status})`)
        }

        const payload = await response.json()
        if (!cancelled && payload?.data) {
          setSummary(payload.data as OperationalSummary)
        }
      } catch {
        if (!cancelled) {
          setSummary((current) => current)
        }
      }
    }

    loadSummary()

    return () => {
      cancelled = true
    }
  }, [open])

  const activeRuns = useMemo(
    () => [
      { label: 'Scout', detail: summary.scout.detail, badge: summary.scout.statusLabel },
      { label: 'Enrichment', detail: summary.enrichment.detail, badge: summary.enrichment.statusLabel },
      { label: 'Pipeline', detail: summary.pipeline.detail, badge: summary.pipeline.statusLabel },
    ],
    [summary],
  )

  const blockedRuns = useMemo(
    () =>
      [
        { label: 'Scout', item: summary.scout },
        { label: 'Enrichment', item: summary.enrichment },
        { label: 'Pipeline', item: summary.pipeline },
      ]
        .filter(({ item }) => /blocked|failed|degraded/i.test(item.statusLabel))
        .map(({ label, item }) => ({
          label,
          detail: item.detail,
        })),
    [summary],
  )

  const staleItems = useMemo(
    () => [
      { label: 'Last runtime refresh', detail: summary.updatedAt },
      { label: 'Entities active', detail: `${summary.cards.entitiesActive} entities in active workspace` },
    ],
    [summary],
  )

  const recentCompletions = useMemo(
    () => [
      { label: 'Recent completions', detail: `${summary.cards.recentCompletions} completed recently` },
      { label: 'Pipeline live', detail: `${summary.cards.pipelineLive} active pipeline runs` },
    ],
    [summary],
  )

  if (!open) {
    return null
  }

  return (
    <Card className="border-custom-border bg-custom-box shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="h-4 w-4 text-yellow-400" />
          Operational Snapshot
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-4">
        <div className="space-y-3 rounded-xl border border-custom-border bg-custom-bg/70 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <Loader2 className="h-4 w-4 text-sky-300" />
            Active runs
          </div>
          <div className="space-y-2">
            {activeRuns.map((item) => (
              <div key={item.label} className="rounded-lg border border-custom-border/80 bg-custom-box/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-white">{item.label}</div>
                  <Badge variant="outline" className="border-sky-500/30 text-sky-300">
                    {item.badge}
                  </Badge>
                </div>
                <div className="mt-1 text-sm text-fm-light-grey">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-custom-border bg-custom-bg/70 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <AlertCircle className="h-4 w-4 text-amber-300" />
            Blocked
          </div>
          <div className="space-y-2">
            {blockedRuns.map((item) => (
              <div key={item.label} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <div className="font-medium text-amber-100">{item.label}</div>
                <div className="mt-1 text-sm text-fm-light-grey">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-custom-border bg-custom-bg/70 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <Clock3 className="h-4 w-4 text-slate-300" />
            Stale
          </div>
          <div className="space-y-2">
            {staleItems.map((item) => (
              <div key={item.label} className="rounded-lg border border-slate-600/60 bg-slate-900/30 p-3">
                <div className="font-medium text-white">{item.label}</div>
                <div className="mt-1 text-sm text-fm-light-grey">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-custom-border bg-custom-bg/70 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
            Recent completions
          </div>
          <div className="space-y-2">
            {recentCompletions.map((item) => (
              <div key={item.label} className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                <div className="font-medium text-emerald-100">{item.label}</div>
                <div className="mt-1 text-sm text-fm-light-grey">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
