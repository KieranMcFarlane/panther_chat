import { NextRequest, NextResponse } from 'next/server';
import { neo4jService } from '@/lib/neo4j';
import neo4j from 'neo4j-driver';

export async function GET(request: NextRequest) {
  try {
    console.log('🔗 Fetching relationships from Neo4j...');
    
    // Initialize Neo4j connection
    await neo4jService.initialize();
    
    const session = neo4jService.getDriver().session();
    try {
      // Get all relationships between entities with names - use ID() to get internal node ID
      const result = await session.run(`
        MATCH (a)-[r]->(b)
        WHERE a.name IS NOT NULL AND b.name IS NOT NULL
        RETURN a.name as from, b.name as to, type(r) as relationship, 
               toString(ID(a)) as fromId, toString(ID(b)) as toId,
               labels(a) as fromLabels, labels(b) as toLabels
        ORDER BY a.name, b.name
      `);
      
      console.log(`✅ Found ${result.records.length} relationships`);
      
      const relationships = result.records.map(record => ({
        from: record.get('from'),
        to: record.get('to'),
        relationship: record.get('relationship'),
        fromId: record.get('fromId'),
        toId: record.get('toId'),
        fromLabels: record.get('fromLabels'),
        toLabels: record.get('toLabels')
      }));
      
      return NextResponse.json(relationships);
    } finally {
      await session.close();
    }
    
  } catch (error) {
    console.error('❌ Error fetching relationships:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch relationships' },
      { status: 500 }
    );
  }
}