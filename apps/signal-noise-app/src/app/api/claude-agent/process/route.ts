/**
 * Process user requests through Claude Code SDK
 */

import { NextRequest, NextResponse } from 'next/server';

interface ProcessRequest {
  prompt: string;
  context: {
    activeCampaign?: any;
    agentCapabilities: any;
    timestamp: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, context }: ProcessRequest = await request.json();
    
    // Initialize Claude Code agent
    const { AGUIEmailAgent } = await import('@/lib/claude-email-agent');
    const agent = new AGUIEmailAgent();
    
    // Process the request using Claude Code SDK
    const result = await agent.processUserRequest(prompt, context);
    
    // Extract actions and follow-up suggestions
    const actions = result.response.content
      .filter((block: any) => block.type === 'tool_use')
      .map((tool: any, index: number) => ({
        id: `action_${Date.now()}_${index}`,
        type: tool.name,
        description: `Execute ${tool.name.replace(/_/g, ' ')}`,
        parameters: tool.arguments,
        status: 'pending'
      }));
    
    // Check if this involves a campaign
    let campaignUpdate = null;
    if (prompt.toLowerCase().includes('campaign') || actions.some((a: any) => a.type.includes('campaign'))) {
      campaignUpdate = await extractCampaignInfo(result.response);
    }
    
    return NextResponse.json({
      success: true,
      response: result.response.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n\n'),
      actions,
      followUpSuggestions: result.followUpSuggestions,
      campaignUpdate,
      processingTime: Date.now() - new Date(context.timestamp).getTime()
    });
    
  } catch (error) {
    console.error('Error processing Claude agent request:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process request with Claude Code Agent',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function extractCampaignInfo(response: any): Promise<any> {
  // Extract campaign information from Claude's response
  const text = response.content
    .filter((block: any) => block.type === 'text')
    .map((block: any) => block.text)
    .join('\n\n');
  
  // Look for campaign metrics in the response
  const targetMatch = text.match(/targeting (\d+) contacts/i);
  const targetCount = targetMatch ? parseInt(targetMatch[1]) : 0;
  
  return {
    id: `campaign_${Date.now()}`,
    goal: extractGoal(text),
    targetCount,
    sentCount: 0,
    openRate: 0,
    responseRate: 0,
    status: 'running' as const,
    estimatedTime: '15-30 minutes',
    results: []
  };
}

function extractGoal(text: string): string {
  // Extract campaign goal from text
  const goalPatterns = [
    /campaign (?:launched|started) for: (.+)/i,
    /goal: (.+)/i,
    /execute (.+) campaign/i
  ];
  
  for (const pattern of goalPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  return 'Autonomous campaign';
}