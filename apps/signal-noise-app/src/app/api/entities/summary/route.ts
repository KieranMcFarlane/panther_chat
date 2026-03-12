import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-client'
import { resolveGraphId } from '@/lib/graph-id'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sport = searchParams.get('sport') || ''
    const supabase = getSupabaseAdmin()
    
    console.log(`📊 Summary API: Fetching entity summaries for sport: ${sport || 'all'}`)
    
    // Build the base query for lightweight entity summaries
    let query = supabase
      .from('cached_entities')
      .select(`
        id,
        graph_id,
        neo4j_id,
        properties->>name,
        properties->>type,
        properties->>sport,
        properties->>country,
        properties->>level,
        properties->>league
      `, { count: 'exact' })
    
    // Apply sport filter if provided
    if (sport && sport !== 'all') {
      query = query.eq('properties->>sport', sport)
    }
    
    // Apply ordering
    query = query.order('properties->>name', { ascending: true })
    
    // Fetch all entities using pagination since Supabase has default limits
    let allData: any[] = []
    let hasMore = true
    let offset = 0
    const pageSize = 1000
    
    while (hasMore) {
      // Create a fresh query for each pagination request
      let pageQuery = supabase
        .from('cached_entities')
        .select(`
          id,
          graph_id,
          neo4j_id,
          properties->>name,
          properties->>type,
          properties->>sport,
          properties->>country,
          properties->>level,
          properties->>league
        `)
      
      // Apply sport filter if provided
      if (sport && sport !== 'all') {
        pageQuery = pageQuery.eq('properties->>sport', sport)
      }
      
      // Apply ordering and pagination
      pageQuery = pageQuery
        .order('properties->>name', { ascending: true })
        .range(offset, offset + pageSize - 1)
      
      const { data: pageData, error: pageError } = await pageQuery
      
      if (pageError) {
        console.error('❌ Summary API pagination error:', pageError)
        throw pageError
      }
      
      if (pageData && pageData.length > 0) {
        console.log(`📄 Fetched page ${Math.floor(offset/pageSize) + 1}: ${pageData.length} entities`)
        allData = [...allData, ...pageData]
        offset += pageSize
        
        // If we got less than a full page, we're done
        if (pageData.length < pageSize) {
          hasMore = false
          console.log(`✅ Last page reached, total fetched: ${allData.length}`)
        }
      } else {
        hasMore = false
        console.log(`✅ No more data, total fetched: ${allData.length}`)
      }
    }
    
    // Get total count
    const { count } = await supabase
      .from('cached_entities')
      .select('*', { count: 'exact', head: true })
    
    console.log(`✅ Summary API: Found ${allData?.length || 0} entity summaries, total: ${count || 0}`)
    
    // Return lightweight entity summaries
    return NextResponse.json({
      entities: (allData || []).map((entity: any) => ({
        id: entity.id,
        graph_id: resolveGraphId(entity) || entity.id,
        name: entity.name,
        type: entity.type,
        sport: entity.sport,
        country: entity.country,
        level: entity.level,
        league: entity.league,
      })),
      summary: {
        count: allData?.length || 0,
        total: count || 0,
        sport: sport || 'all',
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ Failed to fetch entity summaries:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch entity summaries' },
      { status: 500 }
    )
  }
}
