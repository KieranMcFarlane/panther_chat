import { NextResponse } from 'next/server'
import { buildEmptyEntitiesTaxonomy } from '@/lib/entities-taxonomy'
import { getEntitiesTaxonomyData } from '@/lib/entity-browser-data'

export async function GET() {
  try {
    return NextResponse.json(await getEntitiesTaxonomyData())
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
