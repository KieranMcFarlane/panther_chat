import { NextRequest, NextResponse } from 'next/server'

import { getPool } from '@/lib/pg-client'
import { scoreLegacyOpportunityRecovery } from '@/lib/graphiti-legacy-opportunity-recovery'
import { stampTrustedGraphitiQualityEpoch } from '@/lib/graphiti-opportunity-quality-epoch'
import { requireApiSession, UnauthorizedError } from '@/lib/server-auth'
import {
  loadYellowPantherBusinessProfile,
  synthesizeGraphitiOpportunityStrategyBrief,
  validateStrategyBrief,
} from '@/lib/graphiti-opportunity-strategy-synthesis.mjs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item || '').trim()).filter(Boolean)
}

function positiveLimit(value: unknown) {
  const parsed = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(parsed) || parsed < 1) return 25
  return Math.min(parsed, 100)
}

async function loadSelectedLegacyRows({
  dryRun,
  opportunityIds,
  canonicalEntityIds,
  limit,
}: {
  dryRun: boolean
  opportunityIds: string[]
  canonicalEntityIds: string[]
  limit: number
}) {
  if (!dryRun && opportunityIds.length === 0 && canonicalEntityIds.length === 0) {
    throw new Error('apply_requires_selected_opportunity_ids_or_canonical_entity_ids')
  }

  const pool = getPool()
  const clauses = [
    "m.raw_payload->>'source' = 'entity_dossiers'",
    "coalesce(m.raw_payload->>'legacy_untrusted', 'false') = 'true'",
  ]
  const params: unknown[] = []

  if (opportunityIds.length > 0) {
    params.push(opportunityIds)
    clauses.push(`m.opportunity_id::text = any($${params.length}::text[])`)
  }
  if (canonicalEntityIds.length > 0) {
    params.push(canonicalEntityIds)
    clauses.push(`m.canonical_entity_id::text = any($${params.length}::text[])`)
  }

  params.push(limit)
  const result = await pool.query(`
    select
      m.opportunity_id,
      m.entity_id,
      m.entity_name,
      m.canonical_entity_id,
      m.canonical_entity_name,
      m.title,
      m.status,
      m.is_active,
      m.yellow_panther_fit,
      m.materialized_at,
      m.updated_at,
      m.raw_payload || jsonb_build_object(
        'quality_state', i.quality_state,
        'answer_count', i.answer_count,
        'evidence_count', i.evidence_count,
        'quality_metrics', coalesce(i.raw_metadata->'quality_metrics', '{}'::jsonb)
      ) as raw_payload
    from graphiti_materialized_opportunities m
    left join graphiti_dossier_ingestions i
      on i.id::text = m.raw_payload->>'source_ledger_id'
    where ${clauses.join(' and ')}
    order by coalesce(m.updated_at, m.materialized_at) desc nulls last
    limit $${params.length}
  `, params)

  return result.rows
}

