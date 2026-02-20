/**
 * Cluster Health Analytics API
 *
 * Returns health metrics for all clusters including saturation rates,
 * exhausted hypotheses, and cost reduction indicators.
 */

import { NextResponse } from 'next/server';
import {
  loadAllRalphStates,
  loadEntityClusterMapping,
  loadProductionClusters,
  getClusterHealth
} from '@/lib/ralph-analytics-helper';

export async function GET(request: Request) {
  try {
    // Load all required data
    const [states, clusterMapping, clusterNames] = await Promise.all([
      loadAllRalphStates(),
      loadEntityClusterMapping(),
      loadProductionClusters()
    ]);

    // Calculate cluster health metrics
    const healthMetrics = getClusterHealth(states, clusterMapping, clusterNames);

    // Format response to match expected structure
    const clusters: Record<string, any> = {};
    let totalSaturationRate = 0;
    let totalCostReduction = 0;

    for (const cluster of healthMetrics) {
      const costReduction = `${(cluster.saturation_rate * 20).toFixed(0)}%`; // Approximate cost reduction

      clusters[cluster.cluster_id] = {
        cluster_id: cluster.cluster_id,
        cluster_name: cluster.cluster_name,
        total_entities: cluster.total_entities,
        exhausted_hypotheses: cluster.exhausted_hypotheses > 0
          ? [`${cluster.exhausted_hypotheses} categories saturated`]
          : [],
        saturation_rate: cluster.saturation_rate,
        avg_confidence: cluster.avg_confidence,
        actionable_count: cluster.actionable_count,
        cost_reduction: costReduction,
        health_status: cluster.health_status
      };

      totalSaturationRate += cluster.saturation_rate;
      totalCostReduction += parseFloat(costReduction);
    }

    const summary = {
      total_clusters: healthMetrics.length,
      total_entities: states.length,
      avg_saturation_rate: healthMetrics.length > 0
        ? totalSaturationRate / healthMetrics.length
        : 0,
      total_cost_reduction: `${totalCostReduction.toFixed(0)}%`
    };

    return NextResponse.json({
      clusters,
      summary,
      metadata: {
        last_updated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error in cluster-health analytics:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve cluster health' },
      { status: 500 }
    );
  }
}
