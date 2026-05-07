import { NextRequest, NextResponse } from 'next/server'
import { materializeGraphitiOpportunities } from '@/lib/graphiti-opportunity-persistence'
import { loadGraphitiOpportunitySourceRows } from '@/lib/graphiti-opportunity-persistence'
import { backfillGraphitiDossierIngestions } from '@/lib/graphiti-dossier-ingestion'
import { syncGraphitiDossierIngestionMemory } from '@/lib/graphiti-dossier-memory-bridge'
import { synthesizeAndPersistGraphitiOpportunityStrategyBriefs } from '@/lib/graphiti-opportunity-strategy-synthesis.mjs'
import { getSupabaseAdmin } from '@/lib/supabase-client'
import { requireApiSession, UnauthorizedError } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function toParentInsightRow(source: Awaited<ReturnType<typeof loadGraphitiOpportunitySourceRows>>[number]) {
  const rawPayload = source.raw_payload && typeof source.raw_payload === 'object'
    ? source.raw_payload as Record<string, unknown>
    : {}
  const insightType = String(source.insight_type || rawPayload.insight_type || 'opportunity')
  const priority = String(source.priority || rawPayload.priority || 'medium')
  const destinationUrl = String(source.destination_url || rawPayload.destination_url || '/entity-browser')
  return {
    insight_id: source.insight_id,
    entity_id: source.entity_id,
    entity_name: source.entity_name,
    entity_type: source.entity_type,
    title: source.title,
    summary: source.summary,
    why_it_matters: source.why_it_matters,
    suggested_action: source.suggested_action,
    confidence: source.confidence,
    freshness: source.freshness || 'recent',
    insight_type: insightType,
    priority,
    destination_url: destinationUrl,
    evidence: source.evidence,
    relationships: source.relationships,
    source_run_id: source.source_run_id || null,
    source_signal_id: source.source_signal_id || null,
    source_episode_id: source.source_episode_id || null,
    source_objective: source.source_objective || null,
    detected_at: source.detected_at,
    materialized_at: source.materialized_at || new Date().toISOString(),
    last_seen_at: source.materialized_at || new Date().toISOString(),
    state_hash: source.raw_payload && typeof source.raw_payload === 'object'
      ? String((source.raw_payload as Record<string, unknown>).state_hash || source.insight_id)
      : source.insight_id,
    is_active: true,
    raw_payload: {
      ...rawPayload,
      destination_url: destinationUrl,
      priority,
      insight_type: insightType,
    },
  }
}

function dedupeParentInsightRows(rows: ReturnType<typeof toParentInsightRow>[]) {
  const byInsightId = new Map<string, ReturnType<typeof toParentInsightRow>>()

  for (const row of rows) {
    const key = String(row.insight_id || '').trim()
    if (!key) continue
    byInsightId.set(key, row)
  }

  return Array.from(byInsightId.values())
}

export async function POST(request: NextRequest) {
  try {
    await requireApiSession(request)
    const body = await request.json().catch(() => ({}))
    const limit = Number(body?.limit || 500)
    const effectiveLimit = Number.isFinite(limit) && limit > 0 ? limit : 500
    const dryRun = body?.dry_run === true || body?.dryRun === true
    const strategyLimitInput = body?.strategy_limit ?? body?.strategyLimit ?? 50
    const strategyLimit = Number(strategyLimitInput)
    const effectiveStrategyLimit = Number.isFinite(strategyLimit) && strategyLimit >= 0 ? strategyLimit : 50
    const strategySynthesisSkipped = {
      candidate_count: 0,
      synthesized_count: 0,
      updated_count: 0,
      failed_count: 0,
      dry_run: dryRun,
      strategy_synthesis_skipped: true,
    }
    const dossierIngestion = await backfillGraphitiDossierIngestions({
      limit: effectiveLimit,
      dryRun,
    })
    const graphitiMemorySync = await syncGraphitiDossierIngestionMemory({
      limit: effectiveLimit,
      dryRun,
      concurrency: 2,
    })
    const sourceRows = await loadGraphitiOpportunitySourceRows(effectiveLimit)
    const supabase = getSupabaseAdmin()

    if (dryRun) {
      const strategySynthesis = effectiveStrategyLimit === 0
        ? strategySynthesisSkipped
        : await synthesizeAndPersistGraphitiOpportunityStrategyBriefs({
          supabase,
          limit: effectiveStrategyLimit,
          dryRun: true,
        })
      return NextResponse.json({
        ok: true,
        dry_run: true,
        dossier_ingestion: dossierIngestion.stats,
        graphiti_memory_sync: graphitiMemorySync,
        dossiers_ingested_entities: dossierIngestion.stats.would_ingest,
        failed_only_opportunities_deactivated: 0,
        source_count: sourceRows.length,
        stats: {
          source_count: sourceRows.length,
          upserted_count: 0,
          changed_count: 0,
          failed_only_dossier_opportunities_deactivated: 0,
        },
        strategy_synthesis: strategySynthesis,
        warnings: [],
        last_updated_at: new Date().toISOString(),
      })
    }

    if (sourceRows.length > 0) {
      const parentRows = dedupeParentInsightRows(sourceRows.map(toParentInsightRow))
      const parentResponse = await supabase
        .from('graphiti_materialized_insights')
        .upsert(parentRows, { onConflict: 'insight_id' })

      if (parentResponse.error) {
        throw new Error(`Failed to seed Graphiti parent insights: ${parentResponse.error.message}`)
      }
    }

    const result = await materializeGraphitiOpportunities(effectiveLimit)
    const strategySynthesis = effectiveStrategyLimit === 0
      ? strategySynthesisSkipped
      : await synthesizeAndPersistGraphitiOpportunityStrategyBriefs({
        supabase,
        limit: effectiveStrategyLimit,
        dryRun: false,
        concurrency: 2,
      })

    return NextResponse.json({
      ok: true,
      dry_run: dryRun,
      dossier_ingestion: dossierIngestion.stats,
      graphiti_memory_sync: graphitiMemorySync,
      dossiers_ingested_entities: dossierIngestion.stats.ingested,
      failed_only_opportunities_deactivated: result.stats.failed_only_dossier_opportunities_deactivated,
      source_count: sourceRows.length,
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
      { error: error instanceof Error ? error.message : 'Failed to backfill Graphiti opportunities' },
      { status: 500 },
    )
  }
}
