import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { entityType, name, limit = 10 } = await request.json();
    
    console.log('Searching Neo4j entities:', { entityType, name, limit });
    
    // Build Cypher query based on search parameters
    let query = 'MATCH (n';
    const conditions = [];
    const params: any = { limit };
    
    if (entityType) {
      // Handle different entity types
      switch (entityType.toLowerCase()) {
        case 'club':
          query += ':Club';
          break;
        case 'player':
          query += ':Player';
          break;
        case 'competition':
          query += ':Competition';
          break;
        case 'league':
          query += ':League';
          break;
        default:
          query += `:${entityType}`;
      }
    }
    
    query += ')';
    
    if (name) {
      conditions.push('n.name CONTAINS $name');
      params.name = name;
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' RETURN n LIMIT $limit';
    
    // For now, we'll mock the Neo4j connection since we don't have MCP server running
    // In production, this would call the actual MCP server
    const mockResults = [
      {
        id: 'mock-1',
        name: name ? `${name} FC` : 'Manchester United',
        type: entityType || 'Club',
        properties: {
          founded: 1878,
          stadium: 'Old Trafford',
          capacity: 74879,
          country: 'England'
        }
      },
      {
        id: 'mock-2', 
        name: name ? `${name} City` : 'Manchester City',
        type: entityType || 'Club',
        properties: {
          founded: 1880,
          stadium: 'Etihad Stadium',
          capacity: 55109,
          country: 'England'
        }
      }
    ];
    
    console.log('Neo4j search results:', mockResults);
    
    return NextResponse.json({
      success: true,
      data: mockResults,
      query: query,
      params: params
    });
    
  } catch (error) {
    console.error('Neo4j search API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to search Neo4j entities',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}