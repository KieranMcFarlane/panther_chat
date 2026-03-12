// Relationship-based Entity Traversal and Enrichment API
import { NextRequest, NextResponse } from 'next/server';
import { falkorGraphClient } from '@/lib/falkordb';

// Mark route as dynamic to prevent static generation
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface TraversalRequest {
  start_from?: 'all' | 'leagues' | 'clubs' | 'unenriched';
  enrichment_options: {
    include_claude_analysis: boolean;
    include_perplexity_research: boolean;
    include_brightdata_scraping: boolean;
  };
  batch_size?: number;
}

interface EntityTraversal {
  entity_id: string;
  entity_name: string;
  entity_type: string;
  graph_id: string;
  relationships: Array<{
    target_id: string;
    target_name: string;
    target_type: string;
    relationship_type: string;
  }>;
  enrichment_status: 'not_enriched' | 'version_1' | 'version_2' | 'current';
  processing_priority: number;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: TraversalRequest = await request.json();
    const { start_from = 'all', enrichment_options, batch_size = 3 } = body;

    console.log(`🔍 Starting relationship-based entity traversal from: ${start_from}`);
    console.log(`🧠 Enrichment options:`, enrichment_options);

    let entities: EntityTraversal[] = []
    const filters: string[] = []
    if (start_from === 'leagues') {
      filters.push(`toLower(coalesce(n.type, n.entity_type, '')) CONTAINS 'league'`)
    } else if (start_from === 'unenriched') {
      filters.push(`(n.enrichment_version IS NULL OR n.enrichment_version < '2.0')`)
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : ''
    const rows = await falkorGraphClient.queryRows<{
      entity_id: string
      entity_name: string
      entity_type: string
      enrichment_version: string | null
      target_id: string | null
      target_name: string | null
      target_type: string | null
      relationship_type: string | null
    }>(`
      MATCH (n:Entity)
      ${whereClause}
      OPTIONAL MATCH (n)-[r]->(m:Entity)
      RETURN coalesce(n.neo4j_id, n.entity_id, n.name) as entity_id,
             n.name as entity_name,
             coalesce(n.type, n.entity_type, labels(n)[0], 'Entity') as entity_type,
             n.enrichment_version as enrichment_version,
             coalesce(m.neo4j_id, m.entity_id, m.name) as target_id,
             m.name as target_name,
             coalesce(m.type, m.entity_type, labels(m)[0], 'Entity') as target_type,
             type(r) as relationship_type
      ORDER BY entity_type, entity_name
    `)

    const entityMap = new Map<string, EntityTraversal>()
    for (const row of rows) {
      const entityId = String(row.entity_id || '')
      if (!entityId) continue

      if (!entityMap.has(entityId)) {
        const entityType = String(row.entity_type || 'Entity')
        const enrichmentVersion = row.enrichment_version == null ? undefined : String(row.enrichment_version)
        entityMap.set(entityId, {
          entity_id: entityId,
          entity_name: String(row.entity_name || entityId),
          entity_type: entityType,
          graph_id: entityId,
          relationships: [],
          enrichment_status: getEnrichmentStatus(enrichmentVersion),
          processing_priority: start_from === 'leagues'
            ? 100
            : start_from === 'unenriched'
              ? 90
              : calculatePriority(entityType, enrichmentVersion),
        })
      }

      if (row.target_id && row.relationship_type) {
        entityMap.get(entityId)?.relationships.push({
          target_id: String(row.target_id),
          target_name: String(row.target_name || ''),
          target_type: String(row.target_type || ''),
          relationship_type: String(row.relationship_type),
        })
      }
    }

    entities = Array.from(entityMap.values())

      // Sort by processing priority
      entities.sort((a, b) => b.processing_priority - a.processing_priority);

      console.log(`📊 Found ${entities.length} entities to process via relationship traversal`);

      // Create batches for economical processing
      const batches = [];
      for (let i = 0; i < entities.length; i += batch_size) {
        batches.push(entities.slice(i, i + batch_size));
      }

      console.log(`🎯 Created ${batches.length} batches with ${batch_size} entities per batch`);

      // Process entities through enrichment system
      const processingResults = [];
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`🔄 Processing batch ${i + 1}/${batches.length} with ${batch.length} entities`);
        
        const batchResults = [];
        
