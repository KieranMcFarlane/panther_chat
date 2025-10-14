import { NextRequest, NextResponse } from 'next/server';
import { claudeAgentScheduler } from '@/services/ClaudeAgentScheduler';

/**
 * Stop the daily Claude Agent scheduler
 */
export async function POST(request: NextRequest) {
  try {
    claudeAgentScheduler.stopSchedule();
    
    const status = claudeAgentScheduler.getStatus();

    return NextResponse.json({
      success: true,
      message: 'Daily Claude Agent scheduler stopped',
      status
    });

  } catch (error) {
    console.error('❌ Failed to stop Claude Agent scheduler:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: {
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}