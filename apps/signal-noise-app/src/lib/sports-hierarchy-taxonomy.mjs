function toNormalizedText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim().replace(/\s+/g, ' ')
}

function normalizeFacetKey(value) {
  return toNormalizedText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizeFacetLabel(value) {
  return toNormalizedText(value)
}

const SPORTS_HIERARCHY_ROLES = new Set(['Club', 'Team', 'Federation', 'League', 'Competition'])

const COUNTRY_PREFIXES = [
  ['australian', 'Australia'],
  ['canadian', 'Canada'],
  ['english', 'England'],
  ['scottish', 'Scotland'],
  ['welsh', 'Wales'],
  ['irish', 'Ireland'],
  ['new zealand', 'New Zealand'],
  ['american', 'United States'],
  ['us', 'United States'],
  ['usa', 'United States'],
  ['german', 'Germany'],
  ['french', 'France'],
  ['spanish', 'Spain'],
  ['italian', 'Italy'],
  ['belgian', 'Belgium'],
  ['dutch', 'Netherlands'],
  ['swedish', 'Sweden'],
  ['norwegian', 'Norway'],
  ['danish', 'Denmark'],
  ['finnish', 'Finland'],
  ['austrian', 'Austria'],
  ['swiss', 'Switzerland'],
  ['japanese', 'Japan'],
  ['korean', 'South Korea'],
  ['chinese', 'China'],
  ['indian', 'India'],
  ['south african', 'South Africa'],
  ['mexican', 'Mexico'],
  ['brazilian', 'Brazil'],
  ['argentinian', 'Argentina'],
  ['peruvian', 'Peru'],
  ['chilean', 'Chile'],
  ['colombian', 'Colombia'],
  ['pakistani', 'Pakistan'],
  ['afghan', 'Afghanistan'],
]

function normalizeRoleText(value) {
  return normalizeFacetKey(value)
}

function includesAny(value, needles) {
  const haystack = normalizeRoleText(value)
  if (!haystack) return false
  const tokens = haystack.split(' ').filter(Boolean)

  return needles.some((needle) => {
    const normalizedNeedle = normalizeRoleText(needle)
    if (!normalizedNeedle) return false
    if (!normalizedNeedle.includes(' ')) {
      return tokens.includes(normalizedNeedle)
    }
    return haystack.includes(normalizedNeedle)
  })
}

function buildRoleText(entity) {
  const properties = entity?.properties || {}
  const labels = (entity?.labels || []).map((label) => normalizeFacetLabel(label)).filter(Boolean)
  return [
    properties.name,
    properties.type,
    properties.entityClass,
    properties.entity_class,
    labels.join(' '),
  ].filter(Boolean).join(' ')
}

function getCanonicalEntityRole(entity) {
  const properties = entity?.properties || {}
  const text = buildRoleText(entity || {})

  if (includesAny(text, ['director', 'manager', 'coach', 'ceo', 'chairman', 'president', 'owner', 'executive', 'player', 'athlete', 'captain', 'secretary', 'head', 'chief', 'officer'])) {
    return 'Person'
  }
  if (includesAny(text, ['stadium', 'arena', 'ground', 'park', 'field', 'centre', 'center', 'oval', 'coliseum', 'venue', 'facility', 'complex'])) {
    return 'Venue'
  }
  if (includesAny(text, ['tv', 'television', 'radio', 'media', 'broadcast', 'channel', 'network', 'newspaper', 'magazine', 'website', 'streaming'])) {
    return 'Media'
  }
  if (includesAny(text, ['software', 'platform', 'app', 'technology', 'digital', 'analytics', 'data', 'systems', 'infrastructure', 'cloud'])) {
    return 'Technology'
  }
  if (includesAny(text, ['sponsor', 'partner', 'backer', 'supporter', 'funding', 'investment'])) {
    return 'Sponsor'
  }
  if (includesAny(text, ['club', 'fc'])) return 'Club'
  if (includesAny(text, ['team', 'squad'])) return 'Team'
  if (includesAny(text, ['federation', 'association', 'confederation', 'union', 'governing', 'rights holder'])) return 'Federation'
  if (includesAny(text, ['league', 'division', 'conference', 'premiership'])) return 'League'
  if (includesAny(text, ['competition', 'championship', 'championships', 'cup', 'tournament', 'series', 'grand prix', 'open', 'masters', 'games'])) return 'Competition'
  if (includesAny(text, ['brand', 'apparel', 'equipment', 'gear', 'manufacturer', 'supplier'])) return 'Brand'
  if (includesAny(text, ['organization', 'organisation', 'body', 'authority', 'council', 'institute', 'committee', 'commission', 'foundation', 'trust'])) return 'Organization'

  if (normalizeFacetLabel(properties.sport) || normalizeFacetLabel(properties.country)) {
    return 'Organization'
  }

  return 'Organization'
}

function normalizeText(value) {
  return normalizeFacetLabel(value)
}

function normalizeKey(value) {
  return normalizeFacetKey(value)
}

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    const label = normalizeText(value)
    if (label) return label
  }
  return ''
}

