import { NextRequest, NextResponse } from 'next/server'
import { getCanonicalEntitiesSnapshot } from '@/lib/canonical-entities-snapshot'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sport = searchParams.get('sport') || ''
    
    console.log(`📊 Summary API: Fetching entity summaries for sport: ${sport || 'all'}`)
    const canonicalEntities = await getCanonicalEntitiesSnapshot()
    const filteredEntities = canonicalEntities.filter((entity) => {
      if (!sport || sport === 'all') {
        return true
      }

      return String(entity.properties?.sport || '') === sport
    })

    const summaryEntities = filteredEntities.map((entity) => ({
      id: entity.id,
      neo4j_id: entity.neo4j_id,
      name: entity.properties.name,
      type: entity.properties.type,
      sport: entity.properties.sport,
      country: entity.properties.country,
      level: entity.properties.level,
      league: entity.properties.league,
    }))

    console.log(`✅ Summary API: Returned ${summaryEntities.length} canonical summaries`)

    return NextResponse.json({
      entities: summaryEntities,
      summary: {
        count: summaryEntities.length,
        total: filteredEntities.length,
        sport: sport || 'all',
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
