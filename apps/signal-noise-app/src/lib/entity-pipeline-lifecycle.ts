import { normalizeQuestionFirstDossier, resolveCanonicalQuestionFirstDossier } from '@/lib/question-first-dossier'
import type { EntityPipelineRunRecord } from '@/lib/entity-import-jobs'

type EntityLike = {
  id?: unknown
  uuid?: unknown
  neo4j_id?: unknown
  labels?: unknown
  properties?: Record<string, unknown> | null
}

export type PipelineControlObservedState = 'starting' | 'running' | 'stopping' | 'paused'

export type PipelineControlStateSnapshot = {
  requested_state: 'running' | 'paused'
  observed_state: PipelineControlObservedState
  transition_state: PipelineControlObservedState
}

export type EntityPipelineLifecycleStage =
  | 'queued'
  | 'running'
  | 'repairing'
  | 'reconciling'
  | 'stalled'
  | 'retryable_failure'
  | 'resume_needed'
  | 'run_completed'
  | 'artifact_generated'
  | 'complete_blocked'
  | 'dossier_persisted'
  | 'client_ready'
  | 'failed'

export type EntityPipelineLifecycle = {
  stage: EntityPipelineLifecycleStage
  label: string
  summary: string
  quality_state: 'complete' | 'partial' | 'blocked' | 'client_ready' | 'missing'
  quality_summary: string
  artifact_source: 'question_first_dossier' | 'question_first_run' | 'legacy_dossier' | 'entity_state' | 'missing'
  pipeline_complete: boolean
  artifact_generated: boolean
  dossier_persisted: boolean
  client_ready: boolean
  quality_blocked: boolean
  failed: boolean
  latest_activity_at: string | null
  artifact_path: string | null
  dossier_path: string | null
  blocker_summary: string | null
  heartbeat_at: string | null
  failure_reason: string | null
  failure_category: string | null
  publication_status: string | null
  publication_mode: string | null
  reconcile_required: boolean
  repair_state: 'idle' | 'queued' | 'repairing' | 'exhausted'
  repair_retry_count: number
  repair_retry_budget: number
  next_repair_question_id: string | null
  next_repair_status: 'planned' | 'queued' | 'running' | 'completed' | 'failed' | 'exhausted' | null
  next_repair_batch_id: string | null
  next_repair_batch_status: 'planned' | 'queued' | 'running' | 'completed' | 'failed' | 'exhausted' | null
  reconciliation_state: 'healthy' | 'pending' | 'retrying' | 'exhausted'
  control_state: PipelineControlStateSnapshot | null
  retryable: boolean
  resume_from_question: string | null
  last_completed_question: string | null
  checkpoint_consistent: boolean
  non_terminal_question_ids: string[]
}

type LifecycleRunLike = Pick<
  EntityPipelineRunRecord,
  'entity_id' | 'status' | 'phase' | 'completed_at' | 'started_at' | 'metadata'
>

const CHECKPOINT_STALE_MS = 5 * 60 * 1000

function toText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function getClientReadyInfo(dossier: Record<string, any> | null): {
  clientReady: boolean
  blockers: string[]
} {
  const discoverySummary = dossier?.question_first?.discovery_summary
  const blockers = Array.isArray(discoverySummary?.client_ready_blockers)
    ? discoverySummary.client_ready_blockers
        .map((value: unknown) => toText(value))
        .filter(Boolean)
    : []

  return {
    clientReady: discoverySummary?.client_ready === true,
    blockers,
  }
}

function getQualityBlockers(dossier: Record<string, any> | null): string[] {
  const normalizedBlockers = Array.isArray(dossier?.quality_blockers)
    ? dossier.quality_blockers
        .map((value: unknown) => toText(value))
        .filter(Boolean)
    : []
  if (normalizedBlockers.length > 0) {
    return normalizedBlockers
  }

  const criticalQuestionIds = new Set(['q7_procurement_signal', 'q8_explicit_rfp', 'q13_capability_gap', 'q14_yp_fit'])
  const questions = Array.isArray(dossier?.questions) ? dossier.questions : []
  const blockers: string[] = []
  for (const question of questions) {
    const questionId = toText(question?.question_id)
    if (!criticalQuestionIds.has(questionId)) {
      continue
    }
    const terminalState = toText(question?.terminal_state || question?.question_first_answer?.terminal_state || question?.answer?.terminal_state).toLowerCase()
    if (terminalState !== 'blocked' && terminalState !== 'no_signal') {
      continue
    }
    const summary = toText(question?.terminal_summary || question?.question_first_answer?.terminal_summary || question?.answer?.summary)
    blockers.push(summary || questionId)
  }

  return blockers
}

