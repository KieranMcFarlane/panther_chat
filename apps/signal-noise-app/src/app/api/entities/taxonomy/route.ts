import { NextResponse } from 'next/server'
import { getCanonicalEntitiesSnapshot } from '@/lib/canonical-entities-snapshot'
import { buildEntitiesTaxonomy, buildEmptyEntitiesTaxonomy } from '@/lib/entities-taxonomy'

export async function GET() {
  const startedAt = Date.now()
  try {
    const canonicalEntities = await getCanonicalEntitiesSnapshot()
    const taxonomy = buildEntitiesTaxonomy(canonicalEntities, {
      source: 'canonical_entities_snapshot',
      latencyMs: Date.now() - startedAt,
    })

    return NextResponse.json(taxonomy)
  } catch (error) {
    console.error('❌ Failed to fetch entities taxonomy:', error)
    return NextResponse.json(
      buildEmptyEntitiesTaxonomy({ source: 'canonical_entities_snapshot' }),
      { status: 500 }
    )
  }
}
