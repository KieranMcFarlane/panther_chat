/**
 * 🐆 Activity Logging Service for RFP Detection Monitoring
 * 
 * Provides comprehensive logging and monitoring for all RFP detection activities.
 * Tracks webhook processing, entity analysis, opportunity detection, and system performance.
 */

import { RFPOpportunityDetector } from './rfp-opportunity-detector';

export interface ActivityLogEntry {
  id: string;
  timestamp: Date;
  activity_type: 'webhook_received' | 'entity_analysis' | 'rfp_detected' | 'opportunity_analysis' | 'system_health' | 'test_run';
  source: string;
  entity_name?: string;
  content?: string;
  confidence?: number;
  opportunities_detected?: number;
  entity_score?: number;
  processing_time_ms?: number;
  status: 'success' | 'error' | 'warning';
  details: Record<string, any>;
  metadata?: {
    user_agent?: string;
    ip_address?: string;
    webhook_id?: string;
    keywords_found?: string[];
    yellow_panther_fit?: 'EXCELLENT_FIT' | 'GOOD_FIT' | 'POTENTIAL_FIT';
  };
}

export interface ActivityStats {
  total_activities: number;
  rfp_detections: number;
  high_value_opportunities: number;
  average_confidence: number;
  average_processing_time: number;
  success_rate: number;
  last_activity: Date;
  top_entities: Array<{ name: string; score: number; detections: number }>;
  hourly_activity: Array<{ hour: string; count: number }>;
}

export class ActivityLogService {
  private static instance: ActivityLogService;
  private logs: ActivityLogEntry[] = [];
  private maxLogs = 10000; // Keep last 10,000 logs
  private isProcessing = false;

  private constructor() {
    // Initialize with system startup log
    this.logActivity({
      activity_type: 'system_health',
      source: 'ActivityLogService',
      status: 'success',
      details: { message: 'Activity logging service initialized', max_logs: this.maxLogs }
    });
  }

  static getInstance(): ActivityLogService {
    if (!ActivityLogService.instance) {
      ActivityLogService.instance = new ActivityLogService();
    }
    return ActivityLogService.instance;
  }

  /**
   * Log webhook activity
   */
  logWebhookActivity(webhookData: any, processingResult: any, processingTime: number): void {
    const entityName = this.extractEntityName(webhookData.content);
    const entityScore = entityName ? RFPOpportunityDetector.getYellowPantherEntityScore(entityName, 'sports organization') : null;

    this.logActivity({
      id: `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      activity_type: 'webhook_received',
      source: webhookData.source || 'unknown',
      entity_name: entityName,
      content: webhookData.content?.substring(0, 500) || 'No content',
      confidence: processingResult.analysis?.confidence || 0,
      opportunities_detected: processingResult.reasoningResult?.rfp_opportunities?.opportunities?.length || 0,
      entity_score: entityScore?.score || 0,
      processing_time_ms: processingTime,
      status: processingResult.success ? 'success' : 'error',
      details: {
        keywords_count: webhookData.keywords?.length || 0,
        validation_errors: processingResult.validation_errors || [],
        reasoning_quality: processingResult.reasoningResult?.quality_score || 0
      },
      metadata: {
        webhook_id: webhookData.webhook_id,
        keywords_found: webhookData.keywords?.slice(0, 10) || [],
        yellow_panther_fit: entityScore?.fit || 'POTENTIAL_FIT',
        user_agent: webhookData.user_agent,
        ip_address: webhookData.ip_address
      }
    });
  }

  /**
   * Log RFP detection activity
   */
  logRFPDetection(content: string, entityName: string, opportunities: any[]): void {
    const entityScore = RFPOpportunityDetector.getYellowPantherEntityScore(entityName, 'sports organization');
    const highValueOpportunities = opportunities.filter(opp => opp.confidence >= 0.8);

    this.logActivity({
      id: `rfp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      activity_type: 'rfp_detected',
      source: 'RFPOpportunityDetector',
      entity_name: entityName,
      content: content.substring(0, 500),
      confidence: Math.max(...opportunities.map(opp => opp.confidence)),
      opportunities_detected: opportunities.length,
      entity_score: entityScore.score,
      status: highValueOpportunities.length > 0 ? 'success' : 'warning',
      details: {
        high_value_opportunities: highValueOpportunities.length,
        opportunity_types: opportunities.map(opp => opp.type),
        urgency_detected: opportunities.some(opp => opp.urgency === 'high'),
        estimated_values: opportunities.map(opp => opp.estimated_value).filter(Boolean)
      },
      metadata: {
        yellow_panther_fit: entityScore.fit,
        keywords_found: opportunities.flatMap(opp => opp.keywords || []),
        entity_tier: entityScore.tier
      }
    });
  }

