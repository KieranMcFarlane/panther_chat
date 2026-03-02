export function getEntityPrefetchId(entity) {
  if (!entity) return null
  return entity.id?.toString() || entity.neo4j_id?.toString() || null
}

export function getEntityBrowserDossierHref(entity, currentPage = '1') {
  const entityId = getEntityPrefetchId(entity)
  if (!entityId) return null

  const page = currentPage || '1'
  return `/entity-browser/${entityId}/dossier?from=${page}`
}
