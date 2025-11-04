import { NextRequest, NextResponse } from 'next/server';

// Simple test to verify LiveLogService in-memory functionality
// This bypasses Supabase entirely and tests the core logging mechanism

class TestLogService {
  private logs: any[] = [];
  
  addLog(log: any) {
    this.logs.unshift(log);
    console.log('📝 Added log to test service:', log.message);
    if (this.logs.length > 100) {
      this.logs = this.logs.slice(0, 100);
    }
  }
  
  getLogs() {
    console.log('📋 Retrieving logs from test service:', this.logs.length, 'logs');
    return this.logs;
  }
}

const testLogService = new TestLogService();

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();
    
    const logEntry = {
      id: `test_${Date.now()}`,
      timestamp: new Date().toISOString(),
      level: 'info',
      category: 'claude-agent',
      source: 'TestService',
      message: message || 'Test log message',
      data: { test: true, timestamp: new Date().toISOString() }
    };
    
    testLogService.addLog(logEntry);
    
    return NextResponse.json({
      success: true,
      message: 'Log added to test service',
      log_id: logEntry.id
    });
    
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to add log',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    const logs = testLogService.getLogs();
    
    return NextResponse.json({
      success: true,
      logs,
      count: logs.length,
      message: 'Logs retrieved from test service'
    });
    
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to get logs',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}