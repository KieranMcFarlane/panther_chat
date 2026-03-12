export interface GraphIdentified {
  id?: string | number | null
  graph_id?: string | number | null
  neo4j_id?: string | number | null
}

export interface RelationshipGraphIdentified {
  source_graph_id?: string | number | null
  target_graph_id?: string | number | null
  source_neo4j_id?: string | number | null
  target_neo4j_id?: string | number | null
}

export function resolveGraphId(value: GraphIdentified | null | undefined): string | null {
  const candidate = value?.graph_id ?? value?.neo4j_id ?? value?.id
  if (candidate === null || candidate === undefined || candidate === '') {
    return null
  }

  return String(candidate)
}

export function withGraphId<T extends GraphIdentified>(value: T): T & { graph_id: string | null } {
  return {
    ...value,
    graph_id: resolveGraphId(value),
  }
}

export function withRelationshipGraphIds<T extends RelationshipGraphIdentified>(
  value: T,
): T & { source_graph_id: string | null; target_graph_id: string | null } {
  return {
    ...value,
    source_graph_id: value.source_graph_id ? String(value.source_graph_id) : value.source_neo4j_id ? String(value.source_neo4j_id) : null,
    target_graph_id: value.target_graph_id ? String(value.target_graph_id) : value.target_neo4j_id ? String(value.target_neo4j_id) : null,
  }
}

export function buildLegacyGraphIdFilter(graphId: string) {
  return `neo4j_id.eq.${graphId}`
}

export function buildLegacyRelationshipGraphFilter(graphId: string) {
  return `source_graph_id.eq.${graphId},target_graph_id.eq.${graphId},source_neo4j_id.eq.${graphId},target_neo4j_id.eq.${graphId}`
}

export function buildGraphEntityLookupFilter(entityId: string) {
  const filters = [`graph_id.eq.${entityId}`, buildLegacyGraphIdFilter(entityId)]

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entityId)) {
    filters.push(`id.eq.${entityId}`)
  }

  return filters.join(',')
}

export function buildAnyGraphEntityLookupFilter(entityIds: string[]) {
  return [...new Set(entityIds.flatMap((entityId) => buildGraphEntityLookupFilter(entityId).split(',')))]
    .join(',')
}
