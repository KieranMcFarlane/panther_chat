import { NextRequest, NextResponse } from 'next/server'

import { loadGraphitiOpportunitiesFromDb } from '@/lib/graphiti-opportunity-read-model'
import { loadGraphitiDossierIngestionStats } from '@/lib/graphiti-dossier-ingestion'
import { requireApiSession, UnauthorizedError } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    await requireApiSession(request)
    const result = await loadGraphitiOpportunitiesFromDb(25)
    const dossierIngestion = await loadGraphitiDossierIngestionStats()

    return NextResponse.json({
      ok: true,
      source: result.source,
      status: result.status,
      generated_at: result.generated_at,
      last_updated_at: result.last_updated_at,
      snapshot: result.snapshot,
      graphiti_dossier_ingestion: dossierIngestion,
      canonical_entities_total: dossierIngestion.canonical_entities_total,
      dossiers_persisted_entities: dossierIngestion.dossiers_persisted_entities,
      dossiers_ingested_entities: dossierIngestion.dossiers_ingested_entities,
      partial_dossiers_ingested: dossierIngestion.partial_dossiers_ingested,
      ingested_not_opportunity_worthy: dossierIngestion.ingested_not_opportunity_worthy,
      opportunity_worthy_entities: dossierIngestion.opportunity_worthy_entities,
      watch_items: dossierIngestion.watch_items,
      active_opportunities: dossierIngestion.active_opportunities,
      accelerating_opportunities: dossierIngestion.accelerating_opportunities,
      failed_only_opportunities_active: dossierIngestion.failed_only_opportunities_active,
      opportunities: result.opportunities.length,
      warnings: result.warnings,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load Graphiti opportunity status' },
      { status: 500 },
    )
  }
}
