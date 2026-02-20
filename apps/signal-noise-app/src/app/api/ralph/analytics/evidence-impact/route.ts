/**
 * Evidence Impact Analytics API
 *
 * Returns effectiveness metrics for evidence sources (LinkedIn, official websites, job postings, etc.).
 * Used to optimize data collection strategy and focus on high-impact sources.
 */

import { NextResponse } from 'next/server';
import {
  loadAllRalphStates,
  loadBootstrapIterations,
  getEvidenceImpact
} from '@/lib/ralph-analytics-helper';

export async function GET(request: Request) {
  try {
    // Load all Ralph states
    const states = await loadAllRalphStates();

    // Load bootstrap iterations
    const iterations = await loadBootstrapIterations(states);

    // Calculate evidence impact
    const impact = getEvidenceImpact(states, iterations);

    // Format response to match expected structure
    const sources: Record<string, any> = {};

    for (const item of impact) {
      const key = item.source.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const costPerImpact = item.count > 0 ? item.total_impact / item.count : 0;

      sources[key] = {
        source: item.source,
        source_type: item.source_type,
        total_impact: item.total_impact,
        avg_impact: item.avg_impact,
        count: item.count,
        accept_count: item.accept_count,
        weak_accept_count: item.weak_accept_count,
        effectiveness: item.effectiveness,
        cost_per_impact: costPerImpact,
        rank: item.rank,
        recommendation: item.effectiveness === "VERY_EFFECTIVE"
          ? "PRIMARY SOURCE - Highest impact per evidence, prioritize scanning"
          : item.effectiveness === "EFFECTIVE"
          ? "SECONDARY SOURCE - Strong for capability detection"
          : item.effectiveness === "MODERATE"
          ? "TERTIARY SOURCE - Good for early capability signals"
          : "LOW PRIORITY - Consider deprioritizing this source"
      };
    }

    // Calculate summary
    const totalEvidence = impact.reduce((sum, s) => sum + s.count, 0);
    const totalImpact = impact.reduce((sum, s) => sum + s.total_impact, 0);
    const overallAvgImpact = totalEvidence > 0 ? totalImpact / totalEvidence : 0;

    const bestSource = impact[0];
    const mostCostEffective = [...impact].sort((a, b) =>
      (a.total_impact / a.count) - (b.total_impact / b.count)
    )[0];

    const sourceTypeRecommendation = impact.reduce((acc, item) => {
      acc[item.source_type] = (acc[item.source_type] || 0) + item.total_impact;
      return acc;
    }, {} as Record<string, number>);

    const totalTypeImpact = Object.values(sourceTypeRecommendation).reduce((a, b) => a + b, 0);
    const budgetAllocation = Object.entries(sourceTypeRecommendation).map(([type, impact]) =>
      `${type}: ${((impact / totalTypeImpact) * 100).toFixed(0)}%`
    ).join(", ");

    const summary = {
      total_sources: impact.length,
      total_evidence_processed: totalEvidence,
      total_confidence_impact: totalImpact,
      overall_avg_impact: overallAvgImpact,
      best_source: `${bestSource.source} (${bestSource.avg_impact.toFixed(3)} avg impact)`,
      most_cost_effective: mostCostEffective
        ? `${mostCostEffective.source_type} (${(mostCostEffective.total_impact / mostCostEffective.count).toFixed(3)} per evidence)`
        : "N/A",
      recommendation: `Allocate scanning budget: ${budgetAllocation}`
    };

    return NextResponse.json({
      sources,
      summary,
      metadata: {
        last_updated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error in evidence-impact analytics:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve evidence impact' },
      { status: 500 }
    );
  }
}
