'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Briefcase, Clock3, Route, Sparkles, Target, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getEntityBrowserDossierHref } from '@/lib/entity-routing'

type QueueEntityRecord = {
  entity_id: string
  entity_name: string
  entity_type: string
  state: 'completed' | 'in_progress' | 'upcoming' | 'resume_needed'
  client_ready: boolean
  promoted: boolean
  summary: string | null
  generated_at: string | null
  active_question_id?: string | null
  publication_status?: string | null
  publication_mode?: string | null
  repair_state?: string | null
  repair_retry_count?: number | null
  repair_retry_budget?: number | null
  next_repair_question_id?: string | null
  reconciliation_state?: string | null
}

type ClientReadyDossierCard = {
  entity_id: string
  browser_entity_id: string
  entity_name: string
  entity_type: string
  generated_at: string | null
  summary: string | null
  dossier_path: string
  buyer_hypothesis: string | null
  best_path: string | null
}

type RfpCard = {
  id: string
  title: string
  organization: string
  description: string | null
  yellow_panther_fit: number | null
  category: string | null
  deadline: string | null
  source_url: string | null
  entity_id: string | null
  entity_name: string | null
}

type SalesSummaryItem = {
  entity_id: string
  entity_name: string
  buyer_hypothesis: string | null
  buyer_title: string | null
  best_path_owner: string | null
  path_type: string | null
  opportunity_framing: string | null
  capability_gap: string | null
  outreach_route: string | null
}

type HomeQueueDashboardPayload = {
  loop_status: {
    total_scheduled: number
    completed: number
    failed: number
    retryable_failures: number
    client_ready_dossiers: number
    promoted_dossiers: number
    last_successful_canonical_run_at: string | null
    health: 'active' | 'stale' | 'idle'
    source: 'pipeline_runs' | 'diagnostics' | 'snapshot'
    last_activity_at: string | null
    quality_counts: Record<'partial' | 'blocked' | 'complete' | 'client_ready', number>
    runtime_counts: Record<'running' | 'stalled' | 'retryable' | 'resume_needed', number>
  }
  queue: {
    completed_entities: QueueEntityRecord[]
    in_progress_entity: QueueEntityRecord | null
    resume_needed_entities: QueueEntityRecord[]
    upcoming_entities: QueueEntityRecord[]
  }
  client_ready_dossiers: ClientReadyDossierCard[]
  rfp_cards: RfpCard[]
  sales_summary: {
    status: 'available' | 'empty'
    highlights: SalesSummaryItem[]
  }
  dossier_quality: {
    counts: Record<'partial' | 'blocked' | 'complete' | 'client_ready', number>
    incomplete_entities: Array<{
      entity_id: string
      browser_entity_id: string
      entity_name: string
      entity_type: string
      quality_state: 'partial' | 'blocked' | 'complete' | 'client_ready'
      quality_summary: string | null
      generated_at: string | null
      question_count: number
      source: 'question_first_dossier' | 'question_first_run'
    }>
  }
  rollout_proof_set: Array<{
    entity_id: string
    browser_entity_id: string
    entity_name: string
    expected_quality_state: 'partial' | 'blocked' | 'complete' | 'client_ready'
    actual_quality_state: string
    question_count: number
    validation_sample: boolean
    summary: string | null
  }>
}

