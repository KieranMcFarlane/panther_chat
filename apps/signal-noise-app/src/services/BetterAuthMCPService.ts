'use client';

import { useThreads } from '@/contexts/ThreadContext';
import { 
  TeamsStore, 
  Entity, 
  Insight, 
  Resource, 
  Connection, 
  ConversationSummary,
  ThreadReference 
} from '@/types/thread-system';

interface BetterAuthMCPSession {
  userId: string;
  sessionId: string;
  sharedMemory: {
    entities: Entity[];
    insights: Insight[];
    resources: Resource[];
    connections: Connection[];
    conversations: ConversationSummary[];
    threadReferences: ThreadReference[];
  };
  lastSynced: Date;
}

export class BetterAuthMCPService {
  private currentSession: BetterAuthMCPSession | null = null;
  private syncListeners: ((session: BetterAuthMCPSession) => void)[] = [];

  constructor() {
    this.initializeService();
  }

  private async initializeService() {
    // Initialize Better Auth MCP connection
    try {
      // In real implementation, this would connect to Better Auth MCP server
      console.log('Better Auth MCP Service initialized for shared memory');
      
      // Start automatic sync
      this.startAutoSync();
    } catch (error) {
      console.error('Failed to initialize Better Auth MCP service:', error);
    }
  }

  // Initialize session for a user
  async initializeSession(userId: string, threadId: string): Promise<BetterAuthMCPSession> {
    try {
      // Create or get Better Auth MCP session
      const sessionData = await this.callBetterAuthMCP('create_session', {
        userId,
        threadId,
        purpose: 'shared_memory',
        permissions: ['read', 'write', 'share']
      });

      this.currentSession = {
        userId: sessionData.userId,
        sessionId: sessionData.sessionId,
        sharedMemory: {
          entities: [],
          insights: [],
          resources: [],
          connections: [],
          conversations: [],
          threadReferences: []
        },
        lastSynced: new Date()
      };

      // Load existing shared memory from Better Auth MCP
      await this.loadSharedMemory();
      
      return this.currentSession;
    } catch (error) {
      console.error('Failed to initialize Better Auth MCP session:', error);
      throw error;
    }
  }

  // Load shared memory from Better Auth MCP
  private async loadSharedMemory(): Promise<void> {
    if (!this.currentSession) return;

    try {
      const sharedData = await this.callBetterAuthMCP('get_shared_memory', {
        sessionId: this.currentSession.sessionId,
        userId: this.currentSession.userId
      });

      if (sharedData) {
        this.currentSession.sharedMemory = {
          entities: sharedData.entities || [],
          insights: sharedData.insights || [],
          resources: sharedData.resources || [],
          connections: sharedData.connections || [],
          conversations: sharedData.conversations || [],
          threadReferences: sharedData.threadReferences || []
        };
        this.currentSession.lastSynced = new Date();
      }
    } catch (error) {
      console.error('Failed to load shared memory:', error);
    }
  }

  // Sync shared memory to Better Auth MCP
  async syncSharedMemory(): Promise<void> {
    if (!this.currentSession) return;

    try {
      await this.callBetterAuthMCP('update_shared_memory', {
        sessionId: this.currentSession.sessionId,
        userId: this.currentSession.userId,
        sharedMemory: this.currentSession.sharedMemory
      });

      this.currentSession.lastSynced = new Date();
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to sync shared memory:', error);
    }
  }

  // Add entity to shared memory
  async addEntityToSharedMemory(
    entity: Omit<Entity, 'id' | 'discoveredBy' | 'lastUpdated'>, 
    threadId: string
  ): Promise<Entity> {
    if (!this.currentSession) {
      throw new Error('No active Better Auth MCP session');
    }

    const newEntity: Entity = {
      ...entity,
      id: `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      discoveredBy: [threadId],
      lastUpdated: new Date()
    };

    // Check if entity already exists in shared memory
    const existingEntity = this.findEntityInSharedMemory(entity.name);
    if (existingEntity) {
      // Update existing entity
      existingEntity.discoveredBy = [...new Set([...existingEntity.discoveredBy, threadId])];
      existingEntity.lastUpdated = new Date();
      if (entity.confidence > existingEntity.confidence) {
        existingEntity.confidence = entity.confidence;
      }
      existingEntity.properties = { ...existingEntity.properties, ...entity.properties };
      existingEntity.sources = [...new Set([...existingEntity.sources, ...entity.sources])];
      
      await this.syncSharedMemory();
      return existingEntity;
    }

    // Add new entity to shared memory
    this.currentSession.sharedMemory.entities.push(newEntity);
    
    // Log to Better Auth MCP for audit trail
    await this.callBetterAuthMCP('log_shared_memory_update', {
      sessionId: this.currentSession.sessionId,
      action: 'add_entity',
      entityId: newEntity.id,
      threadId,
      timestamp: new Date().toISOString()
    });

    await this.syncSharedMemory();
    return newEntity;
  }

  // Add insight to shared memory
  async addInsightToSharedMemory(
    insight: Omit<Insight, 'id' | 'discoveredBy' | 'createdAt'>, 
    threadId: string
  ): Promise<Insight> {
    if (!this.currentSession) {
      throw new Error('No active Better Auth MCP session');
    }

    const newInsight: Insight = {
      ...insight,
      id: `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      discoveredBy: [threadId],
      createdAt: new Date()
    };

    // Check for duplicate insights
    const isDuplicate = this.currentSession.sharedMemory.insights.some(i => 
      i.title.toLowerCase() === insight.title.toLowerCase() && 
      i.content.substring(0, 100) === insight.content.substring(0, 100)
    );

    if (!isDuplicate) {
      this.currentSession.sharedMemory.insights.push(newInsight);
      
      // Log to Better Auth MCP
      await this.callBetterAuthMCP('log_shared_memory_update', {
        sessionId: this.currentSession.sessionId,
        action: 'add_insight',
        insightId: newInsight.id,
        threadId,
        timestamp: new Date().toISOString()
      });

      await this.syncSharedMemory();
    }

    return newInsight;
  }

