import { NextRequest, NextResponse } from 'next/server'
import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
import { resolveGraphId } from '@/lib/graph-id'
import { searchEntityEmbeddings } from '@/lib/embeddings'
import {
  canonicalEntityType,
  computeHybridScore,
  extractVectorMetadata,
  filterByFacets,
  readLeague,
} from '@/lib/entity-search-utils.js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type SearchEntity = {
  id: string
  graph_id: string
  name: string
  type: string
  sport: string
  league: string
  country: string
}

type RankedEntity = SearchEntity & {
  _score: number
  _sources: Set<string>
}

const DEFAULT_OVERSCAN = 400

function getFacetFilters(searchParams: URLSearchParams) {
  const sport = (searchParams.get('sport') || '').trim()
  const league = (searchParams.get('league') || '').trim()
  const country = (searchParams.get('country') || '').trim()
  const entityType = (searchParams.get('entityType') || '').trim()

  return {
    sport: sport && sport !== 'all' ? sport : '',
    league: league && league !== 'all' ? league : '',
    country: country && country !== 'all' ? country : '',
    entityType: entityType && entityType !== 'all' ? entityType : '',
  }
}

function buildScoredResult({
  query,
  name,
  vectorSimilarity,
  facets,
  candidate,
}: {
  query: string
  name: string
  vectorSimilarity: number
  facets: ReturnType<typeof getFacetFilters>
  candidate: { labels?: string[]; properties?: Record<string, any>; sport?: string; league?: string; type?: string; country?: string }
}): number {
  return computeHybridScore({
    query,
    name,
    vectorSimilarity,
    facets,
    candidate,
  })
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now()
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') || 'browse'
    const search = (searchParams.get('search') || '').trim()
    const facets = getFacetFilters(searchParams)
    const defaultLimit = mode === 'autocomplete' ? 8 : 20
    const limit = Math.max(1, Math.min(Math.floor(parseInt(searchParams.get('limit') || String(defaultLimit))), 100))
    const overscanLimit = Math.max(Math.min(limit * 12, 1200), DEFAULT_OVERSCAN)

    let query = supabase
      .from('cached_entities')
      .select('id, graph_id, neo4j_id, labels, properties')
      .limit(overscanLimit)

    if (facets.sport) {
      query = query.ilike('properties->>sport', `%${facets.sport.replace(/%/g, '')}%`)
    }

    if (facets.country) {
      query = query.ilike('properties->>country', `%${facets.country.replace(/%/g, '')}%`)
    }

    if (search.trim()) {
      query = query.or(
        `properties->>name.ilike.%${search}%,properties->>description.ilike.%${search}%,properties->>type.ilike.%${search}%,properties->>entity_type.ilike.%${search}%,properties->>sport.ilike.%${search}%,properties->>country.ilike.%${search}%,properties->>league.ilike.%${search}%,properties->>level.ilike.%${search}%,properties->>aliases.ilike.%${search}%,properties->>alias.ilike.%${search}%`
      )
    }

    const { data, error } = await query
      .order('properties->>yellowPantherPriority', { ascending: false, nullsFirst: false })
      .order('properties->>priorityScore', { ascending: false, nullsFirst: false })
      .order('properties->>name', { ascending: true, nullsFirst: false })

    if (error) {
      throw error
    }

    const merged = new Map<string, RankedEntity>()

    for (const entity of data || []) {
      const stableId = resolveGraphId(entity) || entity.id
      const name = entity.properties?.name || stableId || `Entity ${entity.id}`
      const type = canonicalEntityType(entity)
      const sport = entity.properties?.sport || ''
      const league = readLeague(entity.properties || {})
      const country = entity.properties?.country || ''
      const candidate = {
        labels: entity.labels || [],
        properties: entity.properties || {},
      }

      if (!filterByFacets(candidate, facets)) {
        continue
      }

      const hybridScore = buildScoredResult({
        query: search,
        name: String(name),
        vectorSimilarity: 0,
        facets,
        candidate,
      }) + Number(entity.properties?.priorityScore || entity.properties?.yellowPantherPriority || 0)

      merged.set(String(stableId), {
        id: stableId,
        graph_id: stableId,
        name,
        type,
        sport,
        league,
        country,
        _score: hybridScore,
        _sources: new Set(['lexical']),
      })
    }

    const canUseVector = Boolean(search) && Boolean(process.env.OPENAI_API_KEY)
    if (canUseVector) {
      try {
        const vectorResults = await searchEntityEmbeddings(search, {
          matchThreshold: 0.15,
          matchCount: overscanLimit,
        })

        for (const vectorResult of vectorResults) {
          const meta = extractVectorMetadata(vectorResult)
          const graphId = String(vectorResult.metadata?.neo4j_id || vectorResult.entity_id || vectorResult.id)
          const name = vectorResult.name || graphId
          const candidate = {
            labels: vectorResult.metadata?.labels || vectorResult.metadata?.original_labels || [],
            properties: {
              ...(vectorResult.metadata?.properties || {}),
              type: meta.type,
              sport: meta.sport,
              league: meta.league,
            },
            sport: meta.sport,
            league: meta.league,
            type: meta.type,
            country: vectorResult.metadata?.properties?.country || '',
          }

          if (!filterByFacets(candidate, facets)) {
            continue
          }

          const score = buildScoredResult({
            query: search,
            name,
            vectorSimilarity: Number(vectorResult.similarity || 0),
            facets,
            candidate,
          })

          const existing = merged.get(graphId)
          if (!existing) {
            merged.set(graphId, {
              id: graphId,
              graph_id: graphId,
              name,
              type: meta.type,
              sport: meta.sport,
              league: meta.league,
              country: vectorResult.metadata?.properties?.country || '',
              _score: score,
              _sources: new Set(['vector']),
            })
          } else {
            existing._score = Math.max(existing._score, score + 5)
            existing._sources.add('vector')
          }
        }
      } catch (vectorError) {
        console.warn('Hybrid vector branch failed; continuing lexical-only:', vectorError)
      }
    }

    const ranked = Array.from(merged.values())

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
      search_strategy: search
        ? (canUseVector ? 'hybrid_lexical_vector' : 'lexical_only')
        : 'popular',
      source: 'supabase',
      facets,
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
