import { NextResponse } from 'next/server'
import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
import { dedupeCanonicalEntities } from '@/lib/entity-canonical'
import { canonicalizeLeagueName } from '@/lib/entity-taxonomy'

type CountMap = Record<string, number>

const normalizeLabel = (value: unknown): string =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')

const isNonEmpty = (value: string): boolean => value.length > 0

export async function GET() {
  const startedAt = Date.now()
  try {
    const canonicalProbe = await supabase
      .from('canonical_entities')
      .select('id')
      .limit(1)
    const useCanonical = !canonicalProbe.error

    const { data, error } = useCanonical
      ? await supabase
          .from('canonical_entities')
          .select('entity_type, sport, league, country, name')
          .limit(10000)
      : await supabase
          .from('cached_entities')
          .select('labels, properties')
          .limit(10000)

    if (error) {
      throw error
    }

    const sports: CountMap = {}
    const leagues: CountMap = {}
    const countries: CountMap = {}
    const classes: CountMap = {}
    const federationsRightsHolders: CountMap = {}
    const leaguesBySport: Record<string, Set<string>> = {}

    const canonicalRows = useCanonical ? (data || []) : dedupeCanonicalEntities(data || [])

    for (const entity of canonicalRows) {
      const properties = (entity as any)?.properties || {}
      const sport = normalizeLabel(useCanonical ? (entity as any).sport : properties.sport)
      const league = normalizeLabel(canonicalizeLeagueName(useCanonical ? (entity as any).league : properties.league))
      const country = normalizeLabel(useCanonical ? (entity as any).country : properties.country)
      const entityClass = normalizeLabel(
        useCanonical
          ? (entity as any).entity_type
          : properties.entityClass || properties.entity_class || properties.type || (entity as any)?.labels?.[0] || ''
      )
      const entityName = normalizeLabel(useCanonical ? (entity as any).name : properties.name)
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

    return NextResponse.json({
      sports: Object.keys(sports).sort(sortAsc),
      leagues: Object.keys(leagues).sort(sortAsc),
      countries: Object.keys(countries).sort(sortAsc),
      entityClasses: Object.keys(classes).sort(sortAsc),
      federationsRightsHolders: Object.keys(federationsRightsHolders).sort(sortAsc),
      leaguesBySport: leagueMap,
      metadata: {
        scanned_entities: (data || []).length,
        canonical_entities: canonicalRows.length,
        source: useCanonical ? 'canonical_entities' : 'cached_entities',
        latency_ms: Date.now() - startedAt
      },
      counts: {
        sports,
        leagues,
        countries,
        entityClasses: classes,
        federationsRightsHolders
      }
    })
  } catch (error) {
    console.error('❌ Failed to fetch entities taxonomy:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch taxonomy',
        sports: [],
        leagues: [],
        countries: [],
        entityClasses: [],
        federationsRightsHolders: [],
        leaguesBySport: {},
        counts: {}
      },
      { status: 500 }
    )
  }
}
