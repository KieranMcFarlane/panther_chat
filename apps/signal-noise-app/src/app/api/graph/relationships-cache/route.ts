import { NextRequest, NextResponse } from 'next/server'
import { EntityCacheService } from '@/services/EntityCacheService'

// Mark route as dynamic to prevent static generation
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const relationshipType = searchParams.get('relationshipType') || ''
    const sourceName = searchParams.get('sourceName') || ''
    const targetName = searchParams.get('targetName') || ''
    const sourceNeo4jId = searchParams.get('sourceNeo4jId') || ''
    const targetNeo4jId = searchParams.get('targetNeo4jId') || ''
    const sortBy = searchParams.get('sortBy') || 'relationship_type'
    const sortOrder = searchParams.get('sortOrder') as 'asc' | 'desc' || 'asc'

    console.log('🔗 API: Fetching cached relationships from Supabase')
    
    const cacheService = new EntityCacheService()
    await cacheService.initialize()
    
    const result = await cacheService.getCachedRelationships({
      page,
      limit,
      relationshipType,
      sourceName,
      targetName,
      sourceNeo4jId,
      targetNeo4jId,
      sortBy,
      sortOrder
    })
    
    console.log(`✅ API: Returning ${result.relationships.length} cached relationships`)
    
    return NextResponse.json({
      relationships: result.relationships,
      pagination: result.pagination,
      filters: result.filters,
      totalAvailable: result.pagination.total
    })
    
  } catch (error) {
    console.error('❌ API: Failed to fetch cached relationships:', error)
    return NextResponse.json(
      { error: 'Failed to fetch cached relationships', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action = 'sync', options = {} } = body
    
    if (action === 'sync') {
      console.log('🔄 API: Syncing relationships from Neo4j to Supabase cache')
      
      const cacheService = new EntityCacheService()
      await cacheService.initialize()
      
      const result = await cacheService.syncRelationshipsFromNeo4j(options)
      
      console.log(`✅ API: Relationship sync complete: ${result.synced} synced, ${result.errors} errors`)
      
      return NextResponse.json({
        success: true,
        result,
        message: `Successfully synced ${result.synced} relationships`
      })
    }
    
    return NextResponse.json(
      { error: 'Invalid action', availableActions: ['sync'] },
      { status: 400 }
    )
    
  } catch (error) {
    console.error('❌ API: Failed to process relationship request:', error)
    return NextResponse.json(
      { error: 'Failed to process request', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}