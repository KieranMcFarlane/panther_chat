import { NextRequest, NextResponse } from 'next/server'
import { EntityCacheService } from '@/services/EntityCacheService'
import { runPostImportCanonicalMaintenanceWithOptions } from '@/lib/post-import-canonical-maintenance'
import { randomUUID } from 'node:crypto'

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
    const syncRunId = randomUUID()
    const canonicalMaintenance = await runPostImportCanonicalMaintenanceWithOptions('entities-cache-sync', {
      syncRunId,
      metadata: {
        entityType: entityType || 'all',
        batchSize: batchSize || 100,
        forceRefresh: forceRefresh || false,
      },
    })
    
    return NextResponse.json({
      message: 'Entity cache sync completed successfully',
      syncRunId,
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
