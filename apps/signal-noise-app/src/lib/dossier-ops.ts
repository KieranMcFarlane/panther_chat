import { getSupabaseAdmin } from '@/lib/supabase-client'

export type ReviewStatus = 'needs_review' | 'in_review' | 'resolved'

export type EntityDossierOpsRecord = {
  entity_id: string
  review_status: ReviewStatus
  review_note: string | null
  rerun_requested_at: string | null
  rerun_requested_by: string | null
  rerun_reason: string | null
  last_rerun_job_id: string | null
  missing_evidence_summary: string[]
  updated_at: string | null
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item || '').trim()).filter(Boolean)
}

function deriveMissingEvidenceSummary(dossier: Record<string, any> | null | undefined) {
  if (!dossier) {
    return ['No canonical question-first dossier is available yet.']
  }

  const summary = dossier.question_first?.discovery_summary || {}
  const items: string[] = []

  if (!Array.isArray(dossier.question_first?.evidence_items) || dossier.question_first.evidence_items.length === 0) {
    items.push('No promoted evidence items are attached to this dossier yet.')
  }
  if (!Array.isArray(summary.decision_owners) || summary.decision_owners.length === 0) {
    items.push('Decision owners are missing or still unconfirmed.')
  }
  if (!Array.isArray(summary.digital_stack) || summary.digital_stack.length === 0) {
    items.push('Digital stack evidence is incomplete.')
  }
  if (!Array.isArray(summary.timing_procurement_markers) || summary.timing_procurement_markers.length === 0) {
    items.push('Timing and procurement markers are still sparse.')
  }

  return items
}

function defaultOpsRecord(entityId: string, dossier?: Record<string, any> | null): EntityDossierOpsRecord {
  return {
    entity_id: entityId,
    review_status: 'resolved',
    review_note: null,
    rerun_requested_at: null,
    rerun_requested_by: null,
    rerun_reason: null,
    last_rerun_job_id: null,
    missing_evidence_summary: deriveMissingEvidenceSummary(dossier),
    updated_at: null,
  }
}

export async function getEntityDossierOpsRecord(entityId: string, dossier?: Record<string, any> | null) {
  const supabase = getSupabaseAdmin()
  const response = await supabase
    .from('entity_dossier_ops')
    .select('entity_id, review_status, review_note, rerun_requested_at, rerun_requested_by, rerun_reason, last_rerun_job_id, missing_evidence_summary, updated_at')
    .eq('entity_id', entityId)
    .maybeSingle()

  if (response.error) {
    throw new Error(`Failed to load dossier ops record: ${response.error.message}`)
  }

  if (!response.data) {
    return defaultOpsRecord(entityId, dossier)
  }

  return {
    entity_id: String(response.data.entity_id || entityId),
    review_status: (response.data.review_status || 'resolved') as ReviewStatus,
    review_note: response.data.review_note || null,
    rerun_requested_at: response.data.rerun_requested_at || null,
    rerun_requested_by: response.data.rerun_requested_by || null,
    rerun_reason: response.data.rerun_reason || null,
    last_rerun_job_id: response.data.last_rerun_job_id || null,
    missing_evidence_summary: normalizeStringList(response.data.missing_evidence_summary).length > 0
      ? normalizeStringList(response.data.missing_evidence_summary)
      : deriveMissingEvidenceSummary(dossier),
    updated_at: response.data.updated_at || null,
  } satisfies EntityDossierOpsRecord
}

export async function updateEntityReviewStatus(
  entityId: string,
  reviewStatus: ReviewStatus,
  reviewNote: string | null,
  dossier?: Record<string, any> | null,
) {
  const supabase = getSupabaseAdmin()
  const payload = {
    entity_id: entityId,
    review_status: reviewStatus,
    review_note: reviewNote,
    missing_evidence_summary: deriveMissingEvidenceSummary(dossier),
    updated_at: new Date().toISOString(),
  }

  const response = await supabase
    .from('entity_dossier_ops')
    .upsert(payload, { onConflict: 'entity_id' })
    .select('entity_id, review_status, review_note, rerun_requested_at, rerun_requested_by, rerun_reason, last_rerun_job_id, missing_evidence_summary, updated_at')
    .single()

  if (response.error) {
    throw new Error(`Failed to update dossier review state: ${response.error.message}`)
  }

  return getEntityDossierOpsRecord(entityId, dossier)
}

export async function markEntityDossierRerunRequested(
  entityId: string,
  requestedBy: string,
  rerunReason: string | null,
  jobId: string,
  dossier?: Record<string, any> | null,
) {
  const supabase = getSupabaseAdmin()
  const nowIso = new Date().toISOString()
  const payload = {
    entity_id: entityId,
    review_status: 'needs_review',
    rerun_requested_at: nowIso,
    rerun_requested_by: requestedBy,
    rerun_reason: rerunReason || 'Operator requested dossier refresh',
    last_rerun_job_id: jobId,
    missing_evidence_summary: deriveMissingEvidenceSummary(dossier),
    updated_at: nowIso,
  }

  const response = await supabase
    .from('entity_dossier_ops')
    .upsert(payload, { onConflict: 'entity_id' })

  if (response.error) {
    throw new Error(`Failed to persist rerun request: ${response.error.message}`)
  }

  return getEntityDossierOpsRecord(entityId, dossier)
}
