import { NextRequest, NextResponse } from 'next/server';

// This endpoint would connect to your AuraDB backend
// For now, it returns mock data that follows the exact schema

export async function GET(request: NextRequest) {
  try {
    // Mock data following the exact Yellow Panther schema
    const mockEntities = [
      {
        entity_id: 'MUFC001',
        entity_type: 'club',
        name: 'Manchester United FC',
        source: 'manual',
        last_updated: new Date().toISOString(),
        trust_score: 9.2,
        vector_embedding: [0.1, 0.2, 0.3], // Mock vector
        priority_score: 9.5,
        notes: 'Premier League football club',
        division_id: 'Premier League',
        location: 'Manchester, England',
        digital_presence_score: 8.8,
        revenue_estimate: '£580M',
        key_personnel: ['CEO', 'Manager', 'Director'],
        opportunity_score: 9.2,
        linked_tenders: ['TENDER001'],
        tags: ['Football', 'Premier League', 'Global Brand']
      },
      {
        entity_id: 'MR001',
        entity_type: 'sportsperson',
        name: 'Marcus Rashford',
        source: 'manual',
        last_updated: new Date().toISOString(),
        trust_score: 8.5,
        vector_embedding: [0.4, 0.5, 0.6],
        priority_score: 8.8,
        notes: 'Manchester United forward',
        club_id: 'MUFC001',
        role: 'Forward',
        influence_score: 8.9,
        career_stats: {
          goals: 120,
          assists: 45,
          appearances: 350
        },
        connections: ['MUFC001', 'POI001'],
        tags: ['Football', 'Forward', 'England', 'Manchester United']
      },
      {
        entity_id: 'POI001',
        entity_type: 'poi',
        name: 'John Smith',
        source: 'manual',
        last_updated: new Date().toISOString(),
        trust_score: 8.8,
        vector_embedding: [0.7, 0.8, 0.9],
        priority_score: 9.2,
        notes: 'CEO of Manchester United',
        affiliation: 'Manchester United FC',
        role: 'CEO',
        contact_info: {
          email: 'john.smith@manutd.com',
          phone: '+44 161 123 4567',
          linkedin: 'linkedin.com/in/johnsmith'
        },
        poi_score: 9.1,
        relationship_strength: 8.9,
        tags: ['CEO', 'Executive', 'Manchester United', 'High Priority']
      },
      {
        entity_id: 'TENDER001',
        entity_type: 'tender',
        name: 'Old Trafford Stadium Upgrade Tender',
        source: 'manual',
        last_updated: new Date().toISOString(),
        trust_score: 8.9,
        vector_embedding: [0.2, 0.3, 0.4],
        priority_score: 9.5,
        notes: 'Major stadium renovation project',
        title: 'Old Trafford Stadium Upgrade Tender',
        associated_club_id: 'MUFC001',
        division_id: 'Premier League',
        deadline: '2024-12-31',
        priority_score: 9.5,
        linked_contacts: ['POI001'],
        tags: ['Infrastructure', 'Stadium', 'High Value', 'Technology']
      }
    ];

    return NextResponse.json({
      entities: mockEntities,
      total: mockEntities.length,
      message: 'Entities retrieved successfully'
    });

  } catch (error) {
    console.error('Error fetching entities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch entities' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate entity data against schema
    const requiredFields = ['entity_type', 'name', 'source'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Mock entity creation
    const newEntity = {
      entity_id: `ENTITY_${Date.now()}`,
      ...body,
      last_updated: new Date().toISOString(),
      vector_embedding: body.vector_embedding || [0.1, 0.2, 0.3]
    };

    return NextResponse.json({
      entity: newEntity,
      message: 'Entity created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating entity:', error);
    return NextResponse.json(
      { error: 'Failed to create entity' },
      { status: 500 }
    );
  }
}





