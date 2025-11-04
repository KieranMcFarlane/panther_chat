/**
 * Test route for A2A service to verify it works correctly
 */

import { NextRequest, NextResponse } from 'next/server';
import { A2AClaudeAgentService } from '@/services/A2AClaudeAgentService';
import { a2aSessionManager } from '@/services/A2ASessionManager';

export async function GET(request: NextRequest) {
  try {
    // Test session manager
    const sessionId = await a2aSessionManager.createOrResumeSession();
    
    // Test A2A service creation
    const agentService = new A2AClaudeAgentService({
      brightdataApiKey: process.env.BRIGHTDATA_API_TOKEN || 'test',
      brightdataZone: process.env.BRIGHTDATA_ZONE || 'test',
      neo4jUri: process.env.NEO4J_URI || 'test',
      neo4jUsername: process.env.NEO4J_USERNAME || 'test',
      neo4jPassword: process.env.NEO4J_PASSWORD || 'test',
      teamsWebhookUrl: process.env.TEAMS_WEBHOOK_URL || '',
      perplexityApiKey: process.env.PERPLEXITY_API_KEY || 'test',
      searchQueries: ['Test query'],
      targetIndustries: ['test']
    });

    return NextResponse.json({
      success: true,
      message: 'A2A service created successfully',
      sessionId,
      serviceType: 'A2A Multi-Agent System',
      agents: Object.keys(agentService['getAgentDefinitions']?.() || {}),
      sessionState: agentService.getSessionState?.() || null,
      isActive: agentService.isActive?.() || false
    });

  } catch (error) {
    console.error('A2A Test Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}