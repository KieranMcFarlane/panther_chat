import { NextRequest, NextResponse } from 'next/server'
import { buildHomeQueueDashboardPayload } from '@/lib/home-queue-dashboard'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin
  const payload = await buildHomeQueueDashboardPayload({
    tendersFetcher: async () => {
      try {
        const response = await fetch(
          `${origin}/api/tenders?action=opportunities&limit=6&orderBy=yellow_panther_fit&orderDirection=desc&promoted_only=true`,
          { cache: 'no-store' },
        )
        if (!response.ok) {
          return []
        }
        const json = await response.json()
        return Array.isArray(json?.opportunities) ? json.opportunities : []
      } catch {
        return []
      }
    },
  })

  return NextResponse.json({
    loop_status: payload.loop_status,
    queue: {
      completed_entities: payload.queue.completed_entities,
      in_progress_entity: payload.queue.in_progress_entity,
      upcoming_entities: payload.queue.upcoming_entities,
    },
    client_ready_dossiers: payload.client_ready_dossiers,
    rfp_cards: payload.rfp_cards,
    sales_summary: payload.sales_summary,
  })
}
