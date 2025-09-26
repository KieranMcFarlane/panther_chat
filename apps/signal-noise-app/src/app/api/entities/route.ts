import { NextRequest, NextResponse } from 'next/server'
import neo4j from 'neo4j-driver'
import { Neo4jService } from '@/lib/neo4j'

const neo4jService = new Neo4jService()

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
    
    // Ensure parameters are integers
    const skip = parseInt(((page - 1) * limit).toString())
    const limitInt = parseInt(limit.toString())
    
        
    await neo4jService.initialize()
    
    const session = neo4jService.driver.session()
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
      
      // Get total count for pagination
      const countQuery = whereClause 
        ? `MATCH (n) ${whereClause} RETURN count(n) as total`
        : 'MATCH (n) RETURN count(n) as total'
      
            
      const countResult = await session.run(countQuery, params)
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
        }
      })
    } finally {
      await session.close()
    }
  } catch (error) {
    console.error('❌ Failed to fetch entities:', error)
    return NextResponse.json(
      { error: 'Failed to fetch entities' },
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
      { error: 'Failed to create entity' },
      { status: 500 }
    );
  }
}





