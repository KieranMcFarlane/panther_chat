'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart3, 
  Activity, 
  Zap, 
  Database, 
  Clock,
  TrendingUp,
  TrendingDown,
  Cpu,
  HardDrive,
  Users,
  Timer
} from 'lucide-react';

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

interface UsageStatisticsProps {
  slots: Slot[];
}

interface UsageData {
  totalUsage: number;
  averageCpuUsage: number;
  averageMemoryUsage: number;
  uptimePercentage: number;
  slotsByStatus: {
    active: number;
    inactive: number;
    error: number;
  };
  usageByProvider: {
    [key: string]: number;
  };
  dailyUsage: {
    date: string;
    usage: number;
  }[];
}

export default function UsageStatistics({ slots }: UsageStatisticsProps) {
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const calculateUsageData = () => {
      // Calculate statistics from slots data
      const activeSlots = slots.filter(s => s.status === 'active');
      const totalUsage = slots.reduce((sum, slot) => {
        const hoursActive = (new Date().getTime() - slot.createdAt.getTime()) / (1000 * 60 * 60);
        return sum + hoursActive;
      }, 0);

      const averageCpuUsage = activeSlots.length > 0 
        ? activeSlots.reduce((sum, slot) => sum + slot.cpuUsage, 0) / activeSlots.length 
        : 0;

      const averageMemoryUsage = activeSlots.length > 0 
        ? activeSlots.reduce((sum, slot) => sum + slot.memoryUsage, 0) / activeSlots.length 
        : 0;

      const uptimePercentage = (activeSlots.length / slots.length) * 100 || 0;

      const slotsByStatus = {
        active: slots.filter(s => s.status === 'active').length,
        inactive: slots.filter(s => s.status === 'inactive').length,
        error: slots.filter(s => s.status === 'error').length
      };

      const usageByProvider = slots.reduce((acc, slot) => {
        const hoursActive = (new Date().getTime() - slot.createdAt.getTime()) / (1000 * 60 * 60);
        acc[slot.authProvider] = (acc[slot.authProvider] || 0) + hoursActive;
        return acc;
      }, {} as { [key: string]: number });

      // Generate mock daily usage data for the past 7 days
      const dailyUsage = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return {
          date: date.toLocaleDateString('en-US', { weekday: 'short' }),
          usage: Math.random() * 24 + Math.random() * 12
        };
      }).reverse();

      const data: UsageData = {
        totalUsage,
        averageCpuUsage,
        averageMemoryUsage,
        uptimePercentage,
        slotsByStatus,
        usageByProvider,
        dailyUsage
      };

      setUsageData(data);
      setLoading(false);
    };

    // Simulate API delay
    const timer = setTimeout(calculateUsageData, 1000);
    return () => clearTimeout(timer);
  }, [slots]);

  if (loading || !usageData) {
    return (
      <Card className="bg-custom-box border-custom-border">
        <CardHeader>
          <CardTitle className="font-header-lg text-header flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-yellow-500" />
            Usage Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <Activity className="w-8 h-8 animate-pulse text-yellow-500" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-header-xl text-header mb-2">Usage Statistics</h2>
        <p className="text-slate-400">Monitor your ClaudeBox usage patterns and system performance.</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-custom-box border-custom-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Total Usage</p>
                <p className="text-2xl font-bold">{usageData.totalUsage.toFixed(1)}h</p>
                <p className="text-xs text-slate-500">All time</p>
              </div>
              <Clock className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-custom-box border-custom-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Avg CPU Usage</p>
                <p className="text-2xl font-bold">{usageData.averageCpuUsage.toFixed(1)}%</p>
                <p className="text-xs text-slate-500">Across active slots</p>
              </div>
              <Cpu className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-custom-box border-custom-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Avg Memory</p>
                <p className="text-2xl font-bold">{usageData.averageMemoryUsage.toFixed(0)}MB</p>
                <p className="text-xs text-slate-500">Per active slot</p>
              </div>
              <HardDrive className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-custom-box border-custom-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Uptime</p>
                <p className="text-2xl font-bold">{usageData.uptimePercentage.toFixed(1)}%</p>
                <p className="text-xs text-slate-500">Slot availability</p>
              </div>
              <Activity className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Usage Chart */}
        <Card className="bg-custom-box border-custom-border">
          <CardHeader>
            <CardTitle className="font-header-md text-header flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Daily Usage (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {usageData.dailyUsage.map((day, index) => (
                <div key={index} className="flex items-center gap-3">
                  <span className="text-sm text-slate-400 w-12">{day.date}</span>
                  <div className="flex-1">
                    <Progress 
                      value={(day.usage / 36) * 100} 
                      className="h-2"
                    />
                  </div>
                  <span className="text-sm text-slate-300 w-12 text-right">
                    {day.usage.toFixed(1)}h
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Slot Status Distribution */}
        <Card className="bg-custom-box border-custom-border">
          <CardHeader>
            <CardTitle className="font-header-md text-header flex items-center gap-2">
              <Users className="w-4 h-4" />
              Slot Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(usageData.slotsByStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-300 capitalize">
                      {status === 'active' ? 'Active' : status === 'inactive' ? 'Inactive' : 'Error'}
                    </span>
                    <Badge variant="outline" className={
                      status === 'active' ? 'text-green-400 border-green-400' :
                      status === 'inactive' ? 'text-gray-400 border-gray-400' :
                      'text-red-400 border-red-400'
                    }>
                      {count}
                    </Badge>
                  </div>
                  <Progress 
                    value={(count / slots.length) * 100} 
                    className="w-24 h-2"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage by Provider */}
      <Card className="bg-custom-box border-custom-border">
        <CardHeader>
          <CardTitle className="font-header-md text-header flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Usage by Authentication Provider
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(usageData.usageByProvider).map(([provider, usage]) => (
              <div key={provider} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-300 capitalize">
                    {provider.replace('-', ' ')}
                  </span>
                  <Badge variant="outline" className="text-yellow-400 border-yellow-400">
                    {usage.toFixed(1)}h
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Progress 
                    value={(usage / usageData.totalUsage) * 100} 
                    className="w-32 h-2"
                  />
                  <span className="text-sm text-slate-400">
                    {((usage / usageData.totalUsage) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Performance Summary */}
      <Card className="bg-custom-box border-custom-border">
        <CardHeader>
          <CardTitle className="font-header-md text-header flex items-center gap-2">
            <Timer className="w-4 h-4" />
            Performance Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400 mb-1">
                {usageData.slotsByStatus.active}
              </div>
              <div className="text-sm text-slate-400">Active Slots</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400 mb-1">
                {usageData.averageCpuUsage.toFixed(1)}%
              </div>
              <div className="text-sm text-slate-400">Avg CPU Load</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400 mb-1">
                {usageData.averageMemoryUsage.toFixed(0)}MB
              </div>
              <div className="text-sm text-slate-400">Avg Memory</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}