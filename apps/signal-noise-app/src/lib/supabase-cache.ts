import {
  supabase,
  getSupabase,
  getSupabaseAdmin,
  executeSupabaseQuery,
  createCacheHeaders,
  getPool,
  query,
} from './pg-client';

export {
  supabase,
  getSupabase,
  getSupabaseAdmin,
  executeSupabaseQuery,
  createCacheHeaders,
  getPool,
  query,
};
export type { PgClient } from './pg-client';

type CacheTier = 1 | 2 | 3;

export class SupabaseCacheService {
  private cacheExpiry = {
    tier1: 5 * 60,
    tier2: 30 * 60,
    tier3: 2 * 60 * 60,
    default: 15 * 60,
  };

  async initialize(): Promise<void> {
    getSupabaseAdmin();
  }

  async cacheEntity(entity: any, tier: CacheTier = 2): Promise<void> {
    const cacheKey = this.generateCacheKey(entity);
    const expiresAt = new Date();
    const ttlSeconds = this.cacheExpiry[`tier${tier}`] || this.cacheExpiry.default;
    expiresAt.setSeconds(expiresAt.getSeconds() + ttlSeconds);

    const cacheData = {
      id: cacheKey,
      entity_id: entity.id || entity.entity_id,
      entity_type: entity.entity_type || entity.type || 'rfp',
      organization: entity.organization || entity.name || entity.title || null,
      sport: entity.sport || entity.category || null,
      fit_score: entity.yellow_panther_fit || entity.fit_score || null,
      urgency: entity.urgency || null,
      status: entity.status || null,
      entity_tier: tier,
      data: entity,
      neo4j_synced: false,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await getSupabaseAdmin()
      .from('entity_cache')
      .upsert(cacheData, { onConflict: 'id' });

    if (error) {
      throw error;
    }
  }

  async getCachedEntity(entityId: string, organization?: string): Promise<any | null> {
    const filters = [`id.eq.${entityId}`];
    if (organization) {
      filters.push(`organization.eq.${organization}`);
    }

    const { data, error } = await getSupabase()
      .from('entity_cache')
      .select('*')
      .or(filters.join(','))
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error) {
      return null;
    }
    return data;
  }

  async getCacheStats(): Promise<{
    total: number;
    by_tier: Record<string, number>;
    unsynced: number;
    expired: number;
  }> {
    const now = new Date().toISOString();

    const [totalResult, byTierResult, unsyncedResult, expiredResult] = await Promise.all([
      getSupabase().from('entity_cache').select('*', { count: 'exact', head: true }),
      getSupabase().from('entity_cache').select('entity_tier').gt('expires_at', now),
      getSupabase().from('entity_cache').select('*', { count: 'exact', head: true }).eq('neo4j_synced', false),
      getSupabase().from('entity_cache').select('*', { count: 'exact', head: true }).lt('expires_at', now),
    ]);

    const byTier = (byTierResult.data || []).reduce((acc: Record<string, number>, item: any) => {
      const tier = item.entity_tier || 'unknown';
      acc[`tier${tier}`] = (acc[`tier${tier}`] || 0) + 1;
      return acc;
    }, {});

    return {
      total: totalResult.count || 0,
      by_tier: byTier,
      unsynced: unsyncedResult.count || 0,
      expired: expiredResult.count || 0,
    };
  }

  private generateCacheKey(entity: any): string {
    const baseKey = entity.organization || entity.name || entity.title || 'unknown';
    const entityId = entity.id || entity.entity_id || Date.now().toString();
    return `${String(baseKey).toLowerCase().replace(/\s+/g, '_')}_${entityId}`;
  }
}

export const cacheService = new SupabaseCacheService();
