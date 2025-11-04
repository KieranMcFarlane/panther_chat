/**
 * 📋 Historical RFPs Panel
 * 
 * Displays historical RFP data with filtering and search
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, Calendar, Building2, Clock, ExternalLink, Eye } from 'lucide-react';

interface HistoricalRFP {
  id: string;
  title: string;
  organization: string;
  type: 'RFP' | 'Tender' | 'Contract' | 'RFT';
  source: string;
  published: string;
  deadline?: string;
  value?: string;
  category: string;
  description: string;
  url?: string;
  location?: string;
  scrapedAt: string;
  processingStatus: 'pending' | 'processed' | 'analyzed';
}

interface HistoricalRFPsPanelProps {
  maxHeight?: string;
  compact?: boolean;
}

export const HistoricalRFPsPanel: React.FC<HistoricalRFPsPanelProps> = ({
  maxHeight = '400px',
  compact = false
}) => {
  const [rfps, setRfps] = useState<HistoricalRFP[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDays, setFilterDays] = useState('30');
  const [filterCategory, setFilterCategory] = useState('all');
  const [expandedRFP, setExpandedRFP] = useState<string | null>(null);

  const loadRFPs = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/entity-scaling?action=historical-rfps&days=${filterDays}`);
      const data = await response.json();
      
      if (data.success) {
        setRfps(data.data.rfps);
      }
    } catch (error) {
      console.error('Error loading historical RFPs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRFPs();
  };

  const handleExport = () => {
    const filteredRFPs = getFilteredRFPs();
    
    const csvContent = [
      'Title,Organization,Type,Source,Published,Deadline,Value,Category,Location,Status',
      ...filteredRFPs.map(rfp => [
        `"${rfp.title}"`,
        `"${rfp.organization}"`,
        `"${rfp.type}"`,
        `"${rfp.source}"`,
        `"${new Date(rfp.published).toLocaleDateString()}"`,
        `"${rfp.deadline ? new Date(rfp.deadline).toLocaleDateString() : ''}"`,
        `"${rfp.value || ''}"`,
        `"${rfp.category}"`,
        `"${rfp.location || ''}"`,
        `"${rfp.processingStatus}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historical-rfps-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const getFilteredRFPs = () => {
    return rfps.filter(rfp => {
      const matchesSearch = !searchTerm || 
        rfp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rfp.organization.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rfp.description.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory = filterCategory === 'all' || rfp.category === filterCategory;

      return matchesSearch && matchesCategory;
    });
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-GB');
    } catch {
      return dateString;
    }
  };

  const getTypeColor = (type: string) => {
    const colors = {
      'RFP': 'bg-purple-100 text-purple-800',
      'Tender': 'bg-blue-100 text-blue-800',
      'Contract': 'bg-green-100 text-green-800',
      'RFT': 'bg-orange-100 text-orange-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getStatusColor = (status: string) => {
    const colors = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'processed': 'bg-blue-100 text-blue-800',
      'analyzed': 'bg-green-100 text-green-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getDaysAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  const categories = ['all', 'Technology', 'Construction', 'Consulting', 'Marketing', 'Legal', 'Financial', 'Healthcare', 'Education'];

  useEffect(() => {
    loadRFPs();
  }, [filterDays]);

  const filteredRFPs = getFilteredRFPs();

  return (
    <div className="bg-custom-box border border-custom-border rounded-lg shadow">
      <div className="p-4 border-b border-custom-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-fm-yellow" />
            <h3 className="font-subheader text-fm-white">Historical RFPs</h3>
            <span className="font-body-secondary text-fm-meta">
              ({rfps.length} in last {filterDays} days)
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 text-fm-medium-grey hover:text-fm-white transition-colors disabled:opacity-50"
              title="Refresh RFPs"
            >
              <Clock className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleExport}
              className="p-2 text-fm-medium-grey hover:text-fm-white transition-colors"
              title="Export RFPs"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-fm-meta w-4 h-4" />
              <input
                type="text"
                placeholder="Search RFPs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-custom-border rounded-lg focus:ring-2 focus:ring-fm-yellow focus:border-transparent bg-custom-bg text-fm-white placeholder-fm-meta font-body-primary text-sm"
              />
            </div>
          </div>

          <div>
            <select
              value={filterDays}
              onChange={(e) => setFilterDays(e.target.value)}
              className="w-full px-3 py-2 border border-custom-border rounded-lg focus:ring-2 focus:ring-fm-yellow focus:border-transparent bg-custom-bg text-fm-white font-body-primary text-sm"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="180">Last 6 months</option>
              <option value="365">Last year</option>
            </select>
          </div>

          <div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 border border-custom-border rounded-lg focus:ring-2 focus:ring-fm-yellow focus:border-transparent bg-custom-bg text-fm-white font-body-primary text-sm"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* RFPs List */}
      <div 
        className="overflow-y-auto"
        style={{ maxHeight }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-fm-yellow"></div>
          </div>
        ) : filteredRFPs.length === 0 ? (
          <div className="text-center text-fm-meta py-8">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No historical RFPs found</p>
            <p className="text-sm mt-1">Try adjusting your filters or expanding the date range</p>
          </div>
        ) : (
          <div className="divide-y divide-custom-border">
            {filteredRFPs.map((rfp) => (
              <div key={rfp.id} className="p-4 hover:bg-custom-bg transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className={`px-2 py-1 text-xs font-body-medium rounded-full ${getTypeColor(rfp.type)}`}>
                        {rfp.type}
                      </span>
                      <span className={`px-2 py-1 text-xs font-body-medium rounded-full ${getStatusColor(rfp.processingStatus)}`}>
                        {rfp.processingStatus}
                      </span>
                      <span className="font-body-secondary text-fm-meta text-xs">
                        {getDaysAgo(rfp.published)}
                      </span>
                    </div>
                    
                    <h4 className="font-body-primary text-fm-white mb-1">{rfp.title}</h4>
                    
                    <div className="flex items-center space-x-4 text-sm text-fm-medium-grey mb-2">
                      <span className="flex items-center space-x-1">
                        <Building2 className="w-4 h-4" />
                        <span>{rfp.organization}</span>
                      </span>
                      {rfp.value && (
                        <span>Value: {rfp.value}</span>
                      )}
                      {rfp.location && (
                        <span className="flex items-center space-x-1">
                          <Clock className="w-4 h-4" />
                          <span>{rfp.location}</span>
                        </span>
                      )}
                    </div>

                    <p className="font-body-secondary text-fm-medium-grey text-sm line-clamp-2">
                      {rfp.description}
                    </p>

                    <div className="flex items-center space-x-4 text-xs text-fm-meta mt-2">
                      <span>Source: {rfp.source}</span>
                      <span>Category: {rfp.category}</span>
                      <span>Published: {formatDate(rfp.published)}</span>
                      {rfp.deadline && (
                        <span>Deadline: {formatDate(rfp.deadline)}</span>
                      )}
                    </div>

                    {expandedRFP === rfp.id && (
                      <div className="mt-3 p-3 bg-custom-bg rounded text-xs">
                        <div className="space-y-1">
                          <p><strong>RFP ID:</strong> {rfp.id}</p>
                          <p><strong>Scraped:</strong> {new Date(rfp.scrapedAt).toLocaleString()}</p>
                          <p><strong>URL:</strong> {rfp.url || 'N/A'}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="ml-4 flex flex-col space-y-2">
                    <button
                      onClick={() => setExpandedRFP(expandedRFP === rfp.id ? null : rfp.id)}
                      className="text-fm-medium-grey hover:text-fm-white text-sm transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    
                    {rfp.url && (
                      <a
                        href={rfp.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-fm-medium-grey hover:text-fm-white text-sm transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {!compact && filteredRFPs.length > 0 && (
        <div className="p-4 border-t border-custom-border text-center">
          <p className="text-fm-medium-grey text-sm">
            Showing {filteredRFPs.length} of {rfps.length} RFPs
          </p>
        </div>
      )}
    </div>
  );
};

export default HistoricalRFPsPanel;