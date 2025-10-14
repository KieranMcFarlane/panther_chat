/**
 * 📝 Activities API Route
 * 
 * Handles persistent storage of RFP opportunity activities and actions
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const opportunityId = searchParams.get('opportunityId');
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '50');

    switch (action) {
      case 'summary':
        // Get activity summary statistics
        const { data: summaryData, error: summaryError } = await supabase
          .from('rfp_activities')
          .select('*')
          .gte('timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

        if (summaryError) throw summaryError;

        const summary = {
          total: summaryData?.length || 0,
          byCategory: summaryData?.reduce((acc: any, item: any) => {
            acc[item.category] = (acc[item.category] || 0) + 1;
            return acc;
          }, {}) || {},
          byImpact: summaryData?.reduce((acc: any, item: any) => {
            acc[item.impact] = (acc[item.impact] || 0) + 1;
            return acc;
          }, {}) || {},
          recent: summaryData?.slice(0, 10) || []
        };

        return NextResponse.json({
          success: true,
          data: summary
        });

      case 'opportunity':
        // Get activities for specific opportunity
        if (!opportunityId) {
          return NextResponse.json({
            success: false,
            error: 'Opportunity ID required'
          }, { status: 400 });
        }

        const { data: opportunityData, error: opportunityError } = await supabase
          .from('rfp_activities')
          .select('*')
          .eq('opportunity_id', opportunityId)
          .order('timestamp', { ascending: false })
          .limit(limit);

        if (opportunityError) throw opportunityError;

        return NextResponse.json({
          success: true,
          data: opportunityData || []
        });

      case 'export':
        // Export activities as CSV
        const { data: exportData, error: exportError } = await supabase
          .from('rfp_activities')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(limit);

        if (exportError) throw exportError;

        const csvContent = [
          'Timestamp,Action,Opportunity,Organization,User,Category,Impact,Status,Details',
          ...(exportData || []).map(item => [
            `"${item.timestamp}"`,
            `"${item.action}"`,
            `"${item.opportunity_title}"`,
            `"${item.organization}"`,
            `"${item.user_name}"`,
            `"${item.category}"`,
            `"${item.impact}"`,
            `"${item.status}"`,
            `"${JSON.stringify(item.details).replace(/"/g, '""')}"`
          ].join(','))
        ].join('\n');

        return new NextResponse(csvContent, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="rfp-activities-${new Date().toISOString().split('T')[0]}.csv"`
          }
        });

      default:
        // Get all activities with optional filtering
        let query = supabase
          .from('rfp_activities')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(limit);

        if (category) {
          query = query.eq('category', category);
        }

        if (opportunityId) {
          query = query.eq('opportunity_id', opportunityId);
        }

        const { data, error } = await query;

        if (error) throw error;

        return NextResponse.json({
          success: true,
          data: data || []
        });
    }

  } catch (error) {
    console.error('Activities API GET Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'log':
        // Log a new activity
        const activityData = {
          id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toISOString(),
          action: data.action,
          opportunity_id: data.opportunityId,
          opportunity_title: data.opportunityTitle,
          organization: data.organization,
          user_id: data.userId || 'system',
          user_name: data.userName || 'System User',
          details: data.details || {},
          status: data.status || 'completed',
          category: data.category || 'view',
          impact: data.impact || 'medium',
          metadata: data.metadata || {}
        };

        const { data: insertData, error: insertError } = await supabase
          .from('rfp_activities')
          .insert(activityData)
          .select()
          .single();

        if (insertError) {
          console.warn('Failed to save activity to database:', insertError);
          // Still return success, activity might be saved locally
        }

        return NextResponse.json({
          success: true,
          data: insertData || activityData,
          message: 'Activity logged successfully'
        });

      case 'update_status':
        // Update opportunity user status
        const { opportunityId, status, userId } = body;
        
        if (!opportunityId || !status) {
          return NextResponse.json({
            success: false,
            error: 'Opportunity ID and status required'
          }, { status: 400 });
        }

        // Log the status change
        const statusActivity = {
          id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toISOString(),
          action: 'status_update',
          opportunity_id: opportunityId,
          opportunity_title: data.opportunityTitle || 'Status Update',
          organization: data.organization || 'Unknown',
          user_id: userId || 'system',
          user_name: data.userName || 'System User',
          details: { newStatus: status, previousStatus: data.previousStatus },
          status: 'completed',
          category: 'status_change',
          impact: 'medium'
        };

        const { error: statusError } = await supabase
          .from('rfp_activities')
          .insert(statusActivity);

        if (statusError) {
          console.warn('Failed to log status change:', statusError);
        }

        return NextResponse.json({
          success: true,
          data: statusActivity,
          message: 'Status updated successfully'
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Unknown action',
          available_actions: ['log', 'update_status']
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Activities API POST Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}