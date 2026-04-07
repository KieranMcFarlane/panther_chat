import { NextRequest, NextResponse } from 'next/server'

import { markEntityDossierRerunRequested } from '@/lib/dossier-ops'
import { queueDossierRefresh, resolveEntityForDossierQueue } from '@/lib/entity-dossier-queue'
import { requireOperatorApiSession } from '@/lib/operator-access'
import { resolveCanonicalQuestionFirstDossier } from '@/lib/question-first-dossier'
import { UnauthorizedError } from '@/lib/server-auth'

export async function POST(
  request: NextRequest,
  { params }: { params: { entityId: string } },
) {
  try {
    const session = await requireOperatorApiSession(request)
    const body = await request.json().catch(() => ({}))
    const rerunReason = typeof body?.rerun_reason === 'string' ? body.rerun_reason.trim() : null
    const queued = await queueDossierRefresh(params.entityId, 'entity_dossier_operator_rerun', rerunReason)
    const canonical = await resolveCanonicalQuestionFirstDossier(params.entityId, queued.entity)
    await markEntityDossierRerunRequested(
      params.entityId,
      String(session.user.email || session.user.name || 'operator'),
      rerunReason,
      queued.batchId,
      canonical.dossier,
    )

    return NextResponse.json({
      entity_id: params.entityId,
      job_id: queued.batchId,
      queued_at: queued.queuedAt,
      status: queued.status,
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
