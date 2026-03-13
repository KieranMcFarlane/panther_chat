import { NextRequest, NextResponse } from 'next/server'
import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
import { normalizeImportedEntityRow, REQUIRED_ENTITY_IMPORT_COLUMNS } from '@/lib/entity-import-schema'
import { mapImportedEntityRowToCachedEntity } from '@/lib/entity-import-mapper'
import {
  createEntityImportBatch,
  createEntityPipelineRuns,
  storeFallbackEntityImportState,
  updateEntityImportBatch,
} from '@/lib/entity-import-jobs'
import { runPostImportCanonicalMaintenance } from '@/lib/post-import-canonical-maintenance'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const rows = Array.isArray(body?.rows) ? body.rows : []

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error: 'rows must be a non-empty array',
          requiredColumns: REQUIRED_ENTITY_IMPORT_COLUMNS,
        },
        { status: 400 },
      )
    }

    const normalizedRows = rows.map((row: Record<string, unknown>, index: number) => ({
      index,
      result: normalizeImportedEntityRow(row),
    }))

    const invalid_rows = normalizedRows
      .filter(({ result }) => !result.valid)
      .map(({ index, result }) => ({
        index,
        errors: result.errors,
      }))

    const validRows = normalizedRows
      .filter((entry): entry is { index: number; result: { valid: true; row: NonNullable<ReturnType<typeof normalizeImportedEntityRow>['row']>; errors: string[] } } => entry.result.valid)
      .map(({ result }) => result.row)

    const batch = await createEntityImportBatch({
      filename: typeof body?.filename === 'string' ? body.filename : null,
      total_rows: rows.length,
      invalid_rows: invalid_rows.length,
      metadata: {
        requiredColumns: REQUIRED_ENTITY_IMPORT_COLUMNS,
      },
    })

    if (validRows.length === 0) {
      return NextResponse.json(
        {
          batchId: batch.id,
          requiredColumns: REQUIRED_ENTITY_IMPORT_COLUMNS,
          created_rows: 0,
          updated_rows: 0,
          invalid_rows,
        },
        { status: 400 },
      )
    }

    const pipeline_runs = await createEntityPipelineRuns(batch.id, validRows)
    await storeFallbackEntityImportState(batch, pipeline_runs)

    const entityIds = validRows.map((row) => row.entity_id)
    const { data: existingRows, error: existingError } = await supabase
      .from('cached_entities')
      .select('neo4j_id')
      .in('neo4j_id', entityIds)

    if (existingError) {
      return NextResponse.json(
        { error: existingError.message },
        { status: 500 },
      )
    }

    const existingIds = new Set((existingRows || []).map((row: { neo4j_id: string }) => row.neo4j_id))
    const payload = validRows.map((row) => mapImportedEntityRowToCachedEntity(row))

    const { error: upsertError } = await supabase
      .from('cached_entities')
      .upsert(payload, { onConflict: 'neo4j_id' })

    if (upsertError) {
      return NextResponse.json(
        { error: upsertError.message },
        { status: 500 },
      )
    }

    const created_rows = validRows.filter((row) => !existingIds.has(row.entity_id)).length
    const updated_rows = validRows.length - created_rows

    await updateEntityImportBatch(batch.id, {
      status: 'running',
      created_rows,
      updated_rows,
    })

    const canonicalMaintenance = await runPostImportCanonicalMaintenance('entity-import')

    return NextResponse.json({
      batchId: batch.id,
      requiredColumns: REQUIRED_ENTITY_IMPORT_COLUMNS,
      created_rows,
      updated_rows,
      invalid_rows,
      acceptedRows: validRows.length,
      canonicalMaintenance,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import entities' },
      { status: 500 },
    )
  }
}
