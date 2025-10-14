'use client';

import { auth } from '@/lib/auth-client';

interface ConversationMemory {
  id: string;
  userId: string;
  threadId: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    metadata?: any;
  }>;
  insights: Array<{
    id: string;
    content: string;
    category: string;
    confidence: number;
    timestamp: Date;
    source: 'claude_agent' | 'user_input' | 'analysis';
  }>;
  entities: Array<{
    id: string;
    name: string;
    type: string;
    properties: any;
    lastSeen: Date;
    context: string;
  }>;
  preferences: {
    communicationStyle: string;
    focusAreas: string[];
    avoidTopics: string[];
    expertiseLevel: string;
  };
  createdAt: Date;
  updatedAt: Date;
  lastAccessed: Date;
}

interface GlobalInsight {
  id: string;
  content: string;
  category: 'sports_intelligence' | 'rfp_analysis' | 'market_trends' | 'entity_relationships' | 'best_practices';
  confidence: number;
  sourceUserId: string;
  contributingUsers: string[];
  verifiedBy?: string[];
  applications: number;
  successRate?: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  lastApplied?: Date;
  context: {
    industry?: string;
    region?: string;
    entityType?: string;
    scenario?: string;
  };
}

export class BetterAuthMemoryService {
  private static instance: BetterAuthMemoryService;
  private userMemories: Map<string, ConversationMemory[]> = new Map();
  private globalInsights: Map<string, GlobalInsight> = new Map();
  private initialized = false;

  private constructor() {}

