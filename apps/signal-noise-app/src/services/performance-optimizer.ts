import { 
  ResourceMetrics, 
  PerformanceMetrics, 
  ResourceLimit,
  ResourceAllocation,
  ResourceUsage,
  ConnectionPool,
  PerformanceProfile,
  OptimizationSettings,
  OptimizationStrategy,
  OptimizationResult,
  PerformanceAlert,
  PerformanceBaseline,
  LoadBalancerConfig,
  CacheConfig,
  CompressionConfig
} from '@/types/performance';
import { logger } from '@/services/logger';

export class PerformanceOptimizer {
  private resourceAllocations: Map<string, ResourceAllocation> = new Map();
  private connectionPools: Map<string, ConnectionPool> = new Map();
  private performanceProfiles: Map<string, PerformanceProfile> = new Map();
  private optimizationStrategies: Map<string, OptimizationStrategy> = new Map();
  private performanceBaselines: Map<string, PerformanceBaseline> = new Map();
  private performanceAlerts: Map<string, PerformanceAlert> = new Map();
  private cacheConfig: CacheConfig;
  private compressionConfig: CompressionConfig;
  private loadBalancerConfig: LoadBalancerConfig;
  private isRunning = false;
  private metricsHistory: ResourceMetrics[] = [];

  constructor() {
    this.initializeConfigs();
    this.initializeDefaultProfiles();
    this.initializeOptimizationStrategies();
    this.startMonitoring();
  }

  private initializeConfigs() {
    this.cacheConfig = {
      enabled: true,
      maxSize: 512, // 512MB
      ttl: 3600, // 1 hour
      strategy: 'lru',
      compression: true,
      persistence: false,
      stats: {
        hits: 0,
        misses: 0,
        hitRate: 0,
        size: 0,
        evictionCount: 0
      }
    };

    this.compressionConfig = {
      enabled: true,
      algorithm: 'gzip',
      level: 6,
      threshold: 1024, // 1KB
      excludedTypes: ['image/*', 'video/*', 'application/zip'],
      stats: {
        compressedSize: 0,
        originalSize: 0,
        ratio: 0,
        timeSaved: 0
      }
    };

    this.loadBalancerConfig = {
      algorithm: 'least-connections',
      healthCheckInterval: 10000, // 10 seconds
      healthCheckTimeout: 5000, // 5 seconds
      maxRetries: 3,
      retryDelay: 1000, // 1 second
      failTimeout: 30000, // 30 seconds
      connectionTimeout: 5000, // 5 seconds
      keepAlive: true,
      keepAliveTimeout: 30000 // 30 seconds
    };
  }

  private initializeDefaultProfiles() {
    const profiles: PerformanceProfile[] = [
      {
        id: 'default',
        name: 'Default Profile',
        description: 'Balanced performance for general use',
        resourceLimits: {
          maxCpuPercent: 80,
          maxMemoryMB: 2048,
          maxDiskMB: 10240,
          maxNetworkMBps: 100,
          maxProcesses: 50,
          maxConnections: 100,
          maxThreadsPerProcess: 20
        },
        optimizationSettings: {
          enableMemoryOptimization: true,
          enableCPUOptimization: true,
          enableNetworkOptimization: true,
          enableDiskOptimization: true,
          compressionEnabled: true,
          cachingEnabled: true,
          connectionPoolingEnabled: true,
          loadBalancingEnabled: true,
          autoScalingEnabled: false
        },
        priority: 1,
        isActive: true,
        createdAt: new Date(),
        lastModified: new Date()
      },
      {
        id: 'high-performance',
        name: 'High Performance',
        description: 'Optimized for maximum performance',
        resourceLimits: {
          maxCpuPercent: 95,
          maxMemoryMB: 4096,
          maxDiskMB: 20480,
          maxNetworkMBps: 200,
          maxProcesses: 100,
          maxConnections: 200,
          maxThreadsPerProcess: 40
        },
        optimizationSettings: {
          enableMemoryOptimization: true,
          enableCPUOptimization: true,
          enableNetworkOptimization: true,
          enableDiskOptimization: true,
          compressionEnabled: true,
          cachingEnabled: true,
          connectionPoolingEnabled: true,
          loadBalancingEnabled: true,
          autoScalingEnabled: true
        },
        priority: 2,
        isActive: false,
        createdAt: new Date(),
        lastModified: new Date()
      },
      {
        id: 'resource-conservative',
        name: 'Resource Conservative',
        description: 'Optimized for minimal resource usage',
        resourceLimits: {
          maxCpuPercent: 50,
          maxMemoryMB: 1024,
          maxDiskMB: 5120,
          maxNetworkMBps: 50,
          maxProcesses: 25,
          maxConnections: 50,
          maxThreadsPerProcess: 10
        },
        optimizationSettings: {
          enableMemoryOptimization: true,
          enableCPUOptimization: true,
          enableNetworkOptimization: true,
          enableDiskOptimization: true,
          compressionEnabled: true,
          cachingEnabled: true,
          connectionPoolingEnabled: true,
          loadBalancingEnabled: false,
          autoScalingEnabled: false
        },
        priority: 0,
        isActive: false,
        createdAt: new Date(),
        lastModified: new Date()
      }
    ];

    profiles.forEach(profile => {
      this.performanceProfiles.set(profile.id, profile);
    });
  }

