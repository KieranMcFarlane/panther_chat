import { NextRequest, NextResponse } from 'next/server'
import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
import { dedupeCanonicalEntities } from '@/lib/entity-canonical'
import {
  canonicalizeLeagueName,
  canonicalizeEntityType,
  getLeagueAliases,
  getEntityLeague,
  getEntitySport,
  resolveStableEntityId,
} from '@/lib/entity-taxonomy'

function safeLikeTerm(value: string): string {
  return value.replace(/[,%]/g, ' ').trim()
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sport = searchParams.get('sport') || ''
    const league = searchParams.get('league') || ''
    const entityType = searchParams.get('entityType') || ''
    
    console.log(`📊 Summary API: Fetching entity summaries for sport: ${sport || 'all'}`)

    const canonicalProbe = await supabase
      .from('canonical_entities')
      .select('id')
      .limit(1)
    const useCanonical = !canonicalProbe.error

    if (useCanonical) {
      let canonicalQuery = supabase
        .from('canonical_entities')
        .select('*')
        .limit(10000)

      if (sport && sport !== 'all') {
        canonicalQuery = canonicalQuery.ilike('sport', `%${safeLikeTerm(sport)}%`)
      }

      if (league && league !== 'all') {
        const clauses = getLeagueAliases(league)
          .map(safeLikeTerm)
          .map((leagueTerm) => `league.ilike.%${leagueTerm}%`)
        canonicalQuery = canonicalQuery.or(clauses.join(','))
      }

      if (entityType && entityType !== 'all') {
        canonicalQuery = canonicalQuery.eq('entity_type', entityType)
      }

      const { data: canonicalData, error: canonicalError } = await canonicalQuery.order('name', { ascending: true })
      if (canonicalError) throw canonicalError

      const summaries = (canonicalData || []).map((entity: any) => ({
        id: String(entity.id),
        source_id: String(entity.id),
        graph_id: String(entity.id),
        neo4j_id: Array.isArray(entity.source_neo4j_ids) ? entity.source_neo4j_ids[0] : String(entity.id),
        name: entity.name,
        type: entity.entity_type,
        entity_type: entity.entity_type,
        sport: entity.sport || '',
        country: entity.country || '',
        level: entity.properties?.level || '',
        league: canonicalizeLeagueName(entity.league || ''),
      }))

      return NextResponse.json({
        entities: summaries,
        summary: {
          count: summaries.length,
          total: summaries.length,
          sport: sport || 'all',
          league: league || 'all',
          entityType: entityType || 'all',
          timestamp: new Date().toISOString(),
        },
        source: 'canonical_entities',
      })
    }

    // Fetch all entities using pagination since Supabase has default limits
    let allData: any[] = []
    let hasMore = true
    let offset = 0
    const pageSize = 1000
    
    while (hasMore) {
      // Create a fresh query for each pagination request
      let pageQuery = supabase
        .from('cached_entities')
        .select('id, graph_id, neo4j_id, labels, properties')
      
      // Apply sport filter if provided
      if (sport && sport !== 'all') {
        pageQuery = pageQuery.ilike('properties->>sport', `%${safeLikeTerm(sport)}%`)
      }

      if (league && league !== 'all') {
        const clauses = getLeagueAliases(league)
          .map(safeLikeTerm)
          .flatMap((leagueTerm) => [
            `properties->>league.ilike.%${leagueTerm}%`,
            `properties->>parent_league.ilike.%${leagueTerm}%`,
            `properties->>level.ilike.%${leagueTerm}%`,
          ])
        pageQuery = pageQuery.or(clauses.join(','))
      }
      
      // Apply ordering and pagination
      pageQuery = pageQuery
        .order('properties->>name', { ascending: true })
        .range(offset, offset + pageSize - 1)
      
      const { data: pageData, error: pageError } = await pageQuery
      
      if (pageError) {
        console.error('❌ Summary API pagination error:', pageError)
        throw pageError
      }
      
      if (pageData && pageData.length > 0) {
        console.log(`📄 Fetched page ${Math.floor(offset/pageSize) + 1}: ${pageData.length} entities`)
        allData = [...allData, ...pageData]
        offset += pageSize
        
        // If we got less than a full page, we're done
        if (pageData.length < pageSize) {
          hasMore = false
          console.log(`✅ Last page reached, total fetched: ${allData.length}`)
        }
      } else {
        hasMore = false
        console.log(`✅ No more data, total fetched: ${allData.length}`)
      }
    }

    const canonicalRows = dedupeCanonicalEntities(allData)

    const filteredData = canonicalRows.filter((entity) => {
      if (!entityType || entityType === 'all') return true
      return canonicalizeEntityType(entity) === entityType
    })
    
    const summaries = filteredData.map((entity) => {
      const stableId = resolveStableEntityId(entity) || String(entity.id)
      const properties = entity.properties || {}
      return {
        id: stableId,
        source_id: String(entity.id),
        graph_id: stableId,
        neo4j_id: entity.neo4j_id || stableId,
        name: properties.name || stableId,
        type: properties.type || entity.labels?.[0] || 'Entity',
        entity_type: canonicalizeEntityType(entity),
        sport: getEntitySport(entity),
        country: properties.country || '',
        level: properties.level || '',
        league: canonicalizeLeagueName(getEntityLeague(entity)),
      }
    })
    
    console.log(`✅ Summary API: Found ${summaries.length} canonical entity summaries`)
    
    // Return lightweight entity summaries
    return NextResponse.json({
      entities: summaries,
      summary: {
        count: summaries.length,
        total: summaries.length,
        sport: sport || 'all',
        league: league || 'all',
        entityType: entityType || 'all',
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ Failed to fetch entity summaries:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch entity summaries' },
      { status: 500 }
    )
  }
}
