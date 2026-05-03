import { NextRequest, NextResponse } from 'next/server'

import { getPool } from '@/lib/pg-client'
import { requireApiSession, UnauthorizedError } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

function dossierUrlFor(row: { canonical_entity_id?: string | null; entity_id?: string | null }) {
  const id = text(row.canonical_entity_id || row.entity_id)
  return id ? `/entity-browser/${id}/dossier?from=opportunities-diagnostics` : null
}

function mapWatchItem(row: Record<string, unknown>) {
  const rawPayload = asRecord(row.raw_payload)
  const qualification = asRecord(rawPayload.commercial_qualification)
  return {
    opportunity_id: row.opportunity_id,
    entity_name: row.entity_name || row.canonical_entity_name,
    canonical_entity_id: row.canonical_entity_id,
    title: row.title,
    status: row.status,
    is_active: Boolean(row.is_active),
    watch_item: rawPayload.watch_item === true,
    source_ledger_id: rawPayload.source_ledger_id || null,
    promotion_reason: qualification.promotion_reason || rawPayload.promotion_reason || null,
    blockers: Array.isArray(qualification.blockers) ? qualification.blockers : [],
    commercial_status: qualification.status || null,
    temporal_status: asRecord(rawPayload.temporal_reasoning).status || null,
    yellow_panther_fit: row.yellow_panther_fit,
    dossier_url: dossierUrlFor(row),
    updated_at: row.updated_at || row.materialized_at || null,
  }
}

async function loadDiagnostics() {
  const pool = getPool()
  const countsResult = await pool.query(`
    select
      count(*) filter (
        where is_active = true
          and raw_payload->>'source' = 'entity_dossiers'
          and raw_payload->>'shortlist_opportunity' = 'true'
      )::int as active_shortlist_count,
      count(*) filter (
        where raw_payload->>'source' = 'entity_dossiers'
          and raw_payload->>'watch_item' = 'true'
      )::int as watch_item_count,
      count(*) filter (
        where raw_payload->>'source' = 'entity_dossiers'
          and raw_payload->'commercial_qualification'->>'status' = 'context_only'
      )::int as context_only_count,
      count(*) filter (
        where raw_payload->>'source' = 'entity_dossiers'
          and (
            raw_payload->'commercial_qualification'->>'status' = 'failed'
            or lower(coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(read_more_context, '')) like '%question execution failed before a safe answer could be produced%'
          )
      )::int as failed_only_count
    from graphiti_materialized_opportunities
  `)
  const ingestionResult = await pool.query(`
    select
      count(distinct canonical_entity_id)::int as ingested_dossier_entities,
      count(*) filter (where status = 'ingested')::int as ingested_rows,
      count(*) filter (where status = 'skipped_empty')::int as skipped_empty_rows,
      count(*) filter (where status = 'failed')::int as failed_rows
    from graphiti_dossier_ingestions
  `)
  const reviewableResult = await pool.query(`
    select
      opportunity_id,
      entity_id,
      entity_name,
      canonical_entity_id,
      canonical_entity_name,
      title,
      status,
      is_active,
      yellow_panther_fit,
      materialized_at,
      updated_at,
      raw_payload
    from graphiti_materialized_opportunities
    where raw_payload->>'source' = 'entity_dossiers'
      and (
        raw_payload->>'watch_item' = 'true'
        or raw_payload->'commercial_qualification'->>'status' in ('watch', 'context_only', 'no_buying_trigger')
      )
    order by
      coalesce(yellow_panther_fit, 0) desc,
      coalesce(updated_at, materialized_at) desc nulls last
    limit 20
  `)

  return {
    generated_at: new Date().toISOString(),
    source: 'graphiti_dossier_ingestions',
    active_shortlist_count: Number(countsResult.rows[0]?.active_shortlist_count || 0),
    watch_item_count: Number(countsResult.rows[0]?.watch_item_count || 0),
    context_only_count: Number(countsResult.rows[0]?.context_only_count || 0),
    failed_only_count: Number(countsResult.rows[0]?.failed_only_count || 0),
    ingestion: ingestionResult.rows[0] || {
      ingested_dossier_entities: 0,
      ingested_rows: 0,
      skipped_empty_rows: 0,
      failed_rows: 0,
    },
    top_reviewable_watch_items: reviewableResult.rows.map(mapWatchItem),
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireApiSession(request)
    return NextResponse.json(await loadDiagnostics())
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json(
      {
        generated_at: new Date().toISOString(),
        source: 'graphiti_dossier_ingestions',
        active_shortlist_count: 0,
        watch_item_count: 0,
        context_only_count: 0,
        failed_only_count: 0,
        top_reviewable_watch_items: [],
        warnings: [error instanceof Error ? error.message : 'Failed to load opportunity diagnostics'],
      },
      { status: 200 },
    )
  }
}
