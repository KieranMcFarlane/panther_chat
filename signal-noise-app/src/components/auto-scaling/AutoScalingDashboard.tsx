'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { 
  ScalingMetrics,
  ScalingPolicy,
  ScalingEvent,
  InstanceInfo,
  ScalingAlert,
  ScalingHistory
} from '@/types/auto-scaling'
import { AutoScaler } from '@/services/auto-scaler'
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
  Plus,
  Minus,
  DollarSign,
  Server,
  Scale,
  Shield,
  AlertCircle,
  Info,
  BarChart3,
  Users,
  Target
} from 'lucide-react'

const AutoScalingDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<ScalingMetrics | null>(null)
  const [policies, setPolicies] = useState<ScalingPolicy[]>([])
  const [instances, setInstances] = useState<InstanceInfo[]>([])
  const [events, setEvents] = useState<ScalingEvent[]>([])
  const [alerts, setAlerts] = useState<ScalingAlert[]>([])
  const [history, setHistory] = useState<ScalingHistory[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [selectedTab, setSelectedTab] = useState('overview')
  const [isLoading, setIsLoading] = useState(false)
  const [autoScaler] = useState(() => new AutoScaler(
    {
      checkInterval: 30000, // 30 seconds
      cooldownPeriod: 300000, // 5 minutes
      healthCheckInterval: 60000, // 1 minute
      metricsRetentionDays: 7,
      enableCostOptimization: true,
      enablePredictiveScaling: false
    },
    {
      region: 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      instanceType: 't3.medium',
      amiId: 'ami-0c55b159cbfafe1f0',
      keyName: 'claudebox-key',
      securityGroupIds: ['sg-1234567890abcdef0'],
      subnetId: 'subnet-1234567890abcdef0'
    }
  ))

  useEffect(() => {
    // Initialize with current data
    loadScalingData()

    // Set up real-time updates
    const interval = setInterval(() => {
      if (isRunning) {
        loadScalingData()
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [isRunning])

  const loadScalingData = async () => {
    try {
      const [currentMetrics, activePolicies, activeInstances, recentEvents, activeAlerts, scalingHistory] = await Promise.all([
        autoScaler.getCurrentMetrics(),
        autoScaler.getPolicies(),
        autoScaler.getInstances(),
        autoScaler.getEvents(),
        autoScaler.getAlerts(),
        autoScaler.getHistory()
      ])

      setMetrics(currentMetrics)
      setPolicies(activePolicies)
      setInstances(activeInstances)
      setEvents(recentEvents)
      setAlerts(activeAlerts)
      setHistory(scalingHistory)
    } catch (error) {
      console.error('Failed to load scaling data:', error)
    }
  }

  const toggleAutoScaling = async () => {
    if (isRunning) {
      autoScaler.stop()
      setIsRunning(false)
    } else {
      await autoScaler.start()
      setIsRunning(true)
    }
  }

  const forceScaling = async (policyId: string, direction: 'up' | 'down', instances: number = 1) => {
    setIsLoading(true)
    try {
      await autoScaler.forceScaling(policyId, direction, instances)
      await loadScalingData()
    } catch (error) {
      console.error('Force scaling failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const resolveAlert = async (alertId: string) => {
    try {
      await autoScaler.resolveAlert(alertId)
      await loadScalingData()
    } catch (error) {
      console.error('Failed to resolve alert:', error)
    }
  }

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatUtilization = (value: number): string => {
    return value.toFixed(1) + '%'
  }

  const getUtilizationColor = (percentage: number): string => {
    if (percentage >= 90) return 'text-red-600'
    if (percentage >= 70) return 'text-yellow-600'
    return 'text-green-600'
  }

  const getInstanceStatusColor = (status: InstanceInfo['status']): string => {
    switch (status) {
      case 'running': return 'text-green-600'
      case 'pending': return 'text-yellow-600'
      case 'stopping': return 'text-orange-600'
      case 'stopped': return 'text-gray-600'
      case 'terminated': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getInstanceHealthColor = (health: InstanceInfo['health']): string => {
    switch (health) {
      case 'healthy': return 'text-green-600'
      case 'unhealthy': return 'text-red-600'
      case 'initializing': return 'text-yellow-600'
      default: return 'text-gray-600'
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

  const getEventTypeIcon = (eventType: ScalingHistory['eventType']) => {
    switch (eventType) {
      case 'scale_up': return <TrendingUp className="h-4 w-4" />
      case 'scale_down': return <TrendingDown className="h-4 w-4" />
      case 'policy_change': return <Settings className="h-4 w-4" />
      case 'config_change': return <Settings className="h-4 w-4" />
      default: return <Info className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Auto-scaling Dashboard</h1>
          <p className="text-gray-600">Manage automatic scaling policies and monitor instance health</p>
        </div>
        <div className="flex items-center space-x-4">
          <Button
            onClick={toggleAutoScaling}
            variant={isRunning ? "destructive" : "default"}
            className="flex items-center space-x-2"
          >
            {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            <span>{isRunning ? 'Stop Auto-scaling' : 'Start Auto-scaling'}</span>
          </Button>
          <Button
            onClick={loadScalingData}
            disabled={isLoading}
            variant="outline"
            className="flex items-center space-x-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.slice(0, 3).map((alert) => (
            <Alert key={alert.id} className={getAlertSeverityColor(alert.severity)}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <div>
                  <strong>{alert.category.toUpperCase()} Alert:</strong> {alert.message}
                  <div className="text-sm mt-1">
                    Recommended: {alert.recommendedAction}
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
          <TabsTrigger value="instances">Instances</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics && (
              <>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Overall Utilization</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${getUtilizationColor(metrics.overallUtilization)}`}>
                      {formatUtilization(metrics.overallUtilization)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {instances.length} instances, {metrics.activeUsers} users
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Hourly Cost</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(metrics.costPerHour)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      ~{formatCurrency(metrics.costPerHour * 24 * 30)}/month
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Slots</CardTitle>
                    <Target className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {metrics.activeSlots}/{metrics.totalSlots}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatUtilization(metrics.slotUtilization)} utilization
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Request Rate</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {metrics.requestRate}/min
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {metrics.responseTime.toFixed(0)}ms avg response
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Instance Status</CardTitle>
                <CardDescription>Current instance health and utilization</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {instances.slice(0, 5).map((instance) => (
                  <div key={instance.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Server className="h-4 w-4" />
                      <div>
                        <p className="font-medium">{instance.instanceId}</p>
                        <p className="text-sm text-gray-600">
                          <span className={getInstanceStatusColor(instance.status)}>
                            {instance.status}
                          </span>
                          {' • '}
                          <span className={getInstanceHealthColor(instance.health)}>
                            {instance.health}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">{instance.activeSlots}/{instance.slotCapacity} slots</p>
                      <p className="text-sm text-gray-600">
                        CPU: {formatUtilization(instance.cpuUtilization)}
                      </p>
                    </div>
                  </div>
                ))}
                {instances.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No instances found</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Scaling Events</CardTitle>
                <CardDescription>Latest auto-scaling activities</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {events.slice(0, 5).map((event) => (
                  <div key={event.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      {event.type === 'scale_up' ? <TrendingUp className="h-4 w-4 text-green-600" /> : <TrendingDown className="h-4 w-4 text-red-600" />}
                      <div>
                        <p className="font-medium capitalize">{event.type.replace('_', ' ')}</p>
                        <p className="text-sm text-gray-600">
                          {event.previousInstanceCount} → {event.newInstanceCount} instances
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={event.status === 'completed' ? 'default' : 'secondary'}>
                        {event.status}
                      </Badge>
                      <p className="text-xs text-gray-500">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
                {events.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No scaling events found</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="instances" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Instance Management</CardTitle>
              <CardDescription>Monitor and manage individual instances</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {instances.map((instance) => (
                  <Card key={instance.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">{instance.instanceId}</CardTitle>
                          <CardDescription>
                            {instance.publicIp} • {instance.privateIp}
                          </CardDescription>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className={getInstanceStatusColor(instance.status)}>
                            {instance.status}
                          </Badge>
                          <Badge variant="outline" className={getInstanceHealthColor(instance.health)}>
                            {instance.health}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm font-medium">CPU Utilization</p>
                          <div className="flex items-center space-x-2">
                            <Progress value={instance.cpuUtilization} className="flex-1" />
                            <span className="text-sm font-medium">{formatUtilization(instance.cpuUtilization)}</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Memory Utilization</p>
                          <div className="flex items-center space-x-2">
                            <Progress value={instance.memoryUtilization} className="flex-1" />
                            <span className="text-sm font-medium">{formatUtilization(instance.memoryUtilization)}</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Slot Usage</p>
                          <p className="text-lg font-semibold">
                            {instance.activeSlots}/{instance.slotCapacity}
                          </p>
                          <p className="text-sm text-gray-600">
                            {formatUtilization((instance.activeSlots / instance.slotCapacity) * 100)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Cost</p>
                          <p className="text-lg font-semibold text-green-600">
                            {formatCurrency(instance.cost.hourly)}/hr
                          </p>
                          <p className="text-sm text-gray-600">
                            {formatCurrency(instance.cost.estimatedMonthly)}/mo
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 text-sm text-gray-600">
                        <p>Region: {instance.region} ({instance.availabilityZone})</p>
                        <p>Type: {instance.instanceType} • Launched: {new Date(instance.launchTime).toLocaleDateString()}</p>
                        <p>Last Health Check: {new Date(instance.lastHealthCheck).toLocaleString()}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {instances.length === 0 && (
                  <p className="text-gray-500 text-center py-8">No instances available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scaling Policies</CardTitle>
              <CardDescription>Configure auto-scaling policies and thresholds</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {policies.map((policy) => (
                  <Card key={policy.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">{policy.name}</CardTitle>
                          <CardDescription>{policy.description}</CardDescription>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={policy.enabled ? "default" : "secondary"}>
                            {policy.enabled ? "Enabled" : "Disabled"}
                          </Badge>
                          <div className="flex space-x-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => forceScaling(policy.id, 'up')}
                              disabled={isLoading || !isRunning}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => forceScaling(policy.id, 'down')}
                              disabled={isLoading || !isRunning}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm font-medium">Thresholds</p>
                          <p className="text-sm">Scale Up: {formatUtilization(policy.scaleUpThreshold)}</p>
                          <p className="text-sm">Scale Down: {formatUtilization(policy.scaleDownThreshold)}</p>
                          <p className="text-sm">Target: {formatUtilization(policy.targetUtilization)}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Instance Limits</p>
                          <p className="text-sm">Min: {policy.minInstances} instances</p>
                          <p className="text-sm">Max: {policy.maxInstances} instances</p>
                          <p className="text-sm">Current: {instances.length} instances</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Cost Constraints</p>
                          <p className="text-sm">Max Hourly: {formatCurrency(policy.costConstraints.maxHourlyCost)}</p>
                          <p className="text-sm">Max Daily: {formatCurrency(policy.costConstraints.maxDailyCost)}</p>
                          <p className="text-sm">Reserved: {policy.costConstraints.reservedInstances}</p>
                        </div>
                      </div>
                      <div className="mt-4">
                        <p className="text-sm font-medium">Scaling Factors</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                          <div className="text-center p-2 border rounded">
                            <p className="text-xs text-gray-600">CPU</p>
                            <p className="font-medium">{formatUtilization(policy.scalingFactors.cpu * 100)}</p>
                          </div>
                          <div className="text-center p-2 border rounded">
                            <p className="text-xs text-gray-600">Memory</p>
                            <p className="font-medium">{formatUtilization(policy.scalingFactors.memory * 100)}</p>
                          </div>
                          <div className="text-center p-2 border rounded">
                            <p className="text-xs text-gray-600">Slots</p>
                            <p className="font-medium">{formatUtilization(policy.scalingFactors.slots * 100)}</p>
                          </div>
                          <div className="text-center p-2 border rounded">
                            <p className="text-xs text-gray-600">Requests</p>
                            <p className="font-medium">{formatUtilization(policy.scalingFactors.requests * 100)}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {policies.length === 0 && (
                  <p className="text-gray-500 text-center py-8">No scaling policies configured</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scaling Event History</CardTitle>
              <CardDescription>Complete history of scaling events and activities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {events.map((event) => (
                  <div key={event.id} className={`p-4 border rounded-lg ${event.status === 'failed' ? 'border-red-200 bg-red-50' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {event.type === 'scale_up' ? <TrendingUp className="h-5 w-5 text-green-600" /> : <TrendingDown className="h-5 w-5 text-red-600" />}
                        <Badge variant={event.status === 'completed' ? 'default' : 'secondary'}>
                          {event.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(event.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <p className="font-medium mb-1 capitalize">{event.type.replace('_', ' ')}</p>
                    <p className="text-sm text-gray-600 mb-2">{event.reason}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Instances:</span> {event.previousInstanceCount} → {event.newInstanceCount}
                      </div>
                      <div>
                        <span className="font-medium">Cost Change:</span> {formatCurrency(event.cost.estimatedAdditionalCost)}/hr
                      </div>
                      <div>
                        <span className="font-medium">Utilization:</span> {formatUtilization(event.metrics.overallUtilization)}
                      </div>
                      <div>
                        <span className="font-medium">Policy:</span> {event.policyId}
                      </div>
                    </div>
                    {event.errorMessage && (
                      <div className="mt-2 p-2 bg-red-100 border border-red-200 rounded text-sm text-red-700">
                        <strong>Error:</strong> {event.errorMessage}
                      </div>
                    )}
                  </div>
                ))}
                {events.length === 0 && (
                  <p className="text-gray-500 text-center py-8">No scaling events found</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scaling Alerts</CardTitle>
              <CardDescription>System alerts and notifications</CardDescription>
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
                    <p className="text-sm text-gray-700 mb-3">
                      Recommended: {alert.recommendedAction}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-500">
                        {alert.instanceId && <span>Instance: {alert.instanceId}</span>}
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
                  <p className="text-gray-500 text-center py-8">No alerts found</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default AutoScalingDashboard