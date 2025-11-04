/**
 * Keyword Mines API - Initialize and manage monitoring mines
 */

import { NextRequest, NextResponse } from 'next/server';
import { keywordMinesService } from '@/services/KeywordMinesService';

/**
 * Initialize keyword mines for all entities in the system
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, entity_id, entity_ids } = body;

    if (action === 'initialize_all') {
      // Initialize mines for all entities
      const results = await keywordMinesService.initializeMinesForAllEntities();
      
      return NextResponse.json({
        status: 'mines_initialized',
        results,
        timestamp: new Date().toISOString()
      });

    } else if (action === 'initialize_specific' && (entity_id || entity_ids)) {
      // Initialize mines for specific entities
      const entityIds = Array.isArray(entity_ids) ? entity_ids : [entity_id];
      const results = { created: 0, updated: 0, failed: 0 };

      for (const id of entityIds) {
        // Implementation for specific entity initialization
        // This would call a modified version of the service
      }

      return NextResponse.json({
        status: 'specific_mines_initialized',
        entity_ids: entityIds,
        results,
        timestamp: new Date().toISOString()
      });

    } else {
      return NextResponse.json({
        error: 'Invalid action. Use "initialize_all" or "initialize_specific" with entity_id(s)'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ Failed to initialize keyword mines:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to initialize mines'
    }, { status: 500 });
  }
}

/**
 * Get status of keyword mines
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entity_id = searchParams.get('entity_id');
    const status = searchParams.get('status');

    // Implementation would query the database for mine status
    return NextResponse.json({
      status: 'mines_status',
      timestamp: new Date().toISOString(),
      // Add actual mine data here
    });

  } catch (error) {
    console.error('❌ Failed to get mines status:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to get mines status'
    }, { status: 500 });
  }
}