import { NextRequest, NextResponse } from 'next/server'
import { Neo4jService } from '@/lib/neo4j'

const neo4jService = new Neo4jService()

export async function POST(request: NextRequest) {
  try {
    const { query, searchType, options = {} } = await request.json()
    
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    console.log('🔍 Searching Neo4j:', { query, searchType, options })

    let results = []
    
    if (searchType === 'vector') {
      // Use vector search with embeddings
      const vectorResults = await neo4jService.vectorSearch(query, {
        limit: options.limit || 12,
        threshold: options.threshold || 0.7,
        entityType: options.entityType
      })
      results = vectorResults
    } else {
      // Use text search
      const textResults = await neo4jService.textSearch(query, {
        limit: options.limit || 12,
        entityType: options.entityType
      })
      // Convert text search results to match vector search format
      results = textResults.map(entity => ({
        entity,
        similarity: 1.0, // Text search doesn't have similarity scores
        connections: []
      }))
    }

    console.log(`✅ Found ${results.length} results for query: "${query}"`)

    return NextResponse.json({
      results,
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