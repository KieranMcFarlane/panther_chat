'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Briefcase, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  User,
  BarChart3,
  Link,
  Calendar,
  PoundSterling,
  Search,
  Play,
  Square,
  RefreshCw,
  Radar,
  Target
} from 'lucide-react'

interface DiscoveredRFP {
  id: string
  title: string
  description: string
  source: string
  sourceUrl: string
  entity: {
    id: string
    neo4j_id: string
    labels: string[]
    properties: any
  }
  fitScore: number
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  discoveredAt: string
  keywords: string[]
  estimatedValue?: string
  deadline?: string
  category: 'RFP' | 'TENDER' | 'PARTNERSHIP' | 'SPONSORSHIP' | 'TECHNOLOGY' | 'CONSULTING'
  relatedEntities: any[]
  evidenceLinks: Array<{
    title: string
    url: string
    type: 'news' | 'press_release' | 'job_posting' | 'procurement' | 'social_media'
    confidence: number
  }>
}

interface RFPDiscoveryCard {
  id: string
  rfp: DiscoveredRFP
  status: 'discovered' | 'analyzing' | 'qualified' | 'rejected'
  processingNotes: string[]
  aiAnalysis?: {
    fitScore: number
    feasibilityScore: number
    marketFit: string
    recommendedActions: string[]
    risks: string[]
    opportunities: string[]
  }
  nextSteps: string[]
  assignedTo?: string
  createdAt: string
}

interface SystemStatus {
  isRunning: boolean
  agents: Array<{
    id: string
    name: string
    type: string
    status: string
    capabilities: string[]
    lastActivity: string
    metrics: {
      entitiesProcessed: number
      opportunitiesFound: number
      errors: number
      processingTimeMs: number
    }
  }>
  uptime: number
  totalRFPsDiscovered: number
  totalCardsCreated: number
  lastDiscovery: string | null
}

