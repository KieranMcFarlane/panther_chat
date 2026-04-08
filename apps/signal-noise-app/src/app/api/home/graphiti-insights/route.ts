import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabase-client';
import { loadGraphitiInsights } from '@/lib/graphiti-insight-loader';
import { requireApiSession, UnauthorizedError } from '@/lib/server-auth';
import type {
  HomeGraphitiInsight,
  HomeGraphitiInsightsResponse,
  HomeGraphitiRelatedEntity,
} from '@/lib/home-graphiti-contract';

export const dynamic = 'force-dynamic';

const DEFAULT_QUERY_CONTEXT = {
  scope: 'homepage' as const,
  freshness_window_hours: 24,
  entity_scope: ['all materialized entities'],
};

function buildRelatedEntities(highlights: HomeGraphitiInsight[]): HomeGraphitiRelatedEntity[] {
  const related = new Map<string, HomeGraphitiRelatedEntity>();

  for (const insight of highlights) {
    const existing = related.get(insight.entity_id);
    if (existing) {
      existing.insight_count += 1;
      continue;
    }

    related.set(insight.entity_id, {
      entity_id: insight.entity_id,
      name: insight.entity_name,
      entity_type: insight.entity_type,
      reason: insight.why_it_matters,
      insight_count: 1,
    });
  }

  return Array.from(related.values()).slice(0, 6);
}

function buildEmptyGraphitiInsightsResponse(warnings: string[] = []): HomeGraphitiInsightsResponse {
  return {
    source: 'graphiti_pipeline',
    query_context: {
      ...DEFAULT_QUERY_CONTEXT,
      as_of: new Date().toISOString(),
    },
    snapshot: {
      entities_scanned: 0,
      insights_found: 0,
      high_confidence_insights: 0,
      last_updated_at: new Date().toISOString(),
      freshness_window_hours: DEFAULT_QUERY_CONTEXT.freshness_window_hours,
    },
    highlights: [],
    related_entities: [],
    generated_at: new Date().toISOString(),
    status: 'empty',
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

export async function GET(request: NextRequest) {
  try {
    noStore();
    await requireApiSession(request);
    const supabase = getSupabaseAdmin();
    const warnings: string[] = [];

    let entitiesScanned = 0;
    let lastUpdatedAt = new Date().toISOString();

    const [entitiesResponse, insightPayload] = await Promise.all([
      supabase.from('cached_entities').select('id', { count: 'exact', head: true }),
      loadGraphitiInsights(5),
    ]);

    if (entitiesResponse.error) {
      warnings.push(`Cached entities count query failed: ${entitiesResponse.error.message}`);
    } else {
      entitiesScanned = entitiesResponse.count || 0;
    }

    const highlights = insightPayload.highlights;
    lastUpdatedAt = insightPayload.lastUpdatedAt;
    warnings.push(...insightPayload.warnings);
    const highConfidenceCount = highlights.filter((item) => item.confidence >= 0.8).length;
    const relatedEntities = buildRelatedEntities(highlights);

    const response: HomeGraphitiInsightsResponse = {
      source: 'graphiti_pipeline',
      query_context: {
        ...DEFAULT_QUERY_CONTEXT,
        as_of: new Date().toISOString(),
      },
      snapshot: {
        entities_scanned: entitiesScanned,
        insights_found: highlights.length,
        high_confidence_insights: highConfidenceCount,
        last_updated_at: lastUpdatedAt,
        freshness_window_hours: DEFAULT_QUERY_CONTEXT.freshness_window_hours,
      },
      highlights,
      related_entities: relatedEntities,
      generated_at: new Date().toISOString(),
      status: warnings.length > 0
        ? (highlights.length > 0 ? 'degraded' : 'empty')
        : (highlights.length > 0 ? 'ready' : 'empty'),
      ...(warnings.length > 0 ? { warnings } : {}),
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      buildEmptyGraphitiInsightsResponse([
        error instanceof Error ? error.message : 'Unknown Graphiti insight error',
      ]),
      { status: 200 },
    );
  }
}
