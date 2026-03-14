/**
 * Realtime FalkorDB to Supabase Sync Service
 * Uses graph sync tools to keep databases synchronized
 */

import { createClient } from '@supabase/supabase-js';
import { FalkorDBService } from '@/lib/falkordb';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import path from 'node:path';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const execFileAsync = promisify(execFile);

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

interface GraphRelationship {
  source_element_id: string;
  source_neo4j_id: string;
  source_labels: string[];
  source_name: string;
  relationship_type: string;
  relationship_properties: Record<string, any>;
  target_element_id: string;
  target_neo4j_id: string;
  target_labels: string[];
  target_name: string;
}

export class RealtimeSyncService {
  private falkorService: FalkorDBService;

  constructor() {
    this.falkorService = new FalkorDBService();
  }

  async initialize() {
    // Optional lightweight check. We source sync data via native Falkor Python bridge below.
    try {
      await this.falkorService.initialize();
    } catch (error) {
      console.warn('⚠️ Driver init warning (continuing with native Falkor snapshot bridge):', error);
    }
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

      // Get full graph snapshot from FalkorDB native client bridge
      const snapshot = await this.getGraphSnapshotViaPythonBridge();
      const graphEntities = snapshot.entities;
      console.log(`📊 Found ${graphEntities.length} entities in FalkorDB`);

      // Get existing entities from Supabase
      const existingEntities = await this.getExistingSupabaseEntities();
      console.log(`📊 Found ${existingEntities.length} entities in Supabase`);

      // Calculate differences
      const existingNeo4jIds = new Set(existingEntities.map(e => e.neo4j_id));
      const newEntities = graphEntities.filter(e => !existingNeo4jIds.has(e.neo4j_id));
      
      const neo4jIds = new Set(graphEntities.map(e => e.neo4j_id));
      const entitiesToRemove = existingEntities.filter(e => !neo4jIds.has(e.neo4j_id));

      // Batch upsert all graph entities (new + updated) for throughput.
      await this.batchUpsertEntitiesToSupabase(graphEntities);
      const entitiesAdded = newEntities.length;
      const entitiesUpdated = Math.max(graphEntities.length - entitiesAdded, 0);

      // Remove entities that no longer exist in FalkorDB
      let entitiesRemoved = 0;
      for (const entityToRemove of entitiesToRemove) {
        await supabase
          .from('cached_entities')
          .delete()
          .eq('neo4j_id', entityToRemove.neo4j_id);
        entitiesRemoved++;
      }

      const relationshipSync = await this.syncRelationshipsToSupabase(snapshot.relationships, true);

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
    const snapshot = await this.getGraphSnapshotViaPythonBridge();
    return snapshot.entities;
  }

