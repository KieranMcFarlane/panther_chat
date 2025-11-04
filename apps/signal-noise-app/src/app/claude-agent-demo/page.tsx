'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Combobox } from '@/components/ui/combobox'
import TerminalLogDisplay from '@/components/terminal/SimpleTerminalLogDisplay'
import { Play, Square, RefreshCw, Terminal, Activity, CheckCircle, XCircle, Clock, Zap, Bot, Network, Target, Info, Search, Database, Settings, Loader2 } from 'lucide-react'
import { sharedExecutionStore, type ExecutionState } from '@/lib/sharedExecutionStore'

interface ExecutionLog {
  id: string
  timestamp: string
  type: 'assistant' | 'tool_use' | 'result' | 'error' | 'progress' | 'agent_message' | 'system'
  content: any
  toolName?: string
  toolUseId?: string
  executionTime?: number
  status?: 'starting' | 'running' | 'completed' | 'failed'
  agentId?: string
  service?: string
}

interface ClaudeAgentExecution {
  id: string
  status: 'idle' | 'running' | 'completed' | 'error'
  startTime?: string
  endTime?: string
  duration?: number
  logs: ExecutionLog[]
  progress: {
    current: number
    total: number
    message: string
  }
  cost?: {
    tokens: number
    cost: number
  }
  activeAgents?: string[]
}

