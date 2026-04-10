import { isPreferredFacetLabel, normalizeFacetKey, normalizeFacetLabel } from '@/lib/facet-normalization'

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
  const sports = new Map<string, { label: string; count: number }>()
  const leagues = new Map<string, { label: string; count: number }>()
  const countries = new Map<string, { label: string; count: number }>()
  const classes = new Map<string, { label: string; count: number }>()
  const federationsRightsHolders = new Map<string, { label: string; count: number }>()
  const leaguesBySport = new Map<string, Map<string, { label: string; count: number }>>()

  const bumpFacet = (bucket: Map<string, { label: string; count: number }>, rawValue: unknown) => {
    const label = normalizeFacetLabel(rawValue)
    const key = normalizeFacetKey(label)
    if (!isNonEmpty(label) || !isNonEmpty(key)) return

    const existing = bucket.get(key)
    if (!existing) {
      bucket.set(key, { label, count: 1 })
      return
    }

    existing.count += 1
    if (isPreferredFacetLabel(existing.label, label)) {
      existing.label = label
    }
  }

  const bumpNestedFacet = (
    bucket: Map<string, Map<string, { label: string; count: number }>>,
    outerRawValue: unknown,
    innerRawValue: unknown,
  ) => {
    const outerLabel = normalizeFacetLabel(outerRawValue)
    const outerKey = normalizeFacetKey(outerLabel)
    const innerLabel = normalizeFacetLabel(innerRawValue)
    const innerKey = normalizeFacetKey(innerLabel)
    if (!isNonEmpty(outerLabel) || !isNonEmpty(outerKey) || !isNonEmpty(innerLabel) || !isNonEmpty(innerKey)) return

    if (!bucket.has(outerKey)) {
      bucket.set(outerKey, new Map())
    }

    const outerBucket = bucket.get(outerKey)!
    const existing = outerBucket.get(innerKey)
    if (!existing) {
      outerBucket.set(innerKey, { label: innerLabel, count: 1 })
      return
    }

    existing.count += 1
    if (isPreferredFacetLabel(existing.label, innerLabel)) {
      existing.label = innerLabel
    }
  }

  for (const entity of entities || []) {
    const properties = entity?.properties || {}
    const sport = normalizeFacetLabel(properties.sport)
    const league = normalizeFacetLabel(properties.league)
    const country = normalizeFacetLabel(properties.country)
    const entityClass = normalizeFacetLabel(
      properties.entityClass || properties.entity_class || properties.type || entity?.labels?.[0] || ''
    )
    const entityName = normalizeFacetLabel(properties.name)
    const lowerClass = entityClass.toLowerCase()
    const lowerName = entityName.toLowerCase()

    bumpFacet(sports, sport)
    bumpFacet(leagues, league)
    bumpFacet(countries, country)
    bumpFacet(classes, entityClass)

    if (isNonEmpty(sport) && isNonEmpty(league)) {
      bumpNestedFacet(leaguesBySport, sport, league)
    }

    const isFederationOrRightsHolder =
      lowerClass.includes('federation') ||
      lowerClass.includes('rights') ||
      lowerClass.includes('governing') ||
      lowerClass.includes('association') ||
      lowerName.includes('federation') ||
      lowerName.includes('confederation')

    if (isFederationOrRightsHolder && isNonEmpty(entityName)) {
      bumpFacet(federationsRightsHolders, entityName)
    }
  }

  const sortAsc = (a: string, b: string) => a.localeCompare(b)
  const toSortedCountMap = (bucket: Map<string, { label: string; count: number }>) =>
    Object.fromEntries(
      [...bucket.values()]
        .sort((left, right) => sortAsc(left.label, right.label))
        .map(({ label, count }) => [label, count])
    )
  const leagueMap = Object.fromEntries(
    [...leaguesBySport.entries()]
      .sort(([left], [right]) => sortAsc(sports.get(left)?.label || left, sports.get(right)?.label || right))
      .map(([sportKey, leagueBucket]) => {
        const sportLabel = sports.get(sportKey)?.label || sportKey
        return [
          sportLabel,
          [...leagueBucket.values()]
            .sort((left, right) => sortAsc(left.label, right.label))
            .map(({ label }) => label),
        ]
      })
  )

  return {
    sports: [...sports.values()].sort((a, b) => sortAsc(a.label, b.label)).map(({ label }) => label),
    leagues: [...leagues.values()].sort((a, b) => sortAsc(a.label, b.label)).map(({ label }) => label),
    countries: [...countries.values()].sort((a, b) => sortAsc(a.label, b.label)).map(({ label }) => label),
    entityClasses: [...classes.values()].sort((a, b) => sortAsc(a.label, b.label)).map(({ label }) => label),
    federationsRightsHolders: [...federationsRightsHolders.values()].sort((a, b) => sortAsc(a.label, b.label)).map(({ label }) => label),
    leaguesBySport: leagueMap,
    metadata: {
      scanned_entities: entities.length,
      ...(options.latencyMs !== undefined ? { latency_ms: options.latencyMs } : {}),
      ...(options.source ? { source: options.source } : {}),
    },
    counts: {
      sports: toSortedCountMap(sports),
      leagues: toSortedCountMap(leagues),
      countries: toSortedCountMap(countries),
      entityClasses: toSortedCountMap(classes),
      federationsRightsHolders: toSortedCountMap(federationsRightsHolders),
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