  /**
   * Log system health check
   */
  logSystemHealth(healthStatus: Record<string, any>): void {
    this.logActivity({
      id: `health_${Date.now()}`,
      activity_type: 'system_health',
      source: 'SystemMonitor',
      status: healthStatus.healthy ? 'success' : 'warning',
      details: {
        services_status: healthStatus.services || {},
        performance_metrics: healthStatus.performance || {},
        error_counts: healthStatus.errors || {}
      },
      metadata: {
        uptime: healthStatus.uptime,
        memory_usage: healthStatus.memory_usage,
        active_webhooks: healthStatus.active_webhooks || 0
      }
    });
  }

  /**
   * Log test execution
   */
  logTestExecution(testName: string, result: any, processingTime: number): void {
    this.logActivity({
      id: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      activity_type: 'test_run',
      source: 'TestSuite',
      content: `Test: ${testName}`,
      confidence: result.confidence || 0,
      opportunities_detected: result.opportunities?.length || 0,
      processing_time_ms: processingTime,
      status: result.success ? 'success' : 'error',
      details: {
        test_name: testName,
        assertions: result.assertions || [],
        coverage: result.coverage || {},
        performance_metrics: result.performance || {}
      },
      metadata: {
        test_type: result.test_type || 'integration',
        entity_score: result.entity_score || 0
      }
    });
  }

