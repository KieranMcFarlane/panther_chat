import { HealthCheck, SystemMetrics, HealthAlert, MonitoringConfig } from '@/types/health';

export class HealthMonitor {
  private config: MonitoringConfig;
  private checks: Map<string, () => Promise<HealthCheck>> = new Map();
  private metrics: SystemMetrics | null = null;
  private alerts: HealthAlert[] = [];
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;

  constructor(config: MonitoringConfig) {
    this.config = config;
    this.initializeDefaultChecks();
  }

  private initializeDefaultChecks() {
    // System health checks
    this.addCheck('system-cpu', this.checkCPUHealth);
    this.addCheck('system-memory', this.checkMemoryHealth);
    this.addCheck('system-disk', this.checkDiskHealth);
    this.addCheck('system-network', this.checkNetworkHealth);
    
    // Service health checks
    this.addCheck('ssh-tunnel', this.checkSSHTunnel);
    this.addCheck('ttyd-service', this.checkTTYDService);
    this.addCheck('claudebox-slots', this.checkClaudeboxSlots);
    this.addCheck('better-auth', this.checkBetterAuth);
  }

  addCheck(name: string, checkFunction: () => Promise<HealthCheck>) {
    this.checks.set(name, checkFunction);
  }

  async start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('Health monitoring started');
    
    // Initial check
    await this.runHealthChecks();
    
