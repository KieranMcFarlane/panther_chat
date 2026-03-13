export type CanonicalEntityType =
  | 'team'
  | 'league'
  | 'federation'
  | 'rights_holder'
  | 'organisation'
  | 'unknown'

const CANONICAL_TYPES: Record<string, CanonicalEntityType> = {
  team: 'team',
  club: 'team',
  franchise: 'team',
  league: 'league',
  competition: 'league',
  tournament: 'league',
  federation: 'federation',
  confederation: 'federation',
  governing_body: 'federation',
  rights_holder: 'rights_holder',
  rightsholder: 'rights_holder',
  media_rights: 'rights_holder',
  media: 'rights_holder',
  broadcaster: 'rights_holder',
  broadcast_partner: 'rights_holder',
  organisation: 'organisation',
  organization: 'organisation',
  org: 'organisation',
}

const LEAGUE_ALIASES: Record<string, string[]> = {
  'premier league': ['premier league', 'english premier league', 'epl'],
  'indian premier league': ['indian premier league', 'ipl'],
  'la liga': ['la liga', 'laliga', 'spanish laliga', 'la liga santander'],
  'major league soccer': ['major league soccer', 'mls'],
  'bundesliga': ['bundesliga', 'german bundesliga'],
  'serie a': ['serie a', 'italian serie a'],
  'ligue 1': ['ligue 1', 'french ligue 1'],
  'efl championship': ['efl championship', 'english league championship'],
  'uefa champions league': ['uefa champions league', 'champions league', 'ucl'],
}

function normalizeText(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_]/g, ' ')
    .replace(/\s+/g, ' ')
}

function canonicalTypeFromText(value: unknown): CanonicalEntityType {
  const normalized = normalizeText(value).replace(/\s+/g, '_')
  if (!normalized) return 'unknown'

  if (CANONICAL_TYPES[normalized]) {
    return CANONICAL_TYPES[normalized]
  }

  if (normalized.includes('federation') || normalized.includes('confederation')) return 'federation'
  if (normalized.includes('rights') || normalized.includes('media') || normalized.includes('broadcast')) return 'rights_holder'
  if (normalized.includes('league') || normalized.includes('tournament') || normalized.includes('competition')) return 'league'
  if (normalized.includes('club') || normalized.includes('team') || normalized.includes('franchise')) return 'team'
  if (normalized.includes('organisation') || normalized.includes('organization')) return 'organisation'

  return 'unknown'
}

export function canonicalizeEntityType(entity: {
  properties?: Record<string, any>
  labels?: string[]
}): CanonicalEntityType {
  const properties = entity?.properties || {}

  const candidateValues = [
    properties.entity_type,
    properties.entityType,
    properties.entity_class,
    properties.entityClass,
    properties.type,
    ...(entity?.labels || []),
  ]

  for (const value of candidateValues) {
    const canonical = canonicalTypeFromText(value)
    if (canonical !== 'unknown') {
      return canonical
    }
  }

  return 'unknown'
}

export function toEntityTypeLabel(type: CanonicalEntityType): string {
  switch (type) {
    case 'team':
      return 'Team'
    case 'league':
      return 'League'
    case 'federation':
      return 'Federation'
    case 'rights_holder':
      return 'Rights Holder'
    case 'organisation':
      return 'Organisation'
    default:
      return 'Unknown'
  }
}

export function normalizeFilterValue(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
}

export function getEntitySport(entity: { properties?: Record<string, any> }): string {
  const properties = entity?.properties || {}
  return normalizeFilterValue(properties.sport)
}

export function getEntityLeague(entity: { properties?: Record<string, any> }): string {
  const properties = entity?.properties || {}
  return canonicalizeLeagueName(
    properties.league || properties.parent_entity || properties.parent_league || properties.level || ''
  )
}

export function getLeagueAliases(inputLeague: unknown): string[] {
  const normalized = normalizeForSearch(inputLeague)
  if (!normalized) return []

  for (const aliases of Object.values(LEAGUE_ALIASES)) {
    const normalizedAliases = aliases.map((value) => normalizeForSearch(value))
    if (normalizedAliases.includes(normalized)) {
      return aliases.map((value) => normalizeFilterValue(value))
    }
  }

  return [normalizeFilterValue(inputLeague)]
}

export function canonicalizeLeagueName(value: unknown): string {
  const normalized = normalizeForSearch(value)
  if (!normalized) return ''

  for (const [canonical, aliases] of Object.entries(LEAGUE_ALIASES)) {
    const normalizedAliases = aliases.map((alias) => normalizeForSearch(alias))
    if (normalizedAliases.includes(normalized)) {
      return canonical
        .split(' ')
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
        .join(' ')
    }
  }

  return normalizeFilterValue(value)
}

export function resolveStableEntityId(entity: {
  id?: string | number
  graph_id?: string | number
  neo4j_id?: string | number
  properties?: Record<string, any>
}): string {
  const properties = entity?.properties || {}
  const candidate =
    entity?.graph_id ||
    entity?.neo4j_id ||
    properties.graph_id ||
    properties.neo4j_id ||
    properties.entity_id ||
    entity?.id

  return String(candidate || '')
}

export function normalizeForSearch(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
