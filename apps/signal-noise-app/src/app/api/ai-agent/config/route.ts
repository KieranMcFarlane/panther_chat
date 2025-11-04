import { NextRequest, NextResponse } from 'next/server';

interface AIEmailAgentConfig {
  enabled: boolean;
  autoReply: boolean;
  responseStyle: 'professional' | 'friendly' | 'formal' | 'casual';
  responseDelay: number;
  classificationRules: ClassificationRule[];
  customPrompts: CustomPrompt[];
  workingHours: {
    start: string;
    end: string;
    timezone: string;
    weekends: boolean;
  };
  escalationRules: EscalationRule[];
}

interface ClassificationRule {
  id: string;
  type: string;
  keywords: string[];
  action: 'auto_reply' | 'flag_urgent' | 'forward' | 'archive' | 'flag_for_review';
  responseTemplate?: string;
  priority: number;
  enabled: boolean;
}

interface CustomPrompt {
  id: string;
  name: string;
  trigger: string;
  template: string;
  variables: string[];
  enabled: boolean;
}

interface EscalationRule {
  id: string;
  condition: 'no_response' | 'urgent_keyword' | 'high_priority_sender';
  timeframe: number;
  action: 'notify_manager' | 'escalate_to_team' | 'create_ticket';
  enabled: boolean;
}

// Mock database storage for demo
const agentConfigs = new Map<string, AIEmailAgentConfig>();

export async function POST(request: NextRequest) {
  try {
    const { entityId, config }: { entityId: string; config: AIEmailAgentConfig } = await request.json();

    // Validate config
    if (!entityId || !config) {
      return NextResponse.json(
        { error: 'Missing required fields: entityId, config' },
        { status: 400 }
      );
    }

    // Store configuration
    agentConfigs.set(entityId, config);

    // In production, save to database:
    // await saveAIAgentConfig(entityId, config);

    return NextResponse.json({
      success: true,
      message: 'AI agent configuration saved successfully',
      entityId,
      config
    });

  } catch (error) {
    console.error('Error saving AI agent config:', error);
    return NextResponse.json(
      { 
        error: 'Failed to save AI agent configuration',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get('entityId');

    if (!entityId) {
      return NextResponse.json(
        { error: 'Missing required parameter: entityId' },
        { status: 400 }
      );
    }

    // Retrieve configuration
    const config = agentConfigs.get(entityId);

    if (!config) {
      return NextResponse.json(
        { error: 'AI agent configuration not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      entityId,
      config
    });

  } catch (error) {
    console.error('Error retrieving AI agent config:', error);
    return NextResponse.json(
      { 
        error: 'Failed to retrieve AI agent configuration',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}