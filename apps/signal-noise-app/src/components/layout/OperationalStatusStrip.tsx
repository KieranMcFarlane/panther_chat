'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, ListChecks, Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  getCachedOperationalDrilldownPayload,
  refreshOperationalDrilldownPayload,
  startOperationalDrilldownPolling,
  subscribeOperationalDrilldown,
  type OperationalDrilldownPayload,
} from '@/lib/operational-drilldown-client'
import { formatCheckpointQuestionProgress, formatCheckpointSourceOrder } from '@/lib/operational-checkpoint'
import { buildOperationalStatusHero, formatRelativeTimestamp } from '@/lib/operational-status-hero'
import { resolvePipelineStartTarget, type OperationalStartSection } from '@/lib/operational-start-target'
import {
  getOperationalStopDetails,
  isFailedTerminalRuntimeCheckpoint,
} from '@/lib/operational-safety-stop'

interface OperationalStatusStripProps {
  drawerOpen: boolean
  activeSection: OperationalStartSection
  onToggleDrawer: () => void
}

const OPERATIONAL_STATUS_POLL_INTERVAL_MS = 5_000

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
  current_question_text?: string | null
  current_section_label?: string | null
  current_section_index?: number | null
  current_section_total?: number | null
  current_question_index?: number | null
  current_question_total?: number | null
  current_strategy_label?: string | null
  current_execution_state?: string | null
  current_source_order?: string[] | null
  current_substep?: string | null
  current_substep_label?: string | null
  current_substep_progress?: string | null
  next_repair_question_id?: string | null
  next_repair_question_text?: string | null
  last_completed_question_text?: string | null
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
  const questionText = toText(
    item.current_question_text
    || item.next_repair_question_text
    || item.last_completed_question_text,
  )
  if (questionText) {
    return questionText
  }

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

function dedupeSnapshotLaneItems(items: SnapshotItem[]) {
  const dedupedItems = new Map<string, SnapshotItem>()
  for (const item of items) {
    const entityId = toText(item.entity_id)
    if (!entityId) continue
    const existing = dedupedItems.get(entityId)
    dedupedItems.set(entityId, existing ? { ...existing, ...item } : item)
  }
  return Array.from(dedupedItems.values())
}

