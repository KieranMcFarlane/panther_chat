import { Neo4jService } from '@/lib/neo4j'
import { resolveEntityUuid } from '@/lib/entity-public-id'
import { supabase } from '@/lib/pg-client'
import neo4j from 'neo4j-driver'

export interface CachedEntity {
  id: string
  neo4j_id: string
  uuid?: string
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
      const uuid = resolveEntityUuid({
        neo4j_id: node.identity.toString(),
        id: node.identity.toString(),
        properties: node.properties,
      }) || node.identity.toString()
      const canonicalEntityId = uuid
      // Canonical source-of-truth remains resolveEntityUuid(...).
      return {
        neo4j_id: node.identity.toString(),
        uuid,
        canonical_entity_id: canonicalEntityId,
        labels: node.labels,
        properties: {
          ...node.properties,
          uuid,
          canonical_entity_id: canonicalEntityId,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        cache_version: 1
      }
    })
  }

  private async upsertEntitiesToSupabase(entities: any[], forceRefresh: boolean): Promise<number> {
    try {
      console.log(`🗄️ Upserting ${entities.length} entities to canonical_entities...`)

      // Transform Neo4j entity format to canonical_entities columns
      const canonicalRows = entities.map((entity) => {
        const props = entity.properties || {}
        const uuid = entity.uuid || entity.canonical_entity_id || entity.neo4j_id
        return {
          id: uuid,
          name: props.name || entity.neo4j_id,
          entity_type: props.type || (Array.isArray(entity.labels) && entity.labels[0]) || 'ENTITY',
          sport: props.sport || null,
          country: props.country || null,
          league: props.league || null,
          labels: entity.labels || [],
          properties: props,
          source_neo4j_ids: [entity.neo4j_id],
          updated_at: entity.updated_at || new Date().toISOString(),
        }
      })

      const { data, error } = await supabase
        .from('canonical_entities')
        .upsert(canonicalRows, { onConflict: 'id' })

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

    const canonicalSelect = 'id, name, entity_type, sport, league, country, labels, properties, source_neo4j_ids, badge_path, badge_s3_url'

    try {
      console.log(`📖 Fetching entities from canonical_entities...`, {
        page,
        limit,
        leagues: leagues || 'none',
        search: search || 'none',
        entityType: entityType || 'none'
      })

      let query = supabase
        .from('canonical_entities')
        .select(canonicalSelect, { count: 'exact' })

      // Apply filters
      if (entityType && entityType !== 'all') {
        query = query.eq('entity_type', entityType)
      }

      // Apply leagues filter
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
          query = query.in('league', selectedLeagues)
        }
      }

      if (search) {
        const searchLower = search.toLowerCase()

        try {
          let searchQuery = supabase
            .from('canonical_entities')
            .select(canonicalSelect, { count: 'exact' })

          // Apply leagues filter
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
              searchQuery = searchQuery.in('league', selectedLeagues)
            }
          }

          // Apply entity type filter
          if (entityType && entityType !== 'all') {
            searchQuery = searchQuery.eq('entity_type', entityType)
          }

          // Search across proper columns
          searchQuery = searchQuery.or(`name.ilike.%${searchLower}%,entity_type.ilike.%${searchLower}%,sport.ilike.%${searchLower}%,country.ilike.%${searchLower}%,league.ilike.%${searchLower}%`)

          // Apply sorting and pagination
          const sortField = sortBy === 'name' ? 'name' : sortBy === 'type' ? 'entity_type' : sortBy === 'sport' ? 'sport' : sortBy === 'country' ? 'country' : 'name'
          searchQuery = searchQuery.order(sortField, { ascending: sortOrder === 'asc' })
          searchQuery = searchQuery.range(start, Math.min(start + limit * 2, 999))

          const { data: searchResults, error: fetchError } = await searchQuery

          if (fetchError) {
            console.error('❌ Cache fetch error:', fetchError)
            throw fetchError
          }

          const filteredEntities = searchResults || []

          // Map to response format
          const mappedEntities = filteredEntities.map(entity => {
            const sourceNeo4jId = Array.isArray(entity.source_neo4j_ids) && entity.source_neo4j_ids.length > 0
              ? entity.source_neo4j_ids[0]
              : entity.id
            return {
              id: entity.id,
              canonical_entity_id: entity.id,
              neo4j_id: sourceNeo4jId,
              labels: entity.labels || [],
              properties: {
                ...entity.properties,
                name: entity.name,
                type: entity.entity_type,
                sport: entity.sport,
                country: entity.country,
                league: entity.league,
              },
            }
          })

          console.log(`✅ Canonical search successful, found ${filteredEntities.length} results`)

          return {
            entities: mappedEntities,
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
          console.error('❌ Canonical search error:', searchError)
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

      // Apply sorting (non-search path)
      const sortColumn = sortBy === 'name' ? 'name' :
                       sortBy === 'type' ? 'entity_type' :
                       sortBy === 'sport' ? 'sport' :
                       sortBy === 'country' ? 'country' :
                       'name'

      query = query.order(sortColumn, { ascending: sortOrder === 'asc' })

      // Apply pagination
      query = query.range(start, end)

      const { data, error, count } = await query

      if (error) {
        console.error('❌ Supabase query error:', error)
        throw error
      }

      const entities = (data || []).map(entity => {
        const sourceNeo4jId = Array.isArray(entity.source_neo4j_ids) && entity.source_neo4j_ids.length > 0
          ? entity.source_neo4j_ids[0]
          : entity.id
        return {
          id: entity.id,
          canonical_entity_id: entity.id,
          neo4j_id: sourceNeo4jId,
          labels: entity.labels || [],
          properties: {
            ...entity.properties,
            name: entity.name,
            type: entity.entity_type,
            sport: entity.sport,
            country: entity.country,
            league: entity.league,
          },
        }
      })
      const total = count || 0

      return {
        entities,
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
      console.error('❌ Failed to fetch entities:', error)
      throw error
    }
  }

  async invalidateCache(entityIds?: string[]) {
    try {
      if (entityIds && entityIds.length > 0) {
        console.log(`🗑️ Invalidating cache for ${entityIds.length} entities`)
        // entityIds are neo4j_ids — find matching canonical rows via source_neo4j_ids
        const { data: matchingRows } = await supabase
          .from('canonical_entities')
          .select('id')
          .overlaps('source_neo4j_ids', entityIds)

        const idsToDelete = (matchingRows || []).map((r: any) => r.id)
        if (idsToDelete.length > 0) {
          const { error } = await supabase
            .from('canonical_entities')
            .delete()
            .in('id', idsToDelete)
          if (error) throw error
        }
      } else {
        console.log('🗑️ Invalidating entire entity cache')
        const { error } = await supabase
          .from('canonical_entities')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000')

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
        .from('canonical_entities')
        .select('labels, created_at')

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
        cacheVersion: 1,
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
          
          // Check if both entities exist in canonical
          const { data: sourceCheck } = await supabase
            .from('canonical_entities')
            .select('id')
            .contains('source_neo4j_ids', [relationship.source_neo4j_id])
            .limit(1)
            .single()

          const { data: targetCheck } = await supabase
            .from('canonical_entities')
            .select('id')
            .contains('source_neo4j_ids', [relationship.target_neo4j_id])
            .limit(1)
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

    const canonicalSelect = 'id, name, entity_type, sport, league, country, labels, properties, source_neo4j_ids, priority_score, entity_category'

    try {
      console.log(`🎯 Fetching priority ${priority} entities from canonical_entities...`)

      let query = supabase
        .from('canonical_entities')
        .select(canonicalSelect, { count: 'exact' })
        .eq('priority_score', priority)

      if (entityType && entityType !== 'all') {
        query = query.eq('entity_type', entityType)
      }

      if (filters.hasLeague) {
        query = query.not('league', 'is', null)
        query = query.neq('league', '')
      }

      if (filters.excludeTypes && filters.excludeTypes.length > 0) {
        query = query.not('entity_type', 'in', `(${filters.excludeTypes.map(t => `'${t}'`).join(',')})`)
      }

      if (search) {
        return this.performPrioritySearch(priority, search, entityType, sortBy, sortOrder, page, limit)
      }

      const sortColumn = sortBy === 'name' ? 'name' :
                       sortBy === 'type' ? 'entity_type' :
                       sortBy === 'sport' ? 'sport' :
                       sortBy === 'country' ? 'country' :
                       sortBy === 'priorityScore' ? 'priority_score' :
                       'name'

      query = query.order(sortColumn, { ascending: sortOrder === 'asc' })
      query = query.range(start, end)

      const { data, error, count } = await query

      if (error) {
        console.error('❌ Priority query error:', error)
        throw error
      }

      const entities = (data || []).map(row => {
        const sourceNeo4jId = Array.isArray(row.source_neo4j_ids) && row.source_neo4j_ids.length > 0
          ? row.source_neo4j_ids[0] : row.id
        return {
          id: sourceNeo4jId,
          neo4j_id: sourceNeo4jId,
          labels: row.labels || [],
          properties: {
            ...row.properties,
            name: row.name,
            type: row.entity_type,
            sport: row.sport,
            country: row.country,
            league: row.league,
            _priority_score: row.priority_score,
            _entity_category: row.entity_category,
          },
        }
      })

      console.log(`✅ Priority ${priority} fetch successful: ${entities.length} entities`)

      return {
        entities,
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

    const canonicalSelect = 'id, name, entity_type, sport, league, country, labels, properties, source_neo4j_ids, priority_score, entity_category'

    try {
      let query = supabase
        .from('canonical_entities')
        .select(canonicalSelect)
        .eq('priority_score', priority)

      if (entityType && entityType !== 'all') {
        query = query.eq('entity_type', entityType)
      }

      // Search across proper columns
      query = query.or(`name.ilike.%${searchLower}%,entity_type.ilike.%${searchLower}%,sport.ilike.%${searchLower}%,country.ilike.%${searchLower}%,league.ilike.%${searchLower}%`)
      query = query.limit(2000)

      const { data: allData, error } = await query

      if (error) {
        console.error('❌ Priority search fetch error:', error)
        throw error
      }

      const filteredEntities = allData || []

      const sortField = sortBy === 'name' ? 'name' : sortBy === 'type' ? 'entity_type' : sortBy === 'sport' ? 'sport' : sortBy === 'country' ? 'country' : 'name'
      filteredEntities.sort((a, b) => {
        if (sortBy === 'priorityScore') {
          return sortOrder === 'desc' ? (b.priority_score || 0) - (a.priority_score || 0) : (a.priority_score || 0) - (b.priority_score || 0)
        }
        const aVal = String(a[sortField] || '').toLowerCase()
        const bVal = String(b[sortField] || '').toLowerCase()
        return sortOrder === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal)
      })

      const start = (page - 1) * limit
      const end = start + limit
      const paginatedEntities = filteredEntities.slice(start, end)

      console.log(`✅ Priority ${priority} search successful: ${filteredEntities.length} results, returning ${paginatedEntities.length}`)

      return {
        entities: paginatedEntities.map(row => {
          const sourceNeo4jId = Array.isArray(row.source_neo4j_ids) && row.source_neo4j_ids.length > 0
            ? row.source_neo4j_ids[0] : row.id
          return {
            id: sourceNeo4jId,
            neo4j_id: sourceNeo4jId,
            labels: row.labels || [],
            properties: {
              ...row.properties,
              name: row.name,
              type: row.entity_type,
              sport: row.sport,
              country: row.country,
              league: row.league,
              _priority_score: row.priority_score,
              _entity_category: row.entity_category,
            },
          }
        }),
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
        .from('canonical_entities')
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
