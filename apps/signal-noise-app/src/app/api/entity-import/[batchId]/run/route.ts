import { NextRequest, NextResponse } from 'next/server'
import {
  getEntityImportBatchStatus,
  queueEntityImportBatch,
  updateEntityPipelineRun,
} from '@/lib/entity-import-jobs'

const ENTITY_IMPORT_QUEUE_MODE = process.env.ENTITY_IMPORT_QUEUE_MODE || 'durable_worker'

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

    for (const run of status.pipeline_runs ?? []) {
      if (run.status === 'completed') {
        continue
      }
      await updateEntityPipelineRun(params.batchId, run.entity_id, {
        status: 'queued',
        phase: run.phase || 'entity_registration',
        error_message: null,
        metadata: {
          ...(run.metadata ?? {}),
          queue_mode: ENTITY_IMPORT_QUEUE_MODE,
          queued_at: new Date().toISOString(),
        },
      })
    }

    const queuedStatus = await queueEntityImportBatch(params.batchId, {
      queue_mode: ENTITY_IMPORT_QUEUE_MODE,
      queued_at: new Date().toISOString(),
    })

    return NextResponse.json(
      {
        ...queuedStatus,
        execution: {
          mode: ENTITY_IMPORT_QUEUE_MODE,
          state: 'queued',
        },
      },
      { status: 202 },
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to queue entity pipeline batch' },
      { status: 500 },
    )
  }
}
