/**
 * API endpoint to start the A2A system for RFP discovery
 * Uses the updated methodology with yellowPantherPriority scoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { realMCPA2ASystem } from '@/lib/real-mcp-a2a-system';
import { liveLogService } from '@/services/LiveLogService';

// Global flag to prevent multiple simultaneous A2A runs
let isA2ARunning = false;

export async function POST(request: NextRequest) {
  try {
    // Check if A2A is already running
    if (isA2ARunning) {
      return NextResponse.json({
        success: false,
        error: 'A2A system is already running',
        status: 'running'
      }, { status: 409 });
    }

    isA2ARunning = true;

    const body = await request.json();
    const { 
      entityLimit = 50, 
      startImmediate = true,
      monitoringMode = 'discovery' 
    } = body;

    console.log('🚀 Starting A2A RFP Discovery System...');
    console.log(`   Entity limit: ${entityLimit}`);
    console.log(`   Monitoring mode: ${monitoringMode}`);
    console.log(`   Start immediate: ${startImmediate}`);

    // Log the start
    await liveLogService.info('🚀 Starting A2A RFP Discovery System', {
      category: 'a2a-system',
      source: 'API',
      message: `A2A system started with ${entityLimit} entity limit`,
      data: {
        entityLimit,
        monitoringMode,
        startImmediate,
        timestamp: new Date().toISOString()
      },
      tags: ['a2a-start', 'rfp-discovery', 'autonomous']
    });

    // Start the A2A discovery
    if (startImmediate) {
      console.log('🔍 Starting immediate A2A discovery...');
      realMCPA2ASystem.startRealDiscovery();
    }

    // Set up event listeners for discovered opportunities
    realMCPA2ASystem.on('rfpDiscovered', (data) => {
      console.log('🎯 RFP Discovered:', data.rfp.title);
      
      liveLogService.info('🎯 RFP Opportunity Discovered', {
        category: 'a2a-discovery',
        source: 'Real MCP A2A System',
        message: `New RFP discovered: ${data.rfp.title}`,
        data: {
          rfpTitle: data.rfp.title,
          organization: data.rfp.entity.name,
          fitScore: data.rfp.fitScore,
          priority: data.rfp.priority,
          source: data.rfp.source
        },
        tags: ['rfp-discovered', 'opportunity', data.rfp.priority]
      });
    });

    realMCPA2ASystem.on('opportunityStored', (data) => {
      console.log('💾 Opportunity stored to tenders page:', data.opportunityId);
      
      liveLogService.info('💾 Opportunity Stored to Tenders Page', {
        category: 'a2a-storage',
        source: 'API Integration',
        message: `Opportunity stored: ${data.rfp.title}`,
        data: {
          rfpTitle: data.rfp.title,
          opportunityId: data.opportunityId,
          storage: data.storage,
          agentName: data.rfp.entity.name
        },
        tags: ['opportunity-stored', 'tenders-page', data.storage]
      });
    });

    realMCPA2ASystem.on('agentStarted', (data) => {
      console.log('🤖 Agent started:', data.agent.name);
    });

    realMCPA2ASystem.on('agentError', (data) => {
      console.error('❌ Agent error:', data.agent.name, data.error);
      
      liveLogService.error('❌ A2A Agent Error', {
        category: 'a2a-error',
        source: 'Real MCP A2A System',
        message: `Agent ${data.agent.name} encountered error: ${data.error.message}`,
        data: {
          agentName: data.agent.name,
          error: data.error.message,
          agentType: data.agent.type
        },
        tags: ['a2a-error', 'agent-failure', data.agent.type]
      });
    });

    // Set up completion handler
    setTimeout(() => {
      isA2ARunning = false;
      
      const status = realMCPA2ASystem.getSystemStatus();
      
      liveLogService.info('✅ A2A System Cycle Completed', {
        category: 'a2a-completion',
        source: 'API',
        message: `A2A discovery cycle completed. Found ${status.totalOpportunitiesFound} opportunities.`,
        data: {
          totalEntitiesProcessed: status.totalEntitiesProcessed,
          totalOpportunitiesFound: status.totalOpportunitiesFound,
          totalMCPCalls: status.totalMCPCalls,
          agents: status.agents.length,
          runDuration: '5-10 minutes'
        },
        tags: ['a2a-completion', 'cycle-finished', 'results']
      });
      
      console.log('✅ A2A system cycle completed');
      console.log(`   Total entities processed: ${status.totalEntitiesProcessed}`);
      console.log(`   Total opportunities found: ${status.totalOpportunitiesFound}`);
      console.log(`   Total MCP calls made: ${status.totalMCPCalls}`);
    }, 10 * 60 * 1000); // 10 minutes max runtime

    return NextResponse.json({
      success: true,
      message: 'A2A RFP Discovery System started successfully',
      status: 'running',
      config: {
        entityLimit,
        monitoringMode,
        startImmediate
      },
      nextSteps: [
        'A2A agents are scanning entities for RFP opportunities',
        'Discovered opportunities will appear on /tenders page',
        'Check system logs for real-time progress',
        'Results will be stored automatically to Supabase'
      ]
    });

  } catch (error) {
    isA2ARunning = false;
    console.error('❌ Error starting A2A system:', error);
    
    await liveLogService.error('❌ Failed to Start A2A System', {
      category: 'a2a-error',
      source: 'API',
      message: `A2A system startup failed: ${error.message}`,
      data: { error: error.message },
      tags: ['a2a-error', 'startup-failure']
    });

    return NextResponse.json({
      success: false,
      error: 'Failed to start A2A system',
      details: error.message
    }, { status: 500 });
  }
}

// GET endpoint to check A2A status
export async function GET(request: NextRequest) {
  try {
    const status = realMCPA2ASystem.getSystemStatus();
    
    return NextResponse.json({
      success: true,
      status: {
        isRunning: status.isRunning,
        totalEntitiesProcessed: status.totalEntitiesProcessed,
        totalOpportunitiesFound: status.totalOpportunitiesFound,
        totalMCPCalls: status.totalMCPCalls,
        discoveredRFPs: status.discoveredRFPs.length,
        agents: status.agents.map(agent => ({
          id: agent.id,
          name: agent.name,
          type: agent.type,
          status: agent.status,
          entitiesProcessed: agent.metrics.entitiesProcessed,
          opportunitiesFound: agent.metrics.opportunitiesFound,
          mcpCalls: agent.metrics.mcpCalls,
          errors: agent.metrics.errors
        })),
        mcpServers: status.mcpServers
      },
      apiStatus: {
        isCurrentlyRunning: isA2ARunning,
        canStart: !isA2ARunning
      }
    });

  } catch (error) {
    console.error('❌ Error getting A2A status:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get A2A status',
      details: error.message
    }, { status: 500 });
  }
}