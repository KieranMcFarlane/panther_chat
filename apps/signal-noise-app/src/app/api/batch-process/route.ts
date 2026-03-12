// Batch Entity Processing API
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-client';
import { resolveGraphId } from '@/lib/graph-id';

interface BatchRequest {
  entity_types?: string[];
  batch_size?: number;
  include_claude_analysis?: boolean;
  include_perplexity_research?: boolean;
  include_brightdata_scraping?: boolean;
}

interface EntityData {
  id: string;
  graph_id: string;
  name: string;
  type: string;
  sport: string;
  country: string;
  properties: Record<string, any>;
  labels: string[];
}

interface CachedEntityRow {
  id: string;
  graph_id: string | null;
  neo4j_id: string | null;
  labels: string[] | null;
  properties: Record<string, any> | null;
  created_at?: string;
  updated_at?: string;
}

const DEFAULT_ENTITY_TYPES = ['club', 'league', 'organization', 'person'];
const PAGE_SIZE = 1000;

function normalizeEntityType(row: CachedEntityRow): string {
  const properties = row.properties || {};
  const labels = row.labels || [];
  const type = String(properties.type || '').toLowerCase();

  if (type) {
    return type;
  }
  if (labels.includes('Club') || labels.includes('Company') || labels.includes('Team')) return 'club';
  if (labels.includes('League')) return 'league';
  if (labels.includes('Organization')) return 'organization';
  if (labels.includes('Person') || labels.includes('POI') || labels.includes('Contact')) return 'person';
  if (labels.includes('Venue') || labels.includes('Stadium')) return 'venue';
  if (labels.includes('RFP') || labels.includes('RfpOpportunity')) return 'tender';
  return 'entity';
}

function mapRowToEntity(row: CachedEntityRow): EntityData {
  const properties = row.properties || {};
  const stableId = resolveGraphId(row) || row.id;
  return {
    id: stableId,
    graph_id: stableId,
    name: properties.name || stableId,
    type: normalizeEntityType(row),
    sport: properties.sport || 'Unknown',
    country: properties.country || 'Unknown',
    properties,
    labels: row.labels || [],
  };
}

async function fetchCachedEntities(): Promise<EntityData[]> {
  const supabase = getSupabaseAdmin();
  const entities: EntityData[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('cached_entities')
      .select('id, graph_id, neo4j_id, labels, properties, created_at, updated_at')
      .order('properties->>name', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    const page = ((data || []) as CachedEntityRow[]).map(mapRowToEntity);
    entities.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }

    offset += PAGE_SIZE;
  }

  return entities;
}

function filterEntitiesByType(entities: EntityData[], entityTypes: string[]): EntityData[] {
  const allowed = new Set(entityTypes.map((type) => type.toLowerCase()));
  return entities.filter((entity) => allowed.has(entity.type.toLowerCase()));
}

function createEntityTypeCounts(entities: EntityData[]): Record<string, number> {
  return entities.reduce<Record<string, number>>((counts, entity) => {
    counts[entity.type] = (counts[entity.type] || 0) + 1;
    return counts;
  }, {});
}

function createBatches(entities: EntityData[], batchSize: number): EntityData[][] {
  const batches: EntityData[][] = [];

  for (let index = 0; index < entities.length; index += batchSize) {
    batches.push(entities.slice(index, index + batchSize));
  }

  return batches;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: BatchRequest = await request.json();
    const {
      entity_types = DEFAULT_ENTITY_TYPES,
      batch_size = 5,
      include_claude_analysis = true,
      include_perplexity_research = true,
      include_brightdata_scraping = false,
    } = body;

    console.log(`🚀 Starting batch processing for entity types: ${entity_types.join(', ')}`);

    const allEntities = await fetchCachedEntities();
    const entities = filterEntitiesByType(allEntities, entity_types);

    console.log(`📊 Found ${entities.length} entities to process from Supabase cache`);

    if (entities.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No entities found matching the specified criteria',
          entity_types,
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      );
    }

    const batches = createBatches(entities, Math.max(1, batch_size));

    console.log(`📦 Created ${batches.length} batches with max size ${batch_size}`);

    return NextResponse.json({
      success: true,
      batch_info: {
        total_entities: entities.length,
        total_batches: batches.length,
        batch_size,
        entities_by_type: createEntityTypeCounts(entities),
        batches: batches.map((batch, index) => ({
          batch_number: index + 1,
          entity_count: batch.length,
          entities: batch.map((entity) => ({
            graph_id: entity.graph_id || entity.id,
            name: entity.name,
            type: entity.type,
            sport: entity.sport,
          })),
        })),
        enrichment_options: {
          include_claude_analysis,
          include_perplexity_research,
          include_brightdata_scraping,
        },
        estimated_processing_time: entities.length * 2000,
        processing_time_ms: Date.now() - startTime,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Batch processing API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const entities = await fetchCachedEntities();
    const entityTypes = createEntityTypeCounts(entities);
    const typeEntries = Object.entries(entityTypes)
      .map(([type, count]) => ({
        type,
        count,
        sports: new Set(
          entities
            .filter((entity) => entity.type === type)
            .map((entity) => entity.sport)
            .filter(Boolean),
        ).size,
      }))
      .sort((left, right) => right.count - left.count);

    const enrichmentStats = typeEntries
      .map(({ type }) => {
        const typedEntities = entities.filter((entity) => entity.type === type);
        const enrichedEntities = typedEntities.filter((entity) => entity.properties.ai_enrichment);
        const processingTimes = enrichedEntities
          .map((entity) => Number(entity.properties.ai_enrichment?.enrichment_results?.processing_time_ms || 0))
          .filter((value) => Number.isFinite(value) && value > 0);

        return {
          type,
          enriched_count: enrichedEntities.length,
          avg_processing_time:
            processingTimes.length > 0
              ? processingTimes.reduce((sum, value) => sum + value, 0) / processingTimes.length
              : 0,
        };
      })
      .filter((entry) => entry.enriched_count > 0);

    return NextResponse.json({
      status: 'Batch Entity Processing API',
      version: '2.0',
      endpoints: {
        POST: '/api/batch-process - Create and get batch information',
      },
      current_stats: {
        total_entities: entities.length,
        entity_types: typeEntries,
        enriched_entities: enrichmentStats,
        total_enriched: enrichmentStats.reduce((sum, entry) => sum + entry.enriched_count, 0),
      },
      available_services: {
        claude_analysis: !!process.env.ANTHROPIC_AUTH_TOKEN,
        perplexity_research: !!process.env.PERPLEXITY_API_KEY,
        brightdata_scraping: !!process.env.BRIGHTDATA_API_TOKEN,
      },
    });
  } catch (error) {
    console.error('Batch processing API stats error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
