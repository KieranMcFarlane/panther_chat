import { NextRequest, NextResponse } from 'next/server'
import { buildHomeQueueDashboardPayload } from '@/lib/home-queue-dashboard'
import { loadGraphitiOpportunitiesFromDb } from '@/lib/graphiti-opportunity-read-model'

export const dynamic = 'force-dynamic'

function deriveOperationalState(payload: Awaited<ReturnType<typeof buildHomeQueueDashboardPayload>>) {
  const controlRequestedState = payload.control?.requested_state === 'paused' || payload.control?.is_paused
    ? 'paused'
    : 'running'
  const controlObservedState = payload.control?.observed_state || payload.control?.transition_state || null

  if (controlObservedState === 'starting') return 'starting'
  if (controlObservedState === 'stopping') return 'stopping'
  if (controlRequestedState === 'paused') return 'paused'
  if ((payload.loop_status.runtime_counts?.stalled || 0) > 0) return 'stopped'
  if ((payload.loop_status.runtime_counts?.running || 0) > 0) return 'running'
  return 'waiting'
}

function buildQueueDashboardResponse(payload: Awaited<ReturnType<typeof buildHomeQueueDashboardPayload>>) {
  return {
    control: payload.control,
    live_operational: {
      control: payload.control,
      loop_status: {
        ...payload.loop_status,
        processed_dossiers: payload.loop_status.processed_dossiers ?? payload.loop_status.completed,
      },
      queue: {
        completed_entities: payload.queue.completed_entities,
        in_progress_entity: payload.queue.in_progress_entity,
        running_entities: payload.queue.running_entities,
        stale_active_rows: payload.queue.stale_active_rows,
        processed_entities: payload.queue.processed_entities,
        resume_needed_entities: payload.queue.resume_needed_entities,
        upcoming_entities: payload.queue.upcoming_entities,
      },
      operational_state: deriveOperationalState(payload),
      freshness_state: payload.loop_status.health === 'stale' ? 'stale' : 'fresh',
      last_activity_at: payload.loop_status.last_activity_at,
    },
    playlist_sort_key: payload.playlist_sort_key,
    loop_status: {
      ...payload.loop_status,
      processed_dossiers: payload.loop_status.processed_dossiers ?? payload.loop_status.completed,
      runtime_counts: payload.loop_status.runtime_counts,
    },
    queue: {
      completed_entities: payload.queue.completed_entities,
      in_progress_entity: payload.queue.in_progress_entity,
      running_entities: payload.queue.running_entities,
      stale_active_rows: payload.queue.stale_active_rows,
      processed_entities: payload.queue.processed_entities,
      resume_needed_entities: payload.queue.resume_needed_entities,
      upcoming_entities: payload.queue.upcoming_entities,
    },
    client_ready_dossiers: payload.client_ready_dossiers,
    rfp_cards: payload.rfp_cards,
    sales_summary: payload.sales_summary,
    dossier_quality: payload.dossier_quality,
    rollout_proof_set: payload.rollout_proof_set,
  }
}

function buildFallbackQueueDashboardResponse(error: unknown) {
  console.error('[home/queue-dashboard] failed to build payload', error)
  const now = new Date().toISOString()
  const control = {
    is_paused: false,
    pause_reason: null,
    updated_at: now,
    desired_state: 'running' as const,
    requested_state: 'running' as const,
    observed_state: 'paused' as const,
    transition_state: 'paused' as const,
  }
  const loopStatus = {
    universe_count: 0,
    total_scheduled: 0,
    completed: 0,
    processed_dossiers: 0,
    failed: 0,
    retryable_failures: 0,
    client_ready_dossiers: 0,
    promoted_dossiers: 0,
    last_successful_canonical_run_at: null,
    health: 'idle' as const,
    source: 'snapshot' as const,
    last_activity_at: null,
    quality_counts: {
      partial: 0,
      blocked: 0,
      complete: 0,
      client_ready: 0,
    },
    runtime_counts: {
      running: 0,
      queued: 0,
      stalled: 0,
      retryable: 0,
      resume_needed: 0,
    },
  }
  const queue = {
    completed_entities: [],
    in_progress_entity: null,
    running_entities: [],
    stale_active_rows: [],
    processed_entities: [],
    resume_needed_entities: [],
    upcoming_entities: [],
  }

  return {
    error: 'queue_dashboard_unavailable',
    control,
    live_operational: {
      control,
      loop_status: loopStatus,
      queue,
      operational_state: 'waiting' as const,
      freshness_state: 'stale' as const,
      last_activity_at: null,
    },
    playlist_sort_key: [],
    loop_status: loopStatus,
    queue,
    client_ready_dossiers: [],
    rfp_cards: [],
    sales_summary: {
      status: 'empty' as const,
      highlights: [],
    },
    dossier_quality: {
      counts: loopStatus.quality_counts,
      incomplete_entities: [],
    },
    rollout_proof_set: [],
  }
}

export async function GET(_request: NextRequest) {
  try {
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

    return NextResponse.json(buildQueueDashboardResponse(payload))
  } catch (error) {
    return NextResponse.json(buildFallbackQueueDashboardResponse(error), { status: 200 })
  }
}
