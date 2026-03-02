import { NextRequest, NextResponse } from 'next/server'
import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
import { normalizeImportedEntityRow, REQUIRED_ENTITY_IMPORT_COLUMNS } from '@/lib/entity-import-schema'
import { mapImportedEntityRowToCachedEntity } from '@/lib/entity-import-mapper'
import { createEntityImportBatch, createEntityPipelineRuns, storeFallbackEntityImportState } from '@/lib/entity-import-jobs'

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
    const batch = await createEntityImportBatch({
      filename: null,
      total_rows: 1,
      invalid_rows: 0,
      metadata: {
        source: 'single_entity_trigger',
      },
    })

    const pipelineRuns = await createEntityPipelineRuns(batch.id, [row])
    await storeFallbackEntityImportState(batch, pipelineRuns)

    await supabase
      .from('cached_entities')
      .upsert([mapImportedEntityRowToCachedEntity(row)], { onConflict: 'neo4j_id' })

    const triggerResponse = await fetch(new URL(`/api/entity-import/${batch.id}/run`, request.url), {
      method: 'POST',
    })

    if (!triggerResponse.ok && triggerResponse.status !== 202) {
      const result = await triggerResponse.json().catch(() => ({}))
      throw new Error(result.error || 'Failed to queue entity pipeline run')
    }

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