  private async getGraphSnapshotViaPythonBridge(): Promise<{
    entities: GraphEntity[];
    relationships: GraphRelationship[];
  }> {
    const candidateScripts = [
      path.resolve(process.cwd(), 'backend/export_falkordb_snapshot.py'),
      path.resolve(process.cwd(), 'apps/signal-noise-app/backend/export_falkordb_snapshot.py'),
    ];
    const scriptPath = candidateScripts.find(existsSync);
    if (!scriptPath) {
      throw new Error('Falkor snapshot bridge script not found');
    }

    const pythonCandidates = [
      process.env.PYTHON_BIN,
      'python3',
      '/Library/Frameworks/Python.framework/Versions/3.13/bin/python3',
      'python',
    ].filter(Boolean) as string[];

    let stdout = '';
    let lastError: unknown;
    for (const pythonBin of pythonCandidates) {
      try {
        const res = await execFileAsync(pythonBin, [scriptPath], {
          cwd: process.cwd(),
          maxBuffer: 50 * 1024 * 1024,
          env: process.env,
        });
        stdout = res.stdout;
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!stdout) {
      throw lastError instanceof Error ? lastError : new Error('Failed to run Falkor snapshot script');
    }

    const parsed = JSON.parse(stdout || '{}');
    if (!parsed?.success) {
      throw new Error(parsed?.error || 'Failed to export Falkor snapshot');
    }

    const entitiesRaw: GraphEntity[] = parsed.entities || [];
    const relationshipsRaw: GraphRelationship[] = parsed.relationships || [];

    const entityMap = new Map<string, GraphEntity>();
    for (const entity of entitiesRaw) {
      if (!entity?.neo4j_id) continue;
      entityMap.set(entity.neo4j_id, entity);
    }

    const relMap = new Map<string, GraphRelationship>();
    for (const rel of relationshipsRaw) {
      if (!rel?.source_element_id || !rel?.target_element_id || !rel?.relationship_type) continue;
      const key = `${rel.source_element_id}|${rel.target_element_id}|${rel.relationship_type}`;
      relMap.set(key, rel);
    }

    return {
      entities: Array.from(entityMap.values()),
      relationships: Array.from(relMap.values()),
    };
  }

  /**
   * Get existing entities from Supabase
   */
  private async getExistingSupabaseEntities() {
    const pageSize = 1000;
    let from = 0;
    let allRows: any[] = [];

    while (true) {
      const { data, error } = await supabase
        .from('cached_entities')
        .select('neo4j_id, properties, updated_at')
        .range(from, from + pageSize - 1);

      if (error) throw error;
      const rows = data || [];
      allRows = allRows.concat(rows);
      if (rows.length < pageSize) break;
      from += pageSize;
    }

    return allRows;
  }

  /**
   * Check if an entity has changed since last sync
   */
  private async batchUpsertEntitiesToSupabase(entities: GraphEntity[]): Promise<void> {
    const now = new Date().toISOString();
    const batchSize = 500;

    for (let i = 0; i < entities.length; i += batchSize) {
      const batch = entities.slice(i, i + batchSize);
      const cachedPayload = batch.map((entity) => ({
        neo4j_id: entity.neo4j_id,
        labels: entity.labels,
        properties: entity.properties,
        cache_version: 1,
        updated_at: now,
      }));
      const trackerPayload = batch.map((entity) => ({
        neo4j_id: entity.neo4j_id,
        neo4j_internal_id: Number.parseInt(entity.id, 10),
        last_synced_at: now,
        sync_version: 1,
        checksum: `${entity.id}:${Object.keys(entity.properties || {}).length}`,
        is_active: true,
      }));

      const { error: cacheError } = await supabase
        .from('cached_entities')
        .upsert(cachedPayload, { onConflict: 'neo4j_id' });
      if (cacheError) {
        throw cacheError;
      }

      const { error: trackerError } = await supabase
        .from('entity_sync_tracker')
        .upsert(trackerPayload, { onConflict: 'neo4j_id' });
      if (trackerError) {
        throw trackerError;
      }
    }
  }

  private async syncRelationshipsToSupabase(
    relationships: GraphRelationship[],
    forceRefresh = false
  ): Promise<{ synced: number; updated: number; errors: number }> {
    if (forceRefresh) {
      await supabase
        .from('entity_relationships')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
    }

    let synced = 0;
    let errors = 0;
    const now = new Date().toISOString();
    const batchSize = 500;

    for (let i = 0; i < relationships.length; i += batchSize) {
      const dedupBatchMap = new Map<string, any>();
      for (const rel of relationships.slice(i, i + batchSize)) {
        const key = `${rel.source_element_id}|${rel.target_element_id}|${rel.relationship_type}`;
        dedupBatchMap.set(key, {
        ...rel,
        direction: 'outgoing',
        confidence_score: 100,
        weight: 1,
        last_synced_at: now,
        sync_version: 1,
        is_active: true,
        updated_at: now,
        });
      }
      const batch = Array.from(dedupBatchMap.values());

      const { error } = await supabase
        .from('entity_relationships')
        .upsert(batch, { onConflict: 'source_element_id,target_element_id,relationship_type' });

      if (error) {
        errors += batch.length;
      } else {
        synced += batch.length;
      }
    }

    return { synced, updated: 0, errors };
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
