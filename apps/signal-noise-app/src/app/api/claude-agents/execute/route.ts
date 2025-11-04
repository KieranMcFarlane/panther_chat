import { NextRequest, NextResponse } from 'next/server';
import { claudeAgentScheduler } from '@/services/ClaudeAgentScheduler';

export async function POST(req: NextRequest) {
  try {
    const { agent, command } = await req.json();

    // Ensure scheduler is configured
    if (!claudeAgentScheduler.getStatus().isConfigured) {
      try {
        claudeAgentScheduler.configureFromEnvironment();
      } catch (configError) {
        return NextResponse.json({
          error: 'Scheduler not configured and auto-configuration failed',
          details: configError instanceof Error ? configError.message : 'Unknown error'
        }, { status: 400 });
      }
    }

    switch (command) {
      case 'execute-mines':
        // Trigger immediate Mines Agent execution with Claude SDK
        await claudeAgentScheduler.triggerMinesAgent();
        return NextResponse.json({
          success: true,
          message: '🚨 Mines Agent executing with Claude SDK - RFP detection and backtesting started',
          agent: 'mines',
          command: 'execute-mines'
        });

      case 'execute-enrichment':
        // Trigger immediate Enrichment Agent execution with Claude SDK
        await claudeAgentScheduler.triggerEnrichmentAgent();
        return NextResponse.json({
          success: true,
          message: '🧬 Enrichment Agent executing with Claude SDK - entity enrichment started',
          agent: 'enrichment', 
          command: 'execute-enrichment'
        });

      case 'execute-both':
        // Execute both agents sequentially
        await claudeAgentScheduler.triggerMinesAgent();
        await new Promise(resolve => setTimeout(resolve, 2000)); // Small delay between agents
        await claudeAgentScheduler.triggerEnrichmentAgent();
        return NextResponse.json({
          success: true,
          message: '🚀 Both agents executing with Claude SDK - Mines Agent and Enrichment Agent started',
          agent: 'both',
          command: 'execute-both'
        });

      default:
        return NextResponse.json({
          error: 'Invalid command',
          availableCommands: [
            'execute-mines - Trigger Mines Agent with Claude SDK',
            'execute-enrichment - Trigger Enrichment Agent with Claude SDK', 
            'execute-both - Execute both agents with Claude SDK'
          ]
        }, { status: 400 });
    }

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to execute Claude Agent command',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    return NextResponse.json({
      endpoint: '/api/claude-agents/execute',
      description: 'Execute Claude Agent commands with real Claude SDK processing',
      availableCommands: [
        {
          command: 'execute-mines',
          description: 'Trigger Mines Agent with Claude SDK for RFP detection and 6-month backtesting',
          processing: '8 seconds Claude SDK analysis',
          output: 'RFP opportunities saved to /tender page'
        },
        {
          command: 'execute-enrichment', 
          description: 'Trigger Enrichment Agent with Claude SDK for comprehensive entity processing',
          processing: '12 seconds Claude SDK analysis',
          output: '4000+ entities enriched with complete schema'
        },
        {
          command: 'execute-both',
          description: 'Execute both agents sequentially with Claude SDK processing',
          processing: '~22 seconds total analysis time',
          output: 'RFP detection + entity enrichment completed'
        }
      ],
      usage: 'POST with { "command": "execute-mines|execute-enrichment|execute-both" }'
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to get command info',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}