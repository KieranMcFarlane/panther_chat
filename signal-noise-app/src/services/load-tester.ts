import { 
  LoadTestConfig,
  LoadTestScenario,
  LoadTestStep,
  LoadTestResult,
  LoadTestSummary,
  LoadTestMetrics,
  TestTimelinePoint,
  ResourceTestMetrics,
  TestError,
  ThresholdValidationResult,
  ThresholdCheck,
  LoadTestReport,
  LoadTestTemplate,
  TestEnvironment
} from '@/types/load-testing'

// Helper functions
function generateId(): string {
  return Math.random().toString(36).substr(2, 9)
}

// Support classes
class VirtualUser {
  id: string
  scenario: LoadTestScenario
  isActive: boolean = false
  private results: TestResult[] = []

  constructor(id: string, scenario: LoadTestScenario) {
    this.id = id
    this.scenario = scenario
  }

  async start(): Promise<void> {
    this.isActive = true
  }

  async stop(): Promise<void> {
    this.isActive = false
  }

  async executeScenario(metricsCollector: MetricsCollector, environment: TestEnvironment | null): Promise<void> {
    while (this.isActive) {
      for (const step of this.scenario.steps) {
        if (!this.isActive) break

        try {
          const result = await this.executeStep(step, environment)
          this.results.push(result)
          metricsCollector.recordRequest(result)
        } catch (error) {
          metricsCollector.recordError({
            id: generateId(),
            timestamp: new Date(),
            type: 'system_error',
            severity: 'medium',
            message: error instanceof Error ? error.message : 'Unknown error',
            virtualUserId: this.id,
            stepId: step.id,
            count: 1
          })
        }

        // Apply think time
        if (this.scenario.thinkTime.min > 0 && this.scenario.thinkTime.max > 0) {
          const thinkTime = this.randomBetween(this.scenario.thinkTime.min, this.scenario.thinkTime.max)
          await this.sleep(thinkTime)
        }
      }
    }
  }

  private async executeStep(step: LoadTestStep, environment: TestEnvironment | null): Promise<TestResult> {
    const startTime = Date.now()

    switch (step.type) {
      case 'request':
        return await this.executeRequest(step, environment)
      case 'wait':
        await this.sleep(step.duration || 1000)
        return { type: 'wait', startTime, endTime: Date.now(), success: true }
      case 'slot_create':
      case 'slot_destroy':
      case 'auth':
        // Mock implementation for other step types
        return await this.executeMockStep(step)
      default:
        throw new Error(`Unknown step type: ${step.type}`)
    }
  }

