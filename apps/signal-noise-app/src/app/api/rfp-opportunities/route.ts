/**
 * 📊 RFP Opportunities API
 * 
 * Query RFP opportunities from Supabase database with filtering and pagination
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const minFit = parseInt(searchParams.get('min_fit') || '0');
    const sortBy = searchParams.get('sort_by') || 'detected_at';
    const sortOrder = searchParams.get('sort_order') || 'desc';

    switch (action) {
      case 'list': {
        // Build query
        let query = supabase
          .from('rfp_opportunities')
          .select('*')
          .eq('status', status || 'qualified')
          .gte('yellow_panther_fit', minFit)
          .order(sortBy, { ascending: sortOrder === 'asc' })
          .range(offset, offset + limit - 1);

        // Apply category filter if specified
        if (category && category !== 'all') {
          query = query.ilike('category', `%${category}%`);
        }

        const { data: opportunities, error, count } = await query;

        if (error) {
          console.error('Supabase query error:', error);
          return NextResponse.json({
            success: false,
            error: error.message
          }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          data: {
            opportunities: opportunities || [],
            total_count: count || 0,
            limit,
            offset,
            filters: { status, category, min_fit: minFit, sort_by: sortBy, sort_order: sortOrder },
            last_updated: new Date().toISOString()
          }
        });
      }

      case 'stats': {
        // Get overall statistics
        const { data: stats, error: statsError } = await supabase
          .from('rfp_opportunities')
          .select(`
            id,
            yellow_panther_fit,
            confidence,
            status,
            category,
            value,
            detected_at
          `);

        if (statsError) {
          console.error('Stats query error:', statsError);
          return NextResponse.json({
            success: false,
            error: statsError.message
          }, { status: 500 });
        }

        const totalOpportunities = stats?.length || 0;
        const qualifiedOpportunities = stats?.filter(opp => opp.status === 'qualified').length || 0;
        const highFitOpportunities = stats?.filter(opp => opp.yellow_panther_fit >= 80).length || 0;
        const avgFitScore = stats?.reduce((acc, opp) => acc + opp.yellow_panther_fit, 0) / totalOpportunities || 0;
        
        // Category breakdown
        const categoryBreakdown = stats?.reduce((acc, opp) => {
          acc[opp.category] = (acc[opp.category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {};

        // Recent detections (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentDetections = stats?.filter(opp => 
          new Date(opp.detected_at) > sevenDaysAgo
        ).length || 0;

        return NextResponse.json({
          success: true,
          data: {
            total_opportunities: totalOpportunities,
            qualified_opportunities: qualifiedOpportunities,
            high_fit_opportunities: highFitOpportunities,
            qualification_rate: totalOpportunities > 0 ? (qualifiedOpportunities / totalOpportunities * 100).toFixed(1) : '0',
            average_fit_score: avgFitScore.toFixed(1),
            category_breakdown: categoryBreakdown,
            recent_detections_7_days: recentDetections,
            last_updated: new Date().toISOString()
          }
        });
      }

      case 'detail': {
        const opportunityId = searchParams.get('id');
        if (!opportunityId) {
          return NextResponse.json({
            success: false,
            error: 'Missing opportunity ID'
          }, { status: 400 });
        }

        const { data: opportunity, error } = await supabase
          .from('rfp_opportunities')
          .select('*')
          .eq('id', opportunityId)
          .single();

        if (error) {
          console.error('Detail query error:', error);
          return NextResponse.json({
            success: false,
            error: error.message
          }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          data: {
            opportunity,
            last_updated: new Date().toISOString()
          }
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('🚨 RFP Opportunities API error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch RFP opportunities',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Update RFP opportunity status
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, metadata } = body;

    if (!id || !status) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: id, status'
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('rfp_opportunities')
      .update({
        status,
        metadata: {
          ...metadata,
          updated_via: 'api',
          updated_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Update error:', error);
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        opportunity: data,
        message: 'Opportunity updated successfully',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('🚨 RFP Opportunities POST error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to update opportunity',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}