import { NextRequest } from "next/server";
import { query } from "@anthropic-ai/claude-agent-sdk";

/**
 * Real-time RFP Notifications Stream
 * Provides Server-Sent Events (SSE) for live RFP alerts and analysis updates
 */

interface NotificationClient {
  id: string;
  lastActivity: Date;
  filters: {
    minFitScore?: number;
    sportTypes?: string[];
    urgencyLevels?: string[];
    organizations?: string[];
  };
}

interface RFPNotification {
  id: string;
  type: 'rfp_detected' | 'analysis_started' | 'analysis_progress' | 'analysis_complete' | 'error';
  timestamp: string;
  data: any;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

// In-memory store for connected clients (in production, use Redis or similar)
const connectedClients = new Map<string, NotificationClient>();

// Notification queue
const notificationQueue: RFPNotification[] = [];
let notificationId = 1;

export async function GET(req: NextRequest) {
  const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`🔔 Notification client connected: ${clientId}`);
  
  // Register client
  connectedClients.set(clientId, {
    id: clientId,
    lastActivity: new Date(),
    filters: {
      minFitScore: 60,
      sportTypes: ['football', 'rugby', 'cricket'],
      urgencyLevels: ['HIGH', 'CRITICAL']
    }
  });
  
  const encoder = new TextEncoder();
  const heartbeatInterval = 30000; // 30 seconds
  
  return new Response(
    new ReadableStream({
      async start(controller) {
        try {
          // Send initial connection confirmation
          const welcomeChunk = {
            type: 'connection_established',
            clientId: clientId,
            timestamp: new Date().toISOString(),
            serverTime: new Date().toISOString(),
            activeClients: connectedClients.size
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(welcomeChunk)}\n\n`));
          
          // Send any queued notifications
          const recentNotifications = notificationQueue.slice(-10);
          for (const notification of recentNotifications) {
            if (this.matchesClientFilters(notification, connectedClients.get(clientId)!)) {
              const chunk = {
                type: 'historical_notification',
                notification: notification
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
            }
          }
          
          // Start heartbeat
          const heartbeat = setInterval(() => {
            try {
              const heartbeatChunk = {
                type: 'heartbeat',
                timestamp: new Date().toISOString(),
                clientId: clientId
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(heartbeatChunk)}\n\n`));
              
              // Update client activity
              const client = connectedClients.get(clientId);
              if (client) {
                client.lastActivity = new Date();
              }
            } catch (error) {
              clearInterval(heartbeat);
              controller.close();
            }
          }, heartbeatInterval);
          
          // Handle client disconnect
          req.signal.addEventListener('abort', () => {
            clearInterval(heartbeat);
            connectedClients.delete(clientId);
            console.log(`🔌 Notification client disconnected: ${clientId}`);
          });
          
          // Keep connection alive for periodic notifications
          const notificationCheck = setInterval(() => {
            const client = connectedClients.get(clientId);
            if (!client) {
              clearInterval(notificationCheck);
              clearInterval(heartbeat);
              controller.close();
              return;
            }
            
            // Check for new notifications (in production, this would be from a message queue)
            // For now, simulate periodic updates
            
          }, 5000);
          
        } catch (error) {
          console.error(`❌ Notification stream error for ${clientId}:`, error);
          connectedClients.delete(clientId);
          controller.close();
        }
      }
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    const notificationData = await req.json();
    console.log('📨 Received notification data:', notificationData.type);
    
    // Create structured notification
    const notification: RFPNotification = {
      id: `notif_${notificationId++}`,
      type: notificationData.type,
      timestamp: new Date().toISOString(),
      data: notificationData.data,
      priority: notificationData.priority || 'MEDIUM'
    };
    
    // Add to queue
    notificationQueue.push(notification);
    
    // Keep queue size manageable
    if (notificationQueue.length > 100) {
      notificationQueue.splice(0, notificationQueue.length - 100);
    }
    
    // Broadcast to matching connected clients
    const broadcastPromises = [];
    
    for (const [clientId, client] of connectedClients.entries()) {
      if (this.matchesClientFilters(notification, client)) {
        broadcastPromises.push(
          this.broadcastToClient(clientId, notification)
        );
      }
    }
    
    await Promise.allSettled(broadcastPromises);
    
    return new Response(JSON.stringify({
      success: true,
      notificationId: notification.id,
      broadcastCount: broadcastPromises.length,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ Notification POST error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to process notification',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Helper function to check if notification matches client filters
function matchesClientFilters(notification: RFPNotification, client: NotificationClient): boolean {
  const { data } = notification;
  const { filters } = client;
  
  // Filter by fit score
  if (filters.minFitScore && data.fit_score && data.fit_score < filters.minFitScore) {
    return false;
  }
  
  // Filter by sport type
  if (filters.sportTypes && filters.sportTypes.length > 0) {
    if (data.sport_type && !filters.sportTypes.includes(data.sport_type.toLowerCase())) {
      return false;
    }
  }
  
  // Filter by urgency level
  if (filters.urgencyLevels && filters.urgencyLevels.length > 0) {
    if (data.urgency_level && !filters.urgencyLevels.includes(data.urgency_level)) {
      return false;
    }
  }
  
  // Filter by organization
  if (filters.organizations && filters.organizations.length > 0) {
    if (data.organization_name && !filters.organizations.some((org: string) => 
      data.organization_name.toLowerCase().includes(org.toLowerCase())
    )) {
      return false;
    }
  }
  
  return true;
}

// Helper function to broadcast to specific client
async function broadcastToClient(clientId: string, notification: RFPNotification): Promise<void> {
  try {
    const client = connectedClients.get(clientId);
    if (!client) {
      return;
    }
    
    const encoder = new TextEncoder();
    const chunk = {
      type: 'notification',
      notification: notification,
      clientId: clientId
    };
    
    // In a real implementation, you would store the controller for each client
    // For now, this is a placeholder that would be replaced by actual SSE broadcasting
    
  } catch (error) {
    console.error(`Failed to broadcast to client ${clientId}:`, error);
    connectedClients.delete(clientId);
  }
}

// Support OPTIONS requests for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}