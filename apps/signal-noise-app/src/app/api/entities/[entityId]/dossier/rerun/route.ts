import { NextRequest, NextResponse } from 'next/server'

import { markEntityDossierRerunRequested } from '@/lib/dossier-ops'
import { queueDossierRefresh, resolveEntityForDossierQueue } from '@/lib/entity-dossier-queue'
import { requireOperatorApiSession } from '@/lib/operator-access'
import { resolveCanonicalQuestionFirstDossier } from '@/lib/question-first-dossier'
import { UnauthorizedError } from '@/lib/server-auth'

function toText(value: unknown): string {
  return String(value ?? '').trim()
}

export async function POST(
  request: NextRequest,
  { params }: { params: { entityId: string } },
) {
  try {
    const session = await requireOperatorApiSession(request)
    const body = await request.json().catch(() => ({}))
    const requestedMode = typeof body?.mode === 'string'
      ? body.mode
      : typeof body?.rerun_mode === 'string'
        ? body.rerun_mode
        : null
    const mode = requestedMode === 'question' ? 'question' : 'full'
    if (requestedMode && requestedMode !== mode) {
      return NextResponse.json({ error: 'Invalid rerun mode' }, { status: 400 })
    }
    const questionId = typeof body?.question_id === 'string' ? body.question_id.trim() : ''
    const cascadeDependents = body?.cascade_dependents !== false
    const rerunReason = typeof body?.rerun_reason === 'string' ? body.rerun_reason.trim() : null
    const entity = await resolveEntityForDossierQueue(params.entityId)
    if (!entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
    }
    const canonical = await resolveCanonicalQuestionFirstDossier(params.entityId, entity)
    const canonicalDossier = canonical.dossier && typeof canonical.dossier === 'object' ? canonical.dossier : null
    const repairSourceRunPath = canonical.source === 'question_first_run'
      ? toText(canonical.artifactPath) || null
      : toText(canonicalDossier?.question_first_run_path) || null
    const repairSourceDossierPath = canonical.source === 'question_first_dossier'
      ? toText(canonical.artifactPath) || null
      : toText(canonicalDossier?.question_first_report?.json_report_path) || null

    if (mode === 'question') {
      const questions = Array.isArray(canonicalDossier?.questions) ? canonicalDossier.questions : []
      if (questions.length < 15) {
        return NextResponse.json(
          { error: 'Single-question repair is only available for persisted 15-question dossiers' },
          { status: 400 },
        )
      }
      if (!questionId) {
        return NextResponse.json({ error: 'question_id is required when mode is question' }, { status: 400 })
      }
      const questionExists = questions.some((question) => toText(question?.question_id) === questionId)
      if (!questionExists) {
        return NextResponse.json({ error: `Unknown question_id: ${questionId}` }, { status: 400 })
      }
    }

    const queued = await queueDossierRefresh(params.entityId, 'entity_dossier_operator_rerun', {
      rerunReason,
      mode,
      questionId: questionId || null,
      cascadeDependents,
      repairSourceRunId: toText(canonicalDossier?.run_id || canonicalDossier?.question_first?.run_id) || null,
      repairSourceRunPath,
      repairSourceDossierPath,
    })
    await markEntityDossierRerunRequested(
      params.entityId,
      String(session.user.email || session.user.name || 'operator'),
      rerunReason,
      queued.batchId,
      canonicalDossier,
    )

    return NextResponse.json({
      entity_id: params.entityId,
      job_id: queued.batchId,
      reused_batch: queued.reusedBatch,
      reused_batch_id: queued.reusedBatchId,
      queued_at: queued.queuedAt,
      status: queued.status,
      mode,
      question_id: questionId || null,
      cascade_dependents: mode === 'question' ? cascadeDependents : null,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    if (error instanceof Error && error.message === 'Entity not found') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to queue dossier rerun' },
      { status: 500 },
    )
  }
}
