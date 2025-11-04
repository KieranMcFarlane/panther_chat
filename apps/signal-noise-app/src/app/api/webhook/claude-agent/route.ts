/**
 * 🎣 Claude Agent Webhook API
 * 
 * Real-time webhook processing with Claude Agent analysis for enriched data and alerts
 */

import { NextRequest, NextResponse } from 'next/server';
import { rfpIntelligenceAgent } from '@/lib/claude-agent-rfp-intelligence';

interface WebhookPayload {
  type: 'rfp_alert' | 'entity_alert' | 'entity_enrichment' | 'market_intelligence' | 'batch_job';
  data: any;
  priority?: 'high' | 'medium' | 'low';
  timestamp: string;
  source: string;
}

interface WebhookResponse {
  success: boolean;
  webhookId: string;
  processedAt: string;
  result?: any;
  error?: string;
  batchJobId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const payload: WebhookPayload = await request.json();
    
    // Validate webhook payload
    if (!payload.type || !payload.data) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: type, data',
        webhookId: generateWebhookId(),
        processedAt: new Date().toISOString()
      }, { status: 400 });
    }

    const webhookId = generateWebhookId();
    const startTime = Date.now();

    console.log(`🎣 Claude Agent Webhook received:`, {
      webhookId,
      type: payload.type,
      source: payload.source,
      timestamp: payload.timestamp,
      dataType: payload.data.type || 'unknown'
    });

    let result: any;
    let batchJobId: string | undefined;

    // Handle different webhook types
    switch (payload.type) {
      case 'batch_job':
        // Process batch job with Claude Agent
        batchJobId = rfpIntelligenceAgent.addBatchJob(
          payload.data.items,
          payload.data.jobType,
          payload.priority
        );
        
        result = {
          batchJobId,
          jobType: payload.data.jobType,
          itemCount: payload.data.items.length,
          status: 'queued'
        };
        break;

      case 'rfp_alert':
        // Process RFP alert with Claude Agent analysis
        result = await rfpIntelligenceAgent.processWebhook('rfp_alert', payload);
        break;

      case 'entity_alert':
        // Process entity alert with Claude Agent reasoning
        result = await rfpIntelligenceAgent.processWebhook('entity_alert', payload);
        break;

      case 'entity_enrichment':
        // Process entity enrichment with Claude Agent
        result = await rfpIntelligenceAgent.processWebhook('entity_enrichment', payload);
        break;

      case 'market_intelligence':
        // Process market intelligence request
        result = await rfpIntelligenceAgent.processWebhook('market_intelligence', payload);
        break;

      default:
        throw new Error(`Unknown webhook type: ${payload.type}`);
    }

    const processingTime = Date.now() - startTime;

    const response: WebhookResponse = {
      success: true,
      webhookId,
      processedAt: new Date().toISOString(),
      result,
      batchJobId
    };

    console.log(`✅ Claude Agent Webhook processed:`, {
      webhookId,
      type: payload.type,
      processingTime: `${processingTime}ms`,
      success: true
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Claude Agent Webhook error:', error);
    
    const errorResponse: WebhookResponse = {
      success: false,
      webhookId: generateWebhookId(),
      processedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'status':
        // Get batch processing status
        const status = rfpIntelligenceAgent.getBatchStatus();
        return NextResponse.json({
          success: true,
          data: status,
          timestamp: new Date().toISOString()
        });

      case 'health':
        // Health check for webhook system
        return NextResponse.json({
          success: true,
          status: 'healthy',
          agent: 'RFP Intelligence Agent',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          uptime: process.uptime()
        });

      default:
        return NextResponse.json({
          success: true,
          message: 'Claude Agent Webhook API',
          endpoints: {
            'POST /': 'Process webhook with Claude Agent analysis',
            'GET /?action=status': 'Get batch processing status',
            'GET /?action=health': 'Health check'
          },
          webhookTypes: [
            'rfp_alert - Analyze RFP opportunities',
            'entity_alert - Reason about entity changes', 
            'entity_enrichment - Enrich entity data',
            'market_intelligence - Analyze market context',
            'batch_job - Process bulk data analysis'
          ],
          timestamp: new Date().toISOString()
        });
    }

  } catch (error) {
    console.error('Claude Agent Webhook GET error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * 🔧 Generate unique webhook ID
 */
function generateWebhookId(): string {
  return `webhook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 📊 Example webhook payloads for testing
 */
// Example webhook payloads - moved to documentation
const exampleWebhookPayloads = {
  rfp_alert: {
    type: 'rfp_alert',
    data: {
      rfp: {
        id: 'rfp-123',
        title: 'Sports Technology Platform Implementation',
        organization: 'Major Sports League',
        description: 'Complete digital transformation of fan engagement platform',
        value: '$2.5M',
        deadline: '2024-03-15',
        category: 'Technology',
        source: 'procurement_portal',
        published: '2024-01-15'
      },
      entity: {
        id: 'entity-456',
        name: 'Major Sports League',
        type: 'company',
        industry: 'Sports',
        size: 'enterprise',
        location: 'New York, NY'
      }
    },
    priority: 'high',
    timestamp: new Date().toISOString(),
    source: 'procurement_monitor'
  },

  entity_alert: {
    type: 'entity_alert',
    data: {
      alert: {
        id: 'alert-789',
        type: 'promotion',
        entity: 'Sarah Johnson',
        description: 'promoted to VP of Digital Strategy',
        impact: 0,
        source: 'linkedin',
        timestamp: new Date().toISOString()
      },
      entity: {
        id: 'entity-101',
        name: 'Sarah Johnson',
        type: 'person',
        industry: 'Sports',
        company: 'Sports Tech Inc',
        location: 'Los Angeles, CA'
      }
    },
    priority: 'medium',
    timestamp: new Date().toISOString(),
    source: 'linkedin_monitor'
  },

  batch_job: {
    type: 'batch_job',
    data: {
      jobType: 'enrichment',
      items: [
        {
          id: 'company-1',
          name: 'Sports Tech Company',
          type: 'company',
          industry: 'Sports',
          size: 'large',
          location: 'Boston, MA'
        },
        {
          id: 'company-2', 
          name: 'Digital Sports Platform',
          type: 'company',
          industry: 'Sports',
          size: 'medium',
          location: 'Austin, TX'
        }
      ]
    },
    priority: 'medium',
    timestamp: new Date().toISOString(),
    source: 'batch_processor'
  }
};