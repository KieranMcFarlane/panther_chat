import { NextRequest, NextResponse } from 'next/server'
import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
import { resolveGraphId } from '@/lib/graph-id'
import { canonicalEntityType, readLeague } from '@/lib/entity-search-utils.js'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.max(5, Math.min(50, parseInt(searchParams.get('limit') || '10')))
    let entityType = searchParams.get('entityType') || ''
    if (entityType === 'all') entityType = ''
    const sortBy = searchParams.get('sortBy') || 'popular'
    const sortOrder = searchParams.get('sortOrder') || (sortBy === 'popular' ? 'desc' : 'asc')
    const search = searchParams.get('search') || ''
    const sport = (searchParams.get('sport') || '').trim()
    const league = (searchParams.get('league') || '').trim()
    const country = (searchParams.get('country') || '').trim()
    const entityClass = (searchParams.get('entityClass') || '').trim()

    console.log(`📖 Fetching entities from Supabase: page=${page}, limit=${limit}, search=${search || 'none'}, sport=${sport || 'all'}, league=${league || 'all'}, country=${country || 'all'}, entityClass=${entityClass || 'all'}`)

    let query = supabase
      .from('cached_entities')
      .select('id, graph_id, neo4j_id, labels, properties', { count: 'exact' })

    const wildcard = (value: string) => `%${value.replace(/%/g, '')}%`

    if (entityType) {
      query = query.contains('labels', [entityType])
    }

    if (sport && sport !== 'all') {
      query = query.ilike('properties->>sport', wildcard(sport))
    }
    if (league && league !== 'all') {
      const leaguePattern = wildcard(league)
      query = query.or(`properties->>league.ilike.${leaguePattern},properties->>level.ilike.${leaguePattern}`)
    }
    if (country && country !== 'all') {
      query = query.ilike('properties->>country', wildcard(country))
    }
    if (entityClass && entityClass !== 'all') {
      const entityClassPattern = wildcard(entityClass)
      query = query.or(
        `properties->>entityClass.ilike.${entityClassPattern},properties->>entity_class.ilike.${entityClassPattern},properties->>type.ilike.${entityClassPattern}`
      )
    }

    if (search.trim()) {
      const searchPattern = wildcard(search.trim())
      query = query.or(
        `properties->>name.ilike.${searchPattern},properties->>type.ilike.${searchPattern},properties->>sport.ilike.${searchPattern},properties->>league.ilike.${searchPattern},properties->>country.ilike.${searchPattern},properties->>description.ilike.${searchPattern},properties->>aliases.ilike.${searchPattern},properties->>alias.ilike.${searchPattern}`
      )
    }

    const ascending = sortOrder.toLowerCase() !== 'desc'
    const sortFieldMap: Record<string, string> = {
      name: 'properties->>name',
      type: 'properties->>type',
      sport: 'properties->>sport',
      country: 'properties->>country',
      league: 'properties->>league',
      priorityScore: 'properties->>priorityScore',
      estimatedValue: 'properties->>estimatedValue'
    }

    if (sortBy === 'popular') {
      query = query
        .order('properties->>yellowPantherPriority', { ascending: false, nullsFirst: false })
        .order('properties->>priorityScore', { ascending: false, nullsFirst: false })
        .order('properties->>priority_score', { ascending: false, nullsFirst: false })
        .order('properties->>name', { ascending: true, nullsFirst: false })
    } else {
      const orderField = sortFieldMap[sortBy] || sortFieldMap.name
      query = query.order(orderField, { ascending, nullsFirst: false })
    }

    const start = (page - 1) * limit
    const end = start + limit - 1
    query = query.range(start, end)

    const { data, error, count } = await query
    if (error) {
      console.error('❌ Supabase query error:', error)
      throw error
    }

    const paginated = data || []

    const total = count ?? paginated.length
    console.log(`✅ Supabase query successful: ${paginated.length} entities, total: ${total}`)

    // Transform to match expected format
    const transformedEntities = paginated.map((entity: any) => {
      const stableId = resolveGraphId(entity) || entity.id
      return {
        id: entity.id,
        graph_id: stableId,
        labels: entity.labels || [],
        properties: {
          ...entity.properties,
          name: entity.properties?.name || stableId,
          type: canonicalEntityType(entity),
          league: readLeague(entity.properties || {}),
          priorityScore: Number(
            entity.properties?.priorityScore ||
            entity.properties?.priority_score ||
            entity.properties?.yellowPantherPriority ||
            0
          )
        }
      }
    })

    return NextResponse.json({
      entities: transformedEntities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasNext: start + limit < total,
        hasPrev: page > 1
      },
      filters: {
        entityType,
        sport,
        league,
        country,
        entityClass,
        sortBy,
        sortOrder
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
