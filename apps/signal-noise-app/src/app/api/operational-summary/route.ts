import { access } from 'node:fs/promises'
import path from 'node:path'

import { NextResponse } from 'next/server'

import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
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

async function scoutRouteExists(): Promise<boolean> {
  try {
    await access(path.join(process.cwd(), 'src/app/api/a2a-system/start/route.ts'))
    return true
  } catch {
    return false
  }
}

export async function GET() {
  const [entitiesActive, pipeline, scoutAvailable] = await Promise.all([
    getEntitiesActive(),
    getEntityPipelineActivitySummary(),
    scoutRouteExists(),
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
      routeAvailable: scoutAvailable,
      activeRuns: 0,
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
