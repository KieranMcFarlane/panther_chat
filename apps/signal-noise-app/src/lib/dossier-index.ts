import { getEntityDossierOpsRecord } from '@/lib/dossier-ops'
import { loadNormalizedPersistedDossier } from '@/lib/persisted-dossier'
import { getDossierStaleWindowDays } from '@/lib/runtime-env'

type EntityLike = {
  id?: unknown
  uuid?: unknown
  neo4j_id?: unknown
  properties?: Record<string, any> | null
}

export type DossierStatus = 'ready' | 'stale' | 'pending' | 'rerun_needed' | 'missing'

export interface EntityDossierIndexRecord {
  dossier_status: DossierStatus
  latest_run_id: string | null
  latest_generated_at: string | null
  latest_dossier_path: string | null
  dossier_source: 'entity_dossiers' | 'entity_state' | 'missing'
  dossier_summary: string | null
  review_status: 'needs_review' | 'in_review' | 'resolved'
  rerun_reason: string | null
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function getGeneratedAt(dossier: Record<string, any> | null | undefined): string | null {
  if (!dossier) return null
  return (
    toText(dossier.metadata?.question_first?.generated_at) ||
    toText(dossier.question_first?.generated_at) ||
    toText(dossier.metadata?.generated_at) ||
    toText(dossier.metadata?.generated_date) ||
    null
  )
}

function isStale(generatedAt: string | null): boolean {
  if (!generatedAt) return false
  const timestamp = Date.parse(generatedAt)
  if (!Number.isFinite(timestamp)) return false
  const staleWindowMs = getDossierStaleWindowDays() * 24 * 60 * 60 * 1000
  return Date.now() - timestamp > staleWindowMs
}

function getClientReadyInfo(dossier: Record<string, any> | null | undefined): {
  clientReady: boolean
  blockers: string[]
} {
  const discoverySummary = dossier?.question_first?.discovery_summary
  const blockers = Array.isArray(discoverySummary?.client_ready_blockers)
    ? discoverySummary.client_ready_blockers
        .map((value: unknown) => toText(value))
        .filter(Boolean)
    : []
  return {
    clientReady: discoverySummary?.client_ready === true,
    blockers,
  }
}

function buildSummary(dossier: Record<string, any> | null | undefined, status: DossierStatus): string | null {
  if (status === 'pending') return 'Pipeline run queued or entity shell only'
  if (status === 'missing') return 'No dossier artifact found yet'
  const { blockers } = getClientReadyInfo(dossier)
  if (status === 'rerun_needed' && blockers.length > 0) {
    return `Client-ready gate blocked: ${blockers.join(', ')}`
  }
  const discoverySummary = dossier?.question_first?.discovery_summary
  if (Array.isArray(discoverySummary?.opportunity_signals) && discoverySummary.opportunity_signals[0]?.answer) {
    return String(discoverySummary.opportunity_signals[0].answer)
  }
  if (Array.isArray(dossier?.answers) && dossier.answers[0]?.answer) {
    return String(dossier.answers[0].answer)
  }
  return status === 'rerun_needed' ? 'Dossier available but needs refresh' : 'Dossier ready'
}

export async function getEntityDossierIndexRecord(
  entityId: string,
  entity?: EntityLike | null,
): Promise<EntityDossierIndexRecord> {
  const dossier = await loadNormalizedPersistedDossier(entityId, entity)
  const opsRecord = await getEntityDossierOpsRecord(entityId, dossier)
  const enrichmentStatus = toText(entity?.properties?.enrichment_status).toLowerCase()
  const shouldForceRerun = Boolean(opsRecord.rerun_reason)
    || ['failed', 'incomplete', 'missing'].includes(enrichmentStatus)

  if (dossier) {
    const generatedAt = getGeneratedAt(dossier)
    const stale = isStale(generatedAt)
    const { clientReady } = getClientReadyInfo(dossier)
    const dossierStatus: DossierStatus = (!clientReady || shouldForceRerun) ? 'rerun_needed' : (stale ? 'stale' : 'ready')
    return {
      dossier_status: dossierStatus,
      latest_run_id: toText(dossier.run_rollup?.run_id) || toText(entity?.properties?.last_pipeline_batch_id) || null,
      latest_generated_at: generatedAt,
      latest_dossier_path: null,
      dossier_source: 'entity_dossiers',
      dossier_summary: buildSummary(dossier, dossierStatus),
      review_status: opsRecord.review_status,
      rerun_reason: opsRecord.rerun_reason,
    }
  }

  const pipelineStatus = toText(entity?.properties?.last_pipeline_status).toLowerCase()
  if (['queued', 'running', 'pending'].includes(pipelineStatus)) {
    return {
      dossier_status: 'pending',
      latest_run_id: toText(entity?.properties?.last_pipeline_batch_id) || null,
      latest_generated_at: null,
      latest_dossier_path: null,
      dossier_source: 'entity_state',
      dossier_summary: buildSummary(null, 'pending'),
      review_status: opsRecord.review_status,
      rerun_reason: opsRecord.rerun_reason,
    }
  }

  return {
    dossier_status: 'missing',
    latest_run_id: toText(entity?.properties?.last_pipeline_batch_id) || null,
    latest_generated_at: null,
    latest_dossier_path: null,
    dossier_source: 'missing',
    dossier_summary: buildSummary(null, 'missing'),
    review_status: opsRecord.review_status,
    rerun_reason: opsRecord.rerun_reason,
  }
}
