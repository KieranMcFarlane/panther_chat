'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart3, 
  Activity, 
  Cpu, 
  HardDrive, 
  MemoryStick,
  Zap,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Globe,
  Database,
  Users,
  Server,
  Timer,
  Gauge
} from 'lucide-react';

interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number;
    cores: number;
    frequency: number;
    temperature: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    cached: number;
    usage: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usage: number;
    readSpeed: number;
    writeSpeed: number;
  };
  network: {
    incoming: number;
    outgoing: number;
    totalIncoming: number;
    totalOutgoing: number;
  };
  slots: {
    total: number;
    active: number;
    inactive: number;
    error: number;
    avgCpuUsage: number;
    avgMemoryUsage: number;
  };
  users: {
    total: number;
    active: number;
    sessions: number;
  };
}

interface PerformanceHistory {
  timestamp: Date;
  cpu: number;
  memory: number;
  disk: number;
  activeSlots: number;
  activeUsers: number;
}

export default function SystemMonitoring() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [history, setHistory] = useState<PerformanceHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadMetrics();
    
    if (autoRefresh) {
      const interval = setInterval(loadMetrics, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const loadMetrics = async () => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockMetrics: SystemMetrics = {
        timestamp: new Date(),
        cpu: {
          usage: Math.random() * 100,
          cores: 8,
          frequency: 2.4,
          temperature: 45 + Math.random() * 25
        },
        memory: {
          total: 16384,
          used: 8192 + Math.random() * 4096,
          free: 4096 + Math.random() * 2048,
          cached: 2048 + Math.random() * 1024,
          usage: 50 + Math.random() * 30
        },
        disk: {
          total: 512000,
          used: 256000 + Math.random() * 50000,
          free: 256000 - Math.random() * 50000,
          usage: 50 + Math.random() * 10,
          readSpeed: Math.random() * 100,
          writeSpeed: Math.random() * 80
        },
        network: {
          incoming: Math.random() * 1000000,
          outgoing: Math.random() * 800000,
          totalIncoming: 1250000000,
          totalOutgoing: 890000000
        },
        slots: {
          total: 89,
          active: 76 + Math.floor(Math.random() * 10) - 5,
          inactive: 8 + Math.floor(Math.random() * 5),
          error: 1 + Math.floor(Math.random() * 3),
          avgCpuUsage: 25 + Math.random() * 20,
          avgMemoryUsage: 512 + Math.random() * 256
        },
        users: {
          total: 156,
          active: 142 + Math.floor(Math.random() * 10) - 5,
          sessions: 127 + Math.floor(Math.random() * 15) - 7
        }
      };

      setMetrics(mockMetrics);

      // Add to history
      const newHistory: PerformanceHistory = {
        timestamp: new Date(),
        cpu: mockMetrics.cpu.usage,
        memory: mockMetrics.memory.usage,
        disk: mockMetrics.disk.usage,
        activeSlots: mockMetrics.slots.active,
        activeUsers: mockMetrics.users.active
      };

      setHistory(prev => {
        const updated = [...prev, newHistory];
        return updated.slice(-20); // Keep last 20 entries
      });

    } catch (error) {
      console.error('Failed to load metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSec: number) => {
    return formatBytes(bytesPerSec) + '/s';
  };

  const getStatusColor = (value: number, thresholds: { warning: number; critical: number }) => {
    if (value >= thresholds.critical) return 'text-red-400';
    if (value >= thresholds.warning) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getHealthStatus = () => {
    if (!metrics) return 'unknown';
    
    const issues = [];
    if (metrics.cpu.usage > 90) issues.push('High CPU');
    if (metrics.memory.usage > 90) issues.push('High Memory');
    if (metrics.disk.usage > 95) issues.push('High Disk');
    if (metrics.slots.error > 5) issues.push('Slot Errors');
    
    if (issues.length === 0) return 'healthy';
    if (issues.length <= 2) return 'warning';
    return 'critical';
  };

  const healthStatus = getHealthStatus();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-header-xl text-header">System Monitoring</h2>
          <p className="text-slate-400">Real-time system metrics and performance monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Label className="text-sm text-slate-300">Auto Refresh</Label>
            <Button
              size="sm"
              variant={autoRefresh ? 'default' : 'outline'}
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={autoRefresh ? 'bg-yellow-500 text-black' : ''}
            >
              {autoRefresh ? 'On' : 'Off'}
            </Button>
          </div>
          <Button variant="outline" onClick={loadMetrics}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Status */}
      <Card className="bg-custom-box border-custom-border">
        <CardHeader>
          <CardTitle className="font-header-md text-header flex items-center gap-2">
            <Activity className="w-4 h-4" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className={
                healthStatus === 'healthy' ? 'text-green-400 border-green-400' :
                healthStatus === 'warning' ? 'text-yellow-400 border-yellow-400' :
                healthStatus === 'critical' ? 'text-red-400 border-red-400' :
                'text-gray-400 border-gray-400'
              }>
                {healthStatus === 'healthy' && <CheckCircle className="w-3 h-3 mr-1" />}
                {healthStatus === 'warning' && <AlertCircle className="w-3 h-3 mr-1" />}
                {healthStatus === 'critical' && <AlertCircle className="w-3 h-3 mr-1" />}
                System {healthStatus.toUpperCase()}
              </Badge>
              <span className="text-sm text-slate-400">
                Last updated: {metrics?.timestamp.toLocaleTimeString()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">Uptime</span>
              <span className="text-sm text-white">7d 14h 32m</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-custom-box border-custom-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">CPU Usage</p>
                <p className={`text-2xl font-bold ${getStatusColor(metrics?.cpu.usage || 0, { warning: 80, critical: 90 })}`}>
                  {metrics?.cpu.usage.toFixed(1)}%
                </p>
                <p className="text-xs text-slate-500">{metrics?.cpu.cores} cores @ {metrics?.cpu.frequency}GHz</p>
              </div>
              <Cpu className="w-8 h-8 text-blue-500" />
            </div>
            <Progress value={metrics?.cpu.usage} className="mt-3 h-2" />
          </CardContent>
        </Card>

        <Card className="bg-custom-box border-custom-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Memory Usage</p>
                <p className={`text-2xl font-bold ${getStatusColor(metrics?.memory.usage || 0, { warning: 85, critical: 95 })}`}>
                  {metrics?.memory.usage.toFixed(1)}%
                </p>
                <p className="text-xs text-slate-500">{formatBytes(metrics?.memory.used || 0)} / {formatBytes(metrics?.memory.total || 0)}</p>
              </div>
              <MemoryStick className="w-8 h-8 text-purple-500" />
            </div>
            <Progress value={metrics?.memory.usage} className="mt-3 h-2" />
          </CardContent>
        </Card>

        <Card className="bg-custom-box border-custom-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Active Slots</p>
                <p className="text-2xl font-bold text-green-400">{metrics?.slots.active}</p>
                <p className="text-xs text-slate-500">{metrics?.slots.error} errors</p>
              </div>
              <Server className="w-8 h-8 text-green-500" />
            </div>
            <Progress value={(metrics?.slots.active || 0) / (metrics?.slots.total || 1) * 100} className="mt-3 h-2" />
          </CardContent>
        </Card>

        <Card className="bg-custom-box border-custom-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Active Users</p>
                <p className="text-2xl font-bold text-blue-400">{metrics?.users.active}</p>
                <p className="text-xs text-slate-500">{metrics?.users.sessions} sessions</p>
              </div>
              <Users className="w-8 h-8 text-yellow-500" />
            </div>
            <Progress value={(metrics?.users.active || 0) / (metrics?.users.total || 1) * 100} className="mt-3 h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <Tabs defaultValue="system" className="space-y-6">
        <TabsList className="bg-custom-box border-custom-border">
          <TabsTrigger value="system">System Resources</TabsTrigger>
          <TabsTrigger value="slots">Slot Metrics</TabsTrigger>
          <TabsTrigger value="network">Network</TabsTrigger>
          <TabsTrigger value="history">Performance History</TabsTrigger>
        </TabsList>

        <TabsContent value="system" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-custom-box border-custom-border">
              <CardHeader>
                <CardTitle className="font-header-md text-header flex items-center gap-2">
                  <Cpu className="w-4 h-4" />
                  CPU Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-400">Usage</p>
                    <p className={`text-lg font-bold ${getStatusColor(metrics?.cpu.usage || 0, { warning: 80, critical: 90 })}`}>
                      {metrics?.cpu.usage.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Cores</p>
                    <p className="text-lg font-bold text-white">{metrics?.cpu.cores}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Frequency</p>
                    <p className="text-lg font-bold text-white">{metrics?.cpu.frequency} GHz</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Temperature</p>
                    <p className={`text-lg font-bold ${getStatusColor(metrics?.cpu.temperature || 0, { warning: 70, critical: 85 })}`}>
                      {metrics?.cpu.temperature.toFixed(1)}°C
                    </p>
                  </div>
                </div>
                <Progress value={metrics?.cpu.usage} className="h-3" />
              </CardContent>
            </Card>

            <Card className="bg-custom-box border-custom-border">
              <CardHeader>
                <CardTitle className="font-header-md text-header flex items-center gap-2">
                  <MemoryStick className="w-4 h-4" />
                  Memory Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-400">Total</p>
                    <p className="text-lg font-bold text-white">{formatBytes(metrics?.memory.total || 0)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Used</p>
                    <p className="text-lg font-bold text-white">{formatBytes(metrics?.memory.used || 0)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Free</p>
                    <p className="text-lg font-bold text-white">{formatBytes(metrics?.memory.free || 0)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Cached</p>
                    <p className="text-lg font-bold text-white">{formatBytes(metrics?.memory.cached || 0)}</p>
                  </div>
                </div>
                <Progress value={metrics?.memory.usage} className="h-3" />
              </CardContent>
            </Card>

            <Card className="bg-custom-box border-custom-border">
              <CardHeader>
                <CardTitle className="font-header-md text-header flex items-center gap-2">
                  <HardDrive className="w-4 h-4" />
                  Disk Usage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-400">Total</p>
                    <p className="text-lg font-bold text-white">{formatBytes(metrics?.disk.total || 0)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Used</p>
                    <p className="text-lg font-bold text-white">{formatBytes(metrics?.disk.used || 0)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Free</p>
                    <p className="text-lg font-bold text-white">{formatBytes(metrics?.disk.free || 0)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Usage</p>
                    <p className={`text-lg font-bold ${getStatusColor(metrics?.disk.usage || 0, { warning: 90, critical: 95 })}`}>
                      {metrics?.disk.usage.toFixed(1)}%
                    </p>
                  </div>
                </div>
                <Progress value={metrics?.disk.usage} className="h-3" />
              </CardContent>
            </Card>

            <Card className="bg-custom-box border-custom-border">
              <CardHeader>
                <CardTitle className="font-header-md text-header flex items-center gap-2">
                  <Gauge className="w-4 h-4" />
                  Disk I/O
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-400">Read Speed</p>
                    <p className="text-lg font-bold text-green-400">{formatSpeed(metrics?.disk.readSpeed || 0)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Write Speed</p>
                    <p className="text-lg font-bold text-blue-400">{formatSpeed(metrics?.disk.writeSpeed || 0)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="slots" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-custom-box border-custom-border">
              <CardHeader>
                <CardTitle className="font-header-md text-header flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  Slot Status Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-400">{metrics?.slots.active}</p>
                    <p className="text-sm text-slate-400">Active</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-400">{metrics?.slots.inactive}</p>
                    <p className="text-sm text-slate-400">Inactive</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-400">{metrics?.slots.error}</p>
                    <p className="text-sm text-slate-400">Error</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-400">{metrics?.slots.total}</p>
                    <p className="text-sm text-slate-400">Total</p>
                  </div>
                </div>
                <Progress value={(metrics?.slots.active || 0) / (metrics?.slots.total || 1) * 100} className="h-3" />
              </CardContent>
            </Card>

            <Card className="bg-custom-box border-custom-border">
              <CardHeader>
                <CardTitle className="font-header-md text-header flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Slot Resource Usage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-400">Avg CPU Usage</p>
                    <p className="text-lg font-bold text-white">{metrics?.slots.avgCpuUsage.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Avg Memory Usage</p>
                    <p className="text-lg font-bold text-white">{metrics?.slots.avgMemoryUsage.toFixed(0)} MB</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="network" className="space-y-6">
          <Card className="bg-custom-box border-custom-border">
            <CardHeader>
              <CardTitle className="font-header-md text-header flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Network Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="text-center">
                  <p className="text-sm text-slate-400">Incoming</p>
                  <p className="text-2xl font-bold text-green-400">{formatSpeed(metrics?.network.incoming || 0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-slate-400">Outgoing</p>
                  <p className="text-2xl font-bold text-blue-400">{formatSpeed(metrics?.network.outgoing || 0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-slate-400">Total In</p>
                  <p className="text-lg font-bold text-white">{formatBytes(metrics?.network.totalIncoming || 0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-slate-400">Total Out</p>
                  <p className="text-lg font-bold text-white">{formatBytes(metrics?.network.totalOutgoing || 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card className="bg-custom-box border-custom-border">
            <CardHeader>
              <CardTitle className="font-header-md text-header flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Performance History
              </CardTitle>
              <CardDescription className="text-slate-400">
                Last 20 performance metrics snapshots
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {history.map((entry, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border border-custom-border rounded">
                    <span className="text-sm text-slate-300">
                      {entry.timestamp.toLocaleTimeString()}
                    </span>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">CPU</span>
                        <span className={`text-sm ${getStatusColor(entry.cpu, { warning: 80, critical: 90 })}`}>
                          {entry.cpu.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Memory</span>
                        <span className={`text-sm ${getStatusColor(entry.memory, { warning: 85, critical: 95 })}`}>
                          {entry.memory.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Slots</span>
                        <span className="text-sm text-green-400">{entry.activeSlots}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Users</span>
                        <span className="text-sm text-blue-400">{entry.activeUsers}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}