import { NextRequest, NextResponse } from 'next/server';

// Mock data for development - replace with actual Neo4j queries
const mockEntities = [
  {
    entity_id: 'manchester-united',
    entity_type: 'club',
    name: 'Manchester United',
    division_id: 'premier-league',
    location: 'Manchester, England',
    digital_presence_score: 8.5,
    revenue_estimate: '£627m',
    key_personnel: ['Erik ten Hag', 'Richard Arnold', 'John Murtough'],
    opportunity_score: 9.2,
    linked_tenders: ['tender-001', 'tender-002'],
    tags: ['premier-league', 'manchester', 'football'],
    source: 'official-website',
    last_updated: '2024-01-15T10:30:00Z',
    trust_score: 9.5,
    vector_embedding: [0.1, 0.2, 0.3],
    priority_score: 8.8,
    notes: 'Major Premier League club with high commercial potential'
  },
  {
    entity_id: 'marcus-rashford',
    entity_type: 'sportsperson',
    name: 'Marcus Rashford',
    club_id: 'manchester-united',
    role: 'Forward',
    influence_score: 9.1,
    career_stats: {
      goals: 123,
      appearances: 350,
      assists: 67
    },
    connections: ['manchester-united', 'england-national-team'],
    tags: ['forward', 'england', 'premier-league'],
    source: 'official-website',
    last_updated: '2024-01-15T10:30:00Z',
    trust_score: 9.0,
    vector_embedding: [0.2, 0.3, 0.4],
    priority_score: 8.5,
    notes: 'High-profile player with significant social influence'
  },
  {
    entity_id: 'john-smith-ceo',
    entity_type: 'poi',
    name: 'John Smith',
    affiliation: 'Manchester United',
    role: 'CEO',
    contact_info: {
      email: 'john.smith@manutd.com',
      phone: '+44 161 868 8000'
    },
    poi_score: 8.7,
    relationship_strength: 0.9,
    tags: ['ceo', 'manchester-united', 'executive'],
    source: 'linkedin',
    last_updated: '2024-01-15T10:30:00Z',
    trust_score: 8.8,
    vector_embedding: [0.3, 0.4, 0.5],
    priority_score: 8.2,
    notes: 'Key decision maker at Manchester United'
  },
  {
    entity_id: 'tender-001',
    entity_type: 'tender',
    title: 'Digital Transformation Services',
    associated_club_id: 'manchester-united',
    division_id: 'premier-league',
    deadline: '2024-03-15T23:59:59Z',
    priority_score: 8.5,
    linked_contacts: ['john-smith-ceo'],
    tags: ['digital', 'transformation', 'technology'],
    source: 'tender-portal',
    last_updated: '2024-01-15T10:30:00Z',
    trust_score: 8.0,
    vector_embedding: [0.4, 0.5, 0.6],
    notes: 'High-value digital transformation opportunity'
  }
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const type = searchParams.get('type');
    
    let entities = mockEntities;
    
    // Filter by type if specified
    if (type && ['club', 'sportsperson', 'poi', 'tender', 'contact'].includes(type)) {
      entities = entities.filter(entity => entity.entity_type === type);
    }
    
    // Apply limit
    entities = entities.slice(0, limit);
    
    return NextResponse.json(entities);
  } catch (error) {
    console.error('Error fetching sports entities:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch sports entities' },
      { status: 500 }
    );
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

