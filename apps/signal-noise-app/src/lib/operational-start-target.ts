export type OperationalStartSection = 'running' | 'blocked' | 'completed' | 'entities'

type QueueCandidate = {
  entity_id?: string | null
  current_question_id?: string | null
  active_question_id?: string | null
  next_repair_question_id?: string | null
}

type OperationalStartDrilldown = {
  queue?: {
    in_progress_entity?: QueueCandidate | null
    stale_active_rows?: QueueCandidate[]
    resume_needed_entities?: QueueCandidate[]
    completed_entities?: QueueCandidate[]
    upcoming_entities?: QueueCandidate[]
  }
  dossier_quality?: {
    incomplete_entities?: QueueCandidate[]
  }
}

export type OperationalStartTarget = {
  entityId: string
  questionId: string | null
  mode: 'full' | 'question'
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function selectCandidate(section: OperationalStartSection, drilldown: OperationalStartDrilldown) {
  const queue = drilldown.queue || {}
  const blockedCandidate = drilldown.dossier_quality?.incomplete_entities?.[0] || null
  const resumeCandidate = queue.resume_needed_entities?.[0] || null
  const completedCandidate = queue.completed_entities?.[0] || null
  const upcomingCandidate = queue.upcoming_entities?.[0] || null
  const staleCandidate = queue.stale_active_rows?.[0] || null
  switch (section) {
    case 'running':
      return queue.in_progress_entity || staleCandidate || resumeCandidate || upcomingCandidate || completedCandidate || null
    case 'blocked':
      return blockedCandidate || resumeCandidate || upcomingCandidate || completedCandidate || null
    case 'completed':
      return completedCandidate || resumeCandidate || upcomingCandidate || blockedCandidate || null
    case 'entities':
    default:
      return upcomingCandidate || resumeCandidate || blockedCandidate || completedCandidate || null
  }
}

export function resolvePipelineStartTarget(
  input: {
    activeSection: OperationalStartSection
    drilldown: OperationalStartDrilldown | null | undefined
  },
): OperationalStartTarget | null {
  const candidate = selectCandidate(input.activeSection, input.drilldown || {})
  const entityId = toText(candidate?.entity_id)
  if (!entityId) {
    return null
  }

  const questionId = toText(
    candidate?.next_repair_question_id
    || candidate?.current_question_id
    || candidate?.active_question_id,
  ) || null

  return {
    entityId,
    questionId,
    mode: questionId ? 'question' : 'full',
  }
}
