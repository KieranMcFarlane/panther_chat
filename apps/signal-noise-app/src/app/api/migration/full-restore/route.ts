import { NextRequest, NextResponse } from 'next/server';

export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      status: 'retired',
      error: 'The legacy Neo4j full-restore migration route has been retired.',
      replacement: 'Use FalkorDB and Supabase sync paths instead of Neo4j restore flows.',
      suggested_endpoints: ['/api/sync/graph-to-supabase', '/api/sync/incremental'],
    },
    { status: 410 },
  );
}
