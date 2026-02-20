/**
 * Category Performance Analytics API
 *
 * Returns performance metrics per category including accept rates,
 * ROI indicators, and recommendations.
 */

import { NextResponse } from 'next/server';
import {
  loadAllRalphStates,
  getCategoryPerformance
} from '@/lib/ralph-analytics-helper';

export async function GET(request: Request) {
  try {
    // Load all Ralph states
    const states = await loadAllRalphStates();

    // Calculate category performance
    const performance = getCategoryPerformance(states);

    // Format response to match expected structure
    const categories: Record<string, any> = {};

    for (const cat of performance) {
      categories[cat.category] = {
        category: cat.category,
        total_iterations: cat.total_iterations,
        accepts: cat.accept_count,
        weak_accepts: cat.weak_accept_count,
        rejects: cat.reject_count,
        no_progress: cat.no_progress_count,
        saturated: cat.saturated_count,
        accept_rate: cat.accept_rate,
        weak_accept_rate: cat.weak_accept_count / Math.max(cat.total_iterations, 1),
        reject_rate: cat.reject_count / Math.max(cat.total_iterations, 1),
        roi: cat.roi_level,
        recommendation: cat.recommendation,
        rank: cat.rank
      };
    }

    // Calculate summary
    const bestCategory = performance[0];
    const worstCategory = performance[performance.length - 1];
    const avgAcceptRate = performance.reduce((sum, cat) =>
      sum + cat.accept_rate, 0) / performance.length;

    const summary = {
      total_categories: performance.length,
      best_category: `${bestCategory.category} (${(bestCategory.accept_rate * 100).toFixed(1)}% accept rate)`,
      worst_category: `${worstCategory.category} (${(worstCategory.accept_rate * 100).toFixed(1)}% accept rate)`,
      avg_accept_rate: avgAcceptRate
    };

    return NextResponse.json({
      categories,
      summary,
      metadata: {
        last_updated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error in category-performance analytics:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve category performance' },
      { status: 500 }
    );
  }
}
