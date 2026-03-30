'use client'

import Link from 'next/link'
import { ArrowRight, RefreshCw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface EntityEnrichmentSummaryCardProps {
  title?: string
  statusLabel: string
  lastUpdatedLabel: string
  recentAdditions: string[]
  onRunEnrichment: () => void
  advancedHref: string
  compact?: boolean
  primaryActionLabel?: string
}

export function EntityEnrichmentSummaryCard({
  title = 'Live enrichment summary for this entity',
  statusLabel,
  lastUpdatedLabel,
  recentAdditions,
  onRunEnrichment,
  advancedHref,
  compact = false,
  primaryActionLabel = 'Run enrichment',
}: EntityEnrichmentSummaryCardProps) {
  const visibleAdditions = recentAdditions.filter(Boolean).slice(0, 3)

  return (
    <Card className={compact ? 'border-emerald-200 bg-emerald-50/60 shadow-sm' : 'border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-slate-50 shadow-sm'}>
      <CardHeader className={compact ? 'pb-3' : 'pb-4'}>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className={compact ? 'text-sm' : 'text-base'}>Enrichment status</CardTitle>
            <p className="text-sm text-muted-foreground">{title}</p>
          </div>
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
            {statusLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className={compact ? 'space-y-3' : 'space-y-4'}>
        <div className={compact ? 'grid gap-3 sm:grid-cols-2' : 'grid gap-4 md:grid-cols-2'}>
          <div className="rounded-xl border border-emerald-100 bg-white/80 p-3">
            <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Last updated</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{lastUpdatedLabel}</div>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-white/80 p-3">
            <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Recent contact/company additions</div>
            <div className="mt-2 space-y-2">
              {visibleAdditions.length > 0 ? (
                visibleAdditions.map((item) => (
                  <div key={item} className="rounded-lg border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-sm text-slate-800">
                    {item}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No recent enrichment additions yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={(event) => {
              event.stopPropagation()
              onRunEnrichment()
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {primaryActionLabel}
          </Button>
          <Button variant="outline" asChild className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
            <Link
              href={advancedHref}
              onClick={(event) => {
                event.stopPropagation()
              }}
            >
              Open advanced enrichment
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default EntityEnrichmentSummaryCard
