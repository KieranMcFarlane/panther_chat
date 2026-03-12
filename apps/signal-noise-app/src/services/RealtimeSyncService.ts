/**
 * Realtime FalkorDB to Supabase sync service.
 *
 * Supabase is the canonical entity catalogue. FalkorDB is used to track graph
 * presence and relationship coverage, not to overwrite canonical entity rows.
 */

import { createClient } from '@supabase/supabase-js'
import { falkorGraphClient } from '@/lib/falkordb'
import { resolveGraphId } from '@/lib/graph-id'
import { EntityCacheService } from '@/services/EntityCacheService'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface SyncResult {
  success: boolean;
  entitiesProcessed: number;
  entitiesAdded: number;
  entitiesUpdated: number;
  entitiesRemoved: number;
  relationshipsSynced: number;
  duration: number;
  error?: string;
}

interface GraphEntity {
  id: string;
  graph_id: string;
  neo4j_id?: string;
  labels: string[];
  properties: Record<string, any>;
}

export class RealtimeSyncService {
  async initialize() {
    await falkorGraphClient.initialize()
  }

  /**
   * Refresh graph coverage metadata without mutating canonical cached_entities rows.
   */
  async performFullSync(): Promise<SyncResult> {
    const startTime = Date.now()
    let syncLogId: string | null = null

    try {
      console.log('🔄 Starting FalkorDB to Supabase sync tracker refresh...')

      const { data: syncLog } = await supabase
        .from('sync_log')
        .insert({
          sync_type: 'full',
          source_count: 0,
          target_count: 0,
          status: 'running'
        })
        .select('id')
        .single()

      syncLogId = syncLog?.id ?? null

      const existingEntities = await this.getExistingSupabaseEntities()
      const graphEntities = await this.getAllGraphEntities()

      console.log(`📊 Found ${existingEntities.length} entities in Supabase`)
      console.log(`📊 Found ${graphEntities.length} entities in FalkorDB`)

      const graphEntityMap = new Map(
        graphEntities
          .map((entity) => [resolveGraphId(entity), entity] as const)
          .filter((entry): entry is [string, GraphEntity] => Boolean(entry[0])),
      )

      let entitiesAdded = 0
      let entitiesUpdated = 0
      let entitiesRemoved = 0

      for (const entity of existingEntities) {
        const entityGraphId = resolveGraphId(entity)
        const graphEntity = entityGraphId ? graphEntityMap.get(entityGraphId) : null
        if (!graphEntity) {
          await this.upsertSyncTracker(entityGraphId, null, false)
          entitiesRemoved++
          continue
        }

        const changed = await this.hasEntityChanged(graphEntity)
        await this.upsertSyncTracker(entityGraphId, graphEntity, true)
        if (changed) {
          entitiesUpdated++
        }
      }

      let relationshipsSynced = 0
      try {
        const relationshipCacheService = new EntityCacheService()
        await relationshipCacheService.initialize()
        const relationshipSyncResult = await relationshipCacheService.syncRelationshipsFromGraph({
          batchSize: Number(process.env.RELATIONSHIP_SYNC_BATCH_SIZE || 5000),
          forceRefresh: true,
        })
        relationshipsSynced = relationshipSyncResult.synced
      } catch (relationshipError) {
        console.error('⚠️ Relationship sync failed during full sync:', relationshipError)
      }

      const duration = Date.now() - startTime

      if (syncLogId) {
        await supabase
          .from('sync_log')
          .update({
            source_count: graphEntities.length,
            target_count: existingEntities.length,
            entities_added: entitiesAdded,
            entities_updated: entitiesUpdated,
            entities_removed: entitiesRemoved,
            sync_duration_ms: duration,
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', syncLogId)
      }

      console.log(`✅ Sync tracker refresh completed: ${entitiesUpdated} updated, ${entitiesRemoved} missing from graph`)

      return {
        success: true,
        entitiesProcessed: existingEntities.length,
        entitiesAdded,
        entitiesUpdated,
        entitiesRemoved,
        relationshipsSynced,
        duration
      }
    } catch (error) {
      console.error('❌ FalkorDB sync tracker refresh failed:', error)

      if (syncLogId) {
        await supabase
          .from('sync_log')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            completed_at: new Date().toISOString()
          })
          .eq('id', syncLogId)
      }

      return {
        success: false,
        entitiesProcessed: 0,
        entitiesAdded: 0,
        entitiesUpdated: 0,
        entitiesRemoved: 0,
        relationshipsSynced: 0,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private async getAllGraphEntities(): Promise<GraphEntity[]> {
    const rows = await falkorGraphClient.queryRows<{
      graph_id: string
      labels: string[]
      properties: Record<string, any>
    }>(`
      MATCH (n)
      RETURN coalesce(n.neo4j_id, n.entity_id, n.name) as graph_id,
             labels(n) as labels,
             properties(n) as properties
      ORDER BY n.name
    `)

    return rows
      .filter((row) => row.graph_id)
      .map((row) => ({
        id: String(row.graph_id),
        graph_id: String(row.graph_id),
        labels: Array.isArray(row.labels) ? row.labels : [],
        properties: (row.properties as Record<string, any>) || {}
      }))
  }

  private async getExistingSupabaseEntities() {
    const { data, error } = await supabase
      .from('cached_entities')
      .select('id, graph_id, neo4j_id, properties, updated_at')

    if (error) throw error
    return data || []
  }

  private async hasEntityChanged(graphEntity: GraphEntity): Promise<boolean> {
    const currentChecksum = this.calculateChecksum(graphEntity.properties)
    const graphId = resolveGraphId(graphEntity)

    const { data: tracker } = await supabase
      .from('entity_sync_tracker')
      .select('checksum')
      .eq('graph_id', graphId)
      .single()

    if (!tracker) return true
    return tracker.checksum !== currentChecksum
  }

  private calculateChecksum(properties: Record<string, any>): string {
    const crypto = require('crypto')
    const sortedProps = JSON.stringify(properties, Object.keys(properties).sort())
    return crypto.createHash('md5').update(sortedProps).digest('hex')
  }

  private async upsertSyncTracker(graphId: string, entity: GraphEntity | null, isActive: boolean) {
    const checksum = entity ? this.calculateChecksum(entity.properties) : null

    await supabase
      .from('entity_sync_tracker')
      .upsert({
        graph_id: graphId,
        neo4j_id: graphId,
        neo4j_internal_id: entity && /^\d+$/.test(entity.id) ? parseInt(entity.id, 10) : null,
        last_synced_at: new Date().toISOString(),
        sync_version: 1,
        checksum,
        is_active: isActive
      }, {
        onConflict: 'graph_id'
      })
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
      isHealthy: lastSync && (Date.now() - new Date(lastSync.started_at).getTime()) < 24 * 60 * 60 * 1000
    }
  }
}
