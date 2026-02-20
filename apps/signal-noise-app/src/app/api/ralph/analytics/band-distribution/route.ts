/**
 * Band Distribution Analytics API
 *
 * Returns the distribution of entities across confidence bands.
 * Used for sales pipeline sizing and revenue forecasting.
 */

import { NextResponse } from 'next/server';
import {
  loadAllRalphStates,
  getBandDistribution
} from '@/lib/ralph-analytics-helper';

export async function GET(request: Request) {
  try {
    // Load all Ralph states from runtime bindings
    const states = await loadAllRalphStates();

    // Calculate band distribution
    const distribution = getBandDistribution(states);

    // Calculate revenue projection
    const revenueProjection = {
      EXPLORATORY: distribution.EXPLORATORY.revenue,
      INFORMED: distribution.INFORMED.revenue,
      CONFIDENT: distribution.CONFIDENT.revenue,
      ACTIONABLE: distribution.ACTIONABLE.revenue,
      total_monthly: Object.values(distribution).reduce((sum, band) => sum + band.revenue, 0)
    };

    // Format response
    const formattedDistribution = {
      EXPLORATORY: {
        count: distribution.EXPLORATORY.count,
        percentage: distribution.EXPLORATORY.percentage,
        entities: distribution.EXPLORATORY.entity_samples
      },
      INFORMED: {
        count: distribution.INFORMED.count,
        percentage: distribution.INFORMED.percentage,
        entities: distribution.INFORMED.entity_samples
      },
      CONFIDENT: {
        count: distribution.CONFIDENT.count,
        percentage: distribution.CONFIDENT.percentage,
        entities: distribution.CONFIDENT.entity_samples
      },
      ACTIONABLE: {
        count: distribution.ACTIONABLE.count,
        percentage: distribution.ACTIONABLE.percentage,
        entities: distribution.ACTIONABLE.entity_samples
      }
    };

    return NextResponse.json({
      distribution: formattedDistribution,
      revenue_projection: revenueProjection,
      metadata: {
        total_entities: states.length,
        last_updated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error in band-distribution analytics:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve band distribution' },
      { status: 500 }
    );
  }
}
