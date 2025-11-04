import { NextRequest, NextResponse } from 'next/server'
import { EntityCacheService } from '@/services/EntityCacheService'

const cacheService = new EntityCacheService()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { entityIds, entityType, invalidateAll = false } = body
    
    await cacheService.initialize()
    
    if (invalidateAll) {
      // Invalidate entire cache
      const result = await cacheService.invalidateCache()
      return NextResponse.json({
        message: 'Entire entity cache invalidated successfully',
        ...result
      })
    }
    
    if (entityIds && Array.isArray(entityIds) && entityIds.length > 0) {
      // Invalidate specific entities
      const result = await cacheService.invalidateCache(entityIds)
      return NextResponse.json({
        message: `Cache invalidated for ${entityIds.length} entities`,
        ...result
      })
    }
    
    if (entityType) {
      // Invalidate all entities of a specific type
      // This would need to be implemented in the cache service
      return NextResponse.json({
        message: `Cache invalidation for entity type '${entityType}' not yet implemented`,
        success: false
      }, { status: 400 })
    }
    
    return NextResponse.json({
      error: 'No valid invalidation criteria provided',
      success: false
    }, { status: 400 })
    
  } catch (error) {
    console.error('❌ Failed to invalidate cache:', error)
    return NextResponse.json(
      { error: 'Failed to invalidate cache' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    await cacheService.initialize()
    const stats = await cacheService.getCacheStats()
    
    return NextResponse.json({
      message: 'Cache statistics retrieved successfully',
      stats
    })
  } catch (error) {
    console.error('❌ Failed to get cache stats:', error)
    return NextResponse.json(
      { error: 'Failed to get cache stats' },
      { status: 500 }
    )
  }
}