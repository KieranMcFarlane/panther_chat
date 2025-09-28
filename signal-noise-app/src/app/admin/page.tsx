'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  Users, 
  BarChart3, 
  Activity, 
  Settings,
  Database,
  Monitor,
  Zap,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Cpu,
  HardDrive,
  MemoryStick,
  Globe,
  Server,
  Key,
  UserCheck,
  UserX,
  TrendingUp,
  TrendingDown,
  Plus
} from 'lucide-react';
import HealthMonitoring from '@/components/monitoring/HealthMonitoring';

interface User {
  id: string;
  email: string;
  authProvider: string;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: Date;
  lastLogin: Date;
  slotCount: number;
  totalUsage: number;
}

interface Slot {
  id: string;
  name: string;
  userId: string;
  userEmail: string;
  status: 'active' | 'inactive' | 'error' | 'creating';
  authProvider: string;
  createdAt: Date;
  lastActivity: Date;
  cpuUsage: number;
  memoryUsage: number;
}

interface SystemMetrics {
  totalUsers: number;
  activeUsers: number;
  totalSlots: number;
  activeSlots: number;
  systemCpuUsage: number;
  systemMemoryUsage: number;
  totalMemoryGB: number;
  usedMemoryGB: number;
  diskUsageGB: number;
  totalDiskGB: number;
  networkIO: {
    incoming: number;
    outgoing: number;
  };
  uptime: number;
}

interface AuthProvider {
  id: string;
  name: string;
  type: 'oauth2' | 'oidc' | 'saml' | 'api_key' | 'claude';
  status: 'active' | 'inactive' | 'error';
  userCount: number;
  lastUsed: Date;
  configStatus: 'configured' | 'pending' | 'error';
}

