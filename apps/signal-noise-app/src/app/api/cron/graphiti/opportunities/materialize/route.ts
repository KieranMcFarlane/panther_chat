import { NextRequest, NextResponse } from 'next/server'

import { requireCronSecret } from '@/lib/cron-auth'
import { materializeGraphitiOpportunities } from '@/lib/graphiti-opportunity-persistence'
import { UnauthorizedError } from '@/lib/server-auth'

export async function POST(request: NextRequest) {
  try {
    requireCronSecret(request)
    const result = await materializeGraphitiOpportunities(100)

    return NextResponse.json({
      ok: true,
      stats: result.stats,
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

