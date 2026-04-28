import { v5 as uuidv5 } from 'uuid'
import entityUuidAliases from './entity-public-id-aliases.js'

type PublicIdEntity = {
  uuid?: unknown
  entity_uuid?: unknown
  canonical_entity_id?: unknown
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
    entity.canonical_entity_id,
    properties.canonical_entity_id,
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

export function resolveEntityUuid(entity: PublicIdEntity | string | null | undefined): string | null {
  if (!entity) return null

  if (typeof entity === 'string') {
    const text = toText(entity)
    if (!text) return null
    const canonicalAlias = entityUuidAliases.resolveCanonicalEntityUuidAlias(text)
    if (canonicalAlias) return canonicalAlias
    if (/^[0-9a-f-]{36}$/i.test(text)) return text
    return uuidv5(text, ENTITY_PUBLIC_ID_NAMESPACE)
  }

  const aliasCandidates = [
    entity.canonical_entity_id,
    entity.properties?.canonical_entity_id,
    entity.uuid,
    entity.entity_uuid,
    entity.properties?.uuid,
    entity.properties?.entity_uuid,
    entity.supabase_id,
    entity.properties?.supabase_id,
    entity.graph_id,
    entity.neo4j_id,
    entity.id,
  ]

  let fallbackSeed: string | null = null
  for (const candidate of aliasCandidates) {
    const text = toText(candidate)
    if (!text) continue

    const canonicalAlias = entityUuidAliases.resolveCanonicalEntityUuidAlias(text)
    if (canonicalAlias) return canonicalAlias

    if (/^[0-9a-f-]{36}$/i.test(text)) return text
    fallbackSeed = fallbackSeed || text
  }

  return uuidv5(fallbackSeed || getSourceSeed(entity), ENTITY_PUBLIC_ID_NAMESPACE)
}

export function matchesEntityUuid(entity: PublicIdEntity | null | undefined, candidateUuid: string | null | undefined): boolean {
  const normalizedCandidate = toText(candidateUuid)
  if (!normalizedCandidate || !entity) return false

  const resolvedUuid = resolveEntityUuid(entity)
  if (resolvedUuid && resolvedUuid === normalizedCandidate) return true

  const properties = entity.properties ?? {}
  return [
    entity.canonical_entity_id,
    properties.canonical_entity_id,
    entity.uuid,
    entity.entity_uuid,
    properties.uuid,
    properties.entity_uuid,
  ]
    .map(toText)
    .filter(Boolean)
    .some((value) => value === normalizedCandidate || entityUuidAliases.resolveCanonicalEntityUuidAlias(value) === normalizedCandidate)
}
