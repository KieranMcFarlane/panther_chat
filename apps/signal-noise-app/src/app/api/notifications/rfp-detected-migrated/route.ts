import { NextRequest, NextResponse } from 'next/server';
import { RFPNotificationProcessor } from '@/services/email/rfp-notification-processor';
import { RFPDNotificationPayload } from '@/services/email/types';

/**
 * Migrated RFP Detection Notification System
 * 
 * This endpoint now uses the centralized email service located in:
 * src/services/email/
 * 
 * The Resend integration and RFP notification functionality has been
 * moved from the original location to provide better organization
 * and reusability across the application.
 */

export async function POST(request: NextRequest) {
  try {
    const payload: RFPDNotificationPayload = await request.json();

    // Validate payload
    if (!payload.organization || !payload.fit_score) {
      return NextResponse.json(
        { error: 'Invalid payload - missing required fields' },
        { status: 400 }
      );
    }

    // Process notification using migrated service
    const processor = new RFPNotificationProcessor();
    const results = await processor.processRFPNotification(payload);

    return NextResponse.json({
      status: 'success',
      message: `RFP notification processed for ${payload.organization}`,
      results,
      service: 'migrated-email-service'
    });

  } catch (error) {
    console.error('RFP notification handler error:', error);
    return NextResponse.json(
      { error: 'Internal processing error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'Migrated RFP Detection Notification System',
    location: 'src/services/email/',
    timestamp: new Date().toISOString(),
    features: [
      'Real-time email alerts via Resend',
      'Slack integration',
      'Dashboard updates',
      'Prioritized notifications',
      'Centralized email service architecture'
    ]
  });
}