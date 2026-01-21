import { NextRequest, NextResponse } from 'next/server';

// Import the same conversation tracking from the main route
let activeConversations: any = new Map();

// Configuration (should match the main route)
const CONCURRENCY_LIMITS = {
  maxConcurrentConversations: 8,
  maxPerUser: 3,
  maxQueueWaitTime: 30000,
  statusUpdateInterval: 2000
};

function getActiveConversationsCount() {
  const now = Date.now();
  const active = Array.from(activeConversations.values()).filter(
    (conv: any) => now - conv.startTime < CONCURRENCY_LIMITS.maxQueueWaitTime
  );
  
  const byType = active.reduce((acc: any, conv: any) => {
    acc[conv.type] = (acc[conv.type] || 0) + 1;
    return acc;
  }, {});
  
  const byUser = active.reduce((acc: any, conv: any) => {
    acc[conv.userId] = (acc[conv.userId] || 0) + 1;
    return acc;
  }, {});
  
  return {
    total: active.length,
    byType,
    byUser
  };
}

export async function GET(req: NextRequest) {
  try {
    const stats = getActiveConversationsCount();
    const capacity = CONCURRENCY_LIMITS.maxConcurrentConversations;
    const utilization = (stats.total / capacity) * 100;
    
    const systemStatus = {
      activeConversations: stats.total,
      capacity,
      utilization: Math.round(utilization),
      byType: stats.byType,
      byUser: stats.byUser,
      limits: CONCURRENCY_LIMITS,
      canStartNewConversation: stats.total < capacity,
      timestamp: new Date().toISOString(),
      status: utilization > 80 ? 'busy' : utilization > 50 ? 'moderate' : 'available'
    };
    
    return NextResponse.json(systemStatus);
  } catch (error) {
    console.error('Error getting system status:', error);
    return NextResponse.json(
      { error: 'Failed to get system status' },
      { status: 500 }
    );
  }
}