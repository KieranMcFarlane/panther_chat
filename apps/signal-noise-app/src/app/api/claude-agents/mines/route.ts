import { NextRequest, NextResponse } from 'next/server';
import { claudeAgentScheduler } from '@/services/ClaudeAgentScheduler';

export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json();

    // Ensure scheduler is configured before agent operations
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
      case 'start':
        claudeAgentScheduler.startMinesAgent();
        return NextResponse.json({ 
          success: true, 
          message: '🚨 Mines Agent started - RFP detection active' 
        });

      case 'stop':
        claudeAgentScheduler.stopAgent('mines-agent');
        return NextResponse.json({ 
          success: true, 
          message: '⏹️ Mines Agent stopped' 
        });

      case 'trigger':
        await claudeAgentScheduler.triggerMinesAgent();
        return NextResponse.json({ 
          success: true, 
          message: '🚨 Mines Agent triggered manually - executing webhook detection and backtesting' 
        });

      default:
        return NextResponse.json({ 
          error: 'Invalid action. Use: start, stop, or trigger' 
        }, { status: 400 });
    }

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to control Mines Agent',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    const status = claudeAgentScheduler.getStatus();
    
    return NextResponse.json({
      agent: 'Mines Agent',
      description: 'RFP and opportunity detection with webhook monitoring and 6-month backtesting',
      status: status.agents.mines,
      capabilities: [
        'Webhook detection from Keyword Mines system',
        'Historical backtesting (6 months)',
        'RFP opportunity identification',
        'Saves findings to /tender page',
        'Sports industry procurement monitoring',
        'Real-time opportunity scoring'
      ],
      schedule: 'Every 30 minutes (*/30 * * * *)',
      targets: 'Sports clubs, leagues, venues, organizations',
      keywords: [
        'sports technology RFP',
        'venue management procurement',
        'event services tender',
        'stadium digital transformation',
        'sports sponsorship opportunities',
        'athletic department technology',
        'sports facility management software',
        'ticketing system RFP',
        'fan engagement platform',
        'sports analytics procurement'
      ]
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to get Mines Agent status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}