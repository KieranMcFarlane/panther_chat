import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
import type { ImportedEntityRow } from '@/lib/entity-import-schema'

export interface EntityImportBatchRecord {
  id: string
  filename: string | null
  status: 'queued' | 'claiming' | 'running' | 'retrying' | 'completed' | 'failed'
  total_rows: number
  created_rows: number
  updated_rows: number
  invalid_rows: number
  started_at: string
  completed_at: string | null
  metadata: Record<string, unknown>
}

export interface EntityPipelineRunRecord {
  id: string
  batch_id: string
  entity_id: string
  entity_name: string
  status: 'queued' | 'claiming' | 'running' | 'retrying' | 'completed' | 'failed'
  phase: string
  error_message: string | null
  dossier_id: string | null
  sales_readiness: string | null
  rfp_count: number
  started_at: string
  completed_at: string | null
  metadata: Record<string, unknown>
}

export interface EntityPipelineActivitySummary {
  activeRuns: number
  failedRuns: number
  recentCompleted: number
}

const entityImportBatchesMemoryStore = new Map<string, EntityImportBatchRecord>()
const entityPipelineRunsMemoryStore = new Map<string, EntityPipelineRunRecord[]>()

function nowIso(): string {
  return new Date().toISOString()
}

function createBatchId(): string {
  return `import_${Date.now()}`
}

function createRunId(batchId: string, entityId: string): string {
  return `${batchId}_${entityId}`
}

function withFallbackBatch(
  batch: EntityImportBatchRecord,
  runs: EntityPipelineRunRecord[],
) {
  entityImportBatchesMemoryStore.set(batch.id, batch)
  entityPipelineRunsMemoryStore.set(batch.id, runs)
}

export async function createEntityImportBatch(input: {
  filename?: string | null
  total_rows: number
  invalid_rows: number
  metadata?: Record<string, unknown>
}) {
  const batch: EntityImportBatchRecord = {
    id: createBatchId(),
    filename: input.filename ?? null,
    status: 'queued',
    total_rows: input.total_rows,
    created_rows: 0,
    updated_rows: 0,
    invalid_rows: input.invalid_rows,
    started_at: nowIso(),
    completed_at: null,
    metadata: input.metadata ?? {},
  }

  try {
    await supabase.from('entity_import_batches').insert(batch)
  } catch {
    entityImportBatchesMemoryStore.set(batch.id, batch)
  }

  return batch
}

export async function createEntityPipelineRuns(batch_id: string, rows: ImportedEntityRow[]) {
  const runs: EntityPipelineRunRecord[] = rows.map((row) => ({
    id: createRunId(batch_id, row.entity_id),
    batch_id,
    entity_id: row.entity_id,
    entity_name: row.name,
    status: 'queued',
    phase: 'entity_registration',
    error_message: null,
    dossier_id: null,
    sales_readiness: null,
    rfp_count: 0,
    started_at: nowIso(),
    completed_at: null,
    metadata: {
      source: row.source,
      priority_score: row.priority_score,
      entity_type: row.entity_type,
      sport: row.sport,
      country: row.country,
      website: row.website ?? null,
      league: row.league ?? null,
    },
  }))

  try {
    await supabase.from('entity_pipeline_runs').insert(runs)
  } catch {
    entityPipelineRunsMemoryStore.set(batch_id, runs)
  }

  return runs
}

export async function updateEntityImportBatch(
  batch_id: string,
  updates: Partial<EntityImportBatchRecord>,
) {
  const memoryBatch = entityImportBatchesMemoryStore.get(batch_id)
  if (memoryBatch) {
    entityImportBatchesMemoryStore.set(batch_id, { ...memoryBatch, ...updates })
  }

  try {
    await supabase.from('entity_import_batches').update(updates).eq('id', batch_id)
  } catch {
    return
  }
}

export async function updateEntityPipelineRun(
  batch_id: string,
  entity_id: string,
  updates: Partial<EntityPipelineRunRecord>,
) {
  const memoryRuns = entityPipelineRunsMemoryStore.get(batch_id)
  if (memoryRuns) {
    entityPipelineRunsMemoryStore.set(
      batch_id,
      memoryRuns.map((run) => (run.entity_id === entity_id ? { ...run, ...updates } : run)),
    )
  }

  try {
    await supabase
      .from('entity_pipeline_runs')
      .update(updates)
      .eq('batch_id', batch_id)
      .eq('entity_id', entity_id)
  } catch {
    return
  }
}

