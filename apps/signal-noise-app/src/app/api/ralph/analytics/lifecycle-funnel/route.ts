/**
 * Entity Lifecycle Funnel Analytics API
 *
 * Returns conversion rates between confidence bands (EXPLORATORY → INFORMED → CONFIDENT → ACTIONABLE).
 * Used for measuring system effectiveness and identifying bottlenecks.
 */

import { NextResponse } from 'next/server';
import {
  loadAllRalphStates,
  getLifecycleFunnel
} from '@/lib/ralph-analytics-helper';

export async function GET(request: Request) {
  try {
    // Load all Ralph states
    const states = await loadAllRalphStates();

    // Calculate lifecycle funnel
    const funnel = getLifecycleFunnel(states);

    // Format funnel transitions
    const funnelTransitions: Record<string, any> = {};

    for (let i = 0; i < funnel.stages.length - 1; i++) {
      const from = funnel.stages[i];
      const to = funnel.stages[i + 1];
      const key = `${from.stage} → ${to.stage}`;

      funnelTransitions[key] = {
        from_band: from.stage,
        to_band: to.stage,
        entities: from.count,
        converted: to.count,
        conversion_rate: to.conversion_rate,
        drop_off: from.drop_off,
        bottleneck: to.bottleneck,
        recommendation: to.bottleneck
          ? `BOTTLENECK: Only ${(to.conversion_rate * 100).toFixed(1)}% conversion - consider hypothesis refinement`
          : `Good conversion rate - no bottlenecks detected`
      };
    }

    // Calculate summary
    const actionableStage = funnel.stages.find(s => s.stage === "ACTIONABLE");
    const exploratoryStage = funnel.stages.find(s => s.stage === "EXPLORATORY");

    const bottlenecks = funnel.stages.filter(s => s.bottleneck);
    const biggestBottleneck = bottlenecks.length > 0
      ? bottlenecks[0].stage
      : "None";

    const summary = {
      total_entities_tracked: funnel.total_entities,
      final_actionable_entities: actionableStage?.count || 0,
      overall_conversion_rate: actionableStage && exploratoryStage
        ? actionableStage.count / exploratoryStage.count
        : 0,
      avg_iterations_to_actionable: states.length > 0
        ? states.reduce((sum, s) => sum + s.iterations_completed, 0) / states.length
        : 0,
      biggest_bottleneck: biggestBottleneck
    };

    return NextResponse.json({
      funnel: funnelTransitions,
      insights: funnel.insights,
      summary,
      metadata: {
        last_updated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error in lifecycle-funnel analytics:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve lifecycle funnel' },
      { status: 500 }
    );
  }
}
