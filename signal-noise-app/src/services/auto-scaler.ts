import { 
  ScalingMetrics, 
  ScalingPolicy, 
  ScalingEvent, 
  InstanceInfo, 
  LoadBalancerConfig,
  ScalingCost,
  ScalingAlert,
  ScalingHistory
} from '@/types/auto-scaling'

interface AWSConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  instanceType: string;
  amiId: string;
  keyName: string;
  securityGroupIds: string[];
  subnetId: string;
}

interface ScalingConfig {
  checkInterval: number;
  cooldownPeriod: number;
  healthCheckInterval: number;
  metricsRetentionDays: number;
  enableCostOptimization: boolean;
  enablePredictiveScaling: boolean;
}

export class AutoScaler {
  private policies: Map<string, ScalingPolicy> = new Map()
  private instances: Map<string, InstanceInfo> = new Map()
  private events: ScalingEvent[] = []
  private alerts: ScalingAlert[] = []
  private history: ScalingHistory[] = []
  private loadBalancer: LoadBalancerConfig | null = null
  private isRunning = false
  private metrics: ScalingMetrics[] = []
  private config: ScalingConfig
  private awsConfig: AWSConfig
  private scalingTimers: Map<string, NodeJS.Timeout> = new Map()

  constructor(config: ScalingConfig, awsConfig: AWSConfig) {
    this.config = config
    this.awsConfig = awsConfig
    this.initializeDefaultPolicies()
  }

  async start(): Promise<void> {
    if (this.isRunning) return
    
    this.isRunning = true
    console.log('Auto-scaler started')
    
    // Start periodic scaling checks
    setInterval(() => {
      this.checkScalingConditions()
    }, this.config.checkInterval)

    // Start health checks
    setInterval(() => {
      this.performHealthChecks()
    }, this.config.healthCheckInterval)

    // Initialize monitoring
    await this.initializeMonitoring()
  }

  stop(): void {
    this.isRunning = false
    console.log('Auto-scaler stopped')
  }

  private async initializeMonitoring(): Promise<void> {
    // Load existing instances
    await this.discoverExistingInstances()
    
    // Load existing policies from storage
    await this.loadPolicies()
    
    // Initialize cost tracking
    this.initializeCostTracking()
  }

  private async discoverExistingInstances(): Promise<void> {
    try {
      // In a real implementation, this would query AWS EC2 API
      const mockInstances: InstanceInfo[] = [
        {
          id: 'instance-1',
          instanceId: 'i-1234567890abcdef0',
          publicIp: '203.0.113.1',
          privateIp: '10.0.1.1',
          status: 'running',
          region: this.awsConfig.region,
          availabilityZone: 'us-east-1a',
          instanceType: this.awsConfig.instanceType,
          launchTime: new Date(Date.now() - 86400000), // 1 day ago
          slotCapacity: 10,
          activeSlots: 3,
          cpuUtilization: 45,
          memoryUtilization: 60,
          cost: {
            hourly: 0.50,
            estimatedMonthly: 360
          },
          health: 'healthy',
          lastHealthCheck: new Date()
        }
      ]

      mockInstances.forEach(instance => {
        this.instances.set(instance.id, instance)
      })
    } catch (error) {
      console.error('Failed to discover existing instances:', error)
    }
  }

  private initializeDefaultPolicies(): void {
    const defaultPolicy: ScalingPolicy = {
      id: 'default-scaling-policy',
      name: 'Default Auto-scaling Policy',
      description: 'Automatically scales instances based on CPU and memory utilization',
      enabled: true,
      scaleUpThreshold: 75,
      scaleDownThreshold: 25,
      cooldownPeriod: 300000, // 5 minutes
      maxInstances: 10,
      minInstances: 1,
      targetUtilization: 60,
      scalingFactors: {
        cpu: 0.4,
        memory: 0.3,
        slots: 0.2,
        requests: 0.1
      },
      costConstraints: {
        maxHourlyCost: 10,
        maxDailyCost: 200,
        reservedInstances: 1
      },
      region: this.awsConfig.region,
      instanceType: this.awsConfig.instanceType,
      createdAt: new Date(),
      lastModified: new Date()
    }

    this.policies.set(defaultPolicy.id, defaultPolicy)
  }

