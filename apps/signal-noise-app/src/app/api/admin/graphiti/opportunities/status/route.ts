import { NextRequest, NextResponse } from 'next/server'

import { loadGraphitiOpportunitiesFromDb } from '@/lib/graphiti-opportunity-read-model'
import { loadGraphitiDossierIngestionStats } from '@/lib/graphiti-dossier-ingestion'
import { buildGraphitiOpportunityPipelineHealth } from '@/lib/graphiti-opportunity-pipeline-resilience'
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
      opportunity_pipeline_health: buildGraphitiOpportunityPipelineHealth(result.warnings),
      graphiti_dossier_ingestion: dossierIngestion,
      canonical_entities_total: dossierIngestion.canonical_entities_total,
      dossiers_persisted_entities: dossierIngestion.dossiers_persisted_entities,
      dossiers_ingested_entities: dossierIngestion.dossiers_ingested_entities,
      complete_dossiers_ingested: dossierIngestion.complete_dossiers_ingested,
      partial_dossiers_ingested: dossierIngestion.partial_dossiers_ingested,
      sparse_complete_entities: dossierIngestion.sparse_complete_entities,
      sparse_partial_entities: dossierIngestion.sparse_partial_entities,
      zero_evidence_entities: dossierIngestion.zero_evidence_entities,
      useful_dossier_entities: dossierIngestion.useful_dossier_entities,
      enrichment_required_entities: dossierIngestion.enrichment_required_entities,
      materializable_dossier_candidates: dossierIngestion.materializable_dossier_candidates,
      wrong_entity_blocked: dossierIngestion.wrong_entity_blocked,
      tool_failure_blocked: dossierIngestion.tool_failure_blocked,
      generic_context_only: dossierIngestion.generic_context_only,
      ingested_not_opportunity_worthy: dossierIngestion.ingested_not_opportunity_worthy,
      opportunity_worthy_entities: dossierIngestion.opportunity_worthy_entities,
      watch_items: dossierIngestion.watch_items,
      active_opportunities: dossierIngestion.active_opportunities,
      accelerating_opportunities: dossierIngestion.accelerating_opportunities,
      complete_materialized_rows: dossierIngestion.complete_materialized_rows,
      complete_active_opportunities: dossierIngestion.complete_active_opportunities,
      no_buying_trigger_rows: dossierIngestion.no_buying_trigger_rows,
      stale_opportunity_rows: dossierIngestion.stale_opportunity_rows,
      failed_only_opportunities_active: dossierIngestion.failed_only_opportunities_active,
      latest_dossier_opportunity_seen_at: dossierIngestion.latest_dossier_opportunity_seen_at,
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
