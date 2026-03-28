import { getSupabaseAdmin } from '@/lib/supabase-client'
import { deriveEntityPipelineLifecycle } from '@/lib/entity-pipeline-lifecycle'
import { loadQuestionFirstScaleManifest } from '@/lib/question-first-manifest'

type PipelineRunRow = {
  batch_id: string | null
  entity_id: string
  canonical_entity_id: string | null
  entity_name: string
  status: string | null
  phase: string | null
  completed_at: string | null
  started_at: string | null
  metadata: Record<string, unknown> | null
}

type ManifestEntity = {
  entity_id?: string
  entity_name?: string
  entity_type?: string
}

export type CanonicalPipelineStatusRecord = {
  batch_id: string | null
  entity_id: string
  canonical_entity_id: string | null
  entity_name: string
  status: string | null
  phase: string | null
  completed_at: string | null
  started_at: string | null
  latest_activity_at: string | null
  quality_state: 'complete' | 'partial' | 'blocked' | 'client_ready' | 'missing'
  lifecycle_stage: string
  lifecycle_label: string
  lifecycle_summary: string
  artifact_source: string
  artifact_path: string | null
  dossier_path: string | null
  publication_status: string | null
  publication_mode: string | null
  reconcile_required: boolean
  repair_state: string
  next_repair_status: string | null
  next_repair_batch_id: string | null
  source_entity_id: string | null
  source_objective: string | null
}