  // Add resource to shared memory
  async addResourceToSharedMemory(
    resource: Omit<Resource, 'id' | 'discoveredBy' | 'createdAt'>, 
    threadId: string
  ): Promise<Resource> {
    if (!this.currentSession) {
      throw new Error('No active Better Auth MCP session');
    }

    const newResource: Resource = {
      ...resource,
      id: `resource_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      discoveredBy: [threadId],
      createdAt: new Date()
    };

    // Check for duplicate resources
    const existingResource = this.currentSession.sharedMemory.resources.find(r => r.url === resource.url);
    if (existingResource) {
      existingResource.discoveredBy = [...new Set([...existingResource.discoveredBy, threadId])];
      await this.syncSharedMemory();
      return existingResource;
    }

    this.currentSession.sharedMemory.resources.push(newResource);
    
    // Log to Better Auth MCP
    await this.callBetterAuthMCP('log_shared_memory_update', {
      sessionId: this.currentSession.sessionId,
      action: 'add_resource',
      resourceId: newResource.id,
      threadId,
      timestamp: new Date().toISOString()
    });

    await this.syncSharedMemory();
    return newResource;
  }

  // Add connection to shared memory
  async addConnectionToSharedMemory(
    connection: Omit<Connection, 'id' | 'discoveredBy' | 'createdAt'>, 
    threadId: string
  ): Promise<Connection> {
    if (!this.currentSession) {
      throw new Error('No active Better Auth MCP session');
    }

    const newConnection: Connection = {
      ...connection,
      id: `connection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      discoveredBy: [threadId],
      createdAt: new Date()
    };

    // Check for duplicate connections
    const existingConnection = this.currentSession.sharedMemory.connections.find(c => 
      (c.fromEntity === connection.fromEntity && c.toEntity === connection.toEntity) ||
      (c.fromEntity === connection.toEntity && c.toEntity === connection.fromEntity)
    );

    if (existingConnection) {
      existingConnection.discoveredBy = [...new Set([...existingConnection.discoveredBy, threadId])];
      existingConnection.strength = Math.max(existingConnection.strength, connection.strength);
      await this.syncSharedMemory();
      return existingConnection;
    }

    this.currentSession.sharedMemory.connections.push(newConnection);
    
    // Log to Better Auth MCP
    await this.callBetterAuthMCP('log_shared_memory_update', {
      sessionId: this.currentSession.sessionId,
      action: 'add_connection',
      connectionId: newConnection.id,
      threadId,
      timestamp: new Date().toISOString()
    });

    await this.syncSharedMemory();
    return newConnection;
  }

