'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Play, Pause, Square, RotateCcw, RefreshCw, FileText, Activity, Clock, CheckCircle, Database, Brain, TrendingUp } from 'lucide-react';

interface BatchProcessorState {
  isRunning: boolean;
  lastRun: string | null;
  cacheInfo: any;
  recentResults: any;
}

function BatchProcessorControls() {
  const [batchState, setBatchState] = useState<BatchProcessorState>({
    isRunning: false,
    lastRun: null,
    cacheInfo: null,
    recentResults: null
  });
  const [selectedLimit, setSelectedLimit] = useState<number>(5);
  const [syncOnly, setSyncOnly] = useState<boolean>(false);
  const [analyzeOnly, setAnalyzeOnly] = useState<boolean>(false);
  const [verboseMode, setVerboseMode] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showLogs, setShowLogs] = useState<boolean>(false);
  const [rawLogs, setRawLogs] = useState<string>('');

  const fetchBatchStatus = async () => {
    try {
      const response = await fetch('/api/batch-processor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status' })
      });
      
      if (response.ok) {
        const data = await response.json();
        setBatchState(prev => ({ ...prev, cacheInfo: data.cache }));
      }
    } catch (error) {
      console.error('Error fetching batch status:', error);
    }
  };

  const runBatchProcessor = async () => {
    setIsLoading(true);
    setBatchState(prev => ({ ...prev, isRunning: true }));

    try {
      const options = {
        sync: syncOnly || (!analyzeOnly), // sync unless analyze-only
        analyze: analyzeOnly || (!syncOnly), // analyze unless sync-only
        limit: selectedLimit
      };

      // Choose API endpoint based on mode
      const endpoint = verboseMode ? '/api/batch-processor/verbose' : '/api/batch-processor';
      const action = verboseMode ? 'run-verbose' : 'run';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, options })
      });

      const data = await response.json();

      if (data.success) {
        setBatchState(prev => ({
          ...prev,
          isRunning: false,
          lastRun: data.completedAt,
          recentResults: data.summary
        }));
        
        // Capture logs if in verbose mode
        if (verboseMode && data.stdout) {
          setRawLogs(data.stdout);
          setShowLogs(true);
        }
        
        // Refresh cache info after successful run
        await fetchBatchStatus();
      } else {
        console.error('Batch processor failed:', data.error);
        setBatchState(prev => ({ ...prev, isRunning: false }));
      }
    } catch (error) {
      console.error('Error running batch processor:', error);
      setBatchState(prev => ({ ...prev, isRunning: false }));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBatchStatus();
  }, []);

  return (
    <div className="space-y-4">
      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Status</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {batchState.cacheInfo?.entityCount || 0} entities
            </div>
            {batchState.cacheInfo?.exists ? (
              <Badge variant="secondary" className="mt-1">Cached</Badge>
            ) : (
              <Badge variant="outline" className="mt-1">No Cache</Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Run</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {batchState.lastRun 
                ? new Date(batchState.lastRun).toLocaleString()
                : 'Never'
              }
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Results</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {batchState.recentResults ? (
              <div className="text-sm space-y-1">
                <div>{batchState.recentResults.totalEntities} entities</div>
                <div>{batchState.recentResults.totalOpportunities} opportunities</div>
                <div>£{batchState.recentResults.estimatedValue}M value</div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No results yet</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Entity Limit */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Entities:</label>
          <Select value={selectedLimit.toString()} onValueChange={(value) => setSelectedLimit(parseInt(value))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3</SelectItem>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Operation Type */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Mode:</label>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={syncOnly}
                onChange={(e) => {
                  setSyncOnly(e.target.checked);
                  if (e.target.checked) setAnalyzeOnly(false);
                }}
              />
              Sync Only
            </label>
            <label className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={analyzeOnly}
                onChange={(e) => {
                  setAnalyzeOnly(e.target.checked);
                  if (e.target.checked) setSyncOnly(false);
                }}
              />
              Analyze Only
            </label>
            <label className="flex items-center gap-1 text-sm text-purple-600">
              <input
                type="checkbox"
                checked={verboseMode}
                onChange={(e) => setVerboseMode(e.target.checked)}
              />
              📝 Verbose
            </label>
          </div>
        </div>

        <Separator orientation="vertical" className="h-10" />

        {/* Action Button */}
        <Button 
          onClick={runBatchProcessor}
          disabled={batchState.isRunning || isLoading}
          className="flex items-center gap-2"
        >
          <Brain className={`w-4 h-4 ${batchState.isRunning ? 'animate-pulse' : ''}`} />
          {batchState.isRunning ? 'Processing...' : 'Run Batch Processor'}
        </Button>

        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchBatchStatus}
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Status
        </Button>
      </div>

      {/* Recent Results Detail */}
      {batchState.recentResults && (
        <div className="mt-4 p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
          <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">Last Run Results</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Entities:</span>
              <div className="font-medium">{batchState.recentResults.totalEntities}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Opportunities:</span>
              <div className="font-medium">{batchState.recentResults.totalOpportunities}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Value:</span>
              <div className="font-medium">£{batchState.recentResults.estimatedValue}M</div>
            </div>
            <div>
              <span className="text-muted-foreground">Entities:</span>
              <div className="font-medium">{batchState.recentResults.entities?.slice(0, 2).join(', ')}{batchState.recentResults.entities?.length > 2 ? '...' : ''}</div>
            </div>
          </div>
        </div>
      )}

      {batchState.isRunning && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            🤖 AI batch processor is running... This may take 1-2 minutes to complete.
          </p>
        </div>
      )}

      {/* Detailed Logs Section */}
      {showLogs && rawLogs && (
        <Card className="mt-4">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              📝 Detailed Batch Processor Logs
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLogs(false)}
            >
              ✕
            </Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96 w-full border rounded-md p-4 bg-black text-green-400 font-mono text-xs">
              <pre className="whitespace-pre-wrap">
                {rawLogs}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface SyncState {
  isRunning: boolean;
  isPaused: boolean;
  lastRun: string | null;
  currentProgress: number;
  totalEntities: number;
  status: 'idle' | 'running' | 'paused' | 'stopped';
}

interface LogData {
  content: string;
  totalLines: number;
  requestedLines: number;
  logPath: string;
  type: string;
}

export default function SyncControlCenter() {
  const [syncState, setSyncState] = useState<SyncState>({
    isRunning: false,
    isPaused: false,
    lastRun: null,
    currentProgress: 0,
    totalEntities: 0,
    status: 'idle'
  });

  const [logs, setLogs] = useState<LogData | null>(null);
  const [logType, setLogType] = useState<'cron' | 'daily'>('cron');
  const [selectedLimit, setSelectedLimit] = useState<number>(10);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  // Fetch sync status
  const fetchSyncStatus = async () => {
    try {
      const response = await fetch('/api/sync-control');
      if (response.ok) {
        const data = await response.json();
        setSyncState(data);
      }
    } catch (error) {
      console.error('Error fetching sync status:', error);
    }
  };

  // Fetch logs
  const fetchLogs = async () => {
    try {
      const response = await fetch(`/api/sync-logs?type=${logType}&lines=100`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  // Control sync
  const controlSync = async (action: string, params?: any) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/sync-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...params })
      });

      if (response.ok) {
        const data = await response.json();
        console.log(data.message);
        await fetchSyncStatus();
      } else {
        const error = await response.json();
        console.error('Error:', error.error);
      }
    } catch (error) {
      console.error('Error controlling sync:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchSyncStatus();
    fetchLogs();

    // Set up auto-refresh
    const interval = setInterval(() => {
      fetchSyncStatus();
      if (syncState.isRunning || syncState.isPaused) {
        fetchLogs();
      }
    }, 5000);

    setRefreshInterval(interval);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [logType, syncState.isRunning, syncState.isPaused]);

  const getStatusBadge = () => {
    const statusConfig = {
      idle: { variant: 'secondary' as const, icon: Clock, text: 'Idle' },
      running: { variant: 'default' as const, icon: Play, text: 'Running' },
      paused: { variant: 'outline' as const, icon: Pause, text: 'Paused' },
      stopped: { variant: 'destructive' as const, icon: Square, text: 'Stopped' }
    };

    const config = statusConfig[syncState.status];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-2">
        <Icon className="w-3 h-3" />
        {config.text}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">RFP Sync Control Center</h1>
          <p className="text-muted-foreground">
            Monitor and control the automated RFP intelligence sync system
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => window.location.reload()}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {getStatusBadge()}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Entities</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{syncState.totalEntities}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Run</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {syncState.lastRun 
                ? new Date(syncState.lastRun).toLocaleString()
                : 'Never'
              }
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Progress</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {syncState.isRunning ? 'Processing...' : '0'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Sync Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Start Controls */}
            <div className="flex items-center gap-2">
              <Select value={selectedLimit.toString()} onValueChange={(value) => setSelectedLimit(parseInt(value))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">Test (3)</SelectItem>
                  <SelectItem value="10">Small (10)</SelectItem>
                  <SelectItem value="25">Medium (25)</SelectItem>
                  <SelectItem value="50">Large (50)</SelectItem>
                  <SelectItem value="999">Full</SelectItem>
                </SelectContent>
              </Select>
              
              <Button 
                onClick={() => controlSync('start', { limit: selectedLimit })}
                disabled={syncState.isRunning || isLoading}
                className="flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                Start
              </Button>

              <Button 
                variant="outline"
                onClick={() => controlSync('start', { forceFull: true })}
                disabled={syncState.isRunning || isLoading}
                className="flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Force Full
              </Button>
            </div>

            <Separator orientation="vertical" className="h-10" />

            {/* Control Buttons */}
            <div className="flex items-center gap-2">
              <Button 
                variant="outline"
                onClick={() => controlSync('pause')}
                disabled={!syncState.isRunning || syncState.isPaused || isLoading}
                className="flex items-center gap-2"
              >
                <Pause className="w-4 h-4" />
                Pause
              </Button>

              <Button 
                variant="outline"
                onClick={() => controlSync('resume')}
                disabled={!syncState.isPaused || isLoading}
                className="flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                Resume
              </Button>

              <Button 
                variant="destructive"
                onClick={() => controlSync('stop')}
                disabled={!syncState.isRunning || isLoading}
                className="flex items-center gap-2"
              >
                <Square className="w-4 h-4" />
                Stop
              </Button>
            </div>
          </div>

          {syncState.isRunning && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                ⚠️ Sync is currently running. Use controls above to manage the process.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Batch Processor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Neo4j + AI Batch Processor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <BatchProcessorControls />
        </CardContent>
      </Card>

      {/* Log Viewer */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              System Logs
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={logType} onValueChange={(value: 'cron' | 'daily') => setLogType(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cron">Cron Log</SelectItem>
                  <SelectItem value="daily">Daily Log</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchLogs}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96 w-full border rounded-md p-4">
            <pre className="text-xs font-mono whitespace-pre-wrap">
              {logs?.content || 'No logs available...'}
            </pre>
          </ScrollArea>
          {logs && (
            <div className="mt-2 text-xs text-muted-foreground">
              Showing {logs.requestedLines} of {logs.totalLines} lines from {logs.logPath}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}