function buildRuntimeLabelValuePairs(input: {
  isSafetyStop: boolean
  runtimeCheckpointFailed: boolean
  currentRun: OperationalDrilldownPayload['runtime']['current_run'] | null
  runtime: OperationalDrilldownPayload['runtime'] | null
  liveOperationalState: string | undefined
  fastmcpHealth: string
  freshnessState: string
  lastActivityAt: string | null
  stopReason: string | null
  stopDetails: Record<string, unknown> | null
}) {
  if (input.isSafetyStop && input.runtimeCheckpointFailed) {
    const errorType = toText(input.stopDetails?.error_type || input.currentRun?.error_type).replaceAll('_', ' ')
    const errorMessage = toText(input.stopDetails?.error_message || input.currentRun?.error_message)
    const attempts = toText(input.stopDetails?.attempts)
    const rows = [
      ['Worker process', toText(input.runtime?.worker?.worker_process_state) || 'unknown'],
      ['Fast MCP', input.fastmcpHealth],
      ['Live state', toText(input.liveOperationalState) || 'unknown'],
      ['Current entity', toText(input.stopDetails?.entity_name || input.currentRun?.entity_name) || 'n/a'],
      ['Current question', toText(input.currentRun?.current_question_text) || toText(input.currentRun?.current_question_id) || 'unavailable'],
      ['Question ID', toText(input.stopDetails?.question_id || input.currentRun?.current_question_id) || 'unavailable'],
      ['Current action', toText(input.currentRun?.current_action || input.currentRun?.current_stage || input.currentRun?.phase) || 'unavailable'],
      ['Stop reason', input.stopReason || 'unavailable'],
      ['Error type', errorType || 'unavailable'],
      ['Error message', errorMessage || 'unavailable'],
      ['Attempts', attempts || 'unavailable'],
      ['Last heartbeat', input.currentRun?.heartbeat_at ? formatRelativeTimestamp(input.currentRun.heartbeat_at, 'Heartbeat') : 'Heartbeat unavailable'],
      ['Freshness', input.freshnessState],
      ['Last activity', input.lastActivityAt ? formatRelativeTimestamp(input.lastActivityAt, 'Activity') : 'Unavailable'],
    ] as Array<[string, string]>
    return rows
  }

  return [
    ['Worker process', toText(input.runtime?.worker?.worker_process_state) || 'unknown'],
    ['Worker pid', String(input.runtime?.worker?.worker_pid ?? 'n/a')],
    ['Fast MCP', input.fastmcpHealth],
    ['Live state', toText(input.liveOperationalState) || 'unknown'],
    ['Current entity', toText(input.currentRun?.entity_name) || toText(input.currentRun?.entity_id) || 'n/a'],
    ['Current section', toText(input.currentRun?.current_section_label) || 'unavailable'],
    ['Question progress', formatCheckpointQuestionProgress(input.currentRun) || 'unavailable'],
    ['Execution state', toText(input.currentRun?.current_execution_state) || 'unavailable'],
    ['Execution backend', toText(input.currentRun?.execution_backend) || 'unavailable'],
    ['Model', toText(input.currentRun?.execution_model) || 'unavailable'],
    ['BrightData transport', toText(input.currentRun?.brightdata_transport) || 'unavailable'],
    ['Strategy', toText(input.currentRun?.current_strategy_label) || 'unavailable'],
    ['Source order', formatCheckpointSourceOrder(input.currentRun?.current_source_order)],
    ['Current sub-step', toText(input.currentRun?.current_substep_label) || toText(input.currentRun?.current_substep) || 'unavailable'],
    ['Sub-step progress', toText(input.currentRun?.current_substep_progress) || 'unavailable'],
    ['Current question', toText(input.currentRun?.current_question_text) || toText(input.currentRun?.current_question_id) || 'unavailable'],
    ['Question ID', toText(input.currentRun?.current_question_id) || 'unavailable'],
    ['Current action', toText(input.currentRun?.current_action) || toText(input.currentRun?.phase) || 'unavailable'],
  ] as Array<[string, string]>
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
            <div key={`${title}-${item.entity_id || index}`} className="rounded-lg border border-custom-border/80 bg-custom-box/60 p-3">
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
  const [isExpanded, setIsExpanded] = useState(false)
  const [completedVisibleCount, setCompletedVisibleCount] = useState(8)

  useEffect(() => {
    const cachedPayload = getCachedOperationalDrilldownPayload()
    if (cachedPayload) {
      setDrilldown(cachedPayload)
      setControlState(cachedPayload.control ?? null)
    }
    const unsubscribe = subscribeOperationalDrilldown((payload) => {
      setDrilldown(payload)
      setControlState(payload?.control ?? null)
    })
    const stopPolling = startOperationalDrilldownPolling(OPERATIONAL_STATUS_POLL_INTERVAL_MS)
    void refreshOperationalDrilldownPayload().then((payload) => {
      setDrilldown(payload)
      setControlState(payload?.control ?? null)
    }).catch(() => {
      // Leave the last known state in place on load failure.
    })
    return () => {
      unsubscribe()
      stopPolling()
    }
  }, [])

  const liveState = drilldown?.live_state ?? null
  const backlogHealth = drilldown?.backlog_health ?? null
  const inProgressEntity = (liveState?.in_progress_entity as SnapshotItem | undefined) ?? drilldown?.queue?.in_progress_entity ?? null
  const runningEntities = (liveState?.running_entities as SnapshotItem[] | undefined)
    ?? (drilldown?.queue?.running_entities as SnapshotItem[] | undefined)
    ?? (inProgressEntity ? [inProgressEntity as SnapshotItem] : [])
  const staleActiveRows = (drilldown?.queue?.stale_active_rows as SnapshotItem[] | undefined) ?? []
  const completedEntities = (drilldown?.queue?.processed_entities as SnapshotItem[] | undefined)
    ?? (drilldown?.queue?.completed_entities as SnapshotItem[] | undefined)
    ?? []
  const blockedEntities = (drilldown?.dossier_quality?.incomplete_entities as SnapshotItem[] | undefined) ?? []
  const upcomingEntities = (drilldown?.queue?.upcoming_entities as SnapshotItem[] | undefined) ?? []
  const resumedEntities = (drilldown?.queue?.resume_needed_entities as SnapshotItem[] | undefined) ?? []
  const runtime = drilldown?.runtime ?? null
  const workerState = runtime?.worker?.worker_process_state
    || liveState?.worker_process_state
    || controlState?.transition_state
    || controlState?.observed_state
    || (controlState?.is_paused ? 'paused' : 'running')
  const fastmcpHealth = runtime?.fastmcp?.reachable === false
    ? 'unreachable'
    : runtime?.fastmcp?.reachable === true
      ? 'reachable'
      : 'unknown'
  const currentRun = liveState?.current_live_run ?? runtime?.current_live_run ?? null
  const { isSafetyStop, stopReason, stopDetails } = getOperationalStopDetails(
    drilldown,
    controlState,
  )
  const runtimeCheckpointFailed = isFailedTerminalRuntimeCheckpoint(currentRun)
  const failureBuckets = runtime?.failure_buckets ?? {}
  const snapshotAt = drilldown?.snapshot_at ?? runtime?.snapshot_at ?? runtime?.generated_at ?? null
  const lastActivityAt = drilldown?.last_activity_at ?? snapshotAt
  const freshnessState = drilldown?.freshness_state ?? 'fresh'
  const loopStatus = drilldown?.loop_status

  const pipelinePaused = controlState?.requested_state === 'paused' || controlState?.is_paused === true
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
  const totalUniverseCountValue = Number(loopStatus?.universe_count ?? loopStatus?.total_scheduled ?? NaN)
  const totalUniverseCount = Number.isFinite(totalUniverseCountValue) ? totalUniverseCountValue : null
  const processedUniverseCountValue = Number(loopStatus?.processed_dossiers ?? loopStatus?.completed ?? completedEntities.length ?? NaN)
  const processedUniverseCount = Number.isFinite(processedUniverseCountValue) ? processedUniverseCountValue : null
  const universeFocusEntity = inProgressEntity
    || runningEntities[0]
    || staleActiveRows[0]
    || resumedEntities[0]
    || upcomingEntities[0]
    || blockedEntities[0]
    || completedEntities[0]
    || null
  const currentUniversePosition = typeof universeFocusEntity?.queue_position === 'number'
    ? universeFocusEntity.queue_position
    : null
  const currentUniverseProgressLabel = currentUniversePosition !== null && totalUniverseCount !== null
    ? `${currentUniversePosition}/${totalUniverseCount}`
    : currentUniversePosition !== null
      ? String(currentUniversePosition)
      : String(totalUniverseCount ?? '…')
  const universeTileTitle = currentUniversePosition !== null
    ? `${universeFocusEntity?.entity_name ? `${universeFocusEntity.entity_name} · ` : ''}canonical entity ${currentUniverseProgressLabel}${totalUniverseCount !== null ? ` of ${totalUniverseCount}` : ''}`
    : String(totalUniverseCount ?? '…')

  const statusHero = buildOperationalStatusHero({
    drilldown,
    controlState,
    currentTargetLabel,
  })
  const compactTicker = statusHero.marqueeLine || statusHero.headline
  const marqueeSegments = [
    compactTicker,
    `Fast MCP ${fastmcpHealth}`,
    `Worker ${workerState}`,
    currentUniversePosition !== null ? `Canonical entity ${currentUniverseProgressLabel}` : null,
  ].filter(Boolean) as string[]

  const liveOperationalState = liveState?.operational_state ?? drilldown?.operational_state
  const statusBadgeLabel = workerState === 'stopping'
    ? 'Stopping'
    : workerState === 'starting'
      ? 'Starting'
      : liveOperationalState === 'retrying'
        ? 'Retrying'
        : liveOperationalState === 'skipping'
          ? 'Skipping'
      : workerState === 'crashed'
        ? 'Crashed'
        : workerState === 'stopped'
          ? 'Stopped'
        : fastmcpHealth === 'unreachable' && workerState === 'running'
          ? 'Degraded'
          : pipelinePaused
            ? 'Paused'
          : repairFocus
            ? 'Repairing'
          : liveOperationalState === 'running' || currentRun || inProgressEntity
            ? 'Running'
            : 'Waiting'
  const statusItems = [
    {
      label: 'Worker',
      value: String(workerState),
      tone: workerState === 'running' ? 'text-emerald-300' : workerState === 'crashed' ? 'text-rose-300' : 'text-sky-300',
    },
    {
      label: 'Fast MCP',
      value: fastmcpHealth,
      tone: fastmcpHealth === 'reachable' ? 'text-emerald-300' : fastmcpHealth === 'unreachable' ? 'text-rose-300' : 'text-slate-300',
    },
    {
      label: 'Canonical entity',
      value: currentUniverseProgressLabel,
      detail: universeFocusEntity?.entity_name || universeFocusEntity?.entity_id || null,
      tone: 'text-white',
      title: universeTileTitle,
    },
  ] as const
  const runtimeRows = buildRuntimeLabelValuePairs({
    isSafetyStop,
    runtimeCheckpointFailed,
    currentRun,
    runtime,
    liveOperationalState,
    fastmcpHealth,
    freshnessState,
    lastActivityAt,
    stopReason,
    stopDetails,
  })
  const visibleCompletedEntities = completedEntities.slice(0, completedVisibleCount)
  const hasMoreCompletedEntities = completedVisibleCount < completedEntities.length

  return (
    <section
      className="overflow-y-auto overflow-x-hidden rounded-2xl border border-custom-border bg-custom-box shadow-sm transition-[max-height] duration-300 ease-out"
      style={{ maxHeight: isExpanded ? '40rem' : '7rem', padding: '0.7rem' }}
    >
      <div className="flex flex-col gap-3">
        <div className="sr-only">Running now. Blocked / partial. Canonical entity. Stale / blocked.</div>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex shrink-0 flex-col gap-2">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 xl:justify-items-start">
              {statusItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="w-full min-w-0 max-w-[14rem] rounded-lg border border-custom-border bg-custom-bg/70 px-2.5 py-2 text-left transition hover:border-white/30"
                  title={item.title || item.value}
                >
                  <div className="text-[0.55rem] uppercase tracking-[0.14em] text-slate-300">{item.label}</div>
                  <div className={`mt-0.5 truncate text-lg font-semibold leading-none ${item.tone}`}>{item.value}</div>
                  {'detail' in item && item.detail ? (
                    <div className="mt-1 truncate text-[0.65rem] uppercase tracking-[0.12em] text-slate-400">{item.detail}</div>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-row gap-2 xl:pl-3">
            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden rounded-full border border-custom-border bg-custom-bg/70 px-2.5 py-2">
              <Badge variant="outline" className="shrink-0 border-sky-500/30 text-sky-300">
                {statusBadgeLabel}
              </Badge>
              <div className="min-w-0 overflow-hidden">
                <div className="truncate text-[0.72rem] font-medium uppercase tracking-[0.12em] text-fm-light-grey">
                  {isSafetyStop ? compactTicker : null}
                </div>
                {!isSafetyStop ? (
                  <div className="animate-marquee flex min-w-max items-center whitespace-nowrap text-[0.72rem] font-medium uppercase tracking-[0.12em] text-fm-light-grey">
                    <div className="flex shrink-0 items-center gap-8 pr-6 sm:pr-8">
                      {marqueeSegments.map((segment) => (
                        <span key={segment}>{segment}</span>
                      ))}
                    </div>
                    <div className="flex shrink-0 items-center gap-8 pr-6 sm:pr-8" aria-hidden="true">
                      {marqueeSegments.map((segment) => (
                        <span key={`${segment}-mirror`}>{segment}</span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 flex-nowrap items-center justify-end gap-2">
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

              <div className="mt-3 rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-[0.68rem] tracking-[0.1em] text-slate-200">
                <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-400">Runtime</div>
                <div className="mt-2 grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
                  {runtimeRows.map(([label, value]) => (
                    <div key={label}>{label}: <span className="text-white">{value}</span></div>
                  ))}
                </div>
                <div className="mt-2 text-slate-300">
                  Failure buckets: worker stale {String(failureBuckets.worker_stale ?? 0)}, retrying {String(failureBuckets.retrying ?? 0)}, reconciling {String(failureBuckets.reconciling ?? 0)}, degraded {String(failureBuckets.published_degraded ?? 0)}, terminal {String(failureBuckets.failed_terminal ?? 0)}
                </div>
                <div className="mt-2 text-slate-300">
                  Backlog diagnostics: stale rows {String(backlogHealth?.stale_active_count ?? 0)}, retrying {String(backlogHealth?.retrying_count ?? 0)}, reconciling {String(backlogHealth?.reconciling_count ?? 0)}, degraded completions {String(backlogHealth?.published_degraded_count ?? 0)}
                </div>
                <div className="mt-2 text-slate-300">
                  Snapshot age: {snapshotAt ? formatRelativeTimestamp(snapshotAt, 'Snapshot') : 'Unavailable'}
                </div>
                <div className="mt-2 text-slate-300">
                  Last activity: {lastActivityAt ? formatRelativeTimestamp(lastActivityAt, 'Activity') : 'Unavailable'} · Freshness {freshnessState}
                </div>
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
                Queue order: league_priority ASC · league_popularity DESC · priority_score DESC · quality_score DESC · entity_type ASC · entity_name ASC · entity_id ASC
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
                  title="Backlog diagnostics"
                  icon={<AlertCircle className="h-4 w-4 text-amber-300" />}
                  items={dedupeSnapshotLaneItems([...staleActiveRows, ...blockedEntities, ...resumedEntities])}
                  emptyLabel="No stale, blocked, or resume-needed backlog right now."
                  kind="blocked"
                />
                <SnapshotLane
                  title="Completed"
                  icon={<CheckCircle2 className="h-4 w-4 text-emerald-300" />}
                  items={visibleCompletedEntities}
                  emptyLabel="No completed entities yet."
                  kind="completed"
                />
              </div>
              {hasMoreCompletedEntities ? (
                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 border-custom-border px-3 text-xs"
                    onClick={() => {
                      setCompletedVisibleCount((current) => Math.min(current + 8, completedEntities.length))
                    }}
                  >
                    Show more processed entities
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
