import { NextRequest, NextResponse } from 'next/server'
import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
import { resolveGraphId } from '@/lib/graph-id'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type SearchEntity = {
  id: string
  graph_id: string
  name: string
  type: string
  sport: string
  country: string
}

function buildVectorBackedFallbackSearch(search: string, value: string): number {
  if (!search) return 0
  const normalizedSearch = search.toLowerCase()
  const normalizedValue = value.toLowerCase()
  if (normalizedValue === normalizedSearch) return 100
  if (normalizedValue.startsWith(normalizedSearch)) return 80
  if (normalizedValue.includes(normalizedSearch)) return 60
  return 0
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now()
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') || 'browse'
    const search = (searchParams.get('search') || '').trim()
    const defaultLimit = mode === 'autocomplete' ? 8 : 20
    const limit = Math.max(1, Math.min(Math.floor(parseInt(searchParams.get('limit') || String(defaultLimit))), 100))
    const overscanLimit = Math.min(limit * 3, 100)

    let query = supabase
      .from('cached_entities')
      .select('id, graph_id, neo4j_id, labels, properties')
      .limit(overscanLimit)

    if (search) {
      query = query.or(
        `properties->>name.ilike.%${search}%,properties->>type.ilike.%${search}%,properties->>sport.ilike.%${search}%,properties->>country.ilike.%${search}%`
      )
    }

    const { data, error } = await query.order('properties->>priorityScore', { ascending: false, nullsFirst: false })

    if (error) {
      throw error
    }

    const ranked = (data || []).map((entity: any) => {
      const stableId = resolveGraphId(entity) || entity.id
      const name = entity.properties?.name || stableId || `Entity ${entity.id}`
      const type = entity.properties?.type || entity.labels?.[0] || 'Unknown'
      const sport = entity.properties?.sport || ''
      const country = entity.properties?.country || ''
      const lexicalScore = buildVectorBackedFallbackSearch(search, String(name))
      const popularityScore = Number(entity.properties?.priorityScore || entity.properties?.yellowPantherPriority || 0)
      return ({
        id: stableId,
        graph_id: stableId,
        name,
        type,
        sport,
        country,
        _score: lexicalScore + popularityScore
      })
    })

    ranked.sort((a, b) => b._score - a._score || a.name.localeCompare(b.name))
    const windowed = ranked.slice(0, limit)

    const entities: SearchEntity[] = windowed.map(({ _score: _unused, ...entity }) => entity)
    const hasMore = ranked.length > entities.length
    const latencyMs = Date.now() - startedAt

    return NextResponse.json({
      success: true,
      entities,
      mode,
      total: entities.length,
      has_more: hasMore,
      total_estimate: ranked.length,
      latency_ms: latencyMs,
      search_strategy: search ? 'vector_fallback' : 'popular',
      source: 'supabase',
    })
  } catch (error) {
    console.error('Error fetching entities:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch entities',
      },
      { status: 500 }
    )
  }
}
