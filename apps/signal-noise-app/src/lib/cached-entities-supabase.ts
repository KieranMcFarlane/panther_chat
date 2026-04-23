import { supabase as _supabase } from '@/lib/pg-client'

export const cachedEntitiesSupabase = _supabase

export const cachedEntitiesSupabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://example.supabase.co'
export const cachedEntitiesSupabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'development-anon-key'
