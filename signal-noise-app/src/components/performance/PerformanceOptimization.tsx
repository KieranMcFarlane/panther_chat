'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  ResourceMetrics, 
  PerformanceMetrics, 
  ResourceAllocation, 
  OptimizationStrategy, 
  PerformanceAlert, 
  PerformanceBaseline,
  ResourceLimit,
  PerformanceProfile,
  OptimizationSettings
} from '@/types/performance'
import { 
  performanceOptimizer, 
  startPerformanceMonitoring,
  stopPerformanceMonitoring
} from '@/services/performance-optimizer'
import {
  Activity,
  Cpu,
  HardDrive,
  Wifi,
  Zap,
  Settings,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Play,
  Pause,
  Database,
  MemoryStick
} from 'lucide-react'

const PerformanceOptimization: React.FC = () => {
  const [resourceMetrics, setResourceMetrics] = useState<ResourceMetrics | null>(null)
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null)
  const [allocations, setAllocations] = useState<ResourceAllocation[]>([])
  const [strategies, setStrategies] = useState<OptimizationStrategy[]>([])
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([])
  const [baselines, setBaselines] = useState<PerformanceBaseline[]>([])
  const [profiles, setProfiles] = useState<PerformanceProfile[]>([])
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [selectedTab, setSelectedTab] = useState('overview')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Initialize with current metrics
    const metrics = performanceOptimizer.getCurrentMetrics()
    if (metrics) {
      setResourceMetrics(metrics.resourceMetrics)
      setPerformanceMetrics(metrics.performanceMetrics)
    }

    // Load initial data
    loadOptimizationData()

    // Set up real-time updates
    const interval = setInterval(() => {
      if (isMonitoring) {
        const currentMetrics = performanceOptimizer.getCurrentMetrics()
        if (currentMetrics) {
          setResourceMetrics(currentMetrics.resourceMetrics)
          setPerformanceMetrics(currentMetrics.performanceMetrics)
        }
        loadOptimizationData()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [isMonitoring])

  const loadOptimizationData = async () => {
    try {
      const [allocs, activeStrategies, currentAlerts, activeBaselines, activeProfiles] = await Promise.all([
        performanceOptimizer.getResourceAllocations(),
        performanceOptimizer.getOptimizationStrategies(),
        performanceOptimizer.getPerformanceAlerts(),
        performanceOptimizer.getPerformanceBaselines(),
        performanceOptimizer.getPerformanceProfiles()
      ])
      
      setAllocations(allocs)
      setStrategies(activeStrategies)
      setAlerts(currentAlerts)
      setBaselines(activeBaselines)
      setProfiles(activeProfiles)
    } catch (error) {
      console.error('Failed to load optimization data:', error)
    }
  }

  const toggleMonitoring = async () => {
    if (isMonitoring) {
      stopPerformanceMonitoring()
      setIsMonitoring(false)
    } else {
      await startPerformanceMonitoring()
      setIsMonitoring(true)
    }
  }

  const runOptimization = async (strategyId: string) => {
    setIsLoading(true)
    try {
      const result = await performanceOptimizer.runOptimization(strategyId)
      if (result.success) {
        await loadOptimizationData()
      }
    } catch (error) {
      console.error('Optimization failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const createBaseline = async () => {
    setIsLoading(true)
    try {
      await performanceOptimizer.createPerformanceBaseline('Auto-generated baseline', 'Created from current metrics')
      await loadOptimizationData()
    } catch (error) {
      console.error('Failed to create baseline:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const resolveAlert = async (alertId: string) => {
    try {
      await performanceOptimizer.resolveAlert(alertId)
      await loadOptimizationData()
    } catch (error) {
      console.error('Failed to resolve alert:', error)
    }
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatPercentage = (value: number): string => {
    return value.toFixed(1) + '%'
  }

  const getUtilizationColor = (percentage: number): string => {
    if (percentage >= 90) return 'text-red-600'
    if (percentage >= 70) return 'text-yellow-600'
    return 'text-green-600'
  }

  const getResourceIcon = (resource: string) => {
    switch (resource.toLowerCase()) {
      case 'cpu': return <Cpu className="h-4 w-4" />
      case 'memory': return <MemoryStick className="h-4 w-4" />
      case 'disk': return <HardDrive className="h-4 w-4" />
      case 'network': return <Wifi className="h-4 w-4" />
      default: return <Activity className="h-4 w-4" />
    }
  }

  const getAlertSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Performance Optimization</h1>
          <p className="text-gray-600">Monitor and optimize system performance in real-time</p>
        </div>
        <div className="flex items-center space-x-4">
          <Button
            onClick={toggleMonitoring}
            variant={isMonitoring ? "destructive" : "default"}
            className="flex items-center space-x-2"
          >
            {isMonitoring ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            <span>{isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}</span>
          </Button>
          <Button
            onClick={createBaseline}
            disabled={isLoading}
            variant="outline"
            className="flex items-center space-x-2"
          >
            <TrendingUp className="h-4 w-4" />
            <span>Create Baseline</span>
          </Button>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.filter(alert => !alert.resolved).map((alert) => (
            <Alert key={alert.id} className={getAlertSeverityColor(alert.severity)}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <div>
                  <strong>{alert.category.toUpperCase()} Alert:</strong> {alert.message}
                  <div className="text-sm mt-1">
                    Current: {alert.currentValue} | Threshold: {alert.threshold} | 
                    {alert.recommendedAction}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => resolveAlert(alert.id)}
                  variant="outline"
                >
                  Resolve
                </Button>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="baselines">Baselines</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {resourceMetrics && (
              <>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
                    <Cpu className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${getUtilizationColor(resourceMetrics.cpu.usage)}`}>
                      {formatPercentage(resourceMetrics.cpu.usage)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {resourceMetrics.cpu.cores} cores, {resourceMetrics.cpu.processCount} processes
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                    <MemoryStick className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${getUtilizationColor((resourceMetrics.memory.used / resourceMetrics.memory.total) * 100)}`}>
                      {formatPercentage((resourceMetrics.memory.used / resourceMetrics.memory.total) * 100)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(resourceMetrics.memory.used)} / {formatBytes(resourceMetrics.memory.total)}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Disk Usage</CardTitle>
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${getUtilizationColor((resourceMetrics.disk.used / resourceMetrics.disk.total) * 100)}`}>
                      {formatPercentage((resourceMetrics.disk.used / resourceMetrics.disk.total) * 100)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(resourceMetrics.disk.used)} / {formatBytes(resourceMetrics.disk.total)}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Network</CardTitle>
                    <Wifi className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatBytes(resourceMetrics.network.bytesIn + resourceMetrics.network.bytesOut)}/s
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {resourceMetrics.network.activeConnections} active connections
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Active Optimization Strategies</CardTitle>
                <CardDescription>Currently running performance optimizations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {strategies.filter(s => s.isActive).map((strategy) => (
                  <div key={strategy.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getResourceIcon(strategy.type)}
                      <div>
                        <p className="font-medium">{strategy.name}</p>
                        <p className="text-sm text-gray-600">{strategy.type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline">Active</Badge>
                      <p className="text-sm text-gray-600">{strategy.effectiveness}% effective</p>
                    </div>
                  </div>
                ))}
                {strategies.filter(s => s.isActive).length === 0 && (
                  <p className="text-gray-500 text-center py-4">No active optimization strategies</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resource Allocations</CardTitle>
                <CardDescription>Current resource allocation by slot</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {allocations.slice(0, 5).map((allocation) => (
                  <div key={allocation.slotId} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{allocation.slotId}</p>
                      <p className="text-sm text-gray-600">Priority: {allocation.priority}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">CPU: {formatPercentage(allocation.currentUsage.cpuPercent)}</p>
                      <p className="text-sm">Memory: {formatBytes(allocation.currentUsage.memoryMB)}</p>
                    </div>
                  </div>
                ))}
                {allocations.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No resource allocations found</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Process Information</CardTitle>
                <CardDescription>Current system process statistics</CardDescription>
              </CardHeader>
              <CardContent>
                {resourceMetrics && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium">Total Processes</p>
                        <p className="text-2xl font-bold">{resourceMetrics.processes.total}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Running</p>
                        <p className="text-2xl font-bold text-green-600">{resourceMetrics.processes.running}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Sleeping</p>
                        <p className="text-2xl font-bold text-blue-600">{resourceMetrics.processes.sleeping}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Zombie</p>
                        <p className="text-2xl font-bold text-red-600">{resourceMetrics.processes.zombie}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Memory Details</CardTitle>
                <CardDescription>Detailed memory usage breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                {resourceMetrics && (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Total Memory:</span>
                      <span className="font-medium">{formatBytes(resourceMetrics.memory.total)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Used:</span>
                      <span className="font-medium">{formatBytes(resourceMetrics.memory.used)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Available:</span>
                      <span className="font-medium">{formatBytes(resourceMetrics.memory.available)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cached:</span>
                      <span className="font-medium">{formatBytes(resourceMetrics.memory.cached)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Buffers:</span>
                      <span className="font-medium">{formatBytes(resourceMetrics.memory.buffers)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Swap Used:</span>
                      <span className="font-medium">{formatBytes(resourceMetrics.memory.swapUsed)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="optimization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Available Optimization Strategies</CardTitle>
              <CardDescription>Click to run optimization strategies</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {strategies.map((strategy) => (
                  <Card key={strategy.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{strategy.name}</CardTitle>
                        {strategy.isActive ? <CheckCircle className="h-5 w-5 text-green-600" /> : <Zap className="h-5 w-5 text-gray-400" />}
                      </div>
                      <CardDescription>{strategy.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Type:</span>
                          <Badge variant="outline">{strategy.type}</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Effectiveness:</span>
                          <span className="text-sm font-medium">{strategy.effectiveness}%</span>
                        </div>
                        {strategy.results && (
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span>Response Time:</span>
                              <span className={strategy.results.improvement.responseTime > 0 ? 'text-green-600' : 'text-red-600'}>
                                {strategy.results.improvement.responseTime > 0 ? '+' : ''}{strategy.results.improvement.responseTime.toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Throughput:</span>
                              <span className={strategy.results.improvement.throughput > 0 ? 'text-green-600' : 'text-red-600'}>
                                {strategy.results.improvement.throughput > 0 ? '+' : ''}{strategy.results.improvement.throughput.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        )}
                        <Button
                          onClick={() => runOptimization(strategy.id)}
                          disabled={isLoading || strategy.isActive}
                          size="sm"
                          className="w-full"
                        >
                          {strategy.isActive ? 'Already Active' : 'Run Optimization'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Performance Profiles</CardTitle>
              <CardDescription>Pre-configured performance optimization profiles</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {profiles.map((profile) => (
                  <Card key={profile.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{profile.name}</CardTitle>
                        {profile.isActive ? <CheckCircle className="h-5 w-5 text-green-600" /> : <Settings className="h-5 w-5 text-gray-400" />}
                      </div>
                      <CardDescription>{profile.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>CPU Limit:</span>
                          <span>{profile.resourceLimits.maxCpuPercent}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Memory Limit:</span>
                          <span>{formatBytes(profile.resourceLimits.maxMemoryMB * 1024 * 1024)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Priority:</span>
                          <span>{profile.priority}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Alerts</CardTitle>
              <CardDescription>System performance alerts and notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div key={alert.id} className={`p-4 border rounded-lg ${alert.resolved ? 'bg-gray-50' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Badge className={getAlertSeverityColor(alert.severity)}>
                          {alert.severity.toUpperCase()}
                        </Badge>
                        <Badge variant="outline">{alert.category}</Badge>
                        {alert.resolved && <Badge variant="outline">Resolved</Badge>}
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(alert.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <p className="font-medium mb-1">{alert.message}</p>
                    <p className="text-sm text-gray-600 mb-2">
                      Current: {alert.currentValue} | Threshold: {alert.threshold}
                    </p>
                    <p className="text-sm text-gray-700 mb-3">
                      Recommended: {alert.recommendedAction}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-500">
                        {alert.slotId && <span>Slot: {alert.slotId}</span>}
                        {alert.userId && <span> | User: {alert.userId}</span>}
                      </div>
                      {!alert.resolved && (
                        <Button
                          size="sm"
                          onClick={() => resolveAlert(alert.id)}
                          variant="outline"
                        >
                          Mark Resolved
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {alerts.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No performance alerts found</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="baselines" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Baselines</CardTitle>
              <CardDescription>Historical performance baselines for comparison</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {baselines.map((baseline) => (
                  <Card key={baseline.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{baseline.name}</CardTitle>
                        {baseline.isActive ? <CheckCircle className="h-5 w-5 text-green-600" /> : <Clock className="h-5 w-5 text-gray-400" />}
                      </div>
                      <CardDescription>{baseline.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="font-medium">Response Time</p>
                          <p>{baseline.metrics.responseTime.toFixed(2)}ms</p>
                        </div>
                        <div>
                          <p className="font-medium">Throughput</p>
                          <p>{baseline.metrics.throughput.toFixed(2)} req/s</p>
                        </div>
                        <div>
                          <p className="font-medium">Error Rate</p>
                          <p>{formatPercentage(baseline.metrics.errorRate)}</p>
                        </div>
                        <div>
                          <p className="font-medium">Availability</p>
                          <p>{formatPercentage(baseline.metrics.availability)}</p>
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-gray-500">
                        Sample Size: {baseline.sampleSize} | Duration: {(baseline.duration / 1000).toFixed(1)}s | 
                        Created: {new Date(baseline.createdAt).toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {baselines.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No performance baselines found</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default PerformanceOptimization