function stageFromRunStatus(run: LifecycleRunLike | null): EntityPipelineLifecycleStage {
  if (!run) {
    return 'queued'
  }

  if (run.status === 'failed') {
    return 'failed'
  }

  if (run.status === 'retrying') {
    return 'retryable_failure'
  }

  if (run.status === 'completed') {
    return 'run_completed'
  }

  if (run.status === 'queued' || run.status === 'claiming') {
    return 'queued'
  }

  return 'running'
}

function buildLifecycleSummary(input: {
  stage: EntityPipelineLifecycleStage
  phase: string | null
  blockers: string[]
  failureReason?: string | null
  resumeFromQuestion?: string | null
  publicationStatus?: string | null
  reconcileRequired?: boolean
}): string {
  if (input.publicationStatus === 'published_degraded') {
    return input.reconcileRequired
      ? 'Canonical dossier published_degraded; reconciliation is still required for secondary persistence'
      : 'Canonical dossier published_degraded and is awaiting operator review'
  }
  if (input.stage === 'reconciling') {
    return 'Canonical dossier is published; secondary reconciliation is still running'
  }
  if (input.stage === 'repairing') {
    return input.resumeFromQuestion
      ? `Repairing incomplete dossier from ${input.resumeFromQuestion}`
      : 'Repairing incomplete dossier from the next retryable root question'
  }
  if (input.stage === 'failed') {
    return 'Pipeline failed before dossier persistence'
  }
  if (input.stage === 'queued') {
    return 'Queued for end-to-end pipeline execution'
  }
  if (input.stage === 'running') {
    return input.phase ? `Running ${input.phase}` : 'Pipeline execution in progress'
  }
  if (input.stage === 'stalled') {
    return input.resumeFromQuestion
      ? `Execution stalled; resume needed from ${input.resumeFromQuestion}`
      : 'Execution stalled; resume needed from the last durable checkpoint'
  }
  if (input.stage === 'retryable_failure') {
    return input.failureReason
      ? `Retryable failure recorded: ${input.failureReason}`
      : 'Retryable failure recorded; rerun can resume from the last checkpoint'
  }
  if (input.stage === 'resume_needed') {
    return input.resumeFromQuestion
      ? `Resume needed from ${input.resumeFromQuestion}`
      : 'Resume needed from the last durable checkpoint'
  }
  if (input.stage === 'run_completed') {
    return 'Pipeline completed, awaiting question-first artifact generation'
  }
  if (input.stage === 'artifact_generated') {
    return 'Question-first artifact generated, awaiting canonical dossier persistence'
  }
  if (input.stage === 'complete_blocked') {
    return input.blockers.length > 0
      ? `Persisted dossier is blocked on downstream questions: ${input.blockers.join(', ')}`
      : 'Persisted dossier is blocked on downstream questions'
  }
  if (input.stage === 'dossier_persisted') {
    return input.blockers.length > 0
      ? `Canonical dossier persisted, awaiting client-ready promotion: ${input.blockers.join(', ')}`
      : 'Canonical dossier persisted, awaiting client-ready promotion'
  }
  return 'Canonical dossier persisted and client-ready'
}

function buildLifecycleLabel(stage: EntityPipelineLifecycleStage): string {
  switch (stage) {
    case 'failed':
      return 'Failed'
    case 'queued':
      return 'Queued'
    case 'running':
      return 'Running'
    case 'repairing':
      return 'Repairing'
    case 'reconciling':
      return 'Reconciling'
    case 'stalled':
      return 'Stalled'
    case 'retryable_failure':
      return 'Retryable failure'
    case 'resume_needed':
      return 'Resume needed'
    case 'run_completed':
      return 'Run complete'
    case 'artifact_generated':
      return 'Artifact generated'
    case 'complete_blocked':
      return 'Complete but blocked'
    case 'dossier_persisted':
      return 'Dossier persisted'
    case 'client_ready':
      return 'Client-ready'
  }
}

function parseTimestamp(value: unknown): number | null {
  const text = toText(value)
  if (!text) return null
  const timestamp = Date.parse(text)
  return Number.isFinite(timestamp) ? timestamp : null
}

