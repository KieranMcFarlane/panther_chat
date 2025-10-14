/**
 * Working Enrichment Scheduler for Claude Agent
 * Manages scheduled enrichment tasks using real Claude Agent SDK
 */

import { intelligentEntityEnrichmentService } from './WorkingIntelligentEntityEnrichmentService';
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

class WorkingIntelligentEnrichmentScheduler {
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
        description: 'Enrich football clubs with latest business intelligence',
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
        description: 'Comprehensive analysis of league-wide developments',
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
        id: 'hourly-news-monitor',
        name: 'Hourly News & Opportunity Monitor',
        description: 'Monitor for time-sensitive business opportunities',
        cronExpression: '0 * * * *', // Every hour
        enabled: false, // Disabled by default to avoid API costs
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

    liveLogService.info('Enrichment scheduler initialized with default schedules', {
      category: 'system',
      source: 'WorkingIntelligentEnrichmentScheduler',
      data: { 
        scheduleCount: defaultSchedules.length,
        schedules: defaultSchedules.map(s => ({ id: s.id, name: s.name, enabled: s.enabled })),
        timestamp: new Date().toISOString()
      }
    });
  }

  private calculateNextRun(schedule: EnrichmentSchedule) {
    // Simple next run calculation (in production, use a proper cron library)
    const now = new Date();
    const nextRun = new Date(now);
    
    // For demo purposes, add hours based on priority
    switch (schedule.config.priority) {
      case 'high':
        nextRun.setHours(nextRun.getHours() + 1);
        break;
      case 'medium':
        nextRun.setHours(nextRun.getHours() + 6);
        break;
      case 'low':
        nextRun.setHours(nextRun.getHours() + 24);
        break;
    }
    
    schedule.nextRun = nextRun.toISOString();
  }

  async triggerEnrichment(scheduleId: string, config?: any): Promise<any> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      throw new Error(`Schedule ${scheduleId} not found`);
    }

    if (intelligentEntityEnrichmentService.isEnrichmentActive()) {
      throw new Error('Claude Agent enrichment is already running');
    }

    liveLogService.info(`Manually triggering enrichment schedule: ${schedule.name}`, {
      category: 'claude-agent',
      source: 'WorkingIntelligentEnrichmentScheduler',
      data: { 
        scheduleId,
        scheduleName: schedule.name,
        config: config || schedule.config,
        timestamp: new Date().toISOString()
      }
    });

    const startTime = Date.now();

    try {
      const result = await intelligentEntityEnrichmentService.startIntelligentEnrichment();
      
      // Update schedule results
      schedule.results.totalRuns++;
      schedule.results.successfulRuns++;
      schedule.lastRun = new Date().toISOString();
      schedule.results.averageProcessingTime = Math.round(
        (schedule.results.averageProcessingTime * (schedule.results.totalRuns - 1) + (Date.now() - startTime)) / 
        schedule.results.totalRuns
      );

      this.calculateNextRun(schedule);

      liveLogService.info(`✅ Schedule ${schedule.name} completed successfully`, {
        category: 'claude-agent',
        source: 'WorkingIntelligentEnrichmentScheduler',
        data: { 
          scheduleId,
          result: {
            totalEntities: result.totalEntities,
            successful: result.successfulEnrichments,
            failed: result.failedEnrichments,
            duration: Date.now() - startTime
          },
          timestamp: new Date().toISOString()
        }
      });

      return {
        scheduleId,
        scheduleName: schedule.name,
        result,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      schedule.results.totalRuns++;
      schedule.results.failedRuns++;
      schedule.results.lastError = error.message;
      schedule.lastRun = new Date().toISOString();

      liveLogService.error(`❌ Schedule ${schedule.name} failed`, {
        category: 'claude-agent',
        source: 'WorkingIntelligentEnrichmentScheduler',
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

    liveLogService.info(`Schedule ${schedule.name} ${enabled ? 'enabled' : 'disabled'}`, {
      category: 'system',
      source: 'WorkingIntelligentEnrichmentScheduler',
      data: { 
        scheduleId,
        scheduleName: schedule.name,
        enabled,
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
    // In production, implement proper cron scheduling
    // For now, just log that it would be started
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) return;

    liveLogService.info(`Starting schedule: ${schedule.name}`, {
      category: 'system',
      source: 'WorkingIntelligentEnrichmentScheduler',
      data: { 
        scheduleId,
        nextRun: schedule.nextRun,
        timestamp: new Date().toISOString()
      }
    });
  }

  private stopSchedule(scheduleId: string) {
    const interval = this.intervals.get(scheduleId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(scheduleId);
      
      const schedule = this.schedules.get(scheduleId);
      liveLogService.info(`Stopped schedule: ${schedule?.name}`, {
        category: 'system',
        source: 'WorkingIntelligentEnrichmentScheduler',
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
    const currentBatch = intelligentEntityEnrichmentService.getCurrentBatch();
    const isRunning = intelligentEntityEnrichmentService.isEnrichmentActive();

    return {
      isEnrichmentRunning: isRunning,
      currentBatch: currentBatch,
      activeSchedules: this.getSchedules().filter(s => s.enabled).length,
      totalSchedules: this.schedules.size,
      nextScheduledRun: this.getNextScheduledRun(),
      schedulerHealth: this.isInitialized ? 'healthy' : 'initializing',
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
    if (intelligentEntityEnrichmentService.isEnrichmentActive()) {
      await intelligentEntityEnrichmentService.stopEnrichment();
    }

    liveLogService.info('Enrichment scheduler shutdown complete', {
      category: 'system',
      source: 'WorkingIntelligentEnrichmentScheduler',
      data: { 
        timestamp: new Date().toISOString()
      }
    });
  }
}

// Singleton instance
export const intelligentEnrichmentScheduler = new WorkingIntelligentEnrichmentScheduler();
export default intelligentEnrichmentScheduler;