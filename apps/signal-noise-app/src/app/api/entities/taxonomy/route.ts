import { NextResponse } from 'next/server'
import { getEntitiesTaxonomyData } from '@/lib/entity-browser-data'
import { buildEmptyEntitiesTaxonomy } from '@/lib/entities-taxonomy'

// Cache taxonomy for 60 seconds (entity types/sports/countries don't change often)
let taxonomyCache: { data: any; expiresAt: number } | null = null
const TAXONOMY_TTL_MS = 60_000

export async function GET() {
  // Return cached taxonomy if still fresh
  if (taxonomyCache && taxonomyCache.expiresAt > Date.now()) {
    return NextResponse.json(taxonomyCache.data)
  }

  try {
    const taxonomy = await getEntitiesTaxonomyData()
    taxonomyCache = { data: taxonomy, expiresAt: Date.now() + TAXONOMY_TTL_MS }
    return NextResponse.json(taxonomy)
  } catch (error) {
    console.error('❌ Failed to fetch entities taxonomy:', error)
    return NextResponse.json(
      buildEmptyEntitiesTaxonomy({ source: 'supabase_direct' }),
      { status: 500 }
    )
  }
}
