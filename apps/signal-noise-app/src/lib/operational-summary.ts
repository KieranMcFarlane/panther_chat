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

export function buildOperationalSummary(input: OperationalSummaryInput): OperationalSummary {
  const blocked =
    input.pipeline.failedRuns +
    input.enrichment.totalFailed +
    (input.scout.status === 'failed' || input.scout.status === 'degraded' ? 1 : 0)
  const recentCompletions = input.pipeline.recentCompleted + input.enrichment.totalSuccessful

  const scoutStatusLabel =
    input.scout.status === 'running' || input.scout.status === 'active'
      ? 'Running'
      : input.scout.status === 'queued'
        ? 'Queued'
        : input.scout.status === 'completed'
          ? 'Complete'
          : input.scout.status === 'failed' || input.scout.status === 'degraded'
            ? 'Blocked'
            : 'Ready'

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
