import { LogEntry, LogLevel, LogFilter, LogAnalytics, AnalyticsEvent, EventType, LogConfig, LogExportOptions } from '@/types/logging';

export class Logger {
  private config: LogConfig;
  private buffer: LogEntry[] = [];
  private flushTimeout?: NodeJS.Timeout;
  private analytics: Map<string, AnalyticsEvent[]> = new Map();

  constructor(config: LogConfig) {
    this.config = config;
    this.setupFlushInterval();
  }

  // Core logging methods
  debug(message: string, metadata?: Record<string, any>, tags?: string[]) {
    this.log('debug', message, metadata, tags);
  }

  info(message: string, metadata?: Record<string, any>, tags?: string[]) {
    this.log('info', message, metadata, tags);
  }

  warn(message: string, metadata?: Record<string, any>, tags?: string[]) {
    this.log('warn', message, metadata, tags);
  }

  error(message: string, metadata?: Record<string, any>, tags?: string[]) {
    this.log('error', message, metadata, tags);
  }

  critical(message: string, metadata?: Record<string, any>, tags?: string[]) {
    this.log('critical', message, metadata, tags);
  }

  // Slot-specific logging
  logSlotEvent(slotId: string, action: string, metadata?: Record<string, any>) {
    this.info(`Slot event: ${action}`, {
      ...metadata,
      slotId,
      action,
      category: 'slot'
    }, ['slot', 'event']);
    
    this.trackAnalytics({
      type: 'slot_event',
      action,
      slotId,
      metadata
    });
  }

  // User-specific logging
  logUserEvent(userId: string, action: string, metadata?: Record<string, any>) {
    this.info(`User event: ${action}`, {
      ...metadata,
      userId,
      action,
      category: 'user'
    }, ['user', 'event']);
    
    this.trackAnalytics({
      type: 'user_action',
      action,
      userId,
      metadata
    });
  }

  // Auth-specific logging
  logAuthEvent(userId: string, action: string, metadata?: Record<string, any>) {
    this.info(`Auth event: ${action}`, {
      ...metadata,
      userId,
      action,
      category: 'auth'
    }, ['auth', 'event']);
    
    this.trackAnalytics({
      type: 'auth_event',
      action,
      userId,
      metadata
    });
  }

  // Performance logging
  logPerformance(operation: string, duration: number, metadata?: Record<string, any>) {
    this.info(`Performance: ${operation} took ${duration}ms`, {
      ...metadata,
      operation,
      duration,
      category: 'performance'
    }, ['performance']);
    
    this.trackAnalytics({
      type: 'performance_event',
      action: operation,
      metadata: { ...metadata, duration }
    });
  }

  // Error logging with stack trace
  logError(error: Error, context?: Record<string, any>) {
    this.critical(error.message, {
      stack: error.stack,
      name: error.name,
      ...context
    }, ['error', 'exception']);
    
    this.trackAnalytics({
      type: 'error_event',
      action: 'exception',
      metadata: {
        errorName: error.name,
        errorMessage: error.message,
        ...context
      }
    });
  }

  // Private log method
  private log(level: LogLevel, message: string, metadata?: Record<string, any>, tags?: string[]) {
    const entry: LogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      level,
      message,
      service: 'claudebox-multi-slot',
      metadata,
      tags
    };

    // Add context from metadata if available
    if (metadata) {
      if (metadata.slotId) entry.slotId = metadata.slotId;
      if (metadata.userId) entry.userId = metadata.userId;
      if (metadata.sessionId) entry.sessionId = metadata.sessionId;
    }

    // Buffer the log entry
    this.buffer.push(entry);

    // Console output if enabled
    if (this.config.enableConsole) {
      this.writeToConsole(entry);
    }

