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
  } = {}) {
    const {
      page = 1,
      limit = 20,
      entityType = '',
      search = '',
      sortBy = 'name',
      sortOrder = 'asc'
    } = options
    
    const start = (page - 1) * limit
    const end = start + limit - 1
    
    try {
      console.log(`📖 Fetching cached entities from Supabase...`)
      
      let query = supabase
        .from('cached_entities')
        .select('*', { count: 'exact' })
      
      // Apply filters
      if (entityType && entityType !== 'all') {
        query = query.contains('labels', [entityType])
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
          
          // Use a more efficient approach - fetch a larger set for search
          const { data: allData, error: fetchError } = await supabase
            .from('cached_entities')
            .select('*')
            .range(0, 1999) // Get first 2000 records for search to improve results
          
          if (fetchError) {
            console.error('❌ Cache fetch error:', fetchError)
            throw fetchError
          }
          
          // Filter in memory
          const filteredEntities = allData?.filter(entity => {
            const props = entity.properties || {}
            const searchTerm = searchLower
            
            return (
              (entityType === '' || entityType === 'all' || entity.labels.includes(entityType)) &&
              (
                props.name?.toLowerCase().includes(searchTerm) ||
                props.description?.toLowerCase().includes(searchTerm) ||
                props.type?.toLowerCase().includes(searchTerm) ||
                props.sport?.toLowerCase().includes(searchTerm) ||
                props.country?.toLowerCase().includes(searchTerm) ||
                (props.level && props.level.toLowerCase().includes(searchTerm))
              )
            )
          }) || []
          
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
}