import { NextResponse } from 'next/server'
import { buildEmptyEntitiesTaxonomy, buildEntitiesTaxonomy } from '@/lib/entities-taxonomy'
import { getCanonicalEntitiesSnapshot } from '@/lib/canonical-entities-snapshot'
import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'

export async function GET() {
  const startedAt = Date.now()
  try {
    const { data, error } = await supabase
      .from('cached_entities')
      .select('labels, properties')
      .limit(10000)

    if (error) {
      throw error
    }
    return NextResponse.json(
      buildEntitiesTaxonomy(data || [], {
        source: 'supabase',
        latencyMs: Date.now() - startedAt,
      })
    )
  } catch (error) {
    console.warn('⚠️ Failed to fetch entities taxonomy from Supabase; falling back to canonical snapshot', error)

    try {
      const canonicalEntities = await getCanonicalEntitiesSnapshot()
      return NextResponse.json(
        buildEntitiesTaxonomy(canonicalEntities, {
          source: 'canonical_snapshot',
          latencyMs: Date.now() - startedAt,
        })
      )
    } catch (fallbackError) {
      console.warn('⚠️ Failed to build taxonomy from canonical snapshot; returning empty taxonomy payload', fallbackError)
      return NextResponse.json(
        buildEmptyEntitiesTaxonomy({
          source: 'empty_fallback',
        }),
        { status: 200 }
      )
    }
  }
}
