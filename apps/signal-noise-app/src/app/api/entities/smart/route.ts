import { NextRequest, NextResponse } from 'next/server'
import { EntityCacheService } from '@/services/EntityCacheService'

const cacheService = new EntityCacheService()

// Smart entity loading endpoint with priority-based caching
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Smart loading parameters
    const context = searchParams.get('context') || 'general' // 'leaguenav', 'search', 'browse', 'general'
    const priorityParam = searchParams.get('priority') || 'all'
    const limit = parseInt(searchParams.get('limit') || '2000')
    const entityType = searchParams.get('entityType') || ''
    const search = searchParams.get('search') || ''
    const sortBy = searchParams.get('sortBy') || 'name'
    const sortOrder = searchParams.get('sortOrder') || 'asc'
    
    // Parse priority parameter
    let priority: number | 'all' = 'all'
    if (priorityParam !== 'all') {
      const parsedPriority = parseInt(priorityParam)
      if (!isNaN(parsedPriority)) {
        priority = parsedPriority
      }
    }
    
    console.log(`🧠 Smart entity API request:`, {
      context,
      priority,
      limit,
      entityType,
      search: search ? `"${search}"` : 'none',
      sortBy,
      sortOrder
    })
    
    // Initialize cache service
    if (!cacheService.isInitialized) {
      await cacheService.initialize()
      cacheService.isInitialized = true
    }
    
    // Use smart loading based on context
    const startTime = performance.now()
    
    const result = await cacheService.getSmartEntities({
      context: context as any,
      priority,
      entityType,
      search,
      limit,
      sortBy,
      sortOrder: sortOrder as 'asc' | 'desc'
    })
    
    const duration = performance.now() - startTime
    
    console.log(`🧠 Smart entity loading complete:`, {
      entitiesReturned: result.entities.length,
      duration: `${duration.toFixed(2)}ms`,
      context,
      hasMore: result.pagination.hasMore
    })
    
    return NextResponse.json({
      ...result,
      metadata: {
        loadingStrategy: 'smart_priority',
        context,
        duration: `${duration.toFixed(2)}ms`,
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('❌ Smart entities API error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch smart entities',
        entities: [],
        pagination: { total: 0, hasMore: false }
      },
      { status: 500 }
    )
  }
}

// Progressive loading endpoint for background entity loading
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      loadedPriorities = [], 
      targetPriority, 
      context = 'general',
      entityType = '',
      search = '',
      sortBy = 'name',
      sortOrder = 'asc'
    } = body
    
    console.log(`🔄 Progressive entity loading request:`, {
      loadedPriorities,
      targetPriority,
      context
    })
    
    // Initialize cache service
    if (!cacheService.isInitialized) {
      await cacheService.initialize()
      cacheService.isInitialized = true
    }
    
    const startTime = performance.now()
    
    const result = await cacheService.getProgressiveEntities(
      loadedPriorities, 
      targetPriority, 
      {
        entityType,
        search,
        sortBy,
        sortOrder: sortOrder as 'asc' | 'desc'
      }
    )
    
    const duration = performance.now() - startTime
    
    console.log(`🔄 Progressive loading complete:`, {
      newEntities: result.entities.length,
      duration: `${duration.toFixed(2)}ms`,
      prioritiesLoaded: result.pagination.prioritiesLoaded
    })
    
    return NextResponse.json({
      ...result,
      metadata: {
        loadingStrategy: 'progressive',
        context,
        duration: `${duration.toFixed(2)}ms`,
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('❌ Progressive entities API error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to load progressive entities',
        entities: [],
        pagination: { total: 0 }
      },
      { status: 500 }
    )
  }
}

// Priority statistics endpoint for monitoring and debugging
export async function PUT(request: NextRequest) {
  try {
    console.log(`📊 Priority stats request`)
    
    // Initialize cache service
    if (!cacheService.isInitialized) {
      await cacheService.initialize()
      cacheService.isInitialized = true
    }
    
    const stats = await cacheService.getPriorityStats()
    
    return NextResponse.json({
      ...stats,
      metadata: {
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('❌ Priority stats API error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get priority stats'
      },
      { status: 500 }
    )
  }
}