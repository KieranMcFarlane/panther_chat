import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false
  }
});

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