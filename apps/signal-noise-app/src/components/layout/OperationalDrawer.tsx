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
      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="h-4 w-4 text-yellow-600" />
          Operational Snapshot
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-4">
        <div className="space-y-3 rounded-xl border border-border bg-muted/35 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Loader2 className="h-4 w-4 text-sky-600" />
            Active runs
          </div>
          <div className="space-y-2">
            {activeRuns.map((item) => (
              <div key={item.label} className="rounded-lg border border-border bg-background p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-foreground">{item.label}</div>
                  <Badge variant="outline" className="border-sky-200 text-sky-700">
                    {item.badge}
                  </Badge>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-muted/35 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            Blocked
          </div>
          <div className="space-y-2">
            {blockedRuns.map((item) => (
              <div key={item.label} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="font-medium text-amber-900">{item.label}</div>
                <div className="mt-1 text-sm text-muted-foreground">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-muted/35 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Clock3 className="h-4 w-4 text-slate-600" />
            Stale
          </div>
          <div className="space-y-2">
            {staleItems.map((item) => (
              <div key={item.label} className="rounded-lg border border-border bg-background p-3">
                <div className="font-medium text-foreground">{item.label}</div>
                <div className="mt-1 text-sm text-muted-foreground">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-muted/35 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Recent completions
          </div>
          <div className="space-y-2">
            {recentCompletions.map((item) => (
              <div key={item.label} className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <div className="font-medium text-emerald-900">{item.label}</div>
                <div className="mt-1 text-sm text-muted-foreground">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
