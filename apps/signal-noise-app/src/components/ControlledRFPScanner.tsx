'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Play, 
  Square, 
  Pause, 
  RotateCcw,
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  Target,
  Search,
  Activity
} from 'lucide-react';

interface ScanStatus {
  id: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  startTime: number;
  currentEntity?: string;
  currentEntityIndex: number;
  totalEntities: number;
  processedEntities: number;
  rfpOpportunitiesFound: number;
  timeElapsed: number;
  estimatedTimeRemaining: number;
  currentStage: string;
  error?: string;
  progressPercentage: number;
  formattedTimeElapsed: string;
  formattedEstimatedTimeRemaining: string;
}

export default function ControlledRFPScanner() {
  const [scanStatus, setScanStatus] = useState<ScanStatus & { 
  recentLogs?: string[], 
  totalLogs?: number,
  rfpOpportunities?: Array<{
    id: string;
    title: string;
    entity: string;
    source: string;
    url?: string;
    description?: string;
    deadline?: string;
    discoveredAt: string;
    type: 'RFP' | 'Tender' | 'Proposal' | 'Contract';
    confidence: 'high' | 'medium' | 'low';
  }>,
  totalOpportunities?: number
}>({
    id: '',
    status: 'idle',
    startTime: 0,
    currentEntityIndex: 0,
    totalEntities: 0,
    processedEntities: 0,
    rfpOpportunitiesFound: 0,
    timeElapsed: 0,
    estimatedTimeRemaining: 0,
    currentStage: 'Ready to start',
    progressPercentage: 0,
    formattedTimeElapsed: '0s',
    formattedEstimatedTimeRemaining: '0s',
    recentLogs: [],
    totalLogs: 0,
    rfpOpportunities: [],
    totalOpportunities: 0
  });

  const [isUpdating, setIsUpdating] = useState(false);
  const [entityLimit, setEntityLimit] = useState(500);
  const [showDetailedLogs, setShowDetailedLogs] = useState(false);

  // Poll for status updates every second when running
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (scanStatus.status === 'running') {
      interval = setInterval(() => {
        fetchScanStatus();
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [scanStatus.status]);

  const fetchScanStatus = useCallback(async () => {
    try {
      // Only show loading state if it's taking longer than 300ms or if status is 'running'
      const loadingTimer = setTimeout(() => {
        if (scanStatus.status === 'running') {
          setIsUpdating(true);
        }
      }, 300);

      const response = await fetch('/api/rfp-scan-control');
      
      // Check if response is ok and has content
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const responseText = await response.text();
      
      // Check if response is empty
      if (!responseText.trim()) {
        throw new Error('Empty response from server');
      }
      
      let status;
      try {
        status = JSON.parse(responseText);
        
        // Validate the response structure
        if (!status || typeof status !== 'object') {
          throw new Error('Invalid response structure');
        }
        
        // Ensure critical arrays exist
        if (!Array.isArray(status.detailedLogs)) {
          status.detailedLogs = [];
        }
        if (!Array.isArray(status.rfpOpportunities)) {
          status.rfpOpportunities = [];
        }
        
      } catch (parseError) {
        console.error('JSON parsing failed:', parseError, 'Response text:', responseText);
        throw new Error('Invalid JSON response from server');
      }
      
      clearTimeout(loadingTimer);
      
      // Only update if data actually changed to prevent unnecessary re-renders
      const hasChanged = JSON.stringify(status) !== JSON.stringify(scanStatus);
      if (hasChanged) {
        setScanStatus(status);
      }
      
      // Brief loading indicator only for running scans
      if (scanStatus.status === 'running') {
        setIsUpdating(true);
        setTimeout(() => setIsUpdating(false), 200);
      }
    } catch (error) {
      console.error('Failed to fetch scan status:', error);
      setIsUpdating(false);
      // Don't show error to user for temporary fetch issues, just log it
    }
  }, [scanStatus.status]);

  const executeScanAction = async (action: string, config?: any) => {
    try {
      const response = await fetch('/api/rfp-scan-control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, config })
      });

      // Check response status
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseText = await response.text();
      
      // Check if response is empty
      if (!responseText.trim()) {
        throw new Error('Empty response from server');
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON parsing failed in action response:', parseError, 'Response text:', responseText);
        throw new Error('Invalid JSON response from server');
      }

      if (result.success) {
        // Wait a moment for the server to process the action, then fetch status
        await new Promise(resolve => setTimeout(resolve, 500));
        await fetchScanStatus();
      } else {
        console.error('Scan action failed:', result.error);
        // You could add user notification here if needed
      }
    } catch (error) {
      console.error('Failed to execute scan action:', error);
      // You could add user notification here if needed
    }
  };

  const handleStart = () => {
    executeScanAction('start', { entityLimit });
  };

  const handleStop = () => {
    executeScanAction('stop');
  };

  const handlePause = () => {
    executeScanAction('pause');
  };

  const handleResume = () => {
    executeScanAction('resume');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-green-400';
      case 'paused': return 'text-yellow-400';
      case 'completed': return 'text-blue-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Activity className="w-4 h-4" />;
      case 'paused': return <Pause className="w-4 h-4" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'error': return <AlertCircle className="w-4 h-4" />;
      default: return <Square className="w-4 h-4" />;
    }
  };

  const getControlButton = () => {
    switch (scanStatus.status) {
      case 'idle':
        return (
          <Button
            onClick={handleStart}
            size="lg"
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-6 text-lg font-semibold"
          >
            <Play className="mr-2 h-5 w-5" />
            Start RFP Scan
          </Button>
        );
      
      case 'running':
        return (
          <div className="flex gap-3">
            <Button
              onClick={handlePause}
              variant="outline"
              className="border-yellow-600 text-yellow-400 hover:bg-yellow-600/20"
            >
              <Pause className="mr-2 h-4 w-4" />
              Pause
            </Button>
            <Button
              onClick={handleStop}
              variant="destructive"
            >
              <Square className="mr-2 h-4 w-4" />
              Stop Scan
            </Button>
          </div>
        );
      
      case 'paused':
        return (
          <div className="flex gap-3">
            <Button
              onClick={handleResume}
              size="lg"
              className="bg-yellow-600 hover:bg-yellow-700 text-white px-8 py-6 text-lg font-semibold"
            >
              <Play className="mr-2 h-5 w-5" />
              Resume Scan
            </Button>
            <Button
              onClick={handleStop}
              variant="destructive"
            >
              <Square className="mr-2 h-4 w-4" />
              Stop
            </Button>
          </div>
        );
      
      case 'completed':
        return (
          <Button
            onClick={handleStart}
            size="lg"
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-6 text-lg font-semibold"
          >
            <RotateCcw className="mr-2 h-5 w-5" />
            Start New Scan
          </Button>
        );
      
      case 'error':
        return (
          <Button
            onClick={handleStart}
            size="lg"
            className="bg-red-600 hover:bg-red-700 text-white px-8 py-6 text-lg font-semibold"
          >
            <RotateCcw className="mr-2 h-5 w-5" />
            Retry Scan
          </Button>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-white">🎯 Controlled RFP Scanner</h1>
        <p className="text-gray-300 max-w-2xl mx-auto">
          Single-instance RFP monitoring with real-time progress tracking and complete control over the scanning process.
        </p>
      </div>

      {/* Main Control Panel */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              RFP Scan Control Center
            </div>
            <div className={`flex items-center gap-2 transition-colors duration-300 ${getStatusColor(scanStatus.status)}`}>
              <div className="relative">
                {getStatusIcon(scanStatus.status)}
                {isUpdating && scanStatus.status === 'running' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-3 h-3 animate-spin opacity-70" />
                  </div>
                )}
              </div>
              <span className="font-medium capitalize transition-all duration-300">
                {scanStatus.status}
              </span>
            </div>
          </CardTitle>
          <CardDescription className="text-gray-300">
            Only one scan can run at a time. Progress is automatically saved and can be resumed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Configuration */}
          {scanStatus.status === 'idle' && (
            <div className="space-y-4 p-4 bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-4">
                <label className="text-white font-medium">Entity Limit:</label>
                <select
                  value={entityLimit}
                  onChange={(e) => setEntityLimit(Number(e.target.value))}
                  className="bg-gray-600 text-white px-3 py-2 rounded border border-gray-500 focus:border-green-400 focus:outline-none"
                >
                  <option value={10}>10 entities (quick test)</option>
                  <option value={25}>25 entities (standard)</option>
                  <option value={50}>50 entities (comprehensive)</option>
                  <option value={100}>100 entities (deep scan)</option>
                  <option value={500}>500 entities (extensive)</option>
                  <option value={1000}>1,000 entities (production)</option>
                  <option value={2997}>2,997 entities (ALL ENTITIES)</option>
                </select>
              </div>
              {entityLimit >= 1000 && (
                <div className="p-3 bg-yellow-900/20 border border-yellow-600 rounded-lg">
                  <div className="flex items-center gap-2 text-yellow-400">
                    <Activity className="w-4 h-4" />
                    <span className="font-semibold">Large Scan Warning</span>
                  </div>
                  <p className="text-yellow-300 text-sm mt-1">
                    Scanning {entityLimit} entities may take {Math.round(entityLimit * 0.5)}+ minutes. 
                    This will use significant API credits and processing time.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Main Control Button */}
          <div className="flex justify-center">
            {getControlButton()}
          </div>

          {/* Progress Section */}
          {(scanStatus.status === 'running' || scanStatus.status === 'paused' || scanStatus.status === 'completed') && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-300 transition-all duration-300">
                  <span>Progress</span>
                  <span className={`font-mono ${isUpdating ? 'text-blue-400' : ''}`}>
                    {scanStatus.progressPercentage}%
                  </span>
                </div>
                <div className="relative">
                  <Progress 
                    value={scanStatus.progressPercentage} 
                    className="h-3 transition-all duration-500" 
                  />
                  {isUpdating && scanStatus.status === 'running' && (
                    <div className="absolute inset-0 bg-blue-400/10 animate-pulse rounded-full" />
                  )}
                </div>
                <div className="flex justify-between text-xs text-gray-400 transition-all duration-300">
                  <span>Entity {scanStatus.processedEntities} of {scanStatus.totalEntities}</span>
                  <span>{scanStatus.rfpOpportunitiesFound} RFPs found</span>
                </div>
              </div>

              {/* Current Activity */}
              <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600 transition-all duration-300">
                <div className="flex items-center gap-2 mb-2">
                  <Search className={`w-4 h-4 ${isUpdating ? 'text-blue-400 animate-pulse' : 'text-green-400'} transition-colors duration-300`} />
                  <span className="text-green-400 font-medium">Current Activity:</span>
                  {isUpdating && scanStatus.status === 'running' && (
                    <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                  )}
                </div>
                <p className={`text-white font-medium transition-all duration-300 ${isUpdating ? 'text-blue-100' : ''}`}>
                  {scanStatus.currentStage}
                </p>
                {scanStatus.currentEntity && (
                  <p className="text-gray-300 text-sm mt-1 transition-all duration-300">
                    Processing: <span className="text-yellow-400 font-medium">{scanStatus.currentEntity}</span>
                  </p>
                )}
              </div>

              {/* Time Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-gray-700/50 rounded-lg transition-all duration-300 hover:bg-gray-700/70">
                  <Clock className={`w-5 h-5 mx-auto mb-1 transition-colors duration-300 ${isUpdating ? 'text-blue-300 animate-pulse' : 'text-blue-400'}`} />
                  <div className="text-sm text-gray-300">Time Elapsed</div>
                  <div className="text-lg font-mono text-white transition-all duration-300">{scanStatus.formattedTimeElapsed}</div>
                </div>
                <div className="text-center p-3 bg-gray-700/50 rounded-lg transition-all duration-300 hover:bg-gray-700/70">
                  <Target className={`w-5 h-5 mx-auto mb-1 transition-colors duration-300 ${scanStatus.processedEntities > 0 ? 'text-green-300' : 'text-green-400'}`} />
                  <div className="text-sm text-gray-300">Entities Processed</div>
                  <div className="text-lg font-mono text-white transition-all duration-300">
                    <span className={scanStatus.processedEntities > 0 ? 'text-green-300' : ''}>
                      {scanStatus.processedEntities}/{scanStatus.totalEntities}
                    </span>
                  </div>
                </div>
                <div className="text-center p-3 bg-gray-700/50 rounded-lg transition-all duration-300 hover:bg-gray-700/70">
                  <Activity className="w-5 h-5 text-yellow-400 mx-auto mb-1 transition-colors duration-300" />
                  <div className="text-sm text-gray-300">Est. Time Remaining</div>
                  <div className="text-lg font-mono text-white transition-all duration-300">{scanStatus.formattedEstimatedTimeRemaining}</div>
                </div>
                <div className="text-center p-3 bg-gray-700/50 rounded-lg transition-all duration-300 hover:bg-gray-700/70">
                  <Search className="w-5 h-5 text-purple-400 mx-auto mb-1 transition-colors duration-300" />
                  <div className="text-sm text-gray-300">Scan Speed</div>
                  <div className="text-lg font-mono text-white transition-all duration-300">
                    {scanStatus.timeElapsed > 0 && scanStatus.processedEntities > 0 
                      ? `${Math.round(scanStatus.processedEntities / (scanStatus.timeElapsed / 60000))}/min`
                      : 'Calculating...'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {scanStatus.status === 'error' && (
            <div className="flex items-center gap-2 p-4 bg-red-900/20 border border-red-700 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <div>
                <p className="text-red-400 font-semibold">Scan Error</p>
                <p className="text-red-300 text-sm">{scanStatus.error}</p>
              </div>
            </div>
          )}

          {/* Success Display */}
          {scanStatus.status === 'completed' && (
            <div className="space-y-4 p-4 bg-green-900/20 border border-green-700 rounded-lg">
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle className="w-5 h-5" />
                <h3 className="font-semibold text-green-400">Scan Completed Successfully</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-white">{scanStatus.processedEntities}</div>
                  <div className="text-sm text-gray-300">Entities Processed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-400">{scanStatus.rfpOpportunitiesFound}</div>
                  <div className="text-sm text-gray-300">RFP Opportunities Found</div>
                </div>
                <div>
                  <div className="text-lg font-mono text-white">{scanStatus.formattedTimeElapsed}</div>
                  <div className="text-sm text-gray-300">Total Duration</div>
                </div>
                <div>
                  <div className="text-lg font-mono text-blue-400">
                    {scanStatus.processedEntities > 0 
                      ? Math.round(scanStatus.rfpOpportunitiesFound / scanStatus.processedEntities * 100)
                      : 0}%
                  </div>
                  <div className="text-sm text-gray-300">Success Rate</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* RFP Opportunities Found */}
      {(scanStatus.status === 'running' || scanStatus.status === 'completed') && scanStatus.totalOpportunities && scanStatus.totalOpportunities > 0 && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-green-400" />
                RFP Opportunities Found
                <span className="text-sm text-gray-400">({scanStatus.totalOpportunities} total)</span>
              </div>
            </CardTitle>
            <CardDescription className="text-gray-300">
              Specific RFP opportunities discovered during the scan with links for verification
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {scanStatus.rfpOpportunities && scanStatus.rfpOpportunities.length > 0 ? (
                scanStatus.rfpOpportunities.map((opportunity, index) => (
                  <div key={opportunity.id} className="p-4 bg-gray-700/50 rounded-lg border border-gray-600 hover:border-green-500/50 transition-all duration-300">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs px-2 py-1 rounded font-medium ${
                            opportunity.type === 'RFP' ? 'bg-blue-900/30 text-blue-400' :
                            opportunity.type === 'Tender' ? 'bg-purple-900/30 text-purple-400' :
                            opportunity.type === 'Proposal' ? 'bg-green-900/30 text-green-400' :
                            'bg-yellow-900/30 text-yellow-400'
                          }`}>
                            {opportunity.type}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded font-medium ${
                            opportunity.confidence === 'high' ? 'bg-green-900/30 text-green-400' :
                            opportunity.confidence === 'medium' ? 'bg-yellow-900/30 text-yellow-400' :
                            'bg-red-900/30 text-red-400'
                          }`}>
                            {opportunity.confidence} confidence
                          </span>
                          <span className="text-xs text-gray-400">
                            from {opportunity.entity}
                          </span>
                        </div>
                        <h4 className="text-white font-medium mb-2">{opportunity.title}</h4>
                        {opportunity.description && (
                          <p className="text-gray-300 text-sm mb-2">{opportunity.description}</p>
                        )}
                        {opportunity.deadline && (
                          <p className="text-yellow-400 text-sm mb-2">⏰ Deadline: {opportunity.deadline}</p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <span>Source: {opportunity.source}</span>
                          <span>•</span>
                          <span>{new Date(opportunity.discoveredAt).toLocaleTimeString()}</span>
                        </div>
                      </div>
                      {opportunity.url && (
                        <div className="flex flex-col gap-2">
                          <a
                            href={opportunity.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors duration-200"
                          >
                            <Target className="w-3 h-3" />
                            View
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No RFP opportunities discovered yet...</p>
                  <p className="text-sm">Opportunities will appear here as they are found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Logs */}
      {(scanStatus.status === 'running' || scanStatus.status === 'completed' || scanStatus.status === 'error') && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Detailed Activity Logs
                {scanStatus.totalLogs && scanStatus.totalLogs > 0 && (
                  <span className="text-sm text-gray-400">({scanStatus.totalLogs} total entries)</span>
                )}
              </div>
              <Button
                onClick={() => setShowDetailedLogs(!showDetailedLogs)}
                variant="outline"
                size="sm"
                className="text-gray-300 border-gray-600"
              >
                {showDetailedLogs ? 'Hide' : 'Show'} Logs
              </Button>
            </CardTitle>
            <CardDescription className="text-gray-300">
              Real-time log of all scan activities, tool usage, and discoveries
            </CardDescription>
          </CardHeader>
          {showDetailedLogs && (
            <CardContent>
              <div className="bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto">
                {scanStatus.recentLogs && scanStatus.recentLogs.length > 0 ? (
                  <div className="space-y-2">
                    {scanStatus.recentLogs.map((log, index) => (
                      <div key={index} className="text-sm font-mono">
                        {log.includes('ERROR') && (
                          <span className="text-red-400">❌ {log}</span>
                        )}
                        {log.includes('WARNING') && (
                          <span className="text-yellow-400">⚠️ {log}</span>
                        )}
                        {log.includes('SUCCESS') && (
                          <span className="text-green-400">✅ {log}</span>
                        )}
                        {!log.includes('ERROR') && !log.includes('WARNING') && !log.includes('SUCCESS') && (
                          <span className="text-gray-300">{log}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No detailed logs available yet...</p>
                    <p className="text-sm">Logs will appear as the scan progresses</p>
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Instructions */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">📋 Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-semibold text-green-400">Starting a Scan</h4>
              <ul className="text-gray-300 space-y-1">
                <li>• Choose entity limit (10-100 entities)</li>
                <li>• Click "Start RFP Scan" to begin</li>
                <li>• System processes entities sequentially</li>
                <li>• Real-time progress updates provided</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-yellow-400">Control Options</h4>
              <ul className="text-gray-300 space-y-1">
                <li>• <span className="text-yellow-400">Pause:</span> Temporarily halt scanning</li>
                <li>• <span className="text-red-400">Stop:</span> Cancel the scan entirely</li>
                <li>• <span className="text-green-400">Resume:</span> Continue paused scan</li>
                <li>• <span className="text-blue-400">Single Instance:</span> Only one scan at a time</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}