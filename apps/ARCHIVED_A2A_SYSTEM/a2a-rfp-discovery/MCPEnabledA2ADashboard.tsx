'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Network, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Cpu,
  Database,
  Search,
  BarChart3,
  Link,
  Calendar,
  PoundSterling,
  Play,
  Square,
  RefreshCw,
  Zap,
  Shield,
  Bot
} from 'lucide-react'

interface MCPAgent {
  id: string
  name: string
  type: string
  status: string
  capabilities: string[]
  mcpTools: number
  lastActivity: string
  metrics: {
    entitiesProcessed: number
    opportunitiesFound: number
    errors: number
    processingTimeMs: number
    mcpCalls: number
  }
}

interface MCPRFP {
  id: string
  title: string
  description: string
  source: string
  sourceUrl: string
  entity: any
  fitScore: number
  priority: string
  discoveredAt: string
  keywords: string[]
  estimatedValue?: string
  deadline?: string
  category: string
  relatedEntities: any[]
  evidenceLinks: Array<{
    title: string
    url: string
    type: string
    confidence: number
  }>
}

interface MCPCard {
  id: string
  rfp: MCPRFP
  status: string
  processingNotes: string[]
  mcpAnalysis?: any
  nextSteps: string[]
  createdAt: string
  mcpGenerated: boolean
  mcpAgent: string
}

interface MCPServerStatus {
  name: string
  status: string
  tools: string[]
}

