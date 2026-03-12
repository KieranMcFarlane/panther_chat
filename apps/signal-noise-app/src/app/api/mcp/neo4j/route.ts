import { NextRequest, NextResponse } from 'next/server';

export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      status: 'retired',
      error: 'The legacy Neo4j MCP route has been retired.',
      replacement: 'Use graph-backed entity and relationship APIs instead.',
      suggested_endpoints: ['/api/entities/search', '/api/search', '/api/graph/relationships'],
    },
    { status: 410 },
  );
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
