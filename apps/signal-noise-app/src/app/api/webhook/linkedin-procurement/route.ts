import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Simple webhook implementation
    const payload = await request.text();
    const webhookData = JSON.parse(payload);

    return NextResponse.json({
      status: 'success',
      message: 'LinkedIn procurement webhook processed',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('LinkedIn procurement webhook error:', error);
    return NextResponse.json(
      { error: 'Internal processing error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'LinkedIn Procurement Webhook Handler',
    timestamp: new Date().toISOString()
  });
}