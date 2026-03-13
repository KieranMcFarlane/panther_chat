import { NextRequest, NextResponse } from 'next/server'
import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
import { dedupeCanonicalEntities } from '@/lib/entity-canonical'
import {
  canonicalizeLeagueName,
  canonicalizeEntityType,
  getLeagueAliases,
  getEntityLeague,
  getEntitySport,
  normalizeForSearch,
  resolveStableEntityId,
} from '@/lib/entity-taxonomy'

type CanonicalFilterType = 'team' | 'league' | 'federation' | 'rights_holder' | 'organisation'

function buildEntityTypeWhereClause(entityType: CanonicalFilterType): string {
  const variants: Record<CanonicalFilterType, string[]> = {
    team: ['team', 'club', 'franchise'],
    league: ['league', 'competition', 'tournament'],
    federation: ['federation', 'confederation', 'governing body', 'governing_body'],
    rights_holder: ['rights holder', 'rights_holder', 'rightsholder', 'media rights', 'media', 'broadcast', 'broadcaster'],
    organisation: ['organisation', 'organization', 'org'],
  }

  return variants[entityType]
    .map((value) => `properties->>entity_type.ilike.%${value}%`)
    .concat(variants[entityType].map((value) => `properties->>type.ilike.%${value}%`))
    .join(',')
}

function safeLikeTerm(value: string): string {
  return value.replace(/[,%]/g, ' ').trim()
}

function getSortField(sortBy: string): string {
  switch (sortBy) {
    case 'type':
      return 'properties->>type'
    case 'sport':
      return 'properties->>sport'
    case 'country':
      return 'properties->>country'
    case 'priorityScore':
      return 'properties->>priorityScore'
    case 'estimatedValue':
      return 'properties->>estimatedValue'
    default:
      return 'properties->>name'
  }
}

