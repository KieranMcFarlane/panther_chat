import { NextRequest, NextResponse } from 'next/server'
import neo4j from 'neo4j-driver'
import { Neo4jService } from '@/lib/neo4j'
import { EntityCacheService } from '@/services/EntityCacheService'

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

    console.log(`📖 Fetching entities from Supabase: page=${page}, limit=${limit}, search=${search || 'none'}`)

    // Use Supabase as primary source (FalkorDB connection issues)
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://itlcuazbybqlkicsaola.supabase.co'
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0bGN1YXpieWJxbGtpY3Nhb2xhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwOTc0MTQsImV4cCI6MjA3NDY3MzQxNH0.UXXSbe1Kk0CH7NkIGnwo3_qmJVV3VUbJz4Dw8lBGcKU'
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Build the base query
    let query = supabase
      .from('cached_entities')
      .select('*', { count: 'exact' })

    // Apply search filter if provided
    if (search) {
      query = query.or(`name.ilike.%${search}%,properties->>type.ilike.%${search}%,properties->>sport.ilike.%${search}%,properties->>country.ilike.%${search}%,properties->>description.ilike.%${search}%`)
    }

    // Apply entity type filter if provided
    if (entityType && entityType !== 'all') {
      query = query.filter('labels', 'cs', `[\"${entityType}\"]`)
    }

    // Apply ordering
    const sortField = 'properties->>name'
    const ascending = sortOrder.toLowerCase() !== 'desc'
    query = query.order(sortField, { ascending })

    // Apply pagination
    const start = (page - 1) * limit
    query = query.range(start, start + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('❌ Supabase query error:', error)
      throw error
    }

    const entities = data || []
    const total = count || 0

    console.log(`✅ Supabase query successful: ${entities.length} entities, total: ${total}`)

    // Transform to match expected format
    const transformedEntities = entities.map((entity: any) => ({
      id: entity.id,
      neo4j_id: entity.neo4j_id,
      labels: entity.labels || [],
      properties: {
        ...entity.properties,
        name: entity.properties?.name || entity.neo4j_id,
        type: entity.properties?.type || entity.labels?.[0] || 'ENTITY'
      }
    }))

    return NextResponse.json({
      entities: transformedEntities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: start + limit < total,
        hasPrev: page > 1
      },
      filters: {
        entityType,
        sortBy,
        sortOrder
      },
      source: 'supabase'
    })

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
