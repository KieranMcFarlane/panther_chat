/**
 * Activity Feed API - Real-time activity stream for dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { liveLogService } from '@/services/LiveLogService';

export const dynamic = 'force-dynamic';

/**
 * Get activity feed for dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const entity_id = searchParams.get('entity_id');
    const urgency = searchParams.get('urgency');
    const hours = parseInt(searchParams.get('hours') || '24');

    const activities = await liveLogService.getActivityFeed({
      limit,
      entity_id: entity_id || undefined,
      urgency: urgency || undefined,
      hours
    });

    return NextResponse.json({
      activities,
      total: activities.length,
      filters: { limit, entity_id, urgency, hours },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Failed to get activity feed:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to get activity feed'
    }, { status: 500 });
  }
}

/**
 * Add activity to feed
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, title, description, entity_id, entity_name, urgency, details, actions } = body;

    if (!type || !title || !description) {
      return NextResponse.json({
        error: 'Missing required fields: type, title, description'
      }, { status: 400 });
    }

    await liveLogService.addActivity({
      type,
      title,
      description,
      entity_id: entity_id || undefined,
      entity_name: entity_name || undefined,
      urgency: urgency || 'medium',
      details: details || {},
      actions: actions || []
    });

    return NextResponse.json({
      status: 'activity_added',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Failed to add activity:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to add activity'
    }, { status: 500 });
  }
}