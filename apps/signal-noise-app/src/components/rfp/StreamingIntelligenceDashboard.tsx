'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useCopilotReadable, useCopilotAction } from '@copilotkit/react-core';
import DynamicStatusClaude from '@/components/DynamicStatusClaude';
import EmailComposeModal from '@/components/email/EmailComposeModal';

interface StreamingEvent {
  type: 'tier1_rfp_analyzed' | 'batch_enrichment_complete' | 'memory_updated' | 'system_status' | 'ping';
  timestamp: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  data: any;
}

interface RFPAlert {
  id: string;
  organization: string;
  sport: string;
  fit_score: number;
  urgency: string;
  estimated_value: string;
  status: 'discovered' | 'analyzing' | 'analyzed' | 'enriched';
  discovered_at: string;
  entity_tier: 1 | 2 | 3;
  insights?: any;
  recommendations?: string[];
  processing_details?: {
    claude_analysis: boolean;
    neo4j_synced: boolean;
    supabase_cached: boolean;
    memory_updated: boolean;
  };
}

interface StreamingDashboardProps {
  className?: string;
}

export default function StreamingIntelligenceDashboard({ className }: StreamingDashboardProps) {
  const [alerts, setAlerts] = useState<RFPAlert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<RFPAlert | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [liveEvents, setLiveEvents] = useState<StreamingEvent[]>([]);
  const [filters, setFilters] = useState({
    tier: undefined as 1 | 2 | 3 | undefined,
    sport: '',
    min_fit_score: 70
  });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [systemStats, setSystemStats] = useState({
    total_processed: 0,
    tier1_count: 0,
    tier2_count: 0,
    tier3_count: 0,
    cache_hit_rate: 0,
    neo4j_sync_status: 'connected'
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Establish SSE connection for real-time updates
   */
  const connectToStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const params = new URLSearchParams();
    if (filters.tier) params.append('tier', filters.tier.toString());
    if (filters.sport) params.append('sport', filters.sport);
    if (filters.min_fit_score) params.append('min_fit_score', filters.min_fit_score.toString());

    const eventSource = new EventSource(`/api/streaming/events?${params.toString()}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('🔗 Connected to intelligence stream');
      setIsConnected(true);
      
      // Clear any pending reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    eventSource.onmessage = (event) => {
      try {
        const streamingEvent: StreamingEvent = JSON.parse(event.data);
        
        if (streamingEvent.type === 'ping') {
          // Ping received - connection is alive
          return;
        }

        console.log(`📨 Stream event: ${streamingEvent.type}`, streamingEvent.data);
        
        // Add to live events feed
        setLiveEvents(prev => [streamingEvent, ...prev.slice(0, 49)]); // Keep last 50 events

        // Process different event types
        switch (streamingEvent.type) {
          case 'tier1_rfp_analyzed':
            handleTier1RFPEvent(streamingEvent);
            break;
          case 'batch_enrichment_complete':
            handleBatchEnrichmentEvent(streamingEvent);
            break;
          case 'memory_updated':
            handleMemoryUpdateEvent(streamingEvent);
            break;
          case 'system_status':
            handleSystemStatusEvent(streamingEvent);
            break;
        }

      } catch (error) {
        console.error('Failed to parse streaming event:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('Stream connection error:', error);
      setIsConnected(false);
      eventSource.close();
      
      // Attempt reconnection after 5 seconds
      if (autoRefresh) {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('🔄 Attempting to reconnect to stream...');
          connectToStream();
        }, 5000);
      }
    };

  }, [filters, autoRefresh]);

  /**
   * Handle Tier 1 RFP analysis events
   */
  const handleTier1RFPEvent = (event: StreamingEvent) => {
    const { organization, fit_score, insights, rfp_id } = event.data;
    
    setAlerts(prev => {
      const existing = prev.find(alert => alert.id === rfp_id);
      if (existing) {
        // Update existing alert
        return prev.map(alert => 
          alert.id === rfp_id 
            ? {
                ...alert,
                status: 'analyzed' as const,
                insights,
                processing_details: {
                  claude_analysis: true,
                  neo4j_synced: true,
                  supabase_cached: true,
                  memory_updated: true
                }
              }
            : alert
        );
      } else {
        // Add new alert
        const newAlert: RFPAlert = {
          id: rfp_id,
          organization,
          sport: event.data.sport,
          fit_score,
          urgency: event.data.urgency,
          estimated_value: event.data.estimated_value,
          status: 'analyzed',
          discovered_at: event.timestamp,
          entity_tier: 1,
          insights,
          processing_details: {
            claude_analysis: true,
            neo4j_synced: true,
            supabase_cached: true,
            memory_updated: true
          }
        };
        return [newAlert, ...prev];
      }
    });

    // Update system stats
    setSystemStats(prev => ({
      ...prev,
      total_processed: prev.total_processed + 1,
      tier1_count: prev.tier1_count + 1
    }));
  };

  /**
   * Handle batch enrichment events
   */
  const handleBatchEnrichmentEvent = (event: StreamingEvent) => {
    const { entity_id, organization, tier, summary } = event.data;
    
    setAlerts(prev => {
      const existing = prev.find(alert => alert.id === entity_id);
      if (existing) {
        return prev.map(alert => 
          alert.id === entity_id 
            ? { ...alert, status: 'enriched' as const, insights: summary }
            : alert
        );
      }
      // Note: Batch events typically update existing alerts, not create new ones
    });

    // Update system stats
    setSystemStats(prev => ({
      ...prev,
      total_processed: prev.total_processed + 1,
      [`tier${tier}_count`]: prev[`tier${tier}_count` as keyof typeof prev] + 1
    }));
  };

  /**
   * Handle memory update events
   */
  const handleMemoryUpdateEvent = (event: StreamingEvent) => {
    console.log('📝 Memory updated:', event.data.summary);
  };

  /**
   * Handle system status events
   */
  const handleSystemStatusEvent = (event: StreamingEvent) => {
    const { neo4j_status, cache_performance, processing_queue } = event.data;
    
    setSystemStats(prev => ({
      ...prev,
      neo4j_sync_status: neo4j_status || prev.neo4j_sync_status,
      cache_hit_rate: cache_performance?.hit_rate || prev.cache_hit_rate
    }));
  };

  /**
   * Initialize connection and load initial data
   */
  useEffect(() => {
    if (autoRefresh) {
      connectToStream();
      
      // Load initial data
      loadInitialAlerts();
      loadSystemStats();
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [autoRefresh, connectToStream]);

  /**
   * Load initial alerts from cache/API
   */
  const loadInitialAlerts = async () => {
    try {
      const response = await fetch('/api/entities?limit=20&useCache=true');
      if (response.ok) {
        const data = await response.json();
        const initialAlerts = data.entities.map((entity: any) => ({
          id: entity.id,
          organization: entity.properties.organization || entity.properties.name,
          sport: entity.properties.sport,
          fit_score: entity.properties.yellow_panther_fit || entity.properties.opportunityScore,
          urgency: entity.properties.urgency || 'MEDIUM',
          estimated_value: entity.properties.estimated_value || '£250K-£500K',
          status: 'discovered' as const,
          discovered_at: entity.properties.discovered_at || new Date().toISOString(),
          entity_tier: entity.properties.entity_tier || 2
        }));
        
        setAlerts(initialAlerts);
      }
    } catch (error) {
      console.error('Failed to load initial alerts:', error);
    }
  };

  /**
   * Load system statistics
   */
  const loadSystemStats = async () => {
    try {
      // Load cache stats
      const cacheResponse = await fetch('/api/cache/stats');
      if (cacheResponse.ok) {
        const cacheStats = await cacheResponse.json();
        setSystemStats(prev => ({
          ...prev,
          cache_hit_rate: cacheStats.hit_rate || 0
        }));
      }
    } catch (error) {
      console.error('Failed to load system stats:', error);
    }
  };

  /**
   * Get priority color for badges
   */
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'bg-red-500';
      case 'HIGH': return 'bg-orange-500';
      case 'MEDIUM': return 'bg-yellow-500';
      case 'LOW': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  /**
   * Get fit score color
   */
  const getFitScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  /**
   * Share context with CopilotKit
   */
  useCopilotReadable({
    description: "Real-time RFP Intelligence Dashboard - current alerts, streaming events, and system status",
    value: {
      selectedAlert: selectedAlert ? {
        organization: selectedAlert.organization,
        sport: selectedAlert.sport,
        fit_score: selectedAlert.fit_score,
        urgency: selectedAlert.urgency,
        tier: selectedAlert.entity_tier,
        status: selectedAlert.status,
        insights: selectedAlert.insights
      } : null,
      alerts: alerts.slice(0, 10), // Share top 10 alerts
      systemStats,
      isConnected,
      liveEvents: liveEvents.slice(0, 5) // Share recent events
    }
  });

  /**
   * CopilotKit actions for AI interaction
   */
  useCopilotAction({
    name: "selectAlertByOrganization",
    description: "Select an RFP alert by organization name",
    parameters: [
      {
        name: "organizationName",
        type: "string",
        description: "The name of the organization to select",
        required: true
      }
    ],
    handler: async ({ organizationName }) => {
      const alert = alerts.find(a => 
        a.organization.toLowerCase().includes(organizationName.toLowerCase())
      );
      if (alert) {
        setSelectedAlert(alert);
        return `Selected ${alert.organization} (Tier ${alert.entity_tier}, Fit Score: ${alert.fit_score}%)`;
      } else {
        return `Could not find alert for organization: ${organizationName}`;
      }
    }
  });

  useCopilotAction({
    name: "openEmailForSelectedAlert",
    description: "Open email compose modal for selected alert",
    parameters: [],
    handler: async () => {
      if (selectedAlert) {
        setIsEmailModalOpen(true);
        return `Opening email compose for ${selectedAlert.organization}`;
      } else {
        return "No alert selected. Please select an alert first.";
      }
    }
  });

  const getContactFromAlert = useCallback((alert: RFPAlert | null) => {
    if (!alert) return null;
    
    return {
      id: alert.id,
      name: `Contact at ${alert.organization}`,
      email: `contact@${alert.organization.toLowerCase().replace(/\s+/g, '')}.com`,
      role: 'Procurement Decision Maker',
      affiliation: alert.organization,
      tags: ['RFP', alert.sport, alert.urgency, alert.entity_tier.toString()]
    };
  }, []);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Live Intelligence Stream</h2>
          <p className="text-muted-foreground">
            Real-time RFP analysis with Claude Agent SDK + Neo4j + Supabase
          </p>
        </div>
        <div className=\"flex items-center space-x-4\">
          <div className=\"flex items-center space-x-2\">
            <Switch
              id=\"auto-refresh\"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <Label htmlFor=\"auto-refresh\">Auto Refresh</Label>
          </div>
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className=\"text-sm text-muted-foreground\">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      <div className=\"grid grid-cols-1 lg:grid-cols-3 gap-6\">
        {/* Main Alerts Panel */}
        <div className=\"lg:col-span-2 space-y-4\">
          {/* System Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className=\"text-lg\">System Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className=\"grid grid-cols-2 md:grid-cols-4 gap-4 text-center\">
                <div>
                  <div className=\"text-2xl font-bold text-blue-600\">{systemStats.total_processed}</div>
                  <div className=\"text-sm text-muted-foreground\">Total Processed</div>
                </div>
                <div>
                  <div className=\"text-2xl font-bold text-green-600\">{systemStats.tier1_count}</div>
                  <div className=\"text-sm text-muted-foreground\">Tier 1 (Real-time)</div>
                </div>
                <div>
                  <div className=\"text-2xl font-bold text-yellow-600\">{systemStats.tier2_count}</div>
                  <div className=\"text-sm text-muted-foreground\">Tier 2 (Batch)</div>
                </div>
                <div>
                  <div className=\"text-2xl font-bold text-purple-600\">{systemStats.cache_hit_rate.toFixed(1)}%</div>
                  <div className=\"text-sm text-muted-foreground\">Cache Hit Rate</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* RFP Alerts List */}
          <Card>
            <CardHeader>
              <CardTitle className=\"flex items-center justify-between\">
                RFP Intelligence Alerts
                <Badge variant=\"outline\">{alerts.length} active</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className=\"h-[500px]\">
                <div className=\"space-y-3\">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                        selectedAlert?.id === alert.id ? 'ring-2 ring-blue-500' : ''
                      }`}
                      onClick={() => setSelectedAlert(alert)}
                    >
                      <div className=\"flex items-start justify-between\">
                        <div className=\"flex-1 min-w-0\">
                          <div className=\"flex items-center space-x-2 mb-2\">
                            <div className={`w-2 h-2 rounded-full ${getPriorityColor(alert.urgency)}`} />
                            <span className=\"text-xs px-2 py-1 bg-gray-100 rounded\">Tier {alert.entity_tier}</span>
                            <h3 className=\"font-semibold truncate\">{alert.organization}</h3>
                          </div>
                          <p className=\"text-sm text-muted-foreground mb-2\">
                            {alert.sport} • Fit Score: <span className={getFitScoreColor(alert.fit_score)}>{alert.fit_score}%</span>
                          </p>
                          <p className=\"text-sm text-muted-foreground mb-2\">
                            {alert.estimated_value} • {alert.urgency} urgency
                          </p>
                          <div className=\"flex items-center space-x-2 mb-2\">
                            <Badge variant={alert.status === 'analyzed' ? 'default' : 'secondary'}>
                              {alert.status}
                            </Badge>
                            {alert.processing_details && (
                              <div className=\"flex items-center space-x-1\">
                                {alert.processing_details.claude_analysis && <span className=\"text-xs\">🤖</span>}
                                {alert.processing_details.neo4j_synced && <span className=\"text-xs\">🔗</span>}
                                {alert.processing_details.supabase_cached && <span className=\"text-xs\">💾</span>}
                                {alert.processing_details.memory_updated && <span className=\"text-xs\">📝</span>}
                              </div>
                            )}
                          </div>
                          <p className=\"text-xs text-muted-foreground\">
                            {new Date(alert.discovered_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Side Panel */}
        <div className=\"space-y-4\">
          {/* Selected Alert Details */}
          {selectedAlert && (
            <Card>
              <CardHeader>
                <CardTitle className=\"text-lg\">{selectedAlert.organization} Analysis</CardTitle>
              </CardHeader>
              <CardContent className=\"space-y-4\">
                <div className=\"grid grid-cols-2 gap-4 text-center\">
                  <div>
                    <div className=\"text-xl font-bold text-blue-600\">{selectedAlert.fit_score}%</div>
                    <div className=\"text-sm text-muted-foreground\">Fit Score</div>
                  </div>
                  <div>
                    <div className=\"text-xl font-bold text-green-600\">{selectedAlert.estimated_value}</div>
                    <div className=\"text-sm text-muted-foreground\">Est. Value</div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className=\"font-semibold mb-2\">Processing Details</h4>
                  <div className=\"space-y-1 text-sm\">
                    <div className=\"flex justify-between\">
                      <span>Claude Analysis:</span>
                      <span>{selectedAlert.processing_details?.claude_analysis ? '✅ Complete' : '⏳ Pending'}</span>
                    </div>
                    <div className=\"flex justify-between\">
                      <span>Neo4j Sync:</span>
                      <span>{selectedAlert.processing_details?.neo4j_synced ? '✅ Synced' : '⏳ Pending'}</span>
                    </div>
                    <div className=\"flex justify-between\">
                      <span>Cache Status:</span>
                      <span>{selectedAlert.processing_details?.supabase_cached ? '✅ Cached' : '⏳ Pending'}</span>
                    </div>
                    <div className=\"flex justify-between\">
                      <span>Memory Updated:</span>
                      <span>{selectedAlert.processing_details?.memory_updated ? '✅ Updated' : '⏳ Pending'}</span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className=\"space-y-2\">
                  <Button className=\"w-full\" onClick={() => setIsEmailModalOpen(true)}>
                    📧 Compose Outreach Email
                  </Button>
                  <Button variant=\"outline\" className=\"w-full\">
                    📊 View Full Analysis
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Live Events Feed */}
          <Card>
            <CardHeader>
              <CardTitle className=\"text-lg\">Live Events Feed</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className=\"h-[300px]\">
                <div className=\"space-y-2\">
                  {liveEvents.slice(0, 20).map((event, index) => (
                    <div key={`${event.timestamp}-${index}`} className=\"p-2 border rounded text-sm\">
                      <div className=\"flex items-center justify-between mb-1\">
                        <span className=\"font-medium\">{event.type.replace(/_/g, ' ')}</span>
                        <span className=\"text-xs text-muted-foreground\">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      {event.data.organization && (
                        <div className=\"text-muted-foreground\">{event.data.organization}</div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Email Compose Modal */}
      <EmailComposeModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        contact={getContactFromAlert(selectedAlert)}
      />
    </div>
  );
}