'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Settings,
  Bell,
  TrendingUp,
  Server,
  Database,
  Zap
} from 'lucide-react';
import { HealthMonitor } from '@/services/health-monitor';
import { HealthCheck, SystemMetrics, HealthAlert, MonitoringConfig } from '@/types/health';

const defaultConfig: MonitoringConfig = {
  checkInterval: 30000, // 30 seconds
  alertThresholds: {
    cpu: 80,
    memory: 80,
    disk: 80,
    responseTime: 5000
  },
  recoveryActions: {
    autoRestart: true,
    maxRetries: 3,
    retryDelay: 5000
  },
  notifications: {
    enabled: true,
    channels: ['console', 'webhook']
  }
};

export default function HealthMonitoring() {
  const [monitor] = useState(() => new HealthMonitor(defaultConfig));
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (autoRefresh && !isRunning) {
      startMonitoring();
    }

    return () => {
      if (isRunning) {
        stopMonitoring();
      }
    };
  }, [autoRefresh, isRunning]);

  const startMonitoring = async () => {
    try {
      await monitor.start();
      setIsRunning(true);
      updateData();
    } catch (error) {
      console.error('Failed to start monitoring:', error);
    }
  };

  const stopMonitoring = async () => {
    try {
      await monitor.stop();
      setIsRunning(false);
    } catch (error) {
      console.error('Failed to stop monitoring:', error);
    }
  };

  const updateData = () => {
    setMetrics(monitor.getMetrics());
    setAlerts([...monitor.getAlerts()]);
  };

  const handleRefresh = () => {
    updateData();
  };

  const handleResolveAlert = (alertId: string) => {
    monitor.resolveAlert(alertId);
    updateData();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'unhealthy':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500';
      case 'degraded':
        return 'bg-yellow-500';
      case 'unhealthy':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getAlertTypeColor = (type: string) => {
    switch (type) {
      case 'critical':
        return 'bg-red-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'info':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-yellow-500" />
          <h1 className="text-2xl font-bold text-white">Health Monitoring</h1>
          <Badge variant={isRunning ? "default" : "secondary"}>
            {isRunning ? "Active" : "Inactive"}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          {isRunning ? (
            <Button variant="destructive" size="sm" onClick={stopMonitoring}>
              <XCircle className="w-4 h-4 mr-2" />
              Stop
            </Button>
          ) : (
            <Button variant="default" size="sm" onClick={startMonitoring}>
              <Activity className="w-4 h-4 mr-2" />
              Start
            </Button>
          )}
        </div>
      </div>

      {/* System Overview */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-custom-box border-custom-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">CPU Usage</CardTitle>
              <Zap className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{metrics.cpu.usage.toFixed(1)}%</div>
              <p className="text-xs text-slate-400">
                {metrics.cpu.cores} cores • Load: {metrics.cpu.loadAverage[0].toFixed(2)}
              </p>
              <div className="mt-2 w-full bg-slate-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${metrics.cpu.usage > 80 ? 'bg-red-500' : metrics.cpu.usage > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                  style={{ width: `${metrics.cpu.usage}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-custom-box border-custom-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Memory Usage</CardTitle>
              <Database className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{metrics.memory.percentage.toFixed(1)}%</div>
              <p className="text-xs text-slate-400">
                {formatBytes(metrics.memory.used)} / {formatBytes(metrics.memory.total)}
              </p>
              <div className="mt-2 w-full bg-slate-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${metrics.memory.percentage > 80 ? 'bg-red-500' : metrics.memory.percentage > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                  style={{ width: `${metrics.memory.percentage}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-custom-box border-custom-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Disk Usage</CardTitle>
              <Server className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{metrics.disk.percentage.toFixed(1)}%</div>
              <p className="text-xs text-slate-400">
                {formatBytes(metrics.disk.used)} / {formatBytes(metrics.disk.total)}
              </p>
              <div className="mt-2 w-full bg-slate-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${metrics.disk.percentage > 80 ? 'bg-red-500' : metrics.disk.percentage > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                  style={{ width: `${metrics.disk.percentage}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-custom-box border-custom-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Active Alerts</CardTitle>
              <Bell className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {alerts.filter(a => !a.resolved).length}
              </div>
              <p className="text-xs text-slate-400">
                {alerts.filter(a => a.type === 'critical').length} critical
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Service Health */}
      {metrics && (
        <Card className="bg-custom-box border-custom-border">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-yellow-500" />
              Service Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {metrics.services.map((service) => (
                <div
                  key={service.id}
                  className="p-4 bg-slate-800 rounded-lg border border-slate-700"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(service.status)}
                      <span className="font-medium text-white">{service.serviceName}</span>
                    </div>
                    <Badge className={getStatusColor(service.status)}>
                      {service.status}
                    </Badge>
                  </div>
                  <div className="space-y-2 text-sm text-slate-400">
                    <div className="flex justify-between">
                      <span>Response Time:</span>
                      <span className="text-white">{service.responseTime}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Last Check:</span>
                      <span className="text-white">{formatUptime(service.lastCheck)} ago</span>
                    </div>
                    {service.errorMessage && (
                      <div className="text-red-400 text-xs">
                        {service.errorMessage}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerts */}
      <Card className="bg-custom-box border-custom-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            Recent Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
              <p>No alerts detected</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg border ${
                    alert.resolved 
                      ? 'bg-slate-800 border-slate-700' 
                      : alert.type === 'critical'
                        ? 'bg-red-900 border-red-700'
                        : alert.type === 'warning'
                          ? 'bg-yellow-900 border-yellow-700'
                          : 'bg-blue-900 border-blue-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${getAlertTypeColor(alert.type)}`} />
                      <div>
                        <div className="font-medium text-white">{alert.service}</div>
                        <div className="text-sm text-slate-300">{alert.message}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-slate-400">
                        {formatUptime(alert.timestamp)} ago
                      </div>
                      {!alert.resolved && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResolveAlert(alert.id)}
                        >
                          Resolve
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}