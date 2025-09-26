import { NextRequest, NextResponse } from 'next/server'
import { Neo4jService, VectorSearchOptions } from '@/lib/neo4j'

const neo4jService = new Neo4jService()

export async function POST(request: NextRequest) {
  try {
    const { query, limit = 10, threshold = 0.7, entityType } = await request.json()

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    const options: VectorSearchOptions = {
      limit: Number(limit) || 10,
      threshold: Number(threshold) || 0.7,
      entityType: entityType || undefined
    }

    const results = await neo4jService.vectorSearch(query, options)

    return NextResponse.json({
      results,
      query,
      options
    })
  } catch (error) {
    console.error('Vector search error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Vector search failed',
        results: []
      },
      { status: 500 }
    )
  }
}