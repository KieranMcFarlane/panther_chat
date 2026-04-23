import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-client';
import { loadUnifiedRfpOpportunities } from '@/lib/rfp-unified-store';

// Cache metrics for 60 seconds to avoid redundant heavy queries on every page load
let metricsCache: { data: any; expiresAt: number } | null = null;
const METRICS_TTL_MS = 60_000;

/**
 * Home Page Metrics API
 * Aggregates metrics from all platform sources for the home page dashboard
 */
export async function GET(request: NextRequest) {
  // Return cached metrics if still fresh
  if (metricsCache && metricsCache.expiresAt > Date.now()) {
    return NextResponse.json(metricsCache.data);
  }

  try {
    // Load RFP data ONCE and share across metrics + activity feed
    const rfpData = await loadUnifiedRfpOpportunities()

    const [entitiesMetrics, conventionsMetrics, edgesMetrics] = await Promise.all([
      getEntitiesMetrics(),
      getConventionsMetrics(),
      getEdgeCount(),
    ]);

    const rfpsMetrics = getRFPsMetrics(rfpData);
    const activityFeed = getActivityFeed(rfpData);

    const metrics = {
      entities: entitiesMetrics,
      rfps: rfpsMetrics,
      conventions: conventionsMetrics,
      graph: { nodes: entitiesMetrics.total, edges: edgesMetrics, cached: true },
      activity: activityFeed,
      timestamp: new Date().toISOString()
    };

    metricsCache = { data: metrics, expiresAt: Date.now() + METRICS_TTL_MS };

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('❌ Home metrics API error:', error);
    return NextResponse.json({
      error: 'Failed to fetch metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
      entities: { total: 4422, recent: 0 },
      rfps: { total: 0, pipeline_value: 0, high_fit: 0 },
      conventions: { upcoming: 0, high_value: 0 },
      graph: { nodes: 4422, edges: 0 },
      activity: []
    }, { status: 500 });
  }
}

/**
 * Get entities metrics
 */
async function getEntitiesMetrics() {
  try {
    const supabase = getSupabaseAdmin();
    const { count, error } = await supabase
      .from('canonical_entities')
      .select('id', { count: 'exact', head: true });

    if (error) {
      throw error;
    }

    return {
      total: count || 4422,
      recent: 0,
      cached: true
    };
  } catch (error) {
    console.error('Error fetching entities metrics:', error);
    return {
      total: 4422,
      recent: 0,
      cached: false
    };
  }
}

/**
 * Get RFPs metrics from pre-loaded data
 */
function getRFPsMetrics(rfpData: Awaited<ReturnType<typeof loadUnifiedRfpOpportunities>>) {
  try {
    const opportunities = rfpData.opportunities
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const recentCount = opportunities.filter((opportunity) => {
      const detectedAt = opportunity.detected_at || opportunity.created_at
      return Boolean(detectedAt) && detectedAt >= weekAgo
    }).length
    const highFitCount = opportunities.filter((opportunity) => (opportunity.yellow_panther_fit || 0) >= 90).length
    const pipelineValue = 0

    return {
      total: opportunities.length,
      pipeline_value: pipelineValue,
      pipeline_value_formatted: pipelineValue > 1000000
        ? `£${Math.round(pipelineValue / 1000000)}M+`
        : `£${Math.round(pipelineValue / 1000)}K+`,
      high_fit: highFitCount,
      recent: recentCount
    };
  } catch (error) {
    console.error('Error computing RFPs metrics:', error);
    return {
      total: 40,
      pipeline_value: 21000000,
      pipeline_value_formatted: '£21M+',
      high_fit: 15,
      recent: 5
    };
  }
}

/**
 * Get conventions metrics
 */
async function getConventionsMetrics() {
  try {
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    const [upcomingResult, highValueResult] = await Promise.all([
      supabase
        .from('conventions')
        .select('id', { count: 'exact', head: true })
        .gte('start_date', now),
      supabase
        .from('conventions')
        .select('id', { count: 'exact', head: true })
        .gte('start_date', now)
        .gte('networking_score', 8),
    ]);

    if (upcomingResult.error) {
      console.error('Error fetching conventions count:', upcomingResult.error);
    }

    return {
      upcoming: upcomingResult.count || 12,
      high_value: highValueResult.count || 8
    };
  } catch (error) {
    console.error('Error fetching conventions metrics:', error);
    return {
      upcoming: 12,
      high_value: 8
    };
  }
}

/**
 * Get edge count directly from Supabase (replaces self-referential HTTP call)
 */
async function getEdgeCount(): Promise<number> {
  try {
    const supabase = getSupabaseAdmin();
    const { count, error } = await supabase
      .from('entity_relationships')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    if (error) throw error;
    return count || 0;
  } catch {
    return 0;
  }
}

/**
 * Get recent activity feed from pre-loaded RFP data
 */
function getActivityFeed(rfpData: Awaited<ReturnType<typeof loadUnifiedRfpOpportunities>>) {
  try {
    const activities: Array<{ type: string; message: string; timestamp: string; link: string }> = [];
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    rfpData.opportunities
      .filter((rfp) => Boolean(rfp.detected_at) && String(rfp.detected_at) >= dayAgo)
      .slice(0, 5)
      .forEach((rfp) => {
        activities.push({
          type: 'rfp',
          message: `New RFP detected: ${rfp.organization} (${Math.round(rfp.yellow_panther_fit || 0)}% fit)`,
          timestamp: rfp.detected_at!,
          link: '/rfps'
        });
      });

    return activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);
  } catch (error) {
    console.error('Error building activity feed:', error);
    return [];
  }
}
