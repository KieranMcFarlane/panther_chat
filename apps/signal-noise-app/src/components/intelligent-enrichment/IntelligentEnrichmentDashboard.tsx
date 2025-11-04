'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Brain, 
  Clock, 
  Zap, 
  Network, 
  BarChart3, 
  Settings, 
  Play, 
  Pause, 
  RefreshCw,
  Calendar,
  TrendingUp,
  Shield,
  Target
} from 'lucide-react';

interface IntelligentEnrichmentStatus {
  claudeAgent: {
    isRunning: boolean;
    currentBatch: {
      batchId: string;
      totalEntities: number;
      processedEntities: number;
      successfulEnrichments: number;
      failedEnrichments: number;
      currentEntity: string;
      estimatedTimeRemaining: number;
      startTime: string;
      results: any[];
      strategies_used: Record<string, number>;
    } | null;
    timestamp: string;
  };
  scheduler: {
    isRunning: boolean;
    currentBatch: any;
    activeSchedules: Array<{
      id: string;
      name: string;
      nextRun: string;
    }>;
  };
  capabilities: {
    tools: string[];
    strategies: string[];
    features: string[];
  };
}

interface Schedule {
  id: string;
  name: string;
  cron: string;
  enabled: boolean;
  config: any;
  lastRun?: string;
  nextRun?: string;
  lastResults?: any;
}