  static getInstance(): BetterAuthMemoryService {
    if (!BetterAuthMemoryService.instance) {
      BetterAuthMemoryService.instance = new BetterAuthMemoryService();
    }
    return BetterAuthMemoryService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Load user memories from persistent storage
      await this.loadUserMemories();
      // Load global insights
      await this.loadGlobalInsights();
      
      this.initialized = true;
      console.log('Better Auth Memory Service initialized');
    } catch (error) {
      console.error('Failed to initialize Better Auth Memory Service:', error);
    }
  }

  // User-specific memory operations
  async saveConversationMemory(
    userId: string,
    threadId: string,
    message: any,
    insights: any[] = [],
    entities: any[] = []
  ): Promise<void> {
    try {
      const { data: session } = await auth.getSession();
      if (!session?.user || session.user.id !== userId) {
        throw new Error('Unauthorized: Invalid user session');
      }

      let userMemories = this.userMemories.get(userId) || [];
      let memory = userMemories.find(m => m.threadId === threadId);

      if (!memory) {
        memory = {
          id: `memory_${threadId}_${Date.now()}`,
          userId,
          threadId,
          messages: [],
          insights: [],
          entities: [],
          preferences: {
            communicationStyle: 'professional',
            focusAreas: [],
            avoidTopics: [],
            expertiseLevel: 'intermediate'
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          lastAccessed: new Date()
        };
        userMemories.push(memory);
      }

      // Add message
      memory.messages.push({
        id: message.id || `msg_${Date.now()}`,
        role: message.role,
        content: message.content,
        timestamp: new Date(message.timestamp || Date.now()),
        metadata: message.metadata
      });

      // Add insights
      insights.forEach(insight => {
        memory.insights.push({
          id: insight.id || `insight_${Date.now()}_${Math.random()}`,
          content: insight.content || insight.title,
          category: insight.category || 'analysis',
          confidence: insight.confidence || 0.8,
          timestamp: new Date(insight.timestamp || Date.now()),
          source: insight.source || 'claude_agent'
        });
      });

      // Add entities
      entities.forEach(entity => {
        memory.entities.push({
          id: entity.id || `entity_${Date.now()}_${Math.random()}`,
          name: entity.name,
          type: entity.type,
          properties: entity.properties || {},
          lastSeen: new Date(),
          context: entity.context || 'conversation'
        });
      });

      memory.updatedAt = new Date();
      memory.lastAccessed = new Date();

      this.userMemories.set(userId, userMemories);
      
      // Persist to storage
      await this.persistUserMemories(userId, userMemories);
      
      console.log(`Saved conversation memory for user ${userId}, thread ${threadId}`);
    } catch (error) {
      console.error('Failed to save conversation memory:', error);
      throw error;
    }
  }

  async getConversationHistory(userId: string, threadId?: string): Promise<ConversationMemory[]> {
    try {
      const { data: session } = await auth.getSession();
      if (!session?.user || session.user.id !== userId) {
        throw new Error('Unauthorized: Invalid user session');
      }

      const userMemories = this.userMemories.get(userId) || [];
      
      if (threadId) {
        return userMemories.filter(m => m.threadId === threadId);
      }
      
      return userMemories.sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime());
    } catch (error) {
      console.error('Failed to get conversation history:', error);
      return [];
    }
  }

  async getUserInsights(userId: string, category?: string): Promise<any[]> {
    try {
      const { data: session } = await auth.getSession();
      if (!session?.user || session.user.id !== userId) {
        throw new Error('Unauthorized: Invalid user session');
      }

      const userMemories = this.userMemories.get(userId) || [];
      const insights = userMemories.flatMap(m => m.insights);
      
      if (category) {
        return insights.filter(i => i.category === category);
      }
      
      return insights.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      console.error('Failed to get user insights:', error);
      return [];
    }
  }

  async getUserEntities(userId: string): Promise<any[]> {
    try {
      const { data: session } = await auth.getSession();
      if (!session?.user || session.user.id !== userId) {
        throw new Error('Unauthorized: Invalid user session');
      }

      const userMemories = this.userMemories.get(userId) || [];
      const entities = userMemories.flatMap(m => m.entities);
      
      return entities.sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime());
    } catch (error) {
      console.error('Failed to get user entities:', error);
      return [];
    }
  }

  // Global insights operations (cross-user benefits)
  async contributeGlobalInsight(
    userId: string,
    content: string,
    category: GlobalInsight['category'],
    confidence: number,
    context: any,
    tags: string[] = []
  ): Promise<string> {
    try {
      const { data: session } = await auth.getSession();
      if (!session?.user || session.user.id !== userId) {
        throw new Error('Unauthorized: Invalid user session');
      }

      const insightId = `global_insight_${Date.now()}_${Math.random()}`;
      const insight: GlobalInsight = {
        id: insightId,
        content,
        category,
        confidence,
        sourceUserId: userId,
        contributingUsers: [userId],
        applications: 0,
        tags,
        createdAt: new Date(),
        updatedAt: new Date(),
        context
      };

      this.globalInsights.set(insightId, insight);
      await this.persistGlobalInsights();
      
      console.log(`Added global insight from user ${userId}: ${content.substring(0, 50)}...`);
      return insightId;
    } catch (error) {
      console.error('Failed to contribute global insight:', error);
      throw error;
    }
  }

  async getRelevantGlobalInsights(
    category?: GlobalInsight['category'],
    context?: any,
    limit: number = 10
  ): Promise<GlobalInsight[]> {
    try {
      let insights = Array.from(this.globalInsights.values());

      if (category) {
        insights = insights.filter(i => i.category === category);
      }

      // Context-based filtering
      if (context) {
        insights = insights.filter(i => {
          if (context.industry && i.context.industry !== context.industry) return false;
          if (context.region && i.context.region !== context.region) return false;
          if (context.entityType && i.context.entityType !== context.entityType) return false;
          return true;
        });
      }

      // Sort by confidence and applications
      insights.sort((a, b) => {
        const scoreA = a.confidence * (1 + a.applications * 0.1);
        const scoreB = b.confidence * (1 + b.applications * 0.1);
        return scoreB - scoreA;
      });

      return insights.slice(0, limit);
    } catch (error) {
      console.error('Failed to get relevant global insights:', error);
      return [];
    }
  }

  async applyGlobalInsight(insightId: string, userId: string, success: boolean): Promise<void> {
    try {
      const { data: session } = await auth.getSession();
      if (!session?.user || session.user.id !== userId) {
        throw new Error('Unauthorized: Invalid user session');
      }

      const insight = this.globalInsights.get(insightId);
      if (!insight) return;

      insight.applications++;
      if (!insight.contributingUsers.includes(userId)) {
        insight.contributingUsers.push(userId);
      }
      
      if (success) {
        insight.successRate = ((insight.successRate || 0) * (insight.applications - 1) + 1) / insight.applications;
      } else {
        insight.successRate = ((insight.successRate || 0) * (insight.applications - 1)) / insight.applications;
      }
      
      insight.lastApplied = new Date();
      insight.updatedAt = new Date();

      this.globalInsights.set(insightId, insight);
      await this.persistGlobalInsights();
      
      console.log(`Applied global insight ${insightId} for user ${userId}, success: ${success}`);
    } catch (error) {
      console.error('Failed to apply global insight:', error);
    }
  }

  // ByteRover MCP integration helpers
  async storeInByteRover(userId: string, key: string, data: any): Promise<void> {
    try {
      const { data: session } = await auth.getSession();
      if (!session?.user || session.user.id !== userId) {
        throw new Error('Unauthorized: Invalid user session');
      }

      // This would integrate with ByteRover MCP
      // For now, we'll store in local storage as fallback
      const byteRoverKey = `byterover_${userId}_${key}`;
      localStorage.setItem(byteRoverKey, JSON.stringify({
        data,
        userId,
        timestamp: new Date().toISOString()
      }));
      
      console.log(`Stored data in ByteRover for user ${userId}: ${key}`);
    } catch (error) {
      console.error('Failed to store in ByteRover:', error);
    }
  }

  async retrieveFromByteRover(userId: string, key: string): Promise<any> {
    try {
      const { data: session } = await auth.getSession();
      if (!session?.user || session.user.id !== userId) {
        throw new Error('Unauthorized: Invalid user session');
      }

      // This would integrate with ByteRover MCP
      const byteRoverKey = `byterover_${userId}_${key}`;
      const stored = localStorage.getItem(byteRoverKey);
      
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.data;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to retrieve from ByteRover:', error);
      return null;
    }
  }

  // Private persistence methods
  private async loadUserMemories(): Promise<void> {
    try {
      // In production, this would load from Better Auth's database
      const stored = localStorage.getItem('better_auth_user_memories');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.userMemories = new Map(Object.entries(parsed));
      }
    } catch (error) {
      console.error('Failed to load user memories:', error);
    }
  }

  private async persistUserMemories(userId: string, memories: ConversationMemory[]): Promise<void> {
    try {
      // In production, this would persist to Better Auth's database
      const current = Object.fromEntries(this.userMemories);
      current[userId] = memories;
      localStorage.setItem('better_auth_user_memories', JSON.stringify(current));
    } catch (error) {
      console.error('Failed to persist user memories:', error);
    }
  }

  private async loadGlobalInsights(): Promise<void> {
    try {
      // In production, this would load from a shared database
      const stored = localStorage.getItem('better_auth_global_insights');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.globalInsights = new Map(Object.entries(parsed));
      }
    } catch (error) {
      console.error('Failed to load global insights:', error);
    }
  }

  private async persistGlobalInsights(): Promise<void> {
    try {
      // In production, this would persist to a shared database
      const toStore = Object.fromEntries(this.globalInsights);
      localStorage.setItem('better_auth_global_insights', JSON.stringify(toStore));
    } catch (error) {
      console.error('Failed to persist global insights:', error);
    }
  }

  // Analytics and cleanup
  async getMemoryStats(userId: string): Promise<any> {
    try {
      const { data: session } = await auth.getSession();
      if (!session?.user || session.user.id !== userId) {
        throw new Error('Unauthorized: Invalid user session');
      }

      const userMemories = this.userMemories.get(userId) || [];
      const insights = userMemories.flatMap(m => m.insights);
      const entities = userMemories.flatMap(m => m.entities);
      
      return {
        totalMemories: userMemories.length,
        totalMessages: userMemories.reduce((sum, m) => sum + m.messages.length, 0),
        totalInsights: insights.length,
        totalEntities: entities.length,
        insightsByCategory: insights.reduce((acc, i) => {
          acc[i.category] = (acc[i.category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        globalInsightsContributed: Array.from(this.globalInsights.values())
          .filter(i => i.sourceUserId === userId).length,
        lastActivity: Math.max(...userMemories.map(m => m.lastAccessed.getTime()))
      };
    } catch (error) {
      console.error('Failed to get memory stats:', error);
      return null;
    }
  }

  async cleanupOldMemories(userId: string, maxAge: number = 90 * 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const { data: session } = await auth.getSession();
      if (!session?.user || session.user.id !== userId) {
        throw new Error('Unauthorized: Invalid user session');
      }

      const userMemories = this.userMemories.get(userId) || [];
      const cutoff = Date.now() - maxAge;
      
      const filtered = userMemories.filter(m => m.lastAccessed.getTime() > cutoff);
      this.userMemories.set(userId, filtered);
      
      await this.persistUserMemories(userId, filtered);
      
      console.log(`Cleaned up ${userMemories.length - filtered.length} old memories for user ${userId}`);
    } catch (error) {
      console.error('Failed to cleanup old memories:', error);
    }
  }
}

export const betterAuthMemoryService = BetterAuthMemoryService.getInstance();