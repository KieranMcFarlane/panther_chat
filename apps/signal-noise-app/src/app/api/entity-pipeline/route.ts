import { NextRequest, NextResponse } from 'next/server'
import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
import { normalizeImportedEntityRow, REQUIRED_ENTITY_IMPORT_COLUMNS } from '@/lib/entity-import-schema'
import { mapImportedEntityRowToCachedEntity } from '@/lib/entity-import-mapper'
import {
  createEntityImportBatch,
  createEntityPipelineRuns,
  findActivePipelineRunByEntityId,
  queueEntityImportBatch,
  storeFallbackEntityImportState,
} from '@/lib/entity-import-jobs'

const ENTITY_IMPORT_QUEUE_MODE = process.env.ENTITY_IMPORT_QUEUE_MODE || 'durable_worker'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const normalized = normalizeImportedEntityRow(body)

    if (!normalized.valid || !normalized.row) {
      return NextResponse.json(
        {
          error: 'Invalid entity payload',
          requiredColumns: REQUIRED_ENTITY_IMPORT_COLUMNS,
          errors: normalized.errors,
        },
        { status: 400 },
      )
    }

    const row = normalized.row
    const activeRun = await findActivePipelineRunByEntityId(row.entity_id)
    if (activeRun.run && activeRun.batch) {
      return NextResponse.json(
        {
          batchId: activeRun.batch.id,
          entityId: row.entity_id,
          statusUrl: `/api/entity-import/${activeRun.batch.id}`,
          runDetailUrl: `/entity-import/${activeRun.batch.id}/${row.entity_id}`,
          dossierUrl: `/entity-browser/${row.entity_id}/dossier?from=1`,
          rfpUrl: '/rfps',
          message: 'Entity pipeline already queued or running',
        },
        { status: 202 },
      )
    }

    const batch = await createEntityImportBatch({
      filename: null,
      total_rows: 1,
      invalid_rows: 0,
      metadata: {
        source: 'single_entity_trigger',
        queue_mode: ENTITY_IMPORT_QUEUE_MODE,
      },
    })

    const pipelineRuns = await createEntityPipelineRuns(batch.id, [row])
    await storeFallbackEntityImportState(batch, pipelineRuns)

    await supabase
      .from('cached_entities')
      .upsert([mapImportedEntityRowToCachedEntity(row)], { onConflict: 'neo4j_id' })

    await queueEntityImportBatch(batch.id, {
      queue_mode: ENTITY_IMPORT_QUEUE_MODE,
      queued_at: new Date().toISOString(),
    })

    return NextResponse.json(
      {
        batchId: batch.id,
        entityId: row.entity_id,
        statusUrl: `/api/entity-import/${batch.id}`,
        runDetailUrl: `/entity-import/${batch.id}/${row.entity_id}`,
        dossierUrl: `/entity-browser/${row.entity_id}/dossier?from=1`,
        rfpUrl: '/rfps',
      },
      { status: 202 },
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to queue entity pipeline' },
      { status: 500 },
    )
  }
}
