import { NextRequest, NextResponse } from 'next/server';
import { orchestrator, AgentOrchestrator } from '@/lib/a2a-rfp-system';

// Global orchestrator instance
let globalOrchestrator: AgentOrchestrator | null = null;

// MCP Configuration
const MCP_CONFIG = {
  'neo4j-mcp': {
    command: 'npx',
    args: ['-y', '@neo4j/mcp-server'],
    env: {
      NEO4J_URI: process.env.NEO4J_URI,
      NEO4J_USERNAME: process.env.NEO4J_USERNAME,
      NEO4J_PASSWORD: process.env.NEO4J_PASSWORD
    }
  },
  'brightdata-mcp': {
    command: 'npx',
    args: ['-y', '@brightdata/mcp-server'],
    env: {
      BRIGHTDATA_API_TOKEN: process.env.BRIGHTDATA_API_TOKEN
    }
  },
  'perplexity-mcp': {
    command: 'npx',
    args: ['-y', '@perplexity/mcp-server'],
    env: {
      PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY
    }
  }
};

// Claude SDK Configuration
const CLAUDE_CONFIG = {
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-sonnet-20241022',
  maxTokens: 4000
};

// Initialize orchestrator
async function initializeOrchestrator() {
  if (!globalOrchestrator) {
    globalOrchestrator = orchestrator;
    
    try {
      await globalOrchestrator.initialize(MCP_CONFIG, CLAUDE_CONFIG);
      console.log('🚀 A2A RFP Orchestrator initialized successfully');
      
      // Start automated discovery
      setTimeout(() => {
        globalOrchestrator!.startDiscoveryWorkflow();
      }, 2000);
      
    } catch (error) {
      console.error('❌ Failed to initialize orchestrator:', error);
      globalOrchestrator = null;
    }
  }
  
  return globalOrchestrator;
}

// GET: System status and agent information
export async function GET() {
  try {
    const orchestratorInstance = await initializeOrchestrator();
    
    if (!orchestratorInstance) {
      return NextResponse.json({
        error: 'Failed to initialize A2A system',
        status: 'failed'
      }, { status: 500 });
    }

    return NextResponse.json({
      system: 'A2A RFP Intelligence',
      status: 'active',
      agents: orchestratorInstance.getSystemStatus(),
      mcpServers: Object.keys(MCP_CONFIG),
      capabilities: {
        discovery: ['LinkedIn monitoring', 'Government tender tracking', 'Market intelligence'],
        intelligence: ['RFP analysis', 'Company research', 'Competitive analysis'],
        action: ['Response generation', 'Outreach coordination', 'Meeting scheduling']
      },
      autonomy: {
        level: 'semi-autonomous',
        features: ['automatic discovery', 'intelligent analysis', 'human-in-the-loop actions']
      }
    });
    
  } catch (error) {
    console.error('A2A GET error:', error);
    return NextResponse.json({
      error: 'Failed to get A2A system status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST: Submit opportunity for A2A processing
export async function POST(req: NextRequest) {
  try {
    const orchestratorInstance = await initializeOrchestrator();
    
    if (!orchestratorInstance) {
      return NextResponse.json({
        error: 'A2A system not available'
      }, { status: 500 });
    }

    const body = await req.json();
    const { action, data } = body;

    switch (action) {
      case 'process_opportunity':
        const opportunityId = await orchestratorInstance.processOpportunity(data.opportunity);
        
        return NextResponse.json({
          success: true,
          opportunityId,
          status: 'processing',
          message: 'Opportunity submitted for A2A processing',
          system: 'A2A RFP Intelligence'
        });

      case 'generate_response':
        const responseId = await orchestratorInstance.generateResponse(
          data.opportunity,
          data.analysis,
          data.companyIntel
        );
        
        return NextResponse.json({
          success: true,
          responseId,
          status: 'generating',
          message: 'Response generation initiated',
          system: 'A2A RFP Intelligence'
        });

      case 'start_discovery':
        await orchestratorInstance.startDiscoveryWorkflow();
        
        return NextResponse.json({
          success: true,
          status: 'discovering',
          message: 'Automated discovery workflow started',
          system: 'A2A RFP Intelligence'
        });

      case 'custom_task':
        // Route custom task to specific agent
        const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        orchestratorInstance.sendMessage({
          id: taskId,
          from: 'api',
          to: data.agentId,
          type: 'task',
          priority: data.priority || 'medium',
          data: data.task,
          contextId: `api_${Date.now()}`,
          timestamp: new Date().toISOString(),
          requiresResponse: true
        });
        
        return NextResponse.json({
          success: true,
          taskId,
          status: 'tasked',
          message: `Task routed to ${data.agentId}`,
          system: 'A2A RFP Intelligence'
        });

      default:
        return NextResponse.json({
          error: 'Unknown action',
          availableActions: ['process_opportunity', 'generate_response', 'start_discovery', 'custom_task']
        }, { status: 400 });
    }

  } catch (error) {
    console.error('A2A POST error:', error);
    return NextResponse.json({
      error: 'Failed to process A2A request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Handle agent communication
export async function PUT(req: NextRequest) {
  try {
    const orchestratorInstance = await initializeOrchestrator();
    
    if (!orchestratorInstance) {
      return NextResponse.json({
        error: 'A2A system not available'
      }, { status: 500 });
    }

    const message = await req.json();
    
    // Route message through orchestrator
    orchestratorInstance.sendMessage(message);
    
    return NextResponse.json({
      success: true,
      status: 'routed',
      messageId: message.id,
      system: 'A2A RFP Intelligence'
    });

  } catch (error) {
    console.error('A2A PUT error:', error);
    return NextResponse.json({
      error: 'Failed to route A2A message',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// OPTIONS: CORS and system info
export async function OPTIONS() {
  return NextResponse.json({
    system: 'A2A RFP Intelligence',
    version: '1.0.0',
    description: 'Agent-to-Agent autonomous RFP processing system',
    endpoints: {
      'GET /': 'System status and agent information',
      'POST /': 'Submit opportunities and tasks for A2A processing',
      'PUT /': 'Route agent-to-agent messages',
      'GET /agents': 'List all agents and their capabilities',
      'GET /contexts': 'View active agent contexts and workflows',
      'POST /workflow': 'Start automated discovery workflows'
    },
    agents: [
      'linkedin-monitor-001',
      'gov-portal-001', 
      'rfp-analyst-001',
      'market-researcher-001',
      'response-generator-001',
      'outreach-coordinator-001'
    ]
  });
}

// Cleanup on server shutdown
process.on('SIGTERM', async () => {
  if (globalOrchestrator) {
    await globalOrchestrator.shutdown();
  }
});

process.on('SIGINT', async () => {
  if (globalOrchestrator) {
    await globalOrchestrator.shutdown();
  }
});