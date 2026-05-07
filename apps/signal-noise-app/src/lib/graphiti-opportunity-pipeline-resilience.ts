export type GraphitiOpportunityPipelineStepName =
  | 'dossier_ingestion'
  | 'graphiti_memory_sync'
  | 'opportunity_materialization'
  | 'strategy_synthesis'

export type GraphitiOpportunityPipelineStep<T = unknown> = {
  name: GraphitiOpportunityPipelineStepName
  critical: boolean
  ok: boolean
  attempts: number
  duration_ms: number
  result?: T
  error?: string
}

export type GraphitiOpportunityPipelineSummary = {
  ok: boolean
  status: 'ready' | 'degraded' | 'failed'
  degraded: boolean
  failedCriticalSteps: GraphitiOpportunityPipelineStep[]
  failedNonCriticalSteps: GraphitiOpportunityPipelineStep[]
  warnings: string[]
}

export type GraphitiOpportunityPipelineResilienceConfig = {
  retryAttempts: number
  stepTimeoutMs: number
}

const DEFAULT_RETRY_ATTEMPTS = 2
const DEFAULT_STEP_TIMEOUT_MS = 120000

function toPositiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.floor(parsed)
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'unknown_error')
}

export function resolveGraphitiOpportunityPipelineResilienceConfig(
  env: NodeJS.ProcessEnv = process.env,
): GraphitiOpportunityPipelineResilienceConfig {
  return {
    retryAttempts: toPositiveInteger(env.GRAPHITI_OPPORTUNITY_PIPELINE_RETRY_ATTEMPTS, DEFAULT_RETRY_ATTEMPTS),
    stepTimeoutMs: toPositiveInteger(env.GRAPHITI_OPPORTUNITY_PIPELINE_STEP_TIMEOUT_MS, DEFAULT_STEP_TIMEOUT_MS),
  }
}

function withStepTimeout<T>(promise: Promise<T>, name: GraphitiOpportunityPipelineStepName, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${name}_step_timeout`)), timeoutMs)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout)
  })
}

export async function runGraphitiOpportunityPipelineStep<T>(
  options: {
    name: GraphitiOpportunityPipelineStepName
    critical: boolean
    retryAttempts?: number
    timeoutMs?: number
  },
  runner: () => Promise<T>,
): Promise<GraphitiOpportunityPipelineStep<T>> {
  const startedAt = Date.now()
  const attempts = Math.max(1, options.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS)
  const timeoutMs = Math.max(1000, options.timeoutMs ?? DEFAULT_STEP_TIMEOUT_MS)
  let lastError: unknown = null

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await withStepTimeout(runner(), options.name, timeoutMs)
      return {
        name: options.name,
        critical: options.critical,
        ok: true,
        attempts: attempt,
        duration_ms: Date.now() - startedAt,
        result,
      }
    } catch (error) {
      lastError = error
    }
  }

  return {
    name: options.name,
    critical: options.critical,
    ok: false,
    attempts,
    duration_ms: Date.now() - startedAt,
    error: toErrorMessage(lastError),
  }
}

export function summarizeGraphitiOpportunityPipeline(
  steps: GraphitiOpportunityPipelineStep[],
): GraphitiOpportunityPipelineSummary {
  const failedCriticalSteps = steps.filter((step) => step.critical && !step.ok)
  const failedNonCriticalSteps = steps.filter((step) => !step.critical && !step.ok)
  const status = failedCriticalSteps.length > 0
    ? 'failed'
    : failedNonCriticalSteps.length > 0
      ? 'degraded'
      : 'ready'

  return {
    ok: failedCriticalSteps.length === 0,
    status,
    degraded: status === 'degraded',
    failedCriticalSteps,
    failedNonCriticalSteps,
    warnings: failedNonCriticalSteps.map((step) => `${step.name} degraded: ${step.error || 'unknown_error'}`),
  }
}

export function buildGraphitiOpportunityPipelineHealth(warnings: string[] = []) {
  return {
    status: warnings.length > 0 ? 'degraded' : 'ready',
    continuation_policy:
      'Dossier ingestion and opportunity materialization are critical; Graphiti MCP memory sync and GLM strategy synthesis are retried and reported as degraded without blocking materialization.',
    critical_steps: ['dossier_ingestion', 'opportunity_materialization'],
    non_critical_steps: ['graphiti_memory_sync', 'strategy_synthesis'],
    retryable_steps: ['graphiti_memory_sync', 'strategy_synthesis'],
    warnings,
  }
}
