/**
 * 🏆 Professional RFP/Tender Dashboard
 * 
 * Advanced dashboard component for displaying RFP and tender opportunities
 * with professional layout, comprehensive filtering, and real-time updates
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Search, Building2, MapPin, PoundSterling, Calendar, ExternalLink, Trophy, Eye, Linkedin, Globe, RefreshCw, Filter, Download, Clock, MessageSquare, Users, Target } from 'lucide-react';
import { ActionButtons } from './ActionButtons';
import { ActivityLogPanel } from './ActivityLogPanel';
import { LiveAlertFeed } from './LiveAlertFeed';
import { activityLogger } from '@/lib/activity-logger';

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
  metadata?: Record<string, any>;
  userAction?: string;
  lastActivity?: string;
}

interface ProfessionalRFPDashboardProps {
  opportunities?: RFPOpportunity[];
  loading?: boolean;
  onRefresh?: () => void;
  onExport?: () => void;
  title?: string;
  subtitle?: string;
}

const ProfessionalRFPDashboard: React.FC<ProfessionalRFPDashboardProps> = ({
  opportunities = [],
  loading = false,
  onRefresh,
  onExport,
  title = "🏆 Live Tender Opportunities",
  subtitle = "Real-time RFP and tender data from LinkedIn and iSportConnect"
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<string | null>(null);
  const [opportunitiesWithActions, setOpportunitiesWithActions] = useState<RFPOpportunity[]>(opportunities);

  // Update opportunities when prop changes
  useEffect(() => {
    setOpportunitiesWithActions(opportunities);
  }, [opportunities]);

  // Handle action callbacks
  const handleAction = async (action: string, data: any) => {
    try {
      // Log the activity
      await activityLogger.logActivity(action, {
        ...data,
        category: action.includes('analyze') ? 'analysis' :
                action.includes('schedule') ? 'follow_up' :
                action.includes('assign') ? 'team_assignment' :
                action.includes('add') ? 'communication' :
                action.includes('mark') || action.includes('archive') ? 'status_change' : 'view',
        impact: action.includes('analyze') || action.includes('mark') ? 'high' : 'medium'
      });

      // Update local state
      setOpportunitiesWithActions(prev => prev.map(opp => {
        if (opp.id === data.opportunityId) {
          return {
            ...opp,
            userAction: action,
            lastActivity: new Date().toISOString()
          };
        }
        return opp;
      }));

      // Send to API if available
      try {
        await fetch('/api/activities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'log',
            data: {
              ...data,
              category: action.includes('analyze') ? 'analysis' :
                      action.includes('schedule') ? 'follow_up' :
                      action.includes('assign') ? 'team_assignment' :
                      action.includes('add') ? 'communication' :
                      action.includes('mark') || action.includes('archive') ? 'status_change' : 'view',
              impact: action.includes('analyze') || action.includes('mark') ? 'high' : 'medium',
              userName: 'Current User',
              userId: 'user-1'
            }
          })
        });
      } catch (error) {
        console.warn('Failed to log activity to API:', error);
      }

      console.log('Action logged:', action, data);
    } catch (error) {
      console.error('Error handling action:', error);
    }
  };

  // Filter opportunities based on search and filters
  const filteredOpportunities = useMemo(() => {
    return opportunitiesWithActions.filter(opportunity => {
      const matchesSearch = !searchTerm || 
        opportunity.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        opportunity.organization.toLowerCase().includes(searchTerm.toLowerCase()) ||
        opportunity.description.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesSource = sourceFilter === 'all' || opportunity.source === sourceFilter;
      const matchesStatus = statusFilter === 'all' || opportunity.status === statusFilter;

      return matchesSearch && matchesSource && matchesStatus;
    });
  }, [opportunities, searchTerm, sourceFilter, statusFilter]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = opportunities.length;
    const open = opportunities.filter(opp => opp.status === 'Open').length;
    const linkedIn = opportunities.filter(opp => opp.source === 'LinkedIn').length;
    const iSportConnect = opportunities.filter(opp => opp.source === 'iSportConnect').length;

    return { total, open, linkedIn, iSportConnect };
  }, [opportunities]);

  // Handle refresh
  const handleRefresh = async () => {
    if (onRefresh) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
  };

  // Handle export
  const handleExport = () => {
    if (onExport) {
      onExport();
    }
  };

  // Get status badge styling
  const getStatusBadge = (status: string) => {
    const styles = {
      'Open': 'bg-green-100 text-green-800',
      'Closed': 'bg-gray-100 text-gray-800',
      'Expired': 'bg-red-100 text-red-800'
    };
    return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800';
  };

  // Get type badge styling
  const getTypeBadge = (type: string) => {
    return 'bg-blue-100 text-blue-800';
  };

  // Format date
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-GB');
    } catch {
      return dateString;
    }
  };

  return (
    <div className="w-full h-full" style={{ opacity: 1 }}>
      <div className="min-h-screen bg-custom-bg">
        {/* Header */}
        <div className="bg-custom-box shadow-sm border-b border-custom-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-header-large text-fm-white mb-2">{title}</h1>
                <p className="font-body-primary text-fm-medium-grey">{subtitle}</p>
              </div>
              <div className="flex items-center space-x-4">
                {onExport && (
                  <button
                    onClick={handleExport}
                    className="px-4 py-2 bg-fm-yellow text-custom-bg font-body-medium rounded-lg hover:bg-yellow-400 transition-colors flex items-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export</span>
                  </button>
                )}
                {onRefresh && (
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing || loading}
                    className="px-4 py-2 bg-fm-yellow text-custom-bg font-body-medium rounded-lg hover:bg-yellow-400 transition-colors flex items-center space-x-2 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    <span>{refreshing ? 'Refreshing...' : 'Refresh Data'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-custom-box border border-custom-border rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Trophy className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="font-body-secondary text-fm-meta">Total Tenders</p>
                  <p className="font-highlight text-fm-white">{stats.total}</p>
                </div>
              </div>
            </div>

            <div className="bg-custom-box border border-custom-border rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Eye className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="font-body-secondary text-fm-meta">Open Tenders</p>
                  <p className="font-highlight text-fm-green">{stats.open}</p>
                </div>
              </div>
            </div>

            <div className="bg-custom-box border border-custom-border rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Linkedin className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="font-body-secondary text-fm-meta">LinkedIn</p>
                  <p className="font-highlight text-fm-white">{stats.linkedIn}</p>
                </div>
              </div>
            </div>

            <div className="bg-custom-box border border-custom-border rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Globe className="w-6 h-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="font-body-secondary text-fm-meta">iSportConnect</p>
                  <p className="font-highlight text-fm-white">{stats.iSportConnect}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-custom-box border border-custom-border rounded-lg shadow p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block font-body-medium text-fm-light-grey mb-2">Search Tenders</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-fm-meta w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search by title, description, or organization..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-custom-border rounded-lg focus:ring-2 focus:ring-fm-yellow focus:border-transparent bg-custom-bg text-fm-white placeholder-fm-meta font-body-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block font-body-medium text-fm-light-grey mb-2">Source</label>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-custom-border rounded-lg focus:ring-2 focus:ring-fm-yellow focus:border-transparent bg-custom-bg text-fm-white font-body-primary"
                >
                  <option value="all">All Sources</option>
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="iSportConnect">iSportConnect</option>
                  <option value="procurement">Procurement</option>
                  <option value="news">News</option>
                </select>
              </div>

              <div>
                <label className="block font-body-medium text-fm-light-grey mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-custom-border rounded-lg focus:ring-2 focus:ring-fm-yellow focus:border-transparent bg-custom-bg text-fm-white font-body-primary"
                >
                  <option value="all">All Statuses</option>
                  <option value="Open">Open</option>
                  <option value="Closed">Closed</option>
                  <option value="Expired">Expired</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Opportunities List */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-custom-box border border-custom-border rounded-lg shadow">
            <div className="px-6 py-4 border-b border-custom-border">
              <h2 className="font-subheader text-fm-white">
                {filteredOpportunities.length} Tender{filteredOpportunities.length !== 1 ? 's' : ''} Found
              </h2>
              <p className="font-meta text-fm-meta mt-1">
                Last updated: {new Date().toISOString()}
              </p>
            </div>

            <div className="divide-y divide-custom-border">
              {loading ? (
                <div className="p-6 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fm-yellow mx-auto"></div>
                  <p className="mt-2 text-fm-medium-grey">Loading opportunities...</p>
                </div>
              ) : filteredOpportunities.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-fm-medium-grey">No opportunities found matching your criteria.</p>
                </div>
              ) : (
                filteredOpportunities.map((opportunity) => (
                  <div key={opportunity.id} className="p-6 hover:bg-custom-bg transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-subheader text-fm-white">{opportunity.title}</h3>
                          <span className={`px-2 py-1 text-xs font-body-medium rounded-full ${getStatusBadge(opportunity.status)}`}>
                            {opportunity.status}
                          </span>
                          <span className={`px-2 py-1 text-xs font-body-medium rounded-full ${getTypeBadge(opportunity.type)}`}>
                            {opportunity.type}
                          </span>
                          {opportunity.yellow_panther_fit && (
                            <span className="px-2 py-1 text-xs font-body-medium rounded-full bg-yellow-100 text-yellow-800">
                              {opportunity.yellow_panther_fit}% Fit
                            </span>
                          )}
                        </div>
                        
                        <p className="font-body-primary text-fm-medium-grey mb-3">{opportunity.description}</p>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div className="flex items-center space-x-2">
                            <Building2 className="w-4 h-4 text-fm-meta" />
                            <span className="font-body-secondary text-fm-medium-grey">{opportunity.organization}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <MapPin className="w-4 h-4 text-fm-meta" />
                            <span className="font-body-secondary text-fm-medium-grey">{opportunity.location}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <PoundSterling className="w-4 h-4 text-fm-meta" />
                            <span className="font-body-secondary text-fm-medium-grey">{opportunity.value}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4 text-fm-meta" />
                            <span className="font-body-secondary text-fm-medium-grey">{formatDate(opportunity.deadline)}</span>
                          </div>
                        </div>
                        
                        <div className="mt-3 flex items-center space-x-4 text-sm text-fm-meta font-meta">
                          <span>Source: {opportunity.source}</span>
                          <span>Published: {formatDate(opportunity.published)}</span>
                          <span>Category: {opportunity.category}</span>
                        </div>
                      </div>
                      
                      <div className="ml-4 flex flex-col space-y-2">
                        {/* Activity status indicator */}
                        {opportunity.lastActivity && (
                          <div className="flex items-center space-x-1 text-xs text-fm-meta">
                            <Clock className="w-3 h-3" />
                            <span>Last action: {new Date(opportunity.lastActivity).toLocaleTimeString()}</span>
                          </div>
                        )}
                        
                        {/* User action indicator */}
                        {opportunity.userAction && (
                          <div className="flex items-center space-x-1 text-xs text-fm-yellow">
                            <Target className="w-3 h-3" />
                            <span>{opportunity.userAction.replace(/_/g, ' ')}</span>
                          </div>
                        )}
                        
                        {/* Action buttons */}
                        <ActionButtons 
                          opportunity={opportunity} 
                          onAction={handleAction}
                          compact={false}
                        />
                        
                        {/* Original view link */}
                        {opportunity.url && (
                          <a
                            href={opportunity.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-2 border border-custom-border shadow-sm text-sm leading-4 font-body-medium rounded-md text-fm-light-grey bg-custom-box hover:bg-custom-bg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-fm-yellow"
                          >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            View Original
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Live Alerts and Activity Row */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Live Alert Feed */}
            <LiveAlertFeed maxHeight="400px" />
            
            {/* Activity Log Panel */}
            <ActivityLogPanel maxHeight="400px" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfessionalRFPDashboard;