"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  Clock, 
  Zap, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw,
  Play,
  Pause,
  Settings,
  PlayCircle
} from 'lucide-react';

interface ClaudeAgentStatus {
  claudeAgent: {
    isRunning: boolean;
    lastRun?: string;
  };
  cronScheduler: {
    enabled: boolean;
    jobs: Array<{
      name: string;
      running: boolean;
      lastRun?: string;
    }>;
  };
  environment: {
    cronEnabled: boolean;
    brightdataConfigured: boolean;
    neo4jConfigured: boolean;
    teamsConfigured: boolean;
  };
}

interface ActivityLog {
  id: string;
  type: string;
  title: string;
  timestamp: string;
  metadata: {
    category: string;
    source: string;
    data: any;
    tags: string[];
    task_id?: string;
  };
}

interface ActivityFeed {
  id: string;
  timestamp: string;
  type: 'detection' | 'analysis' | 'notification' | 'system_event' | 'error';
  title: string;
  description: string;
  entity_id?: string;
  entity_name?: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
  actions?: Array<{
    label: string;
    action: string;
    url?: string;
  }>;
}

interface LogStats {
  total: number;
  by_level: Record<string, number>;
  by_category: Record<string, number>;
  error_rate: number;
  top_sources: Array<{ source: string; count: number }>;
}

export function ClaudeAgentDashboard() {
  const [status, setStatus] = useState<ClaudeAgentStatus | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [activities, setActivities] = useState<ActivityFeed[]>([]);
  const [logStats, setLogStats] = useState<LogStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [schedulerStatus, setSchedulerStatus] = useState<any>(null);

  // Fetch status and logs
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Get status
      const statusResponse = await fetch('/api/claude-agent?action=status');
      const statusData = await statusResponse.json();
      
      if (statusData.success) {
        setStatus(statusData.data);
      }
      
      // Get logs and activities
      const logsResponse = await fetch('/api/claude-agent?action=logs');
      const logsData = await logsResponse.json();
      
      if (logsData.success) {
        setLogs(logsData.data.logs || []);
        setActivities(logsData.data.activities || []);
        setLogStats(logsData.data.stats);
      }

      // Get scheduler status
      try {
        const schedulerResponse = await fetch('/api/claude-agent/schedule/start', { method: 'GET' });
        const schedulerData = await schedulerResponse.json();
        setSchedulerStatus(schedulerData);
      } catch (error) {
        // Scheduler endpoint might not exist or be accessible
        setSchedulerStatus(null);
      }
    } catch (error) {
      console.error('Failed to fetch Claude Agent data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Manual trigger job
  const triggerJob = async (jobName: string) => {
    try {
      const response = await fetch(`/api/claude-agent?action=trigger&job=${jobName}`);
      const data = await response.json();
      
      if (data.success) {
        // Refresh data after a delay
        setTimeout(fetchData, 2000);
      }
    } catch (error) {
      console.error('Failed to trigger job:', error);
    }
  };

  // Run manual scraping
  const runScraping = async () => {
    try {
      const response = await fetch('/api/claude-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run-scraping' })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Refresh data after a delay
        setTimeout(fetchData, 3000);
      }
    } catch (error) {
      console.error('Failed to run scraping:', error);
    }
  };

  // Run demo scan
  const runDemoScan = async () => {
    try {
      const response = await fetch('/api/demo-claude-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Start refreshing to show real-time updates
        const refreshInterval = setInterval(() => {
          fetchData();
        }, 2000);
        
        // Stop refreshing after 15 seconds
        setTimeout(() => {
          clearInterval(refreshInterval);
        }, 15000);
      }
    } catch (error) {
      console.error('Failed to run demo scan:', error);
    }
  };

  // Start daily scheduler
  const startScheduler = async () => {
    try {
      const response = await fetch('/api/claude-agent/schedule/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleTime: '0 9 * * *', configure: true })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Refresh data after starting scheduler
        setTimeout(fetchData, 1000);
      }
    } catch (error) {
      console.error('Failed to start scheduler:', error);
    }
  };

  // Stop daily scheduler
  const stopScheduler = async () => {
    try {
      const response = await fetch('/api/claude-agent/schedule/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Refresh data after stopping scheduler
        setTimeout(fetchData, 1000);
      }
    } catch (error) {
      console.error('Failed to stop scheduler:', error);
    }
  };

  // Run manual scan via scheduler
  const runManualScan = async () => {
    try {
      const response = await fetch('/api/claude-agent/manual-trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Start refreshing to show real-time updates
        const refreshInterval = setInterval(() => {
          fetchData();
        }, 2000);
        
        // Stop refreshing after 15 seconds
        setTimeout(() => {
          clearInterval(refreshInterval);
        }, 15000);
      }
    } catch (error) {
      console.error('Failed to run manual scan:', error);
    }
  };

  // Auto-refresh every 30 seconds
  useEffect(() => {
    fetchData();
    
    if (autoRefresh) {
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const getStatusIcon = (isRunning: boolean) => {
    return isRunning ? (
      <Zap className="h-4 w-4 text-green-500 animate-pulse" />
    ) : (
      <Clock className="h-4 w-4 text-gray-400" />
    );
  };

  const getStatusBadge = (isRunning: boolean) => {
    return isRunning ? (
      <Badge variant="default" className="bg-green-500 hover:bg-green-600">
        Active
      </Badge>
    ) : (
      <Badge variant="secondary">
        Idle
      </Badge>
    );
  };

  const getEnvironmentStatus = () => {
    if (!status) return null;
    
    const env = status.environment;
    const issues = [];
    
    if (!env.brightdataConfigured) issues.push('BrightData');
    if (!env.neo4jConfigured) issues.push('Neo4j');
    if (!env.teamsConfigured) issues.push('Teams');
    
    if (issues.length === 0) {
      return (
        <Badge variant="default" className="bg-green-500">
          All Services Configured
        </Badge>
      );
    }
    
    return (
      <Badge variant="destructive">
        Missing: {issues.join(', ')}
      </Badge>
    );
  };

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleString();
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-400" />;
      case 'warn':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <Activity className="h-4 w-4 text-blue-500" />;
      case 'debug':
        return <Activity className="h-4 w-4 text-gray-400" />;
      default:
        return <Activity className="h-4 w-4 text-gray-400" />;
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  if (!status) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        Loading Claude Agent status...
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Claude Agent RFP Intelligence</h1>
          <p className="text-muted-foreground">
            Automated RFP detection and analysis with BrightData MCP integration
          </p>
        </div>
        <div className="flex items-center gap-4">
          {getEnvironmentStatus()}
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            Auto Refresh {autoRefresh ? 'ON' : 'OFF'}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Claude Agent Status</CardTitle>
            {getStatusIcon(status.claudeAgent.isRunning)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {getStatusBadge(status.claudeAgent.isRunning)}
            </div>
            <p className="text-xs text-muted-foreground">
              Last run: {formatTimestamp(status.claudeAgent.lastRun)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cron Scheduler</CardTitle>
            {status.cronScheduler.enabled ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <Pause className="h-4 w-4 text-gray-400" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Badge variant={status.cronScheduler.enabled ? "default" : "secondary"}>
                {status.cronScheduler.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {status.cronScheduler.jobs.length} jobs configured
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Environment</CardTitle>
            {getEnvironmentStatus()}
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${status.environment.brightdataConfigured ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-xs">BrightData</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${status.environment.neo4jConfigured ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-xs">Neo4j</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${status.environment.teamsConfigured ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-xs">Teams</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scheduled Jobs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Scheduled Jobs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {status.cronScheduler.jobs.map((job) => (
              <div key={job.name} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(job.running)}
                  <div>
                    <h3 className="font-medium">{job.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Last run: {formatTimestamp(job.lastRun)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(job.running)}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => triggerJob(job.name)}
                    disabled={job.running}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Trigger
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button onClick={runScraping} disabled={status.claudeAgent.isRunning}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Run RFP Scraping Now
            </Button>
            <Button onClick={runManualScan} disabled={status.claudeAgent.isRunning} variant="outline">
              <PlayCircle className="h-4 w-4 mr-2" />
              Manual Scan (Scheduler)
            </Button>
            <Button onClick={runDemoScan} disabled={status.claudeAgent.isRunning} variant="outline">
              <PlayCircle className="h-4 w-4 mr-2" />
              Demo Scan (Real-time)
            </Button>
            <Button onClick={startScheduler} disabled={schedulerStatus?.data?.status?.isScheduled} variant="outline">
              <Play className="h-4 w-4 mr-2" />
              Start Daily 9AM Scan
            </Button>
            <Button onClick={stopScheduler} disabled={!schedulerStatus?.data?.status?.isScheduled} variant="outline">
              <Pause className="h-4 w-4 mr-2" />
              Stop Daily Scan
            </Button>
          </div>
          
          {schedulerStatus && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Scheduler Status:</span>
                <Badge variant={schedulerStatus?.data?.status?.isScheduled ? "default" : "secondary"}>
                  {schedulerStatus?.data?.status?.isScheduled ? "Running" : "Stopped"}
                </Badge>
              </div>
              {schedulerStatus?.data?.status?.nextRun && (
                <div className="text-xs text-muted-foreground mt-1">
                  Next run: {new Date(schedulerStatus.data.status.nextRun).toLocaleString()}
                </div>
              )}
              {schedulerStatus?.data?.status?.schedule && (
                <div className="text-xs text-muted-foreground">
                  Schedule: {schedulerStatus.data.status.schedule}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Log Statistics */}
      {logStats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Log Statistics (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{logStats.total}</div>
                <div className="text-xs text-muted-foreground">Total Logs</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-500">
                  {logStats.by_level.error || 0}
                </div>
                <div className="text-xs text-muted-foreground">Errors</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-500">
                  {logStats.by_level.warn || 0}
                </div>
                <div className="text-xs text-muted-foreground">Warnings</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">
                  {logStats.error_rate.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">Success Rate</div>
              </div>
            </div>
            
            {logStats.top_sources.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">Top Sources</h4>
                <div className="space-y-1">
                  {logStats.top_sources.slice(0, 5).map((source, index) => (
                    <div key={index} className="flex justify-between text-xs">
                      <span>{source.source}</span>
                      <span className="text-muted-foreground">{source.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Activity Feed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {activities.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No recent activity
              </p>
            ) : (
              activities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 p-3 border rounded-lg">
                  <div className="flex-shrink-0 mt-1">
                    {activity.type === 'system_event' && activity.urgency === 'critical' ? (
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    ) : activity.type === 'analysis' ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : activity.type === 'detection' ? (
                      <Zap className="h-4 w-4 text-yellow-500" />
                    ) : activity.type === 'notification' ? (
                      <Activity className="h-4 w-4 text-blue-500" />
                    ) : (
                      <Activity className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{activity.title}</h4>
                      <div className="flex items-center gap-2">
                        <Badge variant={getUrgencyColor(activity.urgency)} className="text-xs">
                          {activity.urgency}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(activity.timestamp)}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {activity.description}
                    </p>
                    
                    {activity.entity_name && (
                      <div className="mt-2">
                        <Badge variant="outline" className="text-xs">
                          {activity.entity_name}
                        </Badge>
                      </div>
                    )}

                    {activity.actions && activity.actions.length > 0 && (
                      <div className="mt-2 flex gap-2">
                        {activity.actions.map((action, index) => (
                          <Button
                            key={index}
                            variant="outline"
                            size="sm"
                            className="text-xs h-6"
                            onClick={() => {
                              if (action.url) {
                                window.open(action.url, '_blank');
                              }
                            }}
                          >
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Logs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No recent logs
              </p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-2 border rounded text-sm">
                  <div className="flex-shrink-0 mt-1">
                    {getLevelIcon(log.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-xs">{log.title}</h4>
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(log.timestamp)}
                      </span>
                    </div>
                    
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {log.type}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {log.metadata.category}
                      </Badge>
                      {log.metadata.task_id && (
                        <Badge variant="outline" className="text-xs">
                          Task: {log.metadata.task_id.slice(-8)}
                        </Badge>
                      )}
                    </div>

                    {log.metadata.tags && log.metadata.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {log.metadata.tags.map((tag, index) => (
                          <span key={index} className="text-xs bg-gray-100 px-1 py-0.5 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}