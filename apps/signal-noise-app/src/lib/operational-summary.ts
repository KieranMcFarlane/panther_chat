export interface OperationalSummaryInput {
  entitiesActive: number
  scout: {
    routeAvailable: boolean
    activeRuns: number
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
  const blocked = input.pipeline.failedRuns + input.enrichment.totalFailed + (input.scout.routeAvailable ? 0 : 1)
  const recentCompletions = input.pipeline.recentCompleted + input.enrichment.totalSuccessful

  return {
    updatedAt: input.updatedAt,
    cards: {
      entitiesActive: String(input.entitiesActive),
      pipelineLive: String(input.pipeline.activeRuns),
      blocked: String(blocked),
      recentCompletions: String(recentCompletions),
    },
    scout: input.scout.routeAvailable
      ? {
          statusLabel: input.scout.activeRuns > 0 ? 'Running' : 'Ready',
          detail:
            input.scout.activeRuns > 0
              ? `${input.scout.activeRuns} scout runs active`
              : 'Scout endpoint available',
        }
      : {
          statusLabel: 'Unavailable',
          detail: 'Scout endpoint missing in this branch',
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
