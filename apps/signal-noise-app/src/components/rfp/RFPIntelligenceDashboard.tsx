'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import EmailComposeModal from '@/components/email/EmailComposeModal';
import { useCopilotReadable, useCopilotAction } from '@copilotkit/react-core';
import DynamicStatusClaude from '@/components/DynamicStatusClaude';

interface RFPAlert {
  id: string;
  company: string;
  author: string;
  role: string;
  content_preview: string;
  fit_score?: number;
  estimated_value?: string;
  urgency_level?: string;
  timestamp: string;
  status: 'analyzing' | 'complete' | 'error';
  analysis?: any;
  notifications_enabled: boolean;
}

interface ToolUsage {
  tool: string;
  description: string;
  timestamp: string;
}

interface RFPDashboardProps {
  className?: string;
}

export default function RFPIntelligenceDashboard({ className }: RFPDashboardProps) {
  const [alerts, setAlerts] = useState<RFPAlert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<RFPAlert | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeTools, setActiveTools] = useState<ToolUsage[]>([]);
  const [analysisInProgress, setAnalysisInProgress] = useState<string[]>([]);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [currentAnalysisTool, setCurrentAnalysisTool] = useState<string | null>(null);

  // Simulated WebSocket connection for real-time updates
  useEffect(() => {
    const connectToRFPStream = () => {
      setIsConnected(true);
      console.log('🔗 Connected to RFP intelligence stream');
      
      // In production, this would be a real WebSocket or Server-Sent Events connection
      // to /api/webhook/linkedin-rfp-claude endpoint
      
      // Simulate receiving RFP alerts
      const mockAlerts: RFPAlert[] = [
        {
          id: '1',
          company: 'Manchester United FC',
          author: 'Sarah Chen',
          role: 'Chief Technology Officer',
          content_preview: 'Seeking digital transformation partner for fan engagement platform modernization...',
          fit_score: 87,
          estimated_value: '£500K-£1M',
          urgency_level: 'HIGH',
          timestamp: new Date(Date.now() - 300000).toISOString(),
          status: 'complete',
          notifications_enabled: true
        },
        {
          id: '2', 
          company: 'Twickenham Stadium',
          author: 'David Mitchell',
          role: 'Head of Digital',
          content_preview: 'Looking for analytics and ticketing integration partners for 2025 season...',
          fit_score: 72,
          estimated_value: '£250K-£500K',
          urgency_level: 'MEDIUM',
          timestamp: new Date(Date.now() - 600000).toISOString(),
          status: 'complete',
          notifications_enabled: true
        },
        {
          id: '3',
          company: 'Leicester City FC',
          author: 'Emma Thompson',
          role: 'Digital Director',
          content_preview: 'RFP: CRM and fan data platform migration project...',
          timestamp: new Date().toISOString(),
          status: 'analyzing',
          notifications_enabled: true
        }
      ];
      
      setAlerts(mockAlerts);
      
      // Simulate tool usage updates
      const toolUpdates: ToolUsage[] = [
        { tool: 'mcp__neo4j-mcp__execute_query', description: 'Querying knowledge graph for relationships', timestamp: new Date().toISOString() },
        { tool: 'mcp__brightData__scrape_as_markdown', description: 'Researching organization website', timestamp: new Date(Date.now() - 30000).toISOString() },
        { tool: 'mcp__perplexity-mcp__chat_completion', description: 'Researching market intelligence', timestamp: new Date(Date.now() - 60000).toISOString() }
      ];
      
      setActiveTools(toolUpdates);
      setAnalysisInProgress(['3']);
      
      // Simulate different analysis tools with persistent verbs
      const analysisTools = [
        'mcp__neo4j-mcp__execute_query',
        'mcp__brightData__scrape_as_markdown', 
        'mcp__perplexity-mcp__chat_completion',
        'mcp__neo4j-mcp__search_nodes'
      ];
      
      let toolIndex = 0;
      const toolCycleInterval = setInterval(() => {
        setCurrentAnalysisTool(analysisTools[toolIndex]);
        toolIndex = (toolIndex + 1) % analysisTools.length;
      }, 4000); // Each tool persists for 4 seconds
      
      // Add a period with no specific tool to show random verb cycling
      setTimeout(() => {
        setCurrentAnalysisTool(null); // No specific tool - random verbs cycle
      }, 16000);
      
      // Simulate analysis completion
      setTimeout(() => {
        clearInterval(toolCycleInterval);
        setCurrentAnalysisTool(null);
        setAlerts(prev => prev.map(alert => 
          alert.id === '3' 
            ? { 
                ...alert, 
                status: 'complete' as const,
                fit_score: 78,
                estimated_value: '£300K-£600K',
                urgency_level: 'MEDIUM'
              }
            : alert
        ));
        setAnalysisInProgress([]);
      }, 20000);
    };
    
    connectToRFPStream();
    
    return () => {
      setIsConnected(false);
      console.log('🔌 Disconnected from RFP intelligence stream');
    };
  }, []);

  const getUrgencyColor = (urgency?: string) => {
    switch (urgency) {
      case 'CRITICAL': return 'bg-red-500';
      case 'HIGH': return 'bg-orange-500';
      case 'MEDIUM': return 'bg-yellow-500';
      case 'LOW': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getFitScoreColor = (score?: number) => {
    if (!score) return 'bg-gray-500';
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'analyzing': return '🔄';
      case 'complete': return '✅';
      case 'error': return '❌';
      default: return '📋';
    }
  };

  const handleCopilotAction = useCallback((action: string, alert: RFPAlert) => {
    console.log(`🤖 Copilot Action: ${action} for ${alert.company}`);
    
    switch (action) {
      case 'draft_email':
        // Open email compose modal with contact info
        setIsEmailModalOpen(true);
        break;
      case 'research_competitors':
        // CopilotKit: "Research competitor landscape for this opportunity"
        console.log('🔍 Researching competitors for', alert.company);
        break;
      case 'find_similar_opportunities':
        // CopilotKit: "Find similar successful projects in our portfolio"
        console.log('📊 Finding similar opportunities for', alert.company);
        break;
      case 'schedule_follow_up':
        // CopilotKit: "Schedule follow-up tasks and reminders"
        console.log('📅 Scheduling follow-up for', alert.company);
        break;
    }
  }, []);

  // Convert RFP alert to contact for email composition
  const getContactFromAlert = useCallback((alert: RFPAlert | null) => {
    if (!alert) return null;
    
    return {
      id: alert.id,
      name: alert.author,
      email: `${alert.author.toLowerCase().replace(/\s+/g, '.')}@${alert.company.toLowerCase().replace(/\s+/g, '')}.com`, // Generate plausible email
      role: alert.role,
      affiliation: alert.company,
      tags: ['RFP', 'procurement', alert.urgency_level || '', alert.estimated_value || ''].filter(Boolean)
    };
  }, []);

  // Share RFP context with CopilotKit AI assistant
  useCopilotReadable({
    description: "Current RFP Intelligence Dashboard state - selected opportunity, recent alerts, and analysis results",
    value: {
      selectedAlert: selectedAlert ? {
        company: selectedAlert.company,
        author: selectedAlert.author,
        role: selectedAlert.role,
        content_preview: selectedAlert.content_preview,
        fit_score: selectedAlert.fit_score,
        estimated_value: selectedAlert.estimated_value,
        urgency_level: selectedAlert.urgency_level,
        status: selectedAlert.status,
        timestamp: selectedAlert.timestamp
      } : null,
      totalAlerts: alerts.length,
      completedAnalysis: alerts.filter(a => a.status === 'complete').length,
      activeAnalysis: alerts.filter(a => a.status === 'analyzing').length,
      systemStatus: {
        connected: isConnected,
        activeTools: activeTools.length
      }
    }
  });

  // Allow AI to interact with RFP dashboard
  useCopilotAction({
    name: "selectRFPAlert",
    description: "Select a specific RFP alert in the dashboard for analysis",
    parameters: [
      {
        name: "companyName",
        type: "string",
        description: "The name of the company to select",
        required: true
      }
    ],
    handler: async ({ companyName }) => {
      const alert = alerts.find(a => a.company.toLowerCase().includes(companyName.toLowerCase()));
      if (alert) {
        setSelectedAlert(alert);
        console.log(`🎯 AI Selected RFP Alert: ${alert.company} (${alert.fit_score}% fit)`);
        return `Selected ${alert.company} - Fit Score: ${alert.fit_score}%, Value: ${alert.estimated_value}`;
      } else {
        return `Could not find RFP alert for company: ${companyName}`;
      }
    }
  });

  useCopilotAction({
    name: "openEmailForSelectedRFP", 
    description: "Open the email compose modal for the currently selected RFP opportunity",
    parameters: [],
    handler: async () => {
      if (selectedAlert) {
        setIsEmailModalOpen(true);
        return `Opening email compose for ${selectedAlert.company} - ${selectedAlert.author}`;
      } else {
        return "No RFP alert selected. Please select an RFP opportunity first.";
      }
    }
  });

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">RFP Intelligence Dashboard</h2>
          <p className="text-muted-foreground">
            Real-time procurement opportunity analysis with Claude Agent SDK
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-muted-foreground">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* RFP Alerts List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Recent RFP Alerts
              <Badge variant="outline">{alerts.length} active</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                      selectedAlert?.id === alert.id ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => setSelectedAlert(alert)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-lg">{getStatusIcon(alert.status)}</span>
                          <h3 className="font-semibold truncate">{alert.company}</h3>
                          {analysisInProgress.includes(alert.id) && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {alert.role} • {alert.author}
                        </p>
                        <p className="text-sm line-clamp-2 mb-3">{alert.content_preview}</p>
                        
                        <div className="flex items-center space-x-2 mb-2">
                          {alert.fit_score && (
                            <Badge 
                              className={`${getFitScoreColor(alert.fit_score)} text-white text-xs`}
                            >
                              {alert.fit_score}% Fit
                            </Badge>
                          )}
                          {alert.estimated_value && (
                            <Badge variant="outline" className="text-xs">
                              {alert.estimated_value}
                            </Badge>
                          )}
                          {alert.urgency_level && (
                            <div className={`w-2 h-2 rounded-full ${getUrgencyColor(alert.urgency_level)}`} />
                          )}
                        </div>
                        
                        <p className="text-xs text-muted-foreground">
                          {new Date(alert.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Detailed Analysis */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {selectedAlert ? `${selectedAlert.company} - Analysis` : 'RFP Intelligence Analysis'}
              {selectedAlert?.notifications_enabled && (
                <Badge variant="outline" className="text-xs">
                  🔔 Notifications On
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedAlert ? (
              <div className="space-y-6">
                {/* Overview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 border rounded">
                    <div className="text-2xl font-bold text-blue-600">
                      {selectedAlert.fit_score || '--'}%
                    </div>
                    <div className="text-sm text-muted-foreground">Fit Score</div>
                  </div>
                  <div className="text-center p-3 border rounded">
                    <div className="text-2xl font-bold text-green-600">
                      {selectedAlert.estimated_value || '--'}
                    </div>
                    <div className="text-sm text-muted-foreground">Est. Value</div>
                  </div>
                  <div className="text-center p-3 border rounded">
                    <div className={`inline-flex items-center px-2 py-1 rounded text-white text-sm ${getUrgencyColor(selectedAlert.urgency_level)}`}>
                      {selectedAlert.urgency_level || 'LOW'}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">Urgency</div>
                  </div>
                  <div className="text-center p-3 border rounded">
                    <div className="text-2xl">
                      {selectedAlert.status === 'analyzing' ? '🔄' : '✅'}
                    </div>
                    <div className="text-sm text-muted-foreground">Status</div>
                  </div>
                </div>

                <Separator />

                {/* CopilotKit Actions */}
                <div>
                  <h3 className="font-semibold mb-3">🤖 CopilotKit Actions</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleCopilotAction('draft_email', selectedAlert)}
                      disabled={selectedAlert.status !== 'complete'}
                    >
                      📧 Draft Outreach Email
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleCopilotAction('research_competitors', selectedAlert)}
                      disabled={selectedAlert.status !== 'complete'}
                    >
                      🔍 Research Competitors
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleCopilotAction('find_similar_opportunities', selectedAlert)}
                      disabled={selectedAlert.status !== 'complete'}
                    >
                      📊 Find Similar Projects
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleCopilotAction('schedule_follow_up', selectedAlert)}
                      disabled={selectedAlert.status !== 'complete'}
                    >
                      📅 Schedule Follow-up
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Active Tool Usage */}
                {activeTools.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">🔧 Active Research Tools</h3>
                    <div className="space-y-2">
                      {activeTools.slice(0, 3).map((tool, index) => (
                        <div key={index} className="flex items-center space-x-3 p-2 bg-gray-50 rounded">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                          <span className="text-sm font-mono">{tool.tool}</span>
                          <span className="text-sm text-muted-foreground">• {tool.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Analysis Results */}
                {selectedAlert.status === 'complete' && selectedAlert.analysis && (
                  <div>
                    <h3 className="font-semibold mb-3">📊 Claude Analysis Results</h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <pre className="text-sm whitespace-pre-wrap">
                        {JSON.stringify(selectedAlert.analysis, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Content Preview */}
                <div>
                  <h3 className="font-semibold mb-3">📄 Original Content</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm">{selectedAlert.content_preview}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Source: {selectedAlert.company} • {selectedAlert.role}
                    </p>
                  </div>
                </div>
              </div>
            ) : analysisInProgress.length > 0 ? (
              <div className="flex flex-col items-center py-8">
                <DynamicStatusClaude 
                  currentTool={currentAnalysisTool}
                  isLoading={true}
                  statusMessage="RFP intelligence data..."
                />
                <p className="text-sm text-muted-foreground mt-4">
                  Analyzing opportunities with Claude Agent SDK + MCP tools
                </p>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <div className="text-4xl mb-4">📊</div>
                <p>Select an RFP alert to view detailed analysis</p>
                <p className="text-sm">Real-time intelligence powered by Claude Agent SDK</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">System Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <span className="text-sm">Claude Agent SDK</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <span className="text-sm">Neo4j Knowledge Graph</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <span className="text-sm">BrightData Research</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <span className="text-sm">Perplexity Intelligence</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email Compose Modal */}
      <EmailComposeModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        contact={getContactFromAlert(selectedAlert)}
      />
    </div>
  );
}