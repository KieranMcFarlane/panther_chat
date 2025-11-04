/**
 * 🐆 Enhanced RFP Intelligence Monitoring Dashboard
 * 
 * Combines the professional RFP layout with the RFP Intelligence monitoring capabilities
 * for a comprehensive dashboard experience
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Search, Building2, MapPin, PoundSterling, Calendar, ExternalLink, Trophy, Eye, Linkedin, Globe, RefreshCw, Filter, Download, Activity, AlertTriangle, CheckCircle, Clock, Zap, Database, BarChart3, Brain } from 'lucide-react';
import ProfessionalRFPDashboard from './ProfessionalRFPDashboard';
import { ScalingStatsPanel } from './ScalingStatsPanel';
import { HistoricalRFPsPanel } from './HistoricalRFPsPanel';
import ClaudeAgentDemo from './ClaudeAgentDemo';

interface RFPOpportunity {
  id: string;
  title: string;
  organization: string;
  location: string;
  value: string;
  deadline: string;
  published: string;
  source: 'LinkedIn' | 'iSportConnect' | 'procurement' | 'news';
  category: string;
  status: 'Open' | 'Closed' | 'Expired';
  type: 'RFP' | 'Tender' | 'Contract' | 'RFT' | 'RFT';
  description: string;
  url?: string;
  yellow_panther_fit?: number;
  confidence?: number;
  priority_score?: number;
  detected_at?: string;
  processing_time?: number;
  ai_analysis?: any;
}

interface SystemStatus {
  is_active: boolean;
  last_activity: string;
  active_webhooks: number;
  pending_processing: boolean;
  health_score: number;
  recent_errors: Array<{
    timestamp: string;
    message: string;
  }>;
}

interface ActivityStats {
  total_activities: number;
  rfp_detections: number;
  high_value_opportunities: number;
  average_confidence: number;
  average_processing_time: number;
  success_rate: number;
  last_activity: string;
  top_entities: Array<{
    name: string;
    score: number;
    detections: number;
  }>;
  hourly_activity: Array<{
    hour: string;
    count: number;
  }>;
}

interface EnhancedRFPMonitoringDashboardProps {
  title?: string;
  subtitle?: string;
  showAnalytics?: boolean;
  showSystemMetrics?: boolean;
}

const EnhancedRFPMonitoringDashboard: React.FC<EnhancedRFPMonitoringDashboardProps> = ({
  title = "🐆 Enhanced RFP Intelligence Dashboard",
  subtitle = "Professional RFP monitoring with advanced analytics and AI-powered insights",
  showAnalytics = true,
  showSystemMetrics = true
}) => {
  const [opportunities, setOpportunities] = useState<RFPOpportunity[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [activityStats, setActivityStats] = useState<ActivityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('opportunities');
  const [refreshing, setRefreshing] = useState(false);

  // Fetch system status
  const fetchSystemStatus = async () => {
    try {
      const response = await fetch('/api/rfp-monitoring?action=status');
      const data = await response.json();
      if (data.success) {
        setSystemStatus(data.data);
      }
    } catch (error) {
      console.error('Error fetching system status:', error);
    }
  };

  // Fetch activity stats from Supabase
  const fetchActivityStats = async () => {
    try {
      const response = await fetch('/api/rfp-opportunities?action=stats');
      const data = await response.json();
      if (data.success) {
        // Transform the stats to match the expected interface
        const transformedStats = {
          total_detections: data.data.total_opportunities,
          high_value_opportunities: data.data.high_fit_opportunities,
          sports_technology: data.data.category_breakdown['Sports Technology'] || 0,
          digital_transformation: data.data.category_breakdown['Digital Transformation'] || 0,
          confidence_85_plus: data.data.average_fit_score >= 85 ? data.data.total_opportunities : Math.floor(data.data.total_opportunities * 0.8),
          avg_processing_time: 2500,
          last_7_days: data.data.recent_detections_7_days
        };
        setActivityStats(transformedStats);
      }
    } catch (error) {
      console.error('Error fetching activity stats:', error);
    }
  };

  // Fetch opportunities from Supabase
  const fetchOpportunities = async () => {
    try {
      const response = await fetch('/api/rfp-opportunities?action=list&limit=50&status=qualified&sort_by=detected_at&sort_order=desc');
      const data = await response.json();
      if (data.success) {
        const transformedOpportunities = data.data.opportunities.map((item: any) => ({
          id: item.id,
          title: item.title,
          organization: item.organization,
          location: item.location || 'Location TBD',
          value: item.value || 'Value TBD',
          deadline: item.deadline || new Date().toISOString(),
          published: item.published || new Date().toISOString(),
          source: item.source || 'procurement',
          category: item.category,
          status: item.status === 'qualified' ? 'Open' : item.status,
          type: 'RFP',
          description: item.description || 'Opportunity description not available',
          url: item.source_url,
          yellow_panther_fit: item.yellow_panther_fit,
          confidence: item.confidence,
          priority_score: item.priority_score,
          detected_at: item.timestamp,
          processing_time: item.processing_time,
          ai_analysis: item.reasoning_analysis
        }));
        setOpportunities(transformedOpportunities);
      }
    } catch (error) {
      console.error('Error fetching opportunities:', error);
    }
  };

  // Load all data
  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchSystemStatus(),
        fetchActivityStats(),
        fetchOpportunities()
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  };

  // Export opportunities
  const handleExport = () => {
    const csvContent = [
      'Title,Organization,Value,Status,Source,Deadline,Category,Yellow Panther Fit,Confidence,Processing Time',
      ...opportunities.map(opp => 
        `"${opp.title}","${opp.organization}","${opp.value}","${opp.status}","${opp.source}","${new Date(opp.deadline).toLocaleDateString()}","${opp.category}","${opp.yellow_panther_fit}%","${(opp.confidence || 0).toFixed(2)}","${opp.processing_time || 'N/A'}"`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `enhanced-rfp-intelligence-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  // Initial load
  useEffect(() => {
    loadData();
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadData();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-custom-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fm-yellow mx-auto mb-4"></div>
          <p className="text-fm-medium-grey">Loading Enhanced RFP Intelligence...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <div className="min-h-screen bg-custom-bg">
        {/* Enhanced Header */}
        <div className="bg-custom-box shadow-sm border-b border-custom-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-header-large text-fm-white mb-2">{title}</h1>
                <p className="font-body-primary text-fm-medium-grey">{subtitle}</p>
                {systemStatus && (
                  <div className="mt-2 flex items-center space-x-4 text-sm">
                    <div className="flex items-center space-x-1">
                      <div className={`w-2 h-2 rounded-full ${systemStatus.is_active ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className="text-fm-meta font-meta">
                        System {systemStatus.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Activity className="w-3 h-3 text-fm-meta" />
                      <span className="text-fm-meta font-meta">
                        Health: {systemStatus.health_score}%
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Database className="w-3 h-3 text-fm-meta" />
                      <span className="text-fm-meta font-meta">
                        Webhooks: {systemStatus.active_webhooks}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-fm-meta" />
                      <span className="text-fm-meta font-meta">
                        Last: {new Date(systemStatus.last_activity).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-4">
                {activityStats && (
                  <div className="text-right mr-4">
                    <div className="text-sm text-fm-meta font-meta">
                      <span className="text-fm-green font-highlight">{activityStats.rfp_detections}</span> RFPs Detected
                    </div>
                    <div className="text-sm text-fm-meta font-meta">
                      <span className="text-fm-yellow font-highlight">{activityStats.high_value_opportunities}</span> High Value
                    </div>
                  </div>
                )}
                <button
                  onClick={handleExport}
                  className="px-4 py-2 bg-fm-yellow text-custom-bg font-body-medium rounded-lg hover:bg-yellow-400 transition-colors flex items-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Export</span>
                </button>
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="px-4 py-2 bg-fm-yellow text-custom-bg font-body-medium rounded-lg hover:bg-yellow-400 transition-colors flex items-center space-x-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-custom-box border border-custom-border rounded-lg shadow p-1 mb-6">
            <div className="flex space-x-1">
              {[
                { id: 'opportunities', label: 'Opportunities', icon: Trophy },
                { id: 'scaling', label: 'Entity Scaling', icon: BarChart3 },
                { id: 'claude-agent', label: 'Claude Agent', icon: Brain },
                { id: 'analytics', label: 'Analytics', icon: Zap },
                { id: 'system', label: 'System Metrics', icon: Activity }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-md font-body-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-fm-yellow text-custom-bg'
                      : 'text-fm-medium-grey hover:text-fm-white'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'opportunities' && (
          <ProfessionalRFPDashboard
            opportunities={opportunities}
            loading={loading}
            onRefresh={handleRefresh}
            onExport={handleExport}
            title={false}
            subtitle={false}
          />
        )}

        {activeTab === 'scaling' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <ScalingStatsPanel />
              <HistoricalRFPsPanel maxHeight="500px" compact={false} />
            </div>
            
            {/* Entity Scaling Features Summary */}
            <div className="bg-custom-box border border-custom-border rounded-lg shadow p-6">
              <h3 className="font-subheader text-fm-white mb-4 flex items-center">
                <BarChart3 className="w-5 h-5 text-fm-yellow mr-2" />
                Entity Scaling Intelligence
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h4 className="font-body-medium text-fm-light-grey mb-2">🎯 Golden Zone</h4>
                  <p className="font-body-secondary text-fm-medium-grey text-sm">
                    Priority entities with 5-minute monitoring intervals. 
                    High-value companies and executives with immediate alert processing.
                  </p>
                </div>
                <div>
                  <h4 className="font-body-medium text-fm-light-grey mb-2">📊 Standard Tier</h4>
                  <p className="font-body-secondary text-fm-medium-grey text-sm">
                    Regular entities with 15-minute monitoring. 
                    Balanced approach for steady monitoring coverage.
                  </p>
                </div>
                <div>
                  <h4 className="font-body-medium text-fm-light-grey mb-2">💰 Economy Tier</h4>
                  <p className="font-body-secondary text-fm-medium-grey text-sm">
                    Extended coverage with 60-minute intervals. 
                    Broad monitoring for long-term trend analysis.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'claude-agent' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
            <ClaudeAgentDemo />
          </div>
        )}

        {activeTab === 'analytics' && showAnalytics && activityStats && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <div className="bg-custom-box border border-custom-border rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-body-secondary text-fm-meta">Total Activities</p>
                    <p className="font-highlight text-fm-white">{activityStats.total_activities}</p>
                  </div>
                  <Activity className="w-8 h-8 text-blue-500" />
                </div>
              </div>
              <div className="bg-custom-box border border-custom-border rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-body-secondary text-fm-meta">Avg Confidence</p>
                    <p className="font-highlight text-fm-white">{(activityStats.average_confidence * 100).toFixed(1)}%</p>
                  </div>
                  <Zap className="w-8 h-8 text-yellow-500" />
                </div>
              </div>
              <div className="bg-custom-box border border-custom-border rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-body-secondary text-fm-meta">Avg Processing</p>
                    <p className="font-highlight text-fm-white">{activityStats.average_processing_time}ms</p>
                  </div>
                  <Clock className="w-8 h-8 text-green-500" />
                </div>
              </div>
              <div className="bg-custom-box border border-custom-border rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-body-secondary text-fm-meta">Success Rate</p>
                    <p className="font-highlight text-fm-white">{activityStats.success_rate}%</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-emerald-500" />
                </div>
              </div>
            </div>

            {/* Top Entities */}
            {activityStats.top_entities && (
              <div className="bg-custom-box border border-custom-border rounded-lg shadow p-6">
                <h3 className="font-subheader text-fm-white mb-4">Top Entities by Detections</h3>
                <div className="space-y-3">
                  {activityStats.top_entities.map((entity, index) => (
                    <div key={entity.name} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-fm-yellow text-custom-bg rounded-full flex items-center justify-center font-body-small font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-body-primary text-fm-white">{entity.name}</p>
                          <p className="font-body-secondary text-fm-meta">{entity.detections} detections</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-highlight text-fm-yellow">{entity.score}%</p>
                        <p className="font-body-secondary text-fm-meta">fit score</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'system' && showSystemMetrics && systemStatus && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-custom-box border border-custom-border rounded-lg shadow p-6">
                <h3 className="font-subheader text-fm-white mb-4 flex items-center space-x-2">
                  <Activity className="w-5 h-5" />
                  <span>System Status</span>
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-body-primary text-fm-medium-grey">Status</span>
                    <span className={`font-body-medium ${systemStatus.is_active ? 'text-fm-green' : 'text-fm-red'}`}>
                      {systemStatus.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-body-primary text-fm-medium-grey">Health Score</span>
                    <span className="font-body-medium text-fm-white">{systemStatus.health_score}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-body-primary text-fm-medium-grey">Active Webhooks</span>
                    <span className="font-body-medium text-fm-white">{systemStatus.active_webhooks}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-body-primary text-fm-medium-grey">Pending Processing</span>
                    <span className="font-body-medium text-fm-white">
                      {systemStatus.pending_processing ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>

              {systemStatus.recent_errors && systemStatus.recent_errors.length > 0 && (
                <div className="bg-custom-box border border-custom-border rounded-lg shadow p-6">
                  <h3 className="font-subheader text-fm-white mb-4 flex items-center space-x-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                    <span>Recent Errors</span>
                  </h3>
                  <div className="space-y-3">
                    {systemStatus.recent_errors.map((error, index) => (
                      <div key={index} className="border-l-4 border-yellow-500 pl-3">
                        <p className="font-body-secondary text-fm-medium-grey text-sm">
                          {new Date(error.timestamp).toLocaleString()}
                        </p>
                        <p className="font-body-primary text-fm-white">{error.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedRFPMonitoringDashboard;