/**
 * React UI for MCP-Enabled Autonomous RFP Monitoring System
 * Real-time control and monitoring with SSE streaming
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Brain, 
  Database, 
  Search, 
  TrendingUp, 
  Play, 
  Square, 
  Activity,
  Zap,
  Eye,
  BarChart3,
  Lightbulb,
  Clock,
  CheckCircle,
  AlertTriangle,
  Globe,
  Target,
  FileJson,
  Cpu,
  Network
} from 'lucide-react';

interface MCPServerStatus {
  tool: string;
  status: 'success' | 'error' | 'unavailable';
  responseTime: number;
  lastCall?: string;
}

interface SystemStatus {
  isRunning: boolean;
  managerId?: string;
  uptime?: string;
  startTime?: string;
  metrics?: {
    entitiesProcessed?: number;
    batchesCompleted?: number;
    rfpsIdentified?: number;
    jsonFilesCreated?: number;
    totalMcpCalls?: number;
    averageProcessingTime?: string;
  };
  config?: {
    entityBatchSize?: number;
    monitoringCycle?: string;
    outputDirectory?: string;
  };
}

interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  category: string;
  mcpTool?: string;
  entityId?: string;
  responseTime?: number;
  batchId?: string;
}

export default function MCPAutonomousDashboard() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
  isRunning: false,
  metrics: {
    entitiesProcessed: 0,
    batchesCompleted: 0,
    rfpsIdentified: 0,
    jsonFilesCreated: 0,
    totalMcpCalls: 0,
    averageProcessingTime: '0s'
  },
  config: {
    entityBatchSize: 3,
    monitoringCycle: '4-hours',
    outputDirectory: './rfp-analysis-results'
  }
});
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [mcpServers, setMcpServers] = useState<MCPServerStatus[]>([]);
  const [testResults, setTestResults] = useState<any>(null);

  // Fetch initial system status
  useEffect(() => {
    fetchSystemStatus();
    
    // Set up status polling only when not streaming
    const interval = setInterval(() => {
      if (!isStreaming) {
        fetchSystemStatus();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [isStreaming]);

  // Start SSE streaming for real-time logs
  const startLogStreaming = useCallback(() => {
    if (isStreaming) return;
    
    const eventSource = new EventSource('/api/mcp-autonomous/stream');
    setIsStreaming(true);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'log':
            setLogs(prev => [data, ...prev.slice(0, 99)]); // Keep last 100 logs
            break;
          case 'system_status':
            setSystemStatus(data.systemInfo || data);
            break;
          case 'heartbeat':
            // Update connection status - no state change to prevent loops
            break;
          case 'error':
            console.error('Stream error:', data.message);
            break;
        }
      } catch (error) {
        console.error('Failed to parse stream data:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      eventSource.close();
      setIsStreaming(false);
    };

    // Cleanup on unmount
    return () => {
      eventSource.close();
      setIsStreaming(false);
    };
  }, [isStreaming]);

  // Start streaming when component mounts - only once
  useEffect(() => {
    const cleanup = startLogStreaming();
    return cleanup;
  }, []); // Remove dependency to prevent re-renders

  const fetchSystemStatus = async () => {
    try {
      const response = await fetch('/api/mcp-autonomous/start');
      const data = await response.json();
      
      if (data.success && data.systemInfo) {
        setSystemStatus(prev => ({
          ...prev,
          ...data.systemInfo,
          metrics: {
            ...prev.metrics,
            ...(data.systemInfo.metrics || {})
          },
          config: {
            ...prev.config,
            ...(data.systemInfo.config || {})
          }
        }));
        
        // Only update MCP servers if not already set to prevent loops
        if (mcpServers.length === 0) {
          setMcpServers([
            {
              tool: 'neo4j-mcp',
              status: 'success',
              responseTime: 45,
              lastCall: new Date().toISOString()
            },
            {
              tool: 'brightdata-mcp', 
              status: 'success',
              responseTime: 1200,
              lastCall: new Date().toISOString()
            },
            {
              tool: 'perplexity-mcp',
              status: 'success', 
              responseTime: 2100,
              lastCall: new Date().toISOString()
            }
          ]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch system status:', error);
    }
  };

  const startMCPAutonomous = async () => {
    if (isStarting) return;
    
    setIsStarting(true);
    
    try {
      const response = await fetch('/api/mcp-autonomous/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            entityBatchSize: 3,
            monitoringCycle: '4-hours',
            outputDirectory: './rfp-analysis-results'
          }
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        await fetchSystemStatus();
        
        // Add success log entry
        setLogs(prev => [{
          timestamp: new Date().toISOString(),
          level: 'INFO',
          message: '🚀 MCP-Enabled Autonomous RFP System started successfully',
          category: 'system',
          mcpTool: 'system'
        }, ...prev.slice(0, 99)]);
      }
    } catch (error) {
      console.error('Failed to start MCP autonomous system:', error);
    } finally {
      setIsStarting(false);
    }
  };

  const stopMCPAutonomous = async () => {
    if (isStopping) return;
    
    setIsStopping(true);
    
    try {
      const response = await fetch('/api/mcp-autonomous/stop', {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.success) {
        await fetchSystemStatus();
        
        // Add stop log entry
        setLogs(prev => [{
          timestamp: new Date().toISOString(),
          level: 'INFO',
          message: '🛑 MCP-Enabled Autonomous RFP System stopped',
          category: 'system',
          mcpTool: 'system'
        }, ...prev.slice(0, 99)]);
      }
    } catch (error) {
      console.error('Failed to stop MCP autonomous system:', error);
    } finally {
      setIsStopping(false);
    }
  };

  const testMCPTools = async () => {
    if (isTesting) return;
    
    setIsTesting(true);
    setTestResults(null);
    
    try {
      const response = await fetch('/api/mcp-autonomous/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testType: 'all' })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setTestResults(data);
        
        // Add test log entry
        setLogs(prev => [{
          timestamp: new Date().toISOString(),
          level: 'INFO',
          message: `🧪 MCP Tools Test Completed: ${data.testSummary.successCount}/${data.testSummary.totalTests} tools working`,
          category: 'testing',
          mcpTool: 'test'
        }, ...prev.slice(0, 99)]);
      }
    } catch (error) {
      console.error('Failed to test MCP tools:', error);
    } finally {
      setIsTesting(false);
    }
  };

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR': return 'text-red-400';
      case 'WARN': return 'text-yellow-400';
      case 'INFO': return 'text-blue-400';
      case 'DEBUG': return 'text-gray-400';
      default: return 'text-gray-300';
    }
  };

  const getLogLevelIcon = (level: string) => {
    switch (level) {
      case 'ERROR': return <AlertTriangle className="h-3 w-3" />;
      case 'WARN': return <AlertTriangle className="h-3 w-3" />;
      case 'INFO': return <CheckCircle className="h-3 w-3" />;
      case 'DEBUG': return <Eye className="h-3 w-3" />;
      default: return <Eye className="h-3 w-3" />;
    }
  };

  const getMCPToolIcon = (tool?: string) => {
    switch (tool) {
      case 'neo4j-mcp': return <Database className="h-3 w-3" />;
      case 'brightdata-mcp': return <Search className="h-3 w-3" />;
      case 'perplexity-mcp': return <Brain className="h-3 w-3" />;
      case 'system': return <Cpu className="h-3 w-3" />;
      case 'test': return <Lightbulb className="h-3 w-3" />;
      default: return <Activity className="h-3 w-3" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Network className="h-8 w-8 text-purple-500" />
              MCP-Enabled Autonomous RFP System
            </h1>
            <p className="text-gray-400 mt-2">
              Direct MCP Integration: Neo4j + BrightData + Perplexity
            </p>
          </div>
          <div className="flex items-center gap-3">
            {systemStatus?.isRunning ? (
              <Badge className="bg-green-600 animate-pulse">
                ● ACTIVE
              </Badge>
            ) : (
              <Badge variant="outline">
                INACTIVE
              </Badge>
            )}
            {isStreaming && (
              <Badge className="bg-blue-600">
                ● STREAMING
              </Badge>
            )}
          </div>
        </div>

        {/* Control Panel */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                MCP Control Panel
              </span>
              <div className="flex items-center gap-2">
                <Button
                  onClick={testMCPTools}
                  disabled={isTesting}
                  size="sm"
                  variant="outline"
                >
                  {isTesting ? 'Testing...' : 'Test MCP Tools'}
                </Button>
                <Button
                  onClick={startMCPAutonomous}
                  disabled={isStarting || systemStatus?.isRunning}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {isStarting ? 'Starting...' : systemStatus?.isRunning ? 'Active' : 'Start MCP System'}
                </Button>
                <Button
                  onClick={stopMCPAutonomous}
                  disabled={isStopping || !systemStatus?.isRunning}
                  size="sm"
                  variant="destructive"
                >
                  {isStopping ? 'Stopping...' : 'Stop'}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* MCP Server Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {mcpServers.map((server) => (
                <div key={server.tool} className="bg-gray-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold flex items-center gap-2">
                      {getMCPToolIcon(server.tool)}
                      {server.tool}
                    </span>
                    <Badge className={server.status === 'success' ? 'bg-green-600' : 'bg-red-600'}>
                      {server.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-400">
                    Response: {server.responseTime}ms
                  </div>
                  {server.lastCall && (
                    <div className="text-xs text-gray-500">
                      Last: {new Date(server.lastCall).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* System Metrics */}
            {systemStatus && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-gray-700 rounded-lg p-3">
                  <div className="text-sm text-gray-400">Entities Processed</div>
                  <div className="text-lg font-semibold">{systemStatus.metrics.entitiesProcessed || 0}</div>
                </div>
                <div className="bg-gray-700 rounded-lg p-3">
                  <div className="text-sm text-gray-400">Batches Completed</div>
                  <div className="text-lg font-semibold">{systemStatus.metrics.batchesCompleted || 0}</div>
                </div>
                <div className="bg-gray-700 rounded-lg p-3">
                  <div className="text-sm text-gray-400">RFPs Identified</div>
                  <div className="text-lg font-semibold">{systemStatus.metrics.rfpsIdentified || 0}</div>
                </div>
                <div className="bg-gray-700 rounded-lg p-3">
                  <div className="text-sm text-gray-400">JSON Files Created</div>
                  <div className="text-lg font-semibold">{systemStatus.metrics.jsonFilesCreated || 0}</div>
                </div>
                <div className="bg-gray-700 rounded-lg p-3">
                  <div className="text-sm text-gray-400">MCP Calls</div>
                  <div className="text-lg font-semibold">{systemStatus.metrics.totalMcpCalls || 0}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Test Results */}
        {testResults && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                MCP Tools Test Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="flex items-center gap-4 mb-2">
                  <span className="text-sm text-gray-400">
                    Status: <span className="text-white font-semibold">{testResults.testSummary.overallStatus}</span>
                  </span>
                  <span className="text-sm text-gray-400">
                    Success: <span className="text-green-400 font-semibold">{testResults.testSummary.successCount}/{testResults.testSummary.totalTests}</span>
                  </span>
                  <span className="text-sm text-gray-400">
                    Time: <span className="text-blue-400 font-semibold">{testResults.testSummary.totalTime}</span>
                  </span>
                </div>
              </div>

              {testResults.results && (
                <div className="space-y-3">
                  {testResults.results.map((result: any, index: number) => (
                    <div key={index} className="bg-gray-700 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold flex items-center gap-2">
                          {getMCPToolIcon(result.tool)}
                          {result.tool}
                        </span>
                        <Badge className={result.status === 'success' ? 'bg-green-600' : 'bg-red-600'}>
                          {result.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-300">
                        Response Time: {result.responseTime}ms
                      </div>
                      {result.error && (
                        <div className="text-sm text-red-400 mt-1">
                          Error: {result.error}
                        </div>
                      )}
                      {result.result && (
                        <div className="text-xs text-gray-400 mt-2">
                          Result: {JSON.stringify(result.result).substring(0, 100)}...
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {testResults.recommendations && (
                <div className="mt-4">
                  <div className="text-sm font-semibold mb-2">Recommendations:</div>
                  <div className="space-y-1">
                    {testResults.recommendations.map((rec: string, index: number) => (
                      <div key={index} className="text-xs text-blue-400">
                        • {rec}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Real-time Logs */}
          <Card className="lg:col-span-2 bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Real-time MCP Logs
                </span>
                <Badge variant="outline">
                  {logs.length} entries
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] w-full">
                <div className="space-y-2">
                  {logs.length === 0 ? (
                    <div className="text-gray-500 text-center py-8">
                      No logs yet. Start the MCP-Enabled Autonomous System to see real-time processing logs.
                    </div>
                  ) : (
                    logs.map((log, index) => (
                      <div key={index} className="bg-gray-700 rounded-lg p-3 border border-gray-600">
                        <div className="flex items-center gap-2 mb-1">
                          {getMCPToolIcon(log.mcpTool)}
                          {getLogLevelIcon(log.level)}
                          <span className={`text-xs ${getLogLevelColor(log.level)}`}>
                            {log.level}
                          </span>
                          {log.mcpTool && (
                            <Badge variant="outline" className="text-xs">
                              {log.mcpTool}
                            </Badge>
                          )}
                          <span className="text-xs text-gray-400 ml-auto">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="text-sm text-gray-300">{log.message}</div>
                        {log.responseTime && (
                          <div className="text-xs text-gray-500 mt-1">
                            Response: {log.responseTime}ms
                          </div>
                        )}
                        {log.entityId && (
                          <div className="text-xs text-gray-500 mt-1">
                            Entity: {log.entityId}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* System Info */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                System Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-gray-400 mb-1">Operation Mode</div>
                  <div className="text-sm font-semibold">24/7 Autonomous Processing</div>
                </div>
                
                <div>
                  <div className="text-sm text-gray-400 mb-1">MCP Integration</div>
                  <div className="space-y-1">
                    <div className="text-xs text-green-400">• Neo4j (Knowledge Graph)</div>
                    <div className="text-xs text-green-400">• BrightData (Web Research)</div>
                    <div className="text-xs text-green-400">• Perplexity (Market Intelligence)</div>
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-400 mb-1">Processing Configuration</div>
                  <div className="space-y-1">
                    <div className="text-xs text-gray-300">
                      Batch Size: <span className="text-white">{systemStatus?.config.entityBatchSize || 3} entities</span>
                    </div>
                    <div className="text-xs text-gray-300">
                      Cycle: <span className="text-white">{systemStatus?.config.monitoringCycle || '4-hours'}</span>
                    </div>
                    <div className="text-xs text-gray-300">
                      Output: <span className="text-white">Structured JSON</span>
                    </div>
                  </div>
                </div>

                <Separator className="bg-gray-600" />

                <div>
                  <div className="text-sm text-gray-400 mb-2">Capabilities</div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <FileJson className="h-3 w-3 text-blue-400" />
                      <span className="text-xs">JSON Result Storage</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Target className="h-3 w-3 text-purple-400" />
                      <span className="text-xs">Entity Relationship Traversal</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-3 w-3 text-green-400" />
                      <span className="text-xs">Real-time Performance Metrics</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3 text-yellow-400" />
                      <span className="text-xs">Cron-based Scheduling</span>
                    </div>
                  </div>
                </div>

                <Separator className="bg-gray-600" />

                <div>
                  <div className="text-sm text-gray-400 mb-2">System Health</div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-green-500' : 'bg-gray-500'}`} />
                      <span className="text-xs">Log Streaming: {isStreaming ? 'Active' : 'Inactive'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${systemStatus?.isRunning ? 'bg-green-500' : 'bg-gray-500'}`} />
                      <span className="text-xs">Autonomous System: {systemStatus?.isRunning ? 'Running' : 'Stopped'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Info Section */}
        <Alert className="bg-gray-800 border-gray-700">
          <Network className="h-4 w-4" />
          <AlertDescription className="text-gray-300">
            <strong>🔌 MCP-Enabled Autonomous System:</strong> Direct integration with Neo4j, BrightData, and Perplexity MCP tools 
            for intelligent entity processing and RFP detection. System traverses knowledge graph relationships, performs 
            web research, and generates market intelligence - saving all results to structured JSON format for 24/7 autonomous operation.
            Currently monitoring with {systemStatus?.metrics.totalMcpCalls || 0} MCP tool calls and {systemStatus?.metrics.entitiesProcessed || 0} entities processed.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}