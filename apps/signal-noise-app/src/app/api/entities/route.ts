import { NextRequest, NextResponse } from 'next/server'
import { getEntityBrowserPageData, type EntityBrowserFilters } from '@/lib/entity-browser-data'

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const search = searchParams.get('search') || ''
    const filters: EntityBrowserFilters = {
      entityType: searchParams.get('entityType') || 'all',
      sport: (searchParams.get('sport') || '').trim() || 'all',
      league: (searchParams.get('league') || '').trim() || 'all',
      country: (searchParams.get('country') || '').trim() || 'all',
      entityClass: (searchParams.get('entityClass') || '').trim() || 'all',
      sortBy: searchParams.get('sortBy') || 'name',
      sortOrder: (searchParams.get('sortOrder') || 'asc') as 'asc' | 'desc',
      limit: searchParams.get('limit') || '20',
    }

    const payload = await getEntityBrowserPageData({ page, search, filters })
    return NextResponse.json(payload)
  } catch (error) {
    console.error('❌ Failed to fetch entities:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch entities' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const requiredFields = ['entity_type', 'name', 'source'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    const newEntity = {
      entity_id: `ENTITY_${Date.now()}`,
      ...body,
      last_updated: new Date().toISOString(),
      vector_embedding: body.vector_embedding || [0.1, 0.2, 0.3]
    };

    return NextResponse.json({
      entity: newEntity,
      message: 'Entity created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating entity:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create entity' },
      { status: 500 }
    );
  }
}
