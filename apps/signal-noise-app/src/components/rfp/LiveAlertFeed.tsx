/**
 * 🚨 Live Alert Feed Component
 * 
 * Real-time feed of changes to people and companies
 * Matches the style of commercial monitoring platforms
 */

'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, UserPlus, ArrowBigUpDash, ArrowBigDownDash, MessageSquare, Globe, Clock, Star, ExternalLink, Brain, Target, AlertTriangle } from 'lucide-react';
import { activityLogger } from '@/lib/activity-logger';

interface LiveAlert {
  id: string;
  type: 'hiring' | 'promotion' | 'departure' | 'post' | 'traffic' | 'job_listing';
  entity: string;
  entityUrl?: string;
  description: string;
  impact: number; // Percentage change
  timestamp: string;
  source: string;
  importance: 'high' | 'medium' | 'low';
  details?: Record<string, any>;
  reasoning?: {
    significance: 'critical' | 'high' | 'medium' | 'low';
    urgency: 'immediate' | 'high' | 'medium' | 'low';
    businessImpact: string;
    recommendedActions: string[];
    opportunityScore: number;
    confidenceLevel: number;
  };
  insights?: {
    strategicImplications: string[];
    tacticalRecommendations: string[];
  };
}

interface LiveAlertFeedProps {
  maxHeight?: string;
  compact?: boolean;
  showFilters?: boolean;
}

