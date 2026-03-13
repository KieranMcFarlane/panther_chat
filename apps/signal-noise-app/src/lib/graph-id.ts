export type GraphIdentity = {
  id?: string | number | null
  graph_id?: string | number | null
  neo4j_id?: string | number | null
  source_graph_id?: string | number | null
  target_graph_id?: string | number | null
  source_neo4j_id?: string | number | null
  target_neo4j_id?: string | number | null
  source_element_id?: string | number | null
  target_element_id?: string | number | null
  properties?: Record<string, unknown> | null
}

function toCleanString(value: unknown): string {
  return String(value ?? '').trim()
}

function safeEqValue(value: string): string {
  // PostgREST OR filters are comma-delimited; strip commas to avoid malformed filters.
  return value.replace(/,/g, ' ')
}

export function resolveGraphId(entity: GraphIdentity | null | undefined): string {
  if (!entity) return ''

  const props = (entity.properties || {}) as Record<string, unknown>
  const candidates = [
    entity.graph_id,
    entity.neo4j_id,
    props.graph_id,
    props.neo4j_id,
    props.entity_id,
    props.id,
    entity.id,
  ]

  for (const candidate of candidates) {
    const normalized = toCleanString(candidate)
    if (normalized) return normalized
  }

  return ''
}

export function withGraphId<T extends GraphIdentity>(entity: T): T & { graph_id: string } {
  const graphId = resolveGraphId(entity)
  return {
    ...entity,
    graph_id: graphId,
  }
}

export function buildGraphEntityLookupFilter(entityId: string): string {
  const id = safeEqValue(toCleanString(entityId))
  if (!id) return 'id.is.null'

  return [
    `id.eq.${id}`,
    `graph_id.eq.${id}`,
    `neo4j_id.eq.${id}`,
    `properties->>graph_id.eq.${id}`,
    `properties->>neo4j_id.eq.${id}`,
    `properties->>entity_id.eq.${id}`,
    `properties->>id.eq.${id}`,
  ].join(',')
}

export function buildLegacyRelationshipGraphFilter(graphId: string): string {
  const id = safeEqValue(toCleanString(graphId))
  if (!id) return 'source_graph_id.is.null'

  return [
    `source_graph_id.eq.${id}`,
    `target_graph_id.eq.${id}`,
    `source_neo4j_id.eq.${id}`,
    `target_neo4j_id.eq.${id}`,
  ].join(',')
}

export function withRelationshipGraphIds<T extends GraphIdentity>(relationship: T): T & {
  source_graph_id: string
  target_graph_id: string
} {
  const sourceGraphId =
    toCleanString(relationship.source_graph_id) ||
    toCleanString(relationship.source_neo4j_id) ||
    toCleanString(relationship.source_element_id)

  const targetGraphId =
    toCleanString(relationship.target_graph_id) ||
    toCleanString(relationship.target_neo4j_id) ||
    toCleanString(relationship.target_element_id)

  return {
    ...relationship,
    source_graph_id: sourceGraphId,
    target_graph_id: targetGraphId,
  }
}