  /**
   * Get recent activity logs
   */
  getRecentLogs(limit: number = 100, activityType?: string): ActivityLogEntry[] {
    let filteredLogs = this.logs;
    
    if (activityType) {
      filteredLogs = this.logs.filter(log => log.activity_type === activityType);
    }
    
    return filteredLogs
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get activity statistics
   */
  getActivityStats(): ActivityStats {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentLogs = this.logs.filter(log => log.timestamp >= last24Hours);
    const rfpLogs = recentLogs.filter(log => log.activity_type === 'rfp_detected');
    const successLogs = recentLogs.filter(log => log.status === 'success');
    
    // Calculate hourly activity
    const hourlyActivity = Array.from({ length: 24 }, (_, i) => {
      const hour = new Date(now.getTime() - i * 60 * 60 * 1000).getHours();
      const hourLogs = recentLogs.filter(log => log.timestamp.getHours() === hour);
      return {
        hour: `${hour.toString().padStart(2, '0')}:00`,
        count: hourLogs.length
      };
    }).reverse();

    // Get top entities
    const entityCounts = new Map<string, { score: number; detections: number }>();
    rfpLogs.forEach(log => {
      if (log.entity_name) {
        const existing = entityCounts.get(log.entity_name) || { score: 0, detections: 0 };
        entityCounts.set(log.entity_name, {
          score: Math.max(existing.score, log.entity_score || 0),
          detections: existing.detections + 1
        });
      }
    });

    const topEntities = entityCounts.size > 0 
      ? Array.from(entityCounts.entries())
          .map(([name, data]) => ({ name, ...data }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 10)
      : [];

    return {
      total_activities: recentLogs.length,
      rfp_detections: rfpLogs.length,
      high_value_opportunities: rfpLogs.filter(log => log.details.high_value_opportunities > 0).length,
      average_confidence: recentLogs.reduce((sum, log) => sum + (log.confidence || 0), 0) / recentLogs.length || 0,
      average_processing_time: recentLogs.reduce((sum, log) => sum + (log.processing_time_ms || 0), 0) / recentLogs.length || 0,
      success_rate: (successLogs.length / recentLogs.length) * 100 || 0,
      last_activity: this.logs.length > 0 ? this.logs[this.logs.length - 1].timestamp : now,
      top_entities: topEntities,
      hourly_activity: hourlyActivity
    };
  }

  /**
   * Get current system status
   */
  getSystemStatus(): {
    is_active: boolean;
    last_activity: Date;
    active_webhooks: number;
    pending_processing: boolean;
    health_score: number;
    recent_errors: ActivityLogEntry[];
  } {
    const now = new Date();
    const last5Minutes = new Date(now.getTime() - 5 * 60 * 1000);
    const recentLogs = this.logs.filter(log => log.timestamp >= last5Minutes);
    const errorLogs = recentLogs.filter(log => log.status === 'error');
    
    const healthScore = Math.max(0, 100 - (errorLogs.length * 10));
    const isActive = recentLogs.length > 0;

    return {
      is_active: isActive,
      last_activity: this.logs.length > 0 ? this.logs[this.logs.length - 1].timestamp : now,
      active_webhooks: recentLogs.filter(log => log.activity_type === 'webhook_received').length,
      pending_processing: this.isProcessing,
      health_score: healthScore,
      recent_errors: errorLogs.slice(0, 5)
    };
  }

  /**
   * Core logging method
   */
  private logActivity(entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>): void {
    const logEntry: ActivityLogEntry = {
      id: entry.id || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...entry
    };

    this.logs.push(logEntry);

    // Maintain log limit
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Log to console for development
    if (process.env.NODE_ENV === 'development') {
      const statusEmoji = entry.status === 'success' ? '✅' : entry.status === 'error' ? '❌' : '⚠️';
      console.log(`${statusEmoji} [${logEntry.timestamp.toISOString()}] ${entry.activity_type.toUpperCase()}: ${entry.entity_name || entry.source}`);
      
      if (entry.opportunities_detected > 0) {
        console.log(`   🎯 RFP Opportunities: ${entry.opportunities_detected}, Confidence: ${(entry.confidence! * 100).toFixed(1)}%`);
      }
      
      if (entry.entity_score && entry.entity_score >= 80) {
        console.log(`   🐆 Yellow Panther Score: ${entry.entity_score}/100`);
      }
    }
  }

  /**
   * Extract entity name from content
   */
  private extractEntityName(content: string): string | null {
    if (!content) return null;
    
    // Simple entity extraction - could be enhanced with NLP
    const words = content.split(/\s+/);
    for (let i = 0; i < words.length - 1; i++) {
      const twoWordPhrase = `${words[i]} ${words[i + 1]}`;
      if (twoWordPhrase.length > 8 && twoWordPhrase.match(/^[A-Z][a-z]+ [A-Z][a-z]+/)) {
        return twoWordPhrase;
      }
    }
    
    return null;
  }

  /**
   * Export logs for analysis
   */
  exportLogs(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = ['timestamp', 'activity_type', 'entity_name', 'confidence', 'opportunities', 'status'];
      const rows = this.logs.map(log => [
        log.timestamp.toISOString(),
        log.activity_type,
        log.entity_name || '',
        log.confidence || 0,
        log.opportunities_detected || 0,
        log.status
      ]);
      
      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
    
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Clear old logs
   */
  clearOldLogs(olderThanHours: number = 24): void {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    this.logs = this.logs.filter(log => log.timestamp >= cutoff);
  }
}

export const activityLogger = ActivityLogService.getInstance();