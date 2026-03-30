import { v5 as uuidv5 } from 'uuid'

type PublicIdEntity = {
  uuid?: unknown
  entity_uuid?: unknown
  graph_id?: unknown
  neo4j_id?: unknown
  id?: unknown
  supabase_id?: unknown
  properties?: Record<string, unknown> | null
}

const ENTITY_PUBLIC_ID_NAMESPACE = 'f5c2b2b8-9cf2-4e66-a1c2-38cde7bc3f4e'

function toText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function getSourceSeed(entity: PublicIdEntity): string {
  const properties = entity.properties ?? {}
  const candidateValues = [
    entity.uuid,
    entity.entity_uuid,
    properties.uuid,
    properties.entity_uuid,
    entity.supabase_id,
    properties.supabase_id,
    entity.graph_id,
    entity.neo4j_id,
    entity.id,
  ]

  for (const candidate of candidateValues) {
    const text = toText(candidate)
    if (text) return text
  }

  const fallbackName = toText(properties.name)
  const fallbackType = toText(properties.type)
  return [fallbackType, fallbackName].filter(Boolean).join('|') || 'entity'
}

export function resolveEntityUuid(entity: PublicIdEntity | null | undefined): string | null {
  if (!entity) return null

  const existingUuid = toText(entity.uuid) || toText(entity.entity_uuid) || toText(entity.properties?.uuid) || toText(entity.properties?.entity_uuid)
  if (existingUuid) return existingUuid

  return uuidv5(getSourceSeed(entity), ENTITY_PUBLIC_ID_NAMESPACE)
}

export function matchesEntityUuid(entity: PublicIdEntity | null | undefined, candidateUuid: string | null | undefined): boolean {
  const normalizedCandidate = toText(candidateUuid)
  if (!normalizedCandidate || !entity) return false

  const resolvedUuid = resolveEntityUuid(entity)
  if (resolvedUuid && resolvedUuid === normalizedCandidate) return true

  const properties = entity.properties ?? {}
  return [
    entity.uuid,
    entity.entity_uuid,
    properties.uuid,
    properties.entity_uuid,
  ]
    .map(toText)
    .filter(Boolean)
    .some((value) => value === normalizedCandidate)
}

