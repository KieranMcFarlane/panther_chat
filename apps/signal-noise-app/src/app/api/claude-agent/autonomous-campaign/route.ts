/**
 * Launch autonomous campaigns using Claude Code SDK
 */

import { NextRequest, NextResponse } from 'next/server';

interface AutonomousCampaignRequest {
  goal: string;
  criteria: {
    priority?: string;
    daysSinceContact?: number;
    industry?: string;
    relationshipScore?: number;
    location?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const { goal, criteria }: AutonomousCampaignRequest = await request.json();
    
    // Use Claude Code SDK to execute autonomous campaign
    const { executeAutonomousCampaign } = await import('@/lib/claude-email-agent');
    
    const campaignResults = await executeAutonomousCampaign(goal, criteria);
    
    // Extract campaign information
    const campaign = {
      id: `autonomous_${Date.now()}`,
      goal,
      criteria,
      targetCount: campaignResults.length,
      sentCount: 0,
      openRate: 0,
      responseRate: 0,
      status: 'running' as const,
      startTime: new Date().toISOString(),
      estimatedTime: '15-30 minutes',
      results: campaignResults,
      nextActions: extractNextActions(campaignResults)
    };
    
    return NextResponse.json({
      success: true,
      campaign,
      executionSummary: {
        stepsCompleted: campaignResults.length,
        reasoning: campaignResults.map(r => r.reasoning).join('\n\n'),
        totalProcessingTime: campaignResults.reduce((sum, r) => sum + (r.processingTime || 0), 0)
      }
    });
    
  } catch (error) {
    console.error('Error launching autonomous campaign:', error);
    return NextResponse.json(
      { 
        error: 'Failed to launch autonomous campaign',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function extractNextActions(campaignResults: any[]): string[] {
  const actions = new Set<string>();
  
  campaignResults.forEach(result => {
    if (result.nextActions) {
      result.nextActions.forEach((action: string) => actions.add(action));
    }
  });
  
  return Array.from(actions).slice(0, 5); // Return top 5 actions
}