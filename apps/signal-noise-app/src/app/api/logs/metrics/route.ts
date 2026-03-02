/**
 * System Metrics API - Performance monitoring and statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { liveLogService } from '@/services/LiveLogService';

export const dynamic = 'force-dynamic';

/**
 * Get system metrics and statistics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get('hours') || '24');
    const include_logs = searchParams.get('include_logs') === 'true';
    const include_metrics = searchParams.get('include_metrics') === 'true';

    const response: any = {
      timestamp: new Date().toISOString(),
      hours,
    };

    // Get log statistics
    if (include_logs) {
      response.log_stats = await liveLogService.getLogStats(hours);
    }

    // Get system metrics
    if (include_metrics) {
      response.system_metrics = await liveLogService.getSystemMetrics(hours);
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Failed to get system metrics:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to get system metrics'
    }, { status: 500 });
  }
}
