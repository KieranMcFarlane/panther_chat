import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Mark route as dynamic to prevent static generation
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase is not configured')
  }

  return createClient(supabaseUrl, supabaseKey)
}

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

    console.log('🔗 API: Fetching cached relationships directly from Supabase')

    const supabase = getSupabaseClient()
    const start = (page - 1) * limit
    let query = supabase
      .from('entity_relationships')
      .select('*', { count: 'exact' })
      .eq('is_active', true)

    if (relationshipType) {
      query = query.eq('relationship_type', relationshipType)
    }

    if (sourceName) {
      query = query.ilike('source_name', `%${sourceName}%`)
    }

    if (targetName) {
      query = query.ilike('target_name', `%${targetName}%`)
    }

    if (sourceNeo4jId) {
      query = query.eq('source_neo4j_id', sourceNeo4jId)
    }

    if (targetNeo4jId) {
      query = query.eq('target_neo4j_id', targetNeo4jId)
    }

    const { data, error, count } = await query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(start, start + limit - 1)

    if (error) throw error

    const relationships = data || []
    const total = count || 0

    console.log(`✅ API: Returning ${relationships.length} cached relationships`)

    return NextResponse.json({
      relationships,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: start + limit < total,
        hasPrev: page > 1
      },
      filters: { relationshipType, sourceName, targetName, sourceNeo4jId, targetNeo4jId, sortBy, sortOrder },
      totalAvailable: total
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
  return NextResponse.json(
    { error: 'Relationship sync is disabled in the fast cache route. Use the offline sync job instead.' },
    { status: 405 }
  )
}
