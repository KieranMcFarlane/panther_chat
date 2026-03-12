import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { buildGraphEntityLookupFilter, resolveGraphId } from '@/lib/graph-id';

/**
 * Batch Enrichment API for Tier 2 & 3 Entities
 * Processes queued entities in batches with delta detection
 */

interface BatchQueueItem {
  id: string;
  entity_id: string;
  entity_type: string;
  entity_tier: 2 | 3;
  data: any;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  created_at: string;
  scheduled_for: string;
  last_processed?: string;
  processing_attempts?: number;
}

interface DeltaDetectionResult {
  has_changes: boolean;
  changed_fields: string[];
  confidence_delta: number;
}

class BatchEnrichmentService {
  /**
   * Process batch queue for Tier 2 & 3 entities
   */
  async processBatchQueue(): Promise<{ processed: number; failed: number; skipped: number }> {
    const results = { processed: 0, failed: 0, skipped: 0 };

    try {
      // Get pending items from queue
      const pendingItems = await this.getPendingBatchItems();
      
      console.log(`🔄 Processing ${pendingItems.length} batch items (${pendingItems.filter(i => i.entity_tier === 2).length} Tier 2, ${pendingItems.filter(i => i.entity_tier === 3).length} Tier 3)`);

      for (const item of pendingItems) {
        try {
          // Update status to processing
          await this.updateQueueItemStatus(item.id, 'processing');

          // Perform delta detection
          const deltaResult = await this.performDeltaDetection(item);
          
          if (!deltaResult.has_changes) {
            console.log(`⏭️  Skipping ${item.entity_id} - no significant changes`);
            await this.updateQueueItemStatus(item.id, 'completed');
            results.skipped++;
            continue;
          }

          // Enrich with Claude Agent SDK
          const enrichmentResult = await this.enrichEntity(item, deltaResult);
          
          if (enrichmentResult) {
            // Update canonical cached entity with enriched data
            await this.updateCanonicalEntity(item, enrichmentResult);
            
            // Update Supabase cache
            await this.updateSupabaseCache(item, enrichmentResult);
            
            // Generate daily digest for Tier 3
            if (item.entity_tier === 3) {
              await this.generateDailyDigest(item, enrichmentResult);
            }

            console.log(`✅ Enriched ${item.entity_id} (${item.entity_tier === 2 ? 'Tier 2' : 'Tier 3'})`);
            results.processed++;
          } else {
            console.log(`❌ Failed to enrich ${item.entity_id}`);
            results.failed++;
          }

          // Update queue item
          await this.updateQueueItemStatus(item.id, 'completed');
          
        } catch (error) {
          console.error(`❌ Batch processing failed for ${item.entity_id}:`, error);
          await this.updateQueueItemStatus(item.id, 'failed');
          results.failed++;
        }
      }

      // Clean up old completed items
      await this.cleanupCompletedItems();

      return results;

    } catch (error) {
      console.error('Batch processing error:', error);
      return results;
    }
  }

  /**
   * Get pending batch items scheduled for processing
   */
  private async getPendingBatchItems(): Promise<BatchQueueItem[]> {
    try {
      const { data, error } = await supabase
        .from('batch_queue')
        .select('*')
        .eq('status', 'queued')
        .lte('scheduled_for', new Date().toISOString())
        .order('entity_tier', { ascending: true }) // Process Tier 2 first
        .limit(50); // Process max 50 items per run

      if (error) {
        console.error('Error fetching batch items:', error);
        return [];
      }

      return data as BatchQueueItem[] || [];
    } catch (error) {
      console.error('Failed to get batch items:', error);
      return [];
    }
  }

