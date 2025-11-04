import { 
  query, 
  ClaudeAgentOptions
} from "@anthropic-ai/claude-agent-sdk";
import { liveLogService } from "./LiveLogService";

interface A2ASession {
  sessionId: string;
  createdAt: Date;
  lastActivity: Date;
  status: 'active' | 'paused' | 'completed' | 'error';
  messageCount: number;
  totalCost: number;
  agentUsage: Record<string, { calls: number; duration: number; cost: number }>;
  metadata: Record<string, any>;
}

interface UsageTracking {
  sessionId: string;
  messageIds: Set<string>;
  stepUsages: Array<{
    messageId: string;
    timestamp: Date;
    usage: any;
    costUSD: number;
    agent?: string;
    tool?: string;
  }>;
  totalCost: number;
}

export class A2ASessionManager {
  private sessions: Map<string, A2ASession> = new Map();
  private usageTrackers: Map<string, UsageTracking> = new Map();
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  /**
   * Create or resume an A2A session
   */
  async createOrResumeSession(resumeSessionId?: string): Promise<string> {
    if (resumeSessionId) {
      // Try to resume existing session
      const existingSession = this.sessions.get(resumeSessionId);
      if (existingSession && existingSession.status === 'active') {
        existingSession.lastActivity = new Date();
        
        await liveLogService.addLog({
          type: 'info',
          message: `🔄 Resumed A2A session: ${resumeSessionId}`,
          source: 'a2a-session-manager',
          timestamp: new Date(),
          metadata: {
            sessionId: resumeSessionId,
            previousMessages: existingSession.messageCount
          }
        });
        
        return resumeSessionId;
      }
    }

    // Create new session
    const sessionId = `a2a_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session: A2ASession = {
      sessionId,
      createdAt: new Date(),
      lastActivity: new Date(),
      status: 'active',
      messageCount: 0,
      totalCost: 0,
      agentUsage: {},
      metadata: {}
    };

    this.sessions.set(sessionId, session);
    this.usageTrackers.set(sessionId, {
      sessionId,
      messageIds: new Set(),
      stepUsages: [],
      totalCost: 0
    });

    await liveLogService.addLog({
      type: 'info',
      message: `🆕 Created new A2A session: ${sessionId}`,
      source: 'a2a-session-manager',
      timestamp: new Date(),
      metadata: { sessionId }
    });

    return sessionId;
  }

  /**
   * Create a forked session from an existing one
   */
  async forkSession(parentSessionId: string): Promise<string> {
    const parentSession = this.sessions.get(parentSessionId);
    if (!parentSession) {
      throw new Error(`Parent session not found: ${parentSessionId}`);
    }

    const forkedSessionId = `a2a_fork_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const forkedSession: A2ASession = {
      sessionId: forkedSessionId,
      createdAt: new Date(),
      lastActivity: new Date(),
      status: 'active',
      messageCount: 0,
      totalCost: 0,
      agentUsage: {},
      metadata: {
        parentSessionId,
        forkedAt: new Date().toISOString(),
        parentMessageCount: parentSession.messageCount
      }
    };

    this.sessions.set(forkedSessionId, forkedSession);
    this.usageTrackers.set(forkedSessionId, {
      sessionId: forkedSessionId,
      messageIds: new Set(),
      stepUsages: [],
      totalCost: 0
    });

    await liveLogService.addLog({
      type: 'info',
      message: `🔀 Forked A2A session: ${forkedSessionId} from ${parentSessionId}`,
      source: 'a2a-session-manager',
      timestamp: new Date(),
      metadata: {
        parentSessionId,
        forkedSessionId,
        parentMessages: parentSession.messageCount
      }
    });

    return forkedSessionId;
  }

  /**
   * Update session activity and track message usage
   */
  async updateSessionActivity(sessionId: string, message: any): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.lastActivity = new Date();
    session.messageCount++;

    // Track usage for assistant messages
    if (message.type === 'assistant' && message.usage) {
      this.trackUsage(sessionId, message);
    }

