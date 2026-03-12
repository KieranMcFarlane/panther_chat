import { NextRequest, NextResponse } from 'next/server'
import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
import { resolveGraphId } from '@/lib/graph-id'

function buildSearchHaystack(properties: Record<string, any>): string {
  return [
    properties?.name,
    properties?.type,
    properties?.sport,
    properties?.country,
    properties?.description,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function computeSimilarity(query: string, properties: Record<string, any>): number {
  const normalizedQuery = query.trim().toLowerCase()
  const haystack = buildSearchHaystack(properties)
  const name = String(properties?.name || '').toLowerCase()

  if (!normalizedQuery || !haystack.includes(normalizedQuery)) {
    return 0
  }

  if (name === normalizedQuery) return 1
  if (name.startsWith(normalizedQuery)) return 0.96
  if (name.includes(normalizedQuery)) return 0.9
  return 0.8
}

export async function POST(request: NextRequest) {
  try {
    const { query, searchType, options = {} } = await request.json()

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    console.log('🔍 Searching Supabase cached entities:', { query, searchType, options })

    const limit = Math.max(1, Math.min(Number(options.limit) || 12, 50))
    const entityType = options.entityType ? String(options.entityType) : ''
    const threshold = Number(options.threshold) || 0.7

    let supabaseQuery = supabase
      .from('cached_entities')
      .select('id, graph_id, neo4j_id, labels, properties')
      .limit(limit * 4)

    if (entityType) {
      supabaseQuery = supabaseQuery.contains('labels', [entityType])
    }

    const { data, error } = await supabaseQuery

    if (error) {
      throw error
    }

    const results = (data || [])
      .map((row: any) => {
        const stableId = resolveGraphId(row) || row.id
        const similarity = computeSimilarity(query, row.properties || {})
        return {
          entity: {
            id: stableId,
            graph_id: stableId,
            labels: row.labels || [],
            properties: {
              ...row.properties,
              graph_id: stableId,
              name: row.properties?.name || stableId,
            },
          },
          similarity,
          connections: [],
        }
      })
      .filter((result) => result.similarity >= threshold)
      .sort((left, right) => right.similarity - left.similarity)
      .slice(0, limit)

    console.log(`✅ Found ${results.length} results for query: "${query}"`)

    return NextResponse.json({
      results,
      searchType,
      query,
      options,
      source: 'supabase',
    })
  } catch (error) {
    console.error('❌ Search failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    )
  }
}
