'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, ListChecks, Loader2, Radar } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getEntityBrowserDossierHref } from '@/lib/entity-routing'
import {
  getCachedOperationalDrilldownPayload,
  loadOperationalDrilldownPayload,
  refreshOperationalDrilldownPayload,
  type OperationalDrilldownPayload,
} from '@/lib/operational-drilldown-client'

interface OperationalDrawerProps {
  open: boolean
  activeSection: 'running' | 'blocked' | 'completed' | 'entities'
  onSelectSection: (section: 'running' | 'blocked' | 'completed' | 'entities') => void
}

type QueueEntityRecord = {
  entity_id: string
  entity_name: string
  entity_type: string
  summary: string | null
  generated_at: string | null
  active_question_id?: string | null
  run_phase?: string | null
  queue_position?: number | null
  publication_status?: string | null
  next_repair_question_id?: string | null
  next_repair_status?: string | null
  next_repair_batch_id?: string | null
  current_question_id?: string | null
  next_action?: string | null
  lifecycle_stage?: string | null
  lifecycle_label?: string | null
  lifecycle_summary?: string | null
  movement_state?: string | null
}

type DashboardPayload = OperationalDrilldownPayload & {
  queue: {
    in_progress_entity: QueueEntityRecord | null
    completed_entities: QueueEntityRecord[]
    resume_needed_entities: QueueEntityRecord[]
    upcoming_entities: QueueEntityRecord[]
  }
  dossier_quality: {
    incomplete_entities: Array<{
      entity_id: string
      browser_entity_id: string
      entity_name: string
      entity_type: string
      quality_state: string
      quality_summary: string | null
      generated_at: string | null
    }>
  }
}