export async function getEntityImportBatchStatus(batch_id: string) {
  const memoryBatch = entityImportBatchesMemoryStore.get(batch_id)
  const memoryRuns = entityPipelineRunsMemoryStore.get(batch_id) ?? []

  try {
    const [{ data: batchData }, { data: runData }] = await Promise.all([
      supabase.from('entity_import_batches').select('*').eq('id', batch_id).maybeSingle(),
      supabase.from('entity_pipeline_runs').select('*').eq('batch_id', batch_id).order('started_at', { ascending: true }),
    ])

    if (batchData) {
      return {
        batch: batchData as EntityImportBatchRecord,
        pipeline_runs: (runData ?? []) as EntityPipelineRunRecord[],
      }
    }
  } catch {
    // fall through to memory store
  }

  return {
    batch: memoryBatch ?? null,
    pipeline_runs: memoryRuns,
  }
}

export async function getEntityPipelineRun(batch_id: string, entity_id: string) {
  const status = await getEntityImportBatchStatus(batch_id)
  const run = (status.pipeline_runs ?? []).find((item) => item.entity_id === entity_id) ?? null

  return {
    batch: status.batch,
    run,
  }
}

export async function findActivePipelineRunByEntityId(entity_id: string) {
  const fallbackRun = [...entityPipelineRunsMemoryStore.values()]
    .flat()
    .find((run) => run.entity_id === entity_id && ['queued', 'claiming', 'running', 'retrying'].includes(run.status))

  const fallbackBatch = fallbackRun
    ? entityImportBatchesMemoryStore.get(fallbackRun.batch_id) ?? null
    : null

  try {
    const { data: runData } = await supabase
      .from('entity_pipeline_runs')
      .select('*')
      .eq('entity_id', entity_id)
      .in('status', ['queued', 'claiming', 'running', 'retrying'])
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (runData) {
      const { data: batchData } = await supabase
        .from('entity_import_batches')
        .select('*')
        .eq('id', runData.batch_id)
        .maybeSingle()

      return {
        batch: (batchData ?? null) as EntityImportBatchRecord | null,
        run: runData as EntityPipelineRunRecord,
      }
    }
  } catch {
    // fall through to memory store
  }

  return {
    batch: fallbackBatch,
    run: fallbackRun ?? null,
  }
}

export async function queueEntityImportBatch(
  batch_id: string,
  metadata: Record<string, unknown> = {},
) {
  const status = await getEntityImportBatchStatus(batch_id)
  if (!status.batch) {
    return { batch: null, pipeline_runs: [] }
  }

  await updateEntityImportBatch(batch_id, {
    status: 'queued',
    metadata: {
      ...(status.batch.metadata ?? {}),
      ...metadata,
    },
  })

  return getEntityImportBatchStatus(batch_id)
}

export async function storeFallbackEntityImportState(
  batch: EntityImportBatchRecord,
  runs: EntityPipelineRunRecord[],
) {
  withFallbackBatch(batch, runs)
}

export async function getEntityPipelineActivitySummary(): Promise<EntityPipelineActivitySummary> {
  const summarize = (runs: Array<Pick<EntityPipelineRunRecord, 'status' | 'completed_at'>>) => {
    const now = Date.now()
    const recentWindowMs = 24 * 60 * 60 * 1000

    return {
      activeRuns: runs.filter((run) => ['queued', 'claiming', 'running', 'retrying'].includes(run.status)).length,
      failedRuns: runs.filter((run) => run.status === 'failed').length,
      recentCompleted: runs.filter((run) => {
        if (run.status !== 'completed' || !run.completed_at) return false
        const completedAt = new Date(run.completed_at).getTime()
        return Number.isFinite(completedAt) && now - completedAt <= recentWindowMs
      }).length,
    }
  }

  const memoryRuns = [...entityPipelineRunsMemoryStore.values()].flat()

  try {
    const { data } = await supabase
      .from('entity_pipeline_runs')
      .select('status, completed_at')
      .limit(500)

    if (data) {
      return summarize(data as Array<Pick<EntityPipelineRunRecord, 'status' | 'completed_at'>>)
    }
  } catch {
    // fall back to memory
  }

  return summarize(memoryRuns)
}
