/**
 * Test endpoint to verify LiveLogService in-memory storage
 */

import { NextRequest, NextResponse } from 'next/server';
import { liveLogService } from '@/services/LiveLogService';

export async function GET() {
  try {
    // Add a test log to verify in-memory storage
    liveLogService.info('🧪 Test log entry for LiveLogService in-memory storage verification', {
      category: 'claude-agent',
      source: 'TestAPI',
      message: 'LiveLogService in-memory storage test',
      data: {
        test: true,
        timestamp: new Date().toISOString(),
        storage_type: 'in-memory'
      },
      tags: ['test', 'memory-storage', 'verification']
    });

    // Get recent logs to show what's stored
    const recentLogs = await liveLogService.getLogs({
      category: 'claude-agent',
      limit: 5,
      hours: 1
    });

    return NextResponse.json({
      success: true,
      message: 'Test log added successfully',
      logs: recentLogs,
      storage_type: 'in-memory',
      total_logs: recentLogs.length
    });

  } catch (error) {
    console.error('Test API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to add test log'
    }, { status: 500 });
  }
}