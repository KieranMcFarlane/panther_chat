// Batch Entity Processing API
import { NextRequest, NextResponse } from 'next/server';
import neo4j from 'neo4j-driver';

// Initialize Neo4j driver
const neo4jDriver = neo4j.driver(
  process.env.NEO4J_URI!,
  neo4j.auth.basic(process.env.NEO4J_USERNAME!, process.env.NEO4J_PASSWORD!)
);

interface BatchRequest {
  entity_types?: string[];
  batch_size?: number;
  include_claude_analysis?: boolean;
  include_perplexity_research?: boolean;
  include_brightdata_scraping?: boolean;
}

interface EntityData {
  neo4j_id: string;
  name: string;
  type: string;
  sport: string;
  country: string;
  properties: any;
  labels: string[];
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: BatchRequest = await request.json();
    const {
      entity_types = ['club', 'league', 'organization', 'person'],
      batch_size = 5,
      include_claude_analysis = true,
      include_perplexity_research = true,
      include_brightdata_scraping = false
    } = body;

    console.log(`🚀 Starting batch processing for entity types: ${entity_types.join(', ')}`);

    // Get all entities matching the specified types
    const session = neo4jDriver.session();
    let entities: EntityData[] = [];
    
    try {
      const result = await session.run(`
        MATCH (n:Entity)
        WHERE n.type IN $entity_types
        RETURN 
          id(n) as neo4j_id,
          n.name as name,
          n.type as type,
          n.sport as sport,
          n.country as country,
          labels(n) as labels,
          properties(n) as properties
        ORDER BY n.name
      `, { entity_types });

      entities = result.records.map(record => ({
        neo4j_id: record.get('neo4j_id').toString(),
        name: record.get('name'),
        type: record.get('type'),
        sport: record.get('sport') || 'Unknown',
        country: record.get('country') || 'Unknown',
        labels: record.get('labels'),
        properties: record.get('properties') || {}
      }));

    } finally {
      await session.close();
    }

    console.log(`📊 Found ${entities.length} entities to process`);

    // Group entities by type for processing
    const entitiesByType: Record<string, EntityData[]> = {};
    for (const entity of entities) {
      if (!entitiesByType[entity.type]) {
        entitiesByType[entity.type] = [];
      }
      entitiesByType[entity.type].push(entity);
    }

    // Create processing batches
    const batches: EntityData[][] = [];
    const currentBatch: EntityData[] = [];

    for (const entity of entities) {
      currentBatch.push(entity);
      
      if (currentBatch.length >= batch_size) {
        batches.push([...currentBatch]);
        currentBatch.length = 0; // Clear array
      }
    }

    if (currentBatch.length > 0) {
      batches.push([...currentBatch]);
    }

    console.log(`📦 Created ${batches.length} batches with max size ${batch_size}`);

    // Ensure we have entities before creating batch info
    if (entities.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No entities found matching the specified criteria',
        entity_types,
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }

    // Calculate entity type counts
    const entityTypeCounts: Record<string, number> = {};
    for (const type of Object.keys(entitiesByType)) {
      entityTypeCounts[type] = entitiesByType[type].length;
    }

    // Create batch information
    const batchData = {
      total_entities: entities.length,
      total_batches: batches.length,
      batch_size,
      entities_by_type: entityTypeCounts,
      batches: batches.map((batch, index) => ({
        batch_number: index + 1,
        entity_count: batch.length,
        entities: batch.map(entity => ({
          neo4j_id: entity.neo4j_id,
          name: entity.name,
          type: entity.type,
          sport: entity.sport
        }))
      })),
      enrichment_options: {
        include_claude_analysis,
        include_perplexity_research,
        include_brightdata_scraping
      },
      estimated_processing_time: entities.length * 2000, // ~2 seconds per entity
      processing_time_ms: Date.now() - startTime
    };

    return NextResponse.json({
      success: true,
      batch_info: batchData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Batch processing API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  // Get current statistics
  const session = neo4jDriver.session();
  
  try {
    const statsResult = await session.run(`
      MATCH (n:Entity)
      RETURN 
        n.type as type,
        count(n) as count,
        count(DISTINCT n.sport) as sports
      ORDER BY count DESC
    `);

    const enrichmentResult = await session.run(`
      MATCH (n:Entity)
      WHERE n.ai_enrichment IS NOT NULL
      RETURN 
        n.type as type,
        count(n) as enriched_count,
        avg(n.ai_enrichment.enrichment_results.processing_time_ms) as avg_processing_time
    `);

    const stats = statsResult.records.map(record => ({
      type: record.get('type'),
      count: record.get('count').toNumber(),
      sports: record.get('sports').toNumber()
    }));

    const enrichmentStats = enrichmentResult.records.map(record => ({
      type: record.get('type'),
      enriched_count: record.get('enriched_count').toNumber(),
      avg_processing_time: record.get('avg_processing_time')?.toNumber() || 0
    }));

    return NextResponse.json({
      status: 'Batch Entity Processing API',
      version: '2.0',
      endpoints: {
        POST: '/api/batch-process - Create and get batch information',
      },
      current_stats: {
        total_entities: stats.reduce((sum, s) => sum + s.count, 0),
        entity_types: stats,
        enriched_entities: enrichmentStats,
        total_enriched: enrichmentStats.reduce((sum, s) => sum + s.enriched_count, 0)
      },
      available_services: {
        claude_analysis: !!process.env.ANTHROPIC_AUTH_TOKEN,
        perplexity_research: !!process.env.PERPLEXITY_API_KEY,
        brightdata_scraping: !!process.env.BRIGHTDATA_API_TOKEN
      }
    });

  } finally {
    await session.close();
  }
}