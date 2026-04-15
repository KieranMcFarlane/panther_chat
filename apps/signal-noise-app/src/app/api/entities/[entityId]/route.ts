import { NextRequest, NextResponse } from 'next/server'
import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
import { getEntityForDossierPage } from '@/lib/entity-loader'

export const dynamic = 'force-dynamic'

type PipelineStatusRecord = {
  batch_id: string | null
  entity_id: string
  canonical_entity_id: string | null
  status: string | null
  phase: string | null
  completed_at: string | null
  started_at: string | null
  dual_write_ok: boolean | null
}

async function getLatestPipelineStatusSummary(
  canonicalEntityId?: string | null,
  ...candidateEntityIds: Array<string | number | null | undefined>
): Promise<PipelineStatusRecord | null> {
  if (canonicalEntityId) {
    const { data } = await supabase
      .from('entity_pipeline_runs')
      .select('batch_id, entity_id, canonical_entity_id, status, phase, completed_at, metadata, started_at')
      .eq('canonical_entity_id', canonicalEntityId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data) {
      const metadata = typeof data.metadata === 'object' && data.metadata !== null ? data.metadata : {}
      const dualWriteOk = metadata.dual_write_ok
        ?? metadata?.persistence?.dual_write_ok
        ?? metadata?.metrics?.dual_write_ok
        ?? null

      return {
        batch_id: data.batch_id ?? null,
        entity_id: data.entity_id ?? canonicalEntityId,
        canonical_entity_id: data.canonical_entity_id ?? canonicalEntityId,
        status: data.status ?? null,
        phase: data.phase ?? null,
        completed_at: data.completed_at ?? null,
        started_at: data.started_at ?? null,
        dual_write_ok: dualWriteOk,
      }
    }
  }

  const uniqueIds = candidateEntityIds
    .map((value) => (value == null ? '' : String(value).trim()))
    .filter((value, index, arr) => Boolean(value) && arr.indexOf(value) === index)

  for (const candidateId of uniqueIds) {
    const { data } = await supabase
      .from('entity_pipeline_runs')
      .select('batch_id, entity_id, canonical_entity_id, status, phase, completed_at, metadata, started_at')
      .eq('entity_id', candidateId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!data) {
      continue
    }

    const metadata = typeof data.metadata === 'object' && data.metadata !== null ? data.metadata : {}
    const dualWriteOk = metadata.dual_write_ok
      ?? metadata?.persistence?.dual_write_ok
      ?? metadata?.metrics?.dual_write_ok
      ?? null

    return {
      batch_id: data.batch_id ?? null,
      entity_id: data.entity_id ?? candidateId,
      canonical_entity_id: data.canonical_entity_id ?? canonicalEntityId ?? null,
      status: data.status ?? null,
      phase: data.phase ?? null,
      completed_at: data.completed_at ?? null,
      started_at: data.started_at ?? null,
      dual_write_ok: dualWriteOk,
    }
  }

  return null
}

export async function GET(
  request: NextRequest,
  { params }: { params: { entityId: string } },
) {
  try {
    const { entityId } = params
    if (!entityId) {
      return NextResponse.json({ error: 'Entity ID is required' }, { status: 400 })
    }

    const entityData = await getEntityForDossierPage(entityId)
    const entity = entityData.entity
    const source = entityData.source

    if (!entity) {
      return NextResponse.json(
        {
          error: 'Entity not found',
          entityId,
          suggestion: 'This entity may have been removed or the ID is incorrect. Please verify the entity ID or refresh the entity list.',
          availableSources: ['Supabase cached_entities, teams, and leagues tables'],
        },
        { status: 404 },
      )
    }

    let comprehensiveDossier = entityData.dossier ?? null
    if (!comprehensiveDossier && entity.properties?.dossier_data) {
      try {
        comprehensiveDossier = JSON.parse(entity.properties.dossier_data)
      } catch {
        comprehensiveDossier = null
      }
    }

    const pipelineStatus = await getLatestPipelineStatusSummary(
      entity.uuid || null,
      entity.id,
      entity.neo4j_id,
      entityId,
    )

    return NextResponse.json({
      entity,
      source,
      dossier: comprehensiveDossier,
      pipeline_status: pipelineStatus,
    })
  } catch (error) {
    console.error('❌ Failed to fetch entity details:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch entity details' },
      { status: 500 },
    )
  }
}
