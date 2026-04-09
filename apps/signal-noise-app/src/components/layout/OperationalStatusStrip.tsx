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
    <section className="rounded-2xl border border-custom-border bg-custom-box px-4 py-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Badge className="gap-1.5 border border-sky-500/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/15">
            <Radar className="h-3.5 w-3.5" />
            Live Ops
          </Badge>
          <Badge variant="outline" className="gap-1.5 border-custom-border text-fm-light-grey">
            <CircleDot className="h-3.5 w-3.5 text-emerald-400" />
            API-backed runtime state
          </Badge>
          <Badge variant="outline" className="gap-1.5 border-custom-border text-fm-light-grey">
            <Clock3 className="h-3.5 w-3.5" />
            {summary.updatedAt}
          </Badge>
        </div>

        <Button variant="outline" className="border-custom-border" onClick={onToggleDrawer}>
          <BarChart3 className="mr-2 h-4 w-4" />
          {drawerOpen ? 'Hide run details' : 'Show run details'}
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statusItems.map((item) => (
          <div key={item.label} className="rounded-xl border border-custom-border bg-custom-bg/70 p-3">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-300">{item.label}</div>
            <div className={`mt-1 text-2xl font-semibold ${item.tone}`}>{item.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="outline" className="border-emerald-500/30 text-emerald-300">
          Scout: {summary.scout.statusLabel}
        </Badge>
        <Badge variant="outline" className="border-amber-500/30 text-amber-300">
          Enrichment: {summary.enrichment.statusLabel}
        </Badge>
        <Badge variant="outline" className="border-blue-500/30 text-blue-300">
          Pipeline: {summary.pipeline.statusLabel}
        </Badge>
        <Badge variant="outline" className="border-fuchsia-500/30 text-fuchsia-300">
          Entities: {summary.cards.entitiesActive}
        </Badge>
      </div>
    </section>
  )
}
