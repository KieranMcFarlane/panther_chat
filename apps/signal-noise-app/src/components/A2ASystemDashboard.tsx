'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface AgentStatus {
  agentId: string;
  agentType: string;
  activeTasks: number;
  capabilities: any[];
  status: string;
}

interface SystemStatus {
  orchestrator: string;
  agents: AgentStatus[];
  activeContexts: number;
  queuedMessages: number;
}

interface A2ASystemProps {
  className?: string;
}

export default function A2ASystemDashboard({ className }: A2ASystemProps) {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  // Fetch system status
  const fetchSystemStatus = async () => {
    try {
      const response = await fetch('/api/a2a-system');
      const data = await response.json();
      setSystemStatus(data);
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Failed to fetch A2A system status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Start discovery workflow
  const startDiscovery = async () => {
    setIsDiscovering(true);
    try {
      const response = await fetch('/api/a2a-system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start_discovery'
        })
      });
      
      const result = await response.json();
      console.log('Discovery started:', result);
      
      // Refresh status after starting discovery
      setTimeout(fetchSystemStatus, 2000);
    } catch (error) {
      console.error('Failed to start discovery:', error);
    } finally {
      setIsDiscovering(false);
    }
  };

  // Process opportunity
  const processOpportunity = async () => {
    const testOpportunity = {
      id: 'test-opp-001',
      title: 'Premier League Digital Transformation Platform',
      organization: 'Premier League',
      description: 'Advanced analytics and digital platform for match analysis, fan engagement, and player performance tracking',
      value: '£2,000,000',
      deadline: '2024-12-15',
      category: 'Sports Technology',
      source: 'LinkedIn',
      published: '2024-10-09'
    };

    try {
      const response = await fetch('/api/a2a-system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'process_opportunity',
          data: { opportunity: testOpportunity }
        })
      });
      
      const result = await response.json();
      console.log('Opportunity processing started:', result);
      
      // Refresh status
      setTimeout(fetchSystemStatus, 3000);
    } catch (error) {
      console.error('Failed to process opportunity:', error);
    }
  };

  // Auto-refresh status
  useEffect(() => {
    fetchSystemStatus();
    const interval = setInterval(fetchSystemStatus, 5000); // Update every 5 seconds
    
    return () => clearInterval(interval);
  }, []);

  const getAgentTypeColor = (type: string) => {
    switch (type) {
      case 'discovery': return 'bg-blue-500';
      case 'intelligence': return 'bg-purple-500';
      case 'action': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'busy': return 'bg-yellow-500';
      case 'idle': return 'bg-gray-500';
      default: return 'bg-red-500';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2">Initializing A2A System...</span>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">🤖 A2A RFP Intelligence System</h1>
          <p className="text-gray-600 mt-1">Autonomous Agent-to-Agent Opportunity Processing</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-500">
            Last update: {lastUpdate}
          </div>
          <Badge variant="outline" className="bg-green-50 text-green-700">
            {systemStatus?.orchestrator === 'active' ? '🟢 System Active' : '🔴 System Offline'}
          </Badge>
        </div>
      </div>

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">
              {systemStatus?.agents.length || 0}
            </div>
            <p className="text-sm text-gray-600">Active Agents</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">
              {systemStatus?.activeContexts || 0}
            </div>
            <p className="text-sm text-gray-600">Active Workflows</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {systemStatus?.agents && Array.isArray(systemStatus.agents) 
                ? systemStatus.agents.reduce((sum: number, agent: any) => sum + (agent.activeTasks || 0), 0)
                : systemStatus?.agents && typeof systemStatus.agents === 'object' 
                  ? Object.values(systemStatus.agents).reduce((sum: number, agent: any) => sum + (agent.activeTasks || 0), 0)
                  : 0}
            </div>
            <p className="text-sm text-gray-600">Tasks In Progress</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">
              {systemStatus?.queuedMessages || 0}
            </div>
            <p className="text-sm text-gray-600">Queued Messages</p>
          </CardContent>
        </Card>
      </div>

      {/* Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle>🎮 System Control</CardTitle>
          <CardDescription>Control the autonomous A2A system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4">
            <Button 
              onClick={startDiscovery}
              disabled={isDiscovering}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isDiscovering ? '🔄 Starting Discovery...' : '🔍 Start Discovery Workflow'}
            </Button>
            
            <Button 
              onClick={processOpportunity}
              variant="outline"
              className="border-purple-600 text-purple-600 hover:bg-purple-50"
            >
              🧪 Test Opportunity Processing
            </Button>
            
            <Button 
              onClick={fetchSystemStatus}
              variant="outline"
            >
              🔄 Refresh Status
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Agent Details */}
      <Tabs defaultValue="agents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="agents">🤖 Agents</TabsTrigger>
          <TabsTrigger value="workflows">🔄 Workflows</TabsTrigger>
          <TabsTrigger value="capabilities">⚡ Capabilities</TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {systemStatus?.agents && Array.isArray(systemStatus.agents) 
              ? systemStatus.agents.map((agent: any) => (
                <Card key={agent.agentId} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Badge className={`${getAgentTypeColor(agent.agentType)} text-white`}>
                        {agent.agentType}
                      </Badge>
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(agent.status)}`}></div>
                    </div>
                    <CardTitle className="text-lg">{agent.agentId}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Active Tasks:</span>
                        <span className="font-semibold">{agent.activeTasks || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Capabilities:</span>
                        <span className="font-semibold">{agent.capabilities ? agent.capabilities.length : 0}</span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-gray-600">Tools:</p>
                        <div className="flex flex-wrap gap-1">
                          {agent.capabilities && agent.capabilities[0]?.mcpTools && Array.isArray(agent.capabilities[0].mcpTools)
                            ? agent.capabilities[0].mcpTools.map((tool: string) => (
                                <Badge key={tool} variant="outline" className="text-xs">
                                  {tool.split('-')[0]}
                                </Badge>
                              ))
                            : <Badge variant="outline" className="text-xs">No tools</Badge>
                          }
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                ))
              : systemStatus?.agents && typeof systemStatus.agents === 'object'
                ? Object.values(systemStatus.agents).map((agent: any) => (
                    <Card key={agent.agentId} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="text-center">
                          <p className="font-semibold">{agent.agentId || 'Unknown Agent'}</p>
                          <Badge className={`${getAgentTypeColor(agent.agentType)} text-white mt-2`}>
                            {agent.agentType || 'Unknown Type'}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                  : (
                    <div className="col-span-full text-center py-8">
                      <p className="text-gray-500">No agents available</p>
                    </div>
                  )}
          </div>
        </TabsContent>

        <TabsContent value="workflows" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>🔄 Active Workflows</CardTitle>
              <CardDescription>Currently running autonomous workflows</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-800">🔍 Discovery Workflow</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Continuously monitoring LinkedIn, government portals, and news sources for RFP opportunities
                  </p>
                  <div className="flex items-center mt-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse mr-2"></div>
                    <span className="text-sm text-blue-600">Active</span>
                  </div>
                </div>

                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <h4 className="font-semibold text-purple-800">🧠 Intelligence Analysis</h4>
                  <p className="text-sm text-purple-700 mt-1">
                    Multi-agent analysis of discovered opportunities for fit scoring and strategic assessment
                  </p>
                  <div className="flex items-center mt-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse mr-2"></div>
                    <span className="text-sm text-purple-600">On-demand</span>
                  </div>
                </div>

                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <h4 className="font-semibold text-green-800">🎯 Response Generation</h4>
                  <p className="text-sm text-green-700 mt-1">
                    Autonomous generation of tailored responses and outreach coordination for high-fit opportunities
                  </p>
                  <div className="flex items-center mt-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    <span className="text-sm text-green-600">Triggered by analysis</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="capabilities" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-blue-600">🔍 Discovery Layer</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                    LinkedIn procurement monitoring
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                    Government tender tracking
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                    Market intelligence gathering
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                    Pattern recognition
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-purple-600">🧠 Intelligence Layer</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                    RFP fit scoring (0-100)
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                    Competitive analysis
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                    Market research
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                    Risk assessment
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-green-600">🎯 Action Layer</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    Proposal generation
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    Email composition
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    Outreach coordination
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    Meeting scheduling
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}