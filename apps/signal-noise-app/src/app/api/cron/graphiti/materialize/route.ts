import { NextRequest, NextResponse } from 'next/server'

import { requireCronSecret } from '@/lib/cron-auth'
import { materializeGraphitiInsights } from '@/lib/graphiti-persistence'
import { UnauthorizedError } from '@/lib/server-auth'

export async function POST(request: NextRequest) {
  try {
    requireCronSecret(request)
    const result = await materializeGraphitiInsights(100)

    console.log('Graphiti materialization cron completed', result.stats)

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

    console.error('Graphiti materialization cron failed', { error })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to materialize Graphiti insights' },
      { status: 500 },
    )
  }
}
