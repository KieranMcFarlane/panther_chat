type GraphishEntity = {
  graph_id?: unknown
  neo4j_id?: unknown
  id?: unknown
}

const toIdString = (value: unknown): string | null => {
  if (value === null || value === undefined) return null
  const asString = String(value).trim()
  return asString.length > 0 ? asString : null
}

export const resolveGraphId = (entity: GraphishEntity | null | undefined): string | null => {
  if (!entity) return null
  return toIdString(entity.graph_id) ?? toIdString(entity.neo4j_id) ?? toIdString(entity.id)
}
