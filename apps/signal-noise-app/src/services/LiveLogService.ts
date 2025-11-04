/**
 * Live Log Service - Real-time system activity logging and monitoring (Pure In-Memory)
 */

// In-memory log storage for real-time performance
class InMemoryLogStore {
  private logs: LogEntry[] = [];
  private maxSize = 1000;

  addLog(log: LogEntry): void {
    this.logs.unshift(log); // Add to beginning (newest first)
    if (this.logs.length > this.maxSize) {
      this.logs = this.logs.slice(0, this.maxSize);
    }
  }

  getLogs(filters: {
    limit?: number;
    category?: string;
    source?: string;
    since?: number;
  } = {}): LogEntry[] {
    let filteredLogs = [...this.logs];

    if (filters.category && filters.category !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.category === filters.category);
    }

    if (filters.source && filters.source !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.source === filters.source);
    }

    if (filters.since) {
      filteredLogs = filteredLogs.filter(log => 
        new Date(log.timestamp).getTime() >= filters.since
      );
    }

    return filteredLogs.slice(0, filters.limit || 50);
  }
}

const inMemoryStore = new InMemoryLogStore();

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  category: 'system' | 'mine' | 'reasoning' | 'notification' | 'api' | 'database' | 'webhook' | 'claude-agent';
  source: string; // service or component name
  entity_id?: string;
  entity_name?: string;
  message: string;
  data?: Record<string, any>;
  metadata?: {
    user_id?: string;
    session_id?: string;
    request_id?: string;
    ip_address?: string;
    user_agent?: string;
    processing_time?: number;
    error_code?: string;
    stack_trace?: string;
  };
  tags?: string[];
  correlation_id?: string;
}

interface SystemMetrics {
  timestamp: string;
  cpu_usage?: number;
  memory_usage?: number;
  active_mines: number;
  queue_size: number;
  processing_rate: number; // tasks per minute
  error_rate: number; // errors per minute
  notification_rate: number; // notifications per minute
  database_connections: number;
  cache_hit_rate?: number;
  response_time_p95?: number; // milliseconds
}

interface ActivityFeed {
  id: string;
  timestamp: string;
  type: 'detection' | 'analysis' | 'notification' | 'system_event' | 'error';
  title: string;
  description: string;
  entity_id?: string;
  entity_name?: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
  actions?: ActivityAction[];
}

interface ActivityAction {
  label: string;
  action: string;
  url?: string;
  method?: 'GET' | 'POST' | 'PATCH';
}

export class LiveLogService {
  constructor() {
    // Pure in-memory service, no database flushing needed
  }

  /**
   * Log a system event
   */
  log(entry: Omit<LogEntry, 'id' | 'timestamp'>): void {
    const logEntry: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...entry
    };

