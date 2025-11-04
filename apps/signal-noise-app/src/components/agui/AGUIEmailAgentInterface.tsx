/**
 * AG-UI Integration Component for AI Email Agents
 * Provides the user interface layer that connects to Claude Code SDK backend
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Brain, Bot, MessageCircle, Send, Play, Pause, Settings, 
  Target, TrendingUp, Users, Mail, Calendar, Zap,
  ChevronRight, Loader2, CheckCircle, AlertCircle
} from 'lucide-react';

interface AGUIAgentMessage {
  id: string;
  type: 'user' | 'agent' | 'system';
  content: string;
  timestamp: string;
  actions?: AgentAction[];
  status?: 'processing' | 'completed' | 'error';
}

interface AgentAction {
  id: string;
  type: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
}

interface CampaignResult {
  id: string;
  goal: string;
  targetCount: number;
  sentCount: number;
  openRate: number;
  responseRate: number;
  status: 'running' | 'completed' | 'paused';
  results: any[];
}

export function AGUIEmailAgentInterface() {
  const [messages, setMessages] = useState<AGUIAgentMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState<CampaignResult | null>(null);
  const [agentCapabilities, setAgentCapabilities] = useState({
    relationshipAnalysis: true,
    strategyGeneration: true,
    campaignExecution: true,
    realTimeProcessing: true,
    autonomousMode: false
  });

  // Initialize connection to Claude Code SDK agent
  const [agent, setAgent] = useState<any>(null);

  useEffect(() => {
    initializeAgent();
  }, []);

  const initializeAgent = async () => {
    try {
      // Connect to our Claude Code SDK backend
      const response = await fetch('/api/claude-agent/initialize');
      const agentData = await response.json();
      setAgent(agentData);
      
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'system',
        content: '🤖 Claude Code Agent initialized. Ready for relationship management tasks.',
        timestamp: new Date().toISOString()
      }]);
    } catch (error) {
      console.error('Failed to initialize agent:', error);
    }
  };

  const processUserRequest = async (request: string) => {
    if (!request.trim() || !agent) return;

    setIsProcessing(true);
    
    // Add user message
    const userMessage: AGUIAgentMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: request,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);

    try {
      // Send request to Claude Code SDK backend
      const response = await fetch('/api/claude-agent/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: request,
          context: {
            activeCampaign,
            agentCapabilities,
            timestamp: new Date().toISOString()
          }
        })
      });

      const result = await response.json();
      
      // Add agent response
      const agentMessage: AGUIAgentMessage = {
        id: (Date.now() + 1).toString(),
        type: 'agent',
        content: result.response,
        timestamp: new Date().toISOString(),
        actions: result.actions || [],
        status: 'completed'
      };

      setMessages(prev => [...prev, agentMessage]);

      // Execute any actions returned by the agent
      if (result.actions) {
        await executeAgentActions(result.actions);
      }

      // Update active campaign if applicable
      if (result.campaignUpdate) {
        setActiveCampaign(result.campaignUpdate);
      }

    } catch (error) {
      const errorMessage: AGUIAgentMessage = {
        id: (Date.now() + 1).toString(),
        type: 'system',
        content: `❌ Error processing request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
        status: 'error'
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const executeAgentActions = async (actions: AgentAction[]) => {
    for (const action of actions) {
      // Update action status to running
      setMessages(prev => prev.map(msg => 
        msg.actions?.map(act => 
          act.id === action.id ? { ...act, status: 'running' } : act
        )
      ));

      try {
        // Execute action via API
        const response = await fetch('/api/claude-agent/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action)
        });

        const result = await response.json();
        
        // Update action status to completed
        setMessages(prev => prev.map(msg => 
          msg.actions?.map(act => 
            act.id === action.id 
              ? { ...act, status: 'completed', result } 
              : act
          )
        ));

      } catch (error) {
        // Update action status to failed
        setMessages(prev => prev.map(msg => 
          msg.actions?.map(act => 
            act.id === action.id 
              ? { ...act, status: 'failed', error } 
              : act
          )
        ));
      }
    }
  };

  const handleSendMessage = () => {
    if (inputValue.trim()) {
      processUserRequest(inputValue);
      setInputValue('');
    }
  };

  const toggleCapability = async (capability: string) => {
    setAgentCapabilities(prev => ({
      ...prev,
      [capability]: !prev[capability as keyof typeof prev]
    }));

    // Notify agent of capability change
    await fetch('/api/claude-agent/update-capabilities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capability, enabled: !agentCapabilities[capability as keyof typeof agentCapabilities] })
    });
  };

  const launchAutonomousCampaign = async (goal: string, criteria: any) => {
    setIsProcessing(true);
    
    try {
      const response = await fetch('/api/claude-agent/autonomous-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, criteria })
      });

      const campaign = await response.json();
      setActiveCampaign(campaign);
      
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'agent',
        content: `🚀 Autonomous campaign launched: ${goal}\n\nTargeting ${campaign.targetCount} contacts\nEstimated completion: ${campaign.estimatedTime}`,
        timestamp: new Date().toISOString()
      }]);

    } catch (error) {
      console.error('Failed to launch campaign:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#1c1e2d]">
      {/* Header */}
      <div className="border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Brain className="h-6 w-6 text-blue-500" />
              <h1 className="text-xl font-bold text-white">AG-UI Email Agent</h1>
            </div>
            <Badge variant={agent ? 'default' : 'secondary'}>
              {agent ? 'Connected' : 'Offline'}
            </Badge>
          </div>
          
          <div className="flex items-center gap-4">
            <Button
              variant={agentCapabilities.autonomousMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => toggleCapability('autonomousMode')}
            >
              <Bot className="h-4 w-4 mr-2" />
              Autonomous Mode
            </Button>
            
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Agent Settings
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Chat Interface */}
        <div className="flex-1 flex flex-col">
          {/* Messages Area */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-start gap-3 ${
                    message.type === 'user' ? 'flex-row-reverse' : ''
                  }`}
                >
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback className={
                      message.type === 'user' ? 'bg-blue-600 text-white' :
                      message.type === 'agent' ? 'bg-green-600 text-white' :
                      'bg-gray-600 text-white'
                    }>
                      {message.type === 'user' ? 'U' : 
                       message.type === 'agent' ? 'A' : 'S'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className={`max-w-[70%] ${
                    message.type === 'user' ? 'items-end' : 'items-start'
                  }`}>
                    <div className={`rounded-lg p-3 ${
                      message.type === 'user' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-700 text-white'
                    } ${message.status === 'error' ? 'border border-red-500' : ''}`}>
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      
                      {/* Actions */}
                      {message.actions && message.actions.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {message.actions.map((action) => (
                            <div
                              key={action.id}
                              className="flex items-center gap-2 text-xs bg-black/20 rounded p-2"
                            >
                              {action.status === 'running' && <Loader2 className="h-3 w-3 animate-spin" />}
                              {action.status === 'completed' && <CheckCircle className="h-3 w-3 text-green-400" />}
                              {action.status === 'failed' && <AlertCircle className="h-3 w-3 text-red-400" />}
                              <span>{action.description}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
              
              {isProcessing && (
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-green-600 text-white">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-gray-700 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-green-400" />
                      <span className="text-sm text-white">Claude Code Agent is reasoning...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="border-t border-gray-700 p-4">
            <div className="flex gap-2">
              <Textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask the agent to analyze relationships, generate email strategies, or execute campaigns..."
                className="flex-1 bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 resize-none"
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <Button
                onClick={handleSendMessage}
                disabled={isProcessing || !inputValue.trim()}
                className="self-end"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 border-l border-gray-700 p-4 space-y-6">
          {/* Agent Capabilities */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Agent Capabilities
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { key: 'relationshipAnalysis', label: 'Relationship Analysis', icon: TrendingUp },
                { key: 'strategyGeneration', label: 'Strategy Generation', icon: Target },
                { key: 'campaignExecution', label: 'Campaign Execution', icon: Mail },
                { key: 'realTimeProcessing', label: 'Real-time Processing', icon: MessageCircle }
              ].map(({ key, label, icon: Icon }) => (
                <div key={key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-300">{label}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleCapability(key)}
                    className={`h-6 w-12 ${
                      agentCapabilities[key as keyof typeof agentCapabilities]
                        ? 'bg-green-600' : 'bg-gray-600'
                    }`}
                  >
                    {agentCapabilities[key as keyof typeof agentCapabilities] ? 'ON' : 'OFF'}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Active Campaign */}
          {activeCampaign && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Active Campaign
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-xs text-gray-400">Goal</div>
                  <div className="text-sm text-white font-medium">{activeCampaign.goal}</div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-400">Sent</div>
                    <div className="text-sm text-white">{activeCampaign.sentCount}/{activeCampaign.targetCount}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Open Rate</div>
                    <div className="text-sm text-white">{activeCampaign.openRate}%</div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {/* Pause campaign */}}
                  >
                    <Pause className="h-3 w-3 mr-1" />
                    Pause
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {/* View results */}}
                  >
                    <ChevronRight className="h-3 w-3 mr-1" />
                    Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => launchAutonomousCampaign(
                  'Follow up with high-priority contacts',
                  { priority: 'high', daysSinceContact: 7 }
                )}
              >
                <Users className="h-4 w-4 mr-2" />
                Follow-up Campaign
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => processUserRequest('Analyze relationship health for all contacts and identify opportunities')}
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Analyze Relationships
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => processUserRequest('Generate personalized email strategies for upcoming partnership discussions')}
              >
                <Mail className="h-4 w-4 mr-2" />
                Generate Strategies
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}