export async function POST(request: NextRequest) {
  try {
    await requireApiSession(request)
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const dryRun = body?.dry_run !== false
    const opportunityIds = stringArray(body.opportunity_ids)
    const canonicalEntityIds = stringArray(body.canonical_entity_ids)
    const limit = positiveLimit(body.limit)
    const rows = await loadSelectedLegacyRows({ dryRun, opportunityIds, canonicalEntityIds, limit })
    const yellowPantherProfile = dryRun ? '' : loadYellowPantherBusinessProfile()
    const pool = getPool()
    const results = []

    for (const row of rows) {
      const recovery = scoreLegacyOpportunityRecovery(row)
      const baseResult = {
        opportunity_id: row.opportunity_id,
        canonical_entity_id: row.canonical_entity_id,
        entity_name: row.entity_name || row.canonical_entity_name,
        ...recovery,
      }

      try {
        if (recovery.legacy_recovery_tier !== 'recoverable_legacy') {
          results.push({ ...baseResult, status: 'skipped_not_recoverable' })
          continue
        }

        if (dryRun) {
          results.push({ ...baseResult, status: 'dry_run_recoverable', expected_restamp: true })
          continue
        }

        let synthesized
        try {
          synthesized = await synthesizeGraphitiOpportunityStrategyBrief(row, yellowPantherProfile, {
            modelTimeoutMs: 45_000,
          })
        } catch (strategyError) {
          const rawPayload = asRecord(row.raw_payload)
          const message = strategyError instanceof Error ? strategyError.message : 'failed_strategy_synthesis'
          await pool.query(`
            update graphiti_materialized_opportunities
            set raw_payload = $2::jsonb,
                updated_at = now()
            where opportunity_id = $1
          `, [
            row.opportunity_id,
            JSON.stringify({
              ...rawPayload,
              bd_strategy_status: 'failed_strategy_synthesis',
              bd_strategy_error: message,
              legacy_recovery_status: 'failed_strategy_synthesis',
              legacy_recovery_score: recovery.legacy_recovery_score,
              legacy_recovery_blockers: recovery.legacy_recovery_blockers,
            }),
          ])
          results.push({ ...baseResult, status: 'failed_strategy_synthesis', errors: [message] })
          continue
        }
        const validation = validateStrategyBrief(synthesized.brief)

        if (!synthesized.validation.valid || !validation.valid) {
          const rawPayload = asRecord(row.raw_payload)
          await pool.query(`
            update graphiti_materialized_opportunities
            set raw_payload = $2::jsonb,
                updated_at = now()
            where opportunity_id = $1
          `, [
            row.opportunity_id,
            JSON.stringify({
              ...rawPayload,
              bd_strategy_status: 'failed_quality_gate',
              bd_strategy_error: [...synthesized.validation.reasons, ...validation.reasons].join('; ') || 'failed_strategy_synthesis',
              legacy_recovery_status: 'failed_strategy_synthesis',
              legacy_recovery_score: recovery.legacy_recovery_score,
              legacy_recovery_blockers: recovery.legacy_recovery_blockers,
            }),
          ])
          results.push({ ...baseResult, status: 'failed_quality_gate', errors: [...synthesized.validation.reasons, ...validation.reasons] })
          continue
        }

        const trustedPayload = stampTrustedGraphitiQualityEpoch({
          ...asRecord(row.raw_payload),
          bd_strategy_brief: synthesized.brief,
          bd_strategy_status: 'ready',
          bd_strategy_error: null,
          legacy_recovery_status: 'recovered',
          legacy_recovered_at: new Date().toISOString(),
          legacy_recovery_score: recovery.legacy_recovery_score,
          legacy_recovery_blockers: recovery.legacy_recovery_blockers,
          legacy_untrusted: false,
        })

        await pool.query(`
          update graphiti_materialized_opportunities
          set raw_payload = $2::jsonb,
              updated_at = now()
          where opportunity_id = $1
        `, [row.opportunity_id, JSON.stringify(trustedPayload)])
        results.push({ ...baseResult, status: 'recovered' })
      } catch (rowError) {
        results.push({
          ...baseResult,
          status: 'failed_unexpected',
          errors: [rowError instanceof Error ? rowError.message : 'legacy_reprocess_row_failed'],
        })
        continue
      }
    }

    return NextResponse.json({
      ok: true,
      dry_run: dryRun,
      selected_count: rows.length,
      recoverable_legacy_count: results.filter((item) => item.legacy_recovery_tier === 'recoverable_legacy').length,
      recovered_count: results.filter((item) => item.status === 'recovered').length,
      failed_count: results.filter((item) => String(item.status).startsWith('failed')).length,
      skipped_count: results.filter((item) => String(item.status).startsWith('skipped')).length,
      candidates: results,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    const status = error instanceof Error && error.message === 'apply_requires_selected_opportunity_ids_or_canonical_entity_ids' ? 400 : 500
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'legacy_reprocess_failed' }, { status })
  }
}
