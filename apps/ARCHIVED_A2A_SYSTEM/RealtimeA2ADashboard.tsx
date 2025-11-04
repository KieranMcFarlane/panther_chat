'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Clock, Target, Database, Activity, Play, Square } from 'lucide-react';

interface A2AScanProgress {
  sessionId: string | null;
  totalEntities: number;
  processedEntities: number;
  currentBatch: number;
  totalBatches: number;
  opportunitiesFound: number;
  status: 'idle' | 'starting' | 'running' | 'completed' | 'error';
  currentEntity: string | null;
  startTime: string | null;
  endTime: string | null;
  errors: string[];
}

export function RealtimeA2ADashboard() {
  const [progress, setProgress] = useState<A2AScanProgress | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState('00:00:00');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Fetch progress every 2 seconds - always show the latest scan
  useEffect(() => {
    const fetchProgress = async () => {
      try {
        // Always get the most recent scan (default API behavior)
        const response = await fetch('/api/a2a-full-scan/progress');
        const data = await response.json();
        
        if (data.success && data.progress) {
          setProgress(data.progress);
          setLastUpdate(new Date());
          setIsConnected(true);
        } else {
          console.warn('No progress data available');
          setIsConnected(false);
        }
      } catch (error) {
        console.error('Failed to fetch progress:', error);
        setIsConnected(false);
      }
    };

    fetchProgress(); // Initial fetch
    const interval = setInterval(fetchProgress, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, []);

  // Calculate time elapsed
  useEffect(() => {
    if (progress?.startTime) {
      const updateTime = () => {
        const start = new Date(progress.startTime);
        const now = new Date();
        const diff = now.getTime() - start.getTime();
        
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        
        setTimeElapsed(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      };

      updateTime();
      const interval = setInterval(updateTime, 1000);
      return () => clearInterval(interval);
    }
  }, [progress?.startTime]);

  // Start new A2A scan
  const startScan = async () => {
    // If a scan is already running, don't start another one
    if (progress?.status === 'running' || progress?.status === 'starting') {
      alert(`A scan is already in progress (Session: ${progress.sessionId?.slice(-8)}). Please wait for it to complete or refresh the page.`);
      return;
    }

    try {
      const response = await fetch('/api/a2a-full-scan/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchSize: 50,
          startEntityId: 0
        })
      });
      
      const data = await response.json();
      if (data.success) {
        console.log('✅ A2A Scan started:', data.sessionId);
        // Refresh progress immediately to show the new scan
        setTimeout(() => window.location.reload(), 1000);
      } else {
        alert(`Failed to start scan: ${data.error || data.message}`);
      }
    } catch (error) {
      console.error('Failed to start scan:', error);
      alert('Failed to start scan. Please check console for details.');
    }
  };

  // Stop currently running scan
  const stopScan = async () => {
    if (!progress?.sessionId || progress.status !== 'running') {
      alert('No active scan to stop.');
      return;
    }

    try {
      const response = await fetch('/api/a2a-full-scan/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: progress.sessionId,
          reason: 'User requested stop'
        })
      });
      
      const data = await response.json();
      if (data.success) {
        console.log('🛑 A2A Scan stopped:', progress.sessionId);
        // Refresh to show stopped status
        setTimeout(() => window.location.reload(), 1000);
      } else {
        alert(`Failed to stop scan: ${data.error || data.message}`);
      }
    } catch (error) {
      console.error('Failed to stop scan:', error);
      alert('Failed to stop scan. Please check console for details.');
    }
  };

  // Calculate progress percentage
  const progressPercentage = progress?.totalEntities > 0 
    ? Math.round((progress.processedEntities / progress.totalEntities) * 100)
    : 0;

  // Status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      case 'starting': return 'bg-yellow-500';
      case 'stopped': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  if (!progress) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            A2A Full Scan - Real-Time Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-muted-foreground">Loading A2A scan progress...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            A2A Full Scan - Real-Time Progress
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
            <span className="text-sm text-muted-foreground">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor(progress.status)}>
              {progress.status?.toUpperCase() || 'IDLE'}
            </Badge>
            {progress.sessionId && (
              <span className="text-sm text-muted-foreground font-mono">
                Session: {progress.sessionId.slice(-8)}
              </span>
            )}
          </div>
          {lastUpdate && (
            <div className="text-xs text-muted-foreground">
              Last update: {lastUpdate.toLocaleTimeString()}
            </div>
          )}
        </div>

        {/* Main Progress */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Scan Progress</span>
            <span>{progress.processedEntities} / {progress.totalEntities} entities ({progressPercentage}%)</span>
          </div>
          <Progress value={progressPercentage} className="h-3" />
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Database className="h-4 w-4 text-blue-500" />
            <div>
              <div className="text-sm font-medium">{progress.processedEntities}</div>
              <div className="text-xs text-muted-foreground">Entities Processed</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Target className="h-4 w-4 text-green-500" />
            <div>
              <div className="text-sm font-medium">{progress.opportunitiesFound}</div>
              <div className="text-xs text-muted-foreground">RFPs Found</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Activity className="h-4 w-4 text-orange-500" />
            <div>
              <div className="text-sm font-medium">{progress.currentBatch}/{progress.totalBatches}</div>
              <div className="text-xs text-muted-foreground">Current Batch</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Clock className="h-4 w-4 text-purple-500" />
            <div>
              <div className="text-sm font-medium">{timeElapsed}</div>
              <div className="text-xs text-muted-foreground">Time Elapsed</div>
            </div>
          </div>
        </div>

        {/* Current Activity */}
        {progress.currentEntity && (
          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
              Currently Processing:
            </div>
            <div className="text-sm text-blue-800 dark:text-blue-200">
              {progress.currentEntity}
            </div>
          </div>
        )}

        {/* Errors */}
        {progress.errors && progress.errors.length > 0 && (
          <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
            <div className="text-sm font-medium text-red-900 dark:text-red-100 mb-2">
              Errors:
            </div>
            {progress.errors.map((error, index) => (
              <div key={index} className="text-sm text-red-800 dark:text-red-200">
                • {error}
              </div>
            ))}
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-2 flex-wrap">
          {progress.status !== 'running' && progress.status !== 'starting' ? (
            <Button onClick={startScan} className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              Start New Scan
            </Button>
          ) : (
            <Button 
              onClick={stopScan} 
              variant="destructive"
              className="flex items-center gap-2"
            >
              <Square className="h-4 w-4" />
              Stop Scan
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={() => window.location.reload()}
            className="flex items-center gap-2"
          >
            <Activity className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Debug Info */}
        <div className="text-xs text-muted-foreground border-t pt-4">
          <div className="font-mono space-y-1">
            <div>Session ID: {progress.sessionId || 'None'}</div>
            <div>Start Time: {progress.startTime ? new Date(progress.startTime).toLocaleString() : 'Not started'}</div>
            {progress.endTime && <div>End Time: {new Date(progress.endTime).toLocaleString()}</div>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}