export type CanonicalPipelineStatusResponse = {
  source: 'entity_pipeline_runs'
  status: 'ready' | 'empty' | 'degraded'
  generated_at: string
  snapshot: {
    runs_scanned: number
    unique_entities: number
    completed: number
    partial: number
    blocked: number
    client_ready: number
    missing: number
    published_degraded: number
    running: number
    retrying: number
    stalled: number
    resume_needed: number
  }
  completed_entities: CanonicalPipelineStatusRecord[]
  partial_entities: CanonicalPipelineStatusRecord[]
  blocked_entities: CanonicalPipelineStatusRecord[]
  client_ready_entities: CanonicalPipelineStatusRecord[]
  records: CanonicalPipelineStatusRecord[]
  warnings: string[]
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function normalizeStatus(value: unknown): string | null {
  const text = toText(value)
  return text ? text.toLowerCase() : null
}

function parseTimestamp(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function sortLatestFirst(left: PipelineRunRow, right: PipelineRunRow): number {
  const leftTime = parseTimestamp(left.completed_at || left.started_at)
  const rightTime = parseTimestamp(right.completed_at || right.started_at)
  return rightTime - leftTime
}

function getRunKey(row: PipelineRunRow): string {
  return toText(row.canonical_entity_id || row.entity_id).toLowerCase() || row.entity_id.toLowerCase()
}

function toLifecycleRecord(
  run: PipelineRunRow,
  lifecycle: Awaited<ReturnType<typeof deriveEntityPipelineLifecycle>>,
): CanonicalPipelineStatusRecord {
  return {
    batch_id: run.batch_id,
    entity_id: run.entity_id,
    canonical_entity_id: run.canonical_entity_id,
    entity_name: run.entity_name,
    status: run.status,
    phase: run.phase,
    completed_at: run.completed_at,
    started_at: run.started_at,
    latest_activity_at: lifecycle.latest_activity_at,
    quality_state: lifecycle.quality_state,
    lifecycle_stage: lifecycle.stage,
    lifecycle_label: lifecycle.label,
    lifecycle_summary: lifecycle.summary,
    artifact_source: lifecycle.artifact_source,
    artifact_path: lifecycle.artifact_path,
    dossier_path: lifecycle.dossier_path,
    publication_status: lifecycle.publication_status,
    publication_mode: lifecycle.publication_mode,
    reconcile_required: lifecycle.reconcile_required,
    repair_state: lifecycle.repair_state,
    next_repair_status: lifecycle.next_repair_status,
    next_repair_batch_id: lifecycle.next_repair_batch_id,
    source_entity_id: run.canonical_entity_id || run.entity_id,
    source_objective: normalizeStatus(run.metadata?.source_objective) || null,
  }
}

async function loadActiveRepairFocusRuns() {
  const supabase = getSupabaseAdmin()
  const response = await supabase
    .from('entity_pipeline_runs')
    .select('batch_id, entity_id, canonical_entity_id, entity_name, status, phase, completed_at, started_at, metadata')
    .in('status', ['queued', 'claiming', 'running', 'retrying'])
    .order('started_at', { ascending: false })
    .limit(50)

  if (response.error) {
    throw response.error
  }

  return Array.isArray(response.data) ? (response.data as PipelineRunRow[]) : []
}

async function loadRunsForEntities(entityIds: string[]) {
  const supabase = getSupabaseAdmin()
  const dedupedIds = Array.from(new Set(entityIds.map((value) => toText(value)).filter(Boolean)))
  const rows: PipelineRunRow[] = []
  const chunkSize = 150

  for (let index = 0; index < dedupedIds.length; index += chunkSize) {
    const chunk = dedupedIds.slice(index, index + chunkSize)
    const response = await supabase
      .from('entity_pipeline_runs')
      .select('batch_id, entity_id, canonical_entity_id, entity_name, status, phase, completed_at, started_at, metadata')
      .in('entity_id', chunk)
      .order('started_at', { ascending: false })

    if (response.error) {
      throw response.error
    }

    rows.push(...((response.data as PipelineRunRow[] | null | undefined) ?? []))
  }

  return rows
}

function getManifestEntities(): ManifestEntity[] {
  const manifest = loadQuestionFirstScaleManifest()
  return Array.isArray(manifest.entities) ? manifest.entities : []
}

function buildEmptyResponse(warnings: string[] = [], status: 'empty' | 'degraded' = 'empty'): CanonicalPipelineStatusResponse {
  return {
    source: 'entity_pipeline_runs',
    status,
    generated_at: new Date().toISOString(),
    snapshot: {
      runs_scanned: 0,
      unique_entities: 0,
      completed: 0,
      partial: 0,
      blocked: 0,
      client_ready: 0,
      missing: 0,
      published_degraded: 0,
      running: 0,
      retrying: 0,
      stalled: 0,
      resume_needed: 0,
    },
    completed_entities: [],
    partial_entities: [],
    blocked_entities: [],
    client_ready_entities: [],
    records: [],
    warnings,
  }
}

export async function loadCanonicalPipelineStatus(limit = 100): Promise<CanonicalPipelineStatusResponse> {
  const warnings: string[] = []
  const manifestEntities = getManifestEntities()

  const entityIds = manifestEntities
    .map((entity) => toText(entity.entity_id))
    .filter(Boolean)

  if (entityIds.length === 0) {
    warnings.push('No manifest entities were available for the canonical pipeline status view.')
    return buildEmptyResponse(warnings)
  }

  let activeRepairRuns: PipelineRunRow[] = []
  try {
    activeRepairRuns = await loadActiveRepairFocusRuns()
  } catch (error) {
    warnings.push(`Active repair focus query failed: ${error instanceof Error ? error.message : String(error)}`)
  }

  const runIds = Array.from(
    new Set([
      ...entityIds,
      ...activeRepairRuns.map((run) => run.entity_id),
    ]),
  )

  let runs: PipelineRunRow[] = []
  try {
    runs = await loadRunsForEntities(runIds)
  } catch (error) {
    warnings.push(`Pipeline runs query failed: ${error instanceof Error ? error.message : String(error)}`)
    return buildEmptyResponse(warnings, 'degraded')
  }

  const latestByEntity = new Map<string, PipelineRunRow>()
  for (const run of runs.sort(sortLatestFirst)) {
    const key = getRunKey(run)
    if (!latestByEntity.has(key)) {
      latestByEntity.set(key, run)
    }
  }

  const latestRuns = Array.from(latestByEntity.values())
  if (latestRuns.length === 0) {
    return buildEmptyResponse(warnings)
  }

  const records = await Promise.all(
    latestRuns.map(async (run) => {
      const lifecycle = await deriveEntityPipelineLifecycle({
        entityId: toText(run.canonical_entity_id || run.entity_id) || run.entity_id,
        run: {
          entity_id: run.entity_id,
          status: (run.status || 'queued') as 'queued' | 'claiming' | 'running' | 'retrying' | 'completed' | 'failed',
          phase: run.phase || null,
          completed_at: run.completed_at,
          started_at: run.started_at || new Date().toISOString(),
          metadata: run.metadata || {},
        } as any,
      })
      return toLifecycleRecord(run, lifecycle)
    }),
  )

  const sorted = records.sort((left, right) => {
    const leftTime = parseTimestamp(left.latest_activity_at || left.completed_at || left.started_at)
    const rightTime = parseTimestamp(right.latest_activity_at || right.completed_at || right.started_at)
    return rightTime - leftTime
  })

  const completedEntities = sorted.filter((record) => record.quality_state === 'complete' || record.quality_state === 'client_ready')
  const partialEntities = sorted.filter((record) => record.quality_state === 'partial')
  const blockedEntities = sorted.filter((record) => record.quality_state === 'blocked')
  const clientReadyEntities = sorted.filter((record) => record.quality_state === 'client_ready')

  return {
    source: 'entity_pipeline_runs',
    status: warnings.length > 0 ? 'degraded' : 'ready',
    generated_at: new Date().toISOString(),
    snapshot: {
      runs_scanned: runs.length,
      unique_entities: sorted.length,
      completed: completedEntities.length,
      partial: partialEntities.length,
      blocked: blockedEntities.length,
      client_ready: clientReadyEntities.length,
      missing: sorted.filter((record) => record.quality_state === 'missing').length,
      published_degraded: sorted.filter((record) => record.publication_status === 'published_degraded').length,
      running: sorted.filter((record) => record.lifecycle_stage === 'running' || record.lifecycle_stage === 'repairing').length,
      retrying: sorted.filter((record) => record.lifecycle_stage === 'retryable_failure').length,
      stalled: sorted.filter((record) => record.lifecycle_stage === 'stalled').length,
      resume_needed: sorted.filter((record) => record.lifecycle_stage === 'resume_needed').length,
    },
    completed_entities: completedEntities.slice(0, limit),
    partial_entities: partialEntities.slice(0, limit),
    blocked_entities: blockedEntities.slice(0, limit),
    client_ready_entities: clientReadyEntities.slice(0, limit),
    records: sorted.slice(0, limit),
    warnings,
  }
}