  async checkScalingConditions(): Promise<void> {
    if (!this.isRunning) return

    try {
      const metrics = await this.collectMetrics()
      this.metrics.push(metrics)

      // Keep only recent metrics
      const retention = this.config.metricsRetentionDays * 24 * 60 * 60 * 1000
      this.metrics = this.metrics.filter(m => 
        Date.now() - m.timestamp.getTime() < retention
      )

      for (const policy of this.policies.values()) {
        if (!policy.enabled) continue

        // Check if policy is in cooldown
        if (this.isPolicyInCooldown(policy.id)) continue

        await this.evaluateScalingPolicy(policy, metrics)
      }
    } catch (error) {
      console.error('Error in scaling check:', error)
      await this.createAlert('scaling', 'Failed to perform scaling check', 'high', error)
    }
  }

  private async evaluateScalingPolicy(policy: ScalingPolicy, metrics: ScalingMetrics): Promise<void> {
    const utilization = this.calculateOverallUtilization(policy, metrics)
    
    if (utilization >= policy.scaleUpThreshold) {
      await this.scaleUp(policy, metrics, utilization)
    } else if (utilization <= policy.scaleDownThreshold) {
      await this.scaleDown(policy, metrics, utilization)
    }
  }

  private calculateOverallUtilization(policy: ScalingPolicy, metrics: ScalingMetrics): number {
    const factors = policy.scalingFactors
    
    return (
      metrics.cpuUtilization * factors.cpu +
      metrics.memoryUtilization * factors.memory +
      metrics.slotUtilization * factors.slots +
      Math.min(metrics.requestRate / 100, 100) * factors.requests
    )
  }

  private async scaleUp(policy: ScalingPolicy, metrics: ScalingMetrics, utilization: number): Promise<void> {
    const currentInstances = this.instances.size
    if (currentInstances >= policy.maxInstances) {
      await this.createAlert('scaling', 
        `Cannot scale up: already at maximum instances (${currentInstances}/${policy.maxInstances})`, 
        'warning'
      )
      return
    }

    const projectedCost = await this.calculateProjectedCost(currentInstances + 1)
    if (projectedCost.hourly > policy.costConstraints.maxHourlyCost) {
      await this.createAlert('cost', 
        `Cannot scale up: would exceed maximum hourly cost ($${projectedCost.hourly} > $${policy.costConstraints.maxHourlyCost})`, 
        'medium'
      )
      return
    }

    const event: ScalingEvent = {
      id: this.generateId(),
      type: 'scale_up',
      timestamp: new Date(),
      policyId: policy.id,
      previousInstanceCount: currentInstances,
      newInstanceCount: currentInstances + 1,
      reason: `Utilization at ${utilization.toFixed(1)}% exceeds scale-up threshold of ${policy.scaleUpThreshold}%`,
      metrics,
      cost: {
        estimatedAdditionalCost: projectedCost.additionalHourlyCost,
        totalNewCost: projectedCost.hourly
      },
      status: 'initiated'
    }

    this.events.push(event)
    this.addToHistory('scale_up', `Initiated scale-up from ${currentInstances} to ${currentInstances + 1} instances`, {
      policyId: policy.id,
      utilization,
      projectedCost
    })

    // Set cooldown
    this.setPolicyCooldown(policy.id, policy.cooldownPeriod)

    try {
      // Launch new instance
      const newInstance = await this.launchInstance()
      
      event.status = 'completed'
      event.completedAt = new Date()
      
      // Update load balancer
      await this.registerInstanceWithLoadBalancer(newInstance)
      
      console.log(`Scale-up completed: ${currentInstances} -> ${currentInstances + 1} instances`)
    } catch (error) {
      event.status = 'failed'
      event.errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      console.error('Scale-up failed:', error)
      await this.createAlert('scaling', `Scale-up failed: ${event.errorMessage}`, 'high', error)
    }
  }

