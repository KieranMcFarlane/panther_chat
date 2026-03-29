'use client'

import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ScoutPanelProps {
  statusLabel: string
  sourceCoverage: string
  freshnessLabel: string
  onRunScout: () => void
  runDisabled?: boolean
}

export function ScoutPanel({
  statusLabel,
  sourceCoverage,
  freshnessLabel,
  onRunScout,
  runDisabled = false,
}: ScoutPanelProps) {
  const scoutStats = [
    { label: 'Scout run', value: statusLabel },
    { label: 'Source coverage', value: sourceCoverage },
    { label: 'Freshness', value: freshnessLabel },
  ] as const

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50 via-white to-slate-50 shadow-sm">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Scout panel</CardTitle>
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
            Live
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Broad sports RFP discovery. Keeps the intake feed fresh without stealing the main page.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          {scoutStats.map((item) => (
            <div key={item.label} className="rounded-xl border border-blue-100 bg-white/80 p-3">
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{item.label}</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{item.value}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={onRunScout} disabled={runDisabled}>
            Run scout
          </Button>
          <Button variant="outline" asChild className="border-blue-200 text-blue-700 hover:bg-blue-50">
            <Link href="/rfp-analysis-control-center">Advanced scout</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
