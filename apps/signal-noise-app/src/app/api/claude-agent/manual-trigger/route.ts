import { NextRequest, NextResponse } from 'next/server';
import { claudeAgentScheduler } from '@/services/ClaudeAgentScheduler';

/**
 * Manually trigger a Claude Agent scan
 */
export async function POST(request: NextRequest) {
  try {
    // Configure from environment if not already configured
    const status = claudeAgentScheduler.getStatus();
    if (!status.isConfigured) {
      claudeAgentScheduler.configureFromEnvironment();
    }

    // Trigger manual scan
    const results = await claudeAgentScheduler.triggerManualScan();
    
    const duration = Date.now();

    return NextResponse.json({
      success: true,
      message: 'Manual Claude Agent scan completed',
      data: {
        results,
        summary: {
          totalFound: results.length,
          highValue: results.filter((r: any) => r.relevanceScore > 0.8).length,
          duration: duration,
          executedAt: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    console.error('❌ Manual Claude Agent scan failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: {
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}