        for (const entity of batch) {
          try {
            console.log(`🧠 Enriching ${entity.entity_name} (${entity.entity_type}) - Priority: ${entity.processing_priority}`);
            
            const enrichResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3005'}/api/enrich-entity`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                entity_id: entity.entity_id,
                entity_type: entity.entity_type,
                entity_name: entity.entity_name,
                enrichment_options
              })
            });

            if (enrichResponse.ok) {
              const enrichData = await enrichResponse.json();
              
              batchResults.push({
                entity_id: entity.entity_id,
                entity_name: entity.entity_name,
                entity_type: entity.entity_type,
                success: true,
                opportunity_score: enrichData.enrichment_results?.composite_scores?.opportunity_score || 0,
                digital_maturity: enrichData.enrichment_results?.composite_scores?.digital_maturity || 'LOW',
                processing_time: enrichData.processing_time_ms || 0,
                relationships_processed: entity.relationships.length,
                processing_priority: entity.processing_priority
              });

              console.log(`   ✅ ${entity.entity_name} - Score: ${enrichData.enrichment_results?.composite_scores?.opportunity_score || 0}`);
              
            } else {
              batchResults.push({
                entity_id: entity.entity_id,
                entity_name: entity.entity_name,
                entity_type: entity.entity_type,
                success: false,
                error: `HTTP ${enrichResponse.status}`,
                relationships_processed: entity.relationships.length,
                processing_priority: entity.processing_priority
              });
              
              console.log(`   ❌ ${entity.entity_name} - Failed: HTTP ${enrichResponse.status}`);
            }

            // Small delay between entities to avoid overwhelming APIs
            await new Promise(resolve => setTimeout(resolve, 1000));

          } catch (error) {
            batchResults.push({
              entity_id: entity.entity_id,
              entity_name: entity.entity_name,
              entity_type: entity.entity_type,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              relationships_processed: entity.relationships.length,
              processing_priority: entity.processing_priority
            });
            
            console.log(`   ❌ ${entity.entity_name} - Error: ${error}`);
          }
        }

        processingResults.push({
          batch_number: i + 1,
          batch_size: batch.length,
          results: batchResults,
          batch_success_rate: batchResults.filter(r => r.success).length / batch.length,
          batch_avg_score: batchResults.reduce((sum, r) => sum + (r.opportunity_score || 0), 0) / batchResults.length
        });

        // Brief pause between batches for economical processing
        if (i < batches.length - 1) {
          console.log(`⏱️  Pausing between batches...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }

      // Calculate overall statistics
      const allResults = processingResults.flatMap(br => br.results);
      const successfulEnrichments = allResults.filter(r => r.success);
      const avgOpportunityScore = successfulEnrichments.reduce((sum, r) => sum + (r.opportunity_score || 0), 0) / successfulEnrichments.length;

      const finalResults = {
        success: true,
        traversal_method: start_from,
        total_entities_found: entities.length,
        total_batches_created: batches.length,
        batch_size_used: batch_size,
        processing_summary: {
          total_processed: allResults.length,
          successful_enrichments: successfulEnrichments.length,
          failed_enrichments: allResults.length - successfulEnrichments.length,
          overall_success_rate: (successfulEnrichments.length / allResults.length) * 100,
          average_opportunity_score: avgOpportunityScore || 0,
          total_relationships_traversed: entities.reduce((sum, e) => sum + e.relationships.length, 0)
        },
        enrichment_options_used: enrichment_options,
        batch_results: processingResults,
        entity_details: entities.map(e => ({
          entity_id: e.entity_id,
          entity_name: e.entity_name,
          entity_type: e.entity_type,
          relationships_count: e.relationships.length,
          enrichment_status: e.enrichment_status,
          processing_priority: e.processing_priority,
          relationships: e.relationships
        })),
        processing_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };

      console.log(`🎉 Relationship traversal completed!`);
      console.log(`📊 Processed ${finalResults.processing_summary.total_processed} entities`);
      console.log(`✅ Success rate: ${finalResults.processing_summary.overall_success_rate.toFixed(1)}%`);
      console.log(`📈 Avg opportunity score: ${finalResults.processing_summary.average_opportunity_score.toFixed(1)}`);

      return NextResponse.json(finalResults);

  } catch (error) {
    console.error('Relationship traversal error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

function getEnrichmentStatus(version: string | null): 'not_enriched' | 'version_1' | 'version_2' | 'current' {
  if (!version) return 'not_enriched';
  if (version.startsWith('2.')) return 'version_2';
  if (version.startsWith('1.')) return 'version_1';
  return 'current';
}

function calculatePriority(entityType: string, enrichmentVersion: string | null): number {
  let basePriority = 50;
  
  // Entity type priority
  switch (entityType) {
    case 'league': basePriority = 100; break;
    case 'club': basePriority = 90; break;
    case 'organization': basePriority = 80; break;
    case 'person': basePriority = 70; break;
    case 'competition': basePriority = 60; break;
    case 'venue': basePriority = 40; break;
    default: basePriority = 30;
  }
  
  // Enrichment status priority (unenriched gets higher priority)
  if (!enrichmentVersion) {
    basePriority += 20;
  } else if (!enrichmentVersion.startsWith('2.')) {
    basePriority += 10;
  }
  
  return basePriority;
}

export async function GET() {
  return NextResponse.json({
    status: 'Relationship-based Entity Traversal API',
    version: '1.0',
    endpoints: {
      POST: '/api/traversal-enrichment - Process all entities using relationship traversal',
    },
    traversal_options: {
      'all': 'Process all entities with their relationships',
      'leagues': 'Start from leagues and traverse to member clubs',
      'unenriched': 'Process only entities not enriched to version 2.0'
    },
    features: [
      'Graph relationship traversal',
      'Priority-based processing',
      'Economical batch processing',
      'BrightData web scraping integration',
      'Claude Agent analysis',
      'Perplexity market research'
    ]
  });
}