export default function MCPEnabledA2ADashboard() {
  const [mcpSystemStatus, setMcpSystemStatus] = useState<any>(null)
  const [mcpRFPs, setMcpRFPs] = useState<MCPRFP[]>([])
  const [mcpCards, setMcpCards] = useState<MCPCard[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isStopping, setIsStopping] = useState(false)

  const fetchMCPSystemStatus = async () => {
    try {
      console.log('🔍 Fetching MCP system status...')
      const response = await fetch('/api/a2a-rfp-discovery/mcp?action=mcp-status')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      console.log('✅ MCP system status received:', data)
      setMcpSystemStatus(data)
    } catch (error) {
      console.error('❌ Failed to fetch MCP system status:', error)
    }
  }

  const fetchMCPRFPs = async () => {
    try {
      console.log('🔍 Fetching MCP RFPs...')
      const response = await fetch('/api/a2a-rfp-discovery/mcp?action=mcp-rfps&limit=20')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      console.log('✅ MCP RFPs received:', data)
      setMcpRFPs(data.rfps || [])
    } catch (error) {
      console.error('❌ Failed to fetch MCP RFPs:', error)
    }
  }

  const fetchMCPCards = async () => {
    try {
      console.log('🔍 Fetching MCP cards...')
      const response = await fetch('/api/a2a-rfp-discovery/mcp?action=mcp-cards&limit=20')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      console.log('✅ MCP cards received:', data)
      setMcpCards(data.cards || [])
    } catch (error) {
      console.error('❌ Failed to fetch MCP cards:', error)
    }
  }

  const startMCPDiscovery = async () => {
    console.log('🚀 Starting MCP Discovery...')
    setIsStarting(true)
    try {
      const response = await fetch('/api/a2a-rfp-discovery/mcp?action=mcp-start', {
        method: 'GET'
      })
      const data = await response.json()
      console.log('📊 MCP Start Response:', data)
      
      if (data.success) {
        await fetchMCPSystemStatus()
        await fetchMCPRFPs()
        await fetchMCPCards()
        
        // Poll for updates
        const interval = setInterval(() => {
          fetchMCPSystemStatus()
          fetchMCPRFPs()
          fetchMCPCards()
        }, 3000)
        setTimeout(() => clearInterval(interval), 30000) // Stop polling after 30 seconds
      } else {
        console.error('❌ MCP Start failed:', data)
      }
    } catch (error) {
      console.error('❌ Failed to start MCP discovery:', error)
    } finally {
      setIsStarting(false)
    }
  }

  const stopMCPDiscovery = async () => {
    console.log('🛑 Stopping MCP Discovery...')
    setIsStopping(true)
    try {
      const response = await fetch('/api/a2a-rfp-discovery/mcp?action=mcp-stop', {
        method: 'GET'
      })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      console.log('✅ MCP Stop Response:', data)
      if (data.success) {
        await fetchMCPSystemStatus()
      }
    } catch (error) {
      console.error('❌ Failed to stop MCP discovery:', error)
    } finally {
      setIsStopping(false)
    }
  }

  const analyzeMPCRFP = async (rfpId: string) => {
    console.log('🔍 Analyzing MCP RFP:', rfpId)
    try {
      const response = await fetch('/api/a2a-rfp-discovery/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mcp-analyze',
          data: { rfpId }
        })
      })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      console.log('✅ MCP Analysis Response:', data)
      if (data.success) {
        await fetchMCPCards()
        await fetchMCPSystemStatus()
      }
    } catch (error) {
      console.error('❌ Failed to analyze MCP RFP:', error)
    }
  }

  const verifyMCPFinding = async (cardId: string, verification: boolean) => {
    console.log('🔍 Verifying MCP finding:', cardId, verification)
    try {
      const response = await fetch('/api/a2a-rfp-discovery/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mcp-verify',
          data: { cardId, verification }
        })
      })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      console.log('✅ MCP Verification Response:', data)
      if (data.success) {
        await fetchMCPCards()
      }
    } catch (error) {
      console.error('Failed to verify MCP finding:', error)
    }
  }

  useEffect(() => {
    console.log('🔧 MCP Dashboard component mounted')
    fetchMCPSystemStatus()
    fetchMCPRFPs()
    fetchMCPCards()
  }, [])

  // Test function to verify API connectivity
  const testAPIConnection = async () => {
    console.log('🧪 Testing API connection...')
    try {
      const response = await fetch('/api/a2a-rfp-discovery/mcp?action=mcp-status')
      console.log('🌐 API Response status:', response.status)
      const data = await response.json()
      console.log('📦 API Response data:', data)
      return data
    } catch (error) {
      console.error('❌ API connection test failed:', error)
      return null
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'bg-red-100 text-red-800 border-red-200'
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'LOW': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'idle': return 'bg-gray-100 text-gray-800'
      case 'scanning': return 'bg-blue-100 text-blue-800'
      case 'analyzing': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'error': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Network className="w-8 h-8 text-purple-500" />
            MCP-Enabled A2A Discovery
          </h1>
          <p className="text-gray-400 mt-2">
            Autonomous RFP discovery using Claude Agent SDK with MCP tools
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={(e) => {
              e.preventDefault()
              console.log('🖱️ Test API button clicked')
              testAPIConnection()
            }}
            variant="outline"
            className="border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Test API
          </Button>
          <Button
            onClick={(e) => {
              e.preventDefault()
              console.log('🖱️ Start MCP Discovery button clicked')
              startMCPDiscovery()
            }}
            disabled={isStarting || (!mcpSystemStatus || mcpSystemStatus.isRunning)}
            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
          >
            {isStarting ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            {isStarting ? 'Starting...' : 'Start MCP Discovery'}
          </Button>
          <Button
            onClick={(e) => {
              e.preventDefault()
              console.log('🖱️ Stop MCP Discovery button clicked')
              stopMCPDiscovery()
            }}
            disabled={isStopping || (!mcpSystemStatus || !mcpSystemStatus.isRunning)}
            variant="outline"
            className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white disabled:opacity-50"
          >
            {isStopping ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Square className="w-4 h-4 mr-2" />
            )}
            {isStopping ? 'Stopping...' : 'Stop MCP Discovery'}
          </Button>
        </div>
      </div>

      {/* MCP System Status */}
      {mcpSystemStatus && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="bg-custom-box border-custom-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400">MCP Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${mcpSystemStatus.isRunning ? 'bg-purple-500' : 'bg-gray-500'}`}></div>
                <span className="text-lg font-semibold text-white">
                  {mcpSystemStatus.isRunning ? 'MCP Active' : 'MCP Idle'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-custom-box border-custom-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400">MCP Agents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-purple-500" />
                <span className="text-lg font-semibold text-white">{mcpSystemStatus.agents?.length || 0}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-custom-box border-custom-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400">MCP Calls</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-blue-500" />
                <span className="text-lg font-semibold text-white">{mcpSystemStatus.totalMCPCalls || 0}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-custom-box border-custom-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400">MCP RFPs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-green-500" />
                <span className="text-lg font-semibold text-white">{mcpSystemStatus.totalMCPRFPsDiscovered || 0}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-custom-box border-custom-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400">MCP Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-yellow-500" />
                <span className="text-lg font-semibold text-white">{mcpSystemStatus.mcpSessions || 0}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="mcp-overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-custom-box border-custom-border">
          <TabsTrigger value="mcp-overview" className="data-[state=active]:bg-purple-500 data-[state=active]:text-white">MCP Overview</TabsTrigger>
          <TabsTrigger value="mcp-agents" className="data-[state=active]:bg-purple-500 data-[state=active]:text-white">MCP Agents</TabsTrigger>
          <TabsTrigger value="mcp-rfps" className="data-[state=active]:bg-purple-500 data-[state=active]:text-white">MCP RFPs ({mcpRFPs.length})</TabsTrigger>
          <TabsTrigger value="mcp-cards" className="data-[state=active]:bg-purple-500 data-[state=active]:text-white">MCP Cards ({mcpCards.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="mcp-overview" className="space-y-6">
          {/* MCP Servers Status */}
          {mcpSystemStatus?.mcpServers && (
            <Card className="bg-custom-box border-custom-border">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                  <Database className="w-6 h-6 text-purple-500" />
                  MCP Servers Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {mcpSystemStatus.mcpServers.map((server: MCPServerStatus) => (
                    <div key={server.name} className="p-4 bg-custom-bg rounded-lg border border-custom-border">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-white">{server.name}</h3>
                        <Badge className={server.status === 'available' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {server.status}
                        </Badge>
                      </div>
                      <div className="text-sm">
                        <p className="text-gray-400 mb-2">Tools:</p>
                        <div className="flex flex-wrap gap-1">
                          {server.tools.map((tool, index) => (
                            <Badge key={index} variant="outline" className="text-xs border-purple-600 text-purple-300">
                              {tool}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="mcp-agents" className="space-y-4">
          {mcpSystemStatus?.agents?.map((agent: MCPAgent) => (
            <Card key={agent.id} className="bg-custom-box border-custom-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-white">{agent.name}</CardTitle>
                  <div className="flex gap-2">
                    <Badge className={getStatusColor(agent.status)}>
                      {agent.status}
                    </Badge>
                    <Badge variant="outline" className="border-purple-600 text-purple-300">
                      {agent.mcpTools} MCP Tools
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-sm">
                    <p className="text-gray-400">Type</p>
                    <p className="text-white">{agent.type}</p>
                  </div>
                  <div className="text-sm">
                    <p className="text-gray-400">Entities</p>
                    <p className="text-white">{agent.metrics.entitiesProcessed}</p>
                  </div>
                  <div className="text-sm">
                    <p className="text-gray-400">Opportunities</p>
                    <p className="text-white">{agent.metrics.opportunitiesFound}</p>
                  </div>
                  <div className="text-sm">
                    <p className="text-gray-400">MCP Calls</p>
                    <p className="text-white font-semibold text-purple-400">{agent.metrics.mcpCalls}</p>
                  </div>
                </div>
                
                <div className="mb-3">
                  <p className="text-sm text-gray-400 mb-2">Capabilities:</p>
                  <div className="flex flex-wrap gap-1">
                    {agent.capabilities.map((capability, index) => (
                      <Badge key={index} variant="outline" className="text-xs border-gray-600 text-gray-300">
                        {capability}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="text-sm text-gray-400">
                  Last Activity: {new Date(agent.lastActivity).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="mcp-rfps" className="space-y-4">
          {mcpRFPs.map((rfp) => (
            <Card key={rfp.id} className="bg-custom-box border-custom-border">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                      {rfp.title}
                      <Badge variant="outline" className="border-purple-600 text-purple-300 text-xs">
                        MCP Generated
                      </Badge>
                    </CardTitle>
                    <p className="text-gray-400 text-sm">{rfp.description}</p>
                  </div>
                  <div className="flex flex-col gap-2 ml-4">
                    <Badge className={getPriorityColor(rfp.priority)}>
                      {rfp.priority}
                    </Badge>
                    <div className="text-sm font-semibold text-purple-500">{rfp.fitScore.toFixed(1)}% Fit</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-blue-500" />
                    <div>
                      <p className="text-xs text-gray-400">Entity</p>
                      <p className="text-sm text-white">{rfp.entity.properties.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-green-500" />
                    <div>
                      <p className="text-xs text-gray-400">Category</p>
                      <p className="text-sm text-white">{rfp.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <PoundSterling className="w-4 h-4 text-yellow-500" />
                    <div>
                      <p className="text-xs text-gray-400">Value</p>
                      <p className="text-sm text-white">{rfp.estimatedValue || 'TBD'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-purple-500" />
                    <div>
                      <p className="text-xs text-gray-400">Discovered</p>
                      <p className="text-sm text-white">{new Date(rfp.discoveredAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <Button
                    onClick={() => analyzeMPCRFP(rfp.id)}
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <Search className="w-4 h-4 mr-2" />
                    Analyze with MCP
                  </Button>
                  <div className="flex items-center gap-1">
                    <Link className="w-4 h-4 text-blue-500" />
                    <a href={rfp.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm">
                      View Source
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="mcp-cards" className="space-y-4">
          {mcpCards.map((card) => (
            <Card key={card.id} className="bg-custom-box border-custom-border">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                      {card.rfp.title}
                      <Badge variant="outline" className="border-purple-600 text-purple-300 text-xs">
                        {card.mcpAgent}
                      </Badge>
                    </CardTitle>
                    <p className="text-gray-400 text-sm">
                      Entity: {card.rfp.entity.properties.name} ({card.rfp.entity.properties.type})
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 ml-4">
                    <Badge className={
                      card.status === 'qualified' ? 'bg-green-100 text-green-800' :
                      card.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      card.status === 'analyzing' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }>
                      {card.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {card.mcpAnalysis && (
                  <div className="mb-4 p-3 bg-purple-900/20 rounded-lg border border-purple-600/30">
                    <p className="text-sm font-medium text-purple-300 mb-2">MCP Analysis:</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-gray-400">Confidence: <span className="text-white">{card.mcpAnalysis.confidenceScore.toFixed(1)}%</span></div>
                      <div className="text-gray-400">MCP Calls: <span className="text-purple-400">{card.mcpAnalysis.mcpToolsUsed.length}</span></div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => verifyMCPFinding(card.id, true)}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Verify
                  </Button>
                  <Button
                    onClick={() => verifyMCPFinding(card.id, false)}
                    size="sm"
                    variant="outline"
                    className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
                  >
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                  <div className="text-sm text-gray-400">
                    Created: {new Date(card.createdAt).toLocaleString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}