export default function AdminDashboard() {
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [authProviders, setAuthProviders] = useState<AuthProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('overview');

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Mock system metrics
    const mockMetrics: SystemMetrics = {
      totalUsers: 156,
      activeUsers: 142,
      totalSlots: 89,
      activeSlots: 76,
      systemCpuUsage: 45.2,
      systemMemoryUsage: 67.8,
      totalMemoryGB: 16,
      usedMemoryGB: 10.8,
      diskUsageGB: 245,
      totalDiskGB: 500,
      networkIO: {
        incoming: 1250000,
        outgoing: 890000
      },
      uptime: 86400 * 7 // 7 days
    };

    // Mock users
    const mockUsers: User[] = Array.from({ length: 10 }, (_, i) => ({
      id: `user-${i + 1}`,
      email: `user${i + 1}@example.com`,
      authProvider: ['claude-pro', 'google-oauth', 'github-oauth', 'api-key'][Math.floor(Math.random() * 4)],
      status: ['active', 'active', 'inactive', 'suspended'][Math.floor(Math.random() * 4)] as 'active' | 'inactive' | 'suspended',
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      lastLogin: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      slotCount: Math.floor(Math.random() * 3) + 1,
      totalUsage: Math.random() * 100 + 10
    }));

    // Mock slots
    const mockSlots: Slot[] = Array.from({ length: 20 }, (_, i) => ({
      id: `slot-${i + 1}`,
      name: `ClaudeBox Slot ${i + 1}`,
      userId: `user-${Math.floor(Math.random() * 10) + 1}`,
      userEmail: `user${Math.floor(Math.random() * 10) + 1}@example.com`,
      status: ['active', 'inactive', 'error', 'creating'][Math.floor(Math.random() * 4)] as 'active' | 'inactive' | 'error' | 'creating',
      authProvider: ['claude-pro', 'google-oauth', 'github-oauth'][Math.floor(Math.random() * 3)],
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      lastActivity: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 2048,
    }));

    // Mock auth providers
    const mockProviders: AuthProvider[] = [
      {
        id: 'claude-pro',
        name: 'Claude Pro',
        type: 'claude',
        status: 'active',
        userCount: 89,
        lastUsed: new Date(),
        configStatus: 'configured'
      },
      {
        id: 'google-oauth',
        name: 'Google OAuth',
        type: 'oauth2',
        status: 'active',
        userCount: 45,
        lastUsed: new Date(Date.now() - 60 * 60 * 1000),
        configStatus: 'configured'
      },
      {
        id: 'github-oauth',
        name: 'GitHub OAuth',
        type: 'oauth2',
        status: 'active',
        userCount: 22,
        lastUsed: new Date(Date.now() - 2 * 60 * 60 * 1000),
        configStatus: 'configured'
      }
    ];

    setSystemMetrics(mockMetrics);
    setUsers(mockUsers);
    setSlots(mockSlots);
    setAuthProviders(mockProviders);
    setLoading(false);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-yellow-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-header-xl text-header">Admin Dashboard</h1>
          <p className="text-slate-400">System administration and management interface</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-green-400 border-green-400">
            <CheckCircle className="w-3 h-3 mr-1" />
            System Healthy
          </Badge>
          <Button variant="outline" size="sm" onClick={loadAdminData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-custom-box border-custom-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Total Users</p>
                <p className="text-2xl font-bold">{systemMetrics?.totalUsers}</p>
                <p className="text-xs text-slate-500">{systemMetrics?.activeUsers} active</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-custom-box border-custom-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Active Slots</p>
                <p className="text-2xl font-bold">{systemMetrics?.activeSlots}</p>
                <p className="text-xs text-slate-500">{systemMetrics?.totalSlots} total</p>
              </div>
              <Server className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-custom-box border-custom-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">System CPU</p>
                <p className="text-2xl font-bold">{systemMetrics?.systemCpuUsage.toFixed(1)}%</p>
                <Progress value={systemMetrics?.systemCpuUsage} className="w-20 h-2 mt-1" />
              </div>
              <Cpu className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-custom-box border-custom-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Memory Usage</p>
                <p className="text-2xl font-bold">{systemMetrics?.systemMemoryUsage.toFixed(1)}%</p>
                <p className="text-xs text-slate-500">{systemMetrics?.usedMemoryGB.toFixed(1)}/{systemMetrics?.totalMemoryGB}GB</p>
              </div>
              <MemoryStick className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList className="bg-custom-box border-custom-border">
          <TabsTrigger value="overview">System Overview</TabsTrigger>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="slots">Slot Management</TabsTrigger>
          <TabsTrigger value="auth">Auth Providers</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* System Status */}
            <Card className="bg-custom-box border-custom-border">
              <CardHeader>
                <CardTitle className="font-header-md text-header flex items-center gap-2">
                  <Monitor className="w-4 h-4" />
                  System Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">System Uptime</span>
                  <span className="text-sm text-white">{formatUptime(systemMetrics?.uptime || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Disk Usage</span>
                  <span className="text-sm text-white">
                    {systemMetrics?.diskUsageGB.toFixed(1)}/{systemMetrics?.totalDiskGB}GB
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Network In</span>
                  <span className="text-sm text-white">
                    {formatBytes(systemMetrics?.networkIO.incoming || 0)}/s
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Network Out</span>
                  <span className="text-sm text-white">
                    {formatBytes(systemMetrics?.networkIO.outgoing || 0)}/s
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Resource Usage */}
            <Card className="bg-custom-box border-custom-border">
              <CardHeader>
                <CardTitle className="font-header-md text-header flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Resource Usage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-300">CPU Usage</span>
                    <span className="text-sm text-white">{systemMetrics?.systemCpuUsage.toFixed(1)}%</span>
                  </div>
                  <Progress value={systemMetrics?.systemCpuUsage} className="h-2" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-300">Memory Usage</span>
                    <span className="text-sm text-white">{systemMetrics?.systemMemoryUsage.toFixed(1)}%</span>
                  </div>
                  <Progress value={systemMetrics?.systemMemoryUsage} className="h-2" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-300">Disk Usage</span>
                    <span className="text-sm text-white">
                      {((systemMetrics?.diskUsageGB || 0) / (systemMetrics?.totalDiskGB || 1) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress 
                    value={((systemMetrics?.diskUsageGB || 0) / (systemMetrics?.totalDiskGB || 1) * 100)} 
                    className="h-2" 
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Active Alerts */}
          <Card className="bg-custom-box border-custom-border">
            <CardHeader>
              <CardTitle className="font-header-md text-header flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                System Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  All systems operational. No active alerts at this time.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card className="bg-custom-box border-custom-border">
            <CardHeader>
              <CardTitle className="font-header-md text-header flex items-center gap-2">
                <Users className="w-4 h-4" />
                User Management
              </CardTitle>
              <CardDescription className="text-slate-400">
                Manage system users and their access permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 border border-custom-border rounded">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        user.status === 'active' ? 'bg-green-500' :
                        user.status === 'inactive' ? 'bg-gray-500' :
                        'bg-red-500'
                      }`} />
                      <div>
                        <p className="text-sm font-medium text-white">{user.email}</p>
                        <p className="text-xs text-slate-400">
                          {user.authProvider} • {user.slotCount} slots • {user.totalUsage.toFixed(1)}h usage
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={
                        user.status === 'active' ? 'text-green-400 border-green-400' :
                        user.status === 'inactive' ? 'text-gray-400 border-gray-400' :
                        'text-red-400 border-red-400'
                      }>
                        {user.status}
                      </Badge>
                      <Button variant="outline" size="sm">
                        Manage
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="slots" className="space-y-6">
          <Card className="bg-custom-box border-custom-border">
            <CardHeader>
              <CardTitle className="font-header-md text-header flex items-center gap-2">
                <Server className="w-4 h-4" />
                Slot Management
              </CardTitle>
              <CardDescription className="text-slate-400">
                Monitor and manage all system slots
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {slots.slice(0, 10).map((slot) => (
                  <div key={slot.id} className="flex items-center justify-between p-4 border border-custom-border rounded">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        slot.status === 'active' ? 'bg-green-500' :
                        slot.status === 'inactive' ? 'bg-gray-500' :
                        slot.status === 'error' ? 'bg-red-500' :
                        'bg-yellow-500'
                      }`} />
                      <div>
                        <p className="text-sm font-medium text-white">{slot.name}</p>
                        <p className="text-xs text-slate-400">
                          {slot.userEmail} • {slot.authProvider} • CPU: {slot.cpuUsage.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={
                        slot.status === 'active' ? 'text-green-400 border-green-400' :
                        slot.status === 'inactive' ? 'text-gray-400 border-gray-400' :
                        slot.status === 'error' ? 'text-red-400 border-red-400' :
                        'text-yellow-400 border-yellow-400'
                      }>
                        {slot.status}
                      </Badge>
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auth" className="space-y-6">
          <Card className="bg-custom-box border-custom-border">
            <CardHeader>
              <CardTitle className="font-header-md text-header flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Authentication Providers
              </CardTitle>
              <CardDescription className="text-slate-400">
                Manage Better Auth providers and configurations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {authProviders.map((provider) => (
                  <div key={provider.id} className="flex items-center justify-between p-4 border border-custom-border rounded">
                    <div className="flex items-center gap-3">
                      <Key className="w-5 h-5 text-yellow-500" />
                      <div>
                        <p className="text-sm font-medium text-white">{provider.name}</p>
                        <p className="text-xs text-slate-400">
                          {provider.type} • {provider.userCount} users • Last used: {provider.lastUsed.toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={
                        provider.configStatus === 'configured' ? 'text-green-400 border-green-400' :
                        provider.configStatus === 'pending' ? 'text-yellow-400 border-yellow-400' :
                        'text-red-400 border-red-400'
                      }>
                        {provider.configStatus}
                      </Badge>
                      <Button variant="outline" size="sm">
                        Configure
                      </Button>
                    </div>
                  </div>
                ))}
                <Button className="w-full mt-4">
                  <Plus className="w-4 h-4 mr-2" />
                  Add New Provider
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-6">
          <HealthMonitoring />
        </TabsContent>
      </Tabs>
    </div>
  );
}