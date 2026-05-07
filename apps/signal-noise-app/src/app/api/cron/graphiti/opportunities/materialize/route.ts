import { NextRequest, NextResponse } from 'next/server'

import { requireCronSecret } from '@/lib/cron-auth'
import { backfillGraphitiDossierIngestions } from '@/lib/graphiti-dossier-ingestion'
import { syncGraphitiDossierIngestionMemory } from '@/lib/graphiti-dossier-memory-bridge'
import { materializeGraphitiOpportunities } from '@/lib/graphiti-opportunity-persistence'
import { synthesizeAndPersistGraphitiOpportunityStrategyBriefs } from '@/lib/graphiti-opportunity-strategy-synthesis.mjs'
import { UnauthorizedError } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CRON_DOSSIER_LIMIT = 100
const CRON_STRATEGY_LIMIT = 5
const CRON_MODEL_TIMEOUT_MS = 60000

export async function POST(request: NextRequest) {
  try {
    requireCronSecret(request)
    const dossierIngestion = await backfillGraphitiDossierIngestions({
      limit: CRON_DOSSIER_LIMIT,
      dryRun: false,
    })
    const graphitiMemorySync = await syncGraphitiDossierIngestionMemory({
      limit: CRON_DOSSIER_LIMIT,
      dryRun: false,
      concurrency: 2,
    })
    const result = await materializeGraphitiOpportunities(CRON_DOSSIER_LIMIT)
    const strategySynthesis = await synthesizeAndPersistGraphitiOpportunityStrategyBriefs({
      supabase: getSupabaseAdmin(),
      limit: CRON_STRATEGY_LIMIT,
      dryRun: false,
      concurrency: 1,
      modelTimeoutMs: CRON_MODEL_TIMEOUT_MS,
    })

    return NextResponse.json({
      ok: true,
      dossier_ingestion: dossierIngestion.stats,
      graphiti_memory_sync: graphitiMemorySync,
      stats: result.stats,
      strategy_synthesis: strategySynthesis,
      warnings: result.warnings,
      last_updated_at: result.lastUpdatedAt,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to materialize Graphiti opportunities' },
      { status: 500 },
    )
  }
}
