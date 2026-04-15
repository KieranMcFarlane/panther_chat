import { NextRequest, NextResponse } from 'next/server'

import { getEntityDossierIndexRecord } from '@/lib/dossier-index'
import { getEntityDossierOpsRecord } from '@/lib/dossier-ops'
import { resolveEntityForDossierQueue } from '@/lib/entity-dossier-queue'
import { loadNormalizedPersistedDossier } from '@/lib/persisted-dossier'
import { requireApiSession, UnauthorizedError } from '@/lib/server-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { entityId: string } },
) {
  try {
    await requireApiSession(request)
    const entity = await resolveEntityForDossierQueue(params.entityId)
    if (!entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 })
    }

    const dossier = await loadNormalizedPersistedDossier(params.entityId, entity)
    const [ops, dossierIndex] = await Promise.all([
      getEntityDossierOpsRecord(params.entityId, dossier),
      getEntityDossierIndexRecord(params.entityId, entity),
    ])

    return NextResponse.json({
      entity_id: params.entityId,
      ops,
      dossier_status: dossierIndex.dossier_status,
      latest_generated_at: dossierIndex.latest_generated_at,
      rerun_reason: dossierIndex.rerun_reason,
      review_status: dossierIndex.review_status,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load dossier operator state' },
      { status: 500 },
    )
  }
}
