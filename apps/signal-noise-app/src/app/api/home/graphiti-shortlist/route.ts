import { NextRequest, NextResponse } from 'next/server'

import { requireApiSession, UnauthorizedError } from '@/lib/server-auth'
import { loadGraphitiMixedShortlist } from '@/lib/graphiti-shortlist'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await requireApiSession(request)
    const response = await loadGraphitiMixedShortlist(6)
    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return NextResponse.json(
      {
        source: 'graphiti_shortlist',
        status: 'empty',
        generated_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
        shortlist: [],
        snapshot: {
          opportunities: 0,
          operational: 0,
          watch_items: 0,
          total: 0,
          freshness_window_hours: 24,
        },
        warnings: [error instanceof Error ? error.message : 'Failed to load Graphiti shortlist'],
      },
      { status: 200 },
    )
  }
}