  private initializeOptimizationStrategies() {
    const strategies: OptimizationStrategy[] = [
      {
        id: 'memory-gc',
        name: 'Memory Garbage Collection',
        type: 'memory',
        description: 'Optimize memory usage through aggressive garbage collection',
        implementation: 'forceGarbageCollection',
        parameters: { aggressive: true, threshold: 0.8 },
        effectiveness: 85,
        resourceImpact: { cpu: 15, memory: -25, network: 0, disk: 0 },
        isActive: true
      },
      {
        id: 'cpu-throttling',
        name: 'CPU Throttling',
        type: 'cpu',
        description: 'Limit CPU usage per process to prevent resource starvation',
        implementation: 'setProcessCPULimit',
        parameters: { limitPercent: 80, interval: 1000 },
        effectiveness: 90,
        resourceImpact: { cpu: -20, memory: 0, network: 0, disk: 0 },
        isActive: true
      },
      {
        id: 'connection-pooling',
        name: 'Connection Pooling',
        type: 'connection',
        description: 'Reuse connections to reduce overhead',
        implementation: 'createConnectionPool',
        parameters: { maxSize: 50, timeout: 30000 },
        effectiveness: 75,
        resourceImpact: { cpu: -10, memory: -15, network: -20, disk: 0 },
        isActive: true
      },
      {
        id: 'disk-caching',
        name: 'Disk Caching',
        type: 'disk',
        description: 'Cache frequently accessed data in memory',
        implementation: 'enableDiskCache',
        parameters: { size: 1024, strategy: 'lru' },
        effectiveness: 70,
        resourceImpact: { cpu: -5, memory: 10, network: -30, disk: -40 },
        isActive: true
      },
      {
        id: 'network-compression',
        name: 'Network Compression',
        type: 'network',
        description: 'Compress network traffic to reduce bandwidth usage',
        implementation: 'enableNetworkCompression',
        parameters: { algorithm: 'gzip', level: 6 },
        effectiveness: 65,
        resourceImpact: { cpu: 10, memory: 5, network: -35, disk: 0 },
        isActive: true
      }
    ];

    strategies.forEach(strategy => {
      this.optimizationStrategies.set(strategy.id, strategy);
    });
  }

  // Resource Management
  async allocateResources(slotId: string, userId: string, profileId: string): Promise<ResourceAllocation> {
    const profile = this.performanceProfiles.get(profileId);
    if (!profile) {
      throw new Error(`Performance profile not found: ${profileId}`);
    }

    const allocation: ResourceAllocation = {
      slotId,
      userId,
      limits: profile.resourceLimits,
      currentUsage: {
        cpuPercent: 0,
        memoryMB: 0,
        diskMB: 0,
        networkMBps: 0,
        processCount: 0,
        threadCount: 0,
        connectionCount: 0,
        timestamp: new Date()
      },
      priority: 'medium',
      guaranteed: true,
      createdAt: new Date(),
      lastUpdated: new Date()
    };

    this.resourceAllocations.set(slotId, allocation);
    
    logger.logSlotEvent(slotId, 'resources_allocated', { 
      profileId, 
      limits: allocation.limits 
    }, ['performance', 'resources']);

    return allocation;
  }

