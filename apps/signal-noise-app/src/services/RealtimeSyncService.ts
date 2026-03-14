/**
 * Realtime FalkorDB to Supabase Sync Service
 * Uses graph sync tools to keep databases synchronized
 */

import { createClient } from '@supabase/supabase-js';
import { FalkorDBService } from '@/lib/falkordb';
import { EntityCacheService } from '@/services/EntityCacheService';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SyncResult {
  success: boolean;
  entitiesProcessed: number;
  entitiesAdded: number;
  entitiesUpdated: number;
  entitiesRemoved: number;
  relationshipsSynced?: number;
  relationshipsErrors?: number;
  duration: number;
  error?: string;
}

interface GraphEntity {
  id: string;
  neo4j_id: string;
  labels: string[];
  properties: Record<string, any>;
}

export class RealtimeSyncService {
  private falkorService: FalkorDBService;

  constructor() {
    this.falkorService = new FalkorDBService();
  }

  async initialize() {
    await this.falkorService.initialize();
  }

  /**
   * Perform a full sync of all entities from FalkorDB to Supabase
   */
  async performFullSync(): Promise<SyncResult> {
    const startTime = Date.now();
    let syncLogId: string | null = null;

    try {
      console.log('🔄 Starting full FalkorDB to Supabase sync...');

      // Create sync log entry
      const { data: syncLog } = await supabase
        .from('sync_log')
        .insert({
          sync_type: 'full',
          source_count: 0, // Will update later
          target_count: 0, // Will update later
          status: 'running'
        })
        .select('id')
        .single();

      syncLogId = syncLog?.id;

      // Get all entities from graph source (FalkorDB)
      const graphEntities = await this.getAllGraphEntities();
      console.log(`📊 Found ${graphEntities.length} entities in FalkorDB`);

      // Get existing entities from Supabase
      const existingEntities = await this.getExistingSupabaseEntities();
      console.log(`📊 Found ${existingEntities.length} entities in Supabase`);

      // Calculate differences
      const existingNeo4jIds = new Set(existingEntities.map(e => e.neo4j_id));
      const newEntities = graphEntities.filter(e => !existingNeo4jIds.has(e.neo4j_id));
      
      const neo4jIds = new Set(graphEntities.map(e => e.neo4j_id));
      const entitiesToRemove = existingEntities.filter(e => !neo4jIds.has(e.neo4j_id));

      // Sync new entities
      let entitiesAdded = 0;
      for (const entity of newEntities) {
        await this.upsertEntityToSupabase(entity);
        entitiesAdded++;
      }

      // Update existing entities (check for changes)
      let entitiesUpdated = 0;
      for (const entity of graphEntities) {
        if (existingNeo4jIds.has(entity.neo4j_id)) {
          const existing = existingEntities.find(e => e.neo4j_id === entity.neo4j_id);
          if (await this.hasEntityChanged(entity, existing)) {
            await this.upsertEntityToSupabase(entity);
            entitiesUpdated++;
          }
        }
      }

      // Remove entities that no longer exist in FalkorDB
      let entitiesRemoved = 0;
      for (const entityToRemove of entitiesToRemove) {
        await supabase
          .from('cached_entities')
          .delete()
          .eq('neo4j_id', entityToRemove.neo4j_id);
        entitiesRemoved++;
      }

      const entityCacheService = new EntityCacheService();
      await entityCacheService.initialize();
      const relationshipSync = await entityCacheService.syncRelationshipsFromGraph({
        batchSize: 500,
        forceRefresh: true,
      });

      const duration = Date.now() - startTime;

      // Update sync log
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
            completed_at: new Date().toISOString()
          })
          .eq('id', syncLogId);
      }

      console.log(`✅ Full sync completed: ${entitiesAdded} added, ${entitiesUpdated} updated, ${entitiesRemoved} removed`);

      return {
        success: true,
        entitiesProcessed: graphEntities.length,
        entitiesAdded,
        entitiesUpdated,
        entitiesRemoved,
        relationshipsSynced: relationshipSync.synced,
        relationshipsErrors: relationshipSync.errors,
        duration
      };

    } catch (error) {
      console.error('❌ Full sync failed:', error);

      // Update sync log with error
      if (syncLogId) {
        await supabase
          .from('sync_log')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            completed_at: new Date().toISOString()
          })
          .eq('id', syncLogId);
      }

      return {
        success: false,
        entitiesProcessed: 0,
        entitiesAdded: 0,
        entitiesUpdated: 0,
        entitiesRemoved: 0,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get all entities from graph source
   */
  private async getAllGraphEntities(): Promise<GraphEntity[]> {
    const session = this.falkorService.getDriver().session();
    try {
      const result = await session.run(`
        MATCH (n)
        RETURN n, id(n) as internal_id
        ORDER BY n.name
      `);

      return result.records.map(record => ({
        id: record.get('internal_id').toString(),
        neo4j_id: record.get('internal_id').toString(),
        labels: record.get('n').labels,
        properties: record.get('n').properties
      }));
    } finally {
      await session.close();
    }
  }

  /**
   * Get existing entities from Supabase
   */
  private async getExistingSupabaseEntities() {
    const { data, error } = await supabase
      .from('cached_entities')
      .select('neo4j_id, properties, updated_at');

    if (error) throw error;
    return data || [];
  }

  /**
   * Check if an entity has changed since last sync
   */
  private async hasEntityChanged(neo4jEntity: GraphEntity, existingEntity: any): Promise<boolean> {
    const currentChecksum = this.calculateChecksum(neo4jEntity.properties);
    
    // Check sync tracker
    const { data: tracker } = await supabase
      .from('entity_sync_tracker')
      .select('checksum')
      .eq('neo4j_id', neo4jEntity.neo4j_id)
      .single();

    if (!tracker) return true;
    return tracker.checksum !== currentChecksum;
  }

  /**
   * Calculate checksum for entity properties
   */
  private calculateChecksum(properties: Record<string, any>): string {
    const crypto = require('crypto');
    const sortedProps = JSON.stringify(properties, Object.keys(properties).sort());
    return crypto.createHash('md5').update(sortedProps).digest('hex');
  }

  /**
   * Upsert entity to Supabase
   */
  private async upsertEntityToSupabase(entity: GraphEntity) {
    const checksum = this.calculateChecksum(entity.properties);
    
    // Upsert cached entity
    await supabase
      .from('cached_entities')
      .upsert({
        neo4j_id: entity.neo4j_id,
        labels: entity.labels,
        properties: entity.properties,
        cache_version: 1,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'neo4j_id'
      });

    // Update sync tracker
    await supabase
      .from('entity_sync_tracker')
      .upsert({
        neo4j_id: entity.neo4j_id,
        neo4j_internal_id: parseInt(entity.id),
        last_synced_at: new Date().toISOString(),
        sync_version: 1,
        checksum: checksum,
        is_active: true
      }, {
        onConflict: 'neo4j_id'
      });
  }

  /**
   * Get sync status
   */
  async getSyncStatus() {
    const { data: lastSync } = await supabase
      .from('sync_log')
      .select('*')
      .eq('status', 'completed')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    const { data: stats } = await supabase
      .from('sync_log')
      .select('status')
      .order('started_at', { ascending: false })
      .limit(10);

    return {
      lastSync,
      recentStatuses: stats || [],
      isHealthy: lastSync && (Date.now() - new Date(lastSync.started_at).getTime()) < 24 * 60 * 60 * 1000 // 24 hours
    };
  }
}