  private async scaleDown(policy: ScalingPolicy, metrics: ScalingMetrics, utilization: number): Promise<void> {
    const currentInstances = this.instances.size
    if (currentInstances <= policy.minInstances) {
      await this.createAlert('scaling', 
        `Cannot scale down: already at minimum instances (${currentInstances}/${policy.minInstances})`, 
        'warning'
      )
      return
    }

    // Find the least utilized instance
    const instances = Array.from(this.instances.values())
    const targetInstance = instances.reduce((min, instance) => 
      (instance.cpuUtilization + instance.memoryUtilization) < (min.cpuUtilization + min.memoryUtilization) 
        ? instance : min
    )

    const event: ScalingEvent = {
      id: this.generateId(),
      type: 'scale_down',
      timestamp: new Date(),
      policyId: policy.id,
      previousInstanceCount: currentInstances,
      newInstanceCount: currentInstances - 1,
      reason: `Utilization at ${utilization.toFixed(1)}% below scale-down threshold of ${policy.scaleDownThreshold}%`,
      metrics,
      cost: {
        estimatedAdditionalCost: -targetInstance.cost.hourly,
        totalNewCost: await this.calculateCurrentHourlyCost() - targetInstance.cost.hourly
      },
      status: 'initiated'
    }

    this.events.push(event)
    this.addToHistory('scale_down', `Initiated scale-down from ${currentInstances} to ${currentInstances - 1} instances`, {
      policyId: policy.id,
      utilization,
      instanceId: targetInstance.id
    })

    // Set cooldown
    this.setPolicyCooldown(policy.id, policy.cooldownPeriod)

    try {
      // Drain instance from load balancer
      await this.drainInstanceFromLoadBalancer(targetInstance)
      
      // Terminate instance
      await this.terminateInstance(targetInstance)
      
      event.status = 'completed'
      event.completedAt = new Date()
      
      console.log(`Scale-down completed: ${currentInstances} -> ${currentInstances - 1} instances`)
    } catch (error) {
      event.status = 'failed'
      event.errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      console.error('Scale-down failed:', error)
      await this.createAlert('scaling', `Scale-down failed: ${event.errorMessage}`, 'high', error)
    }
  }

  private async launchInstance(): Promise<InstanceInfo> {
    // In a real implementation, this would use AWS EC2 API
    const instanceId = `i-${Math.random().toString(36).substr(2, 8)}`
    const id = this.generateId()
    
    const instance: InstanceInfo = {
      id,
      instanceId,
      publicIp: `203.0.113.${Math.floor(Math.random() * 255) + 1}`,
      privateIp: `10.0.1.${Math.floor(Math.random() * 255) + 1}`,
      status: 'pending',
      region: this.awsConfig.region,
      availabilityZone: `${this.awsConfig.region}a`,
      instanceType: this.awsConfig.instanceType,
      launchTime: new Date(),
      slotCapacity: 10,
      activeSlots: 0,
      cpuUtilization: 0,
      memoryUtilization: 0,
      cost: {
        hourly: 0.50,
        estimatedMonthly: 360
      },
      health: 'initializing',
      lastHealthCheck: new Date()
    }

    this.instances.set(id, instance)
    
    // Simulate instance startup
    setTimeout(() => {
      instance.status = 'running'
      instance.health = 'healthy'
    }, 30000) // 30 seconds startup time

    return instance
  }

  private async terminateInstance(instance: InstanceInfo): Promise<void> {
    // In a real implementation, this would use AWS EC2 API
    instance.status = 'terminated'
    this.instances.delete(instance.id)
  }

  private async registerInstanceWithLoadBalancer(instance: InstanceInfo): Promise<void> {
    // In a real implementation, this would register with AWS ELB API
    console.log(`Registered instance ${instance.id} with load balancer`)
  }

  private async drainInstanceFromLoadBalancer(instance: InstanceInfo): Promise<void> {
    // In a real implementation, this would deregister from AWS ELB API
    console.log(`Draining instance ${instance.id} from load balancer`)
  }

