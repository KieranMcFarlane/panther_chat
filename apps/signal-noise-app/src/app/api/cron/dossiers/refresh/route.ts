import { NextRequest, NextResponse } from 'next/server'

import { PINNED_CLIENT_SMOKE_SET } from '@/lib/client-smoke-config'
import { requireCronSecret } from '@/lib/cron-auth'
import { getCanonicalEntitiesSnapshot } from '@/lib/canonical-entities-snapshot'
import { getEntityDossierIndexRecord } from '@/lib/dossier-index'
import { queueDossierRefresh } from '@/lib/entity-dossier-queue'
import { resolvePinnedSmokeEntities } from '@/lib/entity-smoke-set'
import { resolveEntityUuid } from '@/lib/entity-public-id'
import { UnauthorizedError } from '@/lib/server-auth'

const DEFAULT_BATCH_SIZE = 20

function isRefreshCandidate(status: string) {
  return ['stale', 'rerun_needed', 'missing'].includes(status)
}

export async function POST(request: NextRequest) {
  try {
    requireCronSecret(request)
    const queued = new Set<string>()
    const stats = {
      processed: 0,
      queued: 0,
      skipped: 0,
      failed: 0,
    }

    const resolvedPinnedSmokeEntities = await resolvePinnedSmokeEntities()

    for (const item of resolvedPinnedSmokeEntities) {
      try {
        await queueDossierRefresh(item.entityId, 'cron_pinned_smoke_refresh')
        queued.add(item.entityId)
        stats.queued += 1
      } catch (error) {
        stats.failed += 1
        console.error('Pinned smoke dossier refresh failed', { entity_id: item.entityId, pinned_entity_uuid: item.definition.entity_uuid, error })
      } finally {
        stats.processed += 1
      }
    }

    const entities = await getCanonicalEntitiesSnapshot()
    for (const entity of entities) {
      if (queued.size >= PINNED_CLIENT_SMOKE_SET.length + DEFAULT_BATCH_SIZE) {
        break
      }

      const entityId = resolveEntityUuid(entity) || String(entity.id)
      if (queued.has(entityId)) {
        continue
      }

      const index = await getEntityDossierIndexRecord(entityId, entity)
      stats.processed += 1

      if (!isRefreshCandidate(index.dossier_status)) {
        stats.skipped += 1
        continue
      }

      try {
        await queueDossierRefresh(entityId, 'cron_due_dossier_refresh', index.rerun_reason)
        queued.add(entityId)
        stats.queued += 1
      } catch (error) {
        stats.failed += 1
        console.error('Scheduled dossier refresh failed', { entity_id: entityId, error })
      }
    }

    console.log('Dossier refresh cron completed', stats)
    return NextResponse.json({ ok: true, stats, queued_entity_ids: Array.from(queued) })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    console.error('Dossier refresh cron failed', { error })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to queue dossier refresh jobs' },
      { status: 500 },
    )
  }
}
