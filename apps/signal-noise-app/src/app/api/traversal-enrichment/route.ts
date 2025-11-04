// Relationship-based Entity Traversal and Enrichment API
import { NextRequest, NextResponse } from 'next/server';
import { neo4jService } from '@/lib/neo4j';
import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
  neo4j_id: string;
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

    // Get Neo4j session
    const session = neo4jService.getDriver().session();
    
    try {
      let entities: EntityTraversal[] = [];

      if (start_from === 'all') {
        // Get all entities with their relationships
        const result = await session.run(`
          MATCH (n:Entity)
          OPTIONAL MATCH (n)-[r]->(m:Entity)
          WITH n, collect({
            target_id: id(m),
            target_name: m.name,
            target_type: m.type,
            relationship_type: type(r)
          }) as relationships
          RETURN id(n) as neo4j_id, n.name as entity_name, n.type as entity_type,
                 n.enrichment_version as enrichment_version, relationships
          ORDER BY n.type, n.name
        `);

        entities = result.records.map(record => ({
          entity_id: record.get('neo4j_id').toString(),
          entity_name: record.get('entity_name'),
          entity_type: record.get('entity_type'),
          neo4j_id: record.get('neo4j_id').toString(),
          relationships: record.get('relationships').filter((r: any) => r.target_id),
          enrichment_status: getEnrichmentStatus(record.get('enrichment_version')),
          processing_priority: calculatePriority(record.get('entity_type'), record.get('enrichment_version'))
        }));

      } else if (start_from === 'leagues') {
        // Start from leagues and traverse down to clubs
        const result = await session.run(`
          MATCH (league:Entity {type: 'league'})
          OPTIONAL MATCH (league)<-[r:MEMBER_OF]-(club:Entity)
          OPTIONAL MATCH (club)-[r2]-(other:Entity)
          RETURN id(league) as neo4j_id, league.name as entity_name, league.type as entity_type,
                 league.enrichment_version as enrichment_version,
                 collect({
                   target_id: id(club),
                   target_name: club.name,
                   target_type: club.type,
                   relationship_type: 'MEMBER_OF'
                 }) as club_relationships
          ORDER BY league.name
        `);

        entities = result.records.map(record => ({
          entity_id: record.get('neo4j_id').toString(),
          entity_name: record.get('entity_name'),
          entity_type: record.get('entity_type'),
          neo4j_id: record.get('neo4j_id').toString(),
          relationships: record.get('club_relationships').filter((r: any) => r.target_id),
          enrichment_status: getEnrichmentStatus(record.get('enrichment_version')),
          processing_priority: 100 // Leagues get highest priority
        }));

        // Also add the clubs for processing
        const clubsResult = await session.run(`
          MATCH (club:Entity {type: 'club'})-[:MEMBER_OF]->(league:Entity {type: 'league'})
          RETURN id(club) as neo4j_id, club.name as entity_name, club.type as entity_type,
                 club.enrichment_version as enrichment_version
          ORDER BY club.name
        `);

        const clubs = clubsResult.records.map(record => ({
          entity_id: record.get('neo4j_id').toString(),
          entity_name: record.get('entity_name'),
          entity_type: record.get('entity_type'),
          neo4j_id: record.get('neo4j_id').toString(),
          relationships: [],
          enrichment_status: getEnrichmentStatus(record.get('enrichment_version')),
          processing_priority: 80 // Clubs get high priority
        }));

        entities = [...entities, ...clubs];

      } else if (start_from === 'unenriched') {
        // Only get entities that haven't been enriched to version 2.0
        const result = await session.run(`
          MATCH (n:Entity)
          WHERE n.enrichment_version IS NULL OR n.enrichment_version < '2.0'
          OPTIONAL MATCH (n)-[r]->(m:Entity)
          WITH n, collect({
            target_id: id(m),
            target_name: m.name,
            target_type: m.type,
            relationship_type: type(r)
          }) as relationships
          RETURN id(n) as neo4j_id, n.name as entity_name, n.type as entity_type,
                 n.enrichment_version as enrichment_version, relationships
          ORDER BY n.type, n.name
        `);

        entities = result.records.map(record => ({
          entity_id: record.get('neo4j_id').toString(),
          entity_name: record.get('entity_name'),
          entity_type: record.get('entity_type'),
          neo4j_id: record.get('neo4j_id').toString(),
          relationships: record.get('relationships').filter((r: any) => r.target_id),
          enrichment_status: getEnrichmentStatus(record.get('enrichment_version')),
          processing_priority: 90 // Unenriched entities get very high priority
        }));
      }

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

    } finally {
      await session.close();
    }

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
      'Neo4j relationship traversal',
      'Priority-based processing',
      'Economical batch processing',
      'BrightData web scraping integration',
      'Claude Agent analysis',
      'Perplexity market research'
    ]
  });
}