/**
 * API endpoint to stop a running A2A full scan
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, reason = 'User requested stop' } = body;

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Session ID is required to stop a scan'
      }, { status: 400 });
    }

    console.log(`🛑 Stop request received for session: ${sessionId}`);
    console.log(`   Reason: ${reason}`);

    // Update progress to mark as stopped
    const progressResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3005'}/api/a2a-full-scan/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        status: 'stopped',
        endTime: new Date().toISOString(),
        currentEntity: 'Scan stopped by user request',
        errors: [`Scan stopped: ${reason}`]
      })
    });

    if (!progressResponse.ok) {
      const errorText = await progressResponse.text();
      console.error('Failed to update progress for stop:', errorText);
    }

      console.log(`🛑 A2A Full Scan Stopped: ${sessionId} - ${reason}`);

    console.log(`✅ Successfully stopped A2A scan: ${sessionId}`);

    return NextResponse.json({
      success: true,
      message: 'A2A scan stopped successfully',
      sessionId,
      stoppedAt: new Date().toISOString(),
      reason
    });

  } catch (error) {
    console.error('❌ Error stopping A2A scan:', error);
    
    console.error(`❌ Failed to Stop A2A Scan: ${error.message}`);

    return NextResponse.json({
      success: false,
      error: 'Failed to stop A2A scan',
      details: error.message
    }, { status: 500 });
  }
}

// GET endpoint for checking stop status
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Stop endpoint is available',
    usage: 'POST with sessionId to stop a running scan'
  });
}