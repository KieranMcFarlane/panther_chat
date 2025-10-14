/**
 * Alert Detections API - Query and manage alert detections
 */

import { NextRequest, NextResponse } from 'next/server';
import { keywordMinesService } from '@/services/KeywordMinesService';
import { supabase } from '@/lib/supabase-client';

/**
 * Get recent alert detections with filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const entity_id = searchParams.get('entity_id');
    const entity_type = searchParams.get('entity_type');
    const urgency_level = searchParams.get('urgency_level');
    const hours = parseInt(searchParams.get('hours') || '24');
    const sport = searchParams.get('sport');

    let query = supabase
      .from('alert_detections')
      .select(`
        *,
        keyword_mines!inner(
          entity_name,
          entity_type,
          sport,
          keywords
        )
      `)
      .order('detected_at', { ascending: false })
      .limit(limit);

    // Apply filters
    if (entity_id) {
      query = query.eq('entity_id', entity_id);
    }

    if (entity_type) {
      query = query.eq('keyword_mines.entity_type', entity_type);
    }

    if (sport) {
      query = query.eq('keyword_mines.sport', sport);
    }

    if (hours) {
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - hours);
      query = query.gte('detected_at', cutoff.toISOString());
    }

    const { data: detections, error } = await query;

    if (error) throw error;

    // Filter by urgency level if specified (post-processing since it's in reasoning_analysis)
    let filteredDetections = detections || [];
    if (urgency_level) {
      filteredDetections = filteredDetections.filter(detection => {
        try {
          const reasoning = JSON.parse(detection.reasoning_analysis);
          return reasoning.urgency_level === urgency_level;
        } catch {
          return false;
        }
      });
    }

    // Parse reasoning_analysis for each detection
    const enrichedDetections = filteredDetections.map(detection => {
      let reasoning = null;
      try {
        reasoning = JSON.parse(detection.reasoning_analysis);
      } catch {
        reasoning = { urgency_level: 'unknown', relevance_score: 0 };
      }

      return {
        ...detection,
        parsed_reasoning: reasoning
      };
    });

    return NextResponse.json({
      detections: enrichedDetections,
      total: enrichedDetections.length,
      filters: {
        entity_id,
        entity_type,
        urgency_level,
        hours,
        sport
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Failed to get alert detections:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to get detections'
    }, { status: 500 });
  }
}

/**
 * Update alert detection status
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { detection_id, action, metadata } = body;

    if (!detection_id || !action) {
      return NextResponse.json({
        error: 'Missing required fields: detection_id, action'
      }, { status: 400 });
    }

    const updateData: any = {};
    
    switch (action) {
      case 'mark_read':
        updateData.read = true;
        updateData.read_at = new Date().toISOString();
        break;
      case 'archive':
        updateData.archived = true;
        updateData.archived_at = new Date().toISOString();
        break;
      case 'escalate':
        updateData.escalated = true;
        updateData.escalated_at = new Date().toISOString();
        break;
      default:
        updateData.metadata = metadata;
    }

    const { data, error } = await supabase
      .from('alert_detections')
      .update(updateData)
      .eq('id', detection_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      status: 'detection_updated',
      detection: data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Failed to update detection:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to update detection'
    }, { status: 500 });
  }
}