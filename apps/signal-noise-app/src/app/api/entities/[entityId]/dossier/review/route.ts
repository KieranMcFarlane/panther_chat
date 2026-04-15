import { NextRequest, NextResponse } from 'next/server'

import { ReviewStatus, updateEntityReviewStatus } from '@/lib/dossier-ops'
import { resolveEntityForDossierQueue } from '@/lib/entity-dossier-queue'
import { loadNormalizedPersistedDossier } from '@/lib/persisted-dossier'
import { requireOperatorApiSession } from '@/lib/operator-access'
import { UnauthorizedError } from '@/lib/server-auth'

const VALID_REVIEW_STATUSES = new Set<ReviewStatus>(['needs_review', 'in_review', 'resolved'])

export async function POST(
  request: NextRequest,
  { params }: { params: { entityId: string } },
) {
  try {
    await requireOperatorApiSession(request)
    const body = await request.json()
    const reviewStatus = String(body?.review_status || '').trim() as ReviewStatus
    const reviewNote = typeof body?.review_note === 'string' ? body.review_note.trim() : null

    if (!VALID_REVIEW_STATUSES.has(reviewStatus)) {
      return NextResponse.json({ error: 'Invalid review_status' }, { status: 400 })
    }

    const entity = await resolveEntityForDossierQueue(params.entityId)
    if (!entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
    }

    const dossier = await loadNormalizedPersistedDossier(params.entityId, entity)
    const ops = await updateEntityReviewStatus(params.entityId, reviewStatus, reviewNote, dossier)

    return NextResponse.json({
      entity_id: params.entityId,
      review_status: ops.review_status,
      review_note: ops.review_note,
      updated_at: ops.updated_at,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update dossier review state' },
      { status: 500 },
    )
  }
}
