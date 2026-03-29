export interface OperationalSummaryInput {
  entitiesActive: number
  scout: {
    status: 'inactive' | 'queued' | 'running' | 'completed' | 'failed' | 'active' | 'degraded'
    activeRuns: number
    detail: string
  }
  enrichment: {
    isRunning: boolean
    totalProcessed: number
    totalSuccessful: number
    totalFailed: number
  }
  pipeline: {
    activeRuns: number
    failedRuns: number
    recentCompleted: number
  }
  updatedAt: string
}

export interface OperationalSummary {
  updatedAt: string
  cards: {
    entitiesActive: string
    pipelineLive: string
    blocked: string
    recentCompletions: string
  }
  scout: {
    statusLabel: string
    detail: string
  }
  enrichment: {
    statusLabel: string
    detail: string
  }
  pipeline: {
    statusLabel: string
    detail: string
  }
}

function deriveScoutStatusLabel(input: OperationalSummaryInput['scout']): string {
  const awaitingFirstArtifact =
    input.activeRuns === 0 && /awaiting first (scout )?artifact/i.test(input.detail)

  if (awaitingFirstArtifact) {
    return 'Ready'
  }

  if (input.status === 'running' || input.status === 'active') {
    return input.activeRuns > 0 ? 'Running' : 'Ready'
  }

  if (input.status === 'queued') {
    return 'Queued'
  }

  if (input.status === 'completed') {
    return 'Complete'
  }

  if (input.status === 'failed' || input.status === 'degraded') {
    return 'Blocked'
  }

  return 'Ready'
}

export function buildOperationalSummary(input: OperationalSummaryInput): OperationalSummary {
  const blocked =
    input.pipeline.failedRuns +
    input.enrichment.totalFailed +
    (input.scout.status === 'failed' || input.scout.status === 'degraded' ? 1 : 0)
  const recentCompletions = input.pipeline.recentCompleted + input.enrichment.totalSuccessful
  const scoutStatusLabel = deriveScoutStatusLabel(input.scout)

  return {
    updatedAt: input.updatedAt,
    cards: {
      entitiesActive: String(input.entitiesActive),
      pipelineLive: String(input.pipeline.activeRuns),
      blocked: String(blocked),
      recentCompletions: String(recentCompletions),
    },
    scout: {
      statusLabel: scoutStatusLabel,
      detail: input.scout.detail,
    },
    enrichment: {
      statusLabel: input.enrichment.isRunning ? 'Running' : 'Idle',
      detail: `${input.enrichment.totalProcessed} processed, ${input.enrichment.totalSuccessful} successful`,
    },
    pipeline: {
      statusLabel: `${input.pipeline.activeRuns} active`,
      detail: `${input.pipeline.recentCompleted} completed recently`,
    },
  }
}
