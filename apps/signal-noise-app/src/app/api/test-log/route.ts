import { NextRequest, NextResponse } from 'next/server';
import { liveLogService } from '@/services/LiveLogService';

// Test the in-memory store directly by adding logs that bypass Supabase
const testInMemoryLog = {
  id: `test_${Date.now()}`,
  timestamp: new Date().toISOString(),
  level: 'info' as const,
  category: 'claude-agent' as const,
  source: 'TestAPI',
  message: 'Direct in-memory test log',
  data: { test: true, direct: true },
  tags: ['test', 'in-memory']
};

export async function POST(req: NextRequest) {
  try {
    const { message, category = 'claude-agent', level = 'info', direct_test = false } = await req.json();

    if (direct_test) {
      // Direct in-memory test - bypass Supabase entirely
      liveLogService.info(message || 'Direct in-memory test log', {
        category,
        source: 'DirectTest',
        message: `Direct test: ${message}`,
        data: {
          timestamp: new Date().toISOString(),
          test: true,
          direct_memory: true
        },
        tags: ['test', 'direct', 'in-memory']
      });

      // Immediately try to get logs using getRecentLogs which should fallback to in-memory
      const recentLogs = await liveLogService.getRecentLogs({
        category: 'claude-agent',
        limit: 5
      });

      return NextResponse.json({
        success: true,
        message: 'Direct test log added and retrieved',
        immediate_logs: recentLogs,
        immediate_count: recentLogs.length
      });
    }

    // Add a test log to LiveLogService (normal flow)
    liveLogService.info(message || 'Test log message', {
      category,
      source: 'TestAPI',
      message: `Test log: ${message}`,
      data: {
        timestamp: new Date().toISOString(),
        test: true
      },
      tags: ['test', 'claude-agent']
    });

    return NextResponse.json({
      success: true,
      message: 'Test log added to LiveLogService'
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to add test log',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Try to get logs from LiveLogService (async method with Supabase fallback)
    const logs = await liveLogService.getLogs({
      category: 'claude-agent',
      limit: 5
    });

    console.log('📋 Retrieved logs from LiveLogService:', logs.length, 'logs');

    return NextResponse.json({
      success: true,
      logs,
      count: logs.length,
      debug: {
        supabase_available: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        message: 'Logs retrieved from LiveLogService (may be from Supabase or in-memory)'
      }
    });

  } catch (error) {
    console.error('❌ Error retrieving logs:', error);
    return NextResponse.json({
      error: 'Failed to get logs',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}