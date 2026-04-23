import type { OperationalDrilldownPayload } from '@/lib/operational-drilldown-client'
import { buildCheckpointSummary, formatCheckpointQuestionProgress, formatCheckpointSourceOrder } from '@/lib/operational-checkpoint'

type ControlState = OperationalDrilldownPayload['control']
type QueueEntity = NonNullable<OperationalDrilldownPayload['queue']['in_progress_entity']> & {
  run_phase?: string | null
  current_stage?: string | null
  current_substep?: string | null
  current_substep_label?: string | null
  current_substep_progress?: string | null
  current_section_label?: string | null
  current_section_index?: number | null
  current_section_total?: number | null
  current_question_index?: number | null
  current_question_total?: number | null
  current_strategy_label?: string | null
  current_execution_state?: string | null
  current_source_order?: string[] | null
  next_repair_status?: string | null
  next_repair_batch_id?: string | null
  next_repair_question_id?: string | null
  current_question_text?: string | null
  next_repair_question_text?: string | null
  last_completed_question_text?: string | null
  started_at?: string | null
  generated_at?: string | null
}

export type OperationalStatusHeroDetailRow = {
  label: string
  value: string
}

export type OperationalStatusHero = {
  headline: string
  supportingLine: string
  issueSummary: string | null
  primaryActionRecommended: boolean
  primaryActionLabel: string
  primaryActionTitle: string
  primaryActionHint: string
  detailRows: OperationalStatusHeroDetailRow[]
  debugSummary: string | null
  debugCompactLine: string | null
  marqueeLine: string | null
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function formatRunningDuration(value: string | null | undefined) {
  if (!value) return 'unknown duration'
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return 'unknown duration'
  const elapsedMs = Math.max(0, Date.now() - timestamp)
  const minutes = Math.floor(elapsedMs / 60000)
  const hours = Math.floor(minutes / 60)
  if (hours > 0) {
    const remainingMinutes = minutes % 60
    return `${hours}h ${remainingMinutes}m`
  }
  if (minutes > 0) {
    return `${minutes}m`
  }
  return `${Math.max(1, Math.floor(elapsedMs / 1000))}s`
}

function formatQuestionProgress(questionId: string | null | undefined) {
  if (!questionId) return 'Question unavailable'
  const match = String(questionId).match(/q(\d+)/i)
  if (!match) return `Question ${questionId}`
  return `Question ${Number(match[1])} of 15`
}

function formatQuestionLabel(questionText: string | null | undefined, questionId: string | null | undefined) {
  const text = toText(questionText)
  if (text) return text
  return formatQuestionProgress(questionId)
}

function formatSubstepLabel(value: string | null | undefined) {
  const text = toText(value)
  if (!text) return null
  return text
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatRelativeTimestamp(value: string | null | undefined, prefix: string) {
  if (!value) return `${prefix} unavailable`
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return `${prefix} unavailable`
  const elapsedMs = Math.max(0, Date.now() - timestamp)
  const minutes = Math.floor(elapsedMs / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${prefix} ${days}d ago`
  if (hours > 0) return `${prefix} ${hours}h ${minutes % 60}m ago`
  if (minutes > 0) return `${prefix} ${minutes}m ago`
  return `${prefix} just now`
}

function formatExactTimestamp(value: string | null | undefined) {
  if (!value) return 'Not available'
  const timestamp = new Date(value)
  if (Number.isNaN(timestamp.getTime())) return 'Not available'
  return timestamp.toLocaleString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function buildOperationalStatusHero(input: {
  drilldown: OperationalDrilldownPayload | null
  controlState: ControlState | null
  currentTargetLabel?: string | null
}): OperationalStatusHero {
  const liveState = input.drilldown?.live_state ?? null
  const backlogHealth = input.drilldown?.backlog_health ?? null
  const runtime = input.drilldown?.runtime ?? null
  const currentLiveRun = liveState?.current_live_run ?? liveState?.current_run ?? runtime?.current_live_run ?? runtime?.current_run ?? null
  const inProgressEntity = liveState?.in_progress_entity ?? input.drilldown?.queue?.in_progress_entity ?? null
  const latestNoteworthyEntity = input.drilldown?.queue?.latest_noteworthy_entity ?? input.drilldown?.queue?.completed_entities?.[0] ?? null
  const queuedEntityCount = input.drilldown?.queue?.upcoming_entities?.length ?? 0
  const completedEntities = input.drilldown?.queue?.completed_entities ?? []
  const freshnessState = input.drilldown?.freshness_state ?? 'fresh'
  const lastActivityAt = input.drilldown?.last_activity_at ?? input.drilldown?.snapshot_at ?? null
  const controlUpdatedLabel = formatRelativeTimestamp(input.controlState?.updated_at ?? null, 'Updated')
  const controlUpdatedExactLabel = formatExactTimestamp(input.controlState?.updated_at ?? null)
  const requestedState = input.controlState?.requested_state ?? (input.controlState?.is_paused === true ? 'paused' : 'running')
  const transitionState = input.controlState?.transition_state ?? input.controlState?.observed_state ?? null
  const pipelinePaused = requestedState === 'paused'
  const workerState = liveState?.worker_process_state
    || input.controlState?.transition_state
    || input.controlState?.observed_state
    || (pipelinePaused ? 'paused' : 'running')
  const isStarting = transitionState === 'starting'
  const isStopping = transitionState === 'stopping'
  const isStopped = workerState === 'stopped' || workerState === 'crashed'
  const isWaiting = !pipelinePaused && !isStarting && !isStopping && !currentLiveRun
  const repairFocus = Boolean(
    inProgressEntity && (
      inProgressEntity.next_repair_status === 'running'
      || inProgressEntity.next_repair_status === 'queued'
      || inProgressEntity.next_repair_batch_id
    ),
  )
  const currentCheckpoint = currentLiveRun || inProgressEntity
  const activeQuestionLabel = currentCheckpoint
    ? formatQuestionLabel(
      currentCheckpoint.current_question_text,
      currentCheckpoint.current_question_id || currentCheckpoint.active_question_id || currentCheckpoint.next_repair_question_id,
    )
    : null
  const checkpointSummary = buildCheckpointSummary(currentCheckpoint)
  const questionProgressLabel = formatCheckpointQuestionProgress(currentCheckpoint)
  const currentSectionLabel = toText(currentCheckpoint?.current_section_label) || 'Unavailable'
  const currentExecutionState = toText(currentCheckpoint?.current_execution_state) || 'Unavailable'
  const currentStrategyLabel = toText(currentCheckpoint?.current_strategy_label) || 'Unavailable'
  const currentSourceOrder = formatCheckpointSourceOrder(currentCheckpoint?.current_source_order)
  const elapsedLabel = currentLiveRun && inProgressEntity
    ? formatRunningDuration(inProgressEntity.started_at || inProgressEntity.generated_at)
    : null
  const substepLabel = formatSubstepLabel(
    inProgressEntity?.current_substep_label
    || currentLiveRun?.current_substep_label
    || inProgressEntity?.current_substep
    || currentLiveRun?.current_substep,
  )
  const substepProgress = toText(
    inProgressEntity?.current_substep_progress
    || currentLiveRun?.current_substep_progress,
  ) || null
  const stageLabel = toText(
    inProgressEntity?.current_stage
    || inProgressEntity?.run_phase
    || currentLiveRun?.current_stage
    || currentLiveRun?.current_action
    || currentLiveRun?.phase,
  ) || null
  const currentTargetLabel = input.currentTargetLabel || null
  const currentTargetHint = currentTargetLabel
    ? `Start will queue ${currentTargetLabel}.`
    : queuedEntityCount > 0
      ? 'Start will queue the next claimable entity from the list.'
      : 'Start will queue the next claimable entity.'
  const headline = isStopping
    ? 'Stopping intake…'
    : isStarting
      ? 'Starting intake…'
      : pipelinePaused
        ? 'Pipeline paused'
        : repairFocus && inProgressEntity
          ? `Repairing ${inProgressEntity.entity_name}…`
          : currentLiveRun && inProgressEntity
            ? `Processing ${inProgressEntity.entity_name}…`
            : isStopped
              ? 'Pipeline stopped'
              : 'Waiting for claimable work.'

  const supportingLine = isStopping
    ? 'Pipeline is safely shutting down. No new work is being accepted.'
    : isStarting
      ? 'Pipeline is starting. Claimable work will be queued again as soon as the worker is ready.'
      : pipelinePaused
        ? 'Pipeline intake is paused. No new work is being accepted.'
        : currentLiveRun && inProgressEntity
          ? `Currently processing ${inProgressEntity.entity_name}.`
          : isStopped
            ? 'No new work is being processed until the pipeline is started.'
            : 'The queue is waiting for claimable work.'

  const issueSummary = freshnessState === 'stale'
    ? 'Operational snapshot is lagging behind recent pipeline activity.'
    : pipelinePaused || isStopping
    ? (queuedEntityCount > 0
      ? `Pipeline paused with ${queuedEntityCount} queued entities waiting.`
      : workerState === 'running'
        ? 'Pipeline intake is paused. Worker is idle.'
        : 'No active worker.')
    : !currentLiveRun && latestNoteworthyEntity && (
      latestNoteworthyEntity.publication_status === 'published_degraded'
      || latestNoteworthyEntity.freshness_state === 'stale'
    )
      ? `Recent issue: ${latestNoteworthyEntity.entity_name} requires attention.`
    : workerState === 'running' && (
      Number(backlogHealth?.stale_active_count ?? 0) > 0
      || Number(backlogHealth?.published_degraded_count ?? 0) > 0
      || Number(backlogHealth?.reconciling_count ?? 0) > 0
      || Number(backlogHealth?.retrying_count ?? 0) > 0
    )
      ? 'Historical stale backlog remains while live processing continues.'
      : repairFocus
        ? (inProgressEntity ? `Repair queue active for ${inProgressEntity.entity_name}.` : 'Repair queue is active.')
        : null

  const primaryActionRecommended = pipelinePaused || isStopped || isWaiting
  const primaryActionLabel = isStarting
    ? 'Starting pipeline…'
    : isStopping
      ? 'Stopping pipeline…'
      : pipelinePaused || isStopped
        ? 'Start pipeline'
        : 'Stop pipeline'
  const primaryActionTitle = isStarting
    ? 'Starting pipeline intake'
    : isStopping
      ? 'Stopping pipeline intake'
      : pipelinePaused || isStopped
        ? 'Start pipeline intake'
        : currentLiveRun
          ? 'Stop pipeline intake after the current work item finishes'
          : 'Stop pipeline intake'
  const primaryActionHint = pipelinePaused || isStopped
    ? `${currentTargetHint}`
    : currentLiveRun
      ? 'Stop pipeline intake after the current work item finishes.'
      : 'Stop pipeline intake.'

  const detailRows = [
    { label: 'Requested', value: requestedState },
    { label: 'Worker', value: workerState },
    { label: 'Activity', value: pipelinePaused ? 'paused' : currentLiveRun && inProgressEntity ? (repairFocus ? 'repairing' : 'running') : isStopped ? 'stopped' : 'waiting' },
    { label: 'Current section', value: currentSectionLabel },
    { label: 'Sub-step', value: substepLabel || 'Unavailable' },
    { label: 'Question progress', value: questionProgressLabel || 'Unavailable' },
    { label: 'Current question', value: activeQuestionLabel || 'Question unavailable' },
    { label: 'Execution state', value: currentExecutionState },
    { label: 'Strategy', value: currentStrategyLabel },
    { label: 'Source order', value: currentSourceOrder },
    { label: 'Sub-step progress', value: substepProgress || 'Unavailable' },
    { label: 'Elapsed', value: elapsedLabel || 'Not running' },
    { label: 'Last completed', value: completedEntities[0]
      ? `${completedEntities[0].entity_name} · ${formatQuestionLabel(completedEntities[0].last_completed_question_text || completedEntities[0].current_question_text, completedEntities[0].current_question_id || completedEntities[0].active_question_id)}`
      : 'No recent completions' },
    { label: 'Last activity', value: formatRelativeTimestamp(lastActivityAt, 'Activity') },
    { label: 'Freshness', value: freshnessState },
    { label: 'Control updated', value: controlUpdatedLabel },
    { label: 'Updated at', value: controlUpdatedExactLabel },
  ] satisfies OperationalStatusHeroDetailRow[]

  const debugSummary = currentLiveRun && inProgressEntity
    ? `${inProgressEntity.entity_name} · ${checkpointSummary || inProgressEntity.run_phase || inProgressEntity.current_stage || 'entity_registration'}`
    : null
  const debugCompactLine = currentLiveRun && inProgressEntity
    ? `Session: ${inProgressEntity.entity_id} · ${checkpointSummary || inProgressEntity.run_phase || inProgressEntity.current_stage || 'n/a'} · heartbeat ${formatRunningDuration(inProgressEntity.started_at || inProgressEntity.generated_at)} ago`
    : null
  const marqueeLine = currentCheckpoint
    ? [
        `Checkpoint: ${currentCheckpoint.entity_name}`,
        checkpointSummary || stageLabel || 'Question unavailable',
        elapsedLabel ? `Elapsed ${elapsedLabel}` : null,
      ].filter(Boolean).join(' • ')
    : headline

  return {
    headline,
    supportingLine,
    issueSummary,
    primaryActionRecommended,
    primaryActionLabel,
    primaryActionTitle,
    primaryActionHint,
    detailRows,
    debugSummary,
    debugCompactLine,
    marqueeLine,
  }
}

export {
  formatExactTimestamp,
  formatQuestionProgress,
  formatRelativeTimestamp,
  formatRunningDuration,
}
