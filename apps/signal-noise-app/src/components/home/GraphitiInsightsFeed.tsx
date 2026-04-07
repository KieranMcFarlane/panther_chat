'use client'

import { useEffect, useState } from 'react'
import { Sparkles, ArrowRight, BrainCircuit, AlertCircle, Users, Network, Target, Radar, Wrench } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { HomeGraphitiInsightsResponse } from '@/lib/home-graphiti-contract'

export function GraphitiInsightsFeed() {
  const [data, setData] = useState<HomeGraphitiInsightsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const response = await fetch('/api/home/graphiti-insights', { cache: 'no-store' })
        const json = await response.json()
        setData(json)
      } catch (error) {
        console.error('Error fetching Graphiti insights:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchInsights()
    const interval = setInterval(fetchInsights, 60000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <Card className="border-white/10 bg-white/[0.04]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Sparkles className="h-5 w-5 text-amber-300" />
            Fresh Graphiti Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2].map((item) => (
              <div key={item} className="animate-pulse rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="h-4 w-2/3 rounded bg-white/10" />
                <div className="mt-3 h-3 w-full rounded bg-white/10" />
                <div className="mt-2 h-3 w-5/6 rounded bg-white/10" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.highlights.length === 0) {
    return (
      <Card className="border-white/10 bg-white/[0.04]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Sparkles className="h-5 w-5 text-amber-300" />
            Fresh Graphiti Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-300">
          No materialized insights are available yet. Once the Graphiti pipeline writes fresh feed records, they will appear here.
        </CardContent>
      </Card>
    )
  }

  const insightTypeLabel: Record<string, string> = {
    opportunity: 'Opportunity',
    watch_item: 'Watch item',
    operational: 'Operational',
  }
  const insightTypeIcon = (insightType?: string) => {
    switch (insightType) {
      case 'opportunity':
        return <Target className="h-4 w-4 text-emerald-300" />
      case 'operational':
        return <Wrench className="h-4 w-4 text-amber-300" />
      default:
        return <Radar className="h-4 w-4 text-sky-300" />
    }
  }

  return (
    <Card className="border-white/10 bg-white/[0.04] backdrop-blur-md">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-white">
              <Sparkles className="h-5 w-5 text-amber-300" />
              Fresh Graphiti Insights
            </CardTitle>
            <p className="mt-1 text-sm text-slate-400">
              Human-readable context materialized from the latest Graphiti pipeline run.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="border border-sky-400/20 bg-sky-500/10 text-sky-100 hover:bg-sky-500/10">
              {data.snapshot.insights_found} insights
            </Badge>
            <Badge className="border border-emerald-400/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/10">
              {data.snapshot.high_confidence_insights} high confidence
            </Badge>
            {data.status === 'degraded' && (
              <Badge className="border border-amber-400/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/10">
                <AlertCircle className="mr-1 h-3 w-3" />
                Partial feed
              </Badge>
            )}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Entities scanned</div>
            <div className="mt-1 text-lg font-semibold text-white">{data.snapshot.entities_scanned.toLocaleString()}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Updated</div>
            <div className="mt-1 text-sm font-semibold text-white">
              {new Date(data.snapshot.last_updated_at).toLocaleString()}
            </div>
          </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Source</div>
              <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-white">
                <BrainCircuit className="h-4 w-4 text-amber-300" />
                Materialized Graphiti feed
              </div>
            </div>
          </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3">
          {data.highlights.map((insight) => (
            <div key={insight.insight_id} className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge className="border border-white/10 bg-white/5 text-slate-100 hover:bg-white/5">
                      {insight.entity_name}
                    </Badge>
                    <Badge className="border border-sky-400/20 bg-sky-500/10 text-sky-100 hover:bg-sky-500/10">
                      {insight.league || insight.sport}
                    </Badge>
                    <Badge className="border border-white/10 bg-black/30 text-slate-100 hover:bg-black/30">
                      <span className="mr-1 inline-flex">{insightTypeIcon(insight.insight_type)}</span>
                      {insightTypeLabel[insight.insight_type || 'watch_item']}
                    </Badge>
                  </div>
                  <div className="text-lg font-semibold text-white">{insight.title}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-300">{insight.summary}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Badge className="border border-emerald-400/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/10">
                    {Math.round(insight.confidence * 100)}% confidence
                  </Badge>
                  <Badge className="border border-amber-400/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/10">
                    {insight.freshness}
                  </Badge>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Why it matters</div>
                  <div className="mt-1 text-sm text-slate-200">{insight.why_it_matters}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Suggested action</div>
                  <div className="mt-1 text-sm text-slate-200">{insight.suggested_action}</div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-400">
                  Detected {new Date(insight.detected_at).toLocaleString()}
                </div>
                <Button asChild size="sm" className="bg-amber-400 text-black hover:bg-amber-300">
                  <Link href={insight.destination_url || `/entity-browser/${insight.entity_id}/dossier?from=1`}>
                    Open dossier
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/entity-browser">
            <Button className="bg-amber-400 text-black hover:bg-amber-300">
              Open Entity Browser
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/graph">
            <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">
              Explore Graph
            </Button>
          </Link>
          <Link href="/entity-import">
            <Button variant="ghost" className="text-slate-200 hover:bg-white/5 hover:text-white">
              Import more data
            </Button>
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
            <Users className="h-4 w-4 text-sky-300" />
            Related entities
          </div>
          <div className="flex flex-wrap gap-2">
            {data.related_entities.slice(0, 6).map((entity) => (
              <Badge key={entity.entity_id} className="border border-white/10 bg-white/5 text-slate-100 hover:bg-white/5">
                <Network className="mr-1 h-3 w-3 text-amber-300" />
                {entity.name}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
