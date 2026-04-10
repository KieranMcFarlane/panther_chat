import { NextRequest, NextResponse } from 'next/server'
import { searchVectorEntities } from '@/lib/vector-search-service'
import { toLegacySearchResponse } from '@/lib/vector-search-service'

export async function POST(request: NextRequest) {
  try {
    const { query, searchType, options = {} } = await request.json()

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    const vectorResponse = await searchVectorEntities(
      {
        query,
        limit: Math.max(1, Math.min(Number(options.limit || 12), 50)),
        score_threshold: Number(options.threshold || 0.7),
        entity_type: options.entityType || null,
        searchType,
      },
      { baseUrl: request.nextUrl.origin }
    )

    return NextResponse.json(toLegacySearchResponse(vectorResponse, searchType, options))
  } catch (error) {
    console.error('❌ Search failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    )
  }
}
