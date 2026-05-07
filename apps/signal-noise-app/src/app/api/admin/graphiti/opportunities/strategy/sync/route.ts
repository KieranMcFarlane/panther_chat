import { NextRequest, NextResponse } from 'next/server'
import { synthesizeAndPersistGraphitiOpportunityStrategyBriefs } from '@/lib/graphiti-opportunity-strategy-synthesis.mjs'
import { requireApiSession, UnauthorizedError } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    await requireApiSession(request)
    const body = await request.json().catch(() => ({}))
    const limit = Number(body?.limit || body?.strategy_limit || 25)
    const concurrency = Number(body?.concurrency || 2)
    const modelTimeoutMs = Number(body?.model_timeout_ms || body?.modelTimeoutMs || 30000)
    const dryRun = body?.dry_run === true || body?.dryRun === true

    const result = await synthesizeAndPersistGraphitiOpportunityStrategyBriefs({
      supabase: getSupabaseAdmin(),
      limit: Number.isFinite(limit) && limit >= 0 ? limit : 25,
      concurrency: Number.isFinite(concurrency) && concurrency > 0 ? concurrency : 2,
      modelTimeoutMs: Number.isFinite(modelTimeoutMs) && modelTimeoutMs > 0 ? modelTimeoutMs : 30000,
      dryRun,
    })

    return NextResponse.json({
      ok: true,
      dry_run: dryRun,
      model_timeout_ms: Number.isFinite(modelTimeoutMs) && modelTimeoutMs > 0 ? modelTimeoutMs : 30000,
      strategy_synthesis: result,
      last_updated_at: new Date().toISOString(),
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to synthesize Graphiti opportunity strategy briefs' },
      { status: 500 },
    )
  }
}
