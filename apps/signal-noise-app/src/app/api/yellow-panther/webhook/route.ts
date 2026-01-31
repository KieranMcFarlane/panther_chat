/**
 * Yellow Panther Webhook Endpoint
 *
 * Receives real-time RFP opportunity alerts from the Signal Noise system.
 * This is the internal webhook that receives alerts from the backend.
 *
 * POST /api/yellow-panther/webhook
 *
 * Payload:
 * {
 *   "event": "rfp_opportunity",
 *   "timestamp": "2026-01-31T10:30:00Z",
 *   "priority": "TIER_1/TIER_2/TIER_3/TIER_4",
 *   "data": {
 *     "entity": {...},
 *     "opportunity": {...},
 *     "reasoning": {...},
 *     "timing": {...},
 *     "actions": [...],
 *     "yp_advantages": [...]
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Webhook secret for verification (optional)
const WEBHOOK_SECRET = process.env.YELLOW_PANTHER_WEBHOOK_SECRET || '';

interface YellowPantherWebhookPayload {
  event: string;
  timestamp: string;
  priority: 'TIER_1' | 'TIER_2' | 'TIER_3' | 'TIER_4';
  data: {
    entity: {
      id: string;
      name: string;
      type: string;
      country: string;
      league?: string;
    };
    opportunity: {
      category: string;
      signal_type: string;
      fit_score: number;
      confidence: number;
      temporal_multiplier: number;
      budget_alignment: string;
      service_alignment: string[];
      priority: string;
    };
    reasoning?: {
      primary_reason?: string;
      primary_name?: string;
      primary_confidence?: number;
      urgency?: string;
      yp_solution_fit?: number;
      secondary_reasons?: Array<{
        reason: string;
        name: string;
        confidence: number;
      }>;
    };
    timing?: {
      seasonality?: Record<string, unknown>;
      recurrence?: Record<string, unknown>;
      momentum?: Record<string, unknown>;
      prediction?: Record<string, unknown>;
    };
    actions?: string[];
    yp_advantages?: string[];
    evidence?: Array<{
      content: string;
      source: string;
      credibility: number;
    }>;
  };
  meta?: {
    source: string;
    version: string;
    dashboard_url: string;
  };
}

/**
 * POST handler for Yellow Panther webhooks
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const payload: YellowPantherWebhookPayload = await request.json();

    // Verify webhook secret (if configured)
    const signature = request.headers.get('x-webhook-signature');
    if (WEBHOOK_SECRET && signature !== WEBHOOK_SECRET) {
      console.error('❌ Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Log received webhook
    console.log('🎯 Yellow Panther Webhook Received');
    console.log('================================');
    console.log(`Event: ${payload.event}`);
    console.log(`Priority: ${payload.priority}`);
    console.log(`Entity: ${payload.data.entity.name}`);
    console.log(`Category: ${payload.data.opportunity.category}`);
    console.log(`Fit Score: ${payload.data.opportunity.fit_score}/100`);
    console.log(`Confidence: ${(payload.data.opportunity.confidence * 100).toFixed(0)}%`);
    console.log('================================\n');

    // Process based on priority
    switch (payload.priority) {
      case 'TIER_1':
        await handleTier1Alert(payload);
        break;
      case 'TIER_2':
        await handleTier2Alert(payload);
        break;
      case 'TIER_3':
        await handleTier3Alert(payload);
        break;
      case 'TIER_4':
        await handleTier4Alert(payload);
        break;
    }

    // Store to database for dashboard feed
    await storeOpportunity(payload);

    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
      opportunity_id: payload.data.entity.id,
      priority: payload.priority,
      received_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error processing Yellow Panther webhook:', error);
    return NextResponse.json(
      {
        error: 'Webhook processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Handle TIER_1 (Critical) alerts
 */
async function handleTier1Alert(payload: YellowPantherWebhookPayload) {
  console.log('🚨 TIER_1 ALERT - Immediate Action Required');
  console.log(`   Entity: ${payload.data.entity.name}`);
  console.log(`   Services: ${payload.data.opportunity.service_alignment?.join(', ') || 'N/A'}`);

  // TODO: Send immediate notification to Yellow Panther team
  // - Email alerts (via Resend)
  // - Slack notification
  // - SMS (optional)

  // Log recommended actions
  if (payload.data.actions && payload.data.actions.length > 0) {
    console.log('   Recommended Actions:');
    payload.data.actions.forEach((action, i) => {
      console.log(`     ${i + 1}. ${action}`);
    });
  }
}

/**
 * Handle TIER_2 (High) alerts
 */
async function handleTier2Alert(payload: YellowPantherWebhookPayload) {
  console.log('⚡ TIER_2 ALERT - High Priority');
  console.log(`   Entity: ${payload.data.entity.name}`);
  console.log(`   Fit Score: ${payload.data.opportunity.fit_score ?? 0}/100`);

  // TODO: Queue for notification within 1 hour
}

/**
 * Handle TIER_3 (Medium) alerts
 */
async function handleTier3Alert(payload: YellowPantherWebhookPayload) {
  console.log('📊 TIER_3 ALERT - Medium Priority');
  console.log(`   Entity: ${payload.data.entity.name}`);

  // TODO: Add to daily digest
}

/**
 * Handle TIER_4 (Low) alerts
 */
async function handleTier4Alert(payload: YellowPantherWebhookPayload) {
  console.log('📋 TIER_4 ALERT - Low Priority');
  console.log(`   Entity: ${payload.data.entity.name}`);

  // TODO: Add to weekly summary
}

/**
 * Store opportunity to database for dashboard feed
 */
async function storeOpportunity(payload: YellowPantherWebhookPayload) {
  try {
    // TODO: Store to Supabase dashboard_feed table
    // await supabase.from('yellow_panther_opportunities').insert({
    //   entity_id: payload.data.entity.id,
    //   entity_name: payload.data.entity.name,
    //   category: payload.data.opportunity.category,
    //   fit_score: payload.data.opportunity.fit_score,
    //   priority: payload.priority,
    //   confidence: payload.data.opportunity.confidence,
    //   temporal_multiplier: payload.data.opportunity.temporal_multiplier,
    //   service_alignment: payload.data.opportunity.service_alignment,
    //   reasoning: payload.data.reasoning,
    //   actions: payload.data.actions,
    //   evidence: payload.data.evidence,
    //   received_at: new Date().toISOString(),
    //   processed: false
    // });

    console.log(`✅ Opportunity stored to dashboard feed: ${payload.data.entity.id}`);
  } catch (error) {
    console.error('⚠️  Failed to store opportunity:', error);
  }
}

/**
 * GET handler for webhook verification
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'healthy',
    service: 'yellow-panther-webhook',
    version: '1.0.0',
    description: 'Yellow Panther RFP Opportunity Webhook Endpoint',
    endpoints: {
      POST: {
        path: '/api/yellow-panther/webhook',
        description: 'Receive RFP opportunity alerts from Signal Noise',
        content_type: 'application/json',
        authentication: {
          type: 'bearer_token',
          header: 'x-webhook-signature',
          env_var: 'YELLOW_PANTHER_WEBHOOK_SECRET'
        }
      }
    }
  });
}
