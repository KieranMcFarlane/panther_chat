'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Briefcase, Clock3, Route, Sparkles, Target, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getEntityBrowserDossierHref } from '@/lib/entity-routing'
import {
  getCachedOperationalDrilldownPayload,
  loadOperationalDrilldownPayload,
  refreshOperationalDrilldownPayload,
  startOperationalDrilldownPolling,
  subscribeOperationalDrilldown,
  type OperationalDrilldownPayload,
  type OperationalQueueEntity,
} from '@/lib/operational-drilldown-client'
import { buildCheckpointSummary, formatCheckpointQuestionProgress, formatCheckpointSourceOrder } from '@/lib/operational-checkpoint'
import { formatPlaylistSortKey } from '@/lib/playlist-sort-key'

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
  current_section_id?: string | null
  current_section_label?: string | null
  current_section_index?: number | null
  current_section_total?: number | null
  current_question_id?: string | null
  current_question_text?: string | null
  current_question_index?: number | null
  current_question_total?: number | null
  current_strategy_label?: string | null
  current_execution_state?: string | null
  current_source_order?: string[] | null
  current_substep_label?: string | null
  current_substep_progress?: string | null
  current_action?: string | null
  run_phase?: string | null
  publication_status?: string | null
  publication_mode?: string | null
  repair_state?: string | null
  repair_retry_count?: number | null
  repair_retry_budget?: number | null
  next_repair_question_id?: string | null
  next_repair_status?: string | null
  next_repair_batch_id?: string | null
  next_repair_batch_status?: string | null
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
  control?: {
    is_paused?: boolean
    requested_state?: 'running' | 'paused'
    observed_state?: 'starting' | 'running' | 'stopping' | 'paused'
    transition_state?: 'starting' | 'running' | 'stopping' | 'paused'
  }
  live_operational?: {
    control?: {
      is_paused?: boolean
      requested_state?: 'running' | 'paused'
      observed_state?: 'starting' | 'running' | 'stopping' | 'paused'
      transition_state?: 'starting' | 'running' | 'stopping' | 'paused'
    }
    operational_state?: 'starting' | 'running' | 'stopping' | 'paused' | 'stopped' | 'waiting'
    freshness_state?: 'fresh' | 'stale'
    last_activity_at?: string | null
    loop_status?: {
      universe_count: number
      total_scheduled: number
      completed: number
      processed_dossiers?: number
      failed: number
      retryable_failures: number
      client_ready_dossiers: number
      promoted_dossiers: number
      last_successful_canonical_run_at: string | null
      health: 'active' | 'stale' | 'idle'
      source: 'pipeline_runs' | 'diagnostics' | 'snapshot'
      last_activity_at: string | null
      quality_counts: Record<'partial' | 'blocked' | 'complete' | 'client_ready', number>
      runtime_counts: Record<'running' | 'queued' | 'stalled' | 'retryable' | 'resume_needed', number>
    }
    queue?: {
      completed_entities: QueueEntityRecord[]
      in_progress_entity: QueueEntityRecord | null
      running_entities: QueueEntityRecord[]
      stale_active_rows: QueueEntityRecord[]
      processed_entities?: QueueEntityRecord[]
      resume_needed_entities: QueueEntityRecord[]
      upcoming_entities: QueueEntityRecord[]
    }
  }
  playlist_sort_key: string[]
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
  if (health === 'stale') return 'Stale data'
  return 'Loop idle'
}

