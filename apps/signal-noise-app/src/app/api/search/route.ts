import { NextRequest, NextResponse } from 'next/server'
import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
import { resolveGraphId } from '@/lib/graph-id'
import { resolveEntityUuid } from '@/lib/entity-public-id'

export async function POST(request: NextRequest) {
  try {
    const { query, searchType, options = {} } = await request.json()
    
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    console.log('🔍 Searching cached entities:', { query, searchType, options })

    const limit = Math.max(1, Math.min(Number(options.limit || 12), 50))
    const threshold = Number(options.threshold || 0.7)
    const normalized = String(query || '').trim().toLowerCase()

    const { data, error } = await supabase
      .from('cached_entities')
      .select('id, graph_id, neo4j_id, labels, properties')
      .limit(Math.min(limit * 4, 100))

    if (error) {
      throw error
    }

    const scored = (data || [])
      .map((entity: any) => {
        const graphId = resolveGraphId(entity) || entity.id
        const uuid = resolveEntityUuid({
          id: entity.id,
          neo4j_id: entity.neo4j_id,
          graph_id: entity.graph_id,
          supabase_id: entity.properties?.supabase_id,
          properties: entity.properties,
        }) || graphId
        const name = String(entity.properties?.name || graphId || '')
        const type = String(entity.properties?.type || entity.labels?.[0] || 'Unknown')
        const sport = String(entity.properties?.sport || '')
        const country = String(entity.properties?.country || '')
        const haystack = `${name} ${type} ${sport} ${country}`.toLowerCase()
        let similarity = 0
        if (!normalized) similarity = 0.5
        else if (haystack === normalized) similarity = 1
        else if (haystack.includes(normalized)) similarity = 0.86
        else if (normalized.includes(name.toLowerCase())) similarity = 0.78
        else if (haystack.split(/\s+/).some((part: string) => normalized.includes(part) && part.length > 3)) similarity = 0.72
        return {
          entity: {
            id: uuid,
            labels: entity.labels || [],
            properties: {
              ...(entity.properties || {}),
              name,
              type,
              sport,
              country,
            }
          },
          similarity,
          connections: []
        }
      })
      .filter((row: any) => row.similarity >= threshold)
      .sort((a: any, b: any) => b.similarity - a.similarity)
      .slice(0, limit)

    console.log(`✅ Found ${scored.length} results for query: "${query}"`)

    return NextResponse.json({
      results: scored,
      searchType,
      query,
      options
    })
  } catch (error) {
    console.error('❌ Search failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    )
  }
}
