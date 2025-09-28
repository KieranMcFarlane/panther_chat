export interface ResourceMetrics {
  timestamp: Date;
  cpu: {
    usage: number;
    cores: number;
    loadAverage: number[];
    processCount: number;
    threadCount: number;
  };
  memory: {
    total: number;
    used: number;
    available: number;
    cached: number;
    buffers: number;
    shared: number;
    pageFaults: number;
    swapUsed: number;
    swapTotal: number;
  };
  disk: {
    total: number;
    used: number;
    available: number;
    readSpeed: number;
    writeSpeed: number;
    iops: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
    connections: number;
    activeConnections: number;
  };
  processes: {
    total: number;
    running: number;
    sleeping: number;
    stopped: number;
    zombie: number;
  };
}

export interface PerformanceMetrics {
  responseTime: number;
  throughput: number;
  errorRate: number;
  availability: number;
  resourceUtilization: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
  queueMetrics: {
    length: number;
    waitTime: number;
    processingTime: number;
  };
}

export interface ResourceLimit {
  maxCpuPercent: number;
  maxMemoryMB: number;
  maxDiskMB: number;
  maxNetworkMBps: number;
  maxProcesses: number;
  maxConnections: number;
  maxThreadsPerProcess: number;
}

export interface ResourceAllocation {
  slotId: string;
  userId: string;
  limits: ResourceLimit;
  currentUsage: ResourceUsage;
  priority: 'low' | 'medium' | 'high' | 'critical';
  guaranteed: boolean;
  createdAt: Date;
  lastUpdated: Date;
}

export interface ResourceUsage {
  cpuPercent: number;
  memoryMB: number;
  diskMB: number;
  networkMBps: number;
  processCount: number;
  threadCount: number;
  connectionCount: number;
  timestamp: Date;
}

export interface ConnectionPool {
  id: string;
  type: 'http' | 'websocket' | 'ssh' | 'database';
  host: string;
  port: number;
  maxSize: number;
  currentSize: number;
  availableConnections: number;
  activeConnections: number;
  totalConnectionsCreated: number;
  totalConnectionsClosed: number;
  averageWaitTime: number;
  averageResponseTime: number;
  lastActivity: Date;
  status: 'active' | 'idle' | 'error' | 'maintenance';
}

export interface PerformanceProfile {
  id: string;
  name: string;
  description: string;
  resourceLimits: ResourceLimit;
  optimizationSettings: OptimizationSettings;
  priority: number;
  isActive: boolean;
  createdAt: Date;
  lastModified: Date;
}

export interface OptimizationSettings {
  enableMemoryOptimization: boolean;
  enableCPUOptimization: boolean;
  enableNetworkOptimization: boolean;
  enableDiskOptimization: boolean;
  compressionEnabled: boolean;
  cachingEnabled: boolean;
  connectionPoolingEnabled: boolean;
  loadBalancingEnabled: boolean;
  autoScalingEnabled: boolean;
}

export interface OptimizationStrategy {
  id: string;
  name: string;
  type: 'memory' | 'cpu' | 'network' | 'disk' | 'connection';
  description: string;
  implementation: string;
  parameters: Record<string, any>;
  effectiveness: number; // 0-100
  resourceImpact: {
    cpu: number;
    memory: number;
    network: number;
    disk: number;
  };
  isActive: boolean;
  lastApplied?: Date;
  results?: OptimizationResult;
}

export interface OptimizationResult {
  strategyId: string;
  timestamp: Date;
  beforeMetrics: PerformanceMetrics;
  afterMetrics: PerformanceMetrics;
  improvement: {
    responseTime: number; // percentage
    throughput: number; // percentage
    errorRate: number; // percentage
    resourceUsage: number; // percentage
  };
  success: boolean;
  errors?: string[];
  notes?: string;
}

export interface PerformanceAlert {
  id: string;
  type: 'warning' | 'critical';
  category: 'cpu' | 'memory' | 'disk' | 'network' | 'response_time' | 'error_rate';
  message: string;
  threshold: number;
  currentValue: number;
  severity: 'low' | 'medium' | 'high';
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  recommendedAction: string;
  slotId?: string;
  userId?: string;
}

export interface PerformanceBaseline {
  id: string;
  name: string;
  description: string;
  metrics: PerformanceMetrics;
  resourceMetrics: ResourceMetrics;
  sampleSize: number;
  duration: number; // in milliseconds
  createdAt: Date;
  isActive: boolean;
  tags: string[];
}

export interface LoadBalancerConfig {
  algorithm: 'round-robin' | 'least-connections' | 'weighted-round-robin' | 'ip-hash';
  healthCheckInterval: number;
  healthCheckTimeout: number;
  maxRetries: number;
  retryDelay: number;
  failTimeout: number;
  connectionTimeout: number;
  keepAlive: boolean;
  keepAliveTimeout: number;
}

export interface CacheConfig {
  enabled: boolean;
  maxSize: number; // in MB
  ttl: number; // in seconds
  strategy: 'lru' | 'lfu' | 'fifo' | 'random';
  compression: boolean;
  persistence: boolean;
  persistencePath?: string;
  stats: {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
    evictionCount: number;
  };
}

export interface CompressionConfig {
  enabled: boolean;
  algorithm: 'gzip' | 'brotli' | 'deflate';
  level: number; // 1-9
  threshold: number; // minimum size in bytes to compress
  excludedTypes: string[];
  stats: {
    compressedSize: number;
    originalSize: number;
    ratio: number;
    timeSaved: number;
  };
}