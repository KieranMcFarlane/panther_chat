import { NextRequest, NextResponse } from 'next/server'
import { buildHomeQueueDashboardPayload } from '@/lib/home-queue-dashboard'
import { loadGraphitiOpportunitiesFromDb } from '@/lib/graphiti-opportunity-read-model'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest) {
  const payload = await buildHomeQueueDashboardPayload({
    includeRfpCards: true,
    opportunitiesFetcher: async () => {
      const response = await loadGraphitiOpportunitiesFromDb(6)
      return response.opportunities.map((opportunity) => ({
        id: opportunity.id,
        title: opportunity.title,
        organization: opportunity.organization,
        description: opportunity.description,
        yellow_panther_fit: opportunity.yellow_panther_fit,
        category: opportunity.category,
        deadline: opportunity.deadline,
        source_url: opportunity.source_url,
        entity_id: opportunity.entity_id,
        entity_name: opportunity.entity_name,
      }))
    },
  })

  return NextResponse.json({
    playlist_sort_key: payload.playlist_sort_key,
    loop_status: {
      ...payload.loop_status,
      runtime_counts: payload.loop_status.runtime_counts,
    },
    queue: {
      completed_entities: payload.queue.completed_entities,
      in_progress_entity: payload.queue.in_progress_entity,
      running_entities: payload.queue.running_entities,
      stale_active_rows: payload.queue.stale_active_rows,
      resume_needed_entities: payload.queue.resume_needed_entities,
      upcoming_entities: payload.queue.upcoming_entities,
    },
    client_ready_dossiers: payload.client_ready_dossiers,
    rfp_cards: payload.rfp_cards,
    sales_summary: payload.sales_summary,
    dossier_quality: payload.dossier_quality,
    rollout_proof_set: payload.rollout_proof_set,
  })
}