  async deallocateResources(slotId: string): Promise<boolean> {
    const allocation = this.resourceAllocations.get(slotId);
    if (!allocation) {
      return false;
    }

    this.resourceAllocations.delete(slotId);
    
    logger.logSlotEvent(slotId, 'resources_deallocated', { 
      userId: allocation.userId 
    }, ['performance', 'resources']);

    return true;
  }

  // Performance Monitoring
  async collectResourceMetrics(): Promise<ResourceMetrics> {
    // Mock resource metrics collection
    const metrics: ResourceMetrics = {
      timestamp: new Date(),
      cpu: {
        usage: Math.random() * 100,
        cores: 4,
        loadAverage: [Math.random() * 2, Math.random() * 2, Math.random() * 2],
        processCount: Math.floor(Math.random() * 200) + 50,
        threadCount: Math.floor(Math.random() * 1000) + 200
      },
      memory: {
        total: 16 * 1024 * 1024 * 1024,
        used: Math.random() * 12 * 1024 * 1024 * 1024,
        available: Math.random() * 4 * 1024 * 1024 * 1024,
        cached: Math.random() * 2 * 1024 * 1024 * 1024,
        buffers: Math.random() * 512 * 1024 * 1024,
        shared: Math.random() * 256 * 1024 * 1024,
        pageFaults: Math.floor(Math.random() * 1000),
        swapUsed: Math.random() * 2 * 1024 * 1024 * 1024,
        swapTotal: 4 * 1024 * 1024 * 1024
      },
      disk: {
        total: 500 * 1024 * 1024 * 1024,
        used: Math.random() * 400 * 1024 * 1024 * 1024,
        available: Math.random() * 100 * 1024 * 1024 * 1024,
        readSpeed: Math.random() * 200 + 50,
        writeSpeed: Math.random() * 150 + 25,
        iops: Math.floor(Math.random() * 1000) + 100
      },
      network: {
        bytesIn: Math.random() * 1000000,
        bytesOut: Math.random() * 800000,
        packetsIn: Math.floor(Math.random() * 10000),
        packetsOut: Math.floor(Math.random() * 8000),
        connections: Math.floor(Math.random() * 500) + 50,
        activeConnections: Math.floor(Math.random() * 200) + 20
      },
      processes: {
        total: Math.floor(Math.random() * 200) + 50,
        running: Math.floor(Math.random() * 50) + 10,
        sleeping: Math.floor(Math.random() * 150) + 30,
        stopped: Math.floor(Math.random() * 10),
        zombie: Math.floor(Math.random() * 5)
      }
    };

    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > 1000) {
      this.metricsHistory = this.metricsHistory.slice(-1000);
    }

