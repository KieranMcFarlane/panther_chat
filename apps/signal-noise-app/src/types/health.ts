export interface HealthCheck {
  id: string;
  serviceName: string;
  status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
  lastCheck: Date;
  responseTime: number;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number;
    cores: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    available: number;
    percentage: number;
  };
  disk: {
    total: number;
    used: number;
    available: number;
    percentage: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
  };
  services: HealthCheck[];
}

export interface HealthAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  service: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
}

export interface MonitoringConfig {
  checkInterval: number;
  alertThresholds: {
    cpu: number;
    memory: number;
    disk: number;
    responseTime: number;
  };
  recoveryActions: {
    autoRestart: boolean;
    maxRetries: number;
    retryDelay: number;
  };
  notifications: {
    enabled: boolean;
    channels: ('email' | 'webhook' | 'console')[];
  };
}