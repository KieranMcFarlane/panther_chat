import { NextRequest, NextResponse } from 'next/server';
import { claudeAgentScheduler } from '@/services/ClaudeAgentScheduler';

/**
 * Start the daily Claude Agent scheduler
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { scheduleTime = '0 9 * * *', configure = true } = body;

    // Configure from environment if requested
    if (configure) {
      claudeAgentScheduler.configureFromEnvironment();
    }

    // Start the daily schedule
    claudeAgentScheduler.startDailySchedule(scheduleTime);
    
    const status = claudeAgentScheduler.getStatus();

    return NextResponse.json({
      success: true,
      message: `Daily Claude Agent scheduler started with schedule: ${scheduleTime}`,
      status,
      nextRun: status.nextRun,
      scheduleTime
    });

  } catch (error) {
    console.error('❌ Failed to start Claude Agent scheduler:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: {
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}

/**
 * Get scheduler status
 */
export async function GET() {
  try {
    const status = claudeAgentScheduler.getStatus();

    return NextResponse.json({
      success: true,
      status,
      message: status.isScheduled ? 
        'Claude Agent scheduler is running' : 
        'Claude Agent scheduler is not configured or running'
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}