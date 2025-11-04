/**
 * 🎬 A2A System Streaming Dashboard
 * Real-time A2A autonomous system monitoring with MCP infrastructure
 * Uses the same streaming infrastructure as the streaming agent dashboard
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface StreamChunk {
  type: 'start' | 'mcp_start' | 'mcp_progress' | 'mcp_data' | 'mcp_complete' | 'agent_status' | 'agent_detail' | 'agent_start' | 'agent_analysis' | 'analysis_complete' | 'monitoring_complete' | 'error' | 'complete' | 'stream-complete';
  data: any;
  timestamp: string;
  tool?: string;
  server?: string;
  message?: string;
  agentId?: string;
  opportunity?: string;
  organization?: string;
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
  mcpServers: number;
  mcpTools: number;
  agents: number;
}

function A2ASystemStreamingDashboard() {
  const [action, setAction] = useState<'start_discovery' | 'process_opportunity' | 'monitor_agents'>('start_discovery');
  const [testOpportunity, setTestOpportunity] = useState({
    title: 'Premier League Digital Analytics Platform RFP',
    organization: 'Premier League',
    description: 'Seeking advanced analytics platform for fan engagement and performance metrics'
  });
  const [streamState, setStreamState] = useState<StreamState>({
    isRunning: false,
    logs: [],
    currentStep: 'Ready to start A2A system monitoring',
    progress: 0,
    results: [],
    errors: [],
    mcpServers: 0,
    mcpTools: 0,
    agents: 0
  });
  const [isClient, setIsClient] = useState(false);

  const logsRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [streamState.logs]);

  // Prevent hydration mismatch
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Handle streaming response from A2A system
  const handleA2AStreamResponse = async (controller: AbortController) => {
    try {
      const response = await fetch('/api/a2a-system/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          data: action === 'process_opportunity' ? { opportunity: testOpportunity } : undefined
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
              processA2AStreamChunk(chunk);
            } catch (e) {
              console.error('Failed to parse A2A chunk:', line, e);
              // Add parsing error to logs
              const errorMessage = `Failed to parse stream data: ${e.message}`;
              setStreamState(prev => ({
                ...prev,
                logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] ❌ ${errorMessage}`],
                errors: [...prev.errors, errorMessage]
              }));
            }
          }
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        setStreamState(prev => ({
          ...prev,
          isRunning: false,
          errors: [...prev.errors, `A2A streaming error: ${error.message}`],
          endTime: new Date().toISOString()
        }));
      }
    }
  };

  // Process individual A2A stream chunks
  const processA2AStreamChunk = (chunk: StreamChunk) => {
    const timestamp = chunk.timestamp ? 
      new Date(chunk.timestamp).toLocaleTimeString() : 
      new Date().toLocaleTimeString();
    let logMessage = '';
    let stepUpdate = '';

    switch (chunk.type) {
      case 'start':
        logMessage = `[${timestamp}] 🚀 ${chunk.data}`;
        stepUpdate = 'Initializing A2A system workflow';
        break;
        
      case 'mcp_start':
        logMessage = `[${timestamp}] 🔧 ${chunk.data}`;
        stepUpdate = `MCP Infrastructure: ${chunk.tool || 'Unknown'}`;
        // Extract server count from message if available
        const serverMatch = chunk.data?.match(/(\d+) servers/);
        if (serverMatch) {
          setStreamState(prev => ({
            ...prev,
            mcpServers: parseInt(serverMatch[1])
          }));
        }
        break;
        
      case 'mcp_progress':
        logMessage = `[${timestamp}] ⏳ ${chunk.data}`;
        stepUpdate = `MCP Progress: ${chunk.tool || 'Unknown'}`;
        break;
        
      case 'mcp_data':
        logMessage = `[${timestamp}] ✅ ${chunk.message || chunk.data}`;
        stepUpdate = `MCP Result: ${chunk.tool || 'Unknown'}`;
        setStreamState(prev => ({
          ...prev,
          results: [...prev.results, { type: 'mcp', tool: chunk.tool, server: chunk.server, data: chunk.data }]
        }));
        break;
        
      case 'mcp_complete':
        logMessage = `[${timestamp}] ✅ ${chunk.data}`;
        stepUpdate = 'MCP operations completed';
        // Extract tool count from message if available
        const toolMatch = chunk.data?.match(/(\d+) tools/);
        if (toolMatch) {
          setStreamState(prev => ({
            ...prev,
            mcpTools: parseInt(toolMatch[1])
          }));
        }
        break;
        
      case 'agent_status':
        logMessage = `[${timestamp}] 📊 ${chunk.data}`;
        stepUpdate = `System Status: ${chunk.agentCount} agents, ${chunk.activeContexts} contexts`;
        setStreamState(prev => ({
          ...prev,
          agents: chunk.agentCount || 0
        }));
        break;
        
      case 'agent_detail':
        logMessage = `[${timestamp}] 🤖 ${chunk.data}`;
        stepUpdate = `Agent: ${chunk.agentId} (${chunk.agentType})`;
        break;
        
      case 'agent_start':
      case 'agent_analysis':
        logMessage = `[${timestamp}] 🤖 ${chunk.data}`;
        stepUpdate = `Agent Activity: ${chunk.agentId}`;
        break;
        
      case 'analysis_complete':
      case 'monitoring_complete':
        logMessage = `[${timestamp}] ✅ ${chunk.data}`;
        stepUpdate = 'Monitoring completed';
        break;
        
      case 'stream-complete':
        logMessage = `[${timestamp}] ✅ ${chunk.message}`;
        stepUpdate = 'A2A streaming completed';
        setStreamState(prev => ({
          ...prev,
          isRunning: false,
          progress: 100,
          endTime: new Date().toISOString()
        }));
        break;
        
      case 'error':
        const errorMessage = chunk.data || 'Unknown error occurred';
        logMessage = `[${timestamp}] ❌ ${errorMessage}`;
        stepUpdate = 'Error occurred';
        setStreamState(prev => ({
          ...prev,
          errors: [...prev.errors, errorMessage]
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
      progress: Math.min(prev.progress + (100 / 15), 100) // Approximate progress
    }));
  };

  // Start A2A streaming
  const startA2AStreaming = () => {
    setStreamState({
      isRunning: true,
      logs: [],
      currentStep: 'Starting A2A system...',
      progress: 0,
      results: [],
      errors: [],
      mcpServers: 0,
      mcpTools: 0,
      agents: 0,
      startTime: new Date().toISOString()
    });

    abortControllerRef.current = new AbortController();
    handleA2AStreamResponse(abortControllerRef.current);
  };

  // Stop streaming
  const stopA2AStreaming = () => {
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
      currentStep: 'Ready to start A2A system',
      progress: 0
    }));
  };

  const duration = streamState.startTime && streamState.endTime 
    ? Math.round((new Date(streamState.endTime).getTime() - new Date(streamState.startTime).getTime()) / 1000)
    : null;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
          🤖 A2A System Streaming Dashboard
        </h1>
        <p className="text-gray-600">
          Real-time autonomous agent monitoring with MCP infrastructure integration
        </p>
      </div>

      {/* Control Panel */}
      <Card className="p-6 space-y-4">
        <h2 className="text-xl font-semibold">🎛️ A2A System Control Panel</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Action Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">A2A Action</label>
            <Select value={action} onValueChange={(value: any) => setAction(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="start_discovery">🔍 Start Discovery Workflow</SelectItem>
                <SelectItem value="process_opportunity">🧪 Test Opportunity Processing</SelectItem>
                <SelectItem value="monitor_agents">📊 Monitor Agents</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Test Opportunity Data */}
          {action === 'process_opportunity' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Test Opportunity</label>
              <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded">
                <div><strong>Title:</strong> {testOpportunity.title}</div>
                <div><strong>Organization:</strong> {testOpportunity.organization}</div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button 
            onClick={startA2AStreaming}
            disabled={streamState.isRunning}
            className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
          >
            {streamState.isRunning ? '⏳ Running A2A...' : '🚀 Start A2A System'}
          </Button>
          
          {streamState.isRunning && (
            <Button 
              onClick={stopA2AStreaming}
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-gray-600 mb-2">Current Status</div>
          <div className="font-semibold">{streamState.currentStep}</div>
          {streamState.isRunning && (
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${streamState.progress}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">{streamState.progress.toFixed(0)}%</div>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="text-sm text-gray-600 mb-2">MCP Infrastructure</div>
          <div className="text-2xl font-bold text-blue-600">{streamState.mcpServers}</div>
          <div className="text-xs text-gray-500">
            {streamState.mcpTools} tools {streamState.mcpServers === 0 ? '(Standalone Mode)' : 'available'}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm text-gray-600 mb-2">Active Agents</div>
          <div className="text-2xl font-bold text-green-600">{streamState.agents}</div>
          <div className="text-xs text-gray-500">
            A2A agents running
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
          <h3 className="text-xl font-semibold">📡 Live A2A System Logs</h3>
          <Badge variant={streamState.isRunning ? "default" : "secondary"}>
            {isClient && streamState.isRunning ? "🔴 LIVE" : "⚫ IDLE"}
          </Badge>
        </div>
        
        <div 
          ref={logsRef}
          className="bg-black text-green-400 p-4 rounded-lg h-96 overflow-auto font-mono text-sm space-y-1"
        >
          {streamState.logs.length === 0 ? (
            <div className="text-gray-500">Waiting for A2A system to start...</div>
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
          <h3 className="text-xl font-semibold mb-4">📊 A2A System Results Summary</h3>
          <div className="space-y-4">
            {streamState.results.map((result, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">{result.tool}</Badge>
                  <Badge variant="outline">{result.server}</Badge>
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

export default A2ASystemStreamingDashboard;