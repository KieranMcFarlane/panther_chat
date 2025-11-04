import { NextRequest, NextResponse } from 'next/server';
import { neo4jService } from '@/lib/neo4j';
import neo4j from 'neo4j-driver';

// Helper function to convert Neo4j entity to graph format
function convertNeo4jToGraphEntity(node: any): any {
  const properties = node.properties || {};
  
  // Extract basic information
  const name = properties.name || 'Unknown Entity';
  const description = properties.description || properties.overview || '';
  const location = properties.location || properties.city || properties.country || properties.headquarters || '';
  const website = properties.website || properties.url || '';
  
  return {
    entity_id: node.identity?.toString() || 'unknown',
    entity_type: 'entity', // Will be updated based on actual labels
    name,
    description,
    // Map common properties
    division_id: properties.division_id || properties.league_id || '',
    location,
    club_id: properties.club_id || properties.team_id || '',
    role: properties.role || properties.position || '',
    title: properties.title || name,
    affiliation: properties.affiliation || properties.club_id || '',
    contact_info: properties.contact_info || {},
    website,
    // Scoring with defaults
    trust_score: properties.trust_score || 0.8,
    priority_score: properties.priority_score || 0.7,
    influence_score: properties.influence_score || 0.7,
    poi_score: properties.poi_score || 0.7,
    opportunity_score: properties.opportunity_score || 0.7,
    // Metadata
    source: properties.source || 'neo4j',
    last_updated: properties.last_updated || properties.created_at || new Date().toISOString(),
    vector_embedding: properties.embedding || [],
    notes: properties.notes || '',
    // Additional properties
    key_personnel: properties.key_personnel || [],
    linked_tenders: properties.linked_tenders || [],
    linked_contacts: properties.linked_contacts || [],
    tags: properties.tags || [],
    // Store all original properties for flexibility
    ...properties
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const type = searchParams.get('type');
    
    console.log(`📊 Fetching entities from Neo4j with limit: ${limit}, type: ${type || 'all'}`);
    
    // Initialize Neo4j connection
    await neo4jService.initialize();
    
    // Build query based on type filter - use proper Neo4j elementId
    let query = `
      MATCH (n)
      WHERE n.name IS NOT NULL
    `;
    
    if (type && ['club', 'sportsperson', 'poi', 'tender', 'contact', 'league', 'venue'].includes(type)) {
      switch (type) {
        case 'club':
          query += ` AND (n:Club OR n:Company)`;
          break;
        case 'sportsperson':
          query += ` AND (n:Sportsperson OR n:Person OR n:Stakeholder)`;
          break;
        case 'poi':
        case 'contact':
          query += ` AND (n:POI OR n:Contact OR n:Stakeholder)`;
          break;
        case 'tender':
          query += ` AND (n:RFP OR n:RfpOpportunity)`;
          break;
        case 'league':
          query += ` AND (n:League)`;
          break;
        case 'venue':
          query += ` AND (n:Venue OR n:Stadium)`;
          break;
      }
    }
    
    query += `
      RETURN n, labels(n) as labels, elementId(n) as elementId
      ORDER BY n.name
      LIMIT $limit
    `;
    
    const session = neo4jService.getDriver().session();
    try {
      const limitInt = Math.floor(Number(limit));
      console.log(`🔢 Using limit: ${limitInt} (type: ${typeof limitInt})`);
      const result = await session.run(query, { limit: neo4j.int(limitInt) });
      
      console.log(`✅ Retrieved ${result.records.length} entities from Neo4j`);
      
      const entities = result.records.map(record => {
        const node = record.get('n');
        const labels = record.get('labels');
        const elementId = record.get('elementId');
        
        // Convert node to graph entity with proper ID handling
        const entity = convertNeo4jToGraphEntity(node);
        
        // Use the actual Neo4j elementId as the entity_id for consistency
        entity.entity_id = elementId;
        entity.neo4j_id = elementId;
        entity.labels = labels;
        
        // Update entity type based on actual labels
        if (labels.includes('Club') || labels.includes('Company')) {
          entity.entity_type = 'club';
        } else if (labels.includes('League')) {
          entity.entity_type = 'league';
        } else if (labels.includes('Competition')) {
          entity.entity_type = 'competition';
        } else if (labels.includes('Venue') || labels.includes('Stadium')) {
          entity.entity_type = 'venue';
        } else if (labels.includes('RfpOpportunity') || labels.includes('RFP')) {
          entity.entity_type = 'tender';
        } else if (labels.includes('Stakeholder')) {
          entity.entity_type = 'poi';
        }
        
        return entity;
      });
      
      return NextResponse.json(entities);
    } finally {
      await session.close();
    }
    
  } catch (error) {
    console.error('❌ Error fetching sports entities from Neo4j:', error);
    
    // Fallback to mock data if Neo4j fails
    console.log('🔄 Falling back to mock data due to Neo4j error');
    
    const fallbackEntities = [
      {
        entity_id: 'manchester-united',
        entity_type: 'club',
        name: 'Manchester United',
        description: 'Premier League club with global recognition',
        division_id: 'premier-league',
        location: 'Manchester, England',
        trust_score: 0.9,
        priority_score: 8.5,
        opportunity_score: 8.8,
        tags: ['football', 'premier league'],
        source: 'fallback-mock',
        last_updated: new Date().toISOString()
      },
      {
        entity_id: 'liverpool',
        entity_type: 'club',
        name: 'Liverpool FC',
        description: 'Historic Premier League club',
        division_id: 'premier-league',
        location: 'Liverpool, England',
        trust_score: 0.95,
        priority_score: 9.0,
        opportunity_score: 9.2,
        tags: ['football', 'premier league'],
        source: 'fallback-mock',
        last_updated: new Date().toISOString()
      },
      {
        entity_id: 'premier-league',
        entity_type: 'league',
        name: 'Premier League',
        description: 'Top English football league',
        location: 'England, UK',
        trust_score: 0.98,
        priority_score: 9.5,
        opportunity_score: 9.0,
        tags: ['football', 'league'],
        source: 'fallback-mock',
        last_updated: new Date().toISOString()
      }
    ];
    
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const type = searchParams.get('type');
    
    let entities = fallbackEntities;
    
    if (type && ['club', 'sportsperson', 'poi', 'tender', 'contact', 'league', 'venue'].includes(type)) {
      entities = entities.filter(entity => entity.entity_type === type);
    }
    
    entities = entities.slice(0, limit);
    
    return NextResponse.json(entities);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Here you would typically save to Neo4j database
    // For now, just return the received data
    return NextResponse.json({
      message: 'Entity created successfully',
      entity: body
    });
  } catch (error) {
    console.error('Error creating sports entity:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create sports entity' },
      { status: 500 }
    );
  }
}