  /**
   * Perform delta detection to identify changed fields
   */
  private async performDeltaDetection(item: BatchQueueItem): Promise<DeltaDetectionResult> {
    try {
      const { data, error } = await supabase
        .from('cached_entities')
        .select('id, graph_id, neo4j_id, properties')
        .or(`${buildGraphEntityLookupFilter(item.entity_id)},properties->>name.ilike.%${item.data.organization}%`)
        .limit(1);

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        return {
          has_changes: true,
          changed_fields: Object.keys(item.data),
          confidence_delta: 1.0
        };
      }

      const existingEntity = data[0].properties || {};
      const changedFields: string[] = [];
      let confidenceDelta = 0;

      const keyFields = ['yellow_panther_fit', 'urgency', 'status', 'requirements', 'estimated_value'];
      
      for (const field of keyFields) {
        if (existingEntity[field] !== item.data[field]) {
          changedFields.push(field);
          
          if (field === 'yellow_panther_fit') {
            confidenceDelta += Math.abs((existingEntity[field] || 0) - (item.data[field] || 0)) / 100;
          } else {
            confidenceDelta += 0.2;
          }
        }
      }

      return {
        has_changes: changedFields.length > 0,
        changed_fields: changedFields,
        confidence_delta: Math.min(confidenceDelta, 1.0)
      };
    } catch (error) {
      console.error('Delta detection failed:', error);
      return {
        has_changes: true, // Default to processing if detection fails
        changed_fields: ['detection_failed'],
        confidence_delta: 0.5
      };
    }
  }

  /**
   * Enrich entity using Claude Agent SDK with focused analysis
   */
  private async enrichEntity(item: BatchQueueItem, deltaResult: DeltaDetectionResult): Promise<any> {
    try {
      const enrichmentPrompt = `Batch enrichment for ${item.entity_tier === 2 ? 'Tier 2' : 'Tier 3'} entity:

ENTITY: ${item.data.organization}
SPORT: ${item.data.sport}
CHANGED FIELDS: ${deltaResult.changed_fields.join(', ')}
CURRENT FIT SCORE: ${item.data.yellow_panther_fit}%

DELTA ANALYSIS FOCUS:
${deltaResult.changed_fields.map(field => `- ${field}: Updated from previous value`).join('\n')}

Tasks:
1. Use the provided entity context and cached history to understand entity changes
2. Research updated information for changed fields
3. Summarize key changes and implications
4. Update strategic recommendations if needed
5. Generate concise insights for memory.md

Return structured JSON focusing on changes and updated recommendations.`;

      const enrichmentResult = await query({
        prompt: enrichmentPrompt,
        options: {
          mcpServers: {
            "brightdata": {
              "command": "npx",
              "args": ["-y", "@brightdata/mcp"],
              "env": {
                "API_TOKEN": process.env.BRIGHTDATA_API_TOKEN || ""
              }
            }
          },
          allowedTools: [
            "mcp__brightdata__scrape_as_markdown",
            "mcp__brightdata__search_engine"
          ],
          maxTurns: 6 // Shorter for batch processing
        }
      });

      return enrichmentResult;

    } catch (error) {
      console.error('Entity enrichment failed:', error);
      return null;
    }
  }

  /**
   * Update canonical cached entity with enriched data
   */
  private async updateCanonicalEntity(item: BatchQueueItem, enrichment: any): Promise<void> {
    try {
      const { data, error: lookupError } = await supabase
        .from('cached_entities')
        .select('id, graph_id, neo4j_id, properties')
        .or(`${buildGraphEntityLookupFilter(item.entity_id)},properties->>name.ilike.%${item.data.organization}%`)
        .limit(1);

      if (lookupError) {
        throw lookupError;
      }

      if (!data || data.length === 0) {
        console.warn(`No canonical cached entity found for batch item ${item.entity_id}`);
        return;
      }

      const entity = data[0];
      const mergedProperties = {
        ...(entity.properties || {}),
        enriched_data: enrichment,
        graph_id: resolveGraphId(entity),
        last_enriched: new Date().toISOString(),
        enrichment_count: ((entity.properties?.enrichment_count as number) || 0) + 1,
        entity_tier: item.entity_tier,
        status: 'ENRICHED'
      };

      const { error } = await supabase
        .from('cached_entities')
        .update({
          properties: mergedProperties,
          updated_at: new Date().toISOString()
        })
        .eq('id', entity.id);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Canonical cached entity update failed:', error);
    }
  }

  /**
   * Update Supabase cache with enriched data
   */
  private async updateSupabaseCache(item: BatchQueueItem, enrichment: any): Promise<void> {
    try {
      const { error } = await supabase
        .from('entity_cache')
        .upsert({
          id: item.entity_id,
          organization: item.data.organization,
          sport: item.data.sport,
          fit_score: item.data.yellow_panther_fit,
          entity_tier: item.entity_tier,
          last_enriched: new Date().toISOString(),
          enrichment: enrichment,
          data: item.data
        });

      if (error) {
        console.error('Supabase cache update error:', error);
      }
    } catch (error) {
      console.error('Supabase cache update failed:', error);
    }
  }

  /**
   * Generate daily digest for Tier 3 entities
   */
  private async generateDailyDigest(item: BatchQueueItem, enrichment: any): Promise<void> {
    try {
      const digestEntry = {
        date: new Date().toISOString().split('T')[0],
        entity_id: item.entity_id,
        organization: item.data.organization,
        tier: 3,
        summary: enrichment?.summary || 'Enrichment completed',
        key_changes: enrichment?.key_changes || [],
        recommendations: enrichment?.recommendations || [],
        impact_score: enrichment?.impact_score || 'medium'
      };

      await supabase
        .from('daily_digest')
        .insert(digestEntry);

    } catch (error) {
      console.error('Daily digest generation failed:', error);
    }
  }

  /**
   * Update queue item status
   */
  private async updateQueueItemStatus(itemId: string, status: string): Promise<void> {
    try {
      await supabase
        .from('batch_queue')
        .update({ 
          status,
          last_processed: new Date().toISOString(),
          processing_attempts: await this.incrementAttempts(itemId)
        })
        .eq('id', itemId);
    } catch (error) {
      console.error('Queue status update failed:', error);
    }
  }

  /**
   * Increment processing attempts counter
   */
  private async incrementAttempts(itemId: string): Promise<number> {
    try {
      const { data } = await supabase
        .from('batch_queue')
        .select('processing_attempts')
        .eq('id', itemId)
        .single();

      return (data?.processing_attempts || 0) + 1;
    } catch (error) {
      return 1;
    }
  }

  /**
   * Clean up old completed items
   */
  private async cleanupCompletedItems(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      await supabase
        .from('batch_queue')
        .delete()
        .eq('status', 'completed')
        .lt('last_processed', thirtyDaysAgo.toISOString());

    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }
}

// API endpoint handlers
export async function POST(request: NextRequest) {
  try {
    const batchService = new BatchEnrichmentService();
    const results = await batchService.processBatchQueue();

    return NextResponse.json({
      status: 'success',
      processed: results.processed,
      failed: results.failed,
      skipped: results.skipped,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Batch enrichment API error:', error);
    return NextResponse.json(
      { error: 'Batch processing failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'queued';
    const tier = searchParams.get('tier');

    let query = supabase
      .from('batch_queue')
      .select('*')
      .eq('status', status);

    if (tier) {
      query = query.eq('entity_tier', parseInt(tier));
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      items: data,
      count: data?.length || 0,
      status
    });

  } catch (error) {
    console.error('Batch queue query error:', error);
    return NextResponse.json(
      { error: 'Query failed' },
      { status: 500 }
    );
  }
}
