/**
 * Live Log API - Real-time system activity logs
 */

import { NextRequest, NextResponse } from 'next/server';
import { liveLogService } from '@/services/LiveLogService';

export const dynamic = 'force-dynamic';

/**
 * Get recent log entries
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const level = searchParams.get('level');
    const category = searchParams.get('category');
    const source = searchParams.get('source');
    const entity_id = searchParams.get('entity_id');
    const hours = parseInt(searchParams.get('hours') || '24');
    const tags = searchParams.get('tags')?.split(',').filter(Boolean);

    const logs = await liveLogService.getLogs({
      limit,
      level: level || undefined,
      category: category || undefined,
      source: source || undefined,
      entity_id: entity_id || undefined,
      hours,
      tags: tags && tags.length > 0 ? tags : undefined
    });

    return NextResponse.json({
      logs,
      total: logs.length,
      filters: { limit, level, category, source, entity_id, hours, tags },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Failed to get logs:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to get logs'
    }, { status: 500 });
  }
}

/**
 * Create a new log entry
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { level, category, source, message, data, metadata, tags } = body;

    if (!level || !category || !source || !message) {
      return NextResponse.json({
        error: 'Missing required fields: level, category, source, message'
      }, { status: 400 });
    }

    liveLogService.log({
      level,
      category,
      source,
      message,
      data,
      metadata,
      tags,
      entity_id: body.entity_id,
      entity_name: body.entity_name
    });

    return NextResponse.json({
      status: 'log_created',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Failed to create log:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to create log'
    }, { status: 500 });
  }
}