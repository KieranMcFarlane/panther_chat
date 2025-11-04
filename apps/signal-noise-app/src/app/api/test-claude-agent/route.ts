import { NextRequest, NextResponse } from 'next/server';
import { HeadlessClaudeAgentService } from '@/services/HeadlessClaudeAgentService';

/**
 * Test endpoint to manually trigger Claude Agent RFP scraping
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Test: Starting Claude Agent RFP scraping...');

    // Initialize Claude Agent with environment configuration
    const config = {
      brightdataApiKey: process.env.BRIGHTDATA_API_TOKEN,
      brightdataZone: process.env.BRIGHTDATA_ZONE || 'linkedin_posts_monitor',
      neo4jUri: process.env.NEO4J_URI,
      neo4jUsername: process.env.NEO4J_USERNAME,
      neo4jPassword: process.env.NEO4J_PASSWORD,
      teamsWebhookUrl: process.env.TEAMS_WEBHOOK_URL,
      searchQueries: [
        'sports technology RFP',
        'venue management Request for Proposal',
        'event services procurement',
        'stadium digital transformation',
        'sports sponsorship opportunities',
        'athletic department technology',
        'sports facility management software',
        'ticketing system RFP'
      ],
      targetIndustries: [
        'Sports & Entertainment',
        'Venue Management',
        'Event Technology',
        'Digital Sports',
        'Facility Operations'
      ]
    };

    // Validate required environment variables
    if (!config.brightdataApiKey) {
      return NextResponse.json({
        success: false,
        error: 'BRIGHTDATA_API_TOKEN environment variable is required'
      }, { status: 400 });
    }

    if (!config.neo4jUri || !config.neo4jUsername || !config.neo4jPassword) {
      return NextResponse.json({
        success: false,
        error: 'Neo4j configuration (NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD) is required'
      }, { status: 400 });
    }

    // Initialize and run Claude Agent
    const claudeService = new HeadlessClaudeAgentService(config);
    
    console.log('🚀 Test: Starting RFP scanning...');
    const startTime = Date.now();
    
    const results = await claudeService.runDailyRFPScraping();
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ Test: RFP scanning completed in ${duration}ms`);
    console.log(`📊 Test: Found ${results.length} opportunities`);

    return NextResponse.json({
      success: true,
      data: {
        results,
        summary: {
          totalFound: results.length,
          highValue: results.filter(r => r.relevanceScore > 0.8).length,
          duration: duration,
          executedAt: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    console.error('❌ Test: Claude Agent error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: {
        stack: error.stack,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}

/**
 * GET endpoint for checking test status
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Claude Agent test endpoint is ready',
    environment: {
      hasBrightDataToken: !!process.env.BRIGHTDATA_API_TOKEN,
      hasNeo4jConfig: !!(process.env.NEO4J_URI && process.env.NEO4J_USERNAME),
      hasTeamsWebhook: !!process.env.TEAMS_WEBHOOK_URL,
      cronEnabled: process.env.CLAUDE_AGENT_CRON_ENABLED === 'true'
    }
  });
}