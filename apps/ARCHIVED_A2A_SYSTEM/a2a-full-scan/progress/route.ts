/**
 * Simple progress tracking endpoint for A2A full scan
 */

import { NextRequest, NextResponse } from 'next/server';

// Global progress tracking - track multiple sessions
let globalProgress = {
  totalEntities: 0,
  processedEntities: 0,
  currentBatch: 0,
  totalBatches: 0,
  opportunitiesFound: 0,
  startTime: null as string | null,
  currentEntity: null as string | null,
  status: 'idle',
  sessionId: null as string | null,
  errors: [] as string[]
};

// Store multiple active sessions
const activeSessions = new Map<string, any>();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  // Return specific session if requested, otherwise return most active session
  let progressToReturn = globalProgress;
  if (sessionId && activeSessions.has(sessionId)) {
    progressToReturn = activeSessions.get(sessionId);
  } else if (activeSessions.size > 0) {
    // Get the most recently active session
    const latestSession = Array.from(activeSessions.entries())
      .sort((a, b) => new Date(b[1].startTime || 0).getTime() - new Date(a[1].startTime || 0).getTime())[0];
    if (latestSession) {
      progressToReturn = latestSession[1];
    }
  }

  return NextResponse.json({
    success: true,
    progress: progressToReturn,
    sessionId,
    isRunning: progressToReturn.status === 'running',
    activeSessionsCount: activeSessions.size
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, totalEntities, status, action } = body;

    // Handle reset action
    if (action === 'reset') {
      console.log('🔄 Resetting all progress due to new scan start');
      activeSessions.clear();
      globalProgress = {
        totalEntities: 0,
        processedEntities: 0,
        currentBatch: 0,
        totalBatches: 0,
        opportunitiesFound: 0,
        startTime: null,
        currentEntity: null,
        status: 'idle',
        sessionId: null,
        errors: []
      };
      
      return NextResponse.json({
        success: true,
        message: 'Progress reset successfully',
        progress: globalProgress
      });
    }

    if (sessionId) {
      // Create or update session-specific progress
      if (!activeSessions.has(sessionId)) {
        // New session - create session-specific progress
        const sessionProgress = {
          ...body,
          sessionId: sessionId,
          processedEntities: body.processedEntities || 0,
          opportunitiesFound: body.opportunitiesFound || 0
        };
        activeSessions.set(sessionId, sessionProgress);
        
        // Also update global progress if this is the only session
        if (activeSessions.size === 1) {
          globalProgress = sessionProgress;
        }

        console.log(`📊 New session created: ${sessionId} - ${sessionProgress.processedEntities}/${sessionProgress.totalEntities} entities processed, ${sessionProgress.opportunitiesFound} opportunities found`);

        return NextResponse.json({
          success: true,
          message: 'New session created successfully',
          progress: sessionProgress
        });
      } else {
        // Existing session - update session-specific progress
        const sessionProgress = activeSessions.get(sessionId);
        const updatedProgress = {
          ...sessionProgress,
          ...body
        };
        activeSessions.set(sessionId, updatedProgress);

        // Clean up completed sessions
        if (updatedProgress.status === 'completed' || updatedProgress.status === 'error') {
          setTimeout(() => cleanupCompletedSessions(), 5000);
        }

        // Update global progress if this is the most recent session
        const latestSession = Array.from(activeSessions.entries())
          .sort((a, b) => new Date(b[1].startTime || 0).getTime() - new Date(a[1].startTime || 0).getTime())[0];
        if (latestSession && latestSession[0] === sessionId) {
          globalProgress = updatedProgress;
        }

        console.log(`📊 Session update: ${sessionId} - ${updatedProgress.processedEntities}/${updatedProgress.totalEntities} entities processed, ${updatedProgress.opportunitiesFound} opportunities found`);

        return NextResponse.json({
          success: true,
          message: 'Session progress updated successfully',
          progress: updatedProgress
        });
      }
    } else {
      return NextResponse.json({
        success: false,
        error: 'Session ID required',
        progress: globalProgress
      }, { status: 400 });
    }

    } catch (error) {
    console.error('Error updating progress:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update progress',
      progress: globalProgress
    }, { status: 500 });
  }
}

// Helper function to clean up completed sessions
function cleanupCompletedSessions() {
  const now = Date.now();
  const completedSessions = Array.from(activeSessions.entries()).filter(([id, session]) => {
    const isOld = now - new Date(session.endTime || session.startTime).getTime() > 300000; // 5 minutes
    return session.status === 'completed' || session.status === 'error' || isOld;
  });

  completedSessions.forEach(([id]) => {
    activeSessions.delete(id);
    console.log(`🧹 Cleaned up session: ${id}`);
  });

  // Update global progress if there are still active sessions
  if (activeSessions.size > 0) {
    const latestSession = Array.from(activeSessions.entries())
      .sort((a, b) => new Date(b[1].startTime || 0).getTime() - new Date(a[1].startTime || 0).getTime())[0];
    if (latestSession) {
      globalProgress = latestSession[1];
    }
  } else {
    // Reset global progress if no active sessions
    globalProgress = {
      totalEntities: 0,
      processedEntities: 0,
      currentBatch: 0,
      totalBatches: 0,
      opportunitiesFound: 0,
      startTime: null,
      currentEntity: null,
      status: 'idle',
      sessionId: null,
      errors: []
    };
  }
}