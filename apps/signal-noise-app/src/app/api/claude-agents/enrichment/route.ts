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
        claudeAgentScheduler.startEnrichmentAgent();
        return NextResponse.json({ 
          success: true, 
          message: '🧬 Enrichment Agent started - processing 4,000+ entities' 
        });

      case 'stop':
        claudeAgentScheduler.stopAgent('enrichment-agent');
        return NextResponse.json({ 
          success: true, 
          message: '⏹️ Enrichment Agent stopped' 
        });

      case 'trigger':
        await claudeAgentScheduler.triggerEnrichmentAgent();
        return NextResponse.json({ 
          success: true, 
          message: '🧬 Enrichment Agent triggered manually - processing entity enrichment' 
        });

      default:
        return NextResponse.json({ 
          error: 'Invalid action. Use: start, stop, or trigger' 
        }, { status: 400 });
    }

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to control Enrichment Agent',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    const status = claudeAgentScheduler.getStatus();
    
    return NextResponse.json({
      agent: 'Enrichment Agent',
      description: 'Comprehensive entity enrichment for all 4,000+ entities using complete schema',
      status: status.agents.enrichment,
      capabilities: [
        'Entity enrichment based on ENTITY_SCHEMA_DEFINITION.md',
        'Batch processing (50 entities per batch)',
        'Digital maturity assessment',
        'Contact information enrichment',
        'Financial data collection',
        'Relationship mapping',
        'Technology stack analysis',
        'Market positioning data'
      ],
      schedule: 'Daily at 2:00 AM UTC (0 2 * * *)',
      targetEntities: 4000,
      processingOrder: 'Highest priority entities first',
      enrichmentSources: [
        'BrightData MCP: Web scraping, company research',
        'Perplexity MCP: Strategic analysis, market insights',
        'Neo4j MCP: Relationship mapping, knowledge graph'
      ],
      successCriteria: [
        'All 4,000+ entities processed with core enrichment',
        'Minimum 80% completion rate for priority fields',
        'Quality checks passed for data consistency',
        'No duplicate or conflicting information'
      ]
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to get Enrichment Agent status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}