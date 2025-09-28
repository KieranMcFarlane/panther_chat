'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  LayoutDashboard, 
  Settings, 
  User, 
  Activity, 
  Plus,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Database,
  Shield,
  BarChart3
} from 'lucide-react';
import SlotOverview from '@/components/dashboard/SlotOverview';
import AuthConfiguration from '@/components/dashboard/AuthConfiguration';
import UsageStatistics from '@/components/dashboard/UsageStatistics';
import UserPreferences from '@/components/dashboard/UserPreferences';
import BetterAuthManager from '@/components/dashboard/BetterAuthManager';

interface UserSession {
  id: string;
  userId: string;
  email: string;
  isActive: boolean;
  expiresAt: Date;
  authProvider: string;
}

interface Slot {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'error' | 'creating';
  authProvider: string;
  createdAt: Date;
  lastActivity: Date;
  cpuUsage: number;
  memoryUsage: number;
}

export default function DashboardPage() {
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSlots: 0,
    activeSlots: 0,
    totalUsage: 0,
    systemHealth: 'healthy'
  });

  // Simulate loading user data and slots
  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock user session data
      const mockSession: UserSession = {
        id: 'session-123',
        userId: 'user-456',
        email: 'user@example.com',
        isActive: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        authProvider: 'better-auth'
      };

      // Mock slots data
      const mockSlots: Slot[] = [
        {
          id: 'slot-1',
          name: 'Primary Slot',
          status: 'active',
          authProvider: 'claude-pro',
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          lastActivity: new Date(Date.now() - 5 * 60 * 1000),
          cpuUsage: 25,
          memoryUsage: 512
        },
        {
          id: 'slot-2',
          name: 'Development Slot',
          status: 'active',
          authProvider: 'api-key',
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          lastActivity: new Date(Date.now() - 30 * 60 * 1000),
          cpuUsage: 15,
          memoryUsage: 256
        },
        {
          id: 'slot-3',
          name: 'Demo Slot',
          status: 'inactive',
          authProvider: 'demo',
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000),
          cpuUsage: 0,
          memoryUsage: 0
        }
      ];

      // Mock statistics
      const mockStats = {
        totalSlots: mockSlots.length,
        activeSlots: mockSlots.filter(s => s.status === 'active').length,
        totalUsage: 156.7,
        systemHealth: 'healthy'
      };

      setUserSession(mockSession);
      setSlots(mockSlots);
      setStats(mockStats);
      setLoading(false);
    };

    loadDashboardData();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'inactive': return 'bg-gray-500';
      case 'error': return 'bg-red-500';
      case 'creating': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4" />;
      case 'inactive': return <XCircle className="w-4 h-4" />;
      case 'error': return <XCircle className="w-4 h-4" />;
      case 'creating': return <Clock className="w-4 h-4" />;
      default: return <XCircle className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-yellow-500" />
          <p className="text-slate-300">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-header-2xl text-header mb-2">Dashboard</h1>
          <p className="text-slate-400">
            Welcome back, {userSession?.email}. Manage your ClaudeBox slots and settings.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-green-400 border-green-400">
            <Shield className="w-3 h-3 mr-1" />
            {userSession?.authProvider}
          </Badge>
          <Badge variant="outline" className="text-blue-400 border-blue-400">
            <Activity className="w-3 h-3 mr-1" />
            {stats.systemHealth}
          </Badge>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-custom-box border-custom-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Total Slots</p>
                <p className="text-2xl font-bold">{stats.totalSlots}</p>
              </div>
              <LayoutDashboard className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-custom-box border-custom-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Active Slots</p>
                <p className="text-2xl font-bold text-green-400">{stats.activeSlots}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-custom-box border-custom-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Usage (Hours)</p>
                <p className="text-2xl font-bold">{stats.totalUsage.toFixed(1)}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-custom-box border-custom-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">System Health</p>
                <p className="text-2xl font-bold capitalize text-green-400">{stats.systemHealth}</p>
              </div>
              <Activity className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="slots" className="space-y-6">
        <TabsList className="bg-custom-box border-custom-border">
          <TabsTrigger value="slots" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black">
            <LayoutDashboard className="w-4 h-4 mr-2" />
            Slots
          </TabsTrigger>
          <TabsTrigger value="auth" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black">
            <Shield className="w-4 h-4 mr-2" />
            Authentication
          </TabsTrigger>
          <TabsTrigger value="usage" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black">
            <BarChart3 className="w-4 h-4 mr-2" />
            Usage Statistics
          </TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="slots" className="space-y-6">
          <SlotOverview slots={slots} userSession={userSession} />
        </TabsContent>

        <TabsContent value="auth" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AuthConfiguration slots={slots} />
            <BetterAuthManager userSession={userSession} />
          </div>
        </TabsContent>

        <TabsContent value="usage" className="space-y-6">
          <UsageStatistics slots={slots} />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <UserPreferences userSession={userSession} />
        </TabsContent>
      </Tabs>
    </div>
  );
}