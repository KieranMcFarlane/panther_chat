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

export class EntityCacheService {
  private neo4jService: Neo4jService
  private readonly CACHE_TTL = 30 * 60 * 1000 // 30 minutes
  private readonly BATCH_SIZE = 100

  constructor() {
    this.neo4jService = new Neo4jService()
  }

  async initialize() {
    await this.neo4jService.initialize()
  }

  async syncEntitiesFromNeo4j(options: {
    entityType?: string
    batchSize?: number
    forceRefresh?: boolean
  } = {}) {
    const { entityType = '', batchSize = this.BATCH_SIZE, forceRefresh = false } = options
    
    console.log('🔄 Starting entity sync from Neo4j to Supabase...')
    
    const session = this.neo4jService.driver.session()
    
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
        query = query.or(
          `properties->>'name'.ilike.%${search}%,properties->>'description'.ilike.%${search}%,properties->>'type'.ilike.%${search}%,properties->>'sport'.ilike.%${search}%,properties->>'country'.ilike.%${search}%`
        )
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
      
      const { data, error, count } = await query
      
      if (error) {
        console.error('❌ Supabase query error:', error)
        throw error
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
}