  private async executeRequest(step: LoadTestStep, environment: TestEnvironment | null): Promise<TestResult> {
    const startTime = Date.now()
    const url = step.url || (environment?.baseUrl || '') + '/api/endpoint'
    const method = step.method || 'GET'

    try {
      // Mock HTTP request - in real implementation, use fetch or axios
      const response = await this.mockHttpRequest(url, method, step.headers, step.body)
      const endTime = Date.now()

      return {
        type: 'request',
        url,
        method,
        startTime,
        endTime,
        duration: endTime - startTime,
        success: response.status === (step.expectedStatus || 200),
        status: response.status,
        size: response.size
      }
    } catch (error) {
      const endTime = Date.now()
      return {
        type: 'request',
        url,
        method,
        startTime,
        endTime,
        duration: endTime - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private async executeMockStep(step: LoadTestStep): Promise<TestResult> {
    const startTime = Date.now()
    const duration = this.randomBetween(100, 1000) // Mock processing time
    await this.sleep(duration)
    const endTime = Date.now()

    return {
      type: step.type,
      startTime,
      endTime,
      duration: endTime - startTime,
      success: Math.random() > 0.05 // 95% success rate
    }
  }

  private async mockHttpRequest(url: string, method: string, headers?: Record<string, string>, body?: any): Promise<any> {
    // Simulate network latency
    const latency = this.randomBetween(50, 500)
    await this.sleep(latency)

    // Simulate response
    return {
      status: Math.random() > 0.05 ? 200 : 500, // 95% success rate
      size: Math.floor(Math.random() * 10000) + 100
    }
  }

  private randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

class MetricsCollector {
  private interval: number
  private timeline: TestTimelinePoint[] = []
  private errors: TestError[] = []
  private resourceMetrics: ResourceTestMetrics[] = []
  private requestResults: TestResult[] = []
  private startTime: number = 0
  private metricsInterval?: NodeJS.Timeout
  private collectResourceMetrics: boolean = false

  constructor(interval: number) {
    this.interval = interval
  }

  enableResourceMonitoring(): void {
    this.collectResourceMetrics = true
  }

  start(): void {
    this.startTime = Date.now()
    this.metricsInterval = setInterval(() => {
      this.collectMetricsPoint()
    }, this.interval)
  }

  stop(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval)
      this.metricsInterval = undefined
    }
  }

  recordRequest(result: TestResult): void {
    this.requestResults.push(result)
  }

  recordError(error: TestError): void {
    this.errors.push(error)
  }

  private collectMetricsPoint(): void {
    const now = Date.now()
    const elapsed = (now - this.startTime) / 1000

    const point: TestTimelinePoint = {
      timestamp: new Date(now),
      elapsed,
      virtualUsers: this.calculateActiveUsers(),
      activeConnections: this.requestResults.filter(r => 
        r.type === 'request' && now - r.endTime < 5000
      ).length,
      responseTime: this.calculateAverageResponseTime(),
      throughput: this.calculateThroughput(),
      errorRate: this.calculateErrorRate()
    }

    this.timeline.push(point)

    // Collect resource metrics if enabled
    if (this.collectResourceMetrics) {
      this.collectResourceMetricsPoint()
    }
  }

  private calculateActiveUsers(): number {
    // Mock calculation - in real implementation, track active users
    return Math.floor(Math.random() * 100) + 10
  }

  private calculateAverageResponseTime(): number {
    const recentRequests = this.requestResults.filter(r => 
      r.type === 'request' && Date.now() - r.endTime < 10000
    )
    
    if (recentRequests.length === 0) return 0
    
    const totalTime = recentRequests.reduce((sum, r) => sum + (r.duration || 0), 0)
    return totalTime / recentRequests.length
  }

  private calculateThroughput(): number {
    const recentRequests = this.requestResults.filter(r => 
      r.type === 'request' && Date.now() - r.endTime < 1000
    )
    return recentRequests.length
  }

  private calculateErrorRate(): number {
    const recentRequests = this.requestResults.filter(r => 
      r.type === 'request' && Date.now() - r.endTime < 1000
    )
    
    if (recentRequests.length === 0) return 0
    
    const errorCount = recentRequests.filter(r => !r.success).length
    return (errorCount / recentRequests.length) * 100
  }

  private collectResourceMetricsPoint(): void {
    const metrics: ResourceTestMetrics = {
      timestamp: new Date(),
      instanceId: 'instance-1',
      metrics: {
        cpu: {
          usage: Math.random() * 100,
          loadAverage: [Math.random() * 2, Math.random() * 2, Math.random() * 2]
        },
        memory: {
          usage: Math.random() * 100,
          available: Math.random() * 8000,
          pageFaults: Math.floor(Math.random() * 1000)
        },
        disk: {
          readSpeed: Math.random() * 100,
          writeSpeed: Math.random() * 100,
          iops: Math.floor(Math.random() * 1000)
        },
        network: {
          bytesIn: Math.random() * 1000000,
          bytesOut: Math.random() * 1000000,
          connections: Math.floor(Math.random() * 100)
        },
        slots: {
          total: Math.floor(Math.random() * 50) + 10,
          active: Math.floor(Math.random() * 30),
          pending: Math.floor(Math.random() * 10)
        }
      }
    }

    this.resourceMetrics.push(metrics)
  }

  async collect(): Promise<LoadTestMetrics> {
    this.stop()

    return {
      timeline: this.timeline,
      responseTimeHistogram: this.createHistogram(),
      throughputOverTime: this.createThroughputPoints(),
      errorRateOverTime: this.createErrorRatePoints(),
      userCountOverTime: this.createUserCountPoints(),
      resourceUtilization: this.resourceMetrics
    }
  }

  private createHistogram(): any[] {
    // Create response time histogram
    const responseTimes = this.requestResults
      .filter(r => r.type === 'request' && r.duration)
      .map(r => r.duration!)

    const bins = [0, 100, 200, 500, 1000, 2000, 5000, 10000]
    const histogram = []

    for (let i = 0; i < bins.length - 1; i++) {
      const count = responseTimes.filter(t => t >= bins[i] && t < bins[i + 1]).length
      histogram.push({
        start: bins[i],
        end: bins[i + 1],
        count,
        percentage: responseTimes.length > 0 ? (count / responseTimes.length) * 100 : 0
      })
    }

    return histogram
  }

  private createThroughputPoints(): any[] {
    // Create throughput over time points
    const points: any[] = []
    const interval = 1000 // 1 second intervals
    
    for (let time = 0; time < this.timeline.length * this.interval; time += interval) {
      const requestsInInterval = this.requestResults.filter(r => 
        r.type === 'request' && r.endTime >= this.startTime + time && r.endTime < this.startTime + time + interval
      )
      
      points.push({
        timestamp: new Date(this.startTime + time),
        requestsPerSecond: requestsInInterval.length,
        successfulRequests: requestsInInterval.filter(r => r.success).length,
        failedRequests: requestsInInterval.filter(r => !r.success).length
      })
    }
    
    return points
  }

  private createErrorRatePoints(): any[] {
    // Similar to throughput points but for error rates
    return this.createThroughputPoints().map(point => ({
      timestamp: point.timestamp,
      errorCount: point.failedRequests,
      totalRequests: point.requestsPerSecond,
      errorRate: point.requestsPerSecond > 0 ? (point.failedRequests / point.requestsPerSecond) * 100 : 0
    }))
  }

  private createUserCountPoints(): any[] {
    // Create user count over time points
    return this.timeline.map(point => ({
      timestamp: point.timestamp,
      activeUsers: point.virtualUsers,
      rampingUsers: Math.floor(point.virtualUsers * 0.1),
      steadyUsers: Math.floor(point.virtualUsers * 0.9)
    }))
  }
}

interface LoadTestRunnerConfig {
  maxConcurrentUsers: number;
  requestTimeout: number;
  thinkTimeRange: [number, number];
  metricsInterval: number;
  enableResourceMonitoring: boolean;
}

export class LoadTester {
  private configs: Map<string, LoadTestConfig> = new Map()
  private templates: Map<string, LoadTestTemplate> = new Map()
  private environments: Map<string, TestEnvironment> = new Map()
  private results: LoadTestResult[] = []
  private activeTests: Map<string, LoadTestResult> = new Map()
  private config: LoadTestRunnerConfig

  constructor(config: LoadTestRunnerConfig) {
    this.config = config
    this.initializeDefaultTemplates()
  }

  // Test Configuration Management
  async createTestConfig(config: Omit<LoadTestConfig, 'id' | 'createdAt' | 'lastModified'>): Promise<LoadTestConfig> {
    const newConfig: LoadTestConfig = {
      ...config,
      id: generateId(),
      createdAt: new Date(),
      lastModified: new Date()
    }

    this.configs.set(newConfig.id, newConfig)
    return newConfig
  }

  async updateTestConfig(id: string, updates: Partial<LoadTestConfig>): Promise<LoadTestConfig | null> {
    const config = this.configs.get(id)
    if (!config) return null

    const updatedConfig = {
      ...config,
      ...updates,
      lastModified: new Date()
    }

    this.configs.set(id, updatedConfig)
    return updatedConfig
  }

  async deleteTestConfig(id: string): Promise<boolean> {
    return this.configs.delete(id)
  }

  getTestConfigs(): LoadTestConfig[] {
    return Array.from(this.configs.values())
  }

  // Test Execution
  async runTest(configId: string, environmentId?: string): Promise<LoadTestResult> {
    const config = this.configs.get(configId)
    if (!config) {
      throw new Error(`Test config ${configId} not found`)
    }

    const environment = environmentId ? this.environments.get(environmentId) : null

    const result: LoadTestResult = {
      id: generateId(),
      testId: generateId(),
      configId,
      startTime: new Date(),
      endTime: new Date(),
      duration: 0,
      status: 'running',
      summary: this.createEmptySummary(),
      metrics: this.createEmptyMetrics(),
      resourceMetrics: [],
      errors: [],
      thresholds: this.createEmptyThresholds(),
      recommendations: [],
      report: this.createEmptyReport()
    }

    this.activeTests.set(result.id, result)
    this.results.push(result)

    try {
      await this.executeLoadTest(result, config, environment)
      result.status = 'completed'
    } catch (error) {
      result.status = 'failed'
      result.errors.push({
        id: generateId(),
        timestamp: new Date(),
        type: 'system_error',
        severity: 'critical',
        message: error instanceof Error ? error.message : 'Unknown error',
        count: 1
      })
    } finally {
      result.endTime = new Date()
      result.duration = result.endTime.getTime() - result.startTime.getTime()
      this.activeTests.delete(result.id)
    }

    return result
  }

  private async executeLoadTest(result: LoadTestResult, config: LoadTestConfig, environment: TestEnvironment | null): Promise<void> {
    const startTime = Date.now()
    const users: VirtualUser[] = []
    
    // Initialize metrics collection
    const metricsCollector = new MetricsCollector(this.config.metricsInterval)
    if (this.config.enableResourceMonitoring) {
      metricsCollector.enableResourceMonitoring()
    }

    try {
      // Ramp up users
      await this.rampUpUsers(config, users, metricsCollector)

      // Execute test scenario
      await this.executeScenario(config.scenario, users, metricsCollector, environment)

      // Ramp down users
      await this.rampDownUsers(users, metricsCollector)

    } finally {
      // Collect final metrics
      const collectedMetrics = await metricsCollector.collect()
      result.metrics = collectedMetrics
      result.resourceMetrics = collectedMetrics.resourceMetrics || []

      // Calculate summary and validate thresholds
      result.summary = this.calculateSummary(collectedMetrics.timeline)
      result.thresholds = this.validateThresholds(result.summary, config.thresholds)
      result.recommendations = this.generateRecommendations(result.summary, result.thresholds)
    }
  }

  private async rampUpUsers(config: LoadTestConfig, users: VirtualUser[], metricsCollector: MetricsCollector): Promise<void> {
    const rampUpDuration = config.rampUpTime * 1000
    const usersPerInterval = Math.ceil(config.concurrentUsers / (rampUpDuration / 1000))

    for (let i = 0; i < config.concurrentUsers; i += usersPerInterval) {
      const usersToCreate = Math.min(usersPerInterval, config.concurrentUsers - i)
      
      for (let j = 0; j < usersToCreate; j++) {
        const user = new VirtualUser(`user-${i + j}`, config.scenario)
        users.push(user)
        await user.start()
      }

      // Wait for next interval
      await this.sleep(1000)
    }
  }

  private async rampDownUsers(users: VirtualUser[], metricsCollector: MetricsCollector): Promise<void> {
    // Stop users gradually
    for (let i = 0; i < users.length; i++) {
      await users[i].stop()
      await this.sleep(100) // Small delay between stopping users
    }
  }

  private async executeScenario(scenario: LoadTestScenario, users: VirtualUser[], metricsCollector: MetricsCollector, environment: TestEnvironment | null): Promise<void> {
    const testDuration = scenario.steps.reduce((total, step) => total + (step.duration || 0), 0) * 1000
    const startTime = Date.now()
    const endTime = startTime + testDuration

    // Start all users executing the scenario
    const userPromises = users.map(user => 
      user.executeScenario(metricsCollector, environment)
    )

    // Wait for test duration or all users to complete
    await Promise.race([
      Promise.all(userPromises),
      new Promise(resolve => setTimeout(resolve, testDuration))
    ])
  }

  
  // Helper methods
  private createEmptySummary(): LoadTestSummary {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      errorRate: 0,
      avgResponseTime: 0,
      minResponseTime: 0,
      maxResponseTime: 0,
      p50ResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      throughput: 0,
      concurrentUsers: 0,
      peakThroughput: 0
    }
  }

  private createEmptyMetrics(): LoadTestMetrics {
    return {
      timeline: [],
      responseTimeHistogram: [],
      throughputOverTime: [],
      errorRateOverTime: [],
      userCountOverTime: [],
      resourceUtilization: []
    }
  }

  private createEmptyThresholds(): ThresholdValidationResult {
    return {
      responseTime: {
        avg: this.createEmptyThresholdCheck(),
        p95: this.createEmptyThresholdCheck(),
        p99: this.createEmptyThresholdCheck(),
        max: this.createEmptyThresholdCheck()
      },
      errorRate: this.createEmptyThresholdCheck(),
      throughput: {
        min: this.createEmptyThresholdCheck(),
        max: this.createEmptyThresholdCheck()
      },
      resourceUtilization: {
        cpu: this.createEmptyThresholdCheck(),
        memory: this.createEmptyThresholdCheck(),
        diskIO: this.createEmptyThresholdCheck(),
        networkIO: this.createEmptyThresholdCheck()
      },
      overall: this.createEmptyThresholdCheck()
    }
  }

  private createEmptyThresholdCheck(): ThresholdCheck {
    return {
      passed: false,
      actual: 0,
      threshold: 0,
      percentage: 0,
      violation: false
    }
  }

  private createEmptyReport(): LoadTestReport {
    return {
      id: generateId(),
      testId: '',
      generatedAt: new Date(),
      format: 'html',
      sections: [],
      summary: {
        executiveSummary: '',
        keyFindings: [],
        recommendations: [],
        nextSteps: []
      },
      charts: [],
      tables: []
    }
  }

  private calculateSummary(timeline: TestTimelinePoint[]): LoadTestSummary {
    if (timeline.length === 0) return this.createEmptySummary()

    const responseTimes = timeline.map(p => p.responseTime).filter(t => t > 0)
    const throughputs = timeline.map(p => p.throughput)

    return {
      totalRequests: timeline.reduce((sum, p) => sum + p.throughput * this.config.metricsInterval / 1000, 0),
      successfulRequests: timeline.reduce((sum, p) => sum + p.throughput * (100 - p.errorRate) / 100 * this.config.metricsInterval / 1000, 0),
      failedRequests: timeline.reduce((sum, p) => sum + p.throughput * p.errorRate / 100 * this.config.metricsInterval / 1000, 0),
      errorRate: timeline.reduce((sum, p) => sum + p.errorRate, 0) / timeline.length,
      avgResponseTime: responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length,
      minResponseTime: Math.min(...responseTimes),
      maxResponseTime: Math.max(...responseTimes),
      p50ResponseTime: this.percentile(responseTimes, 50),
      p95ResponseTime: this.percentile(responseTimes, 95),
      p99ResponseTime: this.percentile(responseTimes, 99),
      throughput: throughputs.reduce((sum, t) => sum + t, 0) / throughputs.length,
      concurrentUsers: Math.max(...timeline.map(p => p.virtualUsers)),
      peakThroughput: Math.max(...throughputs)
    }
  }

  private validateThresholds(summary: LoadTestSummary, thresholds: any): ThresholdValidationResult {
    return {
      responseTime: {
        avg: this.checkThreshold(summary.avgResponseTime, thresholds.responseTime.avg),
        p95: this.checkThreshold(summary.p95ResponseTime, thresholds.responseTime.p95),
        p99: this.checkThreshold(summary.p99ResponseTime, thresholds.responseTime.p99),
        max: this.checkThreshold(summary.maxResponseTime, thresholds.responseTime.max)
      },
      errorRate: this.checkThreshold(summary.errorRate, thresholds.errorRate.percentage),
      throughput: {
        min: this.checkThreshold(summary.throughput, thresholds.throughput.minRequestsPerSecond, 'min'),
        max: this.checkThreshold(summary.throughput, thresholds.throughput.maxRequestsPerSecond, 'max')
      },
      resourceUtilization: {
        // Mock resource validation - in real implementation, use actual metrics
        cpu: this.checkThreshold(45, thresholds.resourceUtilization.maxCpu),
        memory: this.checkThreshold(60, thresholds.resourceUtilization.maxMemory),
        diskIO: this.checkThreshold(30, thresholds.resourceUtilization.maxDiskIO),
        networkIO: this.checkThreshold(25, thresholds.resourceUtilization.maxNetworkIO)
      },
      overall: this.checkThreshold(
        summary.errorRate < 1 && summary.avgResponseTime < 1000 ? 100 : 80,
        95,
        'overall'
      )
    }
  }

  private checkThreshold(actual: number, threshold: number, type: 'max' | 'min' | 'overall' = 'max'): ThresholdCheck {
    const passed = type === 'max' ? actual <= threshold : actual >= threshold
    const percentage = type === 'max' ? (actual / threshold) * 100 : (threshold / actual) * 100
    
    return {
      passed,
      actual,
      threshold,
      percentage,
      violation: !passed,
      message: passed ? undefined : `${type === 'max' ? 'Exceeded' : 'Below'} threshold of ${threshold}`
    }
  }

  private generateRecommendations(summary: LoadTestSummary, thresholds: ThresholdValidationResult): string[] {
    const recommendations: string[] = []

    if (summary.errorRate > 1) {
      recommendations.push('High error rate detected. Investigate application stability and error handling.')
    }

    if (summary.avgResponseTime > 1000) {
      recommendations.push('High average response time. Consider performance optimization or infrastructure scaling.')
    }

    if (summary.p95ResponseTime > 2000) {
      recommendations.push('95th percentile response time is high. Focus on optimizing slow requests.')
    }

    if (!thresholds.overall.passed) {
      recommendations.push('Overall performance thresholds not met. Review all metrics and consider system improvements.')
    }

    if (summary.throughput < 10) {
      recommendations.push('Low throughput detected. Check application performance and infrastructure capacity.')
    }

    if (recommendations.length === 0) {
      recommendations.push('All performance thresholds met. System is performing well under load.')
    }

    return recommendations
  }

  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0
    const sorted = values.slice().sort((a, b) => a - b)
    const index = Math.ceil((p / 100) * sorted.length) - 1
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))]
  }

  private initializeDefaultTemplates(): void {
    // Create default load test templates
    const templates: LoadTestTemplate[] = [
      {
        id: 'basic-performance',
        name: 'Basic Performance Test',
        description: 'Standard performance test with typical user load',
        category: 'performance',
        scenarios: [],
        defaultThresholds: {
          responseTime: { avg: 1000, p95: 2000, p99: 5000, max: 10000 },
          errorRate: { percentage: 1, maxErrors: 10 },
          throughput: { minRequestsPerSecond: 10, maxRequestsPerSecond: 1000 },
          resourceUtilization: { maxCpu: 80, maxMemory: 90, maxDiskIO: 80, maxNetworkIO: 80 }
        },
        recommendedConfig: {
          duration: 300,
          concurrentUsers: 50,
          rampUpTime: 60
        },
        tags: ['performance', 'basic'],
        isPublic: true,
        createdAt: new Date(),
        createdBy: 'system'
      }
    ]

    templates.forEach(template => {
      this.templates.set(template.id, template)
    })
  }

  
  // Public API methods
  async getTestResults(limit: number = 50): Promise<LoadTestResult[]> {
    return this.results.slice(-limit)
  }

  async getActiveTests(): Promise<LoadTestResult[]> {
    return Array.from(this.activeTests.values())
  }

  async getTestResult(id: string): Promise<LoadTestResult | null> {
    return this.results.find(r => r.id === id) || null
  }

  async cancelTest(id: string): Promise<boolean> {
    const test = this.activeTests.get(id)
    if (test) {
      test.status = 'cancelled'
      this.activeTests.delete(id)
      return true
    }
    return false
  }

  async generateReport(testId: string, format: 'html' | 'json' | 'pdf' | 'csv' = 'html'): Promise<LoadTestReport> {
    const test = this.results.find(r => r.id === testId)
    if (!test) {
      throw new Error(`Test ${testId} not found`)
    }

    // Generate report based on test results
    const report: LoadTestReport = {
      id: generateId(),
      testId,
      generatedAt: new Date(),
      format,
      sections: this.generateReportSections(test),
      summary: {
        executiveSummary: this.generateExecutiveSummary(test),
        keyFindings: this.generateKeyFindings(test),
        recommendations: test.recommendations,
        nextSteps: this.generateNextSteps(test)
      },
      charts: this.generateReportCharts(test),
      tables: this.generateReportTables(test)
    }

    test.report = report
    return report
  }

  private generateReportSections(test: LoadTestResult): any[] {
    return [
      {
        id: 'summary',
        title: 'Test Summary',
        type: 'summary',
        content: this.generateTestSummaryContent(test)
      },
      {
        id: 'metrics',
        title: 'Performance Metrics',
        type: 'metrics',
        content: this.generateMetricsContent(test)
      },
      {
        id: 'analysis',
        title: 'Performance Analysis',
        type: 'analysis',
        content: this.generateAnalysisContent(test)
      },
      {
        id: 'recommendations',
        title: 'Recommendations',
        type: 'recommendations',
        content: test.recommendations.join('\n')
      }
    ]
  }

  private generateExecutiveSummary(test: LoadTestResult): string {
    const { summary, thresholds } = test
    return `Load test completed with ${summary.errorRate.toFixed(2)}% error rate and average response time of ${summary.avgResponseTime.toFixed(0)}ms. ${thresholds.overall.passed ? 'All' : 'Some'} performance thresholds were met.`
  }

  private generateKeyFindings(test: LoadTestResult): string[] {
    const findings: string[] = []
    const { summary, thresholds } = test

    if (summary.errorRate > 1) {
      findings.push(`High error rate of ${summary.errorRate.toFixed(2)}% detected`)
    }

    if (summary.avgResponseTime > 1000) {
      findings.push(`Average response time of ${summary.avgResponseTime.toFixed(0)}ms exceeds recommended limits`)
    }

    if (!thresholds.overall.passed) {
      findings.push('Performance thresholds not met')
    }

    findings.push(`Peak throughput: ${summary.peakThroughput} requests/second`)
    findings.push(`Tested with ${summary.concurrentUsers} concurrent users`)

    return findings
  }

  private generateNextSteps(test: LoadTestResult): string[] {
    const nextSteps: string[] = []

    if (!test.thresholds.overall.passed) {
      nextSteps.push('Investigate performance bottlenecks')
      nextSteps.push('Optimize application code and database queries')
      nextSteps.push('Consider infrastructure scaling')
    }

    if (test.summary.errorRate > 1) {
      nextSteps.push('Review error logs and fix stability issues')
    }

    nextSteps.push('Schedule regular load tests')
    nextSteps.push('Monitor production performance metrics')

    return nextSteps
  }

  private generateTestSummaryContent(test: LoadTestResult): string {
    const { summary } = test
    return `
Test Duration: ${test.duration / 1000} seconds
Concurrent Users: ${summary.concurrentUsers}
Total Requests: ${summary.totalRequests}
Successful Requests: ${summary.successfulRequests}
Failed Requests: ${summary.failedRequests}
Error Rate: ${summary.errorRate.toFixed(2)}%
Average Response Time: ${summary.avgResponseTime.toFixed(0)}ms
95th Percentile: ${summary.p95ResponseTime.toFixed(0)}ms
99th Percentile: ${summary.p99ResponseTime.toFixed(0)}ms
Peak Throughput: ${summary.peakThroughput} req/s
    `.trim()
  }

  private generateMetricsContent(test: LoadTestResult): string {
    return `Performance metrics collected during the test show detailed response time distribution, throughput patterns, and resource utilization.`
  }

  private generateAnalysisContent(test: LoadTestResult): string {
    return `Analysis of test results indicates ${test.thresholds.overall.passed ? 'good' : 'mixed'} performance characteristics.`
  }

  private generateReportCharts(test: LoadTestResult): any[] {
    return [
      {
        id: 'response-time',
        title: 'Response Time Over Time',
        type: 'line',
        data: test.metrics.timeline.map(p => ({
          x: p.timestamp,
          y: p.responseTime
        }))
      },
      {
        id: 'throughput',
        title: 'Throughput Over Time',
        type: 'line',
        data: test.metrics.throughputOverTime.map(p => ({
          x: p.timestamp,
          y: p.requestsPerSecond
        }))
      }
    ]
  }

  private generateReportTables(test: LoadTestResult): any[] {
    return [
      {
        id: 'summary-table',
        title: 'Test Summary',
        columns: [
          { id: 'metric', name: 'Metric', type: 'string' },
          { id: 'value', name: 'Value', type: 'string' }
        ],
        rows: [
          ['Duration', `${test.duration / 1000}s`],
          ['Concurrent Users', test.summary.concurrentUsers.toString()],
          ['Total Requests', test.summary.totalRequests.toString()],
          ['Error Rate', `${test.summary.errorRate.toFixed(2)}%`],
          ['Avg Response Time', `${test.summary.avgResponseTime.toFixed(0)}ms`]
        ]
      }
    ]
  }
}

// Type definitions for internal use
interface TestResult {
  type: 'request' | 'wait' | 'slot_create' | 'slot_destroy' | 'auth'
  url?: string
  method?: string
  startTime: number
  endTime: number
  duration?: number
  success?: boolean
  status?: number
  size?: number
  error?: string
}