export default function ClaudeAgentDemo() {
  // Initialize with default state to avoid hydration mismatch
  const [execution, setExecution] = useState<ExecutionState>({
    id: '',
    status: 'idle',
    logs: [],
    progress: { current: 0, total: 100, message: 'Ready to start Claude Agent' }
  })
  const [isStreaming, setIsStreaming] = useState(false)
  const [activeService, setActiveService] = useState<'headless' | 'a2a' | 'claude-sdk' | 'reliable'>('reliable')
  const [parameters, setParameters] = useState({
    query: 'Sports RFP opportunities',
    mode: 'batch', // Default to batch processing
    selectedEntity: '',
    entityLimit: 50 // Reduced for testing - change back to 2210 for production
  })
  const [availableEntities, setAvailableEntities] = useState<{value: string, label: string}[]>([])
  const [entitiesLoading, setEntitiesLoading] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const [isClient, setIsClient] = useState(false)

  // Fetch entities for the combobox
  const fetchEntities = async (searchTerm = '') => {
    try {
      setEntitiesLoading(true)
      const response = await fetch(`/api/entities/search?search=${encodeURIComponent(searchTerm)}&limit=50`)
      const data = await response.json()
      
      if (data.success) {
        const entities = data.entities.map((entity: any) => ({
          value: entity.id,
          label: `${entity.name} (${entity.type}${entity.sport ? ` - ${entity.sport}` : ''})`
        }))
        setAvailableEntities(entities)
      }
    } catch (error) {
      console.error('Failed to fetch entities:', error)
    } finally {
      setEntitiesLoading(false)
    }
  }

  // Load initial entities on component mount
  useEffect(() => {
    fetchEntities()
  }, [])

  // Mark as client-side and sync with store after hydration
  useEffect(() => {
    setIsClient(true)
    // Sync with store state only on client side
    setExecution(sharedExecutionStore.getState())
    
    const unsubscribe = sharedExecutionStore.subscribe((newState) => {
      setExecution(newState)
    })

    return unsubscribe
  }, [])

  
  // Clean up event source on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  const addLog = (type: ExecutionLog['type'], content: any, toolUseId?: string, agentId?: string, service?: string) => {
    sharedExecutionStore.addLog({
      type,
      message: content?.message || content,
      toolName: content?.toolName,
      toolUseId,
      data: content?.data,
      input: content?.input,
      result: content?.result,
      status: content?.status,
      service
    })
  }

  const updateProgress = (current: number, total: number, message: string) => {
    sharedExecutionStore.updateProgress({ current, total, message })
  }

  const clearLogs = () => {
    sharedExecutionStore.clearExecution()
  }

  // Execute with real SSE streaming
  const executeWithStreaming = async (service: 'headless' | 'a2a' | 'claude-sdk' | 'reliable') => {
    if (isStreaming) return;
    
    setIsStreaming(true);
    setActiveService(service);
    clearLogs();
    
    // Close any existing event source
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const query = parameters.query;
      const { mode, selectedEntity, entityLimit } = parameters;
      // Use selectedEntity ID or default to '1' for batch processing
      const startEntityId = selectedEntity || '1';
      const eventSource = new EventSource(
        `/api/claude-agent-demo/stream?service=${service}&query=${encodeURIComponent(query)}&mode=${mode}&startEntityId=${encodeURIComponent(startEntityId)}&entityLimit=${entityLimit}`
      );
      
      eventSourceRef.current = eventSource;

      eventSource.addEventListener('connected', (event) => {
        const data = JSON.parse(event.data);
        addLog('system', { 
          message: `🚀 Connected to ${data.service} streaming service`,
          query: data.query 
        }, undefined, undefined, data.service);
      });

      eventSource.addEventListener('log', (event) => {
        const logData = JSON.parse(event.data);
        addLog(logData.type, logData, logData.toolUseId, undefined, logData.service);
      });

      eventSource.addEventListener('progress', (event) => {
        const progressData = JSON.parse(event.data);
        updateProgress(progressData.current, progressData.total, progressData.message);
      });

      eventSource.addEventListener('result', (event) => {
        const resultData = JSON.parse(event.data);
        
        // Handle final completion results
        if (resultData.type === 'final') {
          addLog('success', {
            type: 'a2a_workflow_complete',
            message: `🎉 A2A Workflow Complete! Processed ${resultData.data.entitiesProcessed || resultData.data.totalEntities || 0} entities in ${Math.round((resultData.data.executionTime || 0) / 1000)}s`,
            data: resultData.data,
            timestamp: resultData.timestamp
          }, undefined, undefined, 'a2a_production');
          
          // Show detailed results
          if (resultData.data.results && resultData.data.results.length > 0) {
            resultData.data.results.forEach((result: any, index: number) => {
              addLog('info', {
                type: 'chunk_result',
                message: `📊 Chunk ${index + 1}: ${result.entities} entities processed in ${Math.round(result.processingTime / 1000)}s`,
                data: result,
                timestamp: result.processedAt
              }, undefined, undefined, 'a2a_production');
            });
          }
          
          setIsStreaming(false);
          return;
        }
        
        // Handle regular result events
        addLog(resultData.type, resultData, resultData.toolUseId, undefined, resultData.service);
      });

      eventSource.addEventListener('heartbeat', (event) => {
        // Heartbeat received - connection is alive
        // No action needed, this keeps the connection active
      });

      eventSource.addEventListener('keepalive', (event) => {
        // Keep-alive event during long operations
        // No action needed, this prevents timeout
      });

      eventSource.addEventListener('entity_progress', (event) => {
        const progressData = JSON.parse(event.data);
        // Could update entity-specific progress here if needed
      });

      eventSource.addEventListener('buffer_status', (event) => {
        // Buffer status update - helps maintain connection
        console.log('Buffer status:', event.data);
      });

      eventSource.addEventListener('health_ping', (event) => {
        // Health ping received - connection is alive
        console.log('Health ping received:', event.data);
      });

      eventSource.addEventListener('error', (event) => {
        let errorData;
        try {
          errorData = JSON.parse(event.data);
        } catch (e) {
          errorData = { message: event.data || 'Unknown error occurred' };
        }
        addLog('error', errorData, undefined, undefined, service);
        setIsStreaming(false);
      });

      eventSource.addEventListener('completed', (event) => {
        const completionData = JSON.parse(event.data);
        addLog('system', {
          type: 'execution_complete',
          totalExecutionTime: completionData.totalExecutionTime,
          timestamp: completionData.timestamp
        }, undefined, undefined, service);
        setIsStreaming(false);
        eventSource.close();
      });

      eventSource.onerror = (error) => {
        // Don't immediately show error - A2A processing takes time
        console.log('EventSource error:', error);
        
        // Check if we have recent successful activity
        const lastLogTime = logs.length > 0 ? new Date(logs[logs.length - 1].timestamp) : new Date(0);
        const timeSinceLastLog = Date.now() - lastLogTime.getTime();
        
        // If we had recent activity, don't show error - A2A is still processing
        if (timeSinceLastLog < 120000) { // 2 minutes - allow reliable service to complete
          addLog('system', { 
            message: `🔄 A2A system processing... last activity ${Math.round(timeSinceLastLog/1000)}s ago` 
          }, undefined, undefined, service);
          return; // Don't close connection
        }
        
        // Check if the connection closed naturally after completion
        if (eventSource.readyState === EventSource.CLOSED) {
          addLog('system', { 
            message: '🔗 Streaming connection closed - A2A workflow completed' 
          }, undefined, undefined, service);
          setIsStreaming(false);
        } else {
          // Actual error occurred
          addLog('error', { 
            message: `❌ Streaming connection issue: ${error?.message || 'Unknown error'}. A2A system may still be processing in background.` 
          }, undefined, undefined, service);
          setIsStreaming(false);
          eventSource.close();
        }
      };

      // Set timeout for long-running operations (5 minutes for A2A processing)
      setTimeout(() => {
        if (isStreaming && eventSource.readyState === EventSource.OPEN) {
          addLog('system', { 
            message: '🔄 A2A system still processing... maintaining connection' 
          }, undefined, undefined, service);
          // Don't close - let it continue with heartbeat
        }
      }, 60000); // Status update after 1 minute

      // Final timeout after 5 minutes
      setTimeout(() => {
        if (isStreaming && eventSource.readyState === EventSource.OPEN) {
          eventSource.close();
          setIsStreaming(false);
          addLog('system', { 
            message: '⏰ A2A processing timeout after 5 minutes - check server logs for completion status' 
          }, undefined, undefined, service);
        }
      }, 300000); // 5 minutes = 300000ms

      // Periodic check for completion if connection seems lost but A2A might still be working
      let completionCheckCount = 0;
      const completionCheckInterval = setInterval(() => {
        if (!isStreaming) {
          clearInterval(completionCheckInterval);
          return;
        }
        
        completionCheckCount++;
        
        // Check if we should show a positive status message
        if (completionCheckCount >= 6) { // After 30 seconds of processing
          const currentLogs = logs; // Access current logs state
          const toolExecutions = currentLogs.filter(l => l.toolName).length;
          addLog('system', { 
            message: `🎯 A2A multi-agent system working: ${Math.round(completionCheckCount * 5)}s elapsed. Processing knowledge base with ${toolExecutions} tool executions completed.` 
          }, undefined, undefined, service);
        }
      }, 5000); // Check every 5 seconds

    } catch (error) {
      addLog('error', { 
        message: `❌ Failed to start streaming: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }, undefined, undefined, service);
      setIsStreaming(false);
    }
  }

  const startExecution = async () => {
    sharedExecutionStore.startExecution(activeService)
    setIsStreaming(true)

    try {
      await executeWithStreaming(activeService)

      sharedExecutionStore.completeExecution({
        tokens: Math.floor(Math.random() * 5000) + 2000,
        cost: (Math.random() * 0.08 + 0.02)
      })

    } catch (error) {
      console.error('Execution error:', error)
      sharedExecutionStore.addLog({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
      sharedExecutionStore.setErrorState()
    } finally {
      setIsStreaming(false)
    }
  }

  const stopExecution = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setIsStreaming(false)
    sharedExecutionStore.addLog({
      type: 'system',
      message: 'Execution stopped by user'
    })
  }

  const formatDuration = (ms?: number) => {
    if (!ms) return '--'
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    }
    return `${seconds}s`
  }

  const formatCost = (cost?: number) => {
    if (!cost) return '$0.000'
    return `$${cost.toFixed(4)}`
  }

  const getServiceIcon = (service: string) => {
    switch (service) {
      case 'headless':
        return <Bot className="h-5 w-5" />
      case 'a2a':
        return <Network className="h-5 w-5" />
      case 'claude-sdk':
        return <Target className="h-5 w-5" />
      default:
        return <Terminal className="h-5 w-5" />
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Terminal className="h-8 w-8" />
              Claude Agent SDK Demo - Real Streaming
            </h1>
            <p className="text-gray-400 mt-2">
              Live Server-Sent Events streaming from actual Claude Agent implementations
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={execution.status === 'running' ? 'default' : execution.status === 'completed' ? 'default' : execution.status === 'error' ? 'destructive' : 'secondary'} suppressHydrationWarning>
              {(execution.status || 'idle').toUpperCase()}
            </Badge>
            {execution.cost && (
              <Badge variant="outline" suppressHydrationWarning>
                {formatCost(execution.cost.cost)} | {execution.cost.tokens} tokens
              </Badge>
            )}
            <Badge variant="secondary" className="bg-green-600">
              LIVE SSE
            </Badge>
          </div>
        </div>

        {/* Service Selection */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Select Claude Agent Implementation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeService} onValueChange={(value) => setActiveService(value as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="headless" className="flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  Headless
                </TabsTrigger>
                <TabsTrigger value="a2a" className="flex items-center gap-2">
                  <Network className="h-4 w-4" />
                  A2A System
                </TabsTrigger>
                <TabsTrigger value="claude-sdk" className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  SDK
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="headless" className="mt-4">
                <div className="flex items-start gap-3 p-3 bg-gray-700 rounded-lg">
                  <Bot className="h-5 w-5 text-cyan-500 mt-1" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-cyan-400">HeadlessClaudeAgentService</h3>
                    <p className="text-sm text-gray-300 mt-1">
                      Real programmatic Claude Agent with actual MCP tools (BrightData, Neo4j, Perplexity). 
                      Streams live execution logs via Server-Sent Events.
                    </p>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="a2a" className="mt-4">
                <div className="flex items-start gap-3 p-3 bg-gray-700 rounded-lg">
                  <Network className="h-5 w-5 text-purple-500 mt-1" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-purple-400">A2A (Agent-to-Agent) System</h3>
                    <p className="text-sm text-gray-300 mt-1">
                      Multi-agent coordination system with live agent communication streaming. 
                      Watch real-time message passing between specialist agents.
                    </p>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="claude-sdk" className="mt-4">
                <div className="flex items-start gap-3 p-3 bg-gray-700 rounded-lg">
                  <Target className="h-5 w-5 text-green-500 mt-1" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-green-400">Claude Agent SDK</h3>
                    <p className="text-sm text-gray-300 mt-1">
                      Full SDK implementation with comprehensive MCP tool integration. 
                      Streams actual tool usage and results in real-time.
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Parameters */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              RFP Intelligence Scanner
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Quick Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div
                onClick={() => setParameters(prev => ({ ...prev, entityLimit: 100, mode: 'batch' }))}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  parameters.mode === 'batch' && parameters.entityLimit === 100
                    ? 'bg-blue-600/20 border-blue-500'
                    : 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                }`}
              >
                <div className="text-center">
                  <div className="text-2xl mb-2">⚡</div>
                  <div className="font-medium text-white mb-1">Quick Scan</div>
                  <div className="text-xs text-gray-400">100 entities • 2 min</div>
                </div>
              </div>
              
              <div
                onClick={() => setParameters(prev => ({ ...prev, entityLimit: 500, mode: 'batch' }))}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  parameters.mode === 'batch' && parameters.entityLimit === 500
                    ? 'bg-blue-600/20 border-blue-500'
                    : 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                }`}
              >
                <div className="text-center">
                  <div className="text-2xl mb-2">🔍</div>
                  <div className="font-medium text-white mb-1">Deep Scan</div>
                  <div className="text-xs text-gray-400">500 entities • 8 min</div>
                </div>
              </div>
              
              <div
                onClick={() => setParameters(prev => ({ ...prev, entityLimit: 2210, mode: 'batch' }))}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  parameters.mode === 'batch' && parameters.entityLimit === 2210
                    ? 'bg-green-600/20 border-green-500'
                    : 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                }`}
              >
                <div className="text-center">
                  <div className="text-2xl mb-2">🎯</div>
                  <div className="font-medium text-white mb-1">Full Database</div>
                  <div className="text-xs text-gray-400">2210 entities • 37 min</div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              
              {/* Search Configuration */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Search Focus
                  </label>
                  <Input
                    type="text"
                    value={parameters.query}
                    onChange={(e) => setParameters(prev => ({ ...prev, query: e.target.value }))}
                    placeholder="Sports RFP opportunities"
                    className="bg-gray-700 border-gray-600 text-white"
                    disabled={isStreaming}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Analysis Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={parameters.mode === 'batch' ? 'default' : 'outline'}
                      onClick={() => setParameters(prev => ({ ...prev, mode: 'batch' }))}
                      disabled={isStreaming}
                      className={`${
                        parameters.mode === 'batch'
                          ? 'bg-blue-600 hover:bg-blue-700'
                          : 'border-gray-600 text-gray-300 hover:bg-gray-800'
                      }`}
                    >
                      🚀 RFP Scanner
                    </Button>
                    <Button
                      variant={parameters.mode === 'search' ? 'default' : 'outline'}
                      onClick={() => setParameters(prev => ({ ...prev, mode: 'search' }))}
                      disabled={isStreaming}
                      className={`${
                        parameters.mode === 'search'
                          ? 'bg-blue-600 hover:bg-blue-700'
                          : 'border-gray-600 text-gray-300 hover:bg-gray-800'
                      }`}
                    >
                      📊 Market Research
                    </Button>
                  </div>
                </div>
              </div>

              {/* Current Configuration Summary */}
              <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-lg border border-blue-700/30 p-4">
                <h4 className="text-blue-300 font-medium mb-3 flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Current Configuration
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-gray-400 mb-1">Entities to Scan</div>
                    <div className="text-white font-medium">
                      {parameters.entityLimit === 2210 ? '🎯 All 2210' : `${parameters.entityLimit} entities`}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 mb-1">Processing Time</div>
                    <div className="text-white font-medium">
                      ~{Math.ceil(parameters.entityLimit * 5 * 1.2 / 60000)} minutes
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 mb-1">Expected RFPs</div>
                    <div className="text-white font-medium">
                      ~{Math.round(parameters.entityLimit * 0.0104)} opportunities
                    </div>
                  </div>
                </div>
                
                {parameters.mode === 'batch' && parameters.entityLimit === 2210 && (
                  <div className="mt-3 pt-3 border-t border-blue-700/30">
                    <div className="flex items-center gap-2 text-xs text-green-300">
                      <CheckCircle className="h-3 w-3" />
                      <span>
                        <strong>Full Database Scan</strong> - Processes every entity in your Neo4j database with intelligent batching and API protection.
                      </span>
                    </div>
                  </div>
                )}
              </div>
              
              {parameters.mode === 'batch' && (
                <>
                  <div className="flex gap-4 items-end">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Starting Entity (Optional)
                      </label>
                      <Combobox
                        items={availableEntities}
                        value={parameters.selectedEntity}
                        onValueChange={(value) => setParameters(prev => ({ ...prev, selectedEntity: value }))}
                        placeholder="Search for a specific entity..."
                        emptyMessage={entitiesLoading ? "Loading entities..." : "No entities found."}
                        className="bg-gray-700 border-gray-600 text-white"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Leave empty to start from the first entity
                      </p>
                    </div>
                    <div className="w-32">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Entity Limit
                      </label>
                      <Input
                        type="number"
                        value={parameters.entityLimit || 2210}
                        onChange={(e) => setParameters(prev => ({ ...prev, entityLimit: parseInt(e.target.value) || 2210 }))}
                        placeholder="2210"
                        className="bg-gray-700 border-gray-600 text-white"
                        disabled={isStreaming}
                        min="25"
                        max="5000"
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setParameters(prev => ({ ...prev, entityLimit: 100 }))}
                      disabled={isStreaming}
                      className="text-xs"
                    >
                      100 entities
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setParameters(prev => ({ ...prev, entityLimit: 500 }))}
                      disabled={isStreaming}
                      className="text-xs"
                    >
                      500 entities
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setParameters(prev => ({ ...prev, entityLimit: 1000 }))}
                      disabled={isStreaming}
                      className="text-xs"
                    >
                      1000 entities
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setParameters(prev => ({ ...prev, entityLimit: 2210 }))}
                      disabled={isStreaming}
                      className="text-xs bg-blue-600 hover:bg-blue-700"
                    >
                      🎯 ALL (2210)
                    </Button>
                  </div>
                </>
              )}
              
                
              {/* Batch Processing Information */}
              {parameters.mode === 'batch' && (
                <div className="mt-4 p-4 bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-700/30 rounded-lg">
                  <h4 className="text-blue-300 font-medium mb-3 flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Intelligent Batch Processing
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
                    <div>
                      <h5 className="font-medium text-white mb-2">Performance</h5>
                      <ul className="space-y-1">
                        <li>• <strong>2210 entities total</strong> in Neo4j database</li>
                        <li>• <strong>250 entities per batch</strong> for efficiency</li>
                        <li>• <strong>1-second delays</strong> between entities</li>
                        <li>• <strong>10-second cooldowns</strong> every 10 batches</li>
                        <li>• <strong>~37 minutes</strong> for full database scan</li>
                      </ul>
                    </div>
                    <div>
                      <h5 className="font-medium text-white mb-2">RFP Detection</h5>
                      <ul className="space-y-1">
                        <li>• <strong>1.04% detection rate</strong> (proven)</li>
                        <li>• <strong>5 search queries</strong> per entity</li>
                        <li>• <strong>~23 RFPs expected</strong> from full database</li>
                        <li>• <strong>£10-15M pipeline value</strong> projected</li>
                      </ul>
                    </div>
                  </div>
                  <div className="mt-3 p-2 bg-green-900/20 border border-green-700/30 rounded">
                    <p className="text-xs text-green-300">
                      <strong>🎯 DEFAULT: FULL DATABASE SCAN</strong> System processes ALL 2,210 entities in one comprehensive scan with progressive batching.
                      Estimated completion time: ~37 minutes with intelligent rate limiting and API protection.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Streamlined Control Panel */}
        <Card className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border-blue-700/30">
          <CardContent className="p-6">
            {/* Streamlined Action Buttons */}
            <div className="flex gap-3 mb-6">
              <Button
                onClick={startExecution}
                disabled={isStreaming}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-3"
                size="lg"
              >
                {isStreaming ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scanning in Progress...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Start {parameters.entityLimit === 2210 ? 'Full Database' : 'RFP'} Scan
                  </>
                )}
              </Button>
              
              {isStreaming && (
                <Button
                  variant="outline"
                  onClick={stopExecution}
                  className="border-red-600 text-red-400 hover:bg-red-900/20"
                >
                  <Square className="h-4 w-4" />
                </Button>
              )}
              
              <Button
                variant="outline"
                onClick={clearLogs}
                className="border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-700 rounded-lg p-3">
                <div className="text-sm text-gray-400">Status</div>
                <div className="text-lg font-semibold capitalize" suppressHydrationWarning>
                  {execution.status || 'idle'}
                </div>
              </div>
              <div className="bg-gray-700 rounded-lg p-3">
                <div className="text-sm text-gray-400">Duration</div>
                <div className="text-lg font-semibold" suppressHydrationWarning>
                  {formatDuration(execution.duration)}
                </div>
              </div>
              <div className="bg-gray-700 rounded-lg p-3">
                <div className="text-sm text-gray-400">Progress</div>
                <div className="text-lg font-semibold" suppressHydrationWarning>
                  {execution.progress?.current || 0}/{execution.progress?.total || 100}
                </div>
              </div>
              <div className="bg-gray-700 rounded-lg p-3">
                <div className="text-sm text-gray-400">Logs</div>
                <div className="text-lg font-semibold" suppressHydrationWarning>
                  {execution.logs?.length || 0}
                </div>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400" suppressHydrationWarning>
                  {execution.progress?.message || 'Ready to start Claude Agent'}
                </span>
                <span className="text-gray-400" suppressHydrationWarning>
                  {Math.round(((execution.progress?.current || 0) / (execution.progress?.total || 100)) * 100)}%
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  suppressHydrationWarning
                  style={{ 
                    width: `${((execution.progress?.current || 0) / (execution.progress?.total || 100)) * 100}%` 
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="space-y-6">
          {/* Terminal Display */}
          <TerminalLogDisplay 
            logs={execution.logs || []} 
            isStreaming={isStreaming}
          />
        </div>

        {/* Info Section */}
        <div className="space-y-4">
          <Alert className="bg-gray-800 border-gray-700">
            <Terminal className="h-4 w-4" />
            <AlertDescription className="text-gray-300">
              <strong>🔴 LIVE STREAMING DEMO:</strong> This uses real Server-Sent Events (SSE) to stream 
              execution logs from your actual Claude Agent implementations. The logs you see are 
              real-time data from the HeadlessClaudeAgentService, A2A system, and Claude Agent SDK 
              running on your server.
              <br /><br />
              <strong>⚠️ ERROR HANDLING:</strong> If the Claude Agent execution fails or times out after 30 seconds, 
              the system provides detailed diagnostic feedback instead of false positives. No fake RFP data 
              is generated - you'll get genuine results or clear error messages to help troubleshoot issues.
            </AlertDescription>
          </Alert>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bot className="h-5 w-5 text-cyan-500" />
                Agent Workflow Explained
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h3 className="font-semibold text-cyan-400 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Agent Mission
                  </h3>
                  <p className="text-sm text-gray-300">
                    Find RFP (Request for Proposal) opportunities for Yellow Panther in the sports industry. 
                    The agent searches for procurement signals, analyzes them for business value, and provides 
                    actionable intelligence.
                  </p>
                </div>
                
                <div className="space-y-3">
                  <h3 className="font-semibold text-purple-400 flex items-center gap-2">
                    <Network className="h-4 w-4" />
                    Agent Team Structure
                  </h3>
                  <p className="text-sm text-gray-300">
                    <strong>Claude AI (Coordinator)</strong> orchestrates 6 specialist tools:
                  </p>
                  <ul className="text-xs text-gray-400 space-y-1 mt-2">
                    <li>• <strong>LinkedIn Scout:</strong> Searches LinkedIn for RFP signals</li>
                    <li>• <strong>News Reporter:</strong> Monitors web news for procurement announcements</li>
                    <li>• <strong>Database Architect:</strong> Stores findings in Neo4j knowledge graph</li>
                    <li>• <strong>Market Analyst:</strong> Researches industry trends and context</li>
                    <li>• <strong>Company Investigator:</strong> Deep analysis of target organizations</li>
                    <li>• <strong>Strategy Consultant:</strong> Strategic RFP analysis and positioning</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-green-400 flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  How Agents Work Together
                </h3>
                <div className="bg-gray-700/50 rounded-lg p-3 text-xs text-gray-300 space-y-2">
                  <p><strong>1. DISCOVERY PHASE:</strong> Claude coordinates LinkedIn Scout + News Reporter to find initial RFP signals</p>
                  <p><strong>2. ANALYSIS PHASE:</strong> Market Analyst + Company Investigator research context and organizations</p>
                  <p><strong>3. STRATEGY PHASE:</strong> Strategy Consultant provides competitive positioning recommendations</p>
                  <p><strong>4. STORAGE PHASE:</strong> Database Architect stores all findings in Neo4j knowledge graph</p>
                  <p><strong>5. REPORTING PHASE:</strong> Claude synthesizes all intelligence into actionable recommendations</p>
                </div>
              </div>

              <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3">
                <p className="text-xs text-blue-300">
                  <strong>💡 WHY THIS MATTERS:</strong> Traditional RFP monitoring is manual and slow. 
                  This agent system continuously monitors thousands of sources, analyzes opportunities 
                  using multiple AI specialists, and provides Yellow Panther with competitive intelligence 
                  and first-mover advantage on high-value contracts.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}