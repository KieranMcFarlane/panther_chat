import { NextRequest, NextResponse } from 'next/server'
import neo4j from 'neo4j-driver'
import { Neo4jService } from '@/lib/neo4j'
import { EntityCacheService } from '@/services/EntityCacheService'

const neo4jService = new Neo4jService()
const cacheService = new EntityCacheService()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    let entityType = searchParams.get('entityType') || ''
    if (entityType === 'all') entityType = ''
    const sortBy = searchParams.get('sortBy') || 'name'
    const sortOrder = searchParams.get('sortOrder') || 'asc'
    const search = searchParams.get('search') || ''
    const useCache = searchParams.get('useCache') !== 'false' // Default to true
    
    if (useCache) {
      // Try to get cached entities from Supabase first with timeout
      try {
        // Set a timeout for cache operations to prevent hanging
        const cachePromise = Promise.resolve().then(async () => {
          // Only initialize if not already initialized
          if (!cacheService['isInitialized']) {
            await cacheService.initialize()
            cacheService['isInitialized'] = true
          }
          return await cacheService.getCachedEntities({
            page,
            limit,
            entityType,
            search,
            sortBy,
            sortOrder: sortOrder as 'asc' | 'desc'
          })
        })
        
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Cache operation timeout')), 15000) // Increased to 15 seconds
        })
        
        const cachedResult = await Promise.race([cachePromise, timeoutPromise]) as any
        
        // If we have cached data, return it
        console.log('Cache result:', cachedResult)
        if (cachedResult.entities.length > 0 || cachedResult.pagination.total === 0) {
          console.log('✅ Using cached data, entities:', cachedResult.entities.length)
          return NextResponse.json({
            ...cachedResult,
            source: 'cache',
            cachedAt: new Date().toISOString()
          })
        } else {
          console.log('⚠️ Cache is empty, falling back to Neo4j')
        }
      } catch (cacheError) {
        console.warn('⚠️ Cache fetch failed, falling back to Neo4j:', cacheError)
        // Continue to Neo4j fallback
      }
    }
    
    // Fallback to Neo4j if cache fails or is disabled
    // Ensure parameters are integers
    const skip = parseInt(((page - 1) * limit).toString())
    const limitInt = parseInt(limit.toString())
    
        
    // Initialize Neo4j with timeout
    const neo4jPromise = Promise.resolve().then(async () => {
      await neo4jService.initialize()
      return neo4jService.getDriver().session()
    })
    
    const neo4jTimeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Neo4j connection timeout')), 10000)
    })
    
    const session = await Promise.race([neo4jPromise, neo4jTimeoutPromise]) as any
    try {
      // Build the WHERE clause for filtering
      let whereClause = ''
      const params: any = { skip: neo4j.int(skip), limit: neo4j.int(limitInt) }
      
      if (search) {
        whereClause = 'WHERE (toLower(n.name) CONTAINS toLower($search) OR toLower(n.description) CONTAINS toLower($search) OR toLower(n.type) CONTAINS toLower($search) OR toLower(n.sport) CONTAINS toLower($search) OR toLower(n.country) CONTAINS toLower($search) OR (n.level IS NOT NULL AND toLower(n.level) CONTAINS toLower($search)))'
        params.search = search
      }
      
      if (entityType) {
        if (whereClause) {
          whereClause += ' AND ($entityType IN labels(n) OR n.type = $entityType)'
        } else {
          whereClause = 'WHERE ($entityType IN labels(n) OR n.type = $entityType)'
        }
        params.entityType = entityType
      }
      
      // Build the ORDER BY clause
      const validSortFields = ['name', 'type', 'sport', 'country', 'priorityScore', 'estimatedValue']
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'name'
      const orderDirection = sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC'
      
      // Get total count for pagination with timeout
      const countQuery = whereClause 
        ? `MATCH (n) ${whereClause} RETURN count(n) as total`
        : 'MATCH (n) RETURN count(n) as total'
      
      const countPromise = session.run(countQuery, params)
      const countTimeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Count query timeout')), 5000)
      })
      
      const countResult = await Promise.race([countPromise, countTimeoutPromise]) as any
      const total = countResult.records[0].get('total').toNumber()
      
            
            
      // Get paginated entities
      const query = `
        MATCH (n)
        ${whereClause}
        RETURN n
        ORDER BY n.${sortField} ${orderDirection}
        SKIP $skip
        LIMIT $limit
      `
      
            
      const result = await session.run(query, params)
      
      const entities = result.records.map(record => {
        const node = record.get('n')
        return {
          id: node.identity.toString(),
          neo4j_id: node.identity.toString(),
          labels: node.labels,
          properties: node.properties
        }
      })
      
      return NextResponse.json({
        entities,
        pagination: {
          page,
          limit: limitInt,
          total,
          totalPages: Math.ceil(total / limitInt),
          hasNext: page * limitInt < total,
          hasPrev: page > 1
        },
        filters: {
          entityType,
          sortBy,
          sortOrder
        },
        source: 'neo4j'
      })
    } finally {
      await session.close()
    }
  } catch (error) {
    console.error('❌ Failed to fetch entities:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch entities' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate entity data against schema
    const requiredFields = ['entity_type', 'name', 'source'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Mock entity creation
    const newEntity = {
      entity_id: `ENTITY_${Date.now()}`,
      ...body,
      last_updated: new Date().toISOString(),
      vector_embedding: body.vector_embedding || [0.1, 0.2, 0.3]
    };

    return NextResponse.json({
      entity: newEntity,
      message: 'Entity created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating entity:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create entity' },
      { status: 500 }
    );
  }
}





