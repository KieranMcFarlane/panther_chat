'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trash2, Download } from 'lucide-react'


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
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminalInstanceRef = useRef<any>(null)
  const fitAddonRef = useRef<any>(null)
  const [isClient, setIsClient] = useState(false)
  const [terminalLoaded, setTerminalLoaded] = useState(false)

  // ANSI color codes for terminal styling
  const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
  }

  const getStatusIcon = (type: string) => {
    switch (type) {
      case 'assistant': return `${colors.blue}🤖${colors.reset}`
      case 'tool_use': return `${colors.yellow}🔧${colors.reset}`
      case 'result': return `${colors.green}✅${colors.reset}`
      case 'error': return `${colors.red}❌${colors.reset}`
      case 'agent_message': return `${colors.magenta}📨${colors.reset}`
      case 'system': return `${colors.cyan}🤖${colors.reset}`
      default: return `${colors.gray}⚡${colors.reset}`
    }
  }

  const formatLogEntry = (log: any, index: number) => {
    const timestamp = new Date(log.timestamp).toLocaleTimeString()
    const timeStr = `${colors.gray}${timestamp}${colors.reset}`
    const icon = getStatusIcon(log.type)
    
    let content = ''
    
    switch (log.type) {
      case 'system':
        content = `${colors.cyan}${log.content?.message || log.content || 'System message'}${colors.reset}`
        break
      case 'error':
        content = `${colors.red}${log.content?.message || log.content?.error || JSON.stringify(log.content)}${colors.reset}`
        break
      case 'tool_use':
        const toolStatus = log.status === 'completed' ? 
          `${colors.green}✓${colors.reset}` : 
          `${colors.yellow}⏳${colors.reset}`
        content = `${icon} Executing: ${colors.bright}${log.toolName}${colors.reset} ${toolStatus}`
        if (log.input) {
          content += `\n${colors.dim}  Input: ${JSON.stringify(log.input, null, 2)}${colors.reset}`
        }
        break
      case 'result':
        content = `${colors.green}✓ Result from: ${colors.bright}${log.toolName}${colors.reset}`
        if (log.result) {
          const resultStr = typeof log.result === 'string' ? 
            log.result : 
            JSON.stringify(log.result, null, 2)
          content += `\n${colors.dim}${resultStr}${colors.reset}`
        }
        break
      case 'agent_message':
        content = `${colors.magenta}📨 ${log.content?.from} → ${log.content?.to}${colors.reset}`
        content += `\n${colors.dim}  "${log.content?.message}"${colors.reset}`
        break
      case 'assistant':
        content = `${colors.blue}${log.content?.content || JSON.stringify(log.content)}${colors.reset}`
        break
      default:
        content = `${colors.white}${JSON.stringify(log.content)}${colors.reset}`
    }

    // Add service/tool badges
    const badges = []
    if (log.toolName) {
      badges.push(`${colors.yellow}[${log.toolName}]${colors.reset}`)
    }
    if (log.service) {
      badges.push(`${colors.blue}${log.service}${colors.reset}`)
    }
    const badgeStr = badges.length > 0 ? ` ${badges.join(' ')}` : ''

    return `\r\n${timeStr} ${icon} ${content}${badgeStr}`
  }

  const writeLogsToTerminal = () => {
    if (!terminalInstanceRef.current || !isClient) return

    const terminal = terminalInstanceRef.current
    
    // Clear terminal and write header
    terminal.clear()
    terminal.writeln(`${colors.cyan}${colors.bright}╭─────────────────────────────────────────────────────────────────────────╮${colors.reset}`)
    terminal.writeln(`${colors.cyan}${colors.bright}│                     CLAUDE AGENT EXECUTION LOGS                         │${colors.reset}`)
    terminal.writeln(`${colors.cyan}${colors.bright}│                    Real-time Streaming Output                        │${colors.reset}`)
    terminal.writeln(`${colors.cyan}${colors.bright}╰─────────────────────────────────────────────────────────────────────────╯${colors.reset}`)
    terminal.writeln('')

    // Write all logs
    logs.forEach((log, index) => {
      terminal.write(formatLogEntry(log, index))
      terminal.writeln('')
    })

    // Write footer if streaming
    if (isStreaming) {
      terminal.writeln(`${colors.green}● STREAMING ACTIVE${colors.reset}`)
    } else if (logs.length > 0) {
      terminal.writeln(`${colors.gray}● Stream ended${colors.reset}`)
    } else {
      terminal.writeln(`${colors.gray}No execution logs yet. Select a service and click Start Agent to see real-time streaming logs.${colors.reset}`)
    }

    // Scroll to bottom
    terminal.scrollToBottom()
  }

  const clearTerminal = () => {
    if (terminalInstanceRef.current) {
      terminalInstanceRef.current.clear()
    }
  }

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

  const fitTerminal = () => {
    if (fitAddonRef.current && terminalInstanceRef.current) {
      try {
        fitAddonRef.current.fit()
      } catch (error) {
        console.warn('Failed to fit terminal:', error)
      }
    }
  }

  useEffect(() => {
    setIsClient(true)
    
    // Load xterm components dynamically only on client side
    if (typeof window !== 'undefined') {
      const loadComponents = async () => {
        try {
          const xtermModule = await import('@xterm/xterm')
          await import('@xterm/addon-fit')
          setTerminalLoaded(true)
        } catch (error) {
          console.error('Failed to load xterm components:', error)
        }
      }
      
      loadComponents()
    }
  }, [])

  useEffect(() => {
    if (!isClient || !terminalRef.current || !terminalLoaded) return

    // Initialize terminal with direct dynamic import
    const initializeTerminal = async () => {
      try {
        const { Terminal } = await import('@xterm/xterm')
        const { FitAddon } = await import('@xterm/addon-fit')

        const terminal = new Terminal({
          theme: {
            background: '#1a1a1a',
            foreground: '#e0e0e0',
            cursor: '#ffffff',
            selection: '#444444',
            black: '#000000',
            red: '#ff6b6b',
            green: '#51cf66',
            yellow: '#ffd43b',
            blue: '#339af0',
            magenta: '#ff6ec7',
            cyan: '#22b8cf',
            white: '#ffffff',
            brightBlack: '#495057',
            brightRed: '#ff8787',
            brightGreen: '#69db7c',
            brightYellow: '#ffe066',
            brightBlue: '#74c0fc',
            brightMagenta: '#f06595',
            brightCyan: '#3bc9db',
            brightWhite: '#ffffff',
          },
          fontFamily: 'Cascadia Code, Fira Code, Monaco, Consolas, "Ubuntu Mono", monospace',
          fontSize: 13,
          lineHeight: 1.2,
          letterSpacing: 0,
          scrollback: 10000,
          cursorBlink: false,
          cursorStyle: 'block',
          cols: 120,
          rows: 30,
          allowTransparency: false,
        })

        const fitAddon = new FitAddon()
        terminal.loadAddon(fitAddon)
        
        terminal.open(terminalRef.current)
        fitAddon.fit()
        
        terminalInstanceRef.current = terminal
        fitAddonRef.current = fitAddon

        // Handle window resize
        const handleResize = () => {
          setTimeout(fitTerminal, 100)
        }
        window.addEventListener('resize', handleResize)

        return () => {
          terminal.dispose()
          window.removeEventListener('resize', handleResize)
        }
      } catch (error) {
        console.error('Failed to initialize terminal:', error)
      }
    }

    initializeTerminal()
  }, [isClient, terminalLoaded])

  useEffect(() => {
    writeLogsToTerminal()
  }, [logs, isStreaming, isClient])

  useEffect(() => {
    // Fit terminal when component mounts or logs change
    setTimeout(fitTerminal, 100)
  }, [logs.length])

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
          ref={terminalRef} 
          className="w-full h-[600px] bg-black"
          style={{ 
            fontFamily: 'Cascadia Code, Fira Code, Monaco, Consolas, "Ubuntu Mono", monospace' 
          }}
        />
      </CardContent>
    </Card>
  )
}