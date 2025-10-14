import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-client';
import { cacheService } from '@/lib/supabase-cache';

/**
 * Real-time RFP streaming API for CopilotKit frontend
 * Provides Server-Sent Events (SSE) for live updates
 */

interface StreamingEvent {
  type: 'tier1_rfp_analyzed' | 'batch_enrichment_complete' | 'memory_updated' | 'system_status';
  timestamp: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  data: any;
}

interface ClientConnection {
  id: string;
  lastPing: Date;
  filters?: {
    tier?: 1 | 2 | 3;
    sport?: string;
    min_fit_score?: number;
  };
}

class RealtimeStreamingService {
  private connections: Map<string, ClientConnection> = new Map();
  private eventQueue: StreamingEvent[] = [];
  private isProcessing = false;

  /**
   * Register new client connection
   */
  registerConnection(request: NextRequest): string {
    const connectionId = this.generateConnectionId();
    const clientInfo: ClientConnection = {
      id: connectionId,
      lastPing: new Date(),
      filters: this.parseClientFilters(request)
    };

    this.connections.set(connectionId, clientInfo);
    console.log(`🔗 Client connected: ${connectionId}`);
    
    return connectionId;
  }

  /**
   * Remove client connection
   */
  removeConnection(connectionId: string): void {
    this.connections.delete(connectionId);
    console.log(`🔌 Client disconnected: ${connectionId}`);
  }

  /**
   * Add event to streaming queue
   */
  async addEvent(event: StreamingEvent): Promise<void> {
    this.eventQueue.push(event);
    
    // Keep queue size manageable
    if (this.eventQueue.length > 1000) {
      this.eventQueue = this.eventQueue.slice(-500);
    }

    console.log(`📨 Event queued: ${event.type} for ${event.data.organization || 'system'}`);
    
    // Trigger processing if not already running
    if (!this.isProcessing) {
      this.processEventQueue();
    }
  }

  /**
   * Create SSE response stream for client
   */
  createStreamingResponse(request: NextRequest, connectionId: string): Response {
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial connection event
          const initEvent = {
            type: 'connection_established',
            connection_id: connectionId,
            timestamp: new Date().toISOString(),
            message: 'Connected to RFP intelligence stream'
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(initEvent)}\n\n`));

          // Send recent events
          const recentEvents = await this.getRecentEvents();
          for (const event of recentEvents) {
            if (this.matchesClientFilters(event, this.connections.get(connectionId)?.filters)) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
            }
          }

          // Send periodic keep-alive pings
          const pingInterval = setInterval(() => {
            const ping = {
              type: 'ping',
              timestamp: new Date().toISOString(),
              connection_id: connectionId
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(ping)}\n\n`));
            
            // Update last ping for connection
            const client = this.connections.get(connectionId);
            if (client) {
              client.lastPing = new Date();
            }
          }, 30000); // 30 seconds

          // Clean up on disconnect
          request.signal.addEventListener('abort', () => {
            clearInterval(pingInterval);
            this.removeConnection(connectionId);
            controller.close();
          });

        } catch (error) {
          console.error('Stream initialization error:', error);
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    });
  }

  /**
   * Process queued events and broadcast to clients
   */
  private async processEventQueue(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    try {
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift();
        if (!event) continue;

        // Broadcast to matching clients
        await this.broadcastEvent(event);
        
        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('Event queue processing error:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Broadcast event to all matching connected clients
   */
  private async broadcastEvent(event: StreamingEvent): Promise<void> {
    const encoder = new TextEncoder();
    
    for (const [connectionId, client] of this.connections.entries()) {
      if (this.matchesClientFilters(event, client.filters)) {
        try {
          // In a real implementation, you'd use WebSocket or SSE broadcasting
          // For now, we'll store events that clients can poll
          await this.storeEventForClient(connectionId, event);
        } catch (error) {
          console.error(`Failed to broadcast to client ${connectionId}:`, error);
        }
      }
    }
  }

  /**
   * Store event for client retrieval (SSE implementation)
   */
  private async storeEventForClient(connectionId: string, event: StreamingEvent): Promise<void> {
    try {
      await supabase
        .from('client_events')
        .insert({
          connection_id: connectionId,
          event_data: event,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Failed to store client event:', error);
    }
  }

  /**
   * Get recent events for new connections
   */
  private async getRecentEvents(): Promise<StreamingEvent[]> {
    try {
      const { data, error } = await supabase
        .from('event_stream')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Failed to fetch recent events:', error);
        return [];
      }

      return data?.map(item => item.event_data) || [];

    } catch (error) {
      console.error('Recent events query failed:', error);
      return [];
    }
  }

  /**
   * Parse client filters from request
   */
  private parseClientFilters(request: NextRequest): any {
    const { searchParams } = new URL(request.url);
    
    return {
      tier: searchParams.get('tier') ? parseInt(searchParams.get('tier')!) as 1 | 2 | 3 : undefined,
      sport: searchParams.get('sport') || undefined,
      min_fit_score: searchParams.get('min_fit_score') ? parseInt(searchParams.get('min_fit_score')!) : undefined
    };
  }

  /**
   * Check if event matches client filters
   */
  private matchesClientFilters(event: StreamingEvent, filters?: any): boolean {
    if (!filters) return true;

    // Filter by tier
    if (filters.tier && event.data.entity_tier !== filters.tier) {
      return false;
    }

    // Filter by sport
    if (filters.sport && event.data.sport !== filters.sport) {
      return false;
    }

    // Filter by minimum fit score
    if (filters.min_fit_score && event.data.fit_score < filters.min_fit_score) {
      return false;
    }

    return true;
  }

  /**
   * Generate unique connection ID
   */
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up stale connections
   */
  cleanupStaleConnections(): void {
    const now = new Date();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [connectionId, client] of this.connections.entries()) {
      if (now.getTime() - client.lastPing.getTime() > staleThreshold) {
        this.connections.delete(connectionId);
        console.log(`🧹 Cleaned up stale connection: ${connectionId}`);
      }
    }
  }
}

// Singleton instance
const streamingService = new RealtimeStreamingService();

// Periodic cleanup
setInterval(() => {
  streamingService.cleanupStaleConnections();
}, 60000); // Every minute

/**
 * Handle incoming RFP analysis events
 */
export async function POST(request: NextRequest) {
  try {
    const event = await request.json();
    
    // Validate event structure
    const streamingEvent: StreamingEvent = {
      type: event.type || 'system_status',
      timestamp: event.timestamp || new Date().toISOString(),
      priority: event.priority || 'MEDIUM',
      data: event
    };

    // Add to streaming queue
    await streamingService.addEvent(streamingEvent);

    // Store persistent event record
    await supabase
      .from('event_stream')
      .insert({
        event_data: streamingEvent,
        event_type: streamingEvent.type,
        priority: streamingEvent.priority,
        created_at: new Date().toISOString()
      });

    return new Response(JSON.stringify({
      status: 'event_queued',
      event_id: `${streamingEvent.type}_${Date.now()}`
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Event streaming POST error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to process event' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle SSE client connections
 */
export async function GET(request: NextRequest) {
  try {
    const connectionId = streamingService.registerConnection(request);
    
    console.log(`🌐 SSE connection established: ${connectionId}`);
    
    return streamingService.createStreamingResponse(request, connectionId);

  } catch (error) {
    console.error('SSE connection error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to establish connection' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}