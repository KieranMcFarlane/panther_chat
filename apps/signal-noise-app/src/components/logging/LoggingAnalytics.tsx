'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  FileText, 
  Download, 
  Search, 
  Filter, 
  RefreshCw,
  BarChart3,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  Server,
  Database,
  Calendar,
  TrendingUp,
  TrendingDown,
  Eye,
  Trash2,
  Settings
} from 'lucide-react';
import { logger, defaultLogConfig } from '@/services/logger';
import { LogEntry, LogLevel, LogAnalytics, LogFilter, LogExportOptions } from '@/types/logging';

export default function LoggingAnalytics() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [analytics, setAnalytics] = useState<LogAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filter, setFilter] = useState<LogFilter>({});
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (autoRefresh) {
      loadData();
    }

    const interval = setInterval(() => {
      if (autoRefresh) {
        loadData();
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, filter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [logData, analyticsData] = await Promise.all([
        logger.getLogs(filter, 100),
        logger.getAnalytics({
          start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          end: new Date()
        })
      ]);
      
      setLogs(logData);
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Failed to load logging data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'json' | 'csv' | 'txt') => {
    try {
      const exportOptions: LogExportOptions = {
        format,
        filter,
        limit: 1000
      };
      
      const exportedData = await logger.exportLogs(exportOptions);
      
      // Create download
      const blob = new Blob([exportedData], { 
        type: format === 'json' ? 'application/json' : 'text/plain' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `claudebox-logs-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export logs:', error);
    }
  };

  const getLevelColor = (level: LogLevel) => {
    switch (level) {
      case 'debug': return 'text-gray-400 bg-gray-900 border-gray-600';
      case 'info': return 'text-blue-400 bg-blue-900 border-blue-600';
      case 'warn': return 'text-yellow-400 bg-yellow-900 border-yellow-600';
      case 'error': return 'text-red-400 bg-red-900 border-red-600';
      case 'critical': return 'text-red-500 bg-red-950 border-red-700';
    }
  };

  const getLevelIcon = (level: LogLevel) => {
    switch (level) {
      case 'debug': return <Eye className="w-4 h-4" />;
      case 'info': return <CheckCircle className="w-4 h-4" />;
      case 'warn': return <AlertTriangle className="w-4 h-4" />;
      case 'error': return <AlertTriangle className="w-4 h-4" />;
      case 'critical': return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return new Date(timestamp).toLocaleString();
  };

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      log.message.toLowerCase().includes(searchLower) ||
      log.service.toLowerCase().includes(searchLower) ||
      log.slotId?.toLowerCase().includes(searchLower) ||
      log.userId?.toLowerCase().includes(searchLower) ||
      log.tags?.some(tag => tag.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-yellow-500" />
          <h1 className="text-2xl font-bold text-white">Logging & Analytics</h1>
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
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Analytics Overview */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-custom-box border-custom-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">Total Logs</p>
                  <p className="text-2xl font-bold">{analytics.totalLogs.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">Last 24 hours</p>
                </div>
                <Database className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-custom-box border-custom-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">Error Rate</p>
                  <p className="text-2xl font-bold">{(analytics.errorRate * 100).toFixed(1)}%</p>
                  <p className="text-xs text-slate-500">
                    {analytics.logsByLevel.error + analytics.logsByLevel.critical} errors
                  </p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-custom-box border-custom-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">Active Users</p>
                  <p className="text-2xl font-bold">{analytics.uniqueUsers}</p>
                  <p className="text-xs text-slate-500">Today</p>
                </div>
                <Users className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-custom-box border-custom-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">Avg Response</p>
                  <p className="text-2xl font-bold">{analytics.averageResponseTime}ms</p>
                  <p className="text-xs text-slate-500">Performance</p>
                </div>
                <Activity className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="logs" className="space-y-6">
        <TabsList className="bg-custom-box border-custom-border">
          <TabsTrigger value="logs">Log Viewer</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="exports">Exports</TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="space-y-6">
          {/* Search and Filter */}
          <Card className="bg-custom-box border-custom-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 flex-1">
                  <Search className="w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search logs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-slate-800 border-slate-600"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Select value={filter.level || ''} onValueChange={(value) => 
                    setFilter(prev => ({ ...prev, level: value as LogLevel || undefined }))
                  }>
                    <SelectTrigger className="w-32 bg-slate-800 border-slate-600">
                      <SelectValue placeholder="Level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Levels</SelectItem>
                      <SelectItem value="debug">Debug</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="warn">Warning</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <Filter className="w-4 h-4 mr-2" />
                    More Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Log Entries */}
          <Card className="bg-custom-box border-custom-border">
            <CardHeader>
              <CardTitle className="font-header-md text-header flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Log Entries
              </CardTitle>
              <CardDescription className="text-slate-400">
                Showing {filteredLogs.length} log entries
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="w-6 h-6 animate-spin text-yellow-500" />
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 border border-slate-700 rounded-lg hover:bg-slate-800/50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          {getLevelIcon(log.level)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className={getLevelColor(log.level)}>
                                {log.level.toUpperCase()}
                              </Badge>
                              <span className="text-xs text-slate-400">{log.service}</span>
                              <span className="text-xs text-slate-500">
                                {formatTimestamp(log.timestamp)}
                              </span>
                            </div>
                            <p className="text-sm text-white break-words">{log.message}</p>
                            {log.metadata && (
                              <details className="mt-2">
                                <summary className="text-xs text-slate-400 cursor-pointer hover:text-white">
                                  Metadata
                                </summary>
                                <pre className="text-xs bg-slate-900 p-2 rounded mt-1 overflow-x-auto">
                                  {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {analytics && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Logs by Level */}
              <Card className="bg-custom-box border-custom-border">
                <CardHeader>
                  <CardTitle className="font-header-md text-header flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Logs by Level
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(analytics.logsByLevel).map(([level, count]) => (
                    <div key={level} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getLevelIcon(level as LogLevel)}
                        <span className="text-sm text-white capitalize">{level}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-400">{count}</span>
                        <div className="w-20 bg-slate-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${getLevelColor(level as LogLevel).split(' ')[0]}`}
                            style={{ 
                              width: `${(count / analytics.totalLogs) * 100}%` 
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Top Error Messages */}
              <Card className="bg-custom-box border-custom-border">
                <CardHeader>
                  <CardTitle className="font-header-md text-header flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Top Error Messages
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analytics.topErrorMessages.map((error, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm text-white truncate flex-1">{error.message instanceof Error ? error.message.message : String(error.message)}</span>
                      <Badge variant="destructive" className="ml-2">
                        {error.count}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Logs by Service */}
              <Card className="bg-custom-box border-custom-border">
                <CardHeader>
                  <CardTitle className="font-header-md text-header flex items-center gap-2">
                    <Server className="w-4 h-4" />
                    Logs by Service
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(analytics.logsByService).map(([service, count]) => (
                    <div key={service} className="flex items-center justify-between">
                      <span className="text-sm text-white capitalize">{service}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-400">{count}</span>
                        <div className="w-20 bg-slate-700 rounded-full h-2">
                          <div
                            className="h-2 rounded-full bg-blue-500"
                            style={{ 
                              width: `${(count / analytics.totalLogs) * 100}%` 
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* System Metrics */}
              <Card className="bg-custom-box border-custom-border">
                <CardHeader>
                  <CardTitle className="font-header-md text-header flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    System Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">Unique Users</span>
                    <span className="text-sm text-white">{analytics.uniqueUsers}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">Active Slots</span>
                    <span className="text-sm text-white">{analytics.uniqueSlots}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">Avg Response Time</span>
                    <span className="text-sm text-white">{analytics.averageResponseTime}ms</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">Error Rate</span>
                    <span className="text-sm text-white">{(analytics.errorRate * 100).toFixed(1)}%</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="exports" className="space-y-6">
          <Card className="bg-custom-box border-custom-border">
            <CardHeader>
              <CardTitle className="font-header-md text-header flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export Logs
              </CardTitle>
              <CardDescription className="text-slate-400">
                Export log data in various formats for analysis and archiving
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button
                  variant="outline"
                  className="h-20 flex-col gap-2"
                  onClick={() => handleExport('json')}
                >
                  <FileText className="w-6 h-6" />
                  <span>Export as JSON</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-20 flex-col gap-2"
                  onClick={() => handleExport('csv')}
                >
                  <Database className="w-6 h-6" />
                  <span>Export as CSV</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-20 flex-col gap-2"
                  onClick={() => handleExport('txt')}
                >
                  <FileText className="w-6 h-6" />
                  <span>Export as Text</span>
                </Button>
              </div>
              
              <div className="mt-6 p-4 bg-slate-800 rounded-lg">
                <h4 className="text-sm font-medium text-white mb-2">Export Information</h4>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li>• JSON: Machine-readable format with full metadata</li>
                  <li>• CSV: Spreadsheet-compatible format for analysis</li>
                  <li>• Text: Human-readable format for archiving</li>
                  <li>• Exports include current filters and up to 1000 entries</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}