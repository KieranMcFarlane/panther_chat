import { NextRequest, NextResponse } from 'next/server'

import { loadGraphitiOpportunitiesFromDb } from '@/lib/graphiti-opportunity-read-model'
import { requireApiSession, UnauthorizedError } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    await requireApiSession(request)
    const result = await loadGraphitiOpportunitiesFromDb(25)

    return NextResponse.json({
      ok: true,
      source: result.source,
      status: result.status,
      generated_at: result.generated_at,
      last_updated_at: result.last_updated_at,
      snapshot: result.snapshot,
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
