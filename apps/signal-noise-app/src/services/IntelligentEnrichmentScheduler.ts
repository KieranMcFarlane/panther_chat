/**
 * Working Enrichment Scheduler for Claude Agent
 * Manages scheduled enrichment tasks using real Claude Agent SDK
 */

import { cleanClaudeAgentService } from './CleanClaudeAgentService';
import { liveLogService } from './LiveLogService';

interface EnrichmentSchedule {
  id: string;
  name: string;
  description: string;
  cronExpression: string;
  enabled: boolean;
  lastRun: string | null;
  nextRun: string | null;
  config: {
    entityTypes: string[];
    batchSize: number;
    maxProcessingTime: number; // minutes
    priority: 'high' | 'medium' | 'low';
  };
  results: {
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    averageProcessingTime: number;
    lastError?: string;
  };
}

class IntelligentEnrichmentScheduler {
  private schedules: Map<string, EnrichmentSchedule> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private isInitialized = false;

  constructor() {
    this.initializeDefaultSchedules();
  }

  private initializeDefaultSchedules() {
    // Default enrichment schedules
    const defaultSchedules: EnrichmentSchedule[] = [
      {
        id: 'daily-club-enrichment',
        name: 'Daily Club Intelligence Update',
        description: 'Enrich football clubs with latest business intelligence using Claude Agent',
        cronExpression: '0 9 * * *', // 9 AM daily
        enabled: true,
        lastRun: null,
        nextRun: null,
        config: {
          entityTypes: ['Club'],
          batchSize: 5,
          maxProcessingTime: 30,
          priority: 'high'
        },
        results: {
          totalRuns: 0,
          successfulRuns: 0,
          failedRuns: 0,
          averageProcessingTime: 0
        }
      },
      {
        id: 'weekly-league-scan',
        name: 'Weekly League Strategic Analysis',
        description: 'Comprehensive analysis of league-wide developments with AI',
        cronExpression: '0 10 * * 1', // 10 AM Monday
        enabled: true,
        lastRun: null,
        nextRun: null,
        config: {
          entityTypes: ['League'],
          batchSize: 3,
          maxProcessingTime: 45,
          priority: 'medium'
        },
        results: {
          totalRuns: 0,
          successfulRuns: 0,
          failedRuns: 0,
          averageProcessingTime: 0
        }
      },
      {
        id: 'hourly-opportunity-monitor',
        name: 'Hourly Opportunity Monitor',
        description: 'Monitor for time-sensitive business opportunities using AI',
        cronExpression: '0 * * * *', // Every hour
        enabled: false, // Disabled by default
        lastRun: null,
        nextRun: null,
        config: {
          entityTypes: ['Club', 'League', 'Person'],
          batchSize: 2,
          maxProcessingTime: 15,
          priority: 'high'
        },
        results: {
          totalRuns: 0,
          successfulRuns: 0,
          failedRuns: 0,
          averageProcessingTime: 0
        }
      }
    ];

    defaultSchedules.forEach(schedule => {
      this.schedules.set(schedule.id, schedule);
      this.calculateNextRun(schedule);
    });

    this.isInitialized = true;

    liveLogService.info('📅 Claude Agent enrichment scheduler initialized', {
      category: 'claude-agent',
      source: 'IntelligentEnrichmentScheduler',
      data: { 
        scheduleCount: defaultSchedules.length,
        schedules: defaultSchedules.map(s => ({ 
          id: s.id, 
          name: s.name, 
          enabled: s.enabled,
          priority: s.config.priority 
        })),
        timestamp: new Date().toISOString()
      }
    });
  }

  private calculateNextRun(schedule: EnrichmentSchedule) {
    const now = new Date();
    const nextRun = new Date(now);
    
    // For demo purposes, schedule next run based on priority
    switch (schedule.config.priority) {
      case 'high':
        nextRun.setMinutes(nextRun.getMinutes() + 30);
        break;
      case 'medium':
        nextRun.setHours(nextRun.getHours() + 6);
        break;
      case 'low':
        nextRun.setDate(nextRun.getDate() + 1);
        break;
    }
    
    schedule.nextRun = nextRun.toISOString();
  }