    // Track agent usage
    if (message.metadata?.agent) {
      const agent = message.metadata.agent;
      if (!session.agentUsage[agent]) {
        session.agentUsage[agent] = { calls: 0, duration: 0, cost: 0 };
      }
      session.agentUsage[agent].calls++;
      session.agentUsage[agent].cost += message.metadata.cost || 0;
    }
  }

  /**
   * Track token usage and costs for billing
   */
  private trackUsage(sessionId: string, message: any): void {
    const usageTracker = this.usageTrackers.get(sessionId);
    if (!usageTracker || !message.usage) return;

    // Skip if we've already processed this message ID
    const messageId = message.id;
    if (!messageId || usageTracker.messageIds.has(messageId)) {
      return;
    }

    // Mark as processed and record usage
    usageTracker.messageIds.add(messageId);
    
    const cost = this.calculateCost(message.usage);
    const stepUsage = {
      messageId,
      timestamp: new Date(),
      usage: message.usage,
      costUSD: cost,
      agent: message.metadata?.agent,
      tool: message.metadata?.tool
    };

    usageTracker.stepUsages.push(stepUsage);
    usageTracker.totalCost += cost;

    // Update session total cost
    const session = this.sessions.get(sessionId);
    if (session) {
      session.totalCost += cost;
    }

    // Log significant usage
    if (cost > 0.01) { // Log costs over $0.01
      liveLogService.addLog({
        type: 'info',
        message: `💰 Session ${sessionId}: $${cost.toFixed(4)} (${message.usage.input_tokens} input, ${message.usage.output_tokens} output)`,
        source: 'a2a-session-manager',
        timestamp: new Date(),
        metadata: {
          sessionId,
          cost,
          usage: message.usage,
          agent: message.metadata?.agent
        }
      });
    }
  }

  /**
   * Calculate cost based on usage data
   */
  private calculateCost(usage: any): number {
    // Implement your pricing calculation here
    // This is a simplified example pricing
    const inputCost = (usage.input_tokens || 0) * 0.00003;
    const outputCost = (usage.output_tokens || 0) * 0.00015;
    const cacheReadCost = (usage.cache_read_input_tokens || 0) * 0.0000075;
    const cacheCreationCost = (usage.cache_creation_input_tokens || 0) * 0.000015;

    return inputCost + outputCost + cacheReadCost + cacheCreationCost;
  }

  /**
   * Get session details
   */
  getSession(sessionId: string): A2ASession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get session usage breakdown
   */
  getSessionUsage(sessionId: string): UsageTracking | undefined {
    return this.usageTrackers.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): A2ASession[] {
    return Array.from(this.sessions.values()).filter(
      session => session.status === 'active'
    );
  }

  /**
   * Get session cost summary
   */
  getSessionCostSummary(sessionId: string): {
    totalCost: number;
    messageCount: number;
    agentBreakdown: Record<string, number>;
    stepCount: number;
    averageCostPerStep: number;
  } | null {
    const session = this.sessions.get(sessionId);
    const usageTracker = this.usageTrackers.get(sessionId);
    
    if (!session || !usageTracker) return null;

    const agentBreakdown: Record<string, number> = {};
    usageTracker.stepUsages.forEach(step => {
      if (step.agent) {
        agentBreakdown[step.agent] = (agentBreakdown[step.agent] || 0) + step.costUSD;
      }
    });

    return {
      totalCost: session.totalCost,
      messageCount: session.messageCount,
      agentBreakdown,
      stepCount: usageTracker.stepUsages.length,
      averageCostPerStep: usageTracker.stepUsages.length > 0 
        ? session.totalCost / usageTracker.stepUsages.length 
        : 0
    };
  }

  /**
   * Complete session
   */
  async completeSession(sessionId: string, status: 'completed' | 'error' = 'completed'): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = status;
    session.lastActivity = new Date();

    const costSummary = this.getSessionCostSummary(sessionId);

    await liveLogService.addLog({
      type: status === 'completed' ? 'success' : 'error',
      message: `🏁 A2A session ${sessionId} marked as ${status}`,
      source: 'a2a-session-manager',
      timestamp: new Date(),
      metadata: {
        sessionId,
        status,
        totalCost: session.totalCost,
        messageCount: session.messageCount,
        duration: Date.now() - session.createdAt.getTime(),
        costSummary
      }
    });
  }

  /**
   * Pause session
   */
  async pauseSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = 'paused';
    session.lastActivity = new Date();

    await liveLogService.addLog({
      type: 'info',
      message: `⏸️ A2A session ${sessionId} paused`,
      source: 'a2a-session-manager',
      timestamp: new Date(),
      metadata: { sessionId }
    });
  }

  /**
   * Resume paused session
   */
  async resumeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'paused') return;

    session.status = 'active';
    session.lastActivity = new Date();

    await liveLogService.addLog({
      type: 'info',
      message: `▶️ A2A session ${sessionId} resumed`,
      source: 'a2a-session-manager',
      timestamp: new Date(),
      metadata: { sessionId }
    });
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now.getTime() - session.lastActivity.getTime() > this.SESSION_TIMEOUT) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      this.sessions.delete(sessionId);
      this.usageTrackers.delete(sessionId);

      await liveLogService.addLog({
        type: 'info',
        message: `🗑️ Cleaned up expired A2A session: ${sessionId}`,
        source: 'a2a-session-manager',
        timestamp: new Date(),
        metadata: { sessionId }
      });
    }

    if (expiredSessions.length > 0) {
      await liveLogService.addLog({
        type: 'info',
        message: `🧹 Cleaned up ${expiredSessions.length} expired A2A sessions`,
        source: 'a2a-session-manager',
        timestamp: new Date(),
        metadata: { expiredCount: expiredSessions.length }
      });
    }
  }

  /**
   * Get usage statistics across all sessions
   */
  getUsageStatistics(): {
    totalSessions: number;
    activeSessions: number;
    completedSessions: number;
    totalCost: number;
    totalMessages: number;
    averageCostPerSession: number;
    topAgentsByCost: Array<{ agent: string; totalCost: number }>;
  } {
    const sessions = Array.from(this.sessions.values());
    const activeSessions = sessions.filter(s => s.status === 'active').length;
    const completedSessions = sessions.filter(s => s.status === 'completed').length;

    const totalCost = sessions.reduce((sum, session) => sum + session.totalCost, 0);
    const totalMessages = sessions.reduce((sum, session) => sum + session.messageCount, 0);

    // Calculate top agents by cost across all sessions
    const agentCosts: Record<string, number> = {};
    sessions.forEach(session => {
      Object.entries(session.agentUsage).forEach(([agent, usage]) => {
        agentCosts[agent] = (agentCosts[agent] || 0) + usage.cost;
      });
    });

    const topAgentsByCost = Object.entries(agentCosts)
      .map(([agent, totalCost]) => ({ agent, totalCost }))
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 5);

    return {
      totalSessions: sessions.length,
      activeSessions,
      completedSessions,
      totalCost,
      totalMessages,
      averageCostPerSession: sessions.length > 0 ? totalCost / sessions.length : 0,
      topAgentsByCost
    };
  }
}

// Singleton instance
export const a2aSessionManager = new A2ASessionManager();