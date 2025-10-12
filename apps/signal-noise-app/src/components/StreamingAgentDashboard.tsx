/**
 * 🎬 Streaming Agent React Component
 * Real-time Claude Agent + MCP workflow visualization
 * Progressive updates in the browser
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface StreamChunk {
  type: 'start' | 'mcp_start' | 'mcp_progress' | 'mcp_data' | 'mcp_complete' | 'claude_start' | 'claude_chunk' | 'claude_complete' | 'error' | 'complete' | 'stream-complete';
  data: any;
  timestamp: string;
  tool?: string;
  server?: string;
  message?: string;
}

interface StreamState {
  isRunning: boolean;
  logs: string[];
  currentStep: string;
  progress: number;
  results: any[];
  errors: string[];
  startTime?: string;
  endTime?: string;
}

function StreamingAgentDashboard() {
  const [entityId, setEntityId] = useState<string>('197');
  const [analysisType, setAnalysisType] = useState<'quick' | 'comprehensive'>('comprehensive');
  const [action, setAction] = useState<'run' | 'analyze-entity' | 'daily-scan'>('analyze-entity');
  const [streamState, setStreamState] = useState<StreamState>({
    isRunning: false,
    logs: [],
    currentStep: 'Ready to start',
    progress: 0,
    results: [],
    errors: []
  });

  const logsRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [streamState.logs]);

  // Handle streaming response
  const handleStreamResponse = async (controller: AbortController) => {
    try {
      const response = await fetch('/api/agent/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          entityId,
          analysisType,
          trigger: 'manual'
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim() && line.startsWith('data: ')) {
            try {
              const jsonData = line.slice(6); // Remove 'data: ' prefix
              const chunk: StreamChunk = JSON.parse(jsonData);
              processStreamChunk(chunk);
            } catch (e) {
              console.error('Failed to parse chunk:', line, e);
            }
          }
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        setStreamState(prev => ({
          ...prev,
          isRunning: false,
          errors: [...prev.errors, `Streaming error: ${error.message}`],
          endTime: new Date().toISOString()
        }));
      }
    }
  };

  // Process individual stream chunks
  const processStreamChunk = (chunk: StreamChunk) => {
    const timestamp = new Date(chunk.timestamp).toLocaleTimeString();
    let logMessage = '';
    let stepUpdate = '';

    switch (chunk.type) {
      case 'start':
        logMessage = `[${timestamp}] 🚀 ${chunk.data}`;
        stepUpdate = 'Initializing agent workflow';
        break;
        
      case 'mcp_start':
        logMessage = `[${timestamp}] 🔧 ${chunk.data}`;
        stepUpdate = `MCP Tool: ${chunk.tool || 'Unknown'}`;
        break;
        
      case 'mcp_progress':
        logMessage = `[${timestamp}] ⏳ ${chunk.data}`;
        stepUpdate = `MCP Progress: ${chunk.tool || 'Unknown'}`;
        break;
        
      case 'mcp_data':
        logMessage = `[${timestamp}] ✅ ${chunk.message || 'MCP data received'}`;
        stepUpdate = `MCP Result: ${chunk.tool || 'Unknown'}`;
        setStreamState(prev => ({
          ...prev,
          results: [...prev.results, { type: 'mcp', tool: chunk.tool, data: chunk.data }]
        }));
        break;
        
      case 'mcp_complete':
        logMessage = `[${timestamp}] ✅ ${chunk.data}`;
        stepUpdate = 'MCP operations completed';
        break;
        
      case 'claude_start':
        logMessage = `[${timestamp}] 🤖 ${chunk.data}`;
        stepUpdate = 'Claude agent reasoning...';
        break;
        
      case 'claude_chunk':
        logMessage = `[${timestamp}] 💭 ${chunk.data}`;
        stepUpdate = 'Claude analysis in progress';
        break;
        
      case 'claude_complete':
        logMessage = `[${timestamp}] ✅ ${chunk.data}`;
        stepUpdate = 'Claude analysis complete';
        break;
        
      case 'complete':
        logMessage = `[${timestamp}] 🎉 ${chunk.data}`;
        stepUpdate = 'Agent workflow completed';
        setStreamState(prev => ({
          ...prev,
          isRunning: false,
          progress: 100,
          endTime: new Date().toISOString()
        }));
        break;
        
      case 'stream-complete':
        logMessage = `[${timestamp}] ✅ ${chunk.message}`;
        stepUpdate = 'Streaming completed';
        break;
        
      case 'error':
        logMessage = `[${timestamp}] ❌ ${chunk.data}`;
        stepUpdate = 'Error occurred';
        setStreamState(prev => ({
          ...prev,
          errors: [...prev.errors, chunk.data]
        }));
        break;
        
      default:
        logMessage = `[${timestamp}] ${JSON.stringify(chunk)}`;
        stepUpdate = 'Processing...';
    }

    setStreamState(prev => ({
      ...prev,
      logs: [...prev.logs, logMessage],
      currentStep: stepUpdate,
      progress: Math.min(prev.progress + (100 / 12), 100) // Approximate progress
    }));
  };

  // Start streaming
  const startStreaming = () => {
    setStreamState({
      isRunning: true,
      logs: [],
      currentStep: 'Starting agent...',
      progress: 0,
      results: [],
      errors: [],
      startTime: new Date().toISOString()
    });

    abortControllerRef.current = new AbortController();
    handleStreamResponse(abortControllerRef.current);
  };

  // Stop streaming
  const stopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    setStreamState(prev => ({
      ...prev,
      isRunning: false,
      currentStep: 'Stopped',
      endTime: new Date().toISOString()
    }));
  };

  // Clear logs
  const clearLogs = () => {
    setStreamState(prev => ({
      ...prev,
      logs: [],
      results: [],
      errors: [],
      currentStep: 'Ready to start',
      progress: 0
    }));
  };

  const duration = streamState.startTime && streamState.endTime 
    ? Math.round((new Date(streamState.endTime).getTime() - new Date(streamState.startTime).getTime()) / 1000)
    : null;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          🤖 Streaming Claude Agent + MCP Integration
        </h1>
        <p className="text-gray-600">
          Real-time autonomous agent workflows with live MCP tool integration
        </p>
      </div>

      {/* Control Panel */}
      <Card className="p-6 space-y-4">
        <h2 className="text-xl font-semibold">🎛️ Agent Control Panel</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Action Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Action</label>
            <Select value={action} onValueChange={(value: any) => setAction(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="run">🚀 Run Full Workflow</SelectItem>
                <SelectItem value="analyze-entity">🔍 Analyze Entity</SelectItem>
                <SelectItem value="daily-scan">📅 Daily RFP Scan</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Entity ID (for entity analysis) */}
          {action === 'analyze-entity' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Entity ID</label>
              <input
                type="text"
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter entity ID (e.g., 197)"
              />
            </div>
          )}

          {/* Analysis Type */}
          {action === 'analyze-entity' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Analysis Type</label>
              <Select value={analysisType} onValueChange={(value: any) => setAnalysisType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quick">⚡ Quick Analysis</SelectItem>
                  <SelectItem value="comprehensive">🔬 Comprehensive Analysis</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button 
            onClick={startStreaming}
            disabled={streamState.isRunning}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            {streamState.isRunning ? '⏳ Running...' : '🚀 Start Agent'}
          </Button>
          
          {streamState.isRunning && (
            <Button 
              onClick={stopStreaming}
              variant="outline"
              className="border-red-500 text-red-500 hover:bg-red-50"
            >
              ⏹️ Stop
            </Button>
          )}
          
          <Button 
            onClick={clearLogs}
            variant="outline"
            disabled={streamState.isRunning}
          >
            🗑️ Clear
          </Button>
        </div>
      </Card>

      {/* Status Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-sm text-gray-600 mb-2">Current Status</div>
          <div className="font-semibold">{streamState.currentStep}</div>
          {streamState.isRunning && (
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${streamState.progress}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">{streamState.progress.toFixed(0)}%</div>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="text-sm text-gray-600 mb-2">Results</div>
          <div className="text-2xl font-bold text-green-600">{streamState.results.length}</div>
          <div className="text-xs text-gray-500">
            {streamState.results.filter(r => r.type === 'mcp').length} MCP calls
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm text-gray-600 mb-2">Duration</div>
          <div className="font-semibold">
            {duration !== null ? `${duration}s` : 'N/A'}
          </div>
          {streamState.errors.length > 0 && (
            <div className="text-xs text-red-500 mt-1">
              {streamState.errors.length} errors
            </div>
          )}
        </Card>
      </div>

      {/* Live Logs */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">📡 Live Agent Logs</h3>
          <Badge variant={streamState.isRunning ? "default" : "secondary"}>
            {streamState.isRunning ? "🔴 LIVE" : "⚫ IDLE"}
          </Badge>
        </div>
        
        <div 
          ref={logsRef}
          className="bg-black text-green-400 p-4 rounded-lg h-96 overflow-auto font-mono text-sm space-y-1"
        >
          {streamState.logs.length === 0 ? (
            <div className="text-gray-500">Waiting for agent to start...</div>
          ) : (
            streamState.logs.map((log, index) => (
              <div key={index} className="whitespace-pre-wrap break-words">
                {log}
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Results Summary */}
      {streamState.results.length > 0 && (
        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-4">📊 Results Summary</h3>
          <div className="space-y-4">
            {streamState.results.map((result, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">{result.tool}</Badge>
                  <Badge variant="outline">{result.type.toUpperCase()}</Badge>
                </div>
                <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export default StreamingAgentDashboard;