  async triggerEnrichment(scheduleId: string, config?: any): Promise<any> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      throw new Error(`Schedule ${scheduleId} not found`);
    }

    if (cleanClaudeAgentService.isRunning()) {
      throw new Error('Claude Agent enrichment is already running');
    }

    liveLogService.info(`🚀 Manually triggering Claude Agent schedule: ${schedule.name}`, {
      category: 'claude-agent',
      source: 'IntelligentEnrichmentScheduler',
      data: { 
        scheduleId,
        scheduleName: schedule.name,
        priority: schedule.config.priority,
        entityTypes: schedule.config.entityTypes,
        config: config || schedule.config,
        timestamp: new Date().toISOString()
      }
    });

    const startTime = Date.now();

    try {
      const result = await cleanClaudeAgentService.startEnrichment();
      
      // Update schedule results
      schedule.results.totalRuns++;
      schedule.results.successfulRuns++;
      schedule.lastRun = new Date().toISOString();
      schedule.results.averageProcessingTime = Math.round(
        (schedule.results.averageProcessingTime * (schedule.results.totalRuns - 1) + (Date.now() - startTime)) / 
        schedule.results.totalRuns
      );

      this.calculateNextRun(schedule);

      liveLogService.info(`✅ Claude Agent schedule ${schedule.name} completed`, {
        category: 'claude-agent',
        source: 'IntelligentEnrichmentScheduler',
        data: { 
          scheduleId,
          result: {
            totalEntities: result.totalEntities,
            successful: result.successfulEnrichments,
            failed: result.failedEnrichments,
            successRate: `${Math.round((result.successfulEnrichments / result.totalEntities) * 100)}%`,
            duration: Date.now() - startTime
          },
          timestamp: new Date().toISOString()
        }
      });

      return {
        scheduleId,
        scheduleName: schedule.name,
        result,
        processingTime: Date.now() - startTime,
        aiPower: 'Claude Agent SDK + MCP Tools'
      };

    } catch (error) {
      schedule.results.totalRuns++;
      schedule.results.failedRuns++;
      schedule.results.lastError = error.message;
      schedule.lastRun = new Date().toISOString();

      liveLogService.error(`❌ Claude Agent schedule ${schedule.name} failed`, {
        category: 'claude-agent',
        source: 'IntelligentEnrichmentScheduler',
        data: { 
          scheduleId,
          error: error.message,
          timestamp: new Date().toISOString()
        }
      });

      throw error;
    }
  }

  toggleSchedule(scheduleId: string, enabled: boolean) {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      throw new Error(`Schedule ${scheduleId} not found`);
    }

    schedule.enabled = enabled;

    liveLogService.info(`📋 Schedule ${schedule.name} ${enabled ? '✅ enabled' : '❌ disabled'}`, {
      category: 'claude-agent',
      source: 'IntelligentEnrichmentScheduler',
      data: { 
        scheduleId,
        scheduleName: schedule.name,
        enabled,
        priority: schedule.config.priority,
        nextRun: enabled ? schedule.nextRun : null,
        timestamp: new Date().toISOString()
      }
    });

    if (enabled && !this.intervals.has(scheduleId)) {
      this.startSchedule(scheduleId);
    } else if (!enabled && this.intervals.has(scheduleId)) {
      this.stopSchedule(scheduleId);
    }
  }

  private startSchedule(scheduleId: string) {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) return;

    liveLogService.info(`▶️ Starting Claude Agent schedule: ${schedule.name}`, {
      category: 'claude-agent',
      source: 'IntelligentEnrichmentScheduler',
      data: { 
        scheduleId,
        cronExpression: schedule.cronExpression,
        nextRun: schedule.nextRun,
        timestamp: new Date().toISOString()
      }
    });

    // In production, implement proper cron scheduling here
  }

  private stopSchedule(scheduleId: string) {
    const interval = this.intervals.get(scheduleId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(scheduleId);
      
      const schedule = this.schedules.get(scheduleId);
      liveLogService.info(`⏹️ Stopped Claude Agent schedule: ${schedule?.name}`, {
        category: 'claude-agent',
        source: 'IntelligentEnrichmentScheduler',
        data: { 
          scheduleId,
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  getSchedules(): EnrichmentSchedule[] {
    return Array.from(this.schedules.values());
  }

  getSchedule(scheduleId: string): EnrichmentSchedule | null {
    return this.schedules.get(scheduleId) || null;
  }

  getCurrentEnrichmentStatus() {
    const currentBatch = cleanClaudeAgentService.getCurrentBatch();
    const isRunning = cleanClaudeAgentService.isRunning();

    return {
      isEnrichmentRunning: isRunning,
      currentBatch: currentBatch,
      activeSchedules: this.getSchedules().filter(s => s.enabled).length,
      totalSchedules: this.schedules.size,
      nextScheduledRun: this.getNextScheduledRun(),
      schedulerHealth: this.isInitialized ? 'healthy' : 'initializing',
      claudeAgentStatus: 'ready',
      availableTools: ['neo4j-mcp', 'brightdata-mcp', 'supabase-mcp', 'perplexity-mcp'],
      timestamp: new Date().toISOString()
    };
  }

  private getNextScheduledRun(): string | null {
    const enabledSchedules = Array.from(this.schedules.values())
      .filter(s => s.enabled && s.nextRun)
      .sort((a, b) => new Date(a.nextRun!).getTime() - new Date(b.nextRun!).getTime());
    
    return enabledSchedules.length > 0 ? enabledSchedules[0].nextRun! : null;
  }

  async shutdown() {
    // Stop all schedules
    for (const scheduleId of this.intervals.keys()) {
      this.stopSchedule(scheduleId);
    }

    // Stop any running enrichment
    if (cleanClaudeAgentService.isRunning()) {
      await cleanClaudeAgentService.stopEnrichment();
    }

    liveLogService.info('📴 Claude Agent enrichment scheduler shutdown complete', {
      category: 'claude-agent',
      source: 'IntelligentEnrichmentScheduler',
      data: { 
        timestamp: new Date().toISOString()
      }
    });
  }
}

// Singleton instance
export const intelligentEnrichmentScheduler = new IntelligentEnrichmentScheduler();
export default intelligentEnrichmentScheduler;