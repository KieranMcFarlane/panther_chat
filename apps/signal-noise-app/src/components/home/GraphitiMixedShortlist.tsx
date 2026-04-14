'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, AlertCircle, BrainCircuit, Calendar, Sparkles, Target, Wrench } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { GraphitiMixedShortlistResponse } from '@/lib/graphiti-shortlist'

export function GraphitiMixedShortlist() {
  const [data, setData] = useState<GraphitiMixedShortlistResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchShortlist = async () => {
      try {
        const response = await fetch('/api/home/graphiti-shortlist', { cache: 'no-store' })
        const json = await response.json()
        if (!response.ok) {
          throw new Error(typeof json?.error === 'string' ? json.error : `Graphiti shortlist request failed (${response.status})`)
        }

        setData({
          source: 'graphiti_shortlist',
          status: json?.status === 'ready' || json?.status === 'degraded' || json?.status === 'empty' ? json.status : 'empty',
          generated_at: String(json?.generated_at || new Date().toISOString()),
          last_updated_at: String(json?.last_updated_at || new Date().toISOString()),
          shortlist: Array.isArray(json?.shortlist) ? json.shortlist : [],
          snapshot: json?.snapshot && typeof json.snapshot === 'object'
            ? {
                opportunities: Number(json.snapshot.opportunities || 0),
                operational: Number(json.snapshot.operational || 0),
                watch_items: Number(json.snapshot.watch_items || 0),
                total: Number(json.snapshot.total || 0),
                freshness_window_hours: Number(json.snapshot.freshness_window_hours || 24),
              }
            : {
                opportunities: 0,
                operational: 0,
                watch_items: 0,
                total: 0,
                freshness_window_hours: 24,
              },
          warnings: Array.isArray(json?.warnings) ? json.warnings : undefined,
        })
      } catch (error) {
        console.error('Error fetching mixed Graphiti shortlist:', error)
        setData({
          source: 'graphiti_shortlist',
          status: 'empty',
          generated_at: new Date().toISOString(),
          last_updated_at: new Date().toISOString(),
          shortlist: [],
          snapshot: {
            opportunities: 0,
            operational: 0,
            watch_items: 0,
            total: 0,
            freshness_window_hours: 24,
          },
          warnings: ['Unable to load the Graphiti mixed shortlist right now.'],
        })
      } finally {
        setLoading(false)
      }
    }

    fetchShortlist()
    const interval = setInterval(fetchShortlist, 60000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <Card className="border-white/10 bg-white/[0.04]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Sparkles className="h-5 w-5 text-amber-300" />
            Mixed Graphiti Shortlist
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

  const shortlist = Array.isArray(data?.shortlist) ? data.shortlist : []

  if (!data || shortlist.length === 0) {
    return (
      <Card className="border-white/10 bg-white/[0.04]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Sparkles className="h-5 w-5 text-amber-300" />
            Mixed Graphiti Shortlist
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-300">
          <div>
            No mixed shortlist rows are available yet. The feed will show canonical opportunities together with high-conviction operational and watch-item rows once the Graphiti pipeline writes them.
          </div>
          {Array.isArray(data?.warnings) && data.warnings.length > 0 && (
            <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-amber-100">
              {data.warnings[0]}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const kindLabel: Record<string, string> = {
    opportunity: 'Opportunity',
    watch_item: 'Watch item',
    operational: 'Operational',
  }

  const kindIcon = (kind?: string) => {
    switch (kind) {
      case 'opportunity':
        return <Target className="h-4 w-4 text-emerald-300" />
      case 'operational':
        return <Wrench className="h-4 w-4 text-amber-300" />
      default:
        return <BrainCircuit className="h-4 w-4 text-sky-300" />
    }
  }

  return (
    <Card className="border-white/10 bg-white/[0.04] backdrop-blur-md">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-white">
              <Sparkles className="h-5 w-5 text-amber-300" />
              Mixed Graphiti Shortlist
            </CardTitle>
            <p className="mt-1 text-sm text-slate-400">
              Canonical opportunities plus high-conviction operational and watch-item rows from the same materialized Graphiti layer.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="border border-emerald-400/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/10">
              {data.snapshot.total} cards
            </Badge>
            <Badge className="border border-sky-400/20 bg-sky-500/10 text-sky-100 hover:bg-sky-500/10">
              {data.snapshot.opportunities} opportunities
            </Badge>
            <Badge className="border border-amber-400/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/10">
              {data.snapshot.watch_items} watch items
            </Badge>
            {data.snapshot.operational > 0 && (
              <Badge className="border border-orange-400/20 bg-orange-500/10 text-orange-100 hover:bg-orange-500/10">
                {data.snapshot.operational} operational
              </Badge>
            )}
            {data.status === 'degraded' && (
              <Badge className="border border-amber-400/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/10">
                <AlertCircle className="mr-1 h-3 w-3" />
                Partial feed
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-400">
          <span>Updated {new Date(data.last_updated_at).toLocaleString()}</span>
          <span>Freshness window {data.snapshot.freshness_window_hours}h</span>
          <span>Source Graphiti shortlist</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3">
          {shortlist.map((item) => (
            <div key={`${item.kind}:${item.id}`} className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge className="border border-white/10 bg-white/5 text-slate-100 hover:bg-white/5">
                      {item.entity_name}
                    </Badge>
                    <Badge className="border border-white/10 bg-black/30 text-slate-100 hover:bg-black/30">
                      <span className="mr-1 inline-flex">{kindIcon(item.kind)}</span>
                      {kindLabel[item.kind] || 'Watch item'}
                    </Badge>
                    <Badge className="border border-sky-400/20 bg-sky-500/10 text-sky-100 hover:bg-sky-500/10">
                      {Math.round(item.confidence * 100)}% confidence
                    </Badge>
                  </div>
                  <div className="text-lg font-semibold text-white">{item.title}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-300">{item.summary}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Badge className="border border-white/10 bg-white/5 text-slate-100 hover:bg-white/5">
                    {item.priority}
                  </Badge>
                  <Badge className="border border-amber-400/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/10">
                    <Calendar className="mr-1 h-3 w-3" />
                    {new Date(item.detected_at).toLocaleDateString()}
                  </Badge>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Why it matters</div>
                  <div className="mt-1 text-sm leading-6 text-slate-200">{item.why_it_matters}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Suggested action</div>
                  <div className="mt-1 text-sm leading-6 text-slate-200">{item.suggested_action}</div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <Badge key={`${item.id}-${tag}`} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button asChild variant="outline" className="flex-1 border-white/10 bg-white/[0.02] text-white hover:bg-white/10">
                  <Link href={item.destination_url}>
                    <ArrowRight className="mr-1 h-3 w-3" />
                    Open dossier
                  </Link>
                </Button>
                {item.kind === 'opportunity' && (
                  <Button asChild className="flex-1 bg-amber-400 text-black hover:bg-amber-300">
                    <Link href="/opportunities">
                      <Target className="mr-1 h-3 w-3" />
                      Review opportunities
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default GraphitiMixedShortlist
