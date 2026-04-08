import { NextResponse } from 'next/server'
import { getCanonicalEntitiesSnapshot } from '@/lib/canonical-entities-snapshot'
import { buildEntitiesTaxonomy, buildEmptyEntitiesTaxonomy } from '@/lib/entities-taxonomy'

export async function GET() {
  const startedAt = Date.now()
  try {
    const canonicalEntities = await getCanonicalEntitiesSnapshot()

    return NextResponse.json(
      buildEntitiesTaxonomy(canonicalEntities, {
        source: 'canonical_snapshot',
        latencyMs: Date.now() - startedAt,
      }),
    )
  } catch (error) {
    console.error('❌ Failed to fetch entities taxonomy:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch taxonomy',
        ...buildEmptyEntitiesTaxonomy({ source: 'canonical_snapshot_error' }),
      },
      { status: 500 }
    )
  }
}