    // Flush if buffer is full
    if (this.buffer.length >= this.config.bufferSize) {
      this.flush();
    }
  }

  // Analytics tracking
  private trackAnalytics(event: Omit<AnalyticsEvent, 'id' | 'timestamp'>) {
    const analyticsEvent: AnalyticsEvent = {
      id: this.generateId(),
      timestamp: new Date(),
      ...event
    };

    const key = event.type;
    if (!this.analytics.has(key)) {
      this.analytics.set(key, []);
    }
    this.analytics.get(key)!.push(analyticsEvent);

    // Keep only last 1000 events per type
    const events = this.analytics.get(key)!;
    if (events.length > 1000) {
      this.analytics.set(key, events.slice(-1000));
    }
  }

  // Console output
  private writeToConsole(entry: LogEntry) {
    const timestamp = entry.timestamp.toISOString();
    const prefix = `[${timestamp}] [${entry.level.toUpperCase()}] [${entry.service}]`;
    
    let message = `${prefix} ${entry.message}`;
    
    if (entry.slotId) message += ` [slot:${entry.slotId}]`;
    if (entry.userId) message += ` [user:${entry.userId}]`;
    if (entry.metadata) message += ` ${JSON.stringify(entry.metadata)}`;
    if (entry.tags) message += ` [${entry.tags.join(',')}]`;

    switch (entry.level) {
      case 'debug':
        console.debug(message);
        break;
      case 'info':
        console.info(message);
        break;
      case 'warn':
        console.warn(message);
        break;
      case 'error':
      case 'critical':
        console.error(message);
        break;
    }
  }

  // Flush buffer to storage
  async flush() {
    if (this.buffer.length === 0) return;

    const logsToFlush = [...this.buffer];
    this.buffer = [];

    try {
      // File logging if enabled
      if (this.config.enableFile && this.config.filePath) {
        await this.writeToFile(logsToFlush);
      }

      // Remote logging if enabled
      if (this.config.enableRemote && this.config.remoteEndpoint) {
        await this.sendToRemote(logsToFlush);
      }

      // Rotate logs if needed
      if (this.config.enableFile) {
        await this.rotateLogs();
      }

    } catch (error) {
      console.error('Failed to flush logs:', error);
      // Put failed logs back in buffer
      this.buffer.unshift(...logsToFlush);
    }
  }

  // File operations
  private async writeToFile(logs: LogEntry[]) {
    // Mock file writing - in real implementation would write to file system
    console.log(`Writing ${logs.length} logs to file:`, this.config.filePath);
  }

  private async sendToRemote(logs: LogEntry[]) {
    // Mock remote logging - in real implementation would send to log aggregation service
    console.log(`Sending ${logs.length} logs to remote endpoint:`, this.config.remoteEndpoint);
  }

  private async rotateLogs() {
    // Mock log rotation - in real implementation would handle file rotation
    console.log('Rotating logs...');
  }

  // Setup periodic flush
  private setupFlushInterval() {
    if (this.flushTimeout) {
      clearInterval(this.flushTimeout);
    }
    
    this.flushTimeout = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  // Query methods
  async getLogs(filter: LogFilter, limit: number = 100, offset: number = 0): Promise<LogEntry[]> {
    // Mock query - in real implementation would query log storage
    const mockLogs: LogEntry[] = Array.from({ length: 50 }, (_, i) => ({
      id: `log-${i}`,
      timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
      level: ['debug', 'info', 'warn', 'error', 'critical'][Math.floor(Math.random() * 5)] as LogLevel,
      message: `Sample log message ${i}`,
      service: ['claudebox', 'auth', 'slot', 'monitoring'][Math.floor(Math.random() * 4)],
      slotId: Math.random() > 0.5 ? `slot-${Math.floor(Math.random() * 10)}` : undefined,
      userId: Math.random() > 0.5 ? `user-${Math.floor(Math.random() * 20)}` : undefined,
      metadata: { random: Math.random() },
      tags: ['sample', 'test']
    }));

    return mockLogs.slice(offset, offset + limit);
  }

  async getAnalytics(timeRange: { start: Date; end: Date }): Promise<LogAnalytics> {
    // Mock analytics - in real implementation would analyze actual log data
    return {
      totalLogs: 1250,
      logsByLevel: {
        debug: 300,
        info: 600,
        warn: 200,
        error: 120,
        critical: 30
      },
      logsByService: {
        claudebox: 500,
        auth: 300,
        slot: 250,
        monitoring: 200
      },
      logsByHour: Array.from({ length: 24 }, (_, i) => ({
        hour: `${i}:00`,
        count: Math.floor(Math.random() * 100) + 10
      })),
      errorRate: 0.12,
      topErrorMessages: [
        { message: 'Connection timeout', count: 25 },
        { message: 'Authentication failed', count: 18 },
        { message: 'Slot allocation failed', count: 12 }
      ],
      averageResponseTime: 245,
      uniqueUsers: 45,
      uniqueSlots: 20
    };
  }

  async exportLogs(options: LogExportOptions): Promise<string> {
    const logs = await this.getLogs(options.filter, options.limit || 1000, options.offset || 0);
    
    switch (options.format) {
      case 'json':
        return JSON.stringify(logs, null, 2);
      case 'csv':
        return this.exportToCSV(logs);
      case 'txt':
        return this.exportToText(logs);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  private exportToCSV(logs: LogEntry[]): string {
    const headers = ['timestamp', 'level', 'message', 'service', 'slotId', 'userId', 'metadata', 'tags'];
    const rows = logs.map(log => [
      log.timestamp.toISOString(),
      log.level,
      log.message.replace(/"/g, '""'),
      log.service,
      log.slotId || '',
      log.userId || '',
      JSON.stringify(log.metadata || {}).replace(/"/g, '""'),
      (log.tags || []).join(';')
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n');
  }

  private exportToText(logs: LogEntry[]): string {
    return logs.map(log => {
      const timestamp = log.timestamp.toISOString();
      const metadata = log.metadata ? ` ${JSON.stringify(log.metadata)}` : '';
      const tags = log.tags ? ` [${log.tags.join(',')}]` : '';
      return `[${timestamp}] [${log.level.toUpperCase()}] [${log.service}]${tags} ${log.message}${metadata}`;
    }).join('\n');
  }

  // Utility methods
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Configuration methods
  updateConfig(newConfig: Partial<LogConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.setupFlushInterval();
  }

  // Cleanup
  destroy() {
    if (this.flushTimeout) {
      clearInterval(this.flushTimeout);
    }
    this.flush();
  }
}

// Default configuration
export const defaultLogConfig: LogConfig = {
  level: 'info',
  format: 'json',
  enableConsole: true,
  enableFile: true,
  enableRemote: false,
  retentionDays: 30,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
  filePath: './logs/claudebox.log',
  bufferSize: 100,
  flushInterval: 5000 // 5 seconds
};

// Global logger instance
export const logger = new Logger(defaultLogConfig);