  // Add conversation summary to shared memory
  async addConversationSummaryToSharedMemory(
    summary: Omit<ConversationSummary, 'id'>
  ): Promise<ConversationSummary> {
    if (!this.currentSession) {
      throw new Error('No active Better Auth MCP session');
    }

    const newSummary: ConversationSummary = {
      ...summary,
      id: `summary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    this.currentSession.sharedMemory.conversations.push(newSummary);
    
    // Log to Better Auth MCP
    await this.callBetterAuthMCP('log_shared_memory_update', {
      sessionId: this.currentSession.sessionId,
      action: 'add_conversation_summary',
      summaryId: newSummary.id,
      threadId: summary.threadId,
      timestamp: new Date().toISOString()
    });

    await this.syncSharedMemory();
    return newSummary;
  }

  // Share memory across threads/users
  async shareMemoryWithThread(sourceThreadId: string, targetThreadId: string, shareType: 'entities' | 'insights' | 'all'): Promise<void> {
    if (!this.currentSession) return;

    try {
      // Create thread reference
      const threadReference: ThreadReference = {
        threadId: sourceThreadId,
        referencedBy: [targetThreadId],
        context: `Shared via Better Auth MCP - ${shareType}`,
        strength: 0.8
      };

      this.currentSession.sharedMemory.threadReferences.push(threadReference);

      // Log sharing action to Better Auth MCP
      await this.callBetterAuthMCP('log_memory_sharing', {
        sessionId: this.currentSession.sessionId,
        sourceThreadId,
        targetThreadId,
        shareType,
        timestamp: new Date().toISOString()
      });

      await this.syncSharedMemory();
    } catch (error) {
      console.error('Failed to share memory:', error);
      throw error;
    }
  }

  // Search shared memory
  searchSharedMemory(query: string, type?: 'entities' | 'insights' | 'resources'): any[] {
    if (!this.currentSession) return [];

    const lowerQuery = query.toLowerCase();
    const results: any[] = [];

    if (!type || type === 'entities') {
      const entityResults = this.currentSession.sharedMemory.entities.filter(e => 
        e.name.toLowerCase().includes(lowerQuery) ||
        e.type.toLowerCase().includes(lowerQuery) ||
        Object.values(e.properties).some(value => 
          String(value).toLowerCase().includes(lowerQuery)
        )
      );
      results.push(...entityResults.map(e => ({ ...e, resultType: 'entity' })));
    }

    if (!type || type === 'insights') {
      const insightResults = this.currentSession.sharedMemory.insights.filter(i => 
        i.title.toLowerCase().includes(lowerQuery) ||
        i.content.toLowerCase().includes(lowerQuery) ||
        i.category.toLowerCase().includes(lowerQuery) ||
        i.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
      );
      results.push(...insightResults.map(i => ({ ...i, resultType: 'insight' })));
    }

    if (!type || type === 'resources') {
      const resourceResults = this.currentSession.sharedMemory.resources.filter(r => 
        r.title.toLowerCase().includes(lowerQuery) ||
        r.url.toLowerCase().includes(lowerQuery) ||
        r.summary.toLowerCase().includes(lowerQuery)
      );
      results.push(...resourceResults.map(r => ({ ...r, resultType: 'resource' })));
    }

    return results;
  }

  // Get shared memory statistics
  getSharedMemoryStats() {
    if (!this.currentSession) return null;

    return {
      sessionId: this.currentSession.sessionId,
      userId: this.currentSession.userId,
      lastSynced: this.currentSession.lastSynced,
      entities: this.currentSession.sharedMemory.entities.length,
      insights: this.currentSession.sharedMemory.insights.length,
      resources: this.currentSession.sharedMemory.resources.length,
      connections: this.currentSession.sharedMemory.connections.length,
      conversations: this.currentSession.sharedMemory.conversations.length,
      threadReferences: this.currentSession.sharedMemory.threadReferences.length
    };
  }

  // Helper methods
  private findEntityInSharedMemory(name: string): Entity | null {
    if (!this.currentSession) return null;
    return this.currentSession.sharedMemory.entities.find(e => 
      e.name.toLowerCase() === name.toLowerCase()
    ) || null;
  }

  // Subscribe to shared memory changes
  subscribe(listener: (session: BetterAuthMCPSession) => void) {
    this.syncListeners.push(listener);
    return () => {
      this.syncListeners = this.syncListeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    if (this.currentSession) {
      this.syncListeners.forEach(listener => listener(this.currentSession!));
    }
  }

  // Auto-sync every 30 seconds
  private startAutoSync() {
    setInterval(async () => {
      if (this.currentSession) {
        try {
          await this.syncSharedMemory();
        } catch (error) {
          console.error('Auto-sync failed:', error);
        }
      }
    }, 30000);
  }

  // Mock Better Auth MCP calls (in real implementation, these would call actual Better Auth MCP)
  private async callBetterAuthMCP(method: string, params: any): Promise<any> {
    console.log(`Calling Better Auth MCP: ${method}`, params);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    switch (method) {
      case 'create_session':
        return {
          userId: params.userId,
          sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
        
      case 'get_shared_memory':
        // Return mock shared memory data
        return {
          entities: [],
          insights: [],
          resources: [],
          connections: [],
          conversations: [],
          threadReferences: []
        };
        
      case 'update_shared_memory':
        return { success: true };
        
      case 'log_shared_memory_update':
      case 'log_memory_sharing':
        return { logged: true };
        
      default:
        throw new Error(`Unknown Better Auth MCP method: ${method}`);
    }
  }

  // Public API methods
  getCurrentSession(): BetterAuthMCPSession | null {
    return this.currentSession;
  }

  hasActiveSession(): boolean {
    return this.currentSession !== null;
  }

  clearSession(): void {
    this.currentSession = null;
  }
}

// Singleton instance
export const betterAuthMCPService = new BetterAuthMCPService();
export default betterAuthMCPService;