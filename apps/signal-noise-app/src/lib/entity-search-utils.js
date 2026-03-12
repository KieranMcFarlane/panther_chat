function toStringSafe(value) {
  if (value === null || value === undefined) return ''
  return String(value)
}

export function normalizeName(value) {
  return toStringSafe(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function fromTypeText(typeText) {
  const t = normalizeName(typeText)
  if (!t) return ''
  if (t.includes('rights holder') || t.includes('media rights')) return 'rights_holder'
  if (t.includes('federation') || t.includes('governing')) return 'federation'
  if (t.includes('league') || t.includes('competition') || t.includes('tournament')) return 'league'
  if (t.includes('team') || t.includes('club') || t.includes('franchise')) return 'team'
  if (t.includes('organisation') || t.includes('organization') || t.includes('org')) return 'organisation'
  return ''
}

export function canonicalEntityType(entity = {}) {
  const labels = Array.isArray(entity.labels) ? entity.labels : []
  const properties = entity.properties || {}
  const rawType = properties.entity_type || properties.type || ''
  const fromType = fromTypeText(rawType)
  if (fromType) return fromType

  const normalizedLabels = labels.map((label) => normalizeName(label))
  if (normalizedLabels.some((label) => label.includes('federation') || label.includes('international federation'))) return 'federation'
  if (normalizedLabels.some((label) => label.includes('league'))) return 'league'
  if (normalizedLabels.some((label) => label.includes('club') || label.includes('team'))) return 'team'
  if (normalizedLabels.some((label) => label.includes('organization') || label.includes('organisation'))) return 'organisation'
  return 'organisation'
}

export function readLeague(properties = {}) {
  return toStringSafe(properties.league || properties.league_name || properties.level).trim()
}

export function lexicalNameScore(query, candidateName) {
  const q = normalizeName(query)
  const c = normalizeName(candidateName)
  if (!q || !c) return 0
  if (q === c) return 100
  if (c.startsWith(q)) return 80
  if (c.includes(q)) return 60

  const qTokens = q.split(' ').filter(Boolean)
  if (qTokens.length > 0) {
    const hits = qTokens.filter((token) => c.includes(token)).length
    if (hits > 0) return Math.round((hits / qTokens.length) * 40)
  }

  return 0
}

export function extractVectorMetadata(result = {}) {
  const metadata = result.metadata || {}
  const nestedProperties = metadata.properties || {}
  const sport = toStringSafe(result.sport || metadata.sport || nestedProperties.sport).trim()
  const league = toStringSafe(result.league || metadata.league || nestedProperties.league || nestedProperties.level).trim()
  const type = canonicalEntityType({
    labels: Array.isArray(metadata.labels) ? metadata.labels : Array.isArray(metadata.original_labels) ? metadata.original_labels : [],
    properties: {
      type: metadata.entity_type || result.type || nestedProperties.type || nestedProperties.entity_type,
      entity_type: nestedProperties.entity_type,
    },
  })

  return { sport, league, type }
}

export function filterByFacets(entity, facets = {}) {
  const properties = entity.properties || {}
  const sport = normalizeName(properties.sport || entity.sport)
  const league = normalizeName(readLeague(properties) || entity.league)
  const type = normalizeName(canonicalEntityType(entity) || entity.type)
  const country = normalizeName(properties.country || entity.country)

  if (facets.sport && normalizeName(facets.sport) !== sport) return false
  if (facets.league && normalizeName(facets.league) !== league) return false
  if (facets.entityType && normalizeName(facets.entityType) !== type) return false
  if (facets.country && normalizeName(facets.country) !== country) return false
  return true
}

export function buildEntitySearchText(entity = {}) {
  const properties = entity.properties || {}
  const aliases = Array.isArray(properties.aliases)
    ? properties.aliases
    : toStringSafe(properties.aliases)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)

  return [
    toStringSafe(properties.name || entity.name),
    toStringSafe(properties.description || entity.description),
    toStringSafe(properties.sport || entity.sport),
    toStringSafe(readLeague(properties) || entity.league),
    toStringSafe(properties.country || entity.country),
    toStringSafe(canonicalEntityType(entity) || entity.type),
    ...aliases,
  ]
    .filter(Boolean)
    .join(' ')
}

export function computeHybridScore({ query, name, vectorSimilarity = 0, facets = {}, candidate = {} }) {
  const lexical = lexicalNameScore(query, name)
  const entity = {
    ...candidate,
    properties: candidate.properties || {},
  }

  const facetBoost = (() => {
    let score = 0
    const canonical = canonicalEntityType(entity)
    const sport = normalizeName(entity.properties.sport || entity.sport)
    const league = normalizeName(readLeague(entity.properties) || entity.league)
    const country = normalizeName(entity.properties.country || entity.country)

    if (facets.sport && normalizeName(facets.sport) === sport) score += 20
    if (facets.entityType && normalizeName(facets.entityType) === normalizeName(canonical)) score += 20
    if (facets.league && normalizeName(facets.league) === league) score += 30
    if (facets.country && normalizeName(facets.country) === country) score += 10
    return score
  })()

  const vectorScore = Math.max(0, Math.min(1, Number(vectorSimilarity) || 0)) * 30
  return lexical + facetBoost + vectorScore
}
