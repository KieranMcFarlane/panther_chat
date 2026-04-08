import { getCanonicalEntitiesSnapshot } from "@/lib/canonical-entities-snapshot"
import { PINNED_CLIENT_SMOKE_SET, type ClientSmokeConfigItem } from "@/lib/client-smoke-config"
import { getEntityDossierIndexRecord, type DossierIndexRecord } from "@/lib/dossier-index"
import { resolveEntityUuid } from "@/lib/entity-public-id"

export type EntitySmokeJourneyItem = {
  entityId: string
  name: string
  type: string
  purpose: string
  smokeNote: string
  accountPriority?: number
  dossierStatus: DossierIndexRecord["dossier_status"]
  dossierSummary: string
}

export type ResolvedPinnedSmokeEntity = {
  definition: ClientSmokeConfigItem
  entity: Awaited<ReturnType<typeof getCanonicalEntitiesSnapshot>>[number]
  entityId: string
}

export async function resolvePinnedSmokeEntities(): Promise<ResolvedPinnedSmokeEntity[]> {
  const entities = await getCanonicalEntitiesSnapshot()
  const resolved: ResolvedPinnedSmokeEntity[] = []

  for (const definition of PINNED_CLIENT_SMOKE_SET) {
    const names = new Set([definition.display_name, ...(definition.aliases ?? [])].map((value) => value.trim().toLowerCase()))
    const entity = entities.find((candidate) => {
      const candidateUuid = resolveEntityUuid(candidate)
      const candidateName = String(candidate.properties?.name || '').trim().toLowerCase()
      return candidateUuid === definition.entity_uuid || names.has(candidateName)
    })

    if (!entity) {
      throw new Error(`Pinned smoke entity is missing from the canonical snapshot: ${definition.display_name} (${definition.entity_uuid})`)
    }

    resolved.push({
      definition,
      entity,
      entityId: resolveEntityUuid(entity) || String(entity.id),
    })
  }

  return resolved
}

export async function getEntityBrowserSmokeItems(): Promise<EntitySmokeJourneyItem[]> {
  const resolvedEntities = await resolvePinnedSmokeEntities()
  const smokeItems: EntitySmokeJourneyItem[] = []

  for (const resolved of resolvedEntities) {
    const dossierIndex = await getEntityDossierIndexRecord(resolved.entityId, resolved.entity)
    const isCanonicalQuestionFirst = dossierIndex.dossier_source === 'question_first_dossier'
      || dossierIndex.dossier_source === 'question_first_run'

    if (!isCanonicalQuestionFirst) {
      continue
    }

    smokeItems.push({
      entityId: resolved.entityId,
      name: String(resolved.entity.properties?.name || resolved.definition.display_name),
      type: String(resolved.entity.properties?.type || resolved.entity.labels?.[0] || "Entity"),
      purpose: resolved.definition.purpose,
      smokeNote: resolved.definition.smoke_note,
      accountPriority: resolved.definition.account_priority,
      dossierStatus: dossierIndex.dossier_status,
      dossierSummary: dossierIndex.dossier_summary,
    })
  }

  return smokeItems
}
