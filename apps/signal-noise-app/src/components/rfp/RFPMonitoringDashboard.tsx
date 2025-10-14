/**
 * 🐆 RFP Intelligence Monitoring Dashboard
 * 
 * Real-time monitoring dashboard for Yellow Panther RFP detection system.
 * Shows system activity, detection logs, performance metrics, and analytics.
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface SystemStatus {
  is_active: boolean;
  last_activity: string;
  active_webhooks: number;
  pending_processing: boolean;
  health_score: number;
  recent_errors: Array<{
    timestamp: string;
    message: string;
  }>;
}

interface ActivityStats {
  total_activities: number;
  rfp_detections: number;
  high_value_opportunities: number;
  average_confidence: number;
  average_processing_time: number;
  success_rate: number;
  last_activity: string;
  top_entities: Array<{
    name: string;
    score: number;
    detections: number;
  }>;
  hourly_activity: Array<{
    hour: string;
    count: number;
  }>;
}

interface ActivityLog {
  id: string;
  timestamp: string;
  activity_type: string;
  source: string;
  entity_name?: string;
  content?: string;
  confidence?: number;
  opportunities_detected?: number;
  entity_score?: number;
  processing_time_ms?: number;
  status: 'success' | 'error' | 'warning';
  details: Record<string, any>;
  metadata?: {
    yellow_panther_fit?: string;
    keywords_found?: string[];
    entity_tier?: string;
  };
}

export default function RFPMonitoringDashboard() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [activityStats, setActivityStats] = useState<ActivityStats | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Fetch monitoring data
  const fetchMonitoringData = async () => {
    try {
      setError(null);
      
      // Fetch system status and stats
      const statusResponse = await fetch('/api/rfp-monitoring?action=status');
      if (!statusResponse.ok) throw new Error('Failed to fetch status');
      
      const statusData = await statusResponse.json();
      setSystemStatus(statusData.data.system_status);
      setActivityStats(statusData.data.activity_stats);
      
      // Fetch recent logs
      const logsResponse = await fetch(`/api/rfp-monitoring?action=logs&limit=50${selectedType !== 'all' ? `&type=${selectedType}` : ''}`);
      if (!logsResponse.ok) throw new Error('Failed to fetch logs');
      
      const logsData = await logsResponse.json();
      setLogs(logsData.data.logs);
      setLastRefresh(new Date());
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Run test detection
  const runTestDetection = async () => {
    try {
      console.log('🧪 Running RFP detection test...');
      const response = await fetch('/api/rfp-monitoring?action=test');
      const result = await response.json();
      
      console.log('Test result:', result);
      
      if (result.success) {
        console.log('✅ Test successful! Refreshing data...');
        // Show success feedback
        alert(`✅ Test Successful!\n\nEntity Score: ${result.data.test_result.entity_score}/100\nOpportunities: ${result.data.test_result.opportunities_detected}\nConfidence: ${(result.data.test_result.confidence * 100).toFixed(1)}%\n\nDashboard will refresh in 2 seconds.`);
        
        // Refresh data after test
        setTimeout(fetchMonitoringData, 2000);
      } else {
        console.error('Test failed:', result);
        alert('❌ Test failed. Check console for details.');
      }
    } catch (err) {
      console.error('Test failed:', err);
      alert('❌ Test failed. Could not connect to the server.');
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(fetchMonitoringData, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, [autoRefresh, selectedType]);

  
  // Initial fetch
  useEffect(() => {
    fetchMonitoringData();
  }, []);

  // Filter logs based on search
  const filteredLogs = logs.filter(log => {
    // Safety check - ensure log exists
    if (!log) return false;
    
    return searchTerm === '' || 
      log.entity_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.source?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Get status color
  const getStatusColor = (health: number) => {
    if (health >= 90) return 'text-green-600';
    if (health >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const colors = {
      success: 'bg-green-100 text-green-800',
      error: 'bg-red-100 text-red-800',
      warning: 'bg-yellow-100 text-yellow-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading RFP Intelligence Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">🐆 RFP Intelligence Dashboard</h1>
          <p className="text-gray-600 mt-1">Real-time monitoring for Yellow Panther opportunity detection</p>
        </div>
        <div className="flex items-center space-x-4">
          <Button onClick={runTestDetection} variant="outline">
            🧪 Run Test
          </Button>
          <Button 
            onClick={() => setAutoRefresh(!autoRefresh)}
            variant={autoRefresh ? "default" : "outline"}
          >
            {autoRefresh ? '🔄 Auto-refresh ON' : '⏸️ Auto-refresh OFF'}
          </Button>
          <div className="text-sm text-gray-500">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">❌ Error: {error}</p>
        </div>
      )}

      {/* System Status Cards */}
      {systemStatus && activityStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">System Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getStatusColor(systemStatus.health_score)}`}>
                {systemStatus.health_score}%
              </div>
              <p className="text-xs text-gray-500">
                {systemStatus.is_active ? '🟢 Active' : '🔴 Inactive'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">RFP Detections</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {activityStats.rfp_detections}
              </div>
              <p className="text-xs text-gray-500">
                {activityStats.high_value_opportunities} high-value opportunities
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Avg Confidence</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {(activityStats.average_confidence * 100).toFixed(1)}%
              </div>
              <p className="text-xs text-gray-500">
                {activityStats.success_rate.toFixed(1)}% success rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Processing Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {activityStats.average_processing_time.toFixed(0)}ms
              </div>
              <p className="text-xs text-gray-500">
                {systemStatus.active_webhooks} active webhooks
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="activity" className="space-y-4">
        <TabsList>
          <TabsTrigger value="activity">Activity Feed</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="entities">Top Entities</TabsTrigger>
        </TabsList>

        {/* Activity Feed Tab */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Activity</CardTitle>
                <div className="flex items-center space-x-2">
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Activity</SelectItem>
                      <SelectItem value="webhook_received">Webhooks</SelectItem>
                      <SelectItem value="rfp_detected">RFP Detections</SelectItem>
                      <SelectItem value="test_run">Tests</SelectItem>
                      <SelectItem value="system_health">System</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Search logs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredLogs.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No activity found</p>
                ) : (
                  filteredLogs.map((log) => {
                    // Safety check - ensure log exists and has basic structure
                    if (!log || !log.id) {
                      console.warn('Invalid log entry found:', log);
                      return null;
                    }
                    
                    // Additional safety check for log properties
                    let safeLog;
                    try {
                      safeLog = {
                        id: log.id,
                        timestamp: log.timestamp || new Date().toISOString(),
                        activity_type: log.activity_type || 'unknown',
                        source: log.source || 'unknown',
                        status: log.status || 'warning',
                        entity_name: log.entity_name || undefined,
                        content: log.content || undefined,
                        confidence: log.confidence || 0,
                        opportunities_detected: log.opportunities_detected || 0,
                        entity_score: log.entity_score || 0,
                        processing_time_ms: log.processing_time_ms || 0,
                        details: log.details || {},
                        metadata: log.metadata || {}
                      };
                    } catch (error) {
                      console.warn('Error creating safeLog:', error);
                      // Fallback safeLog with minimal properties
                      safeLog = {
                        id: log.id || 'unknown',
                        timestamp: new Date().toISOString(),
                        activity_type: 'unknown',
                        source: 'unknown',
                        status: 'warning',
                        entity_name: undefined,
                        content: undefined,
                        confidence: 0,
                        opportunities_detected: 0,
                        entity_score: 0,
                        processing_time_ms: 0,
                        details: {},
                        metadata: {}
                      };
                    }
                    
                    return (
                    <div key={log.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <Badge className={getStatusBadge(safeLog.status)}>
                              {safeLog.status}
                            </Badge>
                            <span className="text-sm font-medium">
                              {safeLog.activity_type.replace(/_/g, ' ').toUpperCase()}
                            </span>
                            <span className="text-sm text-gray-500">
                              {new Date(safeLog.timestamp).toLocaleString()}
                            </span>
                          </div>
                          
                          {safeLog.entity_name && (
                            <p className="font-medium text-blue-600 mb-1">
                              🏢 {safeLog.entity_name}
                            </p>
                          )}
                          
                          {safeLog.content && (
                            <p className="text-sm text-gray-700 mb-2 line-clamp-2">
                              {safeLog.content}
                            </p>
                          )}
                          
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            {safeLog.confidence > 0 && (
                              <span>Confidence: {(safeLog.confidence * 100).toFixed(1)}%</span>
                            )}
                            {safeLog.opportunities_detected > 0 && (
                              <span className="text-green-600 font-medium">
                                🎯 {safeLog.opportunities_detected} opportunities
                              </span>
                            )}
                            {safeLog.entity_score >= 80 && (
                              <span className="text-purple-600 font-medium">
                                🐆 {safeLog.entity_score}/100
                              </span>
                            )}
                            {safeLog.processing_time_ms > 0 && (
                              <span>{safeLog.processing_time_ms}ms</span>
                            )}
                            {safeLog.metadata && safeLog.metadata.yellow_panther_fit && (
                              <Badge variant="outline" className="text-xs">
                                {safeLog.metadata.yellow_panther_fit}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    );
                  })
                  .filter(Boolean) // Remove any null entries from safety checks
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          {activityStats && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Hourly Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {activityStats.hourly_activity.map((hour, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <span className="text-sm w-12">{hour.hour}</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-4 relative">
                          <div 
                            className="bg-blue-600 h-4 rounded-full"
                            style={{ width: `${Math.min(100, (hour.count / Math.max(...activityStats.hourly_activity.map(h => h.count))) * 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-sm w-8 text-right">{hour.count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Performance Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Success Rate</span>
                        <span>{activityStats.success_rate.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full"
                          style={{ width: `${activityStats.success_rate}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Avg Confidence</span>
                        <span>{(activityStats.average_confidence * 100).toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${activityStats.average_confidence * 100}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div className="pt-2 border-t">
                      <p className="text-sm text-gray-600">
                        Total Activities: <span className="font-medium">{activityStats.total_activities}</span>
                      </p>
                      <p className="text-sm text-gray-600">
                        High-Value Opportunities: <span className="font-medium text-green-600">{activityStats.high_value_opportunities}</span>
                      </p>
                      <p className="text-sm text-gray-600">
                        Avg Processing Time: <span className="font-medium">{activityStats.average_processing_time.toFixed(0)}ms</span>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Top Entities Tab */}
        <TabsContent value="entities" className="space-y-4">
          {activityStats && (
            <Card>
              <CardHeader>
                <CardTitle>Top Monitored Entities</CardTitle>
                <p className="text-sm text-gray-600">
                  Entities with highest Yellow Panther scores and detection rates
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activityStats.top_entities.map((entity, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="text-lg font-bold text-gray-400">#{index + 1}</div>
                        <div>
                          <p className="font-medium">{entity.name}</p>
                          <p className="text-sm text-gray-500">{entity.detections} detections</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${entity.score >= 90 ? 'text-green-600' : entity.score >= 80 ? 'text-blue-600' : 'text-gray-600'}`}>
                          {entity.score}/100
                        </div>
                        <div className="text-sm text-gray-500">
                          {entity.score >= 90 ? 'Tier 1' : entity.score >= 80 ? 'Tier 2' : 'Tier 3'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}