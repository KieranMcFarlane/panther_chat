import { NextRequest, NextResponse } from 'next/server'
import { existsSync } from 'node:fs'
import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

import { markEntityDossierRerunRequested } from '@/lib/dossier-ops'
import { queueDossierRefresh, resolveEntityForDossierQueue } from '@/lib/entity-dossier-queue'
import { requireOperatorApiSession } from '@/lib/operator-access'
import { loadNormalizedPersistedDossier } from '@/lib/persisted-dossier'
import { UnauthorizedError } from '@/lib/server-auth'

function toText(value: unknown): string {
  return String(value ?? '').trim()
}

async function snapshotRepairSourceDossierPath(sourcePath: string | null, entityId: string): Promise<string | null> {
  const normalizedSourcePath = toText(sourcePath)
  if (!normalizedSourcePath) return null
  const candidates = [
    path.resolve(process.cwd(), normalizedSourcePath),
    path.resolve(process.cwd(), '..', '..', normalizedSourcePath),
  ]
  const source = candidates.find((candidate) => {
    try {
      return existsSync(candidate)
    } catch {
      return false
    }
  })
  if (!source) return normalizedSourcePath
  const snapshotDir = path.join(path.dirname(source), 'repair-source-snapshots')
  await mkdir(snapshotDir, { recursive: true })
  const safeEntityId = toText(entityId).replace(/[^a-zA-Z0-9_-]/g, '_') || 'entity'
  const snapshotPath = path.join(
    snapshotDir,
    `${safeEntityId}_${Date.now()}_repair_source_snapshot.json`,
  )
  await copyFile(source, snapshotPath)
  return snapshotPath
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
    const canonicalDossier = await loadNormalizedPersistedDossier(params.entityId, entity)
    const repairSourceRunPath = toText(canonicalDossier?.question_first_run_path) || null
    const repairSourceDossierPath = toText(canonicalDossier?.question_first_report?.json_report_path) || null

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
    const repairSourceDossierSnapshotPath = mode === 'question'
      ? await snapshotRepairSourceDossierPath(repairSourceDossierPath, params.entityId)
      : repairSourceDossierPath

    const queued = await queueDossierRefresh(params.entityId, 'entity_dossier_operator_rerun', {
      rerunReason,
      mode,
      questionId: questionId || null,
      cascadeDependents,
      repairSourceRunId: toText(canonicalDossier?.run_id || canonicalDossier?.question_first?.run_id) || null,
      repairSourceRunPath,
      repairSourceDossierPath: repairSourceDossierSnapshotPath,
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