    return metrics;
  }

  // Optimization Execution
  async applyOptimization(strategyId: string, slotId?: string): Promise<OptimizationResult> {
    const strategy = this.optimizationStrategies.get(strategyId);
    if (!strategy) {
      throw new Error(`Optimization strategy not found: ${strategyId}`);
    }

    const beforeMetrics = await this.collectPerformanceMetrics();
    
    try {
      logger.info(`Applying optimization strategy: ${strategy.name}`, { 
        strategyId, 
        slotId,
        parameters: strategy.parameters 
      }, ['performance', 'optimization']);

      // Apply the optimization
      await this.executeOptimizationStrategy(strategy, slotId);

      strategy.lastApplied = new Date();
      
      const afterMetrics = await this.collectPerformanceMetrics();
      const result = this.calculateOptimizationResult(strategy, beforeMetrics, afterMetrics);
      
      strategy.results = result;

      logger.info(`Optimization completed: ${strategy.name}`, { 
        strategyId, 
        slotId,
        improvement: result.improvement 
      }, ['performance', 'optimization']);

      return result;

    } catch (error) {
      logger.logError(error, { 
        strategyId, 
        slotId, 
        operation: 'apply_optimization' 
      });

      return {
        strategyId,
        timestamp: new Date(),
        beforeMetrics,
        afterMetrics: beforeMetrics,
        improvement: { responseTime: 0, throughput: 0, errorRate: 0, resourceUsage: 0 },
        success: false,
        errors: [error.message]
      };
    }
  }

  private async executeOptimizationStrategy(strategy: OptimizationStrategy, slotId?: string) {
    switch (strategy.implementation) {
      case 'forceGarbageCollection':
        await this.forceGarbageCollection();
        break;
      case 'setProcessCPULimit':
        await this.setProcessCPULimit(strategy.parameters.limitPercent);
        break;
      case 'createConnectionPool':
        await this.createConnectionPool(slotId || 'default', strategy.parameters);
        break;
      case 'enableDiskCache':
        await this.enableDiskCache(strategy.parameters);
        break;
      case 'enableNetworkCompression':
        await this.enableNetworkCompression(strategy.parameters);
        break;
    }
  }

  private async forceGarbageCollection() {
    // Mock garbage collection
    logger.debug('Forcing garbage collection', {}, ['performance', 'memory']);
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async setProcessCPULimit(limitPercent: number) {
    // Mock CPU limiting
    logger.debug(`Setting CPU limit to ${limitPercent}%`, {}, ['performance', 'cpu']);
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  private async createConnectionPool(poolId: string, parameters: any) {
    const pool: ConnectionPool = {
      id: poolId,
      type: 'http',
      host: 'localhost',
      port: 3000,
      maxSize: parameters.maxSize,
      currentSize: 0,
      availableConnections: 0,
      activeConnections: 0,
      totalConnectionsCreated: 0,
      totalConnectionsClosed: 0,
      averageWaitTime: 0,
      averageResponseTime: 0,
      lastActivity: new Date(),
      status: 'active'
    };

    this.connectionPools.set(poolId, pool);
    logger.debug(`Created connection pool: ${poolId}`, { parameters }, ['performance', 'connection']);
  }

  private async enableDiskCache(parameters: any) {
    logger.debug(`Enabling disk cache`, { parameters }, ['performance', 'disk']);
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  private async enableNetworkCompression(parameters: any) {
    logger.debug(`Enabling network compression`, { parameters }, ['performance', 'network']);
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  private async collectPerformanceMetrics(): Promise<PerformanceMetrics> {
    // Mock performance metrics
    return {
      responseTime: Math.random() * 1000 + 100,
      throughput: Math.random() * 1000 + 100,
      errorRate: Math.random() * 0.05,
      availability: 0.99 + Math.random() * 0.01,
      resourceUtilization: {
        cpu: Math.random() * 100,
        memory: Math.random() * 100,
        disk: Math.random() * 100,
        network: Math.random() * 100
      },
      queueMetrics: {
        length: Math.floor(Math.random() * 50),
        waitTime: Math.random() * 1000,
        processingTime: Math.random() * 2000
      }
    };
  }

  private calculateOptimizationResult(
    strategy: OptimizationStrategy,
    beforeMetrics: PerformanceMetrics,
    afterMetrics: PerformanceMetrics
  ): OptimizationResult {
    const responseTimeImprovement = ((beforeMetrics.responseTime - afterMetrics.responseTime) / beforeMetrics.responseTime) * 100;
    const throughputImprovement = ((afterMetrics.throughput - beforeMetrics.throughput) / beforeMetrics.throughput) * 100;
    const errorRateImprovement = ((beforeMetrics.errorRate - afterMetrics.errorRate) / beforeMetrics.errorRate) * 100;
    const resourceUsageImprovement = (
      (beforeMetrics.resourceUtilization.cpu + beforeMetrics.resourceUtilization.memory + beforeMetrics.resourceUtilization.network) -
      (afterMetrics.resourceUtilization.cpu + afterMetrics.resourceUtilization.memory + afterMetrics.resourceUtilization.network)
    ) / 3;

    return {
      strategyId: strategy.id,
      timestamp: new Date(),
      beforeMetrics,
      afterMetrics,
      improvement: {
        responseTime: responseTimeImprovement,
        throughput: throughputImprovement,
        errorRate: errorRateImprovement,
        resourceUsage: resourceUsageImprovement
      },
      success: true
    };
  }

  // Alert Management
  async checkPerformanceThresholds(metrics: ResourceMetrics): Promise<PerformanceAlert[]> {
    const alerts: PerformanceAlert[] = [];
    const thresholds = {
      cpu: 90,
      memory: 85,
      disk: 80,
      network: 95,
      responseTime: 5000,
      errorRate: 0.05
    };

    if (metrics.cpu.usage > thresholds.cpu) {
      alerts.push(this.createAlert('critical', 'cpu', `CPU usage is ${metrics.cpu.usage.toFixed(1)}%`, thresholds.cpu, metrics.cpu.usage));
    }

    const memoryUsagePercent = (metrics.memory.used / metrics.memory.total) * 100;
    if (memoryUsagePercent > thresholds.memory) {
      alerts.push(this.createAlert('critical', 'memory', `Memory usage is ${memoryUsagePercent.toFixed(1)}%`, thresholds.memory, memoryUsagePercent));
    }

    const diskUsagePercent = (metrics.disk.used / metrics.disk.total) * 100;
    if (diskUsagePercent > thresholds.disk) {
      alerts.push(this.createAlert('warning', 'disk', `Disk usage is ${diskUsagePercent.toFixed(1)}%`, thresholds.disk, diskUsagePercent));
    }

    alerts.forEach(alert => {
      this.performanceAlerts.set(alert.id, alert);
      logger.warn(`Performance alert: ${alert.message}`, { 
        alertId: alert.id,
        category: alert.category,
        currentValue: alert.currentValue
      }, ['performance', 'alert']);
    });

    return alerts;
  }

  private createAlert(
    type: 'warning' | 'critical',
    category: PerformanceAlert['category'],
    message: string,
    threshold: number,
    currentValue: number
  ): PerformanceAlert {
    return {
      id: this.generateId(),
      type,
      category,
      message,
      threshold,
      currentValue,
      severity: type === 'critical' ? 'high' : 'medium',
      timestamp: new Date(),
      resolved: false,
      recommendedAction: this.getRecommendedAction(category, currentValue)
    };
  }

  private getRecommendedAction(category: PerformanceAlert['category'], value: number): string {
    switch (category) {
      case 'cpu':
        return 'Apply CPU throttling optimization or scale up resources';
      case 'memory':
        return 'Clear memory cache or increase available memory';
      case 'disk':
        return 'Clean up disk space or increase storage capacity';
      case 'network':
        return 'Optimize network usage or increase bandwidth';
      default:
        return 'Review system performance and apply optimizations';
    }
  }

  // Performance Baseline
  async createPerformanceBaseline(name: string, description: string, durationMs: number = 60000): Promise<PerformanceBaseline> {
    logger.info(`Creating performance baseline: ${name}`, { durationMs }, ['performance', 'baseline']);

    const samples: PerformanceMetrics[] = [];
    const resourceSamples: ResourceMetrics[] = [];
    const sampleInterval = 1000; // 1 second
    const sampleCount = Math.floor(durationMs / sampleInterval);

    for (let i = 0; i < sampleCount; i++) {
      samples.push(await this.collectPerformanceMetrics());
      resourceSamples.push(await this.collectResourceMetrics());
      await new Promise(resolve => setTimeout(resolve, sampleInterval));
    }

    const baseline: PerformanceBaseline = {
      id: this.generateId(),
      name,
      description,
      metrics: this.calculateAverageMetrics(samples),
      resourceMetrics: this.calculateAverageResourceMetrics(resourceSamples),
      sampleSize: sampleCount,
      duration: durationMs,
      createdAt: new Date(),
      isActive: true,
      tags: ['baseline', 'performance']
    };

    this.performanceBaselines.set(baseline.id, baseline);
    
    logger.info(`Performance baseline created: ${name}`, { 
      baselineId: baseline.id,
      sampleCount,
      durationMs
    }, ['performance', 'baseline']);

    return baseline;
  }

  private calculateAverageMetrics(samples: PerformanceMetrics[]): PerformanceMetrics {
    return {
      responseTime: samples.reduce((sum, m) => sum + m.responseTime, 0) / samples.length,
      throughput: samples.reduce((sum, m) => sum + m.throughput, 0) / samples.length,
      errorRate: samples.reduce((sum, m) => sum + m.errorRate, 0) / samples.length,
      availability: samples.reduce((sum, m) => sum + m.availability, 0) / samples.length,
      resourceUtilization: {
        cpu: samples.reduce((sum, m) => sum + m.resourceUtilization.cpu, 0) / samples.length,
        memory: samples.reduce((sum, m) => sum + m.resourceUtilization.memory, 0) / samples.length,
        disk: samples.reduce((sum, m) => sum + m.resourceUtilization.disk, 0) / samples.length,
        network: samples.reduce((sum, m) => sum + m.resourceUtilization.network, 0) / samples.length
      },
      queueMetrics: {
        length: samples.reduce((sum, m) => sum + m.queueMetrics.length, 0) / samples.length,
        waitTime: samples.reduce((sum, m) => sum + m.queueMetrics.waitTime, 0) / samples.length,
        processingTime: samples.reduce((sum, m) => sum + m.queueMetrics.processingTime, 0) / samples.length
      }
    };
  }

  private calculateAverageResourceMetrics(samples: ResourceMetrics[]): ResourceMetrics {
    return {
      timestamp: new Date(),
      cpu: {
        usage: samples.reduce((sum, m) => sum + m.cpu.usage, 0) / samples.length,
        cores: samples[0].cpu.cores,
        loadAverage: [
          samples.reduce((sum, m) => sum + m.cpu.loadAverage[0], 0) / samples.length,
          samples.reduce((sum, m) => sum + m.cpu.loadAverage[1], 0) / samples.length,
          samples.reduce((sum, m) => sum + m.cpu.loadAverage[2], 0) / samples.length
        ],
        processCount: Math.floor(samples.reduce((sum, m) => sum + m.cpu.processCount, 0) / samples.length),
        threadCount: Math.floor(samples.reduce((sum, m) => sum + m.cpu.threadCount, 0) / samples.length)
      },
      memory: {
        total: samples[0].memory.total,
        used: samples.reduce((sum, m) => sum + m.memory.used, 0) / samples.length,
        available: samples.reduce((sum, m) => sum + m.memory.available, 0) / samples.length,
        cached: samples.reduce((sum, m) => sum + m.memory.cached, 0) / samples.length,
        buffers: samples.reduce((sum, m) => sum + m.memory.buffers, 0) / samples.length,
        shared: samples.reduce((sum, m) => sum + m.memory.shared, 0) / samples.length,
        pageFaults: Math.floor(samples.reduce((sum, m) => sum + m.memory.pageFaults, 0) / samples.length),
        swapUsed: samples.reduce((sum, m) => sum + m.memory.swapUsed, 0) / samples.length,
        swapTotal: samples[0].memory.swapTotal
      },
      disk: {
        total: samples[0].disk.total,
        used: samples.reduce((sum, m) => sum + m.disk.used, 0) / samples.length,
        available: samples.reduce((sum, m) => sum + m.disk.available, 0) / samples.length,
        readSpeed: samples.reduce((sum, m) => sum + m.disk.readSpeed, 0) / samples.length,
        writeSpeed: samples.reduce((sum, m) => sum + m.disk.writeSpeed, 0) / samples.length,
        iops: Math.floor(samples.reduce((sum, m) => sum + m.disk.iops, 0) / samples.length)
      },
      network: {
        bytesIn: samples.reduce((sum, m) => sum + m.network.bytesIn, 0) / samples.length,
        bytesOut: samples.reduce((sum, m) => sum + m.network.bytesOut, 0) / samples.length,
        packetsIn: Math.floor(samples.reduce((sum, m) => sum + m.network.packetsIn, 0) / samples.length),
        packetsOut: Math.floor(samples.reduce((sum, m) => sum + m.network.packetsOut, 0) / samples.length),
        connections: Math.floor(samples.reduce((sum, m) => sum + m.network.connections, 0) / samples.length),
        activeConnections: Math.floor(samples.reduce((sum, m) => sum + m.network.activeConnections, 0) / samples.length)
      },
      processes: {
        total: Math.floor(samples.reduce((sum, m) => sum + m.processes.total, 0) / samples.length),
        running: Math.floor(samples.reduce((sum, m) => sum + m.processes.running, 0) / samples.length),
        sleeping: Math.floor(samples.reduce((sum, m) => sum + m.processes.sleeping, 0) / samples.length),
        stopped: Math.floor(samples.reduce((sum, m) => sum + m.processes.stopped, 0) / samples.length),
        zombie: Math.floor(samples.reduce((sum, m) => sum + m.processes.zombie, 0) / samples.length)
      }
    };
  }

  // Auto-optimization
  async autoOptimize(): Promise<OptimizationResult[]> {
    const currentMetrics = await this.collectResourceMetrics();
    const alerts = await this.checkPerformanceThresholds(currentMetrics);
    const results: OptimizationResult[] = [];

    for (const alert of alerts) {
      if (alert.type === 'critical') {
        const strategies = this.getApplicableStrategies(alert.category);
        for (const strategy of strategies) {
          if (strategy.isActive) {
            const result = await this.applyOptimization(strategy.id);
            results.push(result);
            if (result.success) {
              alert.resolved = true;
              alert.resolvedAt = new Date();
            }
          }
        }
      }
    }

    return results;
  }

  private getApplicableStrategies(category: PerformanceAlert['category']): OptimizationStrategy[] {
    const strategyMap: Record<string, string[]> = {
      cpu: ['cpu-throttling'],
      memory: ['memory-gc'],
      network: ['network-compression', 'connection-pooling'],
      disk: ['disk-caching']
    };

    const applicableStrategyIds = strategyMap[category] || [];
    return Array.from(this.optimizationStrategies.values())
      .filter(strategy => applicableStrategyIds.includes(strategy.id) && strategy.isActive);
  }

  // Periodic monitoring
  private startMonitoring() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    // Auto-optimization every 5 minutes
    setInterval(() => {
      this.autoOptimize();
    }, 5 * 60 * 1000);
    
    // Resource monitoring every 30 seconds
    setInterval(() => {
      this.collectResourceMetrics();
    }, 30 * 1000);
    
    // Performance baseline check every hour
    setInterval(() => {
      this.checkPerformanceBaselines();
    }, 60 * 60 * 1000);
  }

  private async checkPerformanceBaselines() {
    const currentMetrics = await this.collectPerformanceMetrics();
    
    for (const baseline of this.performanceBaselines.values()) {
      if (baseline.isActive) {
        const degradation = this.calculateDegradation(baseline.metrics, currentMetrics);
        if (degradation > 20) { // 20% degradation threshold
          logger.warn(`Performance degradation detected for baseline: ${baseline.name}`, {
            baselineId: baseline.id,
            degradation: `${degradation.toFixed(1)}%`
          }, ['performance', 'baseline', 'alert']);
        }
      }
    }
  }

  private calculateDegradation(baseline: PerformanceMetrics, current: PerformanceMetrics): number {
    const responseTimeDegradation = ((current.responseTime - baseline.responseTime) / baseline.responseTime) * 100;
    const throughputDegradation = ((baseline.throughput - current.throughput) / baseline.throughput) * 100;
    const errorRateDegradation = ((current.errorRate - baseline.errorRate) / baseline.errorRate) * 100;
    
    return Math.max(responseTimeDegradation, throughputDegradation, errorRateDegradation);
  }

  // Utility methods
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API methods
  getResourceAllocations(): ResourceAllocation[] {
    return Array.from(this.resourceAllocations.values());
  }

  getConnectionPools(): ConnectionPool[] {
    return Array.from(this.connectionPools.values());
  }

  getPerformanceProfiles(): PerformanceProfile[] {
    return Array.from(this.performanceProfiles.values());
  }

  getOptimizationStrategies(): OptimizationStrategy[] {
    return Array.from(this.optimizationStrategies.values());
  }

  getPerformanceAlerts(): PerformanceAlert[] {
    return Array.from(this.performanceAlerts.values());
  }

  getPerformanceBaselines(): PerformanceBaseline[] {
    return Array.from(this.performanceBaselines.values());
  }

  getConfigs() {
    return {
      cache: this.cacheConfig,
      compression: this.compressionConfig,
      loadBalancer: this.loadBalancerConfig
    };
  }

  updateConfigs(newConfigs: Partial<{
    cache: Partial<CacheConfig>;
    compression: Partial<CompressionConfig>;
    loadBalancer: Partial<LoadBalancerConfig>;
  }>) {
    if (newConfigs.cache) {
      this.cacheConfig = { ...this.cacheConfig, ...newConfigs.cache };
    }
    if (newConfigs.compression) {
      this.compressionConfig = { ...this.compressionConfig, ...newConfigs.compression };
    }
    if (newConfigs.loadBalancer) {
      this.loadBalancerConfig = { ...this.loadBalancerConfig, ...newConfigs.loadBalancer };
    }
  }

  // Cleanup
  destroy() {
    this.isRunning = false;
  }
}

// Global performance optimizer instance
export const performanceOptimizer = new PerformanceOptimizer();

// Performance monitoring functions
let monitoringInterval: NodeJS.Timeout | null = null;

export const startPerformanceMonitoring = async () => {
  if (monitoringInterval) return;
  
  await performanceOptimizer.start();
  monitoringInterval = setInterval(() => {
    performanceOptimizer.collectMetrics();
  }, 5000);
};

export const stopPerformanceMonitoring = () => {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
  performanceOptimizer.destroy();
};