function toText(value: unknown) {
  if (value === null || value === undefined) return ''
  return String(value)
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function formatLoopHealth(health: HomeQueueDashboardPayload['loop_status']['health']) {
  if (health === 'active') return 'Loop active'
  if (health === 'stale') return 'Loop stalled'
  return 'Loop idle'
}

function formatLoopSource(source: HomeQueueDashboardPayload['loop_status']['source']) {
  if (source === 'pipeline_runs') return 'Supabase pipeline runs'
  if (source === 'diagnostics') return 'Diagnostics artifacts'
  return 'Published snapshot fallback'
}

function formatQualityState(value: string) {
  if (value === 'client_ready') return 'Client-ready'
  if (value === 'complete') return 'Complete'
  if (value === 'blocked') return 'Blocked'
  if (value === 'partial') return 'Partial'
  return 'Missing'
}

function formatRunType(value: string | null | undefined) {
  return String(value || '').startsWith('repair') ? 'Repair run' : 'Full run'
}

function formatPublicationState(value: string | null | undefined) {
  if (value === 'published_degraded') return 'Published degraded'
  if (value === 'published') return 'Published healthy'
  if (value === 'publish_failed') return 'Publish failed'
  return null
}

function formatRepairState(value: string | null | undefined) {
  if (value === 'queued') return 'Auto-repair queued'
  if (value === 'repairing') return 'Repairing'
  if (value === 'exhausted') return 'Exhausted'
  return null
}

function QueueCard({ item }: { item: QueueEntityRecord }) {
  const stateLabel = item.client_ready
    ? 'Client-ready'
    : item.state === 'resume_needed'
      ? 'Resume needed'
    : item.state === 'completed'
      ? 'Run completed'
      : item.state === 'in_progress'
        ? 'In progress'
        : 'Upcoming'

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{item.entity_name}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">{item.entity_type}</p>
        </div>
        <Badge
          className={item.client_ready ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-white/10 bg-white/5 text-slate-200'}
        >
          {stateLabel}
        </Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs uppercase tracking-[0.14em] text-slate-400">
        <span>{formatRunType(item.publication_mode)}</span>
        {formatPublicationState(item.publication_status) ? <span>{formatPublicationState(item.publication_status)}</span> : null}
        {item.publication_status === 'published_degraded' ? <span>Reconciliation pending</span> : null}
        {formatRepairState(item.repair_state) ? <span>{formatRepairState(item.repair_state)}</span> : null}
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-300">{toText(item.summary) || 'No summary available yet.'}</p>
      {item.next_repair_question_id ? (
        <p className="mt-2 text-xs uppercase tracking-[0.14em] text-sky-300">
          next repair root: {item.next_repair_question_id}
        </p>
      ) : null}
      {typeof item.repair_retry_count === 'number' || typeof item.repair_retry_budget === 'number' ? (
        <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-400">
          retry budget: {item.repair_retry_count ?? 0}/{item.repair_retry_budget ?? 0}
        </p>
      ) : null}
      {!item.client_ready && item.state === 'completed' ? (
        <p className="mt-2 text-xs uppercase tracking-[0.14em] text-amber-300">Not promoted to a client dossier yet</p>
      ) : null}
      {item.generated_at ? (
        <p className="mt-3 text-xs text-slate-500">Updated {formatDate(item.generated_at)}</p>
      ) : null}
    </div>
  )
}

export function HomeQueueDashboard() {
  const [data, setData] = useState<HomeQueueDashboardPayload | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch('/api/home/queue-dashboard', { cache: 'no-store' })
        const payload = await response.json()
        setData(payload)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="mt-10 grid gap-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((index) => (
            <Card key={index} className="border-white/10 bg-white/[0.04] animate-pulse">
              <CardContent className="p-5">
                <div className="h-4 w-24 rounded bg-white/10" />
                <div className="mt-4 h-8 w-16 rounded bg-white/10" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <Card className="mt-10 border-white/10 bg-white/[0.04]">
        <CardContent className="p-6 text-sm text-slate-300">
          Unable to load the live loop dashboard right now.
        </CardContent>
      </Card>
    )
  }

  const { loop_status, queue, client_ready_dossiers, rfp_cards, sales_summary, dossier_quality, rollout_proof_set } = data
  const healthLabel = formatLoopHealth(loop_status.health)

  return (
    <div className="mt-10 space-y-8">
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <Badge className={loop_status.health === 'active'
              ? 'border border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
              : loop_status.health === 'stale'
                ? 'border border-amber-400/30 bg-amber-500/10 text-amber-200'
                : 'border border-slate-400/30 bg-slate-500/10 text-slate-200'
            }>
              {healthLabel}
            </Badge>
            <h2 className="mt-4 text-3xl font-semibold text-white">Home queue dashboard</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              This dashboard uses one runtime source of truth at a time for loop status and queue lanes, then layers in client-ready dossier cards and Graphiti / Yellow Panther sales synthesis from persisted canonical dossiers.
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Source of truth: {formatLoopSource(loop_status.source)}. Last observed activity: {formatDate(loop_status.last_activity_at)}.
            </p>
          </div>
          <div className="text-sm text-slate-400">
            Last successful canonical run: {formatDate(loop_status.last_successful_canonical_run_at)}
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-4 xl:grid-cols-6">
          <Card className="border-white/10 bg-black/20"><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.16em] text-slate-400">Universe</p><p className="mt-3 text-3xl font-semibold text-white">{loop_status.total_scheduled}</p></CardContent></Card>
          <Card className="border-white/10 bg-black/20"><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.16em] text-slate-400">Completed</p><p className="mt-3 text-3xl font-semibold text-white">{loop_status.completed}</p></CardContent></Card>
          <Card className="border-white/10 bg-black/20"><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.16em] text-slate-400">Failed</p><p className="mt-3 text-3xl font-semibold text-white">{loop_status.failed}</p></CardContent></Card>
          <Card className="border-white/10 bg-black/20"><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.16em] text-slate-400">Retryable</p><p className="mt-3 text-3xl font-semibold text-white">{loop_status.retryable_failures}</p></CardContent></Card>
          <Card className="border-white/10 bg-black/20"><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.16em] text-slate-400">Client-ready dossiers</p><p className="mt-3 text-3xl font-semibold text-emerald-300">{loop_status.client_ready_dossiers}</p></CardContent></Card>
          <Card className="border-white/10 bg-black/20"><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.16em] text-slate-400">Promoted dossiers</p><p className="mt-3 text-3xl font-semibold text-amber-300">{loop_status.promoted_dossiers}</p></CardContent></Card>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-white/10 bg-black/20"><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.16em] text-slate-400">Running now</p><p className="mt-3 text-3xl font-semibold text-white">{loop_status.runtime_counts.running}</p></CardContent></Card>
          <Card className="border-white/10 bg-black/20"><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.16em] text-slate-400">Stalled runs</p><p className="mt-3 text-3xl font-semibold text-amber-200">{loop_status.runtime_counts.stalled}</p></CardContent></Card>
          <Card className="border-white/10 bg-black/20"><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.16em] text-slate-400">Retryable runs</p><p className="mt-3 text-3xl font-semibold text-orange-200">{loop_status.runtime_counts.retryable}</p></CardContent></Card>
          <Card className="border-white/10 bg-black/20"><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.16em] text-slate-400">Resume needed</p><p className="mt-3 text-3xl font-semibold text-sky-200">{loop_status.runtime_counts.resume_needed}</p></CardContent></Card>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-white/10 bg-black/20"><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.16em] text-slate-400">Partial dossiers</p><p className="mt-3 text-3xl font-semibold text-amber-200">{loop_status.quality_counts.partial}</p></CardContent></Card>
          <Card className="border-white/10 bg-black/20"><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.16em] text-slate-400">Blocked dossiers</p><p className="mt-3 text-3xl font-semibold text-orange-200">{loop_status.quality_counts.blocked}</p></CardContent></Card>
          <Card className="border-white/10 bg-black/20"><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.16em] text-slate-400">Complete dossiers</p><p className="mt-3 text-3xl font-semibold text-sky-200">{loop_status.quality_counts.complete}</p></CardContent></Card>
          <Card className="border-white/10 bg-black/20"><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.16em] text-slate-400">Client-ready quality</p><p className="mt-3 text-3xl font-semibold text-emerald-300">{loop_status.quality_counts.client_ready}</p></CardContent></Card>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-4">
        <Card className="border-white/10 bg-white/[0.04]">
          <CardHeader><CardTitle className="flex items-center gap-2 text-white"><Clock3 className="h-5 w-5 text-amber-300" />In progress now</CardTitle></CardHeader>
          <CardContent>
            {queue.in_progress_entity ? <QueueCard item={queue.in_progress_entity} /> : <p className="text-sm text-slate-300">No entity is actively running right now.</p>}
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-white/[0.04]">
          <CardHeader><CardTitle className="flex items-center gap-2 text-white"><Route className="h-5 w-5 text-amber-300" />Resume needed</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {queue.resume_needed_entities.length > 0 ? queue.resume_needed_entities.map((item) => <QueueCard key={item.entity_id} item={item} />) : <p className="text-sm text-slate-300">No resumable or stalled entities right now.</p>}
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-white/[0.04]">
          <CardHeader><CardTitle className="flex items-center gap-2 text-white"><Sparkles className="h-5 w-5 text-emerald-300" />Completed recently</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs leading-5 text-slate-400">
              These cards prove loop progress. Only items in the separate <span className="text-emerald-300">Client-ready dossiers</span> section are safe to review as client dossier artifacts.
            </p>
            {queue.completed_entities.length > 0 ? queue.completed_entities.map((item) => <QueueCard key={item.entity_id} item={item} />) : <p className="text-sm text-slate-300">No completed entities yet.</p>}
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-white/[0.04]">
          <CardHeader><CardTitle className="flex items-center gap-2 text-white"><ArrowRight className="h-5 w-5 text-sky-300" />Coming up next</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {queue.upcoming_entities.length > 0 ? queue.upcoming_entities.map((item) => <QueueCard key={item.entity_id} item={item} />) : <p className="text-sm text-slate-300">No upcoming entities queued.</p>}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-white/10 bg-white/[0.04]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white"><Route className="h-5 w-5 text-sky-300" />Rollout proof set</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs leading-5 text-slate-400">
              This set is the QA and loop-acceptance source of truth. Validation samples stay false until the canonical browser route resolves to the expected full-pack quality state.
            </p>
            {rollout_proof_set.map((item) => (
              <div key={item.entity_id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{item.entity_name}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                      Expected {formatQualityState(item.expected_quality_state)} • {item.question_count} questions
                    </p>
                  </div>
                  <Badge className={item.validation_sample ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-white/10 bg-white/5 text-slate-200'}>
                    {item.validation_sample ? 'Validation sample' : formatQualityState(item.actual_quality_state)}
                  </Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">{toText(item.summary) || 'No persisted dossier summary is available yet.'}</p>
                <div className="mt-4">
                  <Button asChild size="sm" variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10">
                    <Link href={getEntityBrowserDossierHref(item.browser_entity_id, '1') || `/entity-browser/${encodeURIComponent(item.browser_entity_id)}/dossier?from=1`}>
                      Open dossier
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-white/[0.04]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white"><Users className="h-5 w-5 text-emerald-300" />Client-ready dossiers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {client_ready_dossiers.length > 0 ? client_ready_dossiers.map((item) => (
              <div key={item.entity_id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{item.entity_name}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">{item.entity_type}</p>
                  </div>
                  <Badge className="border-emerald-400/30 bg-emerald-500/10 text-emerald-200">Client-ready</Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">{toText(item.summary) || 'Canonical dossier promoted and ready for client review.'}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                  {item.buyer_hypothesis ? <span>Buyer: {item.buyer_hypothesis}</span> : null}
                  {item.best_path ? <span>Path: {item.best_path}</span> : null}
                </div>
                <div className="mt-4">
                  <Link href={getEntityBrowserDossierHref(item.browser_entity_id, '1') || `/entity-browser/${encodeURIComponent(item.browser_entity_id)}/dossier`}>
                    <Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10">
                      Open dossier
                    </Button>
                  </Link>
                </div>
              </div>
            )) : <p className="text-sm text-slate-300">No client-ready dossiers are available yet.</p>}
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card className="border-white/10 bg-white/[0.04]">
            <CardHeader><CardTitle className="flex items-center gap-2 text-white"><Briefcase className="h-5 w-5 text-amber-300" />Promoted opportunities</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {rfp_cards.length > 0 ? rfp_cards.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{item.organization}</p>
                      <p className="mt-1 text-sm text-slate-300">{item.title}</p>
                    </div>
                    <Badge className="border-amber-400/30 bg-amber-500/10 text-amber-200">
                      {Math.round(Number(item.yellow_panther_fit || 0))}% fit
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{toText(item.description) || 'No source-backed description available.'}</p>
                </div>
              )) : <p className="text-sm text-slate-300">No promoted opportunities are available yet.</p>}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/[0.04]">
            <CardHeader><CardTitle className="flex items-center gap-2 text-white"><Target className="h-5 w-5 text-sky-300" />Graphiti / Yellow Panther sales brief</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {sales_summary.status === 'available' ? sales_summary.highlights.map((item) => (
                <div key={item.entity_id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-semibold text-white">{item.entity_name}</p>
                  <p className="mt-2 text-sm text-slate-300">
                    {toText(item.buyer_hypothesis || item.buyer_title) || 'Buyer hypothesis pending'}{item.best_path_owner ? ` via ${item.best_path_owner}` : ''}
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                    {toText(item.opportunity_framing || item.capability_gap || item.outreach_route) || 'No Graphiti digest available.'}
                  </p>
                  {item.path_type ? <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">Route: {item.path_type}</p> : null}
                </div>
              )) : <p className="text-sm text-slate-300">Graphiti sales synthesis is not available yet. The dashboard stays empty until promoted canonical dossiers provide it.</p>}
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <Card className="border-white/10 bg-white/[0.04]">
          <CardHeader><CardTitle className="flex items-center gap-2 text-white"><Briefcase className="h-5 w-5 text-amber-300" />Needs full-pack completion</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs leading-5 text-slate-400">
              These entities produced question-first artifacts, but they are still partial and should not be treated as completed rollout outputs.
            </p>
            {dossier_quality.incomplete_entities.length > 0 ? dossier_quality.incomplete_entities.map((item) => (
              <div key={item.browser_entity_id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{item.entity_name}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                      {item.entity_type} • {item.question_count} questions • {formatQualityState(item.quality_state)}
                    </p>
                  </div>
                  <Badge className="border-amber-400/30 bg-amber-500/10 text-amber-200">
                    {item.source === 'question_first_dossier' ? 'Persisted partial' : 'Run-only partial'}
                  </Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">{toText(item.quality_summary) || 'Partial artifact: full-pack completion has not been reached yet.'}</p>
                <p className="mt-2 text-xs text-slate-500">Updated {formatDate(item.generated_at)}</p>
              </div>
            )) : <p className="text-sm text-slate-300">No partial artifacts are currently visible in the canonical dossier store.</p>}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

export default HomeQueueDashboard
