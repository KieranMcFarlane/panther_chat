import type { OperationalDrilldownPayload } from '@/lib/operational-drilldown-client'

type ControlState = OperationalDrilldownPayload['control']
type QueueEntity = NonNullable<OperationalDrilldownPayload['queue']['in_progress_entity']> & {
  run_phase?: string | null
  current_stage?: string | null
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
  const inProgressEntity = liveState?.in_progress_entity ?? input.drilldown?.queue?.in_progress_entity ?? null
  const queuedEntityCount = input.drilldown?.queue?.upcoming_entities?.length ?? 0
  const completedEntities = input.drilldown?.queue?.completed_entities ?? []
  const controlUpdatedLabel = formatRelativeTimestamp(input.controlState?.updated_at ?? null, 'Updated')
  const controlUpdatedExactLabel = formatExactTimestamp(input.controlState?.updated_at ?? null)
  const pipelinePaused = input.controlState?.is_paused === true
  const requestedState = input.controlState?.requested_state ?? (pipelinePaused ? 'paused' : 'running')
  const workerState = liveState?.worker_process_state
    || input.controlState?.transition_state
    || input.controlState?.observed_state
    || (pipelinePaused ? 'paused' : 'running')
  const repairFocus = Boolean(
    inProgressEntity && (
      inProgressEntity.next_repair_status === 'running'
      || inProgressEntity.next_repair_status === 'queued'
      || inProgressEntity.next_repair_batch_id
    ),
  )
  const activeQuestionLabel = inProgressEntity
    ? formatQuestionLabel(
      inProgressEntity.current_question_text,
      inProgressEntity.current_question_id || inProgressEntity.active_question_id || inProgressEntity.next_repair_question_id,
    )
    : null
  const currentTargetLabel = input.currentTargetLabel || null
  const currentTargetHint = currentTargetLabel
    ? `Resume will queue ${currentTargetLabel}.`
    : queuedEntityCount > 0
      ? `Resume will queue the next claimable entity from the list.`
      : 'Resume will queue the next claimable entity.'
  const headline = workerState === 'stopping'
    ? 'Stopping intake…'
    : workerState === 'starting'
      ? 'Starting intake…'
      : pipelinePaused
        ? 'Pipeline paused'
        : repairFocus && inProgressEntity
          ? `Repairing ${inProgressEntity.entity_name}…`
          : inProgressEntity
            ? `Processing ${inProgressEntity.entity_name}…`
            : 'Waiting for claimable work.'

  const supportingLine = workerState === 'stopping'
    ? 'Pipeline is safely shutting down. No new work is being accepted.'
    : workerState === 'starting'
      ? 'Pipeline is resuming. Claimable work will be queued again as soon as the worker is ready.'
      : pipelinePaused
        ? 'Pipeline intake is paused. No new work is being accepted.'
        : inProgressEntity
          ? `Currently processing ${inProgressEntity.entity_name}.`
          : 'The queue is waiting for claimable work.'

  const issueSummary = pipelinePaused || workerState === 'stopping'
    ? (queuedEntityCount > 0
      ? `${queuedEntityCount} queued entities are waiting for a worker.`
      : 'No active worker.')
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

  const primaryActionRecommended = pipelinePaused || workerState !== 'running' || repairFocus
  const primaryActionLabel = primaryActionRecommended ? 'Resume pipeline' : 'Pause pipeline'
  const primaryActionTitle = primaryActionRecommended
    ? `Resume pipeline${currentTargetLabel ? ` and rerun ${currentTargetLabel}` : ''}`
    : 'Pause pipeline intake'
  const primaryActionHint = primaryActionRecommended
    ? `${currentTargetHint}`
    : 'Pause intake after the current work item finishes.'

  const detailRows = [
    { label: 'Requested', value: requestedState },
    { label: 'Worker', value: workerState },
    { label: 'Activity', value: inProgressEntity ? (repairFocus ? 'repairing' : 'running') : pipelinePaused ? 'paused' : 'waiting' },
    { label: 'Current question', value: activeQuestionLabel || 'Question unavailable' },
    { label: 'Elapsed', value: inProgressEntity ? formatRunningDuration(inProgressEntity.started_at || inProgressEntity.generated_at) : 'Not running' },
    { label: 'Last completed', value: completedEntities[0]
      ? `${completedEntities[0].entity_name} · ${formatQuestionLabel(completedEntities[0].last_completed_question_text || completedEntities[0].current_question_text, completedEntities[0].current_question_id || completedEntities[0].active_question_id)}`
      : 'No recent completions' },
    { label: 'Control updated', value: controlUpdatedLabel },
    { label: 'Updated at', value: controlUpdatedExactLabel },
  ] satisfies OperationalStatusHeroDetailRow[]

  const debugSummary = inProgressEntity
    ? `${inProgressEntity.entity_name} · ${inProgressEntity.run_phase || inProgressEntity.current_stage || 'entity_registration'}`
    : null
  const debugCompactLine = inProgressEntity
    ? `Session: ${inProgressEntity.entity_id} · ${inProgressEntity.run_phase || inProgressEntity.current_stage || 'n/a'} · ${activeQuestionLabel || 'Question unavailable'} · heartbeat ${formatRunningDuration(inProgressEntity.started_at || inProgressEntity.generated_at)} ago`
    : null

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
  }
}

export {
  formatExactTimestamp,
  formatQuestionProgress,
  formatRelativeTimestamp,
  formatRunningDuration,
}
