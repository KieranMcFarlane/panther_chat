'use client'

import { useEffect, useState } from 'react'
import { BarChart3, CircleDot, Clock3, Radar } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { OperationalSummary } from '@/lib/operational-summary'

interface OperationalStatusStripProps {
  drawerOpen: boolean
  onToggleDrawer: () => void
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
    detail: 'Waiting for operational summary',
  },
  enrichment: {
    statusLabel: 'Loading',
    detail: 'Waiting for enrichment progress',
  },
  pipeline: {
    statusLabel: 'Loading',
    detail: 'Waiting for pipeline summary',
  },
}

export function OperationalStatusStrip({ drawerOpen, onToggleDrawer }: OperationalStatusStripProps) {
  const [summary, setSummary] = useState<OperationalSummary>(fallbackSummary)

  useEffect(() => {
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
  }, [])

  const statusItems = [
    { label: 'Entities active', value: summary.cards.entitiesActive, tone: 'text-white' },
    { label: 'Pipeline live', value: summary.cards.pipelineLive, tone: 'text-sky-300' },
    { label: 'Blocked', value: summary.cards.blocked, tone: 'text-amber-300' },
    { label: 'Recent completions', value: summary.cards.recentCompletions, tone: 'text-emerald-300' },
  ] as const

  return (
    <section className="rounded-2xl border border-border bg-card px-4 py-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Badge className="gap-1.5 border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100">
            <Radar className="h-3.5 w-3.5" />
            Live Ops
          </Badge>
          <Badge variant="outline" className="gap-1.5 border-border text-muted-foreground">
            <CircleDot className="h-3.5 w-3.5 text-emerald-500" />
            API-backed runtime state
          </Badge>
          <Badge variant="outline" className="gap-1.5 border-border text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            {summary.updatedAt}
          </Badge>
        </div>

        <Button variant="outline" className="border-border" onClick={onToggleDrawer}>
          <BarChart3 className="mr-2 h-4 w-4" />
          {drawerOpen ? 'Hide run details' : 'Show run details'}
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statusItems.map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-muted/35 p-3">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{item.label}</div>
            <div className={`mt-1 text-2xl font-semibold ${item.tone}`}>{item.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="outline" className="border-emerald-200 text-emerald-700">
          Scout: {summary.scout.statusLabel}
        </Badge>
        <Badge variant="outline" className="border-amber-200 text-amber-700">
          Enrichment: {summary.enrichment.statusLabel}
        </Badge>
        <Badge variant="outline" className="border-blue-200 text-blue-700">
          Pipeline: {summary.pipeline.statusLabel}
        </Badge>
        <Badge variant="outline" className="border-fuchsia-200 text-fuchsia-700">
          Entities: {summary.cards.entitiesActive}
        </Badge>
      </div>
    </section>
  )
}
