import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { query, searchType, options } = await request.json()
    
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    // For now, return mock results for demonstration
    // In a real implementation, this would connect to the live Neo4j service
    const mockResults = [
      {
        entity: {
          id: '1',
          labels: ['Person', 'Contact'],
          properties: {
            name: 'Arsenal Commercial Director',
            title: 'Commercial Director',
            company: 'Arsenal FC',
            email: 'commercial@arsenal.com',
            source: 'LinkedIn'
          }
        },
        similarity: 0.95,
        connections: [
          { relationship: 'WORKS_AT', target: 'Arsenal FC', target_type: 'Organization' }
        ]
      },
      {
        entity: {
          id: '2',
          labels: ['Organization', 'Club'],
          properties: {
            name: 'Arsenal FC',
            location: 'London, UK',
            source: 'Premier League'
          }
        },
        similarity: 0.88,
        connections: [
          { relationship: 'HAS_DIRECTOR', target: 'Arsenal Commercial Director', target_type: 'Person' }
        ]
      }
    ]

    return NextResponse.json({
      results: mockResults,
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