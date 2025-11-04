export interface LoadTestConfig {
  id: string;
  name: string;
  description: string;
  duration: number; // in seconds
  concurrentUsers: number;
  rampUpTime: number; // in seconds
  scenario: LoadTestScenario;
  thresholds: PerformanceThresholds;
  enabled: boolean;
  createdAt: Date;
  lastModified: Date;
}

export interface LoadTestScenario {
  id: string;
  name: string;
  type: 'user_simulation' | 'slot_allocation' | 'api_load' | 'stress_test';
  steps: LoadTestStep[];
  thinkTime: {
    min: number;
    max: number;
  };
  distribution: 'uniform' | 'normal' | 'exponential';
}

export interface LoadTestStep {
  id: string;
  name: string;
  type: 'request' | 'slot_create' | 'slot_destroy' | 'auth' | 'wait';
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  expectedStatus?: number;
  timeout?: number;
  duration?: number; // for wait steps
  weight: number; // for step selection probability
}

export interface PerformanceThresholds {
  responseTime: {
    avg: number;
    p95: number;
    p99: number;
    max: number;
  };
  errorRate: {
    percentage: number;
    maxErrors: number;
  };
  throughput: {
    minRequestsPerSecond: number;
    maxRequestsPerSecond: number;
  };
  resourceUtilization: {
    maxCpu: number;
    maxMemory: number;
    maxDiskIO: number;
    maxNetworkIO: number;
  };
}

export interface LoadTestResult {
  id: string;
  testId: string;
  configId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  summary: LoadTestSummary;
  metrics: LoadTestMetrics;
  resourceMetrics: ResourceTestMetrics[];
  errors: TestError[];
  thresholds: ThresholdValidationResult;
  recommendations: string[];
  report: LoadTestReport;
}

export interface LoadTestSummary {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  errorRate: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number; // requests per second
  concurrentUsers: number;
  peakThroughput: number;
}

export interface LoadTestMetrics {
  timeline: TestTimelinePoint[];
  responseTimeHistogram: HistogramBin[];
  throughputOverTime: ThroughputPoint[];
  errorRateOverTime: ErrorRatePoint[];
  userCountOverTime: UserCountPoint[];
  resourceUtilization: ResourceUtilizationOverTime[];
}

export interface TestTimelinePoint {
  timestamp: Date;
  elapsed: number; // seconds since test start
  virtualUsers: number;
  activeConnections: number;
  responseTime: number;
  throughput: number;
  errorRate: number;
}

export interface HistogramBin {
  start: number;
  end: number;
  count: number;
  percentage: number;
}

export interface ThroughputPoint {
  timestamp: Date;
  requestsPerSecond: number;
  successfulRequests: number;
  failedRequests: number;
}

export interface ErrorRatePoint {
  timestamp: Date;
  errorCount: number;
  totalRequests: number;
  errorRate: number;
}

export interface UserCountPoint {
  timestamp: Date;
  activeUsers: number;
  rampingUsers: number;
  steadyUsers: number;
}

export interface ResourceUtilizationOverTime {
  timestamp: Date;
  cpu: number;
  memory: number;
  diskIO: number;
  networkIO: number;
  slotUtilization: number;
}

export interface ResourceTestMetrics {
  timestamp: Date;
  instanceId: string;
  metrics: {
    cpu: {
      usage: number;
      loadAverage: number[];
    };
    memory: {
      usage: number;
      available: number;
      pageFaults: number;
    };
    disk: {
      readSpeed: number;
      writeSpeed: number;
      iops: number;
    };
    network: {
      bytesIn: number;
      bytesOut: number;
      connections: number;
    };
    slots: {
      total: number;
      active: number;
      pending: number;
    };
  };
}

export interface TestError {
  id: string;
  timestamp: Date;
  type: 'http_error' | 'timeout' | 'connection_error' | 'validation_error' | 'system_error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  stack?: string;
  request?: {
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: any;
  };
  response?: {
    status: number;
    headers?: Record<string, string>;
    body?: any;
  };
  virtualUserId?: string;
  stepId?: string;
  count: number;
}

export interface ThresholdValidationResult {
  responseTime: {
    avg: ThresholdCheck;
    p95: ThresholdCheck;
    p99: ThresholdCheck;
    max: ThresholdCheck;
  };
  errorRate: ThresholdCheck;
  throughput: {
    min: ThresholdCheck;
    max: ThresholdCheck;
  };
  resourceUtilization: {
    cpu: ThresholdCheck;
    memory: ThresholdCheck;
    diskIO: ThresholdCheck;
    networkIO: ThresholdCheck;
  };
  overall: ThresholdCheck;
}

export interface ThresholdCheck {
  passed: boolean;
  actual: number;
  threshold: number;
  percentage: number; // actual as percentage of threshold
  violation: boolean;
  message?: string;
}

export interface LoadTestReport {
  id: string;
  testId: string;
  generatedAt: Date;
  format: 'html' | 'json' | 'pdf' | 'csv';
  sections: ReportSection[];
  summary: {
    executiveSummary: string;
    keyFindings: string[];
    recommendations: string[];
    nextSteps: string[];
  };
  charts: ReportChart[];
  tables: ReportTable[];
}

export interface ReportSection {
  id: string;
  title: string;
  type: 'summary' | 'metrics' | 'analysis' | 'recommendations' | 'appendix';
  content: string;
  charts?: string[];
  tables?: string[];
}

export interface ReportChart {
  id: string;
  title: string;
  type: 'line' | 'bar' | 'histogram' | 'scatter' | 'heatmap';
  data: any;
  options?: any;
}

export interface ReportTable {
  id: string;
  title: string;
  columns: TableColumn[];
  rows: any[][];
  summary?: string;
}

export interface TableColumn {
  id: string;
  name: string;
  type: 'string' | 'number' | 'date' | 'percentage';
  format?: string;
}

export interface LoadTestTemplate {
  id: string;
  name: string;
  description: string;
  category: 'performance' | 'stress' | 'volume' | 'spike' | 'endurance';
  scenarios: LoadTestScenario[];
  defaultThresholds: PerformanceThresholds;
  recommendedConfig: Partial<LoadTestConfig>;
  tags: string[];
  isPublic: boolean;
  createdAt: Date;
  createdBy: string;
}

export interface LoadTestSchedule {
  id: string;
  name: string;
  configId: string;
  schedule: {
    type: 'once' | 'recurring';
    startTime: Date;
    endDate?: Date;
    frequency?: 'hourly' | 'daily' | 'weekly' | 'monthly';
    days?: number[]; // for weekly: 0-6 (Sun-Sat)
    time?: string; // HH:mm format
  };
  notifications: {
    email?: string[];
    webhook?: string;
    slack?: string;
  };
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  createdAt: Date;
}

export interface TestEnvironment {
  id: string;
  name: string;
  type: 'development' | 'staging' | 'production';
  baseUrl: string;
  auth: {
    type: 'none' | 'basic' | 'bearer' | 'oauth';
    credentials?: any;
  };
  headers?: Record<string, string>;
  capacity: {
    maxConcurrentUsers: number;
    maxRequestsPerSecond: number;
  };
  monitoring: {
    enabled: boolean;
    metricsInterval: number;
    resourceMetrics: boolean;
    customMetrics?: string[];
  };
  status: 'active' | 'inactive' | 'maintenance';
  createdAt: Date;
  lastModified: Date;
}