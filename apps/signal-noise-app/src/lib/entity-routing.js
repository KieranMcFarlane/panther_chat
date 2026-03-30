function toValidId(value) {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  if (!text || text === 'undefined' || text === 'null') return null
  return text
}

export function getEntityPrefetchId(entity) {
  if (!entity) return null
  return (
    toValidId(entity.uuid) ||
    toValidId(entity.entity_uuid) ||
    toValidId(entity.properties?.uuid) ||
    toValidId(entity.properties?.entity_uuid) ||
    toValidId(entity.id) ||
    toValidId(entity.graph_id) ||
    toValidId(entity.neo4j_id) ||
    null
  )
}

export function getEntityBrowserDossierHref(entity, currentPage = '1') {
  const entityId = getEntityPrefetchId(entity)
  if (!entityId) return null

  const page = currentPage || '1'
  return `/entity-browser/${entityId}/dossier?from=${page}`
}
