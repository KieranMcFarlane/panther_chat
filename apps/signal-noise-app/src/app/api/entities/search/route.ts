import { NextRequest, NextResponse } from 'next/server';
import { Neo4jService } from '@/lib/neo4j';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const limit = Math.floor(parseInt(searchParams.get('limit') || '50'));

    const neo4j = new Neo4jService();
    await neo4j.initialize();

    let cypherQuery = '';
    let params: any = {};

    if (search) {
      // Search entities by name
      cypherQuery = `
        MATCH (n)
        WHERE toLower(n.name) CONTAINS toLower($search)
        RETURN n 
        ORDER BY n.name 
        LIMIT toInteger($limit)
      `;
      params = { search, limit };
    } else {
      // Get first entities for default list
      cypherQuery = `
        MATCH (n)
        WHERE n.name IS NOT NULL
        RETURN n 
        ORDER BY n.name 
        LIMIT toInteger($limit)
      `;
      params = { limit };
    }

    const session = neo4j.getDriver().session();
    try {
      const result = await session.run(cypherQuery, params);
      
      const entities = result.records.map(record => {
        const node = record.get('n');
        return {
          id: node.identity.toString(),
          name: node.properties.name || `Entity ${node.identity}`,
          type: node.properties.type || 'Unknown',
          sport: node.properties.sport || '',
          country: node.properties.country || ''
        };
      });

      return NextResponse.json({ 
        success: true, 
        entities,
        total: entities.length 
      });
    } finally {
      await session.close();
    }
  } catch (error) {
    console.error('Error fetching entities:', error);
    
    // Return mock data for demonstration
    const mockEntities = Array.from({ length: 50 }, (_, i) => ({
      id: (i + 1).toString(),
      name: `Sports Entity ${i + 1}`,
      type: ['Club', 'League', 'Federation', 'Venue'][i % 4],
      sport: ['Football', 'Basketball', 'Cricket', 'Tennis'][i % 4],
      country: ['England', 'Spain', 'Italy', 'France'][i % 4]
    }));

    return NextResponse.json({ 
      success: true, 
      entities: mockEntities,
      total: mockEntities.length,
      mock: true 
    });
  }
}