const fallbackDashboard: DashboardPayload = {
  control: {
    is_paused: false,
    pause_reason: null,
    updated_at: null,
  },
  loop_status: {
    total_scheduled: 0,
    completed: 0,
    failed: 0,
    retryable_failures: 0,
    quality_counts: {
      partial: 0,
      blocked: 0,
      complete: 0,
      client_ready: 0,
    },
    runtime_counts: {
      running: 0,
      stalled: 0,
      retryable: 0,
      resume_needed: 0,
    },
  },
  queue: {
    in_progress_entity: null,
    running_entities: [],
    completed_entities: [],
    resume_needed_entities: [],
    upcoming_entities: [],
  },
  dossier_quality: {
    incomplete_entities: [],
  },
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function toText(value: unknown) {
  if (value === null || value === undefined) return ''
  return String(value)
}

function formatPublicationState(value: string | null | undefined) {
  if (value === 'published_degraded') return 'Published degraded'
  if (value === 'published') return 'Published healthy'
  return 'Pending publication'
}

function formatMovementState(value: string | null | undefined) {
  if (value === 'moving') return 'Moving'
  if (value === 'queued') return 'Queued'
  if (value === 'review') return 'Review needed'
  return 'Blocked'
}

function formatNextRepair(value: string | null | undefined) {
  if (value === 'running') return 'Next repair running'
  if (value === 'queued') return 'Next repair queued'
  if (value === 'planned') return 'Next repair planned'
  return null
}

function EntityListCard({
  title,
  icon,
  items,
  emptyLabel,
}: {
  title: string
  icon: React.ReactNode
  items: Array<{
    key: string
    title: string
    subtitle: string
    detail: string
    href?: string | null
    badge?: string | null
    meta?: string | null
    facts?: string[]
  }>
  emptyLabel: string
}) {
  return (
    <div className="space-y-3 rounded-xl border border-custom-border bg-custom-bg/70 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-white">
        {icon}
        {title}
      </div>
      <div className="space-y-2">
        {items.length > 0 ? items.map((item) => (
          <div key={item.key} className="rounded-lg border border-custom-border/80 bg-custom-box/60 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium text-white">{item.title}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">{item.subtitle}</div>
              </div>
              {item.badge ? (
                <Badge variant="outline" className="border-sky-500/30 text-sky-300">
                  {item.badge}
                </Badge>
              ) : null}
            </div>
            <div className="mt-2 text-sm text-fm-light-grey">{item.detail}</div>
            {item.facts && item.facts.length > 0 ? (
              <div className="mt-2 space-y-1 text-xs text-slate-300">
                {item.facts.map((fact) => (
                  <div key={fact}>{fact}</div>
                ))}
              </div>
            ) : null}
            {item.meta ? <div className="mt-2 text-xs text-slate-400">{item.meta}</div> : null}
            {item.href ? (
              <div className="mt-3">
                <Link href={item.href} className="text-sm text-sky-300 underline">
                  Open dossier
                </Link>
              </div>
            ) : null}
          </div>
        )) : (
          <div className="rounded-lg border border-custom-border/80 bg-custom-box/60 p-3 text-sm text-fm-light-grey">
            {emptyLabel}
          </div>
        )}
      </div>
    </div>
  )
}

function FocusCard({
  title,
  subtitle,
  detail,
  nextAction,
  currentQuestion,
  currentStage,
  href,
  activeBatchHref,
  facts,
  badge,
  lifecycleLabel,
  movementState,
}: {
  title: string
  subtitle: string
  detail: string
  nextAction: string
  currentQuestion: string
  currentStage: string
  href: string | null
  activeBatchHref?: string | null
  facts: string[]
  badge: string | null
  lifecycleLabel: string | null
  movementState: string | null
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Current entity</div>
          <div className="mt-1 text-lg font-semibold text-white">{title}</div>
          <div className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">{subtitle}</div>
        </div>
        {badge ? (
          <Badge variant="outline" className="border-sky-500/30 text-sky-300">
            {badge}
          </Badge>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {lifecycleLabel ? (
          <Badge variant="outline" className="border-emerald-500/30 text-emerald-300">
            {lifecycleLabel}
          </Badge>
        ) : null}
        {movementState ? (
          <Badge variant="outline" className="border-amber-500/30 text-amber-300">
            {formatMovementState(movementState)}
          </Badge>
        ) : null}
      </div>
      <div className="mt-3 text-sm text-fm-light-grey">{detail}</div>
      <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
        <div>
          <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Current question</div>
          <div className="mt-1 text-white">{currentQuestion || facts[0] || 'Not available'}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Current stage</div>
          <div className="mt-1 text-white">{currentStage || 'Not available'}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Next action</div>
          <div className="mt-1 text-white">{nextAction}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Active batch</div>
          <div className="mt-1 text-white">{activeBatchHref ? 'Open next repair batch' : 'Not available'}</div>
        </div>
      </div>
      {facts.length > 1 ? (
        <div className="mt-3 space-y-1 text-xs text-slate-400">
          {facts.slice(1).map((fact) => (
            <div key={fact}>{fact}</div>
          ))}
        </div>
      ) : null}
      {activeBatchHref ? (
        <div className="mt-4">
          <Link href={activeBatchHref} className="text-sm text-sky-300 underline">
            Open next repair batch
          </Link>
        </div>
      ) : null}
      {href ? (
        <div className="mt-4">
          <Link href={href} className="text-sm text-sky-300 underline">
            Open dossier
          </Link>
        </div>
      ) : null}
    </div>
  )
}

export function OperationalDrawer({ open, activeSection, onSelectSection }: OperationalDrawerProps) {
  const [dashboard, setDashboard] = useState<DashboardPayload>(fallbackDashboard)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isQueueingBatch, setIsQueueingBatch] = useState(false)

  useEffect(() => {
    if (!open) return

    let cancelled = false

    async function loadData() {
      if (!cancelled) {
        setIsLoading(true)
        setLoadError(null)
        const cachedPayload = getCachedOperationalDrilldownPayload()
        if (cachedPayload) {
          setDashboard(cachedPayload as DashboardPayload)
        }
      }
      try {
        const dashboardPayload = await loadOperationalDrilldownPayload()
        if (!cancelled) {
          setDashboard(dashboardPayload as DashboardPayload)
          setIsLoading(false)
        }
      } catch {
        if (!cancelled) {
          setDashboard((current) => current)
          setLoadError('Live run details are taking too long to load.')
          setIsLoading(false)
        }
      }
    }

    loadData()

    return () => {
      cancelled = true
    }
  }, [open])

  const runningItems = useMemo(() => {
    const running = Array.isArray(dashboard.queue.running_entities) ? dashboard.queue.running_entities : []
    const resumeNeeded = dashboard.queue.resume_needed_entities
      const items = running.map((inProgress) => ({
      key: `running-${inProgress.entity_id}-${inProgress.queue_position ?? 'now'}`,
      title: inProgress.entity_name,
      subtitle: inProgress.entity_type,
      detail: toText(inProgress.summary) || 'Pipeline execution is active.',
      href: getEntityBrowserDossierHref(inProgress.entity_id, '1') || `/entity-browser/${encodeURIComponent(inProgress.entity_id)}/dossier?from=1`,
      badge: formatNextRepair(inProgress.next_repair_status) || formatPublicationState(inProgress.publication_status),
      current_question_id: toText(inProgress.active_question_id) || null,
      current_stage: toText(inProgress.run_phase) || null,
      next_action: inProgress.next_repair_question_id
        ? `Repair question ${inProgress.next_repair_question_id}`
        : 'Continue the active question',
      lifecycle_label: toText(inProgress.lifecycle_label) || null,
      lifecycle_summary: toText(inProgress.lifecycle_summary) || null,
      movement_state: toText(inProgress.movement_state) || null,
      facts: [
        `Current question: ${toText(inProgress.active_question_id) || 'n/a'}`,
        `Run phase: ${toText(inProgress.run_phase) || 'n/a'}`,
        `Queue order: ${typeof inProgress.queue_position === 'number' ? inProgress.queue_position : 'now'}`,
      ],
      meta: inProgress.next_repair_batch_id ? `next repair batch: ${inProgress.next_repair_batch_id}` : null,
      next_repair_batch_href: inProgress.next_repair_batch_id
        ? `/entity-import/${encodeURIComponent(inProgress.next_repair_batch_id)}/${encodeURIComponent(inProgress.entity_id)}`
        : null,
    }))
    for (const item of resumeNeeded) {
      items.push({
        key: `resume-${item.entity_id}`,
        title: item.entity_name,
        subtitle: item.entity_type,
        detail: toText(item.summary) || 'Resume is required.',
        href: getEntityBrowserDossierHref(item.entity_id, '1') || `/entity-browser/${encodeURIComponent(item.entity_id)}/dossier?from=1`,
        badge: 'Resume needed',
        current_question_id: toText(item.active_question_id) || null,
        next_action: item.next_repair_question_id
          ? `Repair question ${item.next_repair_question_id}`
          : 'Resume the pipeline',
        current_stage: toText(item.run_phase) || null,
        lifecycle_label: toText(item.lifecycle_label) || null,
        lifecycle_summary: toText(item.lifecycle_summary) || null,
        movement_state: toText(item.movement_state) || null,
        facts: [
          `Current question: ${toText(item.active_question_id) || 'n/a'}`,
          `Run phase: ${toText(item.run_phase) || 'resume_needed'}`,
          'Queue order: blocked until resumed',
        ],
        meta: item.next_repair_question_id ? `next repair root: ${item.next_repair_question_id}` : null,
        next_repair_batch_href: item.next_repair_batch_id
          ? `/entity-import/${encodeURIComponent(item.next_repair_batch_id)}/${encodeURIComponent(item.entity_id)}`
          : null,
      })
    }
    return items
  }, [dashboard])

  const blockedItems = useMemo(() => {
    return dashboard.dossier_quality.incomplete_entities
      .filter((item) => item.quality_state === 'blocked')
      .slice(0, 8)
      .map((item) => ({
        key: `blocked-${item.entity_id}`,
        title: item.entity_name,
        subtitle: item.entity_type,
      detail: toText(item.quality_summary) || 'Blocked dossier.',
      href: getEntityBrowserDossierHref(item.browser_entity_id, '1') || `/entity-browser/${encodeURIComponent(item.browser_entity_id)}/dossier?from=1`,
      badge: 'Blocked',
      current_question_id: toText(item.current_question_id) || null,
        next_action: toText(item.next_action) || 'Rerun dossier',
        current_stage: toText(item.lifecycle_label) || null,
        lifecycle_label: toText(item.lifecycle_label) || null,
        lifecycle_summary: toText(item.lifecycle_summary) || null,
        movement_state: toText(item.movement_state) || null,
        meta: item.generated_at ? `updated ${formatDate(item.generated_at)}` : null,
        next_repair_batch_href: item.next_repair_batch_id
          ? `/entity-import/${encodeURIComponent(item.next_repair_batch_id)}/${encodeURIComponent(item.entity_id)}`
          : null,
      }))
  }, [dashboard])

  const completedItems = useMemo(() => {
    return dashboard.queue.completed_entities.slice(0, 8).map((item) => ({
      key: `completed-${item.entity_id}`,
      title: item.entity_name,
      subtitle: item.entity_type,
      detail: toText(item.summary) || 'Completed recently.',
      href: getEntityBrowserDossierHref(item.entity_id, '1') || `/entity-browser/${encodeURIComponent(item.entity_id)}/dossier?from=1`,
      badge: formatPublicationState(item.publication_status),
      current_question_id: toText(item.active_question_id) || null,
      next_action: 'Review the completed dossier',
      lifecycle_label: toText(item.lifecycle_label) || null,
      lifecycle_summary: toText(item.lifecycle_summary) || null,
      movement_state: toText(item.movement_state) || null,
      facts: [
        `Current question: ${toText(item.active_question_id) || 'completed'}`,
        `Run phase: ${toText(item.run_phase) || 'completed'}`,
      ],
      meta: item.generated_at ? `updated ${formatDate(item.generated_at)}` : null,
    }))
  }, [dashboard])

  const entityItems = useMemo(() => {
    return dashboard.queue.upcoming_entities.slice(0, 8).map((item) => ({
      key: `entity-${item.entity_id}`,
      title: item.entity_name,
      subtitle: item.entity_type,
      detail: toText(item.summary) || 'Waiting in the serialized live loop.',
      href: getEntityBrowserDossierHref(item.entity_id, '1') || `/entity-browser/${encodeURIComponent(item.entity_id)}/dossier?from=1`,
      badge: 'Upcoming',
      current_question_id: toText(item.active_question_id) || null,
        next_action: 'Open the dossier when this entity is claimed',
        current_stage: toText(item.run_phase) || null,
        lifecycle_label: toText(item.lifecycle_label) || null,
        lifecycle_summary: toText(item.lifecycle_summary) || null,
        movement_state: toText(item.movement_state) || null,
        facts: [
          `Current question: ${toText(item.active_question_id) || 'not started'}`,
        `Run phase: ${toText(item.run_phase) || 'queued'}`,
        `Queue order: ${typeof item.queue_position === 'number' ? item.queue_position : 'n/a'}`,
      ],
        meta: null,
        next_repair_batch_href: item.next_repair_batch_id
          ? `/entity-import/${encodeURIComponent(item.next_repair_batch_id)}/${encodeURIComponent(item.entity_id)}`
          : null,
      }))
  }, [dashboard])

  if (!open) {
    return null
  }

  const focusEntity =
    activeSection === 'running'
      ? (runningItems[0] ?? null)
      : activeSection === 'blocked'
        ? (blockedItems[0] ?? null)
        : activeSection === 'completed'
          ? (completedItems[0] ?? null)
          : (entityItems[0] ?? null)
  const nextUpcomingEntity = dashboard.queue.upcoming_entities?.[0] ?? null
  const hasActiveEntity = Boolean(dashboard.queue?.in_progress_entity)
  const intakeStatusLabel = dashboard.control?.is_paused
    ? 'Pipeline intake paused'
    : hasActiveEntity
      ? 'Pipeline intake running'
      : 'Pipeline intake running - waiting for claimable work'

  async function queueNextBatch() {
    if (!nextUpcomingEntity?.entity_id) return
    setIsQueueingBatch(true)
    try {
      const response = await fetch(`/api/entities/${encodeURIComponent(nextUpcomingEntity.entity_id)}/dossier/rerun`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'full',
          rerun_reason: 'Queued from Operational Snapshot',
          cascade_dependents: true,
        }),
      })
      if (!response.ok) {
        throw new Error(`Failed to queue next batch (${response.status})`)
      }
      const payload = await refreshOperationalDrilldownPayload()
      setDashboard(payload as DashboardPayload)
    } catch {
      // leave the current drilldown visible if the queue request fails
    } finally {
      setIsQueueingBatch(false)
    }
  }

  return (
    <Card className="border-custom-border bg-custom-box shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="h-4 w-4 text-yellow-400" />
          Operational Snapshot
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'running', label: 'Running' },
            { key: 'blocked', label: 'Blocked' },
            { key: 'completed', label: 'Completed' },
            { key: 'entities', label: 'Entities' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => onSelectSection(tab.key as 'running' | 'blocked' | 'completed' | 'entities')}
              className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.14em] ${
                activeSection === tab.key ? 'border-white/40 text-white' : 'border-custom-border text-slate-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {isLoading ? (
          <div className="text-sm text-slate-400">Loading live run details…</div>
        ) : null}
        {loadError ? (
          <div className="text-sm text-amber-300">{loadError}</div>
        ) : null}
        <div className="text-sm text-slate-300">
          {intakeStatusLabel}
          {dashboard.control?.pause_reason ? ` · ${dashboard.control.pause_reason}` : ''}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-custom-border"
            onClick={queueNextBatch}
            disabled={isQueueingBatch || !nextUpcomingEntity?.entity_id}
          >
            Queue next batch
          </Button>
          {nextUpcomingEntity?.entity_id ? (
            <span className="text-xs text-slate-400">
              Next up: {nextUpcomingEntity.entity_name}
            </span>
          ) : (
            <span className="text-xs text-slate-400">No queued entity available to trigger.</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="max-h-[calc(100vh-14rem)] space-y-4 overflow-y-auto pr-2">
        {focusEntity ? (
          <FocusCard
            title={focusEntity.title}
            subtitle={focusEntity.subtitle}
            detail={focusEntity.detail}
            nextAction={focusEntity.next_action || 'Not available'}
            currentQuestion={focusEntity.current_question_id || ''}
            currentStage={focusEntity.current_stage || ''}
            href={focusEntity.href ?? null}
            activeBatchHref={focusEntity.next_repair_batch_href ?? null}
            facts={focusEntity.facts || []}
            badge={focusEntity.badge ?? null}
            lifecycleLabel={focusEntity.lifecycle_label ?? null}
            movementState={focusEntity.movement_state ?? null}
          />
        ) : null}
        <div className="grid gap-4 lg:grid-cols-4">
        <EntityListCard
          title="Running entities"
          icon={<Loader2 className="h-4 w-4 text-sky-300" />}
          items={activeSection === 'running' ? runningItems : []}
          emptyLabel="Waiting for claimable work."
        />
        <EntityListCard
          title="Blocked dossiers"
          icon={<AlertCircle className="h-4 w-4 text-amber-300" />}
          items={activeSection === 'blocked' ? blockedItems : []}
          emptyLabel="No blocked dossiers right now."
        />
        <EntityListCard
          title="Recent completions"
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-300" />}
          items={activeSection === 'completed' ? completedItems : []}
          emptyLabel="No completed entities yet."
        />
        <EntityListCard
          title="Active universe"
          icon={<Radar className="h-4 w-4 text-slate-300" />}
          items={activeSection === 'entities' ? entityItems : []}
          emptyLabel="No queued entities are visible right now."
        />
        </div>
      </CardContent>
    </Card>
  )
}
