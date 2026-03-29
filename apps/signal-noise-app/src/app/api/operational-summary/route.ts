import { NextResponse } from 'next/server'

import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
import { readLaneSnapshot } from '@/lib/discovery-lanes/lane-status'
import { getEntityPipelineActivitySummary } from '@/lib/entity-import-jobs'
import { buildOperationalSummary } from '@/lib/operational-summary'
import { entityDossierEnrichmentService } from '@/services/EntityDossierEnrichmentService'

async function getEntitiesActive(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('cached_entities')
      .select('*', { count: 'exact', head: true })

    if (error) throw error
    if (typeof count === 'number') return count
  } catch {
    // fall through to limited scan
  }

  try {
    const { data, error } = await supabase
      .from('cached_entities')
      .select('neo4j_id')
      .limit(10000)

    if (error) throw error
    return (data || []).length
  } catch {
    return 0
  }
}

export async function GET() {
  const [entitiesActive, pipeline, scoutSnapshot] = await Promise.all([
    getEntitiesActive(),
    getEntityPipelineActivitySummary(),
    readLaneSnapshot({ lane: 'scout' }),
  ])

  const batch = entityDossierEnrichmentService.getCurrentBatch()
  const enrichment = {
    isRunning: entityDossierEnrichmentService.isEnrichmentRunning(),
    totalProcessed: batch?.processedEntities || 0,
    totalSuccessful: batch?.successfulEnrichments || 0,
    totalFailed: batch?.failedEnrichments || 0,
  }

  const summary = buildOperationalSummary({
    entitiesActive,
    scout: {
      status: scoutSnapshot.status,
      activeRuns:
        scoutSnapshot.status === 'queued' || scoutSnapshot.status === 'running' || scoutSnapshot.status === 'active'
          ? 1
          : 0,
      detail:
        String(scoutSnapshot.summary?.message || '').trim() ||
        (scoutSnapshot.updated_at ? `Last updated ${scoutSnapshot.updated_at}` : 'Scout lane ready'),
    },
    enrichment,
    pipeline,
    updatedAt: new Date().toISOString(),
  })

  return NextResponse.json({
    success: true,
    data: summary,
  })
}
