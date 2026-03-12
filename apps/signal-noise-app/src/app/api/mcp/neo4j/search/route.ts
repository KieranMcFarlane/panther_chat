import { NextRequest, NextResponse } from 'next/server';

export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      status: 'retired',
      error: 'The legacy Neo4j MCP search route has been retired.',
      replacement: 'Use graph-backed search APIs instead.',
      suggested_endpoints: ['/api/entities/search', '/api/search'],
    },
    { status: 410 },
  );
}
