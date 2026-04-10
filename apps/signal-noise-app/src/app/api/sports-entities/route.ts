import { NextRequest, NextResponse } from 'next/server';
import { getCanonicalEntitiesSnapshot } from '@/lib/canonical-entities-snapshot';
import { getCanonicalEntityRole } from '@/lib/entity-role-taxonomy';
import { resolveEntityUuid } from '@/lib/entity-public-id';

export const dynamic = 'force-dynamic';

function matchesType(entity: any, type: string): boolean {
  if (!type || type === 'all') return true;
  const labels = (entity.labels || []).map((label: string) => String(label).toLowerCase());
  const props = entity.properties || {};
  const entityType = String(props.type || '').toLowerCase();
  const entityRole = getCanonicalEntityRole(entity).toLowerCase();
  const normalized = type.toLowerCase();

  return labels.includes(normalized) ||
    entityType === normalized ||
    entityRole === normalized ||
    String(props.entityClass || props.entity_class || '').toLowerCase() === normalized;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const type = searchParams.get('type') || 'all';
    const sport = (searchParams.get('sport') || '').trim().toLowerCase();
    const country = (searchParams.get('country') || '').trim().toLowerCase();

    const entities = await getCanonicalEntitiesSnapshot();
    const filtered = entities
      .filter((entity) => {
        if (!matchesType(entity, type)) return false
        const props = entity.properties || {};
        const entitySport = String(props.sport || '').toLowerCase();
        const entityCountry = String(props.country || '').toLowerCase();
        if (sport && entitySport !== sport) return false
        if (country && entityCountry !== country) return false
        return true
      })
      .slice(0, limit)
      .map((entity) => {
        const properties = entity.properties || {};
        const entityId = entity.graph_id || entity.neo4j_id || entity.id;
        const uuid = resolveEntityUuid({
          id: entity.id,
          neo4j_id: entity.neo4j_id,
          graph_id: entity.graph_id,
          supabase_id: entity.supabase_id || properties.supabase_id,
          properties,
        }) || String(entityId);

        return {
          entity_id: String(entityId),
          neo4j_id: entity.neo4j_id || entityId,
          labels: entity.labels || [],
          entity_type: String(properties.type || entity.labels?.[0] || 'entity').toLowerCase(),
          entity_role: getCanonicalEntityRole(entity),
          uuid,
          name: properties.name || 'Unknown Entity',
          description: properties.description || '',
          division_id: properties.division_id || properties.league_id || '',
          location: properties.location || properties.city || properties.country || '',
          club_id: properties.club_id || properties.team_id || '',
          role: properties.role || properties.position || '',
          trust_score: properties.trust_score || 0.8,
          priority_score: properties.priority_score || 0.7,
          opportunity_score: properties.opportunity_score || 0.7,
          source: 'canonical-snapshot',
          last_updated: properties.last_updated || new Date().toISOString(),
          vector_embedding: properties.embedding || [],
          notes: properties.notes || '',
          key_personnel: properties.key_personnel || [],
          linked_tenders: properties.linked_tenders || [],
          linked_contacts: properties.linked_contacts || [],
          tags: properties.tags || [],
          ...properties
        };
      });

    return NextResponse.json(filtered);
  } catch (error) {
    console.error('❌ Error fetching sports entities:', error);
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