export default function IntelligentEnrichmentDashboard() {
  const [status, setStatus] = useState<IntelligentEnrichmentStatus | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedView, setSelectedView] = useState<'overview' | 'schedules' | 'strategies'>('overview');

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/intelligent-enrichment?view=status');
      const data = await response.json();
      
      if (data.success) {
        setStatus(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch intelligent enrichment status:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedules = async () => {
    try {
      const response = await fetch('/api/intelligent-enrichment?view=schedules');
      const data = await response.json();
      
      if (data.success) {
        setSchedules(data.data.schedules);
      }
    } catch (err) {
      console.error('Failed to fetch schedules:', err);
    }
  };

  const startIntelligentEnrichment = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/intelligent-enrichment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start-enrichment' })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Status will be updated by auto-refresh
      } else {
        console.error('Failed to start intelligent enrichment:', data.error);
      }
    } catch (err) {
      console.error('Failed to start intelligent enrichment:', err);
    } finally {
      setLoading(false);
    }
  };

  const triggerSchedule = async (scheduleId: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/intelligent-enrichment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'trigger-schedule', 
          scheduleId 
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('Schedule triggered successfully:', data);
      }
    } catch (err) {
      console.error('Failed to trigger schedule:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSchedule = async (scheduleId: string, enabled: boolean) => {
    try {
      const response = await fetch('/api/intelligent-enrichment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'toggle-schedule', 
          scheduleId, 
          enabled 
        })
      });
      
      if (response.ok) {
        await fetchSchedules(); // Refresh schedules
      }
    } catch (err) {
      console.error('Failed to toggle schedule:', err);
    }
  };

  // Auto-refresh status when running
  useEffect(() => {
    fetchStatus();
    fetchSchedules();
    
    if (autoRefresh && status?.claudeAgent?.isRunning) {
      const interval = setInterval(() => {
        fetchStatus();
      }, 3000); // Update every 3 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, status?.claudeAgent?.isRunning]);

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString();
  };

  const completionPercentage = status?.claudeAgent?.currentBatch 
    ? Math.round((status.claudeAgent.currentBatch.processedEntities / status.claudeAgent.currentBatch.totalEntities) * 100)
    : 0;

  return (
    <div className=\"space-y-6 p-6\">
      {/* Header */}
      <div className=\"flex items-center justify-between\">
        <div className=\"flex items-center gap-4\">
          <div className=\"flex items-center gap-2\">
            <Brain className=\"w-6 h-6 text-purple-500\" />
            <div>
              <h1 className=\"text-2xl font-bold\">Intelligent Entity Enrichment</h1>
              <p className=\"text-muted-foreground\">
                Claude Agent SDK + MCP tools for adaptive sports intelligence
              </p>
            </div>
          </div>
        </div>
        
        <div className=\"flex items-center gap-4\">
          <div className=\"flex items-center gap-2\">
            <input
              type=\"checkbox\"
              id=\"autoRefresh\"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className=\"rounded\"
            />
            <label htmlFor=\"autoRefresh\" className=\"text-sm\">
              Auto-refresh
            </label>
          </div>
          
          {status?.claudeAgent?.isRunning ? (
            <Button onClick={() => {}} disabled={loading} variant=\"destructive\">
              <Pause className=\"w-4 h-4 mr-2\" />
              {loading ? 'Stopping...' : 'Running...'}
            </Button>
          ) : (
            <Button onClick={startIntelligentEnrichment} disabled={loading}>
              <Play className=\"w-4 h-4 mr-2\" />
              {loading ? 'Starting...' : 'Start Intelligence'}
            </Button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className=\"flex items-center gap-4 border-b border-custom-border pb-2\">
        <button
          onClick={() => setSelectedView('overview')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            selectedView === 'overview'
              ? 'bg-yellow-500 text-black'
              : 'text-muted-foreground hover:text-white hover:bg-custom-border'
          }`}
        >
          <BarChart3 className=\"w-4 h-4 mr-2 inline\" />
          Overview
        </button>
        <button
          onClick={() => setSelectedView('schedules')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            selectedView === 'schedules'
              ? 'bg-yellow-500 text-black'
              : 'text-muted-foreground hover:text-white hover:bg-custom-border'
          }`}
        >
          <Calendar className=\"w-4 h-4 mr-2 inline\" />
          Schedules
        </button>
        <button
          onClick={() => setSelectedView('strategies')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            selectedView === 'strategies'
              ? 'bg-yellow-500 text-black'
              : 'text-muted-foreground hover:text-white hover:bg-custom-border'
          }`}
        >
          <Target className=\"w-4 h-4 mr-2 inline\" />
          Strategies
        </button>
      </div>

      {/* Overview View */}
      {selectedView === 'overview' && (
        <div className=\"space-y-6\">
          {/* Claude Agent Status */}
          <Card>
            <CardHeader>
              <div className=\"flex items-center justify-between\">
                <div>
                  <CardTitle className=\"flex items-center gap-2\">
                    <Brain className=\"w-5 h-5\" />
                    Claude Agent Status
                    {status?.claudeAgent?.isRunning && (
                      <Badge variant=\"default\" className=\"animate-pulse bg-purple-500\">
                        Intelligence Running
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    AI-powered entity enrichment with MCP tools
                  </CardDescription>
                </div>
                
                {status?.claudeAgent?.currentBatch && (
                  <div className=\"text-right text-sm text-muted-foreground\">
                    <div>Started: {formatTimestamp(status.claudeAgent.currentBatch.startTime)}</div>
                    {status.claudeAgent.currentBatch.estimatedTimeRemaining > 0 && (
                      <div>ETA: {formatDuration(status.claudeAgent.currentBatch.estimatedTimeRemaining)}</div>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            
            {status?.claudeAgent?.currentBatch && (
              <CardContent className=\"space-y-4\">
                {/* Progress Bar */}
                <div className=\"space-y-2\">
                  <div className=\"flex justify-between text-sm\">
                    <span>Intelligence Progress</span>
                    <span>{completionPercentage}%</span>
                  </div>
                  <Progress value={completionPercentage} className=\"w-full\" />
                  <div className=\"flex justify-between text-xs text-muted-foreground\">
                    <span>{status.claudeAgent.currentBatch.processedEntities} / {status.claudeAgent.currentBatch.totalEntities} entities</span>
                    <span>Strategies: {Object.keys(status.claudeAgent.currentBatch.strategies_used || {}).length}</span>
                  </div>
                </div>

                {/* Current Entity */}
                {status.claudeAgent.isRunning && status.claudeAgent.currentBatch.currentEntity && (
                  <div className=\"bg-purple-50 p-3 rounded-lg\">
                    <div className=\"text-sm font-medium text-purple-800\">
                      Currently Processing:
                    </div>
                    <div className=\"text-sm text-purple-600\">
                      {status.claudeAgent.currentBatch.currentEntity}
                    </div>
                  </div>
                )}

                {/* Intelligence Metrics */}
                <div className=\"grid grid-cols-4 gap-4\">
                  <div className=\"text-center\">
                    <div className=\"text-2xl font-bold text-green-600\">
                      {status.claudeAgent.currentBatch.successfulEnrichments}
                    </div>
                    <div className=\"text-sm text-muted-foreground\">Successful</div>
                  </div>
                  <div className=\"text-center\">
                    <div className=\"text-2xl font-bold text-red-600\">
                      {status.claudeAgent.currentBatch.failedEnrichments}
                    </div>
                    <div className=\"text-sm text-muted-foreground\">Failed</div>
                  </div>
                  <div className=\"text-center\">
                    <div className=\"text-2xl font-bold text-blue-600\">
                      {Math.round((status.claudeAgent.currentBatch.successfulEnrichments / status.claudeAgent.currentBatch.totalEntities) * 100)}%
                    </div>
                    <div className=\"text-sm text-muted-foreground\">Success Rate</div>
                  </div>
                  <div className=\"text-center\">
                    <div className=\"text-2xl font-bold text-purple-600\">
                      {Object.keys(status.claudeAgent.currentBatch.strategies_used || {}).length}
                    </div>
                    <div className=\"text-sm text-muted-foreground\">Strategies Used</div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Capabilities Overview */}
          <div className=\"grid grid-cols-1 md:grid-cols-3 gap-4\">
            <Card>
              <CardHeader>
                <CardTitle className=\"flex items-center gap-2\">
                  <Zap className=\"w-5 h-5 text-yellow-500\" />
                  MCP Tools
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className=\"space-y-2\">
                  {status?.capabilities?.tools?.map((tool, index) => (
                    <div key={index} className=\"flex items-center gap-2 text-sm\">
                      <div className=\"w-2 h-2 rounded-full bg-green-500\" />
                      <span className=\"capitalize\">{tool.replace('-mcp', '')}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className=\"flex items-center gap-2\">
                  <Target className=\"w-5 h-5 text-blue-500\" />
                  Strategies
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className=\"space-y-2\">
                  {status?.capabilities?.strategies?.map((strategy, index) => (
                    <div key={index} className=\"flex items-center gap-2 text-sm\">
                      <div className=\"w-2 h-2 rounded-full bg-blue-500\" />
                      <span className=\"capitalize\">{strategy}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className=\"flex items-center gap-2\">
                  <Shield className=\"w-5 h-5 text-green-500\" />
                  Features
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className=\"h-32\">
                  <div className=\"space-y-2\">
                    {status?.capabilities?.features?.map((feature, index) => (
                      <div key={index} className=\"flex items-center gap-2 text-sm\">
                        <div className=\"w-2 h-2 rounded-full bg-green-500\" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Schedules View */}
      {selectedView === 'schedules' && (
        <div className=\"space-y-6\">
          <div className=\"grid grid-cols-1 md:grid-cols-2 gap-4\">
            <Card>
              <CardHeader>
                <CardTitle>Active Schedules</CardTitle>
                <CardDescription>
                  Currently running intelligent enrichment schedules
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className=\"space-y-3\">
                  {schedules.filter(s => s.enabled).map((schedule) => (
                    <div key={schedule.id} className=\"flex items-center justify-between p-3 border rounded-lg\">
                      <div>
                        <div className=\"font-medium\">{schedule.name}</div>
                        <div className=\"text-sm text-muted-foreground\">{schedule.cron}</div>
                        {schedule.nextRun && (
                          <div className=\"text-xs text-blue-600 mt-1\">
                            Next: {new Date(schedule.nextRun).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <div className=\"flex items-center gap-2\">
                        <Button
                          size=\"sm\"
                          onClick={() => triggerSchedule(schedule.id)}
                          disabled={loading}
                        >
                          <Play className=\"w-3 h-3\" />
                        </Button>
                        <Button
                          size=\"sm\"
                          variant=\"outline\"
                          onClick={() => toggleSchedule(schedule.id, false)}
                        >
                          <Pause className=\"w-3 h-3\" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {schedules.filter(s => s.enabled).length === 0 && (
                    <div className=\"text-center text-muted-foreground py-4\">
                      No active schedules configured
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Inactive Schedules</CardTitle>
                <CardDescription>
                  Available schedules that can be enabled
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className=\"space-y-3\">
                  {schedules.filter(s => !s.enabled).map((schedule) => (
                    <div key={schedule.id} className=\"flex items-center justify-between p-3 border rounded-lg opacity-60\">
                      <div>
                        <div className=\"font-medium\">{schedule.name}</div>
                        <div className=\"text-sm text-muted-foreground\">{schedule.cron}</div>
                      </div>
                      <Button
                        size=\"sm\"
                        onClick={() => toggleSchedule(schedule.id, true)}
                      >
                        <Play className=\"w-3 h-3\" />
                      </Button>
                    </div>
                  ))}
                  {schedules.filter(s => !s.enabled).length === 0 && (
                    <div className=\"text-center text-muted-foreground py-4\">
                      All schedules are active
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Strategies View */}
      {selectedView === 'strategies' && (
        <div className=\"space-y-6\">
          <div className=\"grid grid-cols-1 md:grid-cols-3 gap-4\">
            <Card>
              <CardHeader>
                <CardTitle className=\"flex items-center gap-2\">
                  <TrendingUp className=\"w-5 h-5 text-green-500\" />
                  Intensive Strategy
                </CardTitle>
                <CardDescription>
                  Deep analysis for high-value entities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className=\"space-y-2 text-sm\">
                  <div>• Full BrightData scraping</div>
                  <div>• Comprehensive Perplexity analysis</div>
                  <div>• Relationship network mapping</div>
                  <div>• Market intelligence synthesis</div>
                  <div>• Confidence score validation</div>
                  <div className=\"mt-2 font-medium text-green-600\">Target: Top 20% entities</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className=\"flex items-center gap-2\">
                  <BarChart3 className=\"w-5 h-5 text-blue-500\" />
                  Standard Strategy
                </CardTitle>
                <CardDescription>
                  Balanced analysis for most entities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className=\"space-y-2 text-sm\">
                  <div>• Focused BrightData scraping</div>
                  <div>• Targeted Perplexity research</div>
                  <div>• Key relationship analysis</div>
                  <div>• Market context updates</div>
                  <div>• Quality validation</div>
                  <div className=\"mt-2 font-medium text-blue-600\">Target: Middle 60% entities</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className=\"flex items-center gap-2\">
                  <Clock className=\"w-5 h-5 text-orange-500\" />
                  Quick Strategy
                </CardTitle>
                <CardDescription>
                  Rapid updates for low-priority entities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className=\"space-y-2 text-sm\">
                  <div>• Selective BrightData scraping</div>
                  <div>• Quick Perplexity updates</div>
                  <div>• Basic relationship checks</div>
                  <div>• Fresh data validation</div>
                  <div>• Minimal processing</div>
                  <div className=\"mt-2 font-medium text-orange-600\">Target: Bottom 20% entities</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}