function deriveCountryFromName(name) {
  const normalizedName = normalizeKey(name)
  if (!normalizedName) return ''

  for (const [prefix, country] of COUNTRY_PREFIXES) {
    if (normalizedName === prefix || normalizedName.startsWith(`${prefix} `) || normalizedName.includes(`${prefix} `)) {
      return country
    }
  }

  return ''
}

function getEntityFields(entity) {
  const properties = entity?.properties || {}
  const location = normalizeFacetLabel(properties.location)
  const locationCountry = location.includes(',') ? location.split(',').pop().trim() : ''
  const derivedCountry = deriveCountryFromName(properties.name || entity?.name || '')
  return {
    name: properties.name || '',
    sport: properties.sport || properties.discipline || properties.category || '',
    country:
      properties.country ||
      properties.nation ||
      properties.home_country ||
      properties.country_name ||
      properties.association_country ||
      locationCountry ||
      derivedCountry ||
      '',
    league: properties.league || properties.competition || properties.parent_league || properties.parent_competition || '',
  }
}

function getRoleKey(entity) {
  const directEntityType = normalizeKey(entity?.entity_type || entity?.properties?.entity_type)
  if (directEntityType === 'federation') return 'Federation'
  if (directEntityType === 'team') return 'Team'
  if (directEntityType === 'club') return 'Club'
  if (directEntityType === 'league') return 'League'
  if (directEntityType === 'competition') return 'Competition'
  if (directEntityType === 'organisation' || directEntityType === 'organization') return 'Organization'

  return getCanonicalEntityRole(entity)
}

export function shouldIncludeInSportsHierarchy(entity) {
  const role = getRoleKey(entity)
  if (SPORTS_HIERARCHY_ROLES.has(role)) return true

  if (role === 'Organization') {
    const fields = getEntityFields(entity)
    return Boolean(fields.sport || fields.league)
  }

  return false
}

export function buildCanonicalLeagueLookup(canonicalEntities = []) {
  const lookup = new Map()

  for (const entity of canonicalEntities || []) {
    const role = getRoleKey(entity)
    if (!SPORTS_HIERARCHY_ROLES.has(role) || (role !== 'League' && role !== 'Competition')) continue

    const name = pickFirstNonEmpty(entity?.name, entity?.normalized_name, entity?.properties?.name)
    if (!name) continue

    const normalizedName = normalizeKey(name)
    if (!normalizedName) continue

    lookup.set(normalizedName, {
      id: String(entity.id || ''),
      name,
      sport: pickFirstNonEmpty(entity?.sport, entity?.properties?.sport),
      country: pickFirstNonEmpty(entity?.country, entity?.properties?.country),
      entity_type: entity?.entity_type || '',
    })

    const canonicalKey = normalizeKey(entity?.canonical_key || '')
    if (canonicalKey) {
      lookup.set(canonicalKey, {
        id: String(entity.id || ''),
        name,
        sport: pickFirstNonEmpty(entity?.sport, entity?.properties?.sport),
        country: pickFirstNonEmpty(entity?.country, entity?.properties?.country),
        entity_type: entity?.entity_type || '',
      })
    }
  }

  return lookup
}

function resolveCanonicalLeague(entity, canonicalLeagueLookup) {
  const fields = getEntityFields(entity)
  const candidates = [fields.league, entity?.league, entity?.properties?.league, entity?.properties?.parent_league, entity?.properties?.parent_competition]
    .map(normalizeText)
    .filter(Boolean)

  for (const candidate of candidates) {
    const lookupKey = normalizeKey(candidate)
    if (!lookupKey) continue
    const canonicalLeague = canonicalLeagueLookup instanceof Map
      ? canonicalLeagueLookup.get(lookupKey)
      : canonicalLeagueLookup?.[lookupKey]
    if (canonicalLeague) return canonicalLeague
  }

  return null
}

export function buildSportsHierarchyBackfill(entity, canonicalLeagueLookup = new Map()) {
  const role = getRoleKey(entity)
  const fields = getEntityFields(entity)
  const canonicalLeague = resolveCanonicalLeague(entity, canonicalLeagueLookup)
  const inHierarchy = shouldIncludeInSportsHierarchy(entity)

  const sport = pickFirstNonEmpty(fields.sport, canonicalLeague?.sport)
  const country = pickFirstNonEmpty(fields.country, canonicalLeague?.country)
  const leagueName = canonicalLeague?.name || (role === 'League' || role === 'Competition' ? pickFirstNonEmpty(fields.league, fields.name) : '')
  const leagueCanonicalEntityId = inHierarchy && canonicalLeague ? canonicalLeague.id : ''
  const parentCanonicalEntityId =
    inHierarchy && (role === 'Club' || role === 'Team')
      ? canonicalLeague?.id || ''
      : ''

  return {
    role,
    inHierarchy,
    sport: sport || '',
    country: country || '',
    league: leagueName || '',
    league_canonical_entity_id: leagueCanonicalEntityId || '',
    parent_canonical_entity_id: parentCanonicalEntityId || '',
    shouldClearHierarchy: !inHierarchy,
  }
}
