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

function normalizeLabel(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
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
    const league = normalizeLabel(properties.league)
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