function getCheckpointMetadata(dossier: Record<string, any> | null, run: LifecycleRunLike | null) {
  const questionFirst = dossier?.metadata?.question_first ?? dossier?.question_first ?? {}
  const runMetadata = (run?.metadata && typeof run.metadata === 'object') ? run.metadata as Record<string, any> : {}
  const controlState = questionFirst.control_state && typeof questionFirst.control_state === 'object'
    ? questionFirst.control_state as Record<string, any>
    : runMetadata.control_state && typeof runMetadata.control_state === 'object'
      ? runMetadata.control_state as Record<string, any>
      : runMetadata.pipeline_control_state && typeof runMetadata.pipeline_control_state === 'object'
        ? runMetadata.pipeline_control_state as Record<string, any>
        : null
  return {
    heartbeat_at: toText(questionFirst.heartbeat_at || runMetadata.heartbeat_at) || null,
    failure_reason: toText(questionFirst.failure_reason || runMetadata.failure_reason || runMetadata.error_message) || null,
    failure_category: toText(questionFirst.failure_category || runMetadata.failure_category) || null,
    publication_status: toText(runMetadata.publication_status || questionFirst.publication_status) || null,
    publication_mode: toText(runMetadata.publication_mode || questionFirst.publication_mode) || null,
    reconcile_required: Boolean(
      questionFirst.reconcile_required
      ?? runMetadata.reconcile_required
      ?? (runMetadata.persistence as Record<string, any> | undefined)?.reconcile_required
    ),
    repair_state: (toText(questionFirst.repair_state || runMetadata.repair_state).toLowerCase() || 'idle') as EntityPipelineLifecycle['repair_state'],
    repair_retry_count: Number(questionFirst.repair_retry_count ?? runMetadata.repair_retry_count ?? 0),
    repair_retry_budget: Number(questionFirst.repair_retry_budget ?? runMetadata.repair_retry_budget ?? 0),
    next_repair_question_id: toText(questionFirst.next_repair_question_id || runMetadata.next_repair_question_id) || null,
    next_repair_status: (toText(questionFirst.next_repair_status || runMetadata.next_repair_status).toLowerCase() || null) as EntityPipelineLifecycle['next_repair_status'],
    next_repair_batch_id: toText(questionFirst.next_repair_batch_id || runMetadata.next_repair_batch_id || runMetadata.queued_repair_batch_id) || null,
    next_repair_batch_status: (toText(questionFirst.next_repair_batch_status || runMetadata.next_repair_batch_status).toLowerCase() || null) as EntityPipelineLifecycle['next_repair_batch_status'],
    reconciliation_state: (toText(questionFirst.reconciliation_state || runMetadata.reconciliation_state).toLowerCase() || 'healthy') as EntityPipelineLifecycle['reconciliation_state'],
    control_state: controlState
      ? {
          requested_state: toText(controlState.requested_state || (controlState.is_paused ? 'paused' : 'running')).toLowerCase() === 'paused' ? 'paused' : 'running',
          observed_state: (toText(controlState.observed_state).toLowerCase() || 'running') as PipelineControlObservedState,
          transition_state: (toText(controlState.transition_state).toLowerCase() || 'running') as PipelineControlObservedState,
        }
      : null,
    retryable: Boolean(questionFirst.retryable ?? runMetadata.retryable),
    resume_from_question: toText(questionFirst.resume_from_question || runMetadata.resume_from_question) || null,
    last_completed_question: toText(questionFirst.last_completed_question || runMetadata.last_completed_question) || null,
    publish_status: toText(questionFirst.publish_status || dossier?.publish_status) || null,
    checkpoint_consistent: Boolean(questionFirst.checkpoint_consistent ?? runMetadata.checkpoint_consistent ?? true),
    non_terminal_question_ids: Array.isArray(questionFirst.non_terminal_question_ids)
      ? questionFirst.non_terminal_question_ids.map((value: unknown) => toText(value)).filter(Boolean)
      : Array.isArray(runMetadata.non_terminal_question_ids)
        ? runMetadata.non_terminal_question_ids.map((value: unknown) => toText(value)).filter(Boolean)
        : [],
  }
}

