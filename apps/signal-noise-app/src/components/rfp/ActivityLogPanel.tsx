/**
 * 📊 Activity Log Panel Component
 * 
 * Shows recent activities and action history for RFP opportunities
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Clock, Calendar, Filter, Download, RefreshCw, Eye, Star, MessageSquare, Users, Target, Archive, TrendingUp } from 'lucide-react';
import { activityLogger } from '@/lib/activity-logger';

interface ActivityLogPanelProps {
  opportunityId?: string;
  organization?: string;
  compact?: boolean;
  maxHeight?: string;
}

export const ActivityLogPanel: React.FC<ActivityLogPanelProps> = ({
  opportunityId,
  organization,
  compact = false,
  maxHeight = '400px'
}) => {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const loadActivities = async () => {
    setLoading(true);
    try {
      const filters: any = {
        limit: compact ? 5 : 20
      };

      if (opportunityId) {
        filters.opportunityId = opportunityId;
      } else if (organization) {
        filters.organization = organization;
      }

      if (filter !== 'all') {
        filters.category = filter;
      }

      const loggedActivities = activityLogger.getActivities(filters);
      setActivities(loggedActivities);
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await loadActivities();
    } finally {
      setRefreshing(false);
    }
  };

  const handleExport = () => {
    try {
      const csvContent = activityLogger.exportToCSV(
        opportunityId ? { opportunityId } : 
        organization ? { organization } : 
        { category: filter !== 'all' ? filter : undefined }
      );
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `rfp-activities-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting activities:', error);
    }
  };

  useEffect(() => {
    loadActivities();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadActivities, 30000);
    return () => clearInterval(interval);
  }, [opportunityId, organization, filter]);

  const getActivityIcon = (action: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      'view_details': <Eye className="w-4 h-4" />,
      'mark_interested': <Star className="w-4 h-4" />,
      'add_notes': <MessageSquare className="w-4 h-4" />,
      'schedule_followup': <Calendar className="w-4 h-4" />,
      'assign_team': <Users className="w-4 h-4" />,
      'analyze_competitors': <Target className="w-4 h-4" />,
      'estimate_value': <TrendingUp className="w-4 h-4" />,
      'archive': <Archive className="w-4 h-4" />
    };
    return iconMap[action] || <Clock className="w-4 h-4" />;
  };

  const getImpactColor = (impact: string) => {
    const colorMap: Record<string, string> = {
      'high': 'text-red-600 bg-red-50',
      'medium': 'text-yellow-600 bg-yellow-50',
      'low': 'text-green-600 bg-green-50'
    };
    return colorMap[impact] || 'text-gray-600 bg-gray-50';
  };

  const getCategoryColor = (category: string) => {
    const colorMap: Record<string, string> = {
      'view': 'text-blue-600 bg-blue-50',
      'analysis': 'text-purple-600 bg-purple-50',
      'communication': 'text-indigo-600 bg-indigo-50',
      'status_change': 'text-orange-600 bg-orange-50',
      'follow_up': 'text-green-600 bg-green-50',
      'team_assignment': 'text-pink-600 bg-pink-50'
    };
    return colorMap[category] || 'text-gray-600 bg-gray-50';
  };

  if (compact && activities.length === 0) {
    return (
      <div className="text-center text-fm-meta py-4">
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No recent activities</p>
      </div>
    );
  }

  return (
    <div className="bg-custom-box border border-custom-border rounded-lg shadow">
      <div className="p-4 border-b border-custom-border">
        <div className="flex items-center justify-between">
          <h3 className="font-subheader text-fm-white flex items-center space-x-2">
            <Clock className="w-5 h-5" />
            <span>Activity Log</span>
            {!compact && activities.length > 0 && (
              <span className="font-body-secondary text-fm-meta">
                ({activities.length} recent)
              </span>
            )}
          </h3>
          
          <div className="flex items-center space-x-2">
            {!compact && (
              <>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="px-3 py-1 text-sm border border-custom-border rounded bg-custom-bg text-fm-white"
                >
                  <option value="all">All Categories</option>
                  <option value="view">Views</option>
                  <option value="analysis">Analysis</option>
                  <option value="communication">Communication</option>
                  <option value="status_change">Status Changes</option>
                  <option value="follow_up">Follow-ups</option>
                </select>
                
                <button
                  onClick={handleExport}
                  className="p-2 text-fm-medium-grey hover:text-fm-white transition-colors"
                  title="Export activities"
                >
                  <Download className="w-4 h-4" />
                </button>
              </>
            )}
            
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 text-fm-medium-grey hover:text-fm-white transition-colors disabled:opacity-50"
              title="Refresh activities"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div 
        className="overflow-y-auto"
        style={{ maxHeight }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-fm-yellow"></div>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center text-fm-meta py-8">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No activities found</p>
            <p className="text-sm mt-1">Actions will appear here as you interact with opportunities</p>
          </div>
        ) : (
          <div className="divide-y divide-custom-border">
            {activities.map((activity) => (
              <div key={activity.id} className="p-4 hover:bg-custom-bg transition-colors">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-8 h-8 rounded-full bg-fm-yellow text-custom-bg flex items-center justify-center">
                      {getActivityIcon(activity.action)}
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-body-primary text-fm-white">
                        {activity.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                      
                      {!compact && (
                        <>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${getCategoryColor(activity.category)}`}>
                            {activity.category}
                          </span>
                          
                          <span className={`px-2 py-0.5 text-xs rounded-full ${getImpactColor(activity.impact)}`}>
                            {activity.impact}
                          </span>
                        </>
                      )}
                    </div>
                    
                    {!compact && (
                      <p className="font-body-secondary text-fm-medium-grey mb-2">
                        {activity.opportunityTitle} - {activity.organization}
                      </p>
                    )}
                    
                    <div className="flex items-center space-x-4 text-xs text-fm-meta">
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(activity.timestamp).toLocaleString()}</span>
                      </span>
                      
                      <span className="flex items-center space-x-1">
                        <Users className="w-3 h-3" />
                        <span>{activity.userName}</span>
                      </span>
                      
                      {activity.status === 'completed' ? (
                        <span className="text-green-600">✓ Completed</span>
                      ) : activity.status === 'failed' ? (
                        <span className="text-red-600">✗ Failed</span>
                      ) : (
                        <span className="text-yellow-600">⏳ Pending</span>
                      )}
                    </div>
                    
                    {activity.details && Object.keys(activity.details).length > 0 && !compact && (
                      <div className="mt-2 p-2 bg-custom-bg rounded text-xs">
                        <pre className="text-fm-medium-grey whitespace-pre-wrap">
                          {JSON.stringify(activity.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {!compact && activities.length > 0 && (
        <div className="p-4 border-t border-custom-border text-center">
          <button
            onClick={() => setFilter('all')}
            className="text-fm-medium-grey hover:text-fm-white text-sm transition-colors"
          >
            View all activities in detailed report
          </button>
        </div>
      )}
    </div>
  );
};

export default ActivityLogPanel;