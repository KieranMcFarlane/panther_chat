import { Neo4jService } from '@/lib/neo4j'
import { createClient } from '@supabase/supabase-js'
import neo4j from 'neo4j-driver'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export interface CachedEntity {
  id: string
  neo4j_id: string
  labels: string[]
  properties: Record<string, any>
  created_at: string
  updated_at: string
  cache_version: number
}

export interface CachedRelationship {
  id: string
  source_neo4j_id: string
  target_neo4j_id: string
  relationship_type: string
  source_element_id: string
  target_element_id: string
  source_labels: string[]
  target_labels: string[]
  source_name: string
  target_name: string
  relationship_properties: Record<string, any>
  direction: 'outgoing' | 'incoming' | 'undirected'
  confidence_score: number
  weight: number
  created_at: string
  updated_at: string
  last_synced_at: string
  sync_version: number
  is_active: boolean
}

export class EntityCacheService {
  private neo4jService: Neo4jService
  private readonly CACHE_TTL = 30 * 60 * 1000 // 30 minutes
  private readonly BATCH_SIZE = 100
  public isInitialized = false

  constructor() {
    this.neo4jService = new Neo4jService()
  }

  async initialize() {
    await this.neo4jService.initialize()
    this.isInitialized = true
  }

  async syncEntitiesFromNeo4j(options: {
    entityType?: string
    batchSize?: number
    forceRefresh?: boolean
  } = {}) {
    const { entityType = '', batchSize = this.BATCH_SIZE, forceRefresh = false } = options
    
    console.log('🔄 Starting entity sync from Neo4j to Supabase...')
    
    const session = await this.neo4jService.getDriver().session()
    
    try {
      // Get total count
      let countQuery = 'MATCH (n) RETURN count(n) as total'
      let countParams: any = {}
      
      if (entityType && entityType !== 'all') {
        countQuery = 'MATCH (n) WHERE ($entityType IN labels(n) OR n.type = $entityType) RETURN count(n) as total'
        countParams = { entityType }
      }
      
      const countResult = await session.run(countQuery, countParams)
      const total = countResult.records[0].get('total').toNumber()
      console.log(`📊 Found ${total} entities to sync`)

      let syncedCount = 0
      let skip = 0
      
      while (skip < total) {
        const entities = await this.getEntityBatch(session, skip, batchSize, entityType)
        
        if (entities.length === 0) break
        
        // Upsert entities to Supabase
        const result = await this.upsertEntitiesToSupabase(entities, forceRefresh)
        syncedCount += result
        
        console.log(`📦 Synced batch ${skip/batchSize + 1}: ${result} entities`)
        
        skip += batchSize
        
        // Small delay to prevent overwhelming the database
        if (skip < total) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
      
      console.log(`✅ Sync completed: ${syncedCount} entities`)
      return { success: true, syncedCount, total }
      
    } catch (error) {
      console.error('❌ Failed to sync entities:', error)
      throw error
    } finally {
      await session.close()
    }
  }

  private async getEntityBatch(session: any, skip: number, limit: number, entityType: string) {
    let query = `
      MATCH (n)
      RETURN n
      ORDER BY n.name
      SKIP $skip
      LIMIT $limit
    `
    let params: any = { skip: skip, limit: limit }
    
    if (entityType && entityType !== 'all') {
      query = `
        MATCH (n)
        WHERE ($entityType IN labels(n) OR n.type = $entityType)
        RETURN n
        ORDER BY n.name
        SKIP $skip
        LIMIT $limit
      `
      params.entityType = entityType
    }
    
    const result = await session.run(query, {
      skip: neo4j.int(skip),
      limit: neo4j.int(limit),
      ...(entityType && entityType !== 'all' && { entityType })
    })
    
    return result.records.map((record: any) => {
      const node = record.get('n')
      return {
        neo4j_id: node.identity.toString(),
        labels: node.labels,
        properties: node.properties,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        cache_version: 1
      }
    })
  }

  private async upsertEntitiesToSupabase(entities: any[], forceRefresh: boolean): Promise<number> {
    try {
      console.log(`🗄️ Upserting ${entities.length} entities to Supabase...`)
      
      const { data, error } = await supabase
        .from('cached_entities')
        .upsert(entities, { onConflict: 'neo4j_id' })
      
      if (error) {
        console.error('❌ Supabase upsert error:', error)
        throw error
      }
      
      console.log(`✅ Successfully upserted ${entities.length} entities`)
      return entities.length
    } catch (error) {
      console.error('❌ Failed to upsert entities to Supabase:', error)
      throw error
    }
  }

  async getCachedEntities(options: {
    page?: number
    limit?: number
    entityType?: string
    search?: string
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
    leagues?: string
  } = {}) {
    const {
      page = 1,
      limit = 20,
      entityType = '',
      search = '',
      sortBy = 'name',
      sortOrder = 'asc',
      leagues = ''
    } = options
    
    const start = (page - 1) * limit
    const end = start + limit - 1
    
    try {
      // Performance optimization: Log query parameters for debugging
      console.log(`📖 Fetching cached entities from Supabase...`, {
        page,
        limit,
        leagues: leagues || 'none',
        search: search || 'none',
        entityType: entityType || 'none'
      })
      
      let query = supabase
        .from('cached_entities')
        .select('*', { count: 'exact' })
      
      // Apply filters
      if (entityType && entityType !== 'all') {
        query = query.contains('labels', [entityType])
      }
      
      // Apply leagues filter with performance logging
      if (leagues) {
        const leagueMap: Record<string, string[]> = {
          'premier': ['Premier League'],
          'laliga': ['LaLiga'],
          'nba': ['NBA'],
          'seriea': ['Serie A'],
          'bundesliga': ['Bundesliga'],
          'ligue1': ['Ligue 1'],
          'all': ['Premier League', 'LaLiga', 'NBA', 'Serie A', 'Bundesliga', 'Ligue 1']
        }
        
        const selectedLeagues = leagues.split(',').flatMap(league => 
          leagueMap[league.trim().toLowerCase()] || []
        )
        
        if (selectedLeagues.length > 0) {
          console.log(`🏆 Optimizing for leagues: ${selectedLeagues.join(', ')} (${selectedLeagues.length} leagues)`)
          query = query.in('properties->>league', selectedLeagues)
        }
      }
      
      if (search) {
        // Use raw SQL query via Supabase for search to overcome client limitations
        console.log(`🔍 Search query detected, using raw SQL approach`)
        console.log(`🔍 Search term: "${search}"`)
        
        try {
          // Build SQL query dynamically
          const searchLower = search.toLowerCase()
          let whereConditions = []
          let params: any[] = []
          
          // Add entity type filter if specified
          if (entityType && entityType !== 'all') {
            whereConditions.push(`entity_type = $${params.length + 1}`)
            params.push(entityType)
          } else {
            whereConditions.push(`(entity_type = '' OR entity_type = 'all' OR entity_type = ANY(labels))`)
          }
          
          // Add search conditions
          const searchConditions = [
            `LOWER(properties->>'name') LIKE $${params.length + 1}`,
            `LOWER(properties->>'description') LIKE $${params.length + 1}`,
            `LOWER(properties->>'type') LIKE $${params.length + 1}`,
            `LOWER(properties->>'sport') LIKE $${params.length + 1}`,
            `LOWER(properties->>'country') LIKE $${params.length + 1}`,
            `(properties->>'level' IS NOT NULL AND LOWER(properties->>'level') LIKE $${params.length + 1})`
          ]
          
          whereConditions.push(`(${searchConditions.join(' OR ')})`)
          params.push(`%${searchLower}%`)
          
          const whereClause = whereConditions.join(' AND ')
          
          // Optimized search approach: Use database-level filtering with appropriate limit
          let searchQuery = supabase
            .from('cached_entities')
            .select('*', { count: 'exact' })
          
          // Apply leagues filter first to reduce dataset size
          if (leagues) {
            const leagueMap: Record<string, string[]> = {
              'premier': ['Premier League'],
              'laliga': ['LaLiga'],
              'nba': ['NBA'],
              'seriea': ['Serie A'],
              'bundesliga': ['Bundesliga'],
              'ligue1': ['Ligue 1'],
              'all': ['Premier League', 'LaLiga', 'NBA', 'Serie A', 'Bundesliga', 'Ligue 1']
            }
            const selectedLeagues = leagues.split(',').flatMap(league => 
              leagueMap[league.trim().toLowerCase()] || []
            )
            if (selectedLeagues.length > 0) {
              searchQuery = searchQuery.in('properties->>league', selectedLeagues)
            }
          }
          
          // Apply entity type filter
          if (entityType && entityType !== 'all') {
            searchQuery = searchQuery.contains('labels', [entityType])
          }
          
          // Use database text search for better performance
          searchQuery = searchQuery.or(`name.ilike.%${searchLower}%,description.ilike.%${searchLower}%,properties->>'type'.ilike.%${searchLower}%,properties->>'sport'.ilike.%${searchLower}%,properties->>'country'.ilike.%${searchLower}%,properties->>'level'.ilike.%${searchLower}%`)
          
          // Apply sorting and pagination  
          const searchStart = (page - 1) * limit
          const sortField = sortBy === 'name' ? 'name' : `properties->>'${sortBy}'`
          searchQuery = searchQuery.order(sortField, { ascending: sortOrder === 'asc' })
          searchQuery = searchQuery.range(searchStart, Math.min(searchStart + limit * 2, 999)) // Reasonable limit for search
          
          const { data: searchResults, error: fetchError } = await searchQuery
          
          if (fetchError) {
            console.error('❌ Cache fetch error:', fetchError)
            throw fetchError
          }
          
          // No additional in-memory filtering needed - database did the work
          const filteredEntities = searchResults || []
          
          // Sort results
          filteredEntities.sort((a, b) => {
            const aProp = a.properties[sortBy] || ''
            const bProp = b.properties[sortBy] || ''
            
            if (sortBy === 'priorityScore' || sortBy === 'estimatedValue') {
              const aNum = parseFloat(aProp) || 0
              const bNum = parseFloat(bProp) || 0
              return sortOrder === 'desc' ? bNum - aNum : aNum - bNum
            }
            
            const aStr = aProp.toString().toLowerCase()
            const bStr = bProp.toString().toLowerCase()
            return sortOrder === 'desc' ? bStr.localeCompare(aStr) : aStr.localeCompare(bStr)
          })
          
          // Apply pagination
          const start = (page - 1) * limit
          const end = start + limit
          const paginatedEntities = filteredEntities.slice(start, end)
          
          console.log(`✅ Cache search successful, found ${filteredEntities.length} results, returning ${paginatedEntities.length}`)
          
          return {
            entities: paginatedEntities.map(entity => ({
              id: entity.neo4j_id,
              neo4j_id: entity.neo4j_id,
              labels: entity.labels,
              properties: entity.properties
            })),
            pagination: {
              page,
              limit,
              total: filteredEntities.length,
              totalPages: Math.ceil(filteredEntities.length / limit),
              hasNext: page * limit < filteredEntities.length,
              hasPrev: page > 1
            },
            filters: {
              entityType,
              sortBy,
              sortOrder
            }
          }
        } catch (searchError) {
          console.error('❌ Cache search error:', searchError)
          console.log('🔍 Cache search failed, returning empty results')
          // Return empty results for failed search instead of falling back to non-search query
          return {
            entities: [],
            pagination: {
              page,
              limit,
              total: 0,
              totalPages: 0,
              hasNext: false,
              hasPrev: false
            },
            filters: {
              entityType,
              sortBy,
              sortOrder
            }
          }
        }
      }
      
      // Apply sorting
      const sortColumn = sortBy === 'name' ? 'properties->>name' : 
                       sortBy === 'type' ? 'properties->>type' :
                       sortBy === 'sport' ? 'properties->>sport' :
                       sortBy === 'country' ? 'properties->>country' :
                       sortBy === 'priorityScore' ? 'properties->>priorityScore' :
                       sortBy === 'estimatedValue' ? 'properties->>estimatedValue' :
                       'properties->>name'
      
      query = query.order(sortColumn, { ascending: sortOrder === 'asc' })
      
      // Apply pagination
      query = query.range(start, end)
      
      let data, error, count
      try {
        const result = await query
        data = result.data
        error = result.error
        count = result.count
      } catch (queryError) {
        console.error('❌ Supabase query execution error:', queryError)
        throw queryError
      }
      
      if (error) {
        console.error('❌ Supabase query error:', error)
        console.error('Query details:', { search, entityType, sortBy, sortOrder })
        console.error('Error details:', JSON.stringify(error, null, 2))
        throw error
      }
      
      if (search) {
        console.log(`🔍 Cache search results for "${search}": ${data?.length || 0} entities found`)
        if (data && data.length > 0) {
          console.log(`🔍 First result name: ${data[0]?.properties?.name || 'N/A'}`)
        }
      }
      
      const entities = data || []
      const total = count || 0
      
      return {
        entities: entities.map(entity => ({
          id: entity.neo4j_id,
          neo4j_id: entity.neo4j_id,
          labels: entity.labels,
          properties: entity.properties
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        },
        filters: {
          entityType,
          sortBy,
          sortOrder
        }
      }
    } catch (error) {
      console.error('❌ Failed to fetch cached entities:', error)
      throw error
    }
  }

  async invalidateCache(entityIds?: string[]) {
    try {
      if (entityIds && entityIds.length > 0) {
        console.log(`🗑️ Invalidating cache for ${entityIds.length} entities`)
        const { error } = await supabase
          .from('cached_entities')
          .delete()
          .in('neo4j_id', entityIds)
        
        if (error) throw error
      } else {
        console.log('🗑️ Invalidating entire entity cache')
        const { error } = await supabase
          .from('cached_entities')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all
        
        if (error) throw error
      }
      
      return { success: true, invalidatedCount: entityIds?.length || 0 }
    } catch (error) {
      console.error('❌ Failed to invalidate cache:', error)
      throw error
    }
  }

  async getCacheStats() {
    try {
      const { data, error } = await supabase
        .from('cached_entities')
        .select('labels, created_at, cache_version')
      
      if (error) throw error
      
      const entities = data || []
      const entitiesByType: Record<string, number> = {}
      
      entities.forEach(entity => {
        entity.labels.forEach((label: string) => {
          entitiesByType[label] = (entitiesByType[label] || 0) + 1
        })
      })
      
      const lastSync = entities.length > 0 
        ? new Date(Math.max(...entities.map(e => new Date(e.created_at).getTime())))
        : null
      
      return {
        totalCached: entities.length,
        lastSync,
        cacheVersion: entities.length > 0 ? entities[0].cache_version : 1,
        entitiesByType
      }
    } catch (error) {
      console.error('❌ Failed to get cache stats:', error)
      throw error
    }
  }

  // ========== RELATIONSHIP METHODS ==========

  async getCachedRelationships(options: {
    page?: number
    limit?: number
    relationshipType?: string
    sourceName?: string
    targetName?: string
    sourceNeo4jId?: string
    targetNeo4jId?: string
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  } = {}) {
    const {
      page = 1,
      limit = 100,
      relationshipType = '',
      sourceName = '',
      targetName = '',
      sourceNeo4jId = '',
      targetNeo4jId = '',
      sortBy = 'relationship_type',
      sortOrder = 'asc'
    } = options
    
    const start = (page - 1) * limit
    
    try {
      console.log(`📖 Fetching cached relationships from Supabase...`)
      
      let query = supabase
        .from('entity_relationships')
        .select('*', { count: 'exact' })
      
      // Apply filters
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
      
      // Apply sorting and pagination
      query = query
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(start, start + limit - 1)
        .eq('is_active', true)
      
      const { data, error, count } = await query
      
      if (error) throw error
      
      const relationships = data || []
      
      console.log(`✅ Cache relationships successful, found ${relationships.length} relationships`)
      
      return {
        relationships,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
          hasNext: start + limit < (count || 0),
          hasPrev: page > 1
        },
        filters: { relationshipType, sourceName, targetName, sourceNeo4jId, targetNeo4jId, sortBy, sortOrder }
      }
    } catch (error) {
      console.error('❌ Failed to fetch cached relationships:', error)
      throw error
    }
  }

  async getRelationshipsForEntity(neo4jId: string, options: {
    direction?: 'outgoing' | 'incoming' | 'both'
    limit?: number
  } = {}) {
    const { direction = 'both', limit = 50 } = options
    
    try {
      console.log(`🔗 Getting relationships for entity ${neo4jId}...`)
      
      let query = supabase
        .from('entity_relationships')
        .select('*')
        .eq('is_active', true)
      
      if (direction === 'outgoing') {
        query = query.eq('source_neo4j_id', neo4jId)
      } else if (direction === 'incoming') {
        query = query.eq('target_neo4j_id', neo4jId)
      } else {
        // Both directions
        query = query.or(`source_neo4j_id.eq.${neo4jId},target_neo4j_id.eq.${neo4jId}`)
      }
      
      query = query.order('created_at', { ascending: false }).limit(limit)
      
      const { data, error } = await query
      
      if (error) throw error
      
      const relationships = data || []
      
      console.log(`✅ Found ${relationships.length} relationships for entity ${neo4jId}`)
      
      return relationships
    } catch (error) {
      console.error(`❌ Failed to get relationships for entity ${neo4jId}:`, error)
      throw error
    }
  }

  async syncRelationshipsFromNeo4j(options: {
    batchSize?: number
    forceRefresh?: boolean
  } = {}) {
    const { batchSize = 100, forceRefresh = false } = options
    const integerBatchSize = parseInt(Math.floor(batchSize).toString(), 10)
    
    console.log('🔄 Starting relationship sync from Neo4j to Supabase...')
    
    if (forceRefresh) {
      console.log('🗑️ Clearing existing relationships cache...')
      await supabase
        .from('entity_relationships')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all
    }
    
    const session = this.neo4jService.getDriver().session()
    
    try {
      // Get relationships from Neo4j
      const relationshipsQuery = `
        MATCH (n1)-[r]->(n2)
        RETURN 
          elementId(n1) as source_element_id,
          n1.neo4j_id as source_neo4j_id,
          labels(n1) as source_labels,
          n1.name as source_name,
          type(r) as relationship_type,
          properties(r) as relationship_properties,
          elementId(n2) as target_element_id,
          n2.neo4j_id as target_neo4j_id,
          labels(n2) as target_labels,
          n2.name as target_name
        LIMIT ${integerBatchSize}
      `
      
      const result = await session.run(relationshipsQuery)
      
      if (result.records.length === 0) {
        console.log('✅ No relationships found in Neo4j')
        return { synced: 0, updated: 0, errors: 0 }
      }
      
      console.log(`📊 Found ${result.records.length} relationships in Neo4j`)
      
      let synced = 0
      let updated = 0
      let errors = 0
      
      // Process relationships in batches
      for (const record of result.records) {
        try {
          const relationship = {
            source_neo4j_id: record.get('source_neo4j_id'),
            target_neo4j_id: record.get('target_neo4j_id'),
            relationship_type: record.get('relationship_type'),
            source_element_id: record.get('source_element_id'),
            target_element_id: record.get('target_element_id'),
            source_labels: record.get('source_labels'),
            target_labels: record.get('target_labels'),
            source_name: record.get('source_name'),
            target_name: record.get('target_name'),
            relationship_properties: record.get('relationship_properties') || {},
            direction: 'outgoing' as const,
            confidence_score: 100,
            weight: 1.0
          }
          
          // Check if both entities exist in cache
          const { data: sourceCheck } = await supabase
            .from('cached_entities')
            .select('neo4j_id')
            .eq('neo4j_id', relationship.source_neo4j_id)
            .single()
          
          const { data: targetCheck } = await supabase
            .from('cached_entities')
            .select('neo4j_id')
            .eq('neo4j_id', relationship.target_neo4j_id)
            .single()
          
          if (!sourceCheck || !targetCheck) {
            console.log(`⚠️ Skipping relationship - missing entities: ${relationship.source_name} -> ${relationship.target_name}`)
            continue
          }
          
          // Insert or update relationship
          const { error: insertError } = await supabase
            .from('entity_relationships')
            .upsert(relationship, {
              onConflict: 'source_element_id,target_element_id,relationship_type'
            })
          
          if (insertError) {
            console.error(`❌ Failed to sync relationship: ${relationship.source_name} -> ${relationship.target_name}`, insertError)
            errors++
          } else {
            synced++
          }
          
        } catch (error) {
          console.error('❌ Error processing relationship record:', error)
          errors++
        }
      }
      
      console.log(`✅ Relationship sync complete: ${synced} synced, ${updated} updated, ${errors} errors`)
      
      return { synced, updated, errors }
      
    } catch (error) {
      console.error('❌ Failed to sync relationships from Neo4j:', error)
      throw error
    } finally {
      await session.close()
    }
  }

  // ========== ENHANCED PRIORITY-BASED METHODS ==========

  async getEntitiesByPriority(priority: number, options: {
    page?: number
    limit?: number
    entityType?: string
    search?: string
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
    filters?: {
      leaguenav_eligible?: boolean
      hasLeague?: boolean
      excludeTypes?: string[]
    }
  } = {}) {
    const {
      page = 1,
      limit = 1000,
      entityType = '',
      search = '',
      sortBy = 'name',
      sortOrder = 'asc',
      filters = {}
    } = options
    
    const start = (page - 1) * limit
    const end = start + limit - 1
    
    try {
      console.log(`🎯 Fetching priority ${priority} entities from Supabase...`)
      
      let query = supabase
        .from('cached_entities')
        .select('*', { count: 'exact' })
        .eq('priority_score', priority)
      
      // Apply filters
      if (entityType && entityType !== 'all') {
        query = query.contains('labels', [entityType])
      }
      
      // Apply LeagueNav-specific filters
      // Note: leaguenav_eligible filter disabled as property doesn't exist in database
      // if (filters.leaguenav_eligible) {
      //   query = query.eq('properties->>leaguenav_eligible', 'true')
      // }
      
      if (filters.hasLeague) {
        query = query.not('properties->>league', 'is', null)
        query = query.neq('properties->>league', '')
      }
      
      if (filters.excludeTypes && filters.excludeTypes.length > 0) {
        query = query.not('properties->>entity_type', 'in', `(${filters.excludeTypes.map(t => `'${t}'`).join(',')})`)
      }
      
      if (search) {
        // Use the existing search logic for priority-based queries
        return this.performPrioritySearch(priority, search, entityType, sortBy, sortOrder, page, limit)
      }
      
      // Apply sorting
      const sortColumn = sortBy === 'name' ? 'properties->>name' : 
                       sortBy === 'type' ? 'properties->>type' :
                       sortBy === 'sport' ? 'properties->>sport' :
                       sortBy === 'country' ? 'properties->>country' :
                       sortBy === 'priorityScore' ? 'priority_score' :
                       'properties->>name'
      
      query = query.order(sortColumn, { ascending: sortOrder === 'asc' })
      
      // Apply pagination
      query = query.range(start, end)
      
      const { data, error, count } = await query
      
      if (error) {
        console.error('❌ Priority query error:', error)
        throw error
      }
      
      const entities = data || []
      
      console.log(`✅ Priority ${priority} fetch successful: ${entities.length} entities`)
      
      return {
        entities: entities.map(entity => ({
          id: entity.neo4j_id,
          neo4j_id: entity.neo4j_id,
          labels: entity.labels,
          properties: {
            ...entity.properties,
            _priority_score: entity.priority_score,
            _entity_category: entity.entity_category
          }
        })),
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
          hasNext: page * limit < (count || 0),
          hasPrev: page > 1
        },
        priority,
        filters: {
          entityType,
          sortBy,
          sortOrder
        }
      }
    } catch (error) {
      console.error(`❌ Failed to fetch priority ${priority} entities:`, error)
      throw error
    }
  }

  private async performPrioritySearch(
    priority: number, 
    search: string, 
    entityType: string, 
    sortBy: string, 
    sortOrder: 'asc' | 'desc',
    page: number,
    limit: number
  ) {
    const searchLower = search.toLowerCase()
    
    try {
      // Get all entities of this priority for search
      const { data: allData, error } = await supabase
        .from('cached_entities')
        .select('*')
        .eq('priority_score', priority)
        .limit(2000) // Reasonable limit for search
      
      if (error) {
        console.error('❌ Priority search fetch error:', error)
        throw error
      }
      
      // Filter in memory
      const filteredEntities = allData?.filter(entity => {
        const props = entity.properties || {}
        const searchTerm = searchLower
        
        const matchesType = !entityType || entityType === 'all' || entity.labels.includes(entityType)
        const matchesSearch = (
          props.name?.toLowerCase().includes(searchTerm) ||
          props.description?.toLowerCase().includes(searchTerm) ||
          props.type?.toLowerCase().includes(searchTerm) ||
          props.sport?.toLowerCase().includes(searchTerm) ||
          props.country?.toLowerCase().includes(searchTerm) ||
          (props.league && props.league.toLowerCase().includes(searchTerm)) ||
          (props.level && props.level.toLowerCase().includes(searchTerm))
        )
        
        return matchesType && matchesSearch
      }) || []
      
      // Sort results
      filteredEntities.sort((a, b) => {
        const aProp = a.properties[sortBy] || ''
        const bProp = b.properties[sortBy] || ''
        
        if (sortBy === 'priorityScore') {
          return sortOrder === 'desc' ? b.priority_score - a.priority_score : a.priority_score - b.priority_score
        }
        
        const aStr = aProp.toString().toLowerCase()
        const bStr = bProp.toString().toLowerCase()
        return sortOrder === 'desc' ? bStr.localeCompare(aStr) : aStr.localeCompare(bStr)
      })
      
      // Apply pagination
      const start = (page - 1) * limit
      const end = start + limit
      const paginatedEntities = filteredEntities.slice(start, end)
      
      console.log(`✅ Priority ${priority} search successful: ${filteredEntities.length} results, returning ${paginatedEntities.length}`)
      
      return {
        entities: paginatedEntities.map(entity => ({
          id: entity.neo4j_id,
          neo4j_id: entity.neo4j_id,
          labels: entity.labels,
          properties: {
            ...entity.properties,
            _priority_score: entity.priority_score,
            _entity_category: entity.entity_category
          }
        })),
        pagination: {
          page,
          limit,
          total: filteredEntities.length,
          totalPages: Math.ceil(filteredEntities.length / limit),
          hasNext: page * limit < filteredEntities.length,
          hasPrev: page > 1
        },
        priority,
        filters: {
          entityType,
          sortBy,
          sortOrder
        }
      }
    } catch (error) {
      console.error('❌ Priority search error:', error)
      throw error
    }
  }

  async getProgressiveEntities(loadedPriorities: number[], targetPriority: number, options: {
    entityType?: string
    search?: string
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  } = {}) {
    console.log(`🔄 Loading progressive entities from priority ${Math.max(...loadedPriorities, 0) + 1} to ${targetPriority}`)
    
    const prioritiesToLoad = []
    for (let p = 1; p <= targetPriority; p++) {
      if (!loadedPriorities.includes(p)) {
        prioritiesToLoad.push(p)
      }
    }
    
    if (prioritiesToLoad.length === 0) {
      return { entities: [], pagination: { total: 0 } }
    }
    
    try {
      // Load entities for missing priorities in parallel
      const entityPromises = prioritiesToLoad.map(priority => 
        this.getEntitiesByPriority(priority, {
          ...options,
          limit: 2000 // Higher limit for progressive loading
        })
      )
      
      const results = await Promise.all(entityPromises)
      
      // Merge all results
      const allEntities = results.flatMap(result => result.entities)
      const totalCount = results.reduce((sum, result) => sum + result.pagination.total, 0)
      
      console.log(`✅ Progressive loading complete: ${allEntities.length} entities loaded from ${prioritiesToLoad.length} priority levels`)
      
      return {
        entities: allEntities,
        pagination: {
          total: totalCount,
          loadedPriorities: [...loadedPriorities, ...prioritiesToLoad],
          prioritiesLoaded: prioritiesToLoad
        }
      }
    } catch (error) {
      console.error('❌ Progressive loading failed:', error)
      throw error
    }
  }

  async getSmartEntities(options: {
    context?: 'leaguenav' | 'search' | 'browse' | 'general'
    priority?: number | 'all'
    entityType?: string
    search?: string
    limit?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  } = {}) {
    const {
      context = 'general',
      priority = 'all',
      entityType = '',
      search = '',
      limit = 1000,
      sortBy = 'name',
      sortOrder = 'asc'
    } = options
    
    try {
      console.log(`🧠 Smart entity loading - Context: ${context}, Priority: ${priority}`)
      
      // Context-based priority selection
      let targetPriorities: number[] = []
      
      if (priority === 'all') {
        targetPriorities = context === 'leaguenav' ? [100, 80, 60] : [100, 80, 60, 40, 0]
      } else if (typeof priority === 'number') {
        targetPriorities = [priority]
      }
      
      // For LeagueNav context, load all eligible sports teams across all priorities
      if (context === 'leaguenav') {
        const entities = []
        
        // Load from multiple priorities to get all leagues
        const priorities = [100, 40, 0]
        
        for (const priorityLevel of priorities) {
          console.log(`🎯 LeagueNav: Fetching from priority ${priorityLevel}, limit: ${Math.ceil(limit / priorities.length)}`)
          const result = await this.getEntitiesByPriority(priorityLevel, {
            entityType: entityType || 'Entity',
            search,
            limit: Math.ceil(limit / priorities.length),
            sortBy,
            sortOrder,
            // Additional filters for LeagueNav optimization
            filters: {
              leaguenav_eligible: true,
              // hasLeague: true,  // Temporarily disabled for debugging
              excludeTypes: ['Governing Body', 'Individual Competitor']
              // Include Competition/League entities (like Bundesliga, LaLiga, etc.)
            }
          })
          
          entities.push(...result.entities)
          
          if (entities.length >= limit) {
            break
          }
        }
        
        console.log(`🏆 LeagueNav smart loading: ${entities.length} LeagueNav-eligible sports teams loaded from ${priorities.length} priority levels`)
        return { 
          entities, 
          pagination: { 
            total: entities.length, 
            hasMore: false 
          } 
        }
      }
      
      // For other contexts, load progressively
      const entities = []
      let totalCount = 0
      
      for (const priorityLevel of targetPriorities.sort((a, b) => b - a)) {
        try {
          const result = await this.getEntitiesByPriority(priorityLevel, {
            entityType,
            search,
            limit: entities.length === 0 ? limit : Math.min(500, limit - entities.length),
            sortBy,
            sortOrder
          })
          
          entities.push(...result.entities)
          totalCount += result.pagination.total
          
          // Stop if we have enough entities
          if (entities.length >= limit) break
          
        } catch (error) {
          console.warn(`⚠️ Failed to load priority ${priorityLevel}:`, error.message)
          continue
        }
      }
      
      console.log(`🧠 Smart loading complete: ${entities.length} entities loaded from ${targetPriorities.length} priority levels`)
      
      return {
        entities: entities.slice(0, limit),
        pagination: {
          total: totalCount,
          hasMore: totalCount > limit,
          prioritiesLoaded: targetPriorities
        }
      }
    } catch (error) {
      console.error('❌ Smart loading failed:', error)
      throw error
    }
  }

  async getPriorityStats() {
    try {
      const { data, error } = await supabase
        .from('cached_entities')
        .select('priority_score, entity_category')
        .not('priority_score', 'is', null)
      
      if (error) throw error
      
      const stats: Record<string, { count: number; category: string }> = {}
      
      data?.forEach(entity => {
        const key = `priority_${entity.priority_score}_${entity.entity_category}`
        if (!stats[key]) {
          stats[key] = { count: 0, category: entity.entity_category }
        }
        stats[key].count++
      })
      
      return {
        totalEntities: data?.length || 0,
        priorityDistribution: stats,
        highestPriority: Math.max(...(data?.map(e => e.priority_score) || [0])),
        lowestPriority: Math.min(...(data?.map(e => e.priority_score) || [0]))
      }
    } catch (error) {
      console.error('❌ Failed to get priority stats:', error)
      throw error
    }
  }
}