export async function deriveEntityPipelineLifecycle(input: {
  entityId: string
  run?: LifecycleRunLike | null
  entity?: EntityLike | null
}): Promise<EntityPipelineLifecycle> {
  const run = input.run ?? null
  const canonical = await resolveCanonicalQuestionFirstDossier(input.entityId, input.entity)
  const dossier = canonical.dossier ? normalizeQuestionFirstDossier(canonical.dossier, input.entityId, input.entity) : null
  const { clientReady, blockers } = getClientReadyInfo(dossier)
  const qualityBlockers = getQualityBlockers(dossier)
  const qualityState = toText(dossier?.quality_state).toLowerCase() || (canonical.source === 'missing' ? 'missing' : 'partial')
  const qualitySummary = toText(dossier?.quality_summary) || 'No persisted dossier quality assessment is available yet.'
  const baseStage = stageFromRunStatus(run)
  const checkpoint = getCheckpointMetadata(dossier, run)
  const heartbeatAtTs = parseTimestamp(checkpoint.heartbeat_at)
  const isStalled = Boolean(
    heartbeatAtTs
    && Date.now() - heartbeatAtTs > CHECKPOINT_STALE_MS
    && (baseStage === 'running' || checkpoint.non_terminal_question_ids.length > 0),
  )

  let stage = baseStage
  if (checkpoint.reconciliation_state === 'pending' || checkpoint.reconciliation_state === 'retrying') {
    stage = 'reconciling'
  } else if (checkpoint.repair_state === 'queued' || checkpoint.repair_state === 'repairing') {
    stage = 'repairing'
  } else if (checkpoint.retryable) {
    stage = 'retryable_failure'
  } else if (!checkpoint.checkpoint_consistent || checkpoint.non_terminal_question_ids.length > 0) {
    stage = isStalled ? 'stalled' : 'resume_needed'
  } else if (isStalled) {
    stage = 'stalled'
  } else if (checkpoint.resume_from_question && !canonical.dossier && baseStage === 'queued') {
    stage = 'resume_needed'
  } else if (canonical.source === 'question_first_run' && checkpoint.checkpoint_consistent && checkpoint.non_terminal_question_ids.length === 0) {
    stage = 'artifact_generated'
  } else if (canonical.source === 'question_first_dossier') {
    stage = clientReady
      ? 'client_ready'
      : (qualityState === 'blocked' ? 'complete_blocked' : 'dossier_persisted')
  }

  const artifactPath = canonical.artifactPath
  const dossierPath = canonical.source === 'question_first_dossier' ? canonical.artifactPath : null
  const latestActivityAt = toText(
    dossier?.question_first?.generated_at ||
    dossier?.metadata?.question_first?.generated_at ||
    run?.completed_at ||
    run?.started_at,
  ) || null

  return {
    stage,
    label: buildLifecycleLabel(stage),
    summary: buildLifecycleSummary({
      stage,
      phase: toText(run?.phase) || null,
      blockers: qualityBlockers.length > 0 ? qualityBlockers : blockers,
      failureReason: checkpoint.failure_reason,
      resumeFromQuestion: checkpoint.resume_from_question,
      publicationStatus: checkpoint.publication_status,
      reconcileRequired: checkpoint.reconcile_required,
    }),
    quality_state: (qualityState as EntityPipelineLifecycle['quality_state']),
    quality_summary: qualitySummary,
    artifact_source: canonical.source || 'missing',
    pipeline_complete: stage === 'run_completed' || stage === 'artifact_generated' || stage === 'complete_blocked' || stage === 'dossier_persisted' || stage === 'client_ready',
    artifact_generated: stage === 'artifact_generated' || stage === 'complete_blocked' || stage === 'dossier_persisted' || stage === 'client_ready',
    dossier_persisted: stage === 'complete_blocked' || stage === 'dossier_persisted' || stage === 'client_ready',
    client_ready: stage === 'client_ready',
    quality_blocked: qualityState === 'blocked' || qualityState === 'partial',
    failed: stage === 'failed',
    latest_activity_at: latestActivityAt,
    artifact_path: artifactPath,
    dossier_path: dossierPath,
    blocker_summary: (qualityBlockers.length > 0 ? qualityBlockers : blockers).join(', ') || null,
    heartbeat_at: checkpoint.heartbeat_at,
    failure_reason: checkpoint.failure_reason,
    failure_category: checkpoint.failure_category,
    publication_status: checkpoint.publication_status,
    publication_mode: checkpoint.publication_mode,
    reconcile_required: checkpoint.reconcile_required,
    repair_state: checkpoint.repair_state,
    repair_retry_count: checkpoint.repair_retry_count,
    repair_retry_budget: checkpoint.repair_retry_budget,
    next_repair_question_id: checkpoint.next_repair_question_id,
    next_repair_status: checkpoint.next_repair_status,
        next_repair_batch_id: checkpoint.next_repair_batch_id,
        next_repair_batch_status: checkpoint.next_repair_batch_status,
        reconciliation_state: checkpoint.reconciliation_state,
        control_state: checkpoint.control_state,
        retryable: checkpoint.retryable,
        resume_from_question: checkpoint.resume_from_question,
        last_completed_question: checkpoint.last_completed_question,
        checkpoint_consistent: checkpoint.checkpoint_consistent,
        non_terminal_question_ids: checkpoint.non_terminal_question_ids,
  }
}

export async function enrichPipelineRunsWithLifecycle(
  runs: EntityPipelineRunRecord[],
): Promise<Array<EntityPipelineRunRecord & { lifecycle: EntityPipelineLifecycle }>> {
  return Promise.all(
    runs.map(async (run) => ({
      ...run,
      lifecycle: await deriveEntityPipelineLifecycle({
        entityId: run.entity_id,
        run,
      }),
    })),
  )
}