function compareValues(a: any, b: any, ascending: boolean): number {
  const aNum = Number(a)
  const bNum = Number(b)
  const numeric = !Number.isNaN(aNum) && !Number.isNaN(bNum)

  let result = 0
  if (numeric) {
    result = aNum - bNum
  } else {
    result = String(a || '').localeCompare(String(b || ''), undefined, { sensitivity: 'base' })
  }

  return ascending ? result : -result
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    let entityType = searchParams.get('entityType') || ''
    if (entityType === 'all') entityType = ''
    const sortBy = searchParams.get('sortBy') || 'name'
    const sortOrder = searchParams.get('sortOrder') || 'asc'
    const search = searchParams.get('search') || ''
    const sport = searchParams.get('sport') || ''
    const league = searchParams.get('league') || ''

    console.log(`📖 Fetching entities from Supabase: page=${page}, limit=${limit}, search=${search || 'none'}`)

    const canonicalProbe = await supabase
      .from('canonical_entities')
      .select('id')
      .limit(1)
    const useCanonical = !canonicalProbe.error

    if (useCanonical) {
      let canonicalQuery = supabase
        .from('canonical_entities')
        .select('*', { count: 'exact' })

      if (search) {
        const searchTerm = safeLikeTerm(search)
        canonicalQuery = canonicalQuery.or(
          `name.ilike.%${searchTerm}%,normalized_name.ilike.%${searchTerm}%,sport.ilike.%${searchTerm}%,league.ilike.%${searchTerm}%,country.ilike.%${searchTerm}%`
        )
      }

      if (entityType && entityType !== 'all') {
        const requested = entityType.toLowerCase() as CanonicalFilterType
        if (['team', 'league', 'federation', 'rights_holder', 'organisation'].includes(requested)) {
          canonicalQuery = canonicalQuery.eq('entity_type', requested)
        }
      }

      if (sport && sport !== 'all') {
        canonicalQuery = canonicalQuery.ilike('sport', `%${safeLikeTerm(sport)}%`)
      }

      if (league && league !== 'all') {
        const leagueTerms = getLeagueAliases(league).map(safeLikeTerm)
        const clauses = leagueTerms.map((leagueTerm) => `league.ilike.%${leagueTerm}%`)
        canonicalQuery = canonicalQuery.or(clauses.join(','))
      }

      const sortFieldMap: Record<string, string> = {
        name: 'name',
        type: 'entity_type',
        sport: 'sport',
        country: 'country',
        priorityScore: 'quality_score',
        estimatedValue: 'quality_score',
      }
      const sortField = sortFieldMap[sortBy] || 'name'
      const ascending = sortOrder.toLowerCase() !== 'desc'

      const start = (page - 1) * limit
      canonicalQuery = canonicalQuery
        .order(sortField, { ascending })
        .range(start, start + limit - 1)

      const { data: canonicalData, error: canonicalError, count: canonicalCount } = await canonicalQuery
      if (canonicalError) throw canonicalError

      const transformedCanonical = (canonicalData || []).map((entity: any) => ({
        id: String(entity.id),
        graph_id: String(entity.id),
        neo4j_id: Array.isArray(entity.source_neo4j_ids) ? entity.source_neo4j_ids[0] : null,
        labels: Array.isArray(entity.labels) ? entity.labels : [],
        properties: {
          ...(entity.properties || {}),
          name: entity.name,
          normalized_name: entity.normalized_name,
          entity_type: entity.entity_type,
          type: entity.entity_type,
          sport: entity.sport,
          league: entity.league,
          country: entity.country,
          canonical_key: entity.canonical_key,
          source_entity_ids: entity.source_entity_ids || [],
          source_graph_ids: entity.source_graph_ids || [],
          source_neo4j_ids: entity.source_neo4j_ids || [],
        },
      }))

      const total = canonicalCount || 0
      return NextResponse.json({
        entities: transformedCanonical,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: start + limit < total,
          hasPrev: page > 1,
        },
        filters: {
          entityType,
          sortBy,
          sortOrder,
          sport,
          league,
        },
        source: 'canonical_entities',
      })
    }

    // Build the base query. We intentionally fetch the full filtered set and
    // dedupe in memory so pagination is applied to canonical entities, not raw
    // historical-pass duplicates.
    let query = supabase
      .from('cached_entities')
      .select('*')

    // Apply search filter if provided
    if (search) {
      const searchTerm = safeLikeTerm(search)
      query = query.or(`properties->>name.ilike.%${searchTerm}%,properties->>aliases.ilike.%${searchTerm}%,properties->>type.ilike.%${searchTerm}%,properties->>entity_type.ilike.%${searchTerm}%,properties->>sport.ilike.%${searchTerm}%,properties->>country.ilike.%${searchTerm}%,properties->>league.ilike.%${searchTerm}%,properties->>description.ilike.%${searchTerm}%`)
    }

    // Apply entity type filter if provided
    if (entityType && entityType !== 'all') {
      const requested = entityType.toLowerCase() as CanonicalFilterType
      if (['team', 'league', 'federation', 'rights_holder', 'organisation'].includes(requested)) {
        query = query.or(buildEntityTypeWhereClause(requested))
      } else {
        query = query.or(
          `properties->>entity_type.ilike.%${safeLikeTerm(entityType)}%,properties->>type.ilike.%${safeLikeTerm(entityType)}%`
        )
      }
    }

    if (sport && sport !== 'all') {
      query = query.ilike('properties->>sport', `%${safeLikeTerm(sport)}%`)
    }

      if (league && league !== 'all') {
        const leagueTerms = getLeagueAliases(league).map(safeLikeTerm)
        const clauses = leagueTerms.flatMap((leagueTerm) => [
        `properties->>league.ilike.%${leagueTerm}%`,
        `properties->>parent_league.ilike.%${leagueTerm}%`,
        `properties->>level.ilike.%${leagueTerm}%`,
      ])
      query = query.or(clauses.join(','))
    }

    query = query.limit(10000)

    const { data, error } = await query

    if (error) {
      console.error('❌ Supabase query error:', error)
      throw error
    }

    const entities = dedupeCanonicalEntities(data || [])

    console.log(`✅ Supabase query successful: ${entities.length} canonical entities`)

    // Transform to match expected format
    const transformedEntities = entities.map((entity: any) => ({
      id: resolveStableEntityId(entity) || String(entity.id),
      graph_id: resolveStableEntityId(entity) || String(entity.id),
      neo4j_id: entity.neo4j_id,
      labels: entity.labels || [],
      properties: {
        ...entity.properties,
        name: entity.properties?.name || entity.neo4j_id,
        type: entity.properties?.type || entity.labels?.[0] || 'ENTITY',
        entity_type: canonicalizeEntityType(entity),
        sport: getEntitySport(entity),
        league: canonicalizeLeagueName(getEntityLeague(entity)),
        normalized_name: normalizeForSearch(entity.properties?.name || entity.neo4j_id),
      }
    }))

    const sortField = getSortField(sortBy)
    const ascending = sortOrder.toLowerCase() !== 'desc'

    transformedEntities.sort((a: any, b: any) => {
      const getSortValue = (entity: any) => {
        switch (sortField) {
          case 'properties->>type':
            return entity.properties?.type
          case 'properties->>sport':
            return entity.properties?.sport
          case 'properties->>country':
            return entity.properties?.country
          case 'properties->>priorityScore':
            return entity.properties?.priorityScore
          case 'properties->>estimatedValue':
            return entity.properties?.estimatedValue
          default:
            return entity.properties?.name
        }
      }

      return compareValues(getSortValue(a), getSortValue(b), ascending)
    })

    const total = transformedEntities.length
    const start = (page - 1) * limit
    const pagedEntities = transformedEntities.slice(start, start + limit)

    return NextResponse.json({
      entities: pagedEntities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: start + limit < total,
        hasPrev: page > 1
      },
      filters: {
        entityType,
        sortBy,
        sortOrder,
        sport,
        league,
      },
      source: 'supabase'
    })

  } catch (error) {
    console.error('❌ Failed to fetch entities:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch entities' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate entity data against schema
    const requiredFields = ['entity_type', 'name', 'source'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Mock entity creation
    const newEntity = {
      entity_id: `ENTITY_${Date.now()}`,
      ...body,
      last_updated: new Date().toISOString(),
      vector_embedding: body.vector_embedding || [0.1, 0.2, 0.3]
    };

    return NextResponse.json({
      entity: newEntity,
      message: 'Entity created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating entity:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create entity' },
      { status: 500 }
    );
  }
}
