import { NextRequest, NextResponse } from 'next/server'

import { materializeGraphitiInsight, rankGraphitiInsights, buildGraphitiNotificationPayload } from '@/lib/graphiti-insight-materializer'
import { requireApiSession, UnauthorizedError } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-client'

const HOME_INSIGHT_COLUMNS = [
  'insight_id',
  'entity_id',
  'entity_name',
  'entity_type',
  'sport',
  'league',
  'title',
  'summary',
  'why_it_matters',
  'confidence',
  'freshness',
  'evidence',
  'relationships',
  'suggested_action',
  'detected_at',
  'source_run_id',
  'source_signal_id',
  'source_episode_id',
  'source_objective',
  'materialized_at',
  'raw_payload',
].join(', ')

export async function GET(request: NextRequest) {
  try {
    await requireApiSession(request)

    const supabase = getSupabaseAdmin()
    const response = await supabase
      .from('homepage_graphiti_insights')
      .select(HOME_INSIGHT_COLUMNS)
      .order('materialized_at', { ascending: false })
      .limit(25)

    if (response.error) {
      return NextResponse.json({ error: response.error.message }, { status: 500 })
    }

    const rows = Array.isArray(response.data) ? response.data : []
    const notifications = rankGraphitiInsights(rows.map((row) => materializeGraphitiInsight(row))).map((insight) => {
      const notification = buildGraphitiNotificationPayload(insight)
      return {
        ...notification,
        destination_url: notification.destination_url,
      }
    })

    return NextResponse.json({ notifications })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load Graphiti notifications' },
      { status: 500 },
    )
  }
}
