import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      status: 'retired',
      error: 'The legacy Neo4j complete-restore server action has been retired.',
      replacement: 'Use FalkorDB and Supabase sync paths instead of Neo4j restore flows.',
      suggested_endpoints: ['/api/sync/graph-to-supabase', '/api/sync/incremental'],
    },
    { status: 410 },
  );
}