function formatLoopSource(source: HomeQueueDashboardPayload['loop_status']['source']) {
  if (source === 'pipeline_runs') return 'local Postgres pipeline runs'
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

function openOperationalKanban() {
  window.dispatchEvent(
    new CustomEvent('open-operational-kanban', {
      detail: { activeSection: 'running' },
    }),
  )
}

function formatRepairState(value: string | null | undefined) {
  if (value === 'queued') return 'Auto-repair queued'
  if (value === 'repairing') return 'Repairing'
  if (value === 'exhausted') return 'Exhausted'
  return null
}

function formatNextRepairStatus(value: string | null | undefined) {
  if (value === 'planned') return 'Next repair planned'
  if (value === 'queued') return 'Next repair queued'
  if (value === 'running') return 'Next repair running'
  if (value === 'completed') return 'Next repair completed'
  if (value === 'failed') return 'Next repair failed'
  if (value === 'exhausted') return 'Next repair exhausted'
  return null
}

function isSelfHealingRunning(item: QueueEntityRecord) {
  return item.state === 'in_progress' && item.next_repair_status === 'running'
}

function QueueCard({ item }: { item: QueueEntityRecord }) {
  const checkpointSummary = buildCheckpointSummary(item)
  const questionProgress = formatCheckpointQuestionProgress(item)
  const stateLabel = item.client_ready
    ? 'Client-ready'
    : item.run_phase === 'stalled'
      ? 'Stopped'
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
        <div className="flex flex-wrap items-center justify-end gap-2">
          {isSelfHealingRunning(item) ? (
            <Badge className="border border-cyan-400/30 bg-cyan-500/10 text-cyan-200">
              Next repair running
            </Badge>
          ) : null}
          <Badge
            className={item.client_ready ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-white/10 bg-white/5 text-slate-200'}
          >
            {stateLabel}
          </Badge>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs uppercase tracking-[0.14em] text-slate-400">
        <span>{formatRunType(item.publication_mode)}</span>
        {formatPublicationState(item.publication_status) ? <span>{formatPublicationState(item.publication_status)}</span> : null}
        {item.publication_status === 'published_degraded' ? <span>Reconciliation pending</span> : null}
        {formatRepairState(item.repair_state) ? <span>{formatRepairState(item.repair_state)}</span> : null}
        {formatNextRepairStatus(item.next_repair_status) ? <span>{formatNextRepairStatus(item.next_repair_status)}</span> : null}
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-300">{checkpointSummary || toText(item.summary) || 'No summary available yet.'}</p>
      {item.current_section_label ? (
        <p className="mt-2 text-xs uppercase tracking-[0.14em] text-emerald-300">
          current section: {item.current_section_label}
        </p>
      ) : null}
      {item.current_question_text ? (
        <p className="mt-2 text-xs uppercase tracking-[0.14em] text-sky-300">
          current question: {questionProgress ? `${questionProgress} • ` : ''}{item.current_question_text}
        </p>
      ) : null}
      {item.current_execution_state ? (
        <p className="mt-2 text-xs uppercase tracking-[0.14em] text-cyan-300">
          execution: {item.current_execution_state}
        </p>
      ) : null}
      {item.current_strategy_label ? (
        <p className="mt-2 text-xs uppercase tracking-[0.14em] text-sky-300">
          strategy: {item.current_strategy_label}
        </p>
      ) : null}
      {item.current_source_order?.length ? (
        <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-400">
          source order: {formatCheckpointSourceOrder(item.current_source_order)}
        </p>
      ) : null}
      {questionProgress ? (
        <p className="mt-2 text-xs uppercase tracking-[0.14em] text-sky-300">
          question progress: {questionProgress}
        </p>
      ) : null}
      {item.next_repair_question_id ? (
        <p className="mt-2 text-xs uppercase tracking-[0.14em] text-sky-300">
          next repair root: {item.next_repair_question_id}
        </p>
      ) : null}
      {item.next_repair_batch_id ? (
        <p className="mt-2 text-xs uppercase tracking-[0.14em] text-cyan-300">
          next repair batch: {item.next_repair_batch_id}
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
      {item.next_repair_batch_id ? (
        <div className="mt-3">
          <Button asChild size="sm" variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10">
            <Link href={`/entity-import/${encodeURIComponent(item.next_repair_batch_id)}/${encodeURIComponent(item.entity_id)}`}>
              Open next repair batch
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function hasFollowOnRepair(item: QueueEntityRecord | null | undefined) {
  if (!item) return false
  return Boolean(
    item.next_repair_batch_id
    && (item.next_repair_status === 'planned' || item.next_repair_status === 'queued' || item.next_repair_status === 'running')
  )
}

function formatActiveRepairLabel(item: QueueEntityRecord | null | undefined) {
  if (!item) return null
  if (item.next_repair_status === 'running') return 'Next repair running'
  if (item.next_repair_status === 'queued') return 'Next repair queued'
  if (item.next_repair_status === 'planned') return 'Next repair planned'
  return null
}

function dedupeQueueItems(items: Array<QueueEntityRecord | null | undefined>) {
  const seen = new Set<string>()
  const deduped: QueueEntityRecord[] = []
  for (const item of items) {
    if (!item?.entity_id || seen.has(item.entity_id)) continue
    seen.add(item.entity_id)
    deduped.push(item)
  }
  return deduped
}

function mapOperationalQueueEntity(
  item: OperationalQueueEntity | null | undefined,
  state: QueueEntityRecord['state'],
): QueueEntityRecord | null {
  if (!item) return null
  return {
    entity_id: item.entity_id,
    entity_name: item.entity_name,
    entity_type: item.entity_type || 'Entity',
    state,
    client_ready: false,
    promoted: false,
    summary: buildCheckpointSummary(item) || item.summary || item.current_substep_label || item.current_action || null,
    generated_at: item.generated_at,
    active_question_id: item.active_question_id,
    current_section_id: item.current_section_id || null,
    current_section_label: item.current_section_label || null,
    current_section_index: item.current_section_index ?? null,
    current_section_total: item.current_section_total ?? null,
    current_question_id: item.current_question_id || null,
    current_question_text: item.current_question_text || null,
    current_question_index: item.current_question_index ?? null,
    current_question_total: item.current_question_total ?? null,
    current_strategy_label: item.current_strategy_label || null,
    current_execution_state: item.current_execution_state || null,
    current_source_order: item.current_source_order || null,
    current_substep_label: item.current_substep_label || null,
    current_substep_progress: item.current_substep_progress || null,
    current_action: item.current_execution_state || item.current_substep_label || item.current_action,
    publication_status: item.publication_status,
    repair_state: null,
    repair_retry_count: null,
    repair_retry_budget: null,
    next_repair_question_id: item.next_repair_question_id,
    next_repair_status: item.next_repair_status,
    next_repair_batch_id: item.next_repair_batch_id,
    next_repair_batch_status: item.next_repair_batch_status,
    reconciliation_state: null,
  }
}

function mapOperationalQueueEntities(
  items: Array<OperationalQueueEntity | null | undefined> | undefined,
  state: QueueEntityRecord['state'],
) {
  return (items || [])
    .map((item) => mapOperationalQueueEntity(item, state))
    .filter((item): item is QueueEntityRecord => Boolean(item))
}

function deriveLiveDashboardState(
  livePayload: OperationalDrilldownPayload | null,
  fallbackData: HomeQueueDashboardPayload | null,
) {
  const fallbackLoopStatus = fallbackData?.live_operational?.loop_status
  const fallbackQueue = fallbackData?.live_operational?.queue
  const loop_status = livePayload?.loop_status
    ? {
        universe_count: livePayload.loop_status.universe_count ?? fallbackLoopStatus?.universe_count ?? 0,
        total_scheduled: livePayload.loop_status.total_scheduled ?? fallbackLoopStatus?.total_scheduled ?? 0,
        completed: livePayload.loop_status.completed ?? fallbackLoopStatus?.completed ?? 0,
        processed_dossiers: livePayload.loop_status.processed_dossiers ?? fallbackLoopStatus?.processed_dossiers ?? livePayload.loop_status.completed ?? fallbackLoopStatus?.completed ?? 0,
        failed: livePayload.loop_status.failed ?? fallbackLoopStatus?.failed ?? 0,
        retryable_failures: livePayload.loop_status.retryable_failures ?? fallbackLoopStatus?.retryable_failures ?? 0,
        client_ready_dossiers: livePayload.loop_status.quality_counts?.client_ready ?? fallbackLoopStatus?.client_ready_dossiers ?? 0,
        promoted_dossiers: livePayload.loop_status.quality_counts?.client_ready ?? fallbackLoopStatus?.promoted_dossiers ?? 0,
        last_successful_canonical_run_at: fallbackLoopStatus?.last_successful_canonical_run_at ?? null,
        health: livePayload.freshness_state === 'stale' ? 'stale' : ((livePayload.operational_state === 'running' || livePayload.operational_state === 'retrying') ? 'active' : 'idle'),
        source: 'pipeline_runs' as const,
        last_activity_at: livePayload.last_activity_at ?? fallbackLoopStatus?.last_activity_at ?? null,
        quality_counts: {
          partial: livePayload.loop_status.quality_counts?.partial ?? fallbackLoopStatus?.quality_counts.partial ?? 0,
          blocked: livePayload.loop_status.quality_counts?.blocked ?? fallbackLoopStatus?.quality_counts.blocked ?? 0,
          complete: livePayload.loop_status.quality_counts?.complete ?? fallbackLoopStatus?.quality_counts.complete ?? 0,
          client_ready: livePayload.loop_status.quality_counts?.client_ready ?? fallbackLoopStatus?.quality_counts.client_ready ?? 0,
        },
        runtime_counts: {
          running: livePayload.loop_status.runtime_counts?.running ?? fallbackLoopStatus?.runtime_counts.running ?? 0,
          queued: livePayload.loop_status.runtime_counts?.queued ?? fallbackLoopStatus?.runtime_counts.queued ?? 0,
          stalled: livePayload.loop_status.runtime_counts?.stalled ?? fallbackLoopStatus?.runtime_counts.stalled ?? 0,
          retryable: livePayload.loop_status.runtime_counts?.retryable ?? fallbackLoopStatus?.runtime_counts.retryable ?? 0,
          resume_needed: livePayload.loop_status.runtime_counts?.resume_needed ?? fallbackLoopStatus?.runtime_counts.resume_needed ?? 0,
        },
      }
    : fallbackLoopStatus
  const queue = livePayload
    ? {
        completed_entities: mapOperationalQueueEntities(livePayload.queue?.completed_entities, 'completed'),
        in_progress_entity: mapOperationalQueueEntity(livePayload.queue?.in_progress_entity, 'in_progress'),
        running_entities: mapOperationalQueueEntities(livePayload.queue?.running_entities, 'in_progress'),
        stale_active_rows: mapOperationalQueueEntities(livePayload.queue?.stale_active_rows, 'resume_needed'),
        resume_needed_entities: mapOperationalQueueEntities(livePayload.queue?.resume_needed_entities, 'resume_needed'),
        upcoming_entities: mapOperationalQueueEntities(livePayload.queue?.upcoming_entities, 'upcoming'),
      }
    : fallbackQueue
  return {
    control: livePayload?.control ?? fallbackData?.live_operational?.control ?? fallbackData?.control,
    freshness_state: livePayload?.freshness_state ?? fallbackData?.live_operational?.freshness_state ?? 'fresh',
    operational_state: livePayload?.operational_state ?? livePayload?.live_state?.operational_state ?? fallbackData?.live_operational?.operational_state ?? 'waiting',
    loop_status,
    queue,
  }
}

// Legacy contract marker: In progress now
const INITIAL_VISIBLE_QUEUE_CARD_COUNT = 24
const QUEUE_CARD_PAGE_SIZE = 24

function mergeDashboardPayload(
  previous: HomeQueueDashboardPayload | null,
  next: HomeQueueDashboardPayload,
): HomeQueueDashboardPayload {
  if (!previous) return next

  return {
    ...next,
    rfp_cards: next.rfp_cards.length > 0 ? next.rfp_cards : previous.rfp_cards,
  }
}

export function HomeQueueDashboard() {
  const [data, setData] = useState<HomeQueueDashboardPayload | null>(null)
  const [livePayload, setLivePayload] = useState<OperationalDrilldownPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [queueingEntityId, setQueueingEntityId] = useState<string | null>(null)
  const [visibleUpcomingCount, setVisibleUpcomingCount] = useState(INITIAL_VISIBLE_QUEUE_CARD_COUNT)
  const didLoadRfpCardsRef = useRef(false)

  async function loadDashboardEnrichment() {
    const response = await fetch('/api/home/queue-dashboard', { cache: 'no-store' })
    const payload = await response.json()
    setData((current) => mergeDashboardPayload(current, payload))
  }

  async function queueEntity(entityId: string) {
    if (!entityId) return
    setQueueingEntityId(entityId)
    try {
      const response = await fetch(`/api/entities/${encodeURIComponent(entityId)}/dossier/rerun`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'full',
          rerun_reason: 'Queued from Home Dashboard',
          cascade_dependents: true,
        }),
      })
      if (!response.ok) {
        throw new Error(`Failed to queue entity (${response.status})`)
      }
      await Promise.all([
        loadDashboardEnrichment(),
        refreshOperationalDrilldownPayload(),
      ])
    } catch {
      // Keep the dashboard visible and leave the existing state intact.
    } finally {
      setQueueingEntityId(null)
    }
  }

  useEffect(() => {
    const cachedPayload = getCachedOperationalDrilldownPayload()
    if (cachedPayload) {
      setLivePayload(cachedPayload)
    }

    const unsubscribe = subscribeOperationalDrilldown((payload) => {
      setLivePayload(payload)
    })
    const stopPolling = startOperationalDrilldownPolling(10_000)

    async function load() {
      try {
        await Promise.all([
          loadDashboardEnrichment(),
          loadOperationalDrilldownPayload(),
        ])
      } finally {
        setLoading(false)
      }
    }
    void load()

    return () => {
      unsubscribe()
      stopPolling()
    }
  }, [])

  useEffect(() => {
    if (loading || !data || data.rfp_cards.length > 0 || didLoadRfpCardsRef.current) {
      return
    }

    didLoadRfpCardsRef.current = true

    async function loadRfpCards() {
      try {
        const response = await fetch(
          '/api/opportunities',
          { cache: 'no-store' },
        )
        if (!response.ok) return
        const payload = await response.json()
        const cards = Array.isArray(payload?.opportunities) ? payload.opportunities : []
        if (cards.length === 0) return
        setData((current) => current ? { ...current, rfp_cards: cards } : current)
      } catch {
        // Leave the dashboard rendered; promoted opportunities can stay empty on failure.
      }
    }

    void loadRfpCards()
  }, [data, loading])

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

  const { playlist_sort_key, client_ready_dossiers, rfp_cards, sales_summary, dossier_quality } = data
  const liveState = deriveLiveDashboardState(livePayload, data)
  const loop_status = liveState.loop_status
  const queue = liveState.queue

  if (!loop_status || !queue) {
    return (
      <Card className="mt-10 border-white/10 bg-white/[0.04]">
        <CardContent className="p-6 text-sm text-slate-300">
          Unable to load the live loop dashboard right now.
        </CardContent>
      </Card>
    )
  }

  const healthLabel = formatLoopHealth(loop_status.health)
  const controlRequestedState = liveState.control?.requested_state === 'paused' || liveState.control?.is_paused
    ? 'paused'
    : 'running'
  const controlObservedState = liveState.control?.observed_state || liveState.control?.transition_state || null
  const operationalState = liveState.operational_state === 'waiting' && controlRequestedState === 'paused'
    ? 'paused'
    : liveState.operational_state === 'stopped' && controlObservedState === 'starting'
      ? 'starting'
      : liveState.operational_state
  const currentCanonicalEntity = queue.in_progress_entity ?? queue.running_entities[0] ?? null
  const currentCanonicalEntityLabel = currentCanonicalEntity && typeof currentCanonicalEntity.queue_position === 'number'
    ? `${currentCanonicalEntity.queue_position}/${loop_status.universe_count ?? loop_status.total_scheduled ?? '…'}`
    : String(loop_status.universe_count ?? loop_status.total_scheduled ?? '…')
  const runningEntities = dedupeQueueItems([
    queue.in_progress_entity,
    ...queue.running_entities,
  ])
  const blockedPipelineCount = loop_status.quality_counts.partial + loop_status.quality_counts.blocked
  const activeFollowOnRepair = queue.in_progress_entity && hasFollowOnRepair(queue.in_progress_entity)
    ? queue.in_progress_entity
    : queue.resume_needed_entities.find((item) => hasFollowOnRepair(item))
      || queue.completed_entities.find((item) => hasFollowOnRepair(item))
      || null
  const visibleUpcomingEntities = queue.upcoming_entities.slice(0, visibleUpcomingCount)
  const hiddenUpcomingEntityCount = Math.max(queue.upcoming_entities.length - visibleUpcomingEntities.length, 0)

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
            {liveState.freshness_state === 'stale' ? (
              <p className="mt-2 text-xs leading-5 text-amber-300">
                Operational snapshot is stale. The pipeline may still be running; treat this as lagging state, not an idle confirmation.
              </p>
            ) : null}
            <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-400">
              State: {operationalState === 'starting'
                ? 'Starting'
                : operationalState === 'stopping'
                  ? 'Stopping'
                  : operationalState === 'paused'
                    ? 'Paused'
                    : operationalState === 'stopped'
                      ? 'Stopped'
                      : operationalState === 'waiting'
                        ? 'Waiting'
                        : 'Running'}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Queue order: {formatPlaylistSortKey(playlist_sort_key)}
            </p>
          </div>
          <div className="text-sm text-slate-400">
            Last successful canonical run: {formatDate(loop_status.last_successful_canonical_run_at)}
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Card className="border-white/10 bg-black/20"><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.16em] text-slate-400">Universe</p><p className="mt-3 text-3xl font-semibold text-white">{loop_status.universe_count}</p></CardContent></Card>
          <Card className="border-white/10 bg-black/20"><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.16em] text-slate-400">Running now</p><p className="mt-3 text-3xl font-semibold text-white">{loop_status.runtime_counts.running}</p></CardContent></Card>
          <Card className="border-white/10 bg-black/20"><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.16em] text-slate-400">Blocked / partial</p><p className="mt-3 text-3xl font-semibold text-amber-200">{blockedPipelineCount}</p></CardContent></Card>
          <Card className="border-white/10 bg-black/20">
            <CardContent className="p-5">
              <button
                type="button"
                className="w-full text-left transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-amber-300/70 focus:ring-offset-2 focus:ring-offset-black/20"
                onClick={openOperationalKanban}
                aria-label="Open pipeline kanban"
                title="Open pipeline kanban"
              >
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Canonical entity</p>
                <p className="mt-3 text-3xl font-semibold text-emerald-300">{currentCanonicalEntityLabel}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-500">
                  {currentCanonicalEntity?.entity_name ?? 'No active entity'}
                </p>
              </button>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-black/20"><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.16em] text-slate-400">Resume needed</p><p className="mt-3 text-3xl font-semibold text-sky-200">{loop_status.runtime_counts.resume_needed}</p></CardContent></Card>
        </div>

        {activeFollowOnRepair ? (
          <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="border border-cyan-400/30 bg-cyan-500/10 text-cyan-200">
                {formatActiveRepairLabel(activeFollowOnRepair) || 'Active follow-on repair'}
              </Badge>
              <span className="text-sm font-medium text-white">{activeFollowOnRepair.entity_name}</span>
              <span className="text-xs uppercase tracking-[0.14em] text-cyan-100/80">
                {activeFollowOnRepair.next_repair_question_id ? `Root ${activeFollowOnRepair.next_repair_question_id}` : 'Follow-on repair'}
              </span>
            </div>
            <p className="mt-2 text-sm text-cyan-50/90">
              The live repair chain has a concrete follow-on batch ready to inspect.
            </p>
            {activeFollowOnRepair.next_repair_batch_id ? (
              <div className="mt-3">
                <Button asChild size="sm" variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10">
                  <Link href={`/entity-import/${encodeURIComponent(activeFollowOnRepair.next_repair_batch_id)}/${encodeURIComponent(activeFollowOnRepair.entity_id)}`}>
                    Open next repair batch
                  </Link>
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-4">
        <Card className="border-white/10 bg-white/[0.04]">
          <CardHeader><CardTitle className="flex items-center gap-2 text-white"><Clock3 className="h-5 w-5 text-amber-300" />Running now</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {runningEntities.length > 0 ? runningEntities.map((item) => <QueueCard key={item.entity_id} item={item} />) : <p className="text-sm text-slate-300">Waiting for claimable work.</p>}
            </div>
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
            {visibleUpcomingEntities.length > 0 ? visibleUpcomingEntities.map((item) => <QueueCard key={item.entity_id} item={item} />) : <p className="text-sm text-slate-300">No upcoming entities queued.</p>}
            {hiddenUpcomingEntityCount > 0 ? (
              <Button
                type="button"
                variant="outline"
                className="w-full border-white/10 bg-white/5 text-white hover:bg-white/10"
                onClick={() => setVisibleUpcomingCount((current) => Math.min(current + QUEUE_CARD_PAGE_SIZE, queue.upcoming_entities.length))}
              >
                Show more queued entities ({hiddenUpcomingEntityCount} remaining)
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
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
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                    onClick={() => void queueEntity(item.browser_entity_id)}
                    disabled={queueingEntityId === item.browser_entity_id}
                  >
                    Queue this entity
                  </Button>
                </div>
              </div>
            )) : <p className="text-sm text-slate-300">No partial artifacts are currently visible in the canonical dossier store.</p>}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

export default HomeQueueDashboard