  private async performHealthChecks(): Promise<void> {
    for (const instance of this.instances.values()) {
      if (instance.status !== 'running') continue

      try {
        // Simulate health check
        const isHealthy = Math.random() > 0.05 // 95% healthy
        
        instance.health = isHealthy ? 'healthy' : 'unhealthy'
        instance.lastHealthCheck = new Date()

        if (!isHealthy) {
          await this.createAlert('availability', 
            `Instance ${instance.id} is unhealthy`, 
            'high',
            null,
            instance.id
          )
        }
      } catch (error) {
        instance.health = 'unhealthy'
        console.error(`Health check failed for instance ${instance.id}:`, error)
      }
    }
  }

  private async collectMetrics(): Promise<ScalingMetrics> {
    const instances = Array.from(this.instances.values()).filter(i => i.status === 'running')
    const totalSlots = instances.reduce((sum, i) => sum + i.slotCapacity, 0)
    const activeSlots = instances.reduce((sum, i) => sum + i.activeSlots, 0)
    const avgCpu = instances.reduce((sum, i) => sum + i.cpuUtilization, 0) / instances.length || 0
    const avgMemory = instances.reduce((sum, i) => sum + i.memoryUtilization, 0) / instances.length || 0

    return {
      timestamp: new Date(),
      overallUtilization: (avgCpu + avgMemory) / 2,
      cpuUtilization: avgCpu,
      memoryUtilization: avgMemory,
      slotUtilization: totalSlots > 0 ? (activeSlots / totalSlots) * 100 : 0,
      activeSlots,
      totalSlots,
      activeUsers: Math.floor(Math.random() * 50) + 10,
      requestRate: Math.floor(Math.random() * 1000) + 100,
      responseTime: Math.random() * 200 + 50,
      errorRate: Math.random() * 2,
      costPerHour: instances.reduce((sum, i) => sum + i.cost.hourly, 0)
    }
  }

  private async calculateProjectedCost(instanceCount: number): Promise<{
    hourly: number
    additionalHourlyCost: number
  }> {
    const hourlyPerInstance = 0.50
    const hourly = instanceCount * hourlyPerInstance
    const currentHourly = await this.calculateCurrentHourlyCost()
    
    return {
      hourly,
      additionalHourlyCost: hourly - currentHourly
    }
  }

  private async calculateCurrentHourlyCost(): Promise<number> {
    return Array.from(this.instances.values())
      .filter(i => i.status === 'running')
      .reduce((sum, i) => sum + i.cost.hourly, 0)
  }

  private isPolicyInCooldown(policyId: string): boolean {
    return this.scalingTimers.has(policyId)
  }

  private setPolicyCooldown(policyId: string, duration: number): void {
    if (this.scalingTimers.has(policyId)) {
      clearTimeout(this.scalingTimers.get(policyId)!)
    }

    const timer = setTimeout(() => {
      this.scalingTimers.delete(policyId)
    }, duration)

    this.scalingTimers.set(policyId, timer)
  }

  private async createAlert(
    category: ScalingAlert['category'],
    message: string,
    severity: ScalingAlert['severity'],
    error?: any,
    instanceId?: string
  ): Promise<void> {
    const alert: ScalingAlert = {
      id: this.generateId(),
      type: severity === 'high' ? 'critical' : 'warning',
      category,
      message,
      severity,
      timestamp: new Date(),
      resolved: false,
      instanceId,
      recommendedAction: this.getRecommendedAction(category, severity),
      metadata: error ? { error: error.message || error } : {}
    }

    this.alerts.push(alert)
    console.log(`Alert created: [${category.toUpperCase()}] ${message}`)
  }

  private getRecommendedAction(category: ScalingAlert['category'], severity: ScalingAlert['severity']): string {
    const actions = {
      scaling: {
        high: 'Check scaling policies and instance health',
        medium: 'Review scaling metrics and thresholds',
        low: 'Monitor scaling events'
      },
      cost: {
        high: 'Review scaling policies and consider reserved instances',
        medium: 'Analyze cost trends and optimize instance types',
        low: 'Monitor cost efficiency metrics'
      },
      performance: {
        high: 'Investigate performance bottlenecks',
        medium: 'Review application performance metrics',
        low: 'Monitor performance trends'
      },
      availability: {
        high: 'Replace unhealthy instances immediately',
        medium: 'Check instance health and connectivity',
        low: 'Monitor availability metrics'
      }
    }

    return actions[category]?.[severity] || 'Review system metrics'
  }

