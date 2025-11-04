/**
 * Continuous Reasoning API - Control and monitor the AI reasoning service
 */

import { NextRequest, NextResponse } from 'next/server';
import { continuousReasoningService } from '@/services/ContinuousReasoningService';

/**
 * Start or stop the continuous reasoning service
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'start') {
      await continuousReasoningService.start();
      
      return NextResponse.json({
        status: 'reasoning_service_started',
        timestamp: new Date().toISOString(),
        service_status: continuousReasoningService.getStatus()
      });

    } else if (action === 'stop') {
      await continuousReasoningService.stop();
      
      return NextResponse.json({
        status: 'reasoning_service_stopped',
        timestamp: new Date().toISOString(),
        service_status: continuousReasoningService.getStatus()
      });

    } else {
      return NextResponse.json({
        error: 'Invalid action. Use "start" or "stop"'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ Failed to control reasoning service:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to control reasoning service'
    }, { status: 500 });
  }
}

/**
 * Get the status of the continuous reasoning service
 */
export async function GET(request: NextRequest) {
  try {
    const status = continuousReasoningService.getStatus();
    
    return NextResponse.json({
      status: 'reasoning_service_status',
      service: status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Failed to get reasoning service status:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to get reasoning service status'
    }, { status: 500 });
  }
}