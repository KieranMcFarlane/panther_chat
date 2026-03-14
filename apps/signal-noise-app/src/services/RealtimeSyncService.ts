/**
 * Realtime FalkorDB (Redis protocol) to Supabase Sync Service
 */

import { createClient } from '@supabase/supabase-js'
import { FalkorRedisGraphService } from '@/lib/falkor-redis-graph'
import { EntityCacheService } from '@/services/EntityCacheService'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

interface SyncResult {
  success: boolean
  entitiesProcessed: number
  entitiesAdded: number
  entitiesUpdated: number
  entitiesRemoved: number
  relationshipsSynced?: number
  relationshipsErrors?: number
  duration: number
  error?: string
}

interface GraphEntity {
  neo4j_id: string
  labels: string[]
  properties: Record<string, any>
}

export class RealtimeSyncService {
  private graphService: FalkorRedisGraphService

  constructor() {
    this.graphService = new FalkorRedisGraphService()
  }

  async initialize() {
    await this.graphService.initialize()
  }

  /**
   * Perform a full sync of all entities from graph to Supabase
   */
  async performFullSync(): Promise<SyncResult> {
    const startTime = Date.now()
    let syncLogId: string | null = null

    try {
      console.log('🔄 Starting full graph-to-Supabase sync...')

      const { data: syncLog } = await supabase
        .from('sync_log')
        .insert({
          sync_type: 'full',
          source_count: 0,
          target_count: 0,
          status: 'running',
        })
        .select('id')
        .single()

      syncLogId = syncLog?.id

      const graphEntities = await this.getAllGraphEntities()
      console.log(`📊 Found ${graphEntities.length} entities in graph source`)

      const existingEntities = await this.getExistingSupabaseEntities()
      console.log(`📊 Found ${existingEntities.length} entities in Supabase`)

      const existingIds = new Set(existingEntities.map((e) => String(e.neo4j_id)))
      const graphIds = new Set(graphEntities.map((e) => String(e.neo4j_id)))

      const newEntities = graphEntities.filter((e) => !existingIds.has(String(e.neo4j_id)))
      const entitiesToRemove = existingEntities.filter((e) => !graphIds.has(String(e.neo4j_id)))

      let entitiesAdded = 0
      for (const entity of newEntities) {
        await this.upsertEntityToSupabase(entity)
        entitiesAdded++
      }

      let entitiesUpdated = 0
      for (const entity of graphEntities) {
        if (!existingIds.has(String(entity.neo4j_id))) continue

        const existing = existingEntities.find((e) => String(e.neo4j_id) === String(entity.neo4j_id))
        if (await this.hasEntityChanged(entity, existing)) {
          await this.upsertEntityToSupabase(entity)
          entitiesUpdated++
        }
      }

      let entitiesRemoved = 0
      for (const entityToRemove of entitiesToRemove) {
        await supabase
          .from('cached_entities')
          .delete()
          .eq('neo4j_id', entityToRemove.neo4j_id)
        entitiesRemoved++
      }

      const entityCacheService = new EntityCacheService()
      await entityCacheService.initialize()
      const relationshipSync = await entityCacheService.syncRelationshipsFromGraph({
        batchSize: 500,
        forceRefresh: true,
      })

      const duration = Date.now() - startTime

      if (syncLogId) {
        await supabase
          .from('sync_log')
          .update({
            source_count: graphEntities.length,
            target_count: graphEntities.length,
            entities_added: entitiesAdded,
            entities_updated: entitiesUpdated,
            entities_removed: entitiesRemoved,
            sync_duration_ms: duration,
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncLogId)
      }

      console.log(`✅ Full sync completed: ${entitiesAdded} added, ${entitiesUpdated} updated, ${entitiesRemoved} removed`)

      return {
        success: true,
        entitiesProcessed: graphEntities.length,
        entitiesAdded,
        entitiesUpdated,
        entitiesRemoved,
        relationshipsSynced: relationshipSync.synced,
        relationshipsErrors: relationshipSync.errors,
        duration,
      }
    } catch (error) {
      console.error('❌ Full sync failed:', error)

      if (syncLogId) {
        await supabase
          .from('sync_log')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncLogId)
      }

      return {
        success: false,
        entitiesProcessed: 0,
        entitiesAdded: 0,
        entitiesUpdated: 0,
        entitiesRemoved: 0,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  private async getAllGraphEntities(): Promise<GraphEntity[]> {
    const batchSize = 1000
    let skip = 0
    const rows: GraphEntity[] = []

    while (true) {
      const batch = await this.graphService.getEntitiesBatch(skip, batchSize)
      if (!batch.length) break
      rows.push(...batch)
      skip += batchSize
      if (batch.length < batchSize) break
    }

    return rows
  }

  private async getExistingSupabaseEntities() {
    const { data, error } = await supabase
      .from('cached_entities')
      .select('neo4j_id, properties, updated_at')

    if (error) throw error
    return data || []
  }

  private async hasEntityChanged(graphEntity: GraphEntity, existingEntity: any): Promise<boolean> {
    if (!existingEntity) return true

    const currentChecksum = this.calculateChecksum(graphEntity.properties)

    const { data: tracker } = await supabase
      .from('entity_sync_tracker')
      .select('checksum')
      .eq('neo4j_id', graphEntity.neo4j_id)
      .single()

    if (!tracker) return true
    return tracker.checksum !== currentChecksum
  }

  private calculateChecksum(properties: Record<string, any>): string {
    const crypto = require('crypto')
    const sortedProps = JSON.stringify(properties, Object.keys(properties).sort())
    return crypto.createHash('md5').update(sortedProps).digest('hex')
  }

  private async upsertEntityToSupabase(entity: GraphEntity) {
    const checksum = this.calculateChecksum(entity.properties)

    await supabase
      .from('cached_entities')
      .upsert(
        {
          neo4j_id: entity.neo4j_id,
          labels: entity.labels,
          properties: entity.properties,
          cache_version: 1,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'neo4j_id',
        },
      )

    await supabase
      .from('entity_sync_tracker')
      .upsert(
        {
          neo4j_id: entity.neo4j_id,
          neo4j_internal_id: Number(entity.neo4j_id) || null,
          last_synced_at: new Date().toISOString(),
          sync_version: 1,
          checksum,
          is_active: true,
        },
        {
          onConflict: 'neo4j_id',
        },
      )
  }

  async getSyncStatus() {
    const { data: lastSync } = await supabase
      .from('sync_log')
      .select('*')
      .eq('status', 'completed')
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    const { data: stats } = await supabase
      .from('sync_log')
      .select('status')
      .order('started_at', { ascending: false })
      .limit(10)

    return {
      lastSync,
      recentStatuses: stats || [],
      isHealthy:
        !!lastSync && Date.now() - new Date(lastSync.started_at).getTime() < 24 * 60 * 60 * 1000,
    }
  }
}
