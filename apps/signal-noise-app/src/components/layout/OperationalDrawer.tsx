'use client'

import { AlertCircle, CheckCircle2, Clock3, ListChecks, Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface OperationalDrawerProps {
  open: boolean
}

const activeRuns = [
  { label: 'Scout', detail: 'Scanning fresh RFP sources', badge: 'Running' },
  { label: 'Opportunities', detail: 'Sorting shortlist candidates', badge: 'Ready' },
] as const

const blockedRuns = [
  { label: 'Enrichment', detail: 'Waiting for persisted dossier state' },
] as const

const staleItems = [
  { label: 'Pipeline', detail: 'Last refresh 18m ago' },
] as const

const recentCompletions = [
  { label: 'Entity browser', detail: 'Smoke journey loaded successfully' },
  { label: 'Tenders feed', detail: 'Verified sources refreshed' },
] as const

export function OperationalDrawer({ open }: OperationalDrawerProps) {
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
