import { createClient } from '@supabase/supabase-js';
import { Neo4jService } from './neo4j';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Public client for frontend queries
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false
  }
});

// Service client for backend operations with elevated permissions
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

/**
 * Enhanced Supabase caching service with Neo4j synchronization
 */
export class SupabaseCacheService {
  private neo4jService: Neo4jService;
  private cacheExpiry = {
    tier1: 5 * 60, // 5 minutes for Tier 1
    tier2: 30 * 60, // 30 minutes for Tier 2
    tier3: 2 * 60 * 60, // 2 hours for Tier 3
    default: 15 * 60 // 15 minutes default
  };

  constructor() {
    this.neo4jService = new Neo4jService();
  }

  /**
   * Initialize cache service and set up Neo4j connection
   */
  async initialize(): Promise<void> {
    try {
      await this.neo4jService.initialize();
      console.log('✅ Supabase Cache Service initialized');
    } catch (error) {
      console.error('❌ Cache service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Cache entity with automatic expiry based on tier
   */
  async cacheEntity(entity: any, tier: 1 | 2 | 3 = 2): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(entity);
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + this.cacheExpiry[`tier${tier}`] || this.cacheExpiry.default);

      const cacheData = {
        id: cacheKey,
        entity_id: entity.id || entity.entity_id,
        entity_type: entity.entity_type || 'rfp',
        organization: entity.organization,
        sport: entity.sport,
        fit_score: entity.yellow_panther_fit || entity.fit_score,
        urgency: entity.urgency,
        status: entity.status,
        entity_tier: tier,
        data: entity,
        neo4j_synced: false,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Store in Supabase cache
      const { error } = await supabaseAdmin
        .from('entity_cache')
        .upsert(cacheData, { onConflict: 'id' });

      if (error) {
        console.error('Cache storage error:', error);
        throw error;
      }

      // Sync to Neo4j asynchronously
      this.syncToNeo4j(cacheKey, entity, tier).catch(error => {
        console.error('Neo4j sync failed:', error);
      });

      console.log(`📦 Cached entity: ${entity.organization} (Tier ${tier})`);

    } catch (error) {
      console.error('Entity caching failed:', error);
      throw error;
    }
  }

  /**
   * Get cached entity by ID or organization
   */
  async getCachedEntity(entityId: string, organization?: string): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('entity_cache')
        .select('*')
        .or(`id.eq.${entityId},organization.eq.${organization}`)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error) {
        if (error.code !== 'PGRST116') { // Not found error
          console.error('Cache retrieval error:', error);
        }
        return null;
      }

