type GraphishEntity = {
  uuid?: unknown
  entity_uuid?: unknown
  graph_id?: unknown
  neo4j_id?: unknown
  id?: unknown
  properties?: Record<string, unknown> | null
}

const toIdString = (value: unknown): string | null => {
  if (value === null || value === undefined) return null
  const asString = String(value).trim()
  return asString.length > 0 ? asString : null
}

export const resolveGraphId = (entity: GraphishEntity | null | undefined): string | null => {
  if (!entity) return null
  return (
    toIdString(entity.uuid) ??
    toIdString(entity.entity_uuid) ??
    toIdString(entity.properties?.uuid) ??
    toIdString(entity.properties?.entity_uuid) ??
    toIdString(entity.graph_id) ??
    toIdString(entity.neo4j_id) ??
    toIdString(entity.id)
  )
}
