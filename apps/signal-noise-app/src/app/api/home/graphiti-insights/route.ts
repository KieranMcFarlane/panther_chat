import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabase-client';
import { filterHighSignalGraphitiInsightRows } from '@/lib/home-graphiti-feed.mjs';
import { materializeGraphitiInsight, rankGraphitiInsights } from '@/lib/graphiti-insight-materializer';
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

const HOME_INSIGHT_COLUMNS = [
  'insight_id',
  'entity_id',
  'entity_name',
  'entity_type',
  'sport',
  'league',
  'title',
  'summary',
  'why_it_matters',
  'confidence',
  'freshness',
  'evidence',
  'relationships',
  'suggested_action',
  'detected_at',
  'source_run_id',
  'source_signal_id',
  'source_episode_id',
  'source_objective',
  'materialized_at',
  'updated_at',
  'raw_payload',
].join(', ');

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

export async function GET(request: NextRequest) {
  try {
    noStore();
    await requireApiSession(request);
    const supabase = getSupabaseAdmin();
    const warnings: string[] = [];

    let entitiesScanned = 0;
    let lastUpdatedAt = new Date().toISOString();
    let highlights: HomeGraphitiInsight[] = [];

    const [entitiesResponse, insightsResponse] = await Promise.all([
      supabase.from('cached_entities').select('id', { count: 'exact', head: true }),
      supabase
        .from('homepage_graphiti_insights')
        .select(HOME_INSIGHT_COLUMNS, { count: 'exact' })
        .order('materialized_at', { ascending: false })
        .limit(100),
    ]);

    if (entitiesResponse.error) {
      warnings.push(`Cached entities count query failed: ${entitiesResponse.error.message}`);
    } else {
      entitiesScanned = entitiesResponse.count || 0;
    }

    if (insightsResponse.error) {
      warnings.push(`Homepage insight query failed: ${insightsResponse.error.message}`);
    } else {
      const rawRows = insightsResponse.data;
      const rows = Array.isArray(rawRows)
        ? rawRows
        : rawRows && typeof rawRows === 'object'
          ? [rawRows as Record<string, unknown>]
          : [];
      const highSignalRows = filterHighSignalGraphitiInsightRows(rows as Record<string, unknown>[]);
      const seen = new Set<string>();
      const uniqueRows: HomeGraphitiInsight[] = [];

      for (const row of highSignalRows) {
        const mapped = materializeGraphitiInsight(row as Record<string, unknown>);
        if (!mapped.insight_id) {
          continue;
        }
        if (seen.has(mapped.insight_id)) {
          continue;
        }
        seen.add(mapped.insight_id);
        uniqueRows.push(mapped);
      }

      highlights = rankGraphitiInsights(uniqueRows).slice(0, 5);
      const latestMaterializedAt = highSignalRows.find((row) => row?.materialized_at)?.materialized_at;
      if (latestMaterializedAt) {
        lastUpdatedAt = String(latestMaterializedAt);
      }
    }
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
      { error: error instanceof Error ? error.message : 'Unknown Graphiti insight error' },
      { status: 500 },
    );
  }
}
