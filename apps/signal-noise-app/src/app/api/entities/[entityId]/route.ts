import { NextRequest, NextResponse } from 'next/server'
import { Neo4jService } from '@/lib/neo4j'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

interface Entity {
  id: string
  neo4j_id: string | number
  labels: string[]
  properties: Record<string, any>
}

interface Connection {
  relationship: string
  target: string
  target_type: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: { entityId: string } }
) {
  try {
    const { entityId } = params
    
    // Validate entityId parameter
    if (!entityId) {
      return NextResponse.json(
        { error: 'Entity ID is required' },
        { status: 400 }
      )
    }
    const { searchParams } = new URL(request.url)
    const useCache = searchParams.get('useCache') !== 'false' // Default to true
    
    let entity: Entity | null = null
    let connections: Connection[] = []
    let source: 'cache' | 'neo4j' | null = null

    // Try to get from Supabase cache first
    if (useCache) {
      try {
        const { data: cachedEntity, error } = await supabase
          .from('cached_entities')
          .select('*')
          .eq('neo4j_id', entityId)
          .single()

        if (!error && cachedEntity) {
          entity = {
            id: cachedEntity.id,
            neo4j_id: cachedEntity.neo4j_id,
            labels: cachedEntity.labels,
            properties: cachedEntity.properties
          }
          source = 'cache'
        }
      } catch (cacheError) {
        console.log('Cache miss, falling back to Neo4j:', cacheError)
      }
    }

    // If not found in cache or cache disabled, get from Neo4j
    if (!entity) {
      let session;
      try {
        const neo4jService = new Neo4jService()
        await neo4jService.initialize()
        session = neo4jService.driver.session()
      } catch (neo4jError) {
        console.error('Failed to initialize Neo4j:', neo4jError)
        return NextResponse.json(
          { error: neo4jError instanceof Error ? neo4jError.message : 'Failed to connect to database' },
          { status: 500 }
        )
      }
      try {
        // Get entity details
        const entityResult = await session.run(`
          MATCH (n) 
          WHERE id(n) = $entityId
          RETURN n
        `, { entityId: parseInt(entityId) || 0 })

        if (entityResult.records.length > 0) {
          const node = entityResult.records[0].get('n')
          entity = {
            id: node.identity.toString(),
            neo4j_id: node.identity.toString(),
            labels: node.labels,
            properties: node.properties
          }
          source = 'neo4j'

          // Get connections
          const connectionResult = await session.run(`
            MATCH (n)-[r]-(related)
            WHERE id(n) = $entityId
            RETURN type(r) as relationship, 
                   related.name as target, 
               labels(related)[0] as target_type
            LIMIT 50
          `, { entityId: parseInt(entityId) || 0 })

          connections = connectionResult.records.map(record => ({
            relationship: record.get('relationship'),
            target: record.get('target') || 'Unnamed',
            target_type: record.get('target_type') || 'Unknown'
          }))
        }
      } finally {
        if (session) {
          await session.close()
        }
      }
    }

    if (!entity) {
      return NextResponse.json(
        { error: 'Entity not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      entity,
      connections,
      source
    })

  } catch (error) {
    console.error('❌ Failed to fetch entity details:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch entity details' },
      { status: 500 }
    )
  }
}