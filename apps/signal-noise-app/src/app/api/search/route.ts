import { NextRequest, NextResponse } from 'next/server'
import { Neo4jService, VectorSearchOptions } from '@/lib/neo4j'

const neo4jService = new Neo4jService()

export async function POST(request: NextRequest) {
  try {
    const { query, limit = 10, entityType } = await request.json()

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    const options: VectorSearchOptions = {
      limit: Number(limit) || 10,
      entityType: entityType || undefined
    }

    const results = await neo4jService.textSearch(query, options)

    return NextResponse.json({
      results: results.map(entity => ({ entity, similarity: 1.0, connections: [] })),
      query,
      options
    })
  } catch (error) {
    console.error('Text search error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Text search failed',
        results: []
      },
      { status: 500 }
    )
  }
}