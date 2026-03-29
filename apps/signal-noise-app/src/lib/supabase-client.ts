import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const isBrowser = typeof window !== 'undefined';
const supabaseMissingMessage =
  'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable live progress data.';

function createUnavailableSupabaseClient() {
  const unresolvedQueryResult = Promise.resolve({
    data: null,
    error: new Error(supabaseMissingMessage),
  });

  const terminalMethods = new Set(['select', 'insert', 'update', 'delete', 'upsert', 'rpc', 'single', 'maybeSingle']);
  const chainMethods = new Set(['from', 'schema', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'order', 'limit', 'range', 'ilike', 'like', 'match', 'contains', 'overlaps', 'or', 'filter', 'maybeSingle']);

  const chainProxy = new Proxy(
    {},
    {
      get(_target, property) {
        if (property === 'then') {
          return undefined;
        }

        if (terminalMethods.has(String(property))) {
          return () => unresolvedQueryResult;
        }

        if (chainMethods.has(String(property))) {
          return () => chainProxy;
        }

        return () => chainProxy;
      },
    }
  );

  return chainProxy;
}

// Singleton browser/client Supabase instance
let browserSupabase: ReturnType<typeof createClient> | null = null;
export function getSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(supabaseMissingMessage);
  }

  if (!browserSupabase) {
    browserSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false }
    });
  }
  return browserSupabase;
}

export const supabase = supabaseUrl && supabaseAnonKey ? getSupabase() : createUnavailableSupabaseClient();

// Server-only admin client factory (avoids constructing in the browser bundle)
export function getSupabaseAdmin() {
  if (isBrowser) {
    throw new Error('supabaseAdmin is server-only and cannot be used in the browser');
  }
  if (!supabaseUrl) {
    throw new Error(supabaseMissingMessage);
  }
  if (!supabaseServiceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });
}

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
