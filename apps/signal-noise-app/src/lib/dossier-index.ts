import { normalizeQuestionFirstDossier, resolveCanonicalQuestionFirstDossier } from '@/lib/question-first-dossier'
import { getEntityDossierOpsRecord } from '@/lib/dossier-ops'
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
  dossier_source: 'question_first_dossier' | 'question_first_run' | 'legacy_dossier' | 'entity_state' | 'missing'
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

function buildSummary(dossier: Record<string, any> | null | undefined, status: DossierStatus): string | null {
  if (status === 'pending') return 'Pipeline run queued or entity shell only'
  if (status === 'missing') return 'No dossier artifact found yet'
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
  const canonical = await resolveCanonicalQuestionFirstDossier(entityId, entity)
  const opsRecord = await getEntityDossierOpsRecord(entityId, canonical.dossier)
  const enrichmentStatus = toText(entity?.properties?.enrichment_status).toLowerCase()
  const shouldForceRerun = Boolean(opsRecord.rerun_reason)
    || ['failed', 'incomplete', 'missing'].includes(enrichmentStatus)

  if (canonical.dossier) {
    const generatedAt = getGeneratedAt(canonical.dossier)
    const stale = isStale(generatedAt)
    const dossier = normalizeQuestionFirstDossier(canonical.dossier, entityId, entity)
    const dossierStatus: DossierStatus = shouldForceRerun ? 'rerun_needed' : (stale ? 'stale' : 'ready')
    return {
      dossier_status: dossierStatus,
      latest_run_id: toText(dossier.run_rollup?.run_id) || toText(entity?.properties?.last_pipeline_batch_id) || null,
      latest_generated_at: generatedAt,
      latest_dossier_path: canonical.artifactPath,
      dossier_source: canonical.source,
      dossier_summary: buildSummary(dossier, dossierStatus),
      review_status: opsRecord.review_status,
      rerun_reason: opsRecord.rerun_reason,
    }
  }

  if (entity?.properties?.dossier_data) {
    try {
      const dossier = normalizeQuestionFirstDossier(JSON.parse(String(entity.properties.dossier_data)), entityId, entity)
      const generatedAt = getGeneratedAt(dossier)
      const stale = isStale(generatedAt)
      return {
        dossier_status: shouldForceRerun ? 'rerun_needed' : (stale ? 'stale' : 'ready'),
        latest_run_id: toText(dossier.run_rollup?.run_id) || toText(entity?.properties?.last_pipeline_batch_id) || null,
        latest_generated_at: generatedAt,
        latest_dossier_path: null,
        dossier_source: 'legacy_dossier',
        dossier_summary: buildSummary(dossier, shouldForceRerun ? 'rerun_needed' : (stale ? 'stale' : 'ready')),
        review_status: opsRecord.review_status,
        rerun_reason: opsRecord.rerun_reason,
      }
    } catch {
      // ignore invalid legacy payloads
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