      return data;

    } catch (error) {
      console.error('Cache query failed:', error);
      return null;
    }
  }

  /**
   * Get multiple cached entities with filtering
   */
  async getCachedEntities(filters: {
    sport?: string;
    tier?: 1 | 2 | 3;
    min_fit_score?: number;
    urgency?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ entities: any[]; total: number }> {
    try {
      let query = supabase
        .from('entity_cache')
        .select('*', { count: 'exact' })
        .gt('expires_at', new Date().toISOString());

      // Apply filters
      if (filters.sport) {
        query = query.eq('sport', filters.sport);
      }
      if (filters.tier) {
        query = query.eq('entity_tier', filters.tier);
      }
      if (filters.min_fit_score) {
        query = query.gte('fit_score', filters.min_fit_score);
      }
      if (filters.urgency) {
        query = query.eq('urgency', filters.urgency);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      // Apply pagination
      if (filters.limit) {
        query = query.limit(filters.limit);
      }
      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1);
      }

      // Order by fit score and updated time
      query = query.order('fit_score', { ascending: false })
                   .order('updated_at', { ascending: false });

      const { data, error, count } = await query;

      if (error) {
        console.error('Cache query error:', error);
        return { entities: [], total: 0 };
      }

      return {
        entities: data || [],
        total: count || 0
      };

    } catch (error) {
      console.error('Batch cache query failed:', error);
      return { entities: [], total: 0 };
    }
  }

  /**
   * Invalidate cache for specific entity
   */
  async invalidateCache(entityId: string): Promise<void> {
    try {
      await supabaseAdmin
        .from('entity_cache')
        .update({ 
          expires_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('entity_id', entityId);

      console.log(`🗑️  Invalidated cache for entity: ${entityId}`);

    } catch (error) {
      console.error('Cache invalidation failed:', error);
    }
  }

  /**
   * Sync cached entity to Neo4j Knowledge Graph
   */
  private async syncToNeo4j(cacheKey: string, entity: any, tier: number): Promise<void> {
    try {
      await this.neo4jService.initialize();
      
      const session = this.neo4jService.getDriver().session();
      try {
        // Create or update entity in Neo4j
        const result = await session.run(`
          MERGE (e:Entity {id: $entityId})
          SET e += $properties,
              e.tier = $tier,
              e.last_synced = datetime(),
              e.sync_source = 'supabase_cache'
          RETURN e
        `, {
          entityId: entity.id || entity.entity_id,
          properties: {
            ...entity,
            cache_key: cacheKey,
            cached_at: new Date().toISOString()
          },
          tier
        });

        // Update cache to mark as synced
        await supabaseAdmin
          .from('entity_cache')
          .update({ neo4j_synced: true })
          .eq('id', cacheKey);

        console.log(`🔄 Synced to Neo4j: ${entity.organization}`);

      } finally {
        await session.close();
      }

    } catch (error) {
      console.error('Neo4j sync failed:', error);
      throw error;
    }
  }

  /**
   * Perform bulk sync of cache to Neo4j
   */
  async bulkSyncToNeo4j(limit = 100): Promise<{ synced: number; failed: number }> {
    const results = { synced: 0, failed: 0 };

    try {
      // Get unsynced cache entries
      const { data: unsyncedEntities, error } = await supabaseAdmin
        .from('entity_cache')
        .select('*')
        .eq('neo4j_synced', false)
        .limit(limit);

      if (error) {
        console.error('Bulk sync query failed:', error);
        return results;
      }

      await this.neo4jService.initialize();
      const session = this.neo4jService.getDriver().session();

      try {
        for (const entity of unsyncedEntities || []) {
          try {
            await session.run(`
              MERGE (e:Entity {id: $entityId})
              SET e += $properties,
                  e.tier = $tier,
                  e.last_synced = datetime(),
                  e.sync_source = 'supabase_cache_bulk'
            `, {
              entityId: entity.data.id || entity.data.entity_id,
              properties: {
                ...entity.data,
                cache_key: entity.id,
                cached_at: entity.created_at
              },
              tier: entity.entity_tier
            });

            // Mark as synced
            await supabaseAdmin
              .from('entity_cache')
              .update({ neo4j_synced: true })
              .eq('id', entity.id);

            results.synced++;

          } catch (error) {
            console.error(`Sync failed for ${entity.organization}:`, error);
            results.failed++;
          }
        }

        console.log(`📊 Bulk sync complete: ${results.synced} synced, ${results.failed} failed`);

      } finally {
        await session.close();
      }

    } catch (error) {
      console.error('Bulk sync operation failed:', error);
    }

    return results;
  }

  /**
   * Clean up expired cache entries
   */
  async cleanupExpiredEntries(): Promise<{ cleaned: number }> {
    try {
      const { data, error } = await supabaseAdmin
        .from('entity_cache')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('id');

      if (error) {
        console.error('Cache cleanup failed:', error);
        return { cleaned: 0 };
      }

      const cleaned = data?.length || 0;
      console.log(`🧹 Cleaned up ${cleaned} expired cache entries`);

      return { cleaned };

    } catch (error) {
      console.error('Cache cleanup error:', error);
      return { cleaned: 0 };
    }
  }

  /**
   * Generate cache key for entity
   */
  private generateCacheKey(entity: any): string {
    const baseKey = entity.organization || entity.name || 'unknown';
    const entityId = entity.id || entity.entity_id || Date.now().toString();
    return `${baseKey.toLowerCase().replace(/\s+/g, '_')}_${entityId}`;
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    total: number;
    by_tier: Record<string, number>;
    unsynced: number;
    expired: number;
  }> {
    try {
      const now = new Date().toISOString();

      // Total cache entries
      const { count: total } = await supabase
        .from('entity_cache')
        .select('*', { count: 'exact', head: true });

      // By tier
      const { data: byTier } = await supabase
        .from('entity_cache')
        .select('entity_tier')
        .gt('expires_at', now);

      // Unsynced entries
      const { count: unsynced } = await supabase
        .from('entity_cache')
        .select('*', { count: 'exact', head: true })
        .eq('neo4j_synced', false);

      // Expired entries
      const { count: expired } = await supabase
        .from('entity_cache')
        .select('*', { count: 'exact', head: true })
        .lt('expires_at', now);

      const tierCounts = byTier?.reduce((acc, item) => {
        const tier = item.entity_tier || 'unknown';
        acc[`tier${tier}`] = (acc[`tier${tier}`] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      return {
        total: total || 0,
        by_tier: tierCounts,
        unsynced: unsynced || 0,
        expired: expired || 0
      };

    } catch (error) {
      console.error('Cache stats query failed:', error);
      return {
        total: 0,
        by_tier: {},
        unsynced: 0,
        expired: 0
      };
    }
  }
}

// Export singleton instance
export const cacheService = new SupabaseCacheService();

/**
 * Legacy functions for backward compatibility
 */
export async function executeSupabaseQuery(query: string, params: any[] = []) {
  try {
    const { data, error } = await supabase
      .rpc('execute_sql', { 
        query_text: query,
        query_params: params 
      });
    
    if (error) {
      console.error('Supabase query error:', error);
      throw error;
    }
    
    return { rows: data || [] };
  } catch (error) {
    console.error('Supabase connection error:', error);
    throw error;
  }
}

export function createCacheHeaders(maxAge = 300, staleWhileRevalidate = 600) {
  return new Headers({
    'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
    'Content-Type': 'application/json',
  });
}