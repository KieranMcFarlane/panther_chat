import { NextRequest, NextResponse } from 'next/server'
import { materializeGraphitiOpportunities } from '@/lib/graphiti-opportunity-persistence'
import { loadGraphitiOpportunitySourceRows } from '@/lib/graphiti-opportunity-persistence'
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

export async function POST(request: NextRequest) {
  try {
    await requireApiSession(request)
    const body = await request.json().catch(() => ({}))
    const limit = Number(body?.limit || 500)
    const effectiveLimit = Number.isFinite(limit) && limit > 0 ? limit : 500
    const sourceRows = await loadGraphitiOpportunitySourceRows(effectiveLimit)

    if (sourceRows.length > 0) {
      const parentRows = sourceRows.map(toParentInsightRow)
      const supabase = getSupabaseAdmin()
      const parentResponse = await supabase
        .from('graphiti_materialized_insights')
        .upsert(parentRows, { onConflict: 'insight_id' })

      if (parentResponse.error) {
        throw new Error(`Failed to seed Graphiti parent insights: ${parentResponse.error.message}`)
      }
    }

    const result = await materializeGraphitiOpportunities(effectiveLimit)

    return NextResponse.json({
      ok: true,
      source_count: sourceRows.length,
      stats: result.stats,
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