    // Start periodic checks
    this.intervalId = setInterval(
      () => this.runHealthChecks(),
      this.config.checkInterval
    );
  }

  async stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    
    console.log('Health monitoring stopped');
  }

  private async runHealthChecks() {
    try {
      const checks = await Promise.allSettled(
        Array.from(this.checks.entries()).map(([name, checkFn]) => checkFn())
      );

      const healthChecks: HealthCheck[] = [];
      
      for (const result of checks) {
        if (result.status === 'fulfilled') {
          healthChecks.push(result.value);
        } else {
          console.error('Health check failed:', result.reason);
          healthChecks.push({
            id: Date.now().toString(),
            serviceName: 'unknown',
            status: 'unknown',
            lastCheck: new Date(),
            responseTime: 0,
            errorMessage: result.reason.message
          });
        }
      }

      const metrics = await this.collectSystemMetrics();
      metrics.services = healthChecks;
      this.metrics = metrics;

      // Check for issues and create alerts
      await this.checkForAlerts(metrics);

    } catch (error) {
      console.error('Health monitoring error:', error);
      this.createAlert('critical', 'monitoring', `Health monitoring failed: ${error.message}`);
    }
  }

  private async collectSystemMetrics(): Promise<SystemMetrics> {
    const timestamp = new Date();
    
    // Mock system metrics collection
    // In a real implementation, this would use system APIs
    return {
      timestamp,
      cpu: {
        usage: Math.random() * 100,
        cores: 4,
        loadAverage: [Math.random() * 2, Math.random() * 2, Math.random() * 2]
      },
      memory: {
        total: 16 * 1024 * 1024 * 1024, // 16GB
        used: Math.random() * 12 * 1024 * 1024 * 1024,
        available: Math.random() * 4 * 1024 * 1024 * 1024,
        percentage: Math.random() * 100
      },
      disk: {
        total: 500 * 1024 * 1024 * 1024, // 500GB
        used: Math.random() * 400 * 1024 * 1024 * 1024,
        available: Math.random() * 100 * 1024 * 1024 * 1024,
        percentage: Math.random() * 100
      },
      network: {
        bytesIn: Math.random() * 1000000,
        bytesOut: Math.random() * 1000000,
        packetsIn: Math.random() * 10000,
        packetsOut: Math.random() * 10000
      },
      services: []
    };
  }

  private async checkForAlerts(metrics: SystemMetrics) {
    const { alertThresholds } = this.config;

    // CPU threshold check
    if (metrics.cpu.usage > alertThresholds.cpu) {
      this.createAlert('warning', 'cpu', `CPU usage is ${metrics.cpu.usage.toFixed(1)}%`);
    }

    // Memory threshold check
    if (metrics.memory.percentage > alertThresholds.memory) {
      this.createAlert('warning', 'memory', `Memory usage is ${metrics.memory.percentage.toFixed(1)}%`);
    }

    // Disk threshold check
    if (metrics.disk.percentage > alertThresholds.disk) {
      this.createAlert('warning', 'disk', `Disk usage is ${metrics.disk.percentage.toFixed(1)}%`);
    }

    // Service health checks
    for (const service of metrics.services) {
      if (service.status === 'unhealthy') {
        this.createAlert('critical', service.serviceName, `Service is unhealthy: ${service.errorMessage}`);
      } else if (service.status === 'degraded') {
        this.createAlert('warning', service.serviceName, `Service is degraded`);
      }

      // Response time threshold check
      if (service.responseTime > alertThresholds.responseTime) {
        this.createAlert('warning', service.serviceName, `Response time is ${service.responseTime}ms`);
      }
    }
  }

  private createAlert(type: 'critical' | 'warning' | 'info', service: string, message: string) {
    const alert: HealthAlert = {
      id: Date.now().toString(),
      type,
      service,
      message,
      timestamp: new Date(),
      resolved: false
    };

    this.alerts.push(alert);
    console.log(`[${type.toUpperCase()}] ${service}: ${message}`);

    // Attempt recovery if configured
    if (this.config.recoveryActions.autoRestart && type === 'critical') {
      this.attemptRecovery(service);
    }

    // Send notification if configured
    if (this.config.notifications.enabled) {
      this.sendNotification(alert);
    }
  }

  private async attemptRecovery(service: string) {
    console.log(`Attempting recovery for service: ${service}`);
    
    // Implement recovery logic based on service type
    switch (service) {
      case 'ssh-tunnel':
        await this.restartSSHTunnel();
        break;
      case 'ttyd-service':
        await this.restartTTYDService();
        break;
      case 'claudebox-slots':
        await this.restartClaudeboxSlots();
        break;
      case 'better-auth':
        await this.restartBetterAuth();
        break;
    }
  }

  private async sendNotification(alert: HealthAlert) {
    if (!this.config.notifications.enabled) return;

    // Send notifications based on configured channels
    for (const channel of this.config.notifications.channels) {
      switch (channel) {
        case 'console':
          console.log(`[NOTIFICATION] ${alert.type.toUpperCase()}: ${alert.message}`);
          break;
        case 'webhook':
          await this.sendWebhookNotification(alert);
          break;
        case 'email':
          await this.sendEmailNotification(alert);
          break;
      }
    }
  }

  // Health check implementations
  private checkCPUHealth = async (): Promise<HealthCheck> => {
    const startTime = Date.now();
    try {
      // Mock CPU health check
      const usage = Math.random() * 100;
      const status = usage > 90 ? 'unhealthy' : usage > 70 ? 'degraded' : 'healthy';
      
      return {
        id: Date.now().toString(),
        serviceName: 'CPU',
        status,
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        metadata: { usage }
      };
    } catch (error) {
      return {
        id: Date.now().toString(),
        serviceName: 'CPU',
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        errorMessage: error.message
      };
    }
  };

  private checkMemoryHealth = async (): Promise<HealthCheck> => {
    const startTime = Date.now();
    try {
      const usage = Math.random() * 100;
      const status = usage > 90 ? 'unhealthy' : usage > 70 ? 'degraded' : 'healthy';
      
      return {
        id: Date.now().toString(),
        serviceName: 'Memory',
        status,
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        metadata: { usage }
      };
    } catch (error) {
      return {
        id: Date.now().toString(),
        serviceName: 'Memory',
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        errorMessage: error.message
      };
    }
  };

  private checkDiskHealth = async (): Promise<HealthCheck> => {
    const startTime = Date.now();
    try {
      const usage = Math.random() * 100;
      const status = usage > 90 ? 'unhealthy' : usage > 70 ? 'degraded' : 'healthy';
      
      return {
        id: Date.now().toString(),
        serviceName: 'Disk',
        status,
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        metadata: { usage }
      };
    } catch (error) {
      return {
        id: Date.now().toString(),
        serviceName: 'Disk',
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        errorMessage: error.message
      };
    }
  };

  private checkNetworkHealth = async (): Promise<HealthCheck> => {
    const startTime = Date.now();
    try {
      // Mock network health check
      const status = Math.random() > 0.1 ? 'healthy' : 'unhealthy';
      
      return {
        id: Date.now().toString(),
        serviceName: 'Network',
        status,
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        metadata: { latency: Math.random() * 100 }
      };
    } catch (error) {
      return {
        id: Date.now().toString(),
        serviceName: 'Network',
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        errorMessage: error.message
      };
    }
  };

  private checkSSHTunnel = async (): Promise<HealthCheck> => {
    const startTime = Date.now();
    try {
      // Mock SSH tunnel health check
      const status = Math.random() > 0.2 ? 'healthy' : 'unhealthy';
      
      return {
        id: Date.now().toString(),
        serviceName: 'SSH Tunnel',
        status,
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        metadata: { connected: status === 'healthy' }
      };
    } catch (error) {
      return {
        id: Date.now().toString(),
        serviceName: 'SSH Tunnel',
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        errorMessage: error.message
      };
    }
  };

  private checkTTYDService = async (): Promise<HealthCheck> => {
    const startTime = Date.now();
    try {
      // Mock TTYD service health check
      const status = Math.random() > 0.2 ? 'healthy' : 'unhealthy';
      
      return {
        id: Date.now().toString(),
        serviceName: 'TTYD Service',
        status,
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        metadata: { port: 7681, active: status === 'healthy' }
      };
    } catch (error) {
      return {
        id: Date.now().toString(),
        serviceName: 'TTYD Service',
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        errorMessage: error.message
      };
    }
  };

  private checkClaudeboxSlots = async (): Promise<HealthCheck> => {
    const startTime = Date.now();
    try {
      // Mock ClaudeBox slots health check
      const activeSlots = Math.floor(Math.random() * 10);
      const status = activeSlots > 8 ? 'degraded' : 'healthy';
      
      return {
        id: Date.now().toString(),
        serviceName: 'ClaudeBox Slots',
        status,
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        metadata: { activeSlots, totalSlots: 10 }
      };
    } catch (error) {
      return {
        id: Date.now().toString(),
        serviceName: 'ClaudeBox Slots',
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        errorMessage: error.message
      };
    }
  };

  private checkBetterAuth = async (): Promise<HealthCheck> => {
    const startTime = Date.now();
    try {
      // Mock Better Auth health check
      const status = Math.random() > 0.1 ? 'healthy' : 'unhealthy';
      
      return {
        id: Date.now().toString(),
        serviceName: 'Better Auth',
        status,
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        metadata: { connected: status === 'healthy', providerCount: 3 }
      };
    } catch (error) {
      return {
        id: Date.now().toString(),
        serviceName: 'Better Auth',
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        errorMessage: error.message
      };
    }
  };

  // Recovery action implementations
  private async restartSSHTunnel() {
    console.log('Restarting SSH tunnel...');
    // Implementation would restart SSH tunnel service
  }

  private async restartTTYDService() {
    console.log('Restarting TTYD service...');
    // Implementation would restart TTYD service via PM2
  }

  private async restartClaudeboxSlots() {
    console.log('Restarting ClaudeBox slots...');
    // Implementation would restart ClaudeBox slot services
  }

  private async restartBetterAuth() {
    console.log('Restarting Better Auth service...');
    // Implementation would restart Better Auth service
  }

  private async sendWebhookNotification(alert: HealthAlert) {
    console.log('Sending webhook notification:', alert);
    // Implementation would send webhook notification
  }

  private async sendEmailNotification(alert: HealthAlert) {
    console.log('Sending email notification:', alert);
    // Implementation would send email notification
  }

  // Public API methods
  getMetrics(): SystemMetrics | null {
    return this.metrics;
  }

  getAlerts(): HealthAlert[] {
    return this.alerts;
  }

  resolveAlert(alertId: string) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
    }
  }

  updateConfig(config: Partial<MonitoringConfig>) {
    this.config = { ...this.config, ...config };
  }
}