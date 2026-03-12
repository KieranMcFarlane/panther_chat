import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      status: 'retired',
      error: 'The legacy Neo4j-to-Supabase sync alias has been retired.',
      replacement: 'Use /api/sync/graph-to-supabase instead.',
    },
    { status: 410 },
  );
}

export async function GET() {
  return NextResponse.json(
    {
      status: 'retired',
      error: 'The legacy Neo4j-to-Supabase sync alias has been retired.',
      replacement: 'Use /api/sync/graph-to-supabase instead.',
    },
    { status: 410 },
  );
}
