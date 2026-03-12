import { NextRequest, NextResponse } from 'next/server';
import { falkorGraphClient } from '@/lib/falkordb';

// Mark route as dynamic to prevent static generation (response is too large for ISR)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    console.log('🔗 Fetching relationships from FalkorDB...');

    const relationships = await falkorGraphClient.queryRows<{
      from: string
      to: string
      relationship: string
      fromId: string
      toId: string
      fromLabels: string[]
      toLabels: string[]
    }>(`
      MATCH (a)-[r]->(b)
      WHERE a.name IS NOT NULL AND b.name IS NOT NULL
      RETURN a.name as from,
             b.name as to,
             type(r) as relationship,
             coalesce(a.neo4j_id, a.entity_id, a.name) as fromId,
             coalesce(b.neo4j_id, b.entity_id, b.name) as toId,
             labels(a) as fromLabels,
             labels(b) as toLabels
      ORDER BY a.name, b.name
    `)

    console.log(`✅ Found ${relationships.length} relationships`);
    return NextResponse.json(
      relationships.map((relationship) => ({
        ...relationship,
        source_graph_id: relationship.fromId,
        target_graph_id: relationship.toId,
      }))
    );
    
  } catch (error) {
    console.error('❌ Error fetching relationships:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch relationships' },
      { status: 500 }
    );
  }
}
