import { NextRequest, NextResponse } from 'next/server'

import { loadGraphitiOpportunitiesFromDb } from '@/lib/graphiti-opportunity-read-model'
import { requireApiSession, UnauthorizedError } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await requireApiSession(request)
    const response = await loadGraphitiOpportunitiesFromDb(100)

    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return NextResponse.json(
      {
        source: 'graphiti_opportunities',
        status: 'empty',
        generated_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
        snapshot: {
          opportunities_scanned: 0,
          opportunities_materialized: 0,
          active_opportunities: 0,
          freshness_window_hours: 24,
        },
        warnings: [error instanceof Error ? error.message : 'Failed to load canonical opportunities'],
      },
      { status: 200 },
    )
  }
}
