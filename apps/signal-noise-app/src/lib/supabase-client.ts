import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const isBrowser = typeof window !== 'undefined';

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
}
if (isBrowser && !supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// Singleton browser/client Supabase instance
let browserSupabase: ReturnType<typeof createClient> | null = null;
export function getSupabase() {
  if (!browserSupabase) {
    if (!supabaseAnonKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
    browserSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false }
    });
  }
  return browserSupabase;
}

export const supabase = getSupabase();

// Server-only admin client factory (avoids constructing in the browser bundle)
export function getSupabaseAdmin() {
  if (isBrowser) {
    throw new Error('supabaseAdmin is server-only and cannot be used in the browser');
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