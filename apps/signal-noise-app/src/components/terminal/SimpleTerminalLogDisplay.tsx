'use client'

import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trash2, Download, Terminal } from 'lucide-react'

interface TerminalLogDisplayProps {
  logs: Array<{
    id: string
    timestamp: string
    type: 'assistant' | 'tool_use' | 'result' | 'error' | 'progress' | 'agent_message' | 'system'
    content: any
    toolName?: string
    service?: string
  }>
  isStreaming?: boolean
}

export default function TerminalLogDisplay({ logs, isStreaming = false }: TerminalLogDisplayProps) {
  const [isClient, setIsClient] = useState(false)
  
  // CSS color classes for terminal styling
  const colorStyles = {
    reset: '',
    bright: 'font-bold',
    dim: 'text-gray-400',
    red: 'text-red-400',
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    blue: 'text-blue-400',
    magenta: 'text-purple-400',
    cyan: 'text-cyan-400',
    white: 'text-white',
    gray: 'text-gray-500',
    bgRed: 'bg-red-900',
    bgGreen: 'bg-green-900',
    bgYellow: 'bg-yellow-900',
    bgBlue: 'bg-blue-900',
  }

  const getStatusIcon = (type: string) => {
    switch (type) {
      case 'assistant': return <span className="text-blue-400">🤖</span>
      case 'tool_use': return <span className="text-yellow-400">🔧</span>
      case 'result': return <span className="text-green-400">✅</span>
      case 'error': return <span className="text-red-400">❌</span>
      case 'agent_message': return <span className="text-purple-400">📨</span>
      case 'system': return <span className="text-cyan-400">🤖</span>
      default: return <span className="text-gray-500">⚡</span>
    }
  }

  const formatLogEntry = (log: any, index: number) => {
    const timestamp = new Date(log.timestamp).toLocaleTimeString()
    
    let content = null
    let serviceBadge = null
    
    switch (log.type) {
      case 'system':
        const message = log.content?.message || log.content || log.message || 'System message'
        content = (
          <span className="text-cyan-400">
            {message}
          </span>
        )
        break
      case 'error':
        content = (
          <span className="text-red-400">
            {log.content?.message || log.content?.error || log.message || JSON.stringify(log.content)}
          </span>
        )
        break
      case 'tool_use':
        const isStarting = log.status === 'executing' || log.partial
        const statusIcon = isStarting ? 
          <span className="text-yellow-400 animate-pulse">⏳</span> : 
          <span className="text-green-400">✓</span>
        
        content = (
          <span>
            <span className="text-yellow-400">🔧</span> 
            {' '}
            <span className="font-bold text-cyan-300">{log.toolName}</span>
            {' '}
            {statusIcon}
            {isStarting && (
              <span className="text-yellow-400 animate-pulse ml-2 text-xs">[STARTING]</span>
            )}
            {log.input && (
              <div className="text-gray-400 mt-1 text-xs">
                <div className="bg-gray-800 p-2 rounded overflow-x-auto">
                  <code className="text-blue-300">
                    {JSON.stringify(log.input, null, 2)}
                  </code>
                </div>
              </div>
            )}
          </span>
        )
        break
      case 'result':
        content = (
          <span>
            <span className="text-green-400">✅</span>{' '}
            <span className="font-bold text-green-300">{log.toolName}</span>
            {log.result && (
              <div className="text-gray-400 mt-1 text-xs">
                <div className="bg-gray-800 p-2 rounded overflow-x-auto">
                  <code className="text-green-300">
                    {typeof log.result === 'string' ? log.result : JSON.stringify(log.result, null, 2)}
                  </code>
                </div>
              </div>
            )}
            {!log.result && (
              <div className="text-gray-500 mt-1 italic text-xs">
                Execution completed successfully
              </div>
            )}
          </span>
        )
        break
      case 'agent_message':
        content = (
          <span>
            <span className="text-purple-400">📨</span>{' '}
            <span className="text-purple-300">
              {log.content?.from} → {log.content?.to}
            </span>
            {log.content?.message && (
              <div className="text-gray-400 mt-1 italic text-xs">
                "{log.content?.message}"
              </div>
            )}
          </span>
        )
        break
      case 'assistant':
        content = (
          <span className="text-blue-400">
            🤖 {log.content?.content || JSON.stringify(log.content)}
          </span>
        )
        break
      default:
        content = (
          <span className="text-gray-300">
            {log.content?.message || log.message || JSON.stringify(log.content)}
          </span>
        )
    }

    // Create service badge
    if (log.service && log.service !== 'headless') {
      serviceBadge = (
        <span className="ml-2 text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
          {log.service}
        </span>
      )
    }

    return (
      <div key={log.id || index} className="mb-2 font-mono text-sm leading-relaxed">
        <span className="text-gray-500 select-none">{timestamp}</span>
        {' '}
        {content}
        {serviceBadge}
      </div>
    )
  }

  useEffect(() => {
    setIsClient(true)
  }, [])

  const downloadLogs = () => {
    const logText = logs.map(log => {
      const timestamp = new Date(log.timestamp).toISOString()
      return `[${timestamp}] [${log.type.toUpperCase()}] ${log.toolName || ''} ${log.service || ''}: ${log.content?.message || JSON.stringify(log.content)}`
    }).join('\n')

    const blob = new Blob([logText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `claude-agent-logs-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const clearTerminal = () => {
    // This will be handled by the parent component through the sharedExecutionStore
  }

  if (!isClient) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="p-4">
          <div className="text-gray-400 text-center">Loading terminal...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Terminal className="text-lg font-mono" />
            <span className="text-lg font-mono">📟 Terminal Output</span>
            {isStreaming && (
              <Badge className="bg-green-600 animate-pulse">
                ● LIVE
              </Badge>
            )}
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {logs.length} entries
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadLogs}
              disabled={logs.length === 0}
            >
              <Download className="h-4 w-4 mr-1" />
              Download
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearTerminal}
              disabled={logs.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div 
          className="w-full h-[600px] bg-black overflow-auto font-mono text-sm leading-relaxed p-4"
          style={{ 
            fontFamily: 'Cascadia Code, Fira Code, Monaco, Consolas, "Ubuntu Mono", monospace'
          }}
        >
          {/* Terminal Header */}
          <div className="text-gray-400 mb-4">
            <div className="border border-gray-700 rounded-lg p-3 bg-gray-900/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs font-mono text-gray-300">CLAUDE AGENT TERMINAL</span>
                </div>
                <span className="text-xs text-gray-500">Real-time Execution Logs</span>
              </div>
            </div>
          </div>

          {/* Log Entries */}
          <div className="space-y-1">
            {logs.map((log, index) => formatLogEntry(log, index))}
          </div>

          {/* Terminal Footer */}
          <div className="mt-4 pt-3 border-t border-gray-800">
            {isStreaming ? (
              <div className="flex items-center gap-2 text-green-400">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-xs font-mono">● STREAMING ACTIVE</span>
              </div>
            ) : logs.length > 0 ? (
              <div className="text-gray-600 text-xs font-mono">
                ● Stream completed • {logs.length} entries logged
              </div>
            ) : (
              <div className="text-gray-600 text-center py-8 text-xs">
                No execution logs yet.<br/>
                Select a service and click <span className="text-green-400 font-bold">Start Agent</span> to begin.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}