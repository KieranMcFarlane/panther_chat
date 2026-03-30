type CountMap = Record<string, number>

export type EntitiesTaxonomyResponse = {
  sports: string[]
  leagues: string[]
  countries: string[]
  entityClasses: string[]
  federationsRightsHolders: string[]
  leaguesBySport: Record<string, string[]>
  metadata: {
    scanned_entities: number
    latency_ms?: number
    source?: string
  }
  counts: {
    sports: CountMap
    leagues: CountMap
    countries: CountMap
    entityClasses: CountMap
    federationsRightsHolders: CountMap
  }
}

const LEAGUE_ALIAS_GROUPS: Record<string, string[]> = {
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

function normalizeLabel(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizeLeagueKey(value: unknown): string {
  return normalizeLabel(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((token) => token[0].toUpperCase() + token.slice(1))
    .join(' ')
}

export function canonicalizeLeagueLabel(value: unknown): string {
  const normalized = normalizeLeagueKey(value)
  if (!normalized) return ''

  for (const [canonical, aliases] of Object.entries(LEAGUE_ALIAS_GROUPS)) {
    const normalizedAliases = new Set([canonical, ...aliases].map(normalizeLeagueKey))
    if (normalizedAliases.has(normalized)) {
      return titleCase(canonical)
    }
  }

  return titleCase(normalized)
}

export function getCanonicalLeagueQueryValues(value: unknown): string[] {
  const normalized = normalizeLeagueKey(value)
  if (!normalized) return []

  for (const [canonical, aliases] of Object.entries(LEAGUE_ALIAS_GROUPS)) {
    const normalizedAliases = Array.from(new Set([canonical, ...aliases].map(normalizeLeagueKey)))
    if (normalizedAliases.includes(normalized)) {
      return normalizedAliases
    }
  }

  return [normalized]
}

function isNonEmpty(value: string): boolean {
  return value.length > 0
}

function createEmptyCounts(): EntitiesTaxonomyResponse['counts'] {
  return {
    sports: {},
    leagues: {},
    countries: {},
    entityClasses: {},
    federationsRightsHolders: {},
  }
}

export function buildEntitiesTaxonomy(entities: any[], options: { source?: string; latencyMs?: number } = {}): EntitiesTaxonomyResponse {
  const sports: CountMap = {}
  const leagues: CountMap = {}
  const countries: CountMap = {}
  const classes: CountMap = {}
  const federationsRightsHolders: CountMap = {}
  const leaguesBySport: Record<string, Set<string>> = {}

  for (const entity of entities || []) {
    const properties = entity?.properties || {}
    const sport = normalizeLabel(properties.sport)
    const league = canonicalizeLeagueLabel(
      properties.league || properties.level || properties.parent_league || properties.competition || ''
    )
    const country = normalizeLabel(properties.country)
    const entityClass = normalizeLabel(
      properties.entityClass || properties.entity_class || properties.type || entity?.labels?.[0] || ''
    )
    const entityName = normalizeLabel(properties.name)
    const lowerClass = entityClass.toLowerCase()
    const lowerName = entityName.toLowerCase()

    if (isNonEmpty(sport)) sports[sport] = (sports[sport] || 0) + 1
    if (isNonEmpty(league)) leagues[league] = (leagues[league] || 0) + 1
    if (isNonEmpty(country)) countries[country] = (countries[country] || 0) + 1
    if (isNonEmpty(entityClass)) classes[entityClass] = (classes[entityClass] || 0) + 1

    if (isNonEmpty(sport) && isNonEmpty(league)) {
      if (!leaguesBySport[sport]) leaguesBySport[sport] = new Set()
      leaguesBySport[sport].add(league)
    }

    const isFederationOrRightsHolder =
      lowerClass.includes('federation') ||
      lowerClass.includes('rights') ||
      lowerClass.includes('governing') ||
      lowerClass.includes('association') ||
      lowerName.includes('federation') ||
      lowerName.includes('confederation')

    if (isFederationOrRightsHolder && isNonEmpty(entityName)) {
      federationsRightsHolders[entityName] = (federationsRightsHolders[entityName] || 0) + 1
    }
  }

  const sortAsc = (a: string, b: string) => a.localeCompare(b)
  const leagueMap = Object.fromEntries(
    Object.entries(leaguesBySport)
      .sort(([a], [b]) => sortAsc(a, b))
      .map(([sport, leagueSet]) => [sport, Array.from(leagueSet).sort(sortAsc)])
  )

  return {
    sports: Object.keys(sports).sort(sortAsc),
    leagues: Object.keys(leagues).sort(sortAsc),
    countries: Object.keys(countries).sort(sortAsc),
    entityClasses: Object.keys(classes).sort(sortAsc),
    federationsRightsHolders: Object.keys(federationsRightsHolders).sort(sortAsc),
    leaguesBySport: leagueMap,
    metadata: {
      scanned_entities: entities.length,
      ...(options.latencyMs !== undefined ? { latency_ms: options.latencyMs } : {}),
      ...(options.source ? { source: options.source } : {}),
    },
    counts: {
      sports,
      leagues,
      countries,
      entityClasses: classes,
      federationsRightsHolders,
    },
  }
}

export function buildEmptyEntitiesTaxonomy(options: { source?: string } = {}): EntitiesTaxonomyResponse {
  return {
    sports: [],
    leagues: [],
    countries: [],
    entityClasses: [],
    federationsRightsHolders: [],
    leaguesBySport: {},
    metadata: {
      scanned_entities: 0,
      ...(options.source ? { source: options.source } : {}),
    },
    counts: createEmptyCounts(),
  }
}
