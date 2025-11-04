import { NextRequest, NextResponse } from 'next/server';
import { cleanClaudeAgentService } from '@/services/CleanClaudeAgentService';
import { intelligentEnrichmentScheduler } from '@/services/IntelligentEnrichmentScheduler';

/**
 * API endpoint for intelligent entity enrichment using Claude Agent SDK + MCP
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, scheduleId, config } = body;

    switch (action) {
      case 'start-enrichment':
        if (cleanClaudeAgentService.isRunning()) {
          return NextResponse.json({
            success: false,
            error: 'Claude Agent enrichment already running',
            data: cleanClaudeAgentService.getCurrentBatch()
          }, { status: 409 });
        }

        const batchProgress = await cleanClaudeAgentService.startEnrichment();
        
        return NextResponse.json({
          success: true,
          message: 'Intelligent entity enrichment started with Claude Agent',
          data: batchProgress
        });

      case 'trigger-schedule':
        if (!scheduleId) {
          return NextResponse.json({
            success: false,
            error: 'Schedule ID is required for manual trigger'
          }, { status: 400 });
        }

        const scheduleResults = await intelligentEnrichmentScheduler.triggerEnrichment(scheduleId, config);
        
        return NextResponse.json({
          success: true,
          message: `Manually triggered intelligent enrichment: ${scheduleId}`,
          data: scheduleResults
        });

      case 'toggle-schedule':
        if (!scheduleId) {
          return NextResponse.json({
            success: false,
            error: 'Schedule ID is required for toggle'
          }, { status: 400 });
        }

        const { enabled } = body;
        intelligentEnrichmentScheduler.toggleSchedule(scheduleId, enabled);
        
        return NextResponse.json({
          success: true,
          message: `Schedule ${scheduleId} ${enabled ? 'enabled' : 'disabled'}`,
          data: { scheduleId, enabled }
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Supported actions: start-enrichment, trigger-schedule, toggle-schedule'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ Failed to execute intelligent enrichment:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: {
        timestamp: new Date().toISOString(),
        action: 'intelligent-enrichment-error'
      }
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'status';

    switch (view) {
      case 'status':
        const currentBatch = cleanClaudeAgentService.getCurrentBatch();
        const isRunning = cleanClaudeAgentService.isRunning();
        const schedulerStatus = intelligentEnrichmentScheduler.getCurrentEnrichmentStatus();

        return NextResponse.json({
          success: true,
          data: {
            claudeAgent: {
              isRunning,
              currentBatch,
              timestamp: new Date().toISOString()
            },
            scheduler: schedulerStatus,
            capabilities: {
              tools: ['neo4j-mcp', 'brightdata-mcp', 'perplexity-mcp', 'supabase-mcp'],
              strategies: ['intensive', 'standard', 'quick'],
              features: [
                'Intelligent entity selection',
                'Adaptive enrichment strategies', 
                'Real-time error recovery',
                'Relationship-aware processing',
                'Performance optimization'
              ]
            }
          }
        });

      case 'schedules':
        const schedules = intelligentEnrichmentScheduler.getSchedules();
        
        return NextResponse.json({
          success: true,
          data: {
            schedules,
            totalSchedules: schedules.length,
            activeSchedules: schedules.filter(s => s.enabled).length,
            timestamp: new Date().toISOString()
          }
        });

      case 'history':
        // Return historical enrichment data (would need to implement persistence)
        return NextResponse.json({
          success: true,
          data: {
            message: 'Historical data feature coming soon',
            note: 'Implement Supabase persistence for enrichment history'
          }
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid view parameter. Supported views: status, schedules, history'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ Failed to get intelligent enrichment status:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}