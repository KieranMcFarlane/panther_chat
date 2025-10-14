import { NextRequest, NextResponse } from 'next/server';
import { claudeAgentScheduler } from '@/services/ClaudeAgentScheduler';

export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json();

    // Ensure scheduler is configured before starting agents
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

    switch (action) {
      case 'start-both':
        claudeAgentScheduler.startSpecializedAgents();
        return NextResponse.json({ 
          success: true, 
          message: '🚀 Both specialized agents started - Mines Agent (RFP detection) and Enrichment Agent (entity enrichment)' 
        });

      case 'stop-all':
        claudeAgentScheduler.stopAllAgents();
        return NextResponse.json({ 
          success: true, 
          message: '⏹️ All Claude Agent tasks stopped' 
        });

      case 'start-mines':
        claudeAgentScheduler.startMinesAgent();
        return NextResponse.json({ 
          success: true, 
          message: '🚨 Mines Agent started' 
        });

      case 'start-enrichment':
        claudeAgentScheduler.startEnrichmentAgent();
        return NextResponse.json({ 
          success: true, 
          message: '🧬 Enrichment Agent started' 
        });

      case 'restart-both':
        claudeAgentScheduler.stopAllAgents();
        setTimeout(() => {
          claudeAgentScheduler.startSpecializedAgents();
        }, 2000);
        return NextResponse.json({ 
          success: true, 
          message: '🔄 Both agents restarting...' 
        });

      default:
        return NextResponse.json({ 
          error: 'Invalid action. Use: start-both, stop-all, start-mines, start-enrichment, or restart-both' 
        }, { status: 400 });
    }

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to control Claude Agents',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}