    // Store directly in in-memory store for real-time access
    inMemoryStore.addLog(logEntry);
    console.log(`📝 Log added to in-memory store: ${logEntry.message} (${logEntry.category})`);
  }

  /**
   * Add a log entry directly (for compatibility with A2A services)
   */
  addLog(entry: Omit<LogEntry, 'id' | 'timestamp'>): void {
    this.log(entry);
  }

  /**
   * Convenience methods for different log levels
   */
  debug(message: string, data?: LogEntry): void {
    this.log({ level: 'debug', message, ...data });
  }

  info(message: string, data?: LogEntry): void {
    this.log({ level: 'info', message, ...data });
  }

  warn(message: string, data?: LogEntry): void {
    this.log({ level: 'warn', message, ...data });
  }

  error(message: string, data?: LogEntry): void {
    this.log({ level: 'error', message, ...data });
  }

  critical(message: string, data?: LogEntry): void {
    this.log({ level: 'critical', message, ...data });
  }

  /**
   * Log specific event types with structured data
   */
  logMineActivation(mineId: string, entityName: string, keywords: string[]): void {
    this.info('Mine activated', {
      category: 'mine',
      source: 'KeywordMinesService',
      entity_name: entityName,
      message: `Keyword mine activated for ${entityName}`,
      data: {
        mine_id: mineId,
        keywords_count: keywords.length,
        keywords_sample: keywords.slice(0, 5)
      },
      tags: ['mine', 'activation']
    });
  }

  logDetection(mineId: string, entityName: string, keywords: string[], source: string, confidence: number): void {
    this.info('Detection triggered', {
      category: 'mine',
      source: 'KeywordMinesService',
      entity_name: entityName,
      message: `Detection triggered for ${entityName} from ${source}`,
      data: {
        mine_id: mineId,
        keywords_matched: keywords,
        source,
        confidence_score: confidence
      },
      tags: ['detection', 'mine']
    });
  }

  logReasoningStart(entityName: string, analysisType: string, priority: string): void {
    this.info('Reasoning analysis started', {
      category: 'reasoning',
      source: 'ContinuousReasoningService',
      entity_name: entityName,
      message: `${analysisType} analysis started for ${entityName}`,
      data: {
        analysis_type: analysisType,
        priority
      },
      tags: ['reasoning', 'analysis_start']
    });
  }

  logReasoningComplete(entityName: string, analysisType: string, insights: number, opportunities: number): void {
    this.info('Reasoning analysis completed', {
      category: 'reasoning',
      source: 'ContinuousReasoningService',
      entity_name: entityName,
      message: `${analysisType} analysis completed for ${entityName}`,
      data: {
        analysis_type: analysisType,
        insights_count: insights,
        opportunities_count: opportunities
      },
      tags: ['reasoning', 'analysis_complete']
    });
  }

  logNotificationSent(title: string, channels: string[], entityName?: string): void {
    this.info('Notification sent', {
      category: 'notification',
      source: 'NotificationService',
      entity_name: entityName,
      message: `Notification sent: ${title}`,
      data: {
        channels,
        channels_count: channels.length
      },
      tags: ['notification', 'sent']
    });
  }

  logNotificationFailed(title: string, channel: string, error: string, entityName?: string): void {
    this.error('Notification delivery failed', {
      category: 'notification',
      source: 'NotificationService',
      entity_name: entityName,
      message: `Failed to send notification to ${channel}: ${title}`,
      data: {
        channel,
        error_message: error
      },
      tags: ['notification', 'failed']
    });
  }

  logWebhookReceived(source: string, keywords: string[], relevantMines: number): void {
    this.info('Webhook received', {
      category: 'webhook',
      source: 'WebhookReceiver',
      message: `Webhook received from ${source} with ${keywords.length} keywords`,
      data: {
        source,
        keywords_count: keywords.length,
        relevant_mines: relevantMines
      },
      tags: ['webhook', 'received']
    });
  }

  logSystemMetrics(metrics: Partial<SystemMetrics>): void {
    this.debug('System metrics', {
      category: 'system',
      source: 'MetricsCollector',
      message: 'System performance metrics',
      data: metrics,
      tags: ['metrics', 'system']
    });
  }

  logApiRequest(method: string, endpoint: string, userId?: string, processingTime?: number): void {
    this.debug('API request', {
      category: 'api',
      source: 'APIGateway',
      message: `${method} ${endpoint}`,
      metadata: {
        user_id: userId,
        processing_time: processingTime
      },
      tags: ['api', 'request']
    });
  }

  logApiResponse(method: string, endpoint: string, statusCode: number, processingTime?: number): void {
    const level = statusCode >= 400 ? 'warn' : 'debug';
    this.log({
      level,
      category: 'api',
      source: 'APIGateway',
      message: `${method} ${endpoint} - ${statusCode}`,
      metadata: {
        processing_time: processingTime
      },
      data: {
        method,
        endpoint,
        status_code: statusCode
      },
      tags: ['api', 'response']
    });
  }

  logDatabaseQuery(query: string, table: string, duration?: number, error?: string): void {
    if (error) {
      this.error('Database query failed', {
        category: 'database',
        source: 'DatabaseService',
        message: `Query failed on ${table}: ${error}`,
        data: {
          query: query.substring(0, 200),
          table,
          duration
        },
        tags: ['database', 'error']
      });
    } else {
      this.debug('Database query executed', {
        category: 'database',
        source: 'DatabaseService',
        message: `Query executed on ${table}`,
        metadata: {
          processing_time: duration
        },
        data: {
          query: query.substring(0, 200),
          table
        },
        tags: ['database', 'query']
      });
    }
  }

  /**
   * Get recent log entries with filtering
   */
  async getLogs(filters: {
    limit?: number;
    level?: string;
    category?: string;
    source?: string;
    entity_id?: string;
    hours?: number;
    tags?: string[];
  } = {}): Promise<LogEntry[]> {
    // Use in-memory store as primary for real-time performance
    console.log('📊 getLogs using in-memory store with filters:', filters);
    
    // Apply time-based filtering for hours parameter
    let since: number | undefined;
    if (filters.hours) {
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - filters.hours);
      since = cutoff.getTime();
    }

    const memoryLogs = inMemoryStore.getLogs({
      limit: filters.limit,
      category: filters.category,
      source: filters.source,
      since
    });

    // Apply additional filters that the in-memory store doesn't handle
    let filteredLogs = memoryLogs;

    if (filters.level) {
      filteredLogs = filteredLogs.filter(log => log.level === filters.level);
    }

    if (filters.entity_id) {
      filteredLogs = filteredLogs.filter(log => log.entity_id === filters.entity_id);
    }

    if (filters.tags && filters.tags.length > 0) {
      filteredLogs = filteredLogs.filter(log => 
        filters.tags!.some(tag => log.tags?.includes(tag))
      );
    }

    console.log('📊 In-memory store returned:', filteredLogs.length, 'logs');
    return filteredLogs;
  }

  /**
   * Get recent logs for streaming (with timestamp filtering)
   */
  async getRecentLogs(filters: {
    limit?: number;
    category?: string;
    source?: string;
    since?: number; // timestamp in milliseconds
    tags?: string[];
  } = {}): Promise<LogEntry[]> {
    // Use in-memory store for real-time streaming
    console.log('📊 getRecentLogs using in-memory store with filters:', filters);
    
    const memoryLogs = inMemoryStore.getLogs({
      limit: filters.limit,
      category: filters.category,
      source: filters.source,
      since: filters.since
    });

    // Apply tags filter if specified
    let filteredLogs = memoryLogs;
    if (filters.tags && filters.tags.length > 0) {
      filteredLogs = memoryLogs.filter(log => 
        filters.tags!.some(tag => log.tags?.includes(tag))
      );
    }

    console.log('📊 In-memory store returned:', filteredLogs.length, 'logs');
    return filteredLogs;
  }

  /**
   * Get activity feed for dashboard (in-memory simulation)
   */
  async getActivityFeed(filters: {
    limit?: number;
    entity_id?: string;
    urgency?: string;
    hours?: number;
  } = {}): Promise<ActivityFeed[]> {
    // Convert recent logs to activity feed items for demonstration
    const logs = await this.getLogs({
      limit: filters.limit || 20,
      category: 'claude-agent',
      hours: filters.hours || 24
    });

    const activities: ActivityFeed[] = logs.map(log => {
      let type: ActivityFeed['type'] = 'system_event';
      let title = log.message;
      let urgency: ActivityFeed['urgency'] = 'medium';

      if (log.message.includes('started')) {
        type = 'system_event';
        title = `🤖 ${log.source}: ${log.message}`;
        urgency = 'medium';
      } else if (log.message.includes('completed')) {
        type = 'analysis';
        title = `🎯 ${log.source}: ${log.message}`;
        urgency = 'high';
      } else if (log.level === 'error') {
        type = 'error';
        title = `❌ ${log.source}: ${log.message}`;
        urgency = 'critical';
      }

      return {
        id: log.id,
        timestamp: log.timestamp,
        type,
        title,
        description: log.message,
        entity_id: log.entity_id,
        entity_name: log.entity_name,
        urgency,
        details: log.data || {},
        actions: [
          {
            label: 'View Details',
            action: 'view_log',
            url: `/agent-logs`
          }
        ]
      };
    });

    return activities;
  }

  /**
   * Get log statistics (in-memory calculation)
   */
  async getLogStats(hours: number = 24): Promise<{
    total: number;
    by_level: Record<string, number>;
    by_category: Record<string, number>;
    error_rate: number;
    top_sources: Array<{ source: string; count: number }>;
  }> {
    const logs = await this.getLogs({ hours });

    const levelCounts = logs.reduce((acc, log) => {
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const categoryCounts = logs.reduce((acc, log) => {
      acc[log.category] = (acc[log.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const sourceCounts = logs.reduce((acc, log) => {
      acc[log.source] = (acc[log.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const errorCount = logs.filter(log => log.level === 'error' || log.level === 'critical').length;

    return {
      total: logs.length,
      by_level: levelCounts,
      by_category: categoryCounts,
      error_rate: logs.length ? (errorCount / logs.length) * 100 : 0,
      top_sources: Object.entries(sourceCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([source, count]) => ({ source, count }))
    };
  }

  /**
   * Add activity to feed (in-memory only)
   */
  async addActivity(activity: Omit<ActivityFeed, 'id' | 'timestamp'>): Promise<void> {
    // Log activity as a system event for demonstration
    this.info('Activity added', {
      category: 'system',
      source: 'LiveLogService',
      message: `Activity: ${activity.title}`,
      data: activity,
      tags: ['activity']
    });
  }
}

// Export singleton
export const liveLogService = new LiveLogService();