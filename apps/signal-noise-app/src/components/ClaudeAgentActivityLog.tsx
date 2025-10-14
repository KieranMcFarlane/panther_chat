'use client';

import { useEffect, useRef, useState } from 'react';

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'system' | 'user' | 'assistant' | 'tool' | 'error' | 'mcp' | 'result';
  message: string;
  details?: any;
  sessionId?: string;
  toolName?: string;
  duration?: number;
}

interface ClaudeAgentActivityLogProps {
  sessionId?: string;
  maxHeight?: string;
  showTimestamp?: boolean;
  autoScroll?: boolean;
}

export default function ClaudeAgentActivityLog({ 
  sessionId = 'default',
  maxHeight = '60vh',
  showTimestamp = true,
  autoScroll = true 
}: ClaudeAgentActivityLogProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const logContainerRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Connect to Claude Agent SDK activity stream
  useEffect(() => {
    const connectToActivityStream = () => {
      setConnectionStatus('connecting');
      
      // Build URL for activity stream
      const params = new URLSearchParams({
        session_id: sessionId,
        stream_type: 'claude-agent-activity'
      });
      
      const eventSource = new EventSource(`/api/claude-agent/activity?${params}`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setConnectionStatus('connected');
        setIsConnected(true);
        // Add initial connection message but make it subtle
        addLog({
          id: `conn-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'system',
          message: '🔗 Claude Agent SDK connected',
          sessionId
        });
      };

      eventSource.onmessage = (event) => {
        try {
          // Skip empty or invalid messages
          if (!event.data || event.data.trim() === '') {
            return;
          }
          
          const data = JSON.parse(event.data);
          
          // Validate parsed data
          if (!data || typeof data !== 'object') {
            console.warn('Invalid message format received:', event.data);
            return;
          }
          
          switch (data.type) {
            case 'sdk_message':
              handleSDKMessage(data);
              break;
              
            case 'tool_execution':
              handleToolExecution(data);
              break;
              
            case 'mcp_activity':
              handleMCPActivity(data);
              break;
              
            case 'session_event':
              handleSessionEvent(data);
              break;
              
            case 'error':
              handleError(data);
              break;
              
            default:
              handleGenericMessage(data);
          }
        } catch (error) {
          console.error('Failed to parse activity stream message:', error);
          console.error('Raw message data:', event.data);
          
          addLog({
            id: `parse-error-${Date.now()}`,
            timestamp: new Date().toISOString(),
            type: 'error',
            message: `⚠️ Failed to parse stream message: ${error.message}`,
            details: { 
              rawMessage: event.data,
              errorMessage: error.message,
              errorStack: error.stack
            }
          });
        }
      };

      eventSource.onerror = () => {
        setConnectionStatus('error');
        setIsConnected(false);
        addLog({
          id: `conn-error-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'error',
          message: '🔴 Connection to Claude Agent SDK lost'
        });
      };
    };

    connectToActivityStream();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [sessionId]);

  const addLog = (entry: LogEntry) => {
    setLogs(prev => [...prev.slice(-500), entry]); // Keep last 500 logs
  };

  const handleSDKMessage = (data: any) => {
    // The actual message is in data.data, not data.message
    const message = data.data;
    
    // Validate message structure
    if (!message || typeof message !== 'object') {
      console.warn('Invalid SDK message structure:', data);
      return;
    }
    
    switch (message.type) {
      case 'system':
        addLog({
          id: `sys-${message.uuid || Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'system',
          message: `🔧 ${message.subtype === 'init' ? 'System Initialization' : 'System Event'}`,
          details: {
            tools: message.tools,
            mcpServers: message.mcp_servers,
            model: message.model,
            permissionMode: message.permissionMode
          },
          sessionId: message.session_id
        });
        break;

      case 'assistant':
        addLog({
          id: `ast-${message.uuid || Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'assistant',
          message: `🤖 Assistant Response`,
          details: {
            contentLength: message.message.content?.length || 0,
            model: message.message.model
          },
          sessionId: message.session_id
        });
        break;

      case 'user':
        addLog({
          id: `usr-${message.uuid || Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'user',
          message: `👤 User Input`,
          details: {
            contentLength: message.message.content?.length || 0
          },
          sessionId: message.session_id
        });
        break;

      case 'result':
        const isSuccess = message.subtype === 'success';
        addLog({
          id: `res-${message.uuid || Date.now()}`,
          timestamp: new Date().toISOString(),
          type: isSuccess ? 'result' : 'error',
          message: isSuccess ? 
            `✅ Query Completed (${message.duration_ms}ms)` : 
            `❌ Query Failed (${message.duration_ms}ms)`,
          details: {
            duration: message.duration_ms,
            turns: message.num_turns,
            cost: message.total_cost_usd,
            usage: message.usage,
            isError: message.is_error
          },
          sessionId: message.session_id,
          duration: message.duration_ms
        });
        break;

      default:
        addLog({
          id: `unk-${message.uuid || Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'system',
          message: `📝 Unknown message type: ${message.type}`,
          details: message
        });
    }
  };

  const handleToolExecution = (data: any) => {
    const { toolName, action, input, output, duration, error } = data;
    
    addLog({
      id: `tool-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: error ? 'error' : 'tool',
      message: `🔨 ${toolName}: ${action}`,
      details: {
        input,
        output: error ? null : output,
        duration,
        error
      },
      toolName,
      duration
    });
  };

  const handleMCPActivity = (data: any) => {
    const { server, action, tool, status } = data;
    
    addLog({
      id: `mcp-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'mcp',
      message: `🔌 MCP ${server}: ${action}`,
      details: {
        tool,
        status
      }
    });
  };

  const handleSessionEvent = (data: any) => {
    const { event, reason } = data;
    
    // Filter out all system/connection messages to reduce noise
    const filteredEvents = [
      'heartbeat', 
      'connected', 
      'disconnected', 
      'history_loaded',
      'connection',
      'init',
      undefined,
      null,
      ''
    ];
    
    // Also filter out events that don't exist or are falsy
    if (!event || filteredEvents.includes(event)) {
      // Don't add system messages as log entries - just update connection status silently
      return;
    }
    
    // Only log meaningful session events
    addLog({
      id: `sess-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'system',
      message: `📋 Session: ${event}${reason ? ` (${reason})` : ''}`,
      details: data
    });
  };

  const handleError = (data: any) => {
    const { error, context } = data;
    
    addLog({
      id: `err-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'error',
      message: `❌ Error: ${error}`,
      details: context
    });
  };

  const handleGenericMessage = (data: any) => {
    // Filter out generic system messages as well
    if (data.type === 'session_event' || data.message?.includes('heartbeat') || data.message?.includes('connected')) {
      return;
    }
    
    addLog({
      id: `gen-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'system',
      message: `📄 ${data.message || 'Unknown event'}`,
      details: data
    });
  };

  const getLogIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'system': return '🔧';
      case 'user': return '👤';
      case 'assistant': return '🤖';
      case 'tool': return '🔨';
      case 'mcp': return '🔌';
      case 'result': return '✅';
      case 'error': return '❌';
      default: return '📄';
    }
  };

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'system': return 'text-blue-400';
      case 'user': return 'text-green-400';
      case 'assistant': return 'text-purple-400';
      case 'tool': return 'text-yellow-400';
      case 'mcp': return 'text-cyan-400';
      case 'result': return 'text-green-300';
      case 'error': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const exportLogs = () => {
    const logText = logs.map(log => 
      `[${formatTimestamp(log.timestamp)}] ${getLogIcon(log.type)} ${log.message}`
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `claude-agent-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' :
              connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
              connectionStatus === 'error' ? 'bg-red-500' : 'bg-gray-500'
            }`} />
            <span className="text-sm text-gray-300">
              Claude Agent SDK Activity
            </span>
            <span className="text-xs text-gray-500">
              ({logs.length} entries)
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={clearLogs}
              className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
            >
              Clear
            </button>
            <button
              onClick={exportLogs}
              className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
            >
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Log Container */}
      <div 
        ref={logContainerRef}
        className="flex-1 overflow-y-auto bg-black p-4 font-mono text-sm"
        style={{ maxHeight }}
      >
        {logs.length === 0 ? (
          <div className="text-gray-600 text-center py-8">
            {connectionStatus === 'connecting' ? (
              <>
                <div className="animate-spin inline-block w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full mr-2"></div>
                Connecting to Claude Agent SDK...
              </>
            ) : connectionStatus === 'error' ? (
              <>
                ❌ Failed to connect to Claude Agent SDK
                <div className="text-xs mt-2">
                  Make sure the Claude Agent SDK is running and accessible
                </div>
              </>
            ) : (
              <>
                📡 Waiting for Claude Agent SDK activity...
                <div className="text-xs mt-2">
                  Activity will appear here when you interact with the AI assistant
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start space-x-2 group">
                <span className={getLogColor(log.type)}>
                  {getLogIcon(log.type)}
                </span>
                
                {showTimestamp && (
                  <span className="text-gray-600 text-xs">
                    [{formatTimestamp(log.timestamp)}]
                  </span>
                )}
                
                <div className="flex-1">
                  <span className={`${getLogColor(log.type)} break-words`}>
                    {log.message}
                  </span>
                  
                  {log.duration && (
                    <span className="text-gray-600 text-xs ml-2">
                      ({log.duration}ms)
                    </span>
                  )}
                  
                  {log.toolName && (
                    <span className="text-gray-600 text-xs ml-2">
                      [{log.toolName}]
                    </span>
                  )}
                  
                  {/* Expandable details */}
                  {log.details && (
                    <details className="group mt-1">
                      <summary className="text-gray-600 text-xs cursor-pointer hover:text-gray-400">
                        Details
                      </summary>
                      <pre className="text-gray-700 text-xs mt-1 bg-gray-900 rounded p-2 overflow-x-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}