export default function A2ARFPDiscoveryDashboard() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [discoveredRFPs, setDiscoveredRFPs] = useState<DiscoveredRFP[]>([])
  const [rfpCards, setRfpCards] = useState<RFPDiscoveryCard[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchSystemStatus = async () => {
    try {
      const response = await fetch('/api/a2a-rfp-discovery?action=status')
      const data = await response.json()
      setSystemStatus(data)
    } catch (error) {
      console.error('Failed to fetch system status:', error)
    }
  }

  const fetchDiscoveredRFPs = async () => {
    try {
      const response = await fetch('/api/a2a-rfp-discovery?action=rfps&limit=20')
      const data = await response.json()
      setDiscoveredRFPs(data.rfps || [])
    } catch (error) {
      console.error('Failed to fetch discovered RFPs:', error)
    }
  }

  const fetchRFPCards = async () => {
    try {
      const response = await fetch('/api/a2a-rfp-discovery?action=cards&limit=20')
      const data = await response.json()
      setRfpCards(data.cards || [])
    } catch (error) {
      console.error('Failed to fetch RFP cards:', error)
    }
  }

  const startDiscovery = async () => {
    try {
      const response = await fetch('/api/a2a-rfp-discovery?action=start', {
        method: 'GET'
      })
      const data = await response.json()
      if (data.success) {
        await fetchSystemStatus()
      }
    } catch (error) {
      console.error('Failed to start discovery:', error)
    }
  }

  const stopDiscovery = async () => {
    try {
      const response = await fetch('/api/a2a-rfp-discovery?action=stop', {
        method: 'GET'
      })
      const data = await response.json()
      if (data.success) {
        await fetchSystemStatus()
      }
    } catch (error) {
      console.error('Failed to stop discovery:', error)
    }
  }

  const generateDemoData = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/a2a-rfp-discovery?action=demo', {
        method: 'GET'
      })
      const data = await response.json()
      if (data.success) {
        await fetchRFPCards()
        await fetchDiscoveredRFPs()
        await fetchSystemStatus()
      }
    } catch (error) {
      console.error('Failed to generate demo data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSystemStatus()
    fetchDiscoveredRFPs()
    fetchRFPCards()
    
    // Set up polling for real-time updates
    const interval = setInterval(() => {
      fetchSystemStatus()
    }, 5000)
    
    return () => clearInterval(interval)
  }, [])

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
            <Radar className="w-8 h-8 text-yellow-500" />
            A2A RFP Discovery System
          </h1>
          <p className="text-gray-400 mt-2">
            Autonomous Agent-to-Agent RFP opportunity discovery using Neo4j and Supabase
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={startDiscovery}
            disabled={!systemStatus || systemStatus.isRunning}
            className="bg-green-600 hover:bg-green-700"
          >
            <Play className="w-4 h-4 mr-2" />
            Start Discovery
          </Button>
          <Button
            onClick={stopDiscovery}
            disabled={!systemStatus || !systemStatus.isRunning}
            variant="outline"
            className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
          >
            <Square className="w-4 h-4 mr-2" />
            Stop Discovery
          </Button>
          <Button
            onClick={generateDemoData}
            disabled={isLoading}
            variant="outline"
            className="border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Generating...' : 'Generate Demo Data'}
          </Button>
        </div>
      </div>

      {/* System Status Overview */}
      {systemStatus && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-custom-box border-custom-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400">System Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${systemStatus.isRunning ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                <span className="text-lg font-semibold text-white">
                  {systemStatus.isRunning ? 'Running' : 'Idle'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-custom-box border-custom-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400">Active Agents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-blue-500" />
                <span className="text-lg font-semibold text-white">{systemStatus.agents.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-custom-box border-custom-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400">RFPs Discovered</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-green-500" />
                <span className="text-lg font-semibold text-white">{systemStatus.totalRFPsDiscovered}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-custom-box border-custom-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400">Processing Cards</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-yellow-500" />
                <span className="text-lg font-semibold text-white">{systemStatus.totalCardsCreated}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-custom-box border-custom-border">
          <TabsTrigger value="overview" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black">Overview</TabsTrigger>
          <TabsTrigger value="rfps" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black">Discovered RFPs ({discoveredRFPs.length})</TabsTrigger>
          <TabsTrigger value="cards" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black">Processing Cards ({rfpCards.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Agent Status */}
          {systemStatus && (
            <Card className="bg-custom-box border-custom-border">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                  <User className="w-6 h-6 text-blue-500" />
                  Agent Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {systemStatus.agents.map((agent) => (
                    <div key={agent.id} className="p-4 bg-custom-bg rounded-lg border border-custom-border">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-white">{agent.name}</h3>
                        <Badge className={getStatusColor(agent.status)}>
                          {agent.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-400 mb-2">
                        <p className="mb-1">Type: <span className="text-gray-300">{agent.type}</span></p>
                        <p className="mb-2">Capabilities: {agent.capabilities.join(', ')}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="text-gray-400">Entities: <span className="text-white">{agent.metrics.entitiesProcessed}</span></div>
                        <div className="text-gray-400">Opportunities: <span className="text-white">{agent.metrics.opportunitiesFound}</span></div>
                        <div className="text-gray-400">Errors: <span className="text-white">{agent.metrics.errors}</span></div>
                        <div className="text-gray-400">Time: <span className="text-white">{agent.metrics.processingTimeMs}ms</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="rfps" className="space-y-4">
          {discoveredRFPs.map((rfp) => (
            <Card key={rfp.id} className="bg-custom-box border-custom-border">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold text-white mb-2">{rfp.title}</CardTitle>
                    <p className="text-gray-400 text-sm">{rfp.description}</p>
                  </div>
                  <div className="flex flex-col gap-2 ml-4">
                    <Badge className={getPriorityColor(rfp.priority)}>
                      {rfp.priority}
                    </Badge>
                    <div className="text-sm font-semibold text-yellow-500">{rfp.fitScore.toFixed(1)}% Fit</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-blue-500" />
                    <div>
                      <p className="text-xs text-gray-400">Entity</p>
                      <p className="text-sm text-white">{rfp.entity.properties.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-green-500" />
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
                      <p className="text-xs text-gray-400">Deadline</p>
                      <p className="text-sm text-white">{rfp.deadline ? new Date(rfp.deadline).toLocaleDateString() : 'Open'}</p>
                    </div>
                  </div>
                </div>
                
                <div className="mb-4">
                  <p className="text-xs text-gray-400 mb-2">Keywords</p>
                  <div className="flex flex-wrap gap-1">
                    {rfp.keywords.map((keyword, index) => (
                      <Badge key={index} variant="outline" className="text-xs border-gray-600 text-gray-300">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Link className="w-4 h-4 text-blue-500" />
                    <a href={rfp.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                      View Source
                    </a>
                  </div>
                  <div className="text-gray-400">
                    Discovered: {new Date(rfp.discoveredAt).toLocaleString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="cards" className="space-y-4">
          {rfpCards.map((card) => (
            <Card key={card.id} className="bg-custom-box border-custom-border">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold text-white mb-2">{card.rfp.title}</CardTitle>
                    <p className="text-gray-400 text-sm mb-2">
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
                    {card.assignedTo && (
                      <div className="text-sm text-gray-400">Assigned: {card.assignedTo}</div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-300 mb-2">Next Steps:</p>
                  <div className="flex flex-wrap gap-1">
                    {card.nextSteps.map((step, index) => (
                      <Badge key={index} variant="outline" className="text-xs border-gray-600 text-gray-300">
                        {step}
                      </Badge>
                    ))}
                  </div>
                </div>

                {card.aiAnalysis && (
                  <div className="mb-4 p-3 bg-custom-bg rounded-lg">
                    <p className="text-sm font-medium text-gray-300 mb-2">AI Analysis:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <div className="text-gray-400">Feasibility: <span className="text-white">{card.aiAnalysis.feasibilityScore.toFixed(1)}%</span></div>
                      <div className="text-gray-400">Market Fit: <span className="text-white">{card.aiAnalysis.marketFit}</span></div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-sm text-gray-400">
                  <div>Created: {new Date(card.createdAt).toLocaleString()}</div>
                  <div>Notes: {card.processingNotes.length}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}