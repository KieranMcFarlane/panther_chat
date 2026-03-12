import { NextRequest, NextResponse } from 'next/server';
import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase';
import { resolveGraphId } from '@/lib/graph-id';

function mapTypeToLabels(type: string): string[] {
  switch (type) {
    case 'club':
      return ['Club', 'Company', 'Team'];
    case 'sportsperson':
      return ['Sportsperson', 'Person', 'Stakeholder'];
    case 'poi':
    case 'contact':
      return ['POI', 'Contact', 'Stakeholder', 'Person'];
    case 'tender':
      return ['RFP', 'RfpOpportunity'];
    case 'league':
      return ['League'];
    case 'venue':
      return ['Venue', 'Stadium'];
    default:
      return [];
  }
}

function inferEntityType(labels: string[] = []): string {
  if (labels.includes('Club') || labels.includes('Company') || labels.includes('Team')) return 'club';
  if (labels.includes('League')) return 'league';
  if (labels.includes('Competition')) return 'competition';
  if (labels.includes('Venue') || labels.includes('Stadium')) return 'venue';
  if (labels.includes('RfpOpportunity') || labels.includes('RFP')) return 'tender';
  if (labels.includes('POI') || labels.includes('Contact') || labels.includes('Stakeholder')) return 'poi';
  if (labels.includes('Sportsperson') || labels.includes('Person')) return 'sportsperson';
  return 'entity';
}

function convertCachedEntityToGraphEntity(entity: any): any {
  const properties = entity.properties || {};
  const labels = entity.labels || [];
  const entityType = inferEntityType(labels);
  const stableId = resolveGraphId(entity) || 'unknown';

  return {
    entity_id: stableId,
    graph_id: stableId,
    entity_type: entityType,
    name: properties.name || stableId,
    description: properties.description || properties.overview || '',
    division_id: properties.division_id || properties.league_id || '',
    location: properties.location || properties.city || properties.country || properties.headquarters || '',
    club_id: properties.club_id || properties.team_id || '',
    role: properties.role || properties.position || '',
    title: properties.title || properties.name || stableId,
    affiliation: properties.affiliation || properties.club_id || '',
    contact_info: properties.contact_info || {},
    website: properties.website || properties.url || '',
    trust_score: properties.trust_score || 0.8,
    priority_score: properties.priority_score || properties.priorityScore || 0.7,
    influence_score: properties.influence_score || 0.7,
    poi_score: properties.poi_score || 0.7,
    opportunity_score: properties.opportunity_score || 0.7,
    source: properties.source || 'supabase-cache',
    last_updated: properties.last_updated || entity.updated_at || entity.created_at || new Date().toISOString(),
    vector_embedding: properties.embedding || [],
    notes: properties.notes || '',
    key_personnel: properties.key_personnel || [],
    linked_tenders: properties.linked_tenders || [],
    linked_contacts: properties.linked_contacts || [],
    tags: properties.tags || [],
    labels,
    ...properties
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.max(1, Math.min(parseInt(searchParams.get('limit') || '50', 10), 1000));
    const type = searchParams.get('type') || '';

    console.log(`📊 Fetching entities from Supabase cache with limit: ${limit}, type: ${type || 'all'}`);

    let query = supabase
      .from('cached_entities')
      .select('id, graph_id, neo4j_id, labels, properties, created_at, updated_at')
      .limit(limit);

    const requiredLabels = mapTypeToLabels(type);
    if (requiredLabels.length > 0) {
      query = query.overlaps('labels', requiredLabels);
    }

    const { data, error } = await query.order('properties->>name', { ascending: true });

    if (error) {
      throw error;
    }

    const entities = (data || []).map(convertCachedEntityToGraphEntity);

    console.log(`✅ Retrieved ${entities.length} entities from Supabase cache`);
    return NextResponse.json(entities);
  } catch (error) {
    console.error('❌ Error fetching sports entities from Supabase cache:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch sports entities' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

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
