import { NextRequest, NextResponse } from 'next/server';

export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      status: 'retired',
      error: 'The raw Neo4j query endpoint has been retired.',
      replacement: 'Use cached entity APIs and FalkorDB-backed graph routes instead.',
      suggested_endpoints: [
        '/api/entities',
        '/api/entities/summary',
        '/api/graph/relationships',
        '/api/traversal-enrichment',
      ],
    },
    { status: 410 },
  );
}