export const LiveAlertFeed: React.FC<LiveAlertFeedProps> = ({
  maxHeight = '400px',
  compact = false,
  showFilters = true
}) => {
  const [alerts, setAlerts] = useState<LiveAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);

  // Mock data to demonstrate the interface
  const mockAlerts: LiveAlert[] = [
    {
      id: 'alert-1',
      type: 'traffic',
      entity: 'Podium',
      entityUrl: 'https://podium.com',
      description: 'web traffic increased',
      impact: 108.4,
      timestamp: new Date().toISOString(),
      source: 'web_analytics',
      importance: 'high',
      details: { currentVisitors: '45.2K', changePercent: 108.4 }
    },
    {
      id: 'alert-2',
      type: 'hiring',
      entity: 'Magnitude',
      entityUrl: 'https://magnitude.com',
      description: 'hired 6 people',
      impact: 8.2,
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      source: 'linkedin',
      importance: 'medium',
      details: { newHires: 6, departments: ['Engineering', 'Sales'] }
    },
    {
      id: 'alert-3',
      type: 'promotion',
      entity: 'Taylor Morgan',
      entityUrl: 'https://linkedin.com/in/taylor-morgan',
      description: 'was promoted to CMO',
      impact: 0,
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      source: 'linkedin',
      importance: 'high',
      details: { previousRole: 'VP Marketing', newRole: 'CMO', company: 'TechCorp' }
    },
    {
      id: 'alert-4',
      type: 'job_listing',
      entity: 'Payhawk',
      entityUrl: 'https://payhawk.com',
      description: 'listed 4 jobs',
      impact: 0,
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      source: 'company_careers',
      importance: 'medium',
      details: { jobCount: 4, roles: ['Senior Developer', 'Sales Manager'] }
    },
    {
      id: 'alert-5',
      type: 'departure',
      entity: 'Ryan Sullivan',
      entityUrl: 'https://linkedin.com/in/ryan-sullivan',
      description: 'left Spotify',
      impact: 0,
      timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      source: 'linkedin',
      importance: 'high',
      details: { previousRole: 'Senior Product Manager', company: 'Spotify' }
    },
    {
      id: 'alert-6',
      type: 'post',
      entity: 'Cristala Jones',
      entityUrl: 'https://linkedin.com/in/cristala-jones',
      description: 'shared a new post',
      impact: 0,
      timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      source: 'linkedin',
      importance: 'low',
      details: { postTopic: 'industry insights', engagement: 'high' }
    }
  ];

  const loadAlerts = async () => {
    setLoading(true);
    try {
      let alertsData;
      
      if (showReasoning) {
        // Fetch reasoned alerts with intelligence
        const response = await fetch('/api/entity-scaling?action=reasoned-alerts');
        const data = await response.json();
        
        if (data.success) {
          alertsData = data.data.map((alert: any) => ({
            id: alert.originalAlert.id,
            type: alert.originalAlert.type,
            entity: alert.originalAlert.entity,
            description: alert.originalAlert.description,
            impact: alert.originalAlert.impact,
            timestamp: alert.originalAlert.timestamp,
            source: alert.originalAlert.source,
            importance: alert.reasoning.significance === 'critical' ? 'high' : 
                      alert.reasoning.significance === 'high' ? 'medium' : 'low',
            reasoning: alert.reasoning,
            insights: alert.insights
          }));
        } else {
          alertsData = mockAlerts;
        }
      } else {
        // Fetch real-time alerts from API
        const response = await fetch('/api/live-alerts?limit=20');
        const data = await response.json();
        
        if (data.success) {
          alertsData = data.data;
        } else {
          console.error('API error:', data.error);
          alertsData = mockAlerts;
        }
      }
      
      setAlerts(alertsData);
    } catch (error) {
      console.error('Error loading alerts:', error);
      setAlerts(mockAlerts);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await loadAlerts();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [showReasoning]); // Reload when reasoning toggle changes

  useEffect(() => {
    // Start real-time monitoring
    const startMonitoring = async () => {
      try {
        await fetch('/api/live-alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'start_monitoring' })
        });
      } catch (error) {
        console.warn('Could not start monitoring:', error);
      }
    };

    startMonitoring();
    
    // Auto-refresh every 30 seconds for live feel
    const interval = setInterval(loadAlerts, 30000);
    return () => {
      clearInterval(interval);
      // Stop monitoring when component unmounts
      fetch('/api/live-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop_monitoring' })
      }).catch(() => {});
    };
  }, []);

  const getAlertIcon = (type: string) => {
    const iconMap = {
      'hiring': <UserPlus className="w-4 h-4" />,
      'promotion': <ArrowBigUpDash className="w-4 h-4" />,
      'departure': <ArrowBigDownDash className="w-4 h-4" />,
      'post': <MessageSquare className="w-4 h-4" />,
      'traffic': <TrendingUp className="w-4 h-4" />,
      'job_listing': <Star className="w-4 h-4" />
    };
    return iconMap[type as keyof typeof iconMap] || <Clock className="w-4 h-4" />;
  };

  const getImportanceColor = (importance: string) => {
    const colorMap = {
      'high': 'border-red-500 bg-red-50',
      'medium': 'border-yellow-500 bg-yellow-50',
      'low': 'border-blue-500 bg-blue-50'
    };
    return colorMap[importance as keyof typeof colorMap] || 'border-gray-500 bg-gray-50';
  };

  const getImportanceBadgeColor = (importance: string) => {
    const colorMap = {
      'high': 'bg-red-100 text-red-800',
      'medium': 'bg-yellow-100 text-yellow-800',
      'low': 'bg-blue-100 text-blue-800'
    };
    return colorMap[importance as keyof typeof colorMap] || 'bg-gray-100 text-gray-800';
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInHours = Math.floor((now.getTime() - time.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const handleAlertClick = async (alert: LiveAlert) => {
    // Log alert interaction
    await activityLogger.logActivity('alert_viewed', {
      opportunityId: `alert-${alert.id}`,
      opportunityTitle: `${alert.entity}: ${alert.description}`,
      organization: alert.entity,
      category: 'view',
      impact: 'low',
      details: {
        alertType: alert.type,
        source: alert.source,
        importance: alert.importance
      }
    });

    // Open external link if available
    if (alert.entityUrl) {
      window.open(alert.entityUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const filteredAlerts = filter === 'all' 
    ? alerts 
    : alerts.filter(alert => alert.importance === filter);

  return (
    <div className="bg-custom-box border border-custom-border rounded-lg shadow">
      {/* Header */}
      <div className="p-4 border-b border-custom-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <h3 className="font-subheader text-fm-white">Live Data</h3>
            {!compact && (
              <span className="font-body-secondary text-fm-meta">
                ({alerts.length} active)
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {!compact && (
              <button
                onClick={() => setShowReasoning(!showReasoning)}
                className={`px-3 py-1 text-sm border rounded flex items-center space-x-1 transition-colors ${
                  showReasoning 
                    ? 'bg-fm-yellow text-custom-bg border-fm-yellow' 
                    : 'border-custom-border text-fm-medium-grey hover:text-fm-white'
                }`}
                title={showReasoning ? "Show raw alerts" : "Show AI-reasoned alerts"}
              >
                <Brain className="w-3 h-3" />
                <span>{showReasoning ? "Reasoned" : "Raw"}</span>
              </button>
            )}
            {showFilters && !compact && (
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="px-3 py-1 text-sm border border-custom-border rounded bg-custom-bg text-fm-white"
              >
                <option value="all">All Alerts</option>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            )}
            
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 text-fm-medium-grey hover:text-fm-white transition-colors disabled:opacity-50"
              title="Refresh alerts"
            >
              <Clock className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        
        {!compact && (
          <p className="font-body-secondary text-fm-meta mt-2">
            Live alerts on changes to people and companies you care about
          </p>
        )}
      </div>

      {/* Alerts List */}
      <div 
        className="overflow-y-auto"
        style={{ maxHeight }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-fm-yellow"></div>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="text-center text-fm-meta py-8">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No alerts found</p>
            <p className="text-sm mt-1">Live alerts will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-custom-border">
            {filteredAlerts.map((alert) => (
              <div 
                key={alert.id} 
                className={`p-4 hover:bg-custom-bg transition-colors cursor-pointer border-l-4 ${getImportanceColor(alert.importance)}`}
                onClick={() => handleAlertClick(alert)}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-8 h-8 rounded-full bg-fm-yellow text-custom-bg flex items-center justify-center">
                      {getAlertIcon(alert.type)}
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-body-primary text-fm-white">
                          {alert.entity}
                        </span>
                        
                        {alert.impact > 0 && (
                          <span className="text-green-600 font-body-medium">
                            +{alert.impact}%
                          </span>
                        )}
                        
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getImportanceBadgeColor(alert.importance)}`}>
                          {alert.importance}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-1 text-xs text-fm-meta">
                        <span>{formatTimeAgo(alert.timestamp)}</span>
                        {alert.entityUrl && (
                          <ExternalLink className="w-3 h-3" />
                        )}
                      </div>
                    </div>
                    
                    <p className="font-body-secondary text-fm-medium-grey mt-1">
                      {alert.description}
                    </p>
                    
                    {/* Reasoning Intelligence */}
                    {alert.reasoning && showReasoning && (
                      <div className="mt-3 p-3 bg-custom-bg rounded text-xs border-l-2 border-fm-yellow">
                        <div className="flex items-center space-x-2 mb-2">
                          <Brain className="w-3 h-3 text-fm-yellow" />
                          <span className="font-body-medium text-fm-yellow">AI Analysis</span>
                          <span className="text-fm-meta">
                            Confidence: {alert.reasoning.confidenceLevel}% | 
                            Opportunity: {alert.reasoning.opportunityScore}/100
                          </span>
                        </div>
                        
                        <div className="space-y-1">
                          <div>
                            <span className="font-body-medium text-fm-light-grey">Impact: </span>
                            <span className="text-fm-medium-grey">{alert.reasoning.businessImpact}</span>
                          </div>
                          
                          {alert.reasoning.significance && (
                            <div className="flex items-center space-x-2">
                              <span className="font-body-medium text-fm-light-grey">Significance:</span>
                              <span className={`px-2 py-0.5 text-xs rounded ${
                                alert.reasoning.significance === 'critical' ? 'bg-red-100 text-red-800' :
                                alert.reasoning.significance === 'high' ? 'bg-orange-100 text-orange-800' :
                                alert.reasoning.significance === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {alert.reasoning.significance}
                              </span>
                              <span className={`px-2 py-0.5 text-xs rounded ${
                                alert.reasoning.urgency === 'immediate' ? 'bg-red-100 text-red-800' :
                                alert.reasoning.urgency === 'high' ? 'bg-orange-100 text-orange-800' :
                                alert.reasoning.urgency === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {alert.reasoning.urgency}
                              </span>
                            </div>
                          )}
                          
                          {alert.reasoning.recommendedActions && alert.reasoning.recommendedActions.length > 0 && (
                            <div>
                              <span className="font-body-medium text-fm-light-grey">Actions: </span>
                              <span className="text-fm-medium-grey">{alert.reasoning.recommendedActions[0]}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {alert.details && !compact && (
                      <div className="mt-2 text-xs text-fm-meta">
                        {Object.entries(alert.details).map(([key, value]) => (
                          <span key={key} className="mr-3">
                            {key}: {typeof value === 'string' ? value : JSON.stringify(value)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {!compact && alerts.length > 0 && (
        <div className="p-4 border-t border-custom-border text-center">
          <button
            onClick={() => setFilter('all')}
            className="text-fm-medium-grey hover:text-fm-white text-sm transition-colors"
          >
            View all alerts in detailed analysis
          </button>
        </div>
      )}
    </div>
  );
};

export default LiveAlertFeed;