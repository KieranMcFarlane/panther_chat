import { NextResponse } from 'next/server'

import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
import { readLaneSnapshot } from '@/lib/discovery-lanes/lane-status'
import { getEntityPipelineActivitySummary } from '@/lib/entity-import-jobs'
import { buildOperationalSummary } from '@/lib/operational-summary'

// Cache operational summary for 60 seconds
let summaryCache: { data: any; expiresAt: number } | null = null;
const SUMMARY_TTL_MS = 60_000;

async function getEntitiesActive(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('canonical_entities')
      .select('id', { count: 'exact', head: true })

    if (error) throw error
    if (typeof count === 'number') return count
  } catch {
    // fall through to limited scan
  }

  try {
    const { data, error } = await supabase
      .from('canonical_entities')
      .select('id')
      .limit(10000)

    if (error) throw error
    return (data || []).length
  } catch {
    return 0
  }
}

export async function GET() {
  // Return cached summary if still fresh
  if (summaryCache && summaryCache.expiresAt > Date.now()) {
    return NextResponse.json(summaryCache.data);
  }

  const [entitiesActive, pipeline, scoutSnapshot, enrichmentSnapshot] = await Promise.all([
    getEntitiesActive(),
    getEntityPipelineActivitySummary(),
    readLaneSnapshot({ lane: 'scout' }),
    readLaneSnapshot({ lane: 'enrichment' }),
  ])

  const scoutAwaitingFirstArtifact = scoutSnapshot.summary?.state === 'awaiting_first_snapshot'
  const enrichment = {
    isRunning: enrichmentSnapshot.status === 'queued' || enrichmentSnapshot.status === 'running' || enrichmentSnapshot.status === 'active',
    totalProcessed: Number(enrichmentSnapshot.summary?.total_candidates ?? enrichmentSnapshot.summary?.enriched ?? 0),
    totalSuccessful: Number(enrichmentSnapshot.summary?.enriched ?? 0),
    totalFailed: 0,
  }

  const summary = buildOperationalSummary({
    entitiesActive,
    scout: {
      status: scoutSnapshot.status,
      activeRuns:
        !scoutAwaitingFirstArtifact &&
        (scoutSnapshot.status === 'queued' || scoutSnapshot.status === 'running' || scoutSnapshot.status === 'active')
          ? 1
          : 0,
      detail:
        String(scoutSnapshot.summary?.message || '').trim() ||
        (scoutSnapshot.updated_at ? `Last updated ${scoutSnapshot.updated_at}` : 'Scout lane ready'),
    },
    enrichment,
    pipeline,
    updatedAt: new Date().toISOString(),
  })

  const responseData = {
    success: true,
    data: summary,
  }

  summaryCache = { data: responseData, expiresAt: Date.now() + SUMMARY_TTL_MS }

  return NextResponse.json(responseData)
}
