/**
 * Re-exports from local PostgreSQL client.
 * All Supabase SDK calls are now routed through the local PG query builder.
 */
export {
  supabase,
  getSupabase,
  getSupabaseAdmin,
  executeSupabaseQuery,
  createCacheHeaders,
  getPool,
  query,
} from './pg-client';
export type { PgClient } from './pg-client';