  private addToHistory(eventType: ScalingHistory['eventType'], description: string, details: Record<string, any>): void {
    const history: ScalingHistory = {
      id: this.generateId(),
      timestamp: new Date(),
      eventType,
      description,
      details,
      automated: true
    }

    this.history.push(history)
  }

  private initializeCostTracking(): void {
    // Start periodic cost analysis
    setInterval(() => {
      this.analyzeCostEfficiency()
    }, 3600000) // Every hour
  }

  private async analyzeCostEfficiency(): Promise<void> {
    const currentCost = await this.calculateCurrentHourlyCost()
    const instances = Array.from(this.instances.values()).filter(i => i.status === 'running')
    const avgUtilization = instances.reduce((sum, i) => sum + (i.cpuUtilization + i.memoryUtilization) / 2, 0) / instances.length || 0

    const efficiency = avgUtilization > 0 ? (avgUtilization / 100) / currentCost : 0

    if (efficiency < 0.5) {
      await this.createAlert('cost', 
        `Low cost efficiency detected: ${efficiency.toFixed(2)} (utilization: ${avgUtilization.toFixed(1)}%, cost: $${currentCost}/hour)`, 
        'medium'
      )
    }
  }

  private async loadPolicies(): Promise<void> {
    // In a real implementation, this would load from a database
    // For now, we'll use the default policies
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9)
  }

  // Public API methods
  async createPolicy(policy: Omit<ScalingPolicy, 'id' | 'createdAt' | 'lastModified'>): Promise<ScalingPolicy> {
    const newPolicy: ScalingPolicy = {
      ...policy,
      id: this.generateId(),
      createdAt: new Date(),
      lastModified: new Date()
    }

    this.policies.set(newPolicy.id, newPolicy)
    this.addToHistory('policy_change', `Created scaling policy: ${newPolicy.name}`, { policyId: newPolicy.id })

    return newPolicy
  }

  async updatePolicy(policyId: string, updates: Partial<ScalingPolicy>): Promise<ScalingPolicy | null> {
    const policy = this.policies.get(policyId)
    if (!policy) return null

    const updatedPolicy = {
      ...policy,
      ...updates,
      lastModified: new Date()
    }

    this.policies.set(policyId, updatedPolicy)
    this.addToHistory('policy_change', `Updated scaling policy: ${updatedPolicy.name}`, { policyId, updates })

    return updatedPolicy
  }

  async deletePolicy(policyId: string): Promise<boolean> {
    const deleted = this.policies.delete(policyId)
    if (deleted) {
      this.addToHistory('policy_change', 'Deleted scaling policy', { policyId })
    }
    return deleted
  }

  getPolicies(): ScalingPolicy[] {
    return Array.from(this.policies.values())
  }

  getInstances(): InstanceInfo[] {
    return Array.from(this.instances.values())
  }

  getEvents(): ScalingEvent[] {
    return this.events.slice(-100) // Return last 100 events
  }

  getAlerts(): ScalingAlert[] {
    return this.alerts.filter(a => !a.resolved)
  }

  getHistory(): ScalingHistory[] {
    return this.history.slice(-50) // Return last 50 history items
  }

  async resolveAlert(alertId: string): Promise<boolean> {
    const alert = this.alerts.find(a => a.id === alertId)
    if (alert) {
      alert.resolved = true
      alert.resolvedAt = new Date()
      return true
    }
    return false
  }

  async getCurrentMetrics(): Promise<ScalingMetrics | null> {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null
  }

  async forceScaling(policyId: string, direction: 'up' | 'down', instances: number): Promise<boolean> {
    const policy = this.policies.get(policyId)
    if (!policy) return false

    try {
      const metrics = await this.collectMetrics()
      
      if (direction === 'up') {
        for (let i = 0; i < instances; i++) {
          await this.scaleUp(policy, metrics, 100) // Force scale-up with high utilization
        }
      } else {
        for (let i = 0; i < instances; i++) {
          await this.scaleDown(policy, metrics, 0) // Force scale-down with low utilization
        }
      }

      return true
    } catch (error) {
      console.error('Force scaling failed:', error)
      return false
    }
  }
}