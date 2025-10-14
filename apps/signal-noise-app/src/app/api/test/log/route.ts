import { NextRequest, NextResponse } from 'next/server';
import { liveLogService } from '@/services/LiveLogService';

export async function POST(request: NextRequest) {
  try {
    const logData = await request.json();
    
    // Log the test entry using LiveLogService
    liveLogService.info(logData.message, {
      category: logData.category || 'test',
      source: logData.source || 'TestAPI',
      entity_name: logData.entity_name,
      message: logData.message,
      level: logData.level || 'info',
      data: logData.data || {},
      tags: logData.tags || ['test'],
      metadata: {
        test_log: true,
        timestamp: new Date().toISOString()
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Test log received',
      log: logData 
    });

  } catch (error) {
    console.error('Error in test log API:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}