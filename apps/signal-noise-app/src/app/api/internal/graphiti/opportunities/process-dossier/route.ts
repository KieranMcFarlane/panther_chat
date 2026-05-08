import { NextRequest, NextResponse } from 'next/server'

import { requireCronSecret } from '@/lib/cron-auth'
import { backfillGraphitiDossierIngestions } from '@/lib/graphiti-dossier-ingestion'
import { syncGraphitiDossierIngestionMemory } from '@/lib/graphiti-dossier-memory-bridge'
import {
  resolveGraphitiOpportunityPipelineResilienceConfig,
  runGraphitiOpportunityPipelineStep,
  summarizeGraphitiOpportunityPipeline,
  type GraphitiOpportunityPipelineStep,
} from '@/lib/graphiti-opportunity-pipeline-resilience'
import { materializeGraphitiOpportunities } from '@/lib/graphiti-opportunity-persistence'
import { synthesizeAndPersistGraphitiOpportunityStrategyBriefs } from '@/lib/graphiti-opportunity-strategy-synthesis.mjs'
import { loadGraphitiRuntimeHealth } from '@/lib/graphiti-runtime-health.mjs'
import { UnauthorizedError } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const POST_DOSSIER_LIMIT = 25
const POST_DOSSIER_STRATEGY_LIMIT = 5
const POST_DOSSIER_MODEL_TIMEOUT_MS = 60000

function toText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

export async function POST(request: NextRequest) {
  try {
    requireCronSecret(request)
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const canonicalEntityId = toText(body.canonical_entity_id)
    const dossierId = toText(body.dossier_id)
    const source = toText(body.source) || 'pipeline_dossier_completed'

    if (source !== 'pipeline_dossier_completed') {
      return NextResponse.json(
        { error: 'source must be pipeline_dossier_completed' },
        { status: 400 },
      )
    }

    if (!canonicalEntityId) {
      return NextResponse.json(
        { error: 'canonical_entity_id is required' },
        { status: 400 },
      )
    }

    const graphitiRuntimeHealth = await loadGraphitiRuntimeHealth()
    const resilience = resolveGraphitiOpportunityPipelineResilienceConfig()
    const steps: GraphitiOpportunityPipelineStep[] = []

    const dossierIngestion = await runGraphitiOpportunityPipelineStep(
      {
        name: 'dossier_ingestion',
        critical: true,
        retryAttempts: 1,
        timeoutMs: resilience.stepTimeoutMs,
      },
      () => backfillGraphitiDossierIngestions({
        limit: POST_DOSSIER_LIMIT,
        dryRun: false,
        canonicalEntityId,
        dossierId,
      }),
    )
    steps.push(dossierIngestion)

    const graphitiMemorySync = await runGraphitiOpportunityPipelineStep(
      {
        name: 'graphiti_memory_sync',
        critical: false,
        retryAttempts: resilience.retryAttempts,
        timeoutMs: resilience.stepTimeoutMs,
      },
      () => syncGraphitiDossierIngestionMemory({
        limit: POST_DOSSIER_LIMIT,
        dryRun: false,
        concurrency: 1,
        canonicalEntityId,
      }),
    )
    steps.push(graphitiMemorySync)

    const result = await runGraphitiOpportunityPipelineStep(
      {
        name: 'opportunity_materialization',
        critical: true,
        retryAttempts: resilience.retryAttempts,
        timeoutMs: resilience.stepTimeoutMs,
      },
      () => materializeGraphitiOpportunities({
        limit: POST_DOSSIER_LIMIT,
        canonicalEntityId,
        deactivateUnseen: false,
      }),
    )
    steps.push(result)

    const strategySynthesis = await runGraphitiOpportunityPipelineStep(
      {
        name: 'strategy_synthesis',
        critical: false,
        retryAttempts: resilience.retryAttempts,
        timeoutMs: resilience.stepTimeoutMs,
      },
      () => synthesizeAndPersistGraphitiOpportunityStrategyBriefs({
        supabase: getSupabaseAdmin(),
        limit: POST_DOSSIER_STRATEGY_LIMIT,
        dryRun: false,
        concurrency: 1,
        modelTimeoutMs: POST_DOSSIER_MODEL_TIMEOUT_MS,
        canonicalEntityId,
      }),
    )
    steps.push(strategySynthesis)

    const summary = summarizeGraphitiOpportunityPipeline(steps)
    const materializationResult = result.ok ? result.result : null
    const materializationWarnings = materializationResult?.warnings ?? []
    const graphitiMemoryWarnings = graphitiMemorySync.ok ? graphitiMemorySync.result?.warnings ?? [] : []
    const warnings = [...materializationWarnings, ...graphitiMemoryWarnings, ...summary.warnings]

    return NextResponse.json(
      {
        ok: summary.ok,
        source: 'pipeline_dossier_completed',
        canonical_entity_id: canonicalEntityId || null,
        dossier_id: dossierId || null,
        pipeline_status: summary.status,
        degraded: summary.degraded,
        pipeline_steps: steps,
        dossier_ingestion: dossierIngestion.ok ? dossierIngestion.result?.stats : null,
        graphiti_memory_sync: graphitiMemorySync.ok ? graphitiMemorySync.result : null,
        graphiti_runtime_health: graphitiRuntimeHealth,
        falkordb_graph_available: graphitiRuntimeHealth.falkordb_graph_available,
        graphiti_mcp_available: graphitiRuntimeHealth.graphiti_mcp_available,
        graphiti_runtime_mode: graphitiRuntimeHealth.graphiti_runtime_mode,
        graphiti_degraded_reason: graphitiRuntimeHealth.graphiti_degraded_reason,
        next_recovery_action: graphitiRuntimeHealth.next_recovery_action,
        stats: materializationResult?.stats ?? null,
        strategy_synthesis: strategySynthesis.ok ? strategySynthesis.result : null,
        warnings,
        last_updated_at: materializationResult?.lastUpdatedAt ?? new Date().toISOString(),
      },
      { status: summary.ok ? 200 : 500 },
    )
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process dossier opportunity trigger' },
      { status: 500 },
    )
  }
}
