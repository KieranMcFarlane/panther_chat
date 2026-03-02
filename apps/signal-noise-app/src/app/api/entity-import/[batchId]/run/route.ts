import { NextRequest, NextResponse } from 'next/server'
import {
  getEntityImportBatchStatus,
  updateEntityImportBatch,
  updateEntityPipelineRun,
} from '@/lib/entity-import-jobs'
import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
import { promoteImportedEntityRfps } from '@/lib/entity-import-rfp'

const FASTAPI_URL = process.env.FASTAPI_URL || process.env.PYTHON_BACKEND_URL || 'http://localhost:8000'
const PIPELINE_TIMEOUT_MS = Number(process.env.ENTITY_PIPELINE_TIMEOUT_MS || 300000)
const ENTITY_IMPORT_QUEUE_MODE = process.env.ENTITY_IMPORT_QUEUE_MODE || 'in_process'
const activeBatchRuns = new Map<string, Promise<void>>()

type PipelineRunResponse = {
  entity_id: string
  phases: Record<string, { status: string }>
  rfp_count: number
  sales_readiness?: string | null
  artifacts?: {
    dossier_id?: string | null
    scores?: Record<string, unknown>
  }
}

async function syncEntityPipelineArtifacts(
  batchId: string,
  entityId: string,
  status: string,
  salesReadiness: string | null | undefined,
  rfpCount: number,
  dossier: Record<string, unknown> | null | undefined,
) {
  const { data: cachedEntity } = await supabase
    .from('cached_entities')
    .select('properties')
    .eq('neo4j_id', entityId)
    .maybeSingle()

  const properties = typeof cachedEntity?.properties === 'object' && cachedEntity.properties !== null
    ? { ...cachedEntity.properties }
    : {}

  properties.dossier_data = dossier ? JSON.stringify(dossier) : properties.dossier_data ?? null
  properties.sales_readiness = salesReadiness ?? null
  properties.rfp_count = rfpCount
  properties.last_pipeline_batch_id = batchId
  properties.last_pipeline_run_detail_url = `/entity-import/${batchId}/${entityId}`
  properties.last_pipeline_status = status
  properties.last_pipeline_run_at = new Date().toISOString()

  await supabase
    .from('cached_entities')
    .update({ properties })
    .eq('neo4j_id', entityId)
}

async function processBatch(batchId: string) {
  const status = await getEntityImportBatchStatus(batchId)

  if (!status.batch) {
    return
  }

  const pipelineRuns = status.pipeline_runs ?? []
  if (pipelineRuns.length === 0) {
    return
  }

  await updateEntityImportBatch(batchId, {
    status: 'running',
  })

  let failedRuns = 0

  for (const run of pipelineRuns) {
    if (run.status === 'completed') {
      continue
    }

    await updateEntityPipelineRun(batchId, run.entity_id, {
      status: 'running',
      phase: 'dossier_generation',
      error_message: null,
    })

    try {
      const response = await fetch(`${FASTAPI_URL}/api/pipeline/run-entity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          batch_id: batchId,
          entity_id: run.entity_id,
          entity_name: run.entity_name,
          entity_type: String(run.metadata.entity_type || 'CLUB'),
          priority_score: Number(run.metadata.priority_score || 50),
        }),
        signal: AbortSignal.timeout(PIPELINE_TIMEOUT_MS),
      })

      const result = (await response.json()) as PipelineRunResponse & { detail?: string; error?: string }
      if (!response.ok) {
        throw new Error(result.detail || result.error || 'Pipeline run failed')
      }

      const lastCompletedPhase = Object.entries(result.phases || {})
        .filter(([, phase]) => phase?.status === 'completed')
        .map(([phase]) => phase)
        .at(-1) || 'dashboard_scoring'

      const promotedRfps = await promoteImportedEntityRfps(batchId, run, result)
      await syncEntityPipelineArtifacts(
        batchId,
        run.entity_id,
        'completed',
        result.sales_readiness,
        result.rfp_count ?? 0,
        (result.artifacts?.dossier as Record<string, unknown> | null | undefined) ?? null,
      )

      await updateEntityPipelineRun(batchId, run.entity_id, {
        status: 'completed',
        phase: lastCompletedPhase,
        dossier_id: result.artifacts?.dossier_id || run.entity_id,
        sales_readiness: result.sales_readiness ?? null,
        rfp_count: result.rfp_count ?? 0,
        completed_at: new Date().toISOString(),
        metadata: {
          ...run.metadata,
          phases: result.phases,
          scores: result.artifacts?.scores ?? null,
          performance_summary: result.artifacts?.discovery_result?.performance_summary ?? null,
          completed_at: result.completed_at ?? null,
          promoted_rfp_ids: promotedRfps.map((rfp) => rfp.id),
        },
      })
    } catch (error) {
      failedRuns += 1
      await syncEntityPipelineArtifacts(
        batchId,
        run.entity_id,
        'failed',
        run.sales_readiness,
        run.rfp_count ?? 0,
        null,
      )
      await updateEntityPipelineRun(batchId, run.entity_id, {
        status: 'failed',
        phase: run.phase,
        error_message: error instanceof Error ? error.message : 'Pipeline run failed',
        completed_at: new Date().toISOString(),
      })
    }
  }

  await updateEntityImportBatch(batchId, {
    status: failedRuns > 0 ? 'failed' : 'completed',
    completed_at: new Date().toISOString(),
  })
}

function enqueueBatchRun(batchId: string) {
  if (activeBatchRuns.has(batchId)) {
    return activeBatchRuns.get(batchId)
  }

  const job = processBatch(batchId)
    .catch(async (error) => {
      await updateEntityImportBatch(batchId, {
        status: 'failed',
        completed_at: new Date().toISOString(),
      })
      console.error(`Entity import batch ${batchId} failed`, error)
    })
    .finally(() => {
      activeBatchRuns.delete(batchId)
    })

  activeBatchRuns.set(batchId, job)
  return job
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { batchId: string } },
) {
  try {
    const status = await getEntityImportBatchStatus(params.batchId)

    if (!status.batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    if ((status.pipeline_runs ?? []).length === 0) {
      return NextResponse.json({ error: 'No pipeline runs found for batch' }, { status: 400 })
    }

    if (activeBatchRuns.has(params.batchId)) {
      const runningStatus = await getEntityImportBatchStatus(params.batchId)
      return NextResponse.json(
        {
          ...runningStatus,
          execution: {
            mode: 'async',
            state: 'already_running',
          },
        },
        { status: 202 },
      )
    }

    await updateEntityImportBatch(params.batchId, {
      status: 'queued',
      metadata: {
        ...(status.batch.metadata ?? {}),
        queue_mode: ENTITY_IMPORT_QUEUE_MODE,
        queued_at: new Date().toISOString(),
      },
    })

    if (ENTITY_IMPORT_QUEUE_MODE !== 'durable_worker') {
      enqueueBatchRun(params.batchId)
    }

    const queuedStatus = await getEntityImportBatchStatus(params.batchId)
    return NextResponse.json(
      {
        ...queuedStatus,
        execution: {
          mode: ENTITY_IMPORT_QUEUE_MODE === 'durable_worker' ? 'durable_worker' : 'async',
          state: 'queued',
        },
      },
      { status: 202 },
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run entity pipeline batch' },
      { status: 500 },
    )
  }
}
