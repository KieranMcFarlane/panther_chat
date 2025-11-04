export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  service: string;
  slotId?: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
  tags?: string[];
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface LogFilter {
  level?: LogLevel | LogLevel[];
  service?: string | string[];
  slotId?: string | string[];
  userId?: string | string[];
  sessionId?: string | string[];
  tags?: string[];
  startDate?: Date;
  endDate?: Date;
  search?: string;
}

export interface LogAnalytics {
  totalLogs: number;
  logsByLevel: Record<LogLevel, number>;
  logsByService: Record<string, number>;
  logsByHour: { hour: string; count: number }[];
  errorRate: number;
  topErrorMessages: Array<{ message: string; count: number }>;
  averageResponseTime?: number;
  uniqueUsers?: number;
  uniqueSlots?: number;
}

export interface AnalyticsEvent {
  id: string;
  timestamp: Date;
  type: EventType;
  action: string;
  userId?: string;
  slotId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
  value?: number;
}

export type EventType = 
  | 'user_action'
  | 'slot_event'
  | 'system_event'
  | 'auth_event'
  | 'error_event'
  | 'performance_event';

export interface LogConfig {
  level: LogLevel;
  format: 'json' | 'text';
  enableConsole: boolean;
  enableFile: boolean;
  enableRemote: boolean;
  retentionDays: number;
  maxFileSize: number;
  maxFiles: number;
  filePath?: string;
  remoteEndpoint?: string;
  bufferSize: number;
  flushInterval: number;
}

export interface LogExportOptions {
  format: 'json' | 'csv' | 'txt';
  filter: LogFilter;
  limit?: number;
  offset?: number;
  sort?: {
    field: keyof LogEntry;
    order: 'asc' | 'desc';
  };
}