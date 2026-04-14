'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, ListChecks, Loader2, PauseCircle, PlayCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  getCachedOperationalDrilldownPayload,
  loadOperationalDrilldownPayload,
  primeOperationalDrilldownPayload,
  refreshOperationalDrilldownPayload,
  type OperationalDrilldownPayload,
} from '@/lib/operational-drilldown-client'
import { buildOperationalStatusHero, formatRelativeTimestamp } from '@/lib/operational-status-hero'
import { resolvePipelineStartTarget, type OperationalStartSection } from '@/lib/operational-start-target'

interface OperationalStatusStripProps {
  drawerOpen: boolean
  activeSection: OperationalStartSection
  onToggleDrawer: () => void
}

type SnapshotKind = 'queue' | 'running' | 'blocked' | 'completed'

type SnapshotItem = Record<string, unknown> & {
  entity_id: string
  entity_name?: string | null
  entity_type?: string | null
  summary?: string | null
  generated_at?: string | null
  started_at?: string | null
  completed_at?: string | null
  active_question_id?: string | null
  current_question_id?: string | null
  next_repair_question_id?: string | null
  run_phase?: string | null
  current_stage?: string | null
  queue_position?: number | null
  publication_status?: string | null
  next_repair_status?: string | null
  next_repair_batch_id?: string | null
  quality_state?: string | null
  quality_summary?: string | null
  lifecycle_label?: string | null
  lifecycle_summary?: string | null
  movement_state?: string | null
  next_action?: string | null
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function getEntityHref(entityId: string) {
  return `/entity-browser/${encodeURIComponent(entityId)}/dossier?from=1`
}

function getEntityQuestionLabel(item: SnapshotItem, kind: SnapshotKind) {
  const questionId = toText(
    item.current_question_id
    || item.active_question_id
    || item.next_repair_question_id,
  )
  if (questionId) {
    return questionId.toLowerCase() === 'completed' ? 'completed' : questionId
  }
  return kind === 'completed' ? 'completed' : 'not started'
}

function normalizeSnapshotItem(item: SnapshotItem, kind: SnapshotKind) {
  const entityName = toText(item.entity_name) || 'Unknown entity'
  const entityType = toText(item.entity_type) || 'Entity'
  const summary = toText(
    item.summary
    || item.quality_summary
    || item.lifecycle_summary
    || item.next_action
    || (kind === 'queue' ? 'Waiting in the serialized live loop.' : '')
    || (kind === 'completed' ? 'Completed dossier.' : ''),
  ) || null
  const currentQuestion = getEntityQuestionLabel(item, kind)
  const runPhase = toText(item.run_phase || item.current_stage || item.lifecycle_label) || (kind === 'queue' ? 'queued' : 'n/a')
  const heartbeatSource = item.started_at || item.generated_at || item.completed_at || null
  const updatedSource = item.completed_at || item.generated_at || item.started_at || null

  const statusLabel = kind === 'queue'
    ? 'Waiting'
    : kind === 'running'
      ? (toText(item.next_repair_status).toLowerCase() === 'running' ? 'Repairing' : 'Running')
      : kind === 'blocked'
        ? (toText(item.quality_state).toLowerCase() === 'blocked' ? 'Blocked' : 'Stale')
        : toText(item.publication_status).toLowerCase() === 'published'
          ? 'Published healthy'
          : 'Published degraded'

  return {
    entityName,
    entityType,
    summary,
    statusLabel,
    currentQuestion,
    runPhase,
    heartbeatSource,
    updatedSource,
    queuePosition: typeof item.queue_position === 'number' ? item.queue_position : null,
    href: getEntityHref(item.entity_id),
    facts: [
      `Current question: ${currentQuestion}`,
      `Run phase: ${runPhase}`,
      `Heartbeat: ${heartbeatSource ? formatRelativeTimestamp(heartbeatSource, 'Heartbeat') : 'No active worker'}`,
      `Updated: ${updatedSource ? formatRelativeTimestamp(updatedSource, 'Updated') : 'Updated unavailable'}`,
    ],
  }
}

function SnapshotLane({
  title,
  icon,
  items,
  emptyLabel,
  kind,
}: {
  title: string
  icon: ReactNode
  items: SnapshotItem[]
  emptyLabel: string
  kind: SnapshotKind
}) {
  return (
    <div className="space-y-3 rounded-xl border border-custom-border bg-custom-bg/70 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-white">
        {icon}
        {title}
      </div>
      <div className="space-y-2">
        {items.length > 0 ? items.map((item, index) => {
          const normalized = normalizeSnapshotItem(item, kind)
          return (
            <div key={item.entity_id || `${title}-${index}`} className="rounded-lg border border-custom-border/80 bg-custom-box/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-white">{normalized.entityName}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">{normalized.entityType}</div>
                </div>
                <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-sky-500/30 text-sky-300">
                  {normalized.statusLabel}
                </div>
              </div>
              {normalized.summary ? (
                <div className="mt-2 text-sm text-fm-light-grey">{normalized.summary}</div>
              ) : null}
              <div className="mt-2 space-y-1 text-xs text-slate-300">
                {normalized.facts.map((fact) => (
                  <div key={fact}>{fact}</div>
                ))}
                {normalized.queuePosition !== null ? (
                  <div>Queue order: {normalized.queuePosition}</div>
                ) : null}
              </div>
              <div className="mt-3">
                <a className="text-sm text-sky-300 underline" href={normalized.href}>Open dossier</a>
              </div>
            </div>
          )
        }) : (
          <div className="rounded-lg border border-custom-border/80 bg-custom-box/60 p-3 text-sm text-fm-light-grey">
            {emptyLabel}
          </div>
        )}
      </div>
    </div>
  )
}

export function OperationalStatusStrip({
  drawerOpen: _drawerOpen,
  activeSection,
  onToggleDrawer: _onToggleDrawer,
}: OperationalStatusStripProps) {
  const [drilldown, setDrilldown] = useState<OperationalDrilldownPayload | null>(null)
  const [controlState, setControlState] = useState<OperationalDrilldownPayload['control'] | null>(null)
  const [isTogglingPipeline, setIsTogglingPipeline] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true)

  useEffect(() => {
    let cancelled = false
    void fetch('/api/home/pipeline-control', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null
        const payload = await response.json()
        return payload?.control ?? null
      })
      .then((control) => {
        if (!cancelled && control) {
          setControlState(control)
        }
      })
      .catch(() => {
        // keep the default state
      })

    primeOperationalDrilldownPayload()
    const cachedPayload = getCachedOperationalDrilldownPayload()
    if (cachedPayload && !cancelled) {
      setDrilldown(cachedPayload)
    }
    void loadOperationalDrilldownPayload()
      .then((payload) => {
        if (!cancelled) {
          setDrilldown(payload)
          setControlState(payload.control ?? null)
        }
      })
      .catch(() => {
        // leave summary fallback in place
      })

    return () => {
      cancelled = true
    }
  }, [])

  const inProgressEntity = drilldown?.queue?.in_progress_entity ?? null
  const runningEntities = (drilldown?.queue?.running_entities as SnapshotItem[] | undefined) ?? (inProgressEntity ? [inProgressEntity as SnapshotItem] : [])
  const completedEntities = (drilldown?.queue?.completed_entities as SnapshotItem[] | undefined) ?? []
  const blockedEntities = (drilldown?.dossier_quality?.incomplete_entities as SnapshotItem[] | undefined) ?? []
  const upcomingEntities = (drilldown?.queue?.upcoming_entities as SnapshotItem[] | undefined) ?? []
  const resumedEntities = (drilldown?.queue?.resume_needed_entities as SnapshotItem[] | undefined) ?? []

  const pipelinePaused = controlState?.is_paused === true
  const workerState = controlState?.transition_state
    || controlState?.observed_state
    || (pipelinePaused ? 'paused' : 'running')
  const repairFocus = Boolean(
    inProgressEntity && (
      toText(inProgressEntity.next_repair_status).toLowerCase() === 'running'
      || toText(inProgressEntity.next_repair_status).toLowerCase() === 'queued'
      || Boolean(inProgressEntity.next_repair_batch_id)
    ),
  )
  const startTarget = resolvePipelineStartTarget({
    activeSection,
    drilldown,
  })
  const startTargetEntity = startTarget
    ? [...runningEntities, ...completedEntities, ...resumedEntities, ...upcomingEntities, ...blockedEntities]
      .find((entity) => toText(entity.entity_id) === startTarget.entityId) || null
    : null
  const currentTargetLabel = startTarget
    ? `${toText(startTargetEntity?.entity_name) || startTarget.entityId} · ${startTarget.mode === 'full' ? 'full rerun' : 'question rerun'}`
    : null

  const statusHero = buildOperationalStatusHero({
    drilldown,
    controlState,
    currentTargetLabel,
  })

  const statusBadgeLabel = workerState === 'stopping'
    ? 'Stopping'
    : workerState === 'starting'
      ? 'Starting'
      : pipelinePaused
        ? 'Paused'
        : repairFocus
          ? 'Repairing'
          : inProgressEntity
            ? 'Running'
            : 'Waiting'
  const compactTicker = statusHero.headline

  const loopStatus = drilldown?.loop_status
  const statusItems = [
    {
      label: 'Universe',
      value: String(loopStatus?.total_scheduled ?? '…'),
      tone: 'text-white',
    },
    {
      label: 'Running now',
      value: String(loopStatus?.runtime_counts?.running ?? '…'),
      tone: 'text-sky-300',
    },
    {
      label: 'Blocked / partial',
      value: String((loopStatus?.quality_counts?.blocked ?? 0) + (loopStatus?.quality_counts?.partial ?? 0)),
      tone: 'text-amber-300',
    },
    {
      label: 'Recent completions',
      value: String(loopStatus?.completed ?? '…'),
      tone: 'text-emerald-300',
    },
  ] as const

  async function togglePipelinePaused() {
    setIsTogglingPipeline(true)
    try {
      if (pipelinePaused) {
        const response = await fetch('/api/home/pipeline-control', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'start',
            is_paused: false,
            pause_reason: null,
          }),
        })
        if (!response.ok) {
          throw new Error(`Failed to update pipeline control (${response.status})`)
        }
        if (startTarget) {
          const queuedResponse = await fetch(`/api/entities/${encodeURIComponent(startTarget.entityId)}/dossier/rerun`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              mode: startTarget.mode,
              question_id: startTarget.questionId,
              cascade_dependents: true,
              rerun_reason: 'Pipeline start from Live Ops',
            }),
          })
          if (!queuedResponse.ok) {
            throw new Error(`Failed to queue start target (${queuedResponse.status})`)
          }
        }
      } else {
        const response = await fetch('/api/home/pipeline-control', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'stop',
            is_paused: true,
            pause_reason: 'Paused from Live Ops',
          }),
        })
        if (!response.ok) {
          throw new Error(`Failed to update pipeline control (${response.status})`)
        }
      }

      const refreshedPayload = await refreshOperationalDrilldownPayload()
      setDrilldown(refreshedPayload)
      setControlState(refreshedPayload.control ?? null)
    } catch {
      setControlState((current) => current)
    } finally {
      setIsTogglingPipeline(false)
    }
  }

  return (
    <section
      className="overflow-hidden rounded-2xl border border-custom-border bg-custom-box shadow-sm transition-[max-height] duration-300 ease-out"
      style={{ maxHeight: isExpanded ? '40rem' : '7rem', padding: '0.7rem' }}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 xl:justify-items-start">
            {statusItems.map((item) => (
              <button
                key={item.label}
                type="button"
                className="min-w-[140px] rounded-lg border border-custom-border bg-custom-bg/70 px-2.5 py-2 text-left transition hover:border-white/30"
              >
                <div className="text-[0.55rem] uppercase tracking-[0.14em] text-slate-300">{item.label}</div>
                <div className={`mt-0.5 text-lg font-semibold leading-none ${item.tone}`}>{item.value}</div>
              </button>
            ))}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-2 xl:pl-3">
            <div className="flex items-center gap-1.5 overflow-hidden rounded-full border border-custom-border bg-custom-bg/70 px-2.5 py-2">
              <Badge variant="outline" className="shrink-0 border-sky-500/30 text-sky-300">
                {statusBadgeLabel}
              </Badge>
              <div className="min-w-0 overflow-hidden">
                <div className="animate-marquee flex min-w-max items-center whitespace-nowrap text-[0.72rem] font-medium uppercase tracking-[0.12em] text-fm-light-grey">
                  <div className="flex shrink-0 items-center gap-8 pr-6 sm:pr-8">
                    <span>{compactTicker}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-8 pr-6 sm:pr-8" aria-hidden="true">
                    <span>{compactTicker}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="text-[0.55rem] uppercase tracking-[0.16em] text-slate-400">Transport</span>
              <Button
                variant="outline"
                className="h-9 border-custom-border px-3 py-1.5"
                onClick={togglePipelinePaused}
                disabled={isTogglingPipeline}
                aria-label={statusHero.primaryActionTitle}
                title={statusHero.primaryActionTitle}
              >
                {statusHero.primaryActionLabel === 'Resume pipeline'
                  ? <PlayCircle className="mr-2 h-4 w-4" />
                  : <PauseCircle className="mr-2 h-4 w-4" />}
                {statusHero.primaryActionLabel}
              </Button>
              <Button
                variant="outline"
                className="h-9 border-custom-border px-3 py-1.5"
                onClick={() => setIsExpanded((current) => !current)}
                aria-expanded={isExpanded}
                aria-label={isExpanded ? 'Minimize live ops header' : 'Expand live ops header'}
                title={isExpanded ? 'Minimize' : 'Expand'}
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                <span className="sr-only">{isExpanded ? 'Minimize' : 'Expand'}</span>
              </Button>
            </div>
          </div>
        </div>

        {isExpanded ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-custom-border bg-black/20 px-3 py-3 text-[0.72rem] tracking-[0.12em] text-fm-light-grey">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-2">
                  <div className="text-sm font-semibold uppercase tracking-[0.14em] text-white">{statusHero.headline}</div>
                  <div className="text-sm text-slate-200">{statusHero.supportingLine}</div>
                  {statusHero.issueSummary ? (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-100">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                      <div className="space-y-0.5">
                        <div className="text-[0.65rem] uppercase tracking-[0.16em] text-amber-200">Issue detected</div>
                        <div className="text-sm">{statusHero.issueSummary}</div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="flex min-w-[16rem] flex-col items-end gap-2 text-right">
                  <Button
                    variant="outline"
                    className="h-10 border-sky-400/40 bg-sky-500/10 px-4 text-sm font-semibold text-white shadow-sm hover:border-sky-300 hover:bg-sky-500/20"
                    onClick={togglePipelinePaused}
                    disabled={isTogglingPipeline}
                    aria-label={statusHero.primaryActionTitle}
                    title={statusHero.primaryActionTitle}
                  >
                    {statusHero.primaryActionLabel === 'Resume pipeline'
                      ? <PlayCircle className="mr-2 h-4 w-4" />
                      : <PauseCircle className="mr-2 h-4 w-4" />}
                    {statusHero.primaryActionLabel}
                  </Button>
                  {statusHero.primaryActionRecommended ? (
                    <Badge variant="outline" className="border-emerald-400/30 text-emerald-200">Recommended</Badge>
                  ) : null}
                  <div className="max-w-sm text-[0.68rem] uppercase tracking-[0.12em] text-slate-300">
                    {statusHero.primaryActionHint}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-1 text-[0.68rem] tracking-[0.1em] text-slate-300 sm:grid-cols-2 xl:grid-cols-3">
                {statusHero.detailRows.map((row) => (
                  <div key={row.label}>
                    <span className="text-slate-400">{row.label}: </span>
                    <span className="text-slate-100">{row.value}</span>
                  </div>
                ))}
              </div>

              {statusHero.debugSummary || statusHero.debugCompactLine ? (
                <div className="mt-3 space-y-1 rounded-lg border border-custom-border/60 bg-custom-box/60 px-3 py-2 text-[0.68rem] uppercase tracking-[0.1em] text-slate-300">
                  <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-400">System details</div>
                  {statusHero.debugSummary ? <div className="mt-1">{statusHero.debugSummary}</div> : null}
                  {statusHero.debugCompactLine ? <div>{statusHero.debugCompactLine}</div> : null}
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-custom-border bg-black/20 px-3 py-3 text-[0.72rem] tracking-[0.12em] text-fm-light-grey">
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <ListChecks className="h-4 w-4 text-yellow-400" />
                Operational Snapshot
              </div>
              <div className="mt-1 text-sm text-slate-300">
                Queue order: priority_score DESC · entity_type ASC · entity_name ASC · entity_id ASC
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-4">
                <SnapshotLane
                  title="Queue"
                  icon={<AlertCircle className="h-4 w-4 text-sky-300" />}
                  items={upcomingEntities}
                  emptyLabel="Waiting for claimable work."
                  kind="queue"
                />
                <SnapshotLane
                  title="Running entities"
                  icon={<Loader2 className="h-4 w-4 text-sky-300" />}
                  items={runningEntities}
                  emptyLabel="Nothing is running right now."
                  kind="running"
                />
                <SnapshotLane
                  title="Stale / blocked"
                  icon={<AlertCircle className="h-4 w-4 text-amber-300" />}
                  items={[...blockedEntities, ...resumedEntities]}
                  emptyLabel="No stale or blocked entities right now."
                  kind="blocked"
                />
                <SnapshotLane
                  title="Completed"
                  icon={<CheckCircle2 className="h-4 w-4 text-emerald-300" />}
                  items={completedEntities}
                  emptyLabel="No completed entities yet."
                  kind="completed"
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
