import { NextRequest, NextResponse } from 'next/server'
import { EntityCacheService } from '@/services/EntityCacheService'
import { runPostImportCanonicalMaintenance } from '@/lib/post-import-canonical-maintenance'

const cacheService = new EntityCacheService()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { entityType, batchSize, forceRefresh } = body
    
    await cacheService.initialize()
    
    const result = await cacheService.syncEntitiesFromGraph({
      entityType: entityType || 'all',
      batchSize: batchSize || 100,
      forceRefresh: forceRefresh || false
    })
    const canonicalMaintenance = await runPostImportCanonicalMaintenance('entities-cache-sync')
    
    return NextResponse.json({
      message: 'Entity cache sync completed successfully',
      ...result,
      canonicalMaintenance
    })
    
  } catch (error) {
    console.error('❌ Failed to sync entity cache:', error)
    return NextResponse.json(
      { error: 'Failed to sync entity cache' },
      { status: 500 }
    )
  }
}
