import { NextResponse } from 'next/server';
import { claudeAgentScheduler } from '@/services/ClaudeAgentScheduler';

export async function GET() {
  try {
    const status = claudeAgentScheduler.getStatus();
    
    return NextResponse.json({
      scheduler: {
        isConfigured: status.isConfigured,
        activeTasks: status.activeTasks,
        totalAgents: 3
      },
      agents: {
        mines: {
          ...status.agents.mines,
          name: '🚨 Mines Agent',
          purpose: 'RFP Detection & Webhook Monitoring',
          description: 'Monitors Keyword Mines webhooks and performs 6-month historical backtesting for RFP opportunities'
        },
        enrichment: {
          ...status.agents.enrichment,
          name: '🧬 Enrichment Agent', 
          purpose: 'Entity Data Enrichment',
          description: 'Comprehensive enrichment of all 4,000+ entities using complete schema definition'
        },
        legacy: {
          ...status.agents.legacy,
          name: '📅 Legacy Scanner',
          purpose: 'Daily RFP Scanning',
          description: 'Traditional daily RFP intelligence scanning'
        }
      },
      controls: {
        startBoth: '/api/claude-agents/control?action=start-both',
        stopAll: '/api/claude-agents/control?action=stop-all',
        triggerMines: '/api/claude-agents/mines?action=trigger',
        triggerEnrichment: '/api/claude-agents/enrichment?action=trigger'
      },
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to get agent status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}