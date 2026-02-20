/**
 * Entity Dossier API Routes
 *
 * Provides endpoints for generating and retrieving entity dossiers
 * with intelligent caching and tier-based generation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * GET /api/dossier?entity_id={id}&force={true|false}
 *
 * Retrieve entity dossier with intelligent caching
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const entityId = searchParams.get('entity_id');
  const forceRegenerate = searchParams.get('force') === 'true';

  if (!entityId) {
    return NextResponse.json(
      { error: 'entity_id is required' },
      { status: 400 }
    );
  }

  try {
    // Call backend (backend handles caching logic)
    const dossier = await generateDossier(entityId, forceRegenerate);

    if (!dossier) {
      return NextResponse.json(
        { error: 'Failed to generate dossier' },
        { status: 500 }
      );
    }

    return NextResponse.json(dossier);

  } catch (error) {
    console.error('Dossier GET error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/dossier
 *
 * Batch dossier generation for multiple entities
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { entity_ids, force = false } = body;

    if (!Array.isArray(entity_ids) || entity_ids.length === 0) {
      return NextResponse.json(
        { error: 'entity_ids must be a non-empty array' },
        { status: 400 }
      );
    }

    if (entity_ids.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 entity_ids per batch request' },
        { status: 400 }
      );
    }

    // Generate dossiers in parallel
    const results = await Promise.allSettled(
      entity_ids.map((id: string) => generateDossier(id, force))
    );

    const successful = results.filter(
      (r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled'
    ).map(r => r.value);

    const failed = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected'
    );

    // Backend already handles caching, no need to cache again
    return NextResponse.json({
      success: successful.length,
      failed: failed.length,
      results: successful.map(d => ({
        entity_id: d.entity_id,
        tier: d.tier,
        sections_count: d.sections.length,
        cost: d.total_cost_usd,
        time: d.generation_time_seconds
      }))
    });

  } catch (error) {
    console.error('Dossier POST error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get dossier from Supabase cache
 */
async function getDossierFromCache(entityId: string) {
  const { data, error } = await supabase
    .from('entity_dossiers')
    .select('*')
    .eq('entity_id', entityId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Check if cached dossier is expired
 */
function isCacheExpired(dossier: any): boolean {
  if (!dossier.expires_at) return true;

  const expiryDate = new Date(dossier.expires_at);
  const now = new Date();

  return now > expiryDate;
}

/**
 * Update last_accessed_at timestamp
 */
async function updateLastAccessed(entityId: string) {
  await supabase
    .from('entity_dossiers')
    .update({ last_accessed_at: new Date().toISOString() })
    .eq('entity_id', entityId);
}

/**
 * Generate new dossier by calling backend service
 */
async function generateDossier(
  entityId: string,
  force: boolean = false
): Promise<any | null> {
  try {
    // Step 1: Get entity info from Supabase cached_entities
    const { data: entity } = await supabase
      .from('cached_entities')
      .select('properties')
      .eq('neo4j_id', entityId)
      .maybeSingle();

    // Extract entity name from properties
    let entityName = entityId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    let entityType = 'CLUB';

    if (entity?.properties) {
      entityName = entity.properties.name || entityName;
      entityType = entity.properties.type || entityType;
    }

    console.log(`📊 Calling backend for dossier: ${entityName} (${entityId})`);

    // Step 2: Call Python backend service
    const backendUrl = process.env.FASTAPI_URL || 'http://localhost:8000';
    const response = await fetch(`${backendUrl}/api/dossiers/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entity_id: entityId,
        entity_name: entityName,
        entity_type: entityType,
        priority_score: 70, // STANDARD tier (includes outreach_strategy)
        force_refresh: force
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Backend error ${response.status}: ${errorText}`);
      throw new Error(`Backend error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`✅ Dossier generated: ${data.metadata.hypothesis_count} hypotheses, ${data.metadata.signal_count} signals`);

    // Backend already persists to Supabase, so we just return the data
    return {
      entity_id: data.entity_id,
      entity_name: data.entity_name,
      entity_type: entityType,
      priority_score: data.metadata.priority_score,
      tier: data.metadata.tier,
      dossier_data: data.dossier_data,
      sections: data.dossier_data.sections || [],
      generated_at: data.generated_at,
      generation_time_seconds: data.metadata.generation_time_seconds,
      total_cost_usd: data.metadata.total_cost_usd,
      cache_status: data.cache_status,
      // Include metadata for frontend consumption
      metadata: data.metadata
    };

  } catch (error) {
    console.error('Dossier generation error:', error);
    throw error;
  }
}

/**
 * Cache dossier in Supabase
 */
async function cacheDossier(dossier: any) {
  // Calculate expiry (7 days from now)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // Upsert dossier
  const { error } = await supabase
    .from('entity_dossiers')
    .upsert({
      entity_id: dossier.entity_id,
      entity_name: dossier.entity_name,
      entity_type: dossier.entity_type,
      priority_score: dossier.priority_score,
      tier: dossier.tier,
      sections: dossier.sections,
      generated_at: dossier.generated_at,
      total_cost_usd: dossier.total_cost_usd,
      generation_time_seconds: dossier.generation_time_seconds,
      cache_status: 'FRESH',
      expires_at: expiresAt.toISOString(),
      last_accessed_at: new Date().toISOString()
    }, {
      onConflict: 'entity_id'
    });

  if (error) {
    console.error('Failed to cache dossier:', error);
  }
}
