const STOP_TOKENS = new Set([
  'fc',
  'cf',
  'club',
  'team',
  'json',
  'seed',
  'jsonseed',
  'the',
])

const SPORT_TOKENS = new Set([
  'football',
  'soccer',
  'basketball',
  'baseball',
  'cricket',
  'tennis',
  'rugby',
  'hockey',
  'handball',
  'volleyball',
  'cycling',
  'athletics',
  'equestrian',
  'motorsport',
  'formula',
  'golf',
  'f1',
])

function normalizeText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function stripDiacritics(value) {
  return normalizeText(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
}

function normalizeType(type) {
  const normalized = normalizeText(type).toLowerCase()

  if (!normalized) return 'Entity'
  if (normalized.includes('club') || normalized.includes('team')) return 'Club'
  if (normalized.includes('sports entity') || normalized.includes('sport entity') || normalized.includes('sport club')) return 'Club'
  if (normalized.includes('league')) return 'League'
  if (normalized.includes('federation')) return 'Federation'
  if (normalized.includes('organization')) return 'Organization'
  if (normalized.includes('tournament')) return 'Tournament'
  if (normalized.includes('competition')) return 'Competition'
  if (normalized.includes('person')) return 'Person'

  return normalizeText(type) || 'Entity'
}

function normalizeSport(value) {
  return normalizeText(value) || 'Unknown Sport'
}

function normalizeCountry(value) {
  return normalizeText(value) || 'Unknown Country'
}

function normalizeNameForKey(name, type) {
  const normalizedType = normalizeType(type)
  const stripSportTokens = normalizedType === 'Club' || normalizedType === 'Team' || normalizedType === 'League' || normalizedType === 'Competition'
  const normalized = stripDiacritics(
    normalizeText(name)
      .toLowerCase()
      .replace(/\((json[_\s-]*seed|seed)\)/gi, ' ')
      .replace(/&/g, ' and ')
  )

  return normalized
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter((token) => !STOP_TOKENS.has(token))
    .filter((token) => !(stripSportTokens && SPORT_TOKENS.has(token)))
    .map((token) => {
      if (!/[a-z]/.test(token) || token.length <= 3) {
        return token
      }

      return token[0] + token.slice(1).replace(/[aeiou]/g, '')
    })
    .join(' ')
}

function canonicalEntityKeyFromRow(row) {
  const properties = row?.properties || {}
  return [
    normalizeType(properties.type),
    normalizeSport(properties.sport),
    normalizeCountry(properties.country),
    normalizeNameForKey(properties.name, properties.type),
  ].join('|')
}

function canonicalEntityKeyFromCanonicalRow(row) {
  if (row?.canonical_key) return normalizeText(row.canonical_key).toLowerCase()
  return canonicalEntityKeyFromRow({
    properties: {
      name: row?.name,
      type: row?.entity_type,
      sport: row?.sport,
      country: row?.country,
    },
  })
}

function scoreRawRow(row) {
  const properties = row?.properties || {}
  let score = 0

  if (normalizeText(properties.name)) score += 10
  if (normalizeType(properties.type) !== 'Entity') score += 12
  if (normalizeSport(properties.sport) !== 'Unknown Sport') score += 10
  if (normalizeCountry(properties.country) !== 'Unknown Country') score += 10
  if (normalizeText(properties.league)) score += 40
  if (normalizeText(properties.level)) score += 20
  if (row?.badge_path || row?.badge_s3_url || properties.badge_path || properties.badge_s3_url) score += 8
  if ((row?.labels || []).length > 0) score += 4
  if (/\(json[_\s-]*seed|seed\)/i.test(normalizeText(properties.name))) score -= 30
  if (!normalizeText(properties.sport)) score -= 10
  if (!normalizeText(properties.country)) score -= 10
  if (/^[0-9]+$/.test(normalizeText(properties.level))) score -= 5

  return score
}

export function buildCachedEntityCanonicalLookup(canonicalEntities = []) {
  const byCanonicalId = new Map()
  const byCanonicalKey = new Map()
  const bySourceEntityId = new Map()
  const bySourceGraphId = new Map()
  const bySourceNeo4jId = new Map()

  for (const canonicalEntity of canonicalEntities) {
    if (!canonicalEntity || !canonicalEntity.id) continue

    const canonicalId = String(canonicalEntity.id)
    const canonicalKey = canonicalEntityKeyFromCanonicalRow(canonicalEntity)

    byCanonicalId.set(canonicalId, canonicalEntity)
    if (canonicalKey) {
      byCanonicalKey.set(canonicalKey, canonicalEntity)
    }

    for (const sourceEntityId of canonicalEntity.source_entity_ids || []) {
      if (normalizeText(sourceEntityId)) bySourceEntityId.set(normalizeText(sourceEntityId), canonicalEntity)
    }

    for (const sourceGraphId of canonicalEntity.source_graph_ids || []) {
      if (normalizeText(sourceGraphId)) bySourceGraphId.set(normalizeText(sourceGraphId), canonicalEntity)
    }

    for (const sourceNeo4jId of canonicalEntity.source_neo4j_ids || []) {
      if (normalizeText(sourceNeo4jId)) bySourceNeo4jId.set(normalizeText(sourceNeo4jId), canonicalEntity)
    }
  }

  return {
    byCanonicalId,
    byCanonicalKey,
    bySourceEntityId,
    bySourceGraphId,
    bySourceNeo4jId,
  }
}

export function resolveCanonicalEntityForRawRow(rawRow, canonicalLookup) {
  if (!rawRow) return null

  const directCanonicalId = normalizeText(rawRow.canonical_entity_id || rawRow.properties?.canonical_entity_id)
  if (directCanonicalId && canonicalLookup.byCanonicalId.has(directCanonicalId)) {
    return canonicalLookup.byCanonicalId.get(directCanonicalId)
  }

  const candidateIds = [
    rawRow.graph_id,
    rawRow.neo4j_id,
    rawRow.id,
    rawRow.properties?.supabase_id,
    rawRow.properties?.uuid,
  ].map(normalizeText).filter(Boolean)

  for (const candidateId of candidateIds) {
    const canonicalEntity =
      canonicalLookup.bySourceNeo4jId.get(candidateId) ||
      canonicalLookup.bySourceGraphId.get(candidateId) ||
      canonicalLookup.bySourceEntityId.get(candidateId)

    if (canonicalEntity) {
      return canonicalEntity
    }
  }

  const canonicalKey = canonicalEntityKeyFromRow(rawRow)
  if (canonicalKey && canonicalLookup.byCanonicalKey.has(canonicalKey)) {
    return canonicalLookup.byCanonicalKey.get(canonicalKey)
  }

  return null
}

export function dedupeCanonicalCachedEntityRows(rawRows = [], canonicalLookup) {
  const groups = new Map()

  for (const rawRow of rawRows) {
    const canonicalEntity = resolveCanonicalEntityForRawRow(rawRow, canonicalLookup)
    const canonicalId = canonicalEntity?.id ? String(canonicalEntity.id) : ''
    const canonicalKey = canonicalEntityKeyFromRow(rawRow)
    const groupKey = canonicalId || canonicalKey || String(rawRow?.id || rawRow?.neo4j_id || '')
    const current = groups.get(groupKey)

    const normalizedRow = {
      ...rawRow,
      canonical_entity_id: canonicalId || rawRow.canonical_entity_id || rawRow.properties?.canonical_entity_id || null,
      canonical_key: canonicalEntity?.canonical_key || canonicalKey || null,
    }

    if (!current) {
      groups.set(groupKey, normalizedRow)
      continue
    }

    const currentScore = scoreRawRow(current)
    const nextScore = scoreRawRow(normalizedRow)
    const nextName = normalizeText(normalizedRow.properties?.name)
    const currentName = normalizeText(current.properties?.name)

    if (
      nextScore > currentScore ||
      (nextScore === currentScore && nextName.length < currentName.length) ||
      (nextScore === currentScore && nextName === currentName && String(normalizedRow.neo4j_id || '').localeCompare(String(current.neo4j_id || '')) < 0)
    ) {
      groups.set(groupKey, normalizedRow)
    }
  }

  return Array.from(groups.values()).map((row) => ({
    ...row,
    properties: {
      ...(row.properties || {}),
      canonical_entity_id: row.canonical_entity_id || row.properties?.canonical_entity_id || null,
      canonical_key: row.canonical_key || row.properties?.canonical_key || null,
    },
  }))
}

