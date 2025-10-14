/**
 * 📡 Live Alerts API Endpoint
 * 
 * Provides real-time alerts for the frontend
 */

import { NextRequest, NextResponse } from 'next/server';
import { sportsRFPMonitor } from '@/lib/sports-rfp-monitor';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Get alerts from the sports RFP monitor
    let alerts = sportsRFPMonitor.getAlerts();

    // Filter by timestamp if requested
    if (since) {
      const sinceDate = new Date(since);
      alerts = alerts.filter(alert => new Date(alert.timestamp) > sinceDate);
    }

    // Limit results
    alerts = alerts.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: alerts,
      total: alerts.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Live alerts API error:', error);
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
    const { action } = body;

    switch (action) {
      case 'start_monitoring':
        await sportsRFPMonitor.startMonitoring();
        return NextResponse.json({
          success: true,
          message: 'Sports RFP monitoring started'
        });

      case 'stop_monitoring':
        sportsRFPMonitor.stopMonitoring();
        return NextResponse.json({
          success: true,
          message: 'Sports RFP monitoring stopped'
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Unknown action',
          available_actions: ['start_monitoring', 'stop_monitoring']
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Live alerts API POST error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}