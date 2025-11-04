/**
 * 📊 Scaling Stats Panel
 * 
 * Displays entity scaling statistics and monitoring overview
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Users, Building2, Target, Activity, Globe, Zap, Clock, TrendingUp, RefreshCw } from 'lucide-react';

interface ScalingStats {
  totalEntities: number;
  activeEntities: number;
  entitiesByTier: {
    golden: number;
    standard: number;
    economy: number;
  };
  historicalRFPs: number;
  activeScrapers: number;
  config: {
    maxConcurrentScrapes: number;
    batchSize: number;
    goldenZoneLimit: number;
    standardZoneLimit: number;
    economyZoneLimit: number;
    historicalLookbackDays: number;
  };
}

interface ScalingStatsPanelProps {
  compact?: boolean;
}

export const ScalingStatsPanel: React.FC<ScalingStatsPanelProps> = ({ compact = false }) => {
  const [stats, setStats] = useState<ScalingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = async () => {
    try {
      const response = await fetch('/api/entity-scaling?action=stats');
      const data = await response.json();
      
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Error loading scaling stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStats();
  };

  useEffect(() => {
    loadStats();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-custom-box border border-custom-border rounded-lg shadow p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-fm-yellow"></div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-custom-box border border-custom-border rounded-lg shadow p-6">
        <p className="text-fm-medium-grey">Unable to load scaling statistics</p>
      </div>
    );
  }

  const activePercentage = ((stats.activeEntities / stats.totalEntities) * 100).toFixed(1);
  const goldenPercentage = ((stats.entitiesByTier.golden / stats.activeEntities) * 100).toFixed(1);

  return (
    <div className="bg-custom-box border border-custom-border rounded-lg shadow">
      <div className="p-4 border-b border-custom-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Globe className="w-5 h-5 text-fm-yellow" />
            <h3 className="font-subheader text-fm-white">Entity Scaling Overview</h3>
            <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
              Active
            </span>
          </div>
          
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 text-fm-medium-grey hover:text-fm-white transition-colors disabled:opacity-50"
            title="Refresh stats"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {/* Total Entities */}
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <Users className="w-6 h-6 text-blue-500 mr-2" />
              <div className="text-2xl font-highlight text-fm-white">
                {stats.totalEntities.toLocaleString()}
              </div>
            </div>
            <p className="font-body-secondary text-fm-meta text-sm">Total Entities</p>
          </div>

          {/* Active Entities */}
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <Activity className="w-6 h-6 text-green-500 mr-2" />
              <div className="text-2xl font-highlight text-fm-white">
                {stats.activeEntities.toLocaleString()}
              </div>
            </div>
            <p className="font-body-secondary text-fm-meta text-sm">Active ({activePercentage}%)</p>
          </div>

          {/* Historical RFPs */}
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <Target className="w-6 h-6 text-purple-500 mr-2" />
              <div className="text-2xl font-highlight text-fm-white">
                {stats.historicalRFPs.toLocaleString()}
              </div>
            </div>
            <p className="font-body-secondary text-fm-meta text-sm">Historical RFPs</p>
          </div>

          {/* Active Scrapers */}
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <Zap className="w-6 h-6 text-yellow-500 mr-2" />
              <div className="text-2xl font-highlight text-fm-white">
                {stats.activeScrapers}
              </div>
            </div>
            <p className="font-body-secondary text-fm-meta text-sm">Active Scrapers</p>
          </div>
        </div>

        {/* Tier Distribution */}
        <div className="border-t border-custom-border pt-4">
          <h4 className="font-body-medium text-fm-light-grey mb-3">Entity Distribution by Tier</h4>
          <div className="space-y-2">
            {/* Golden Zone */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-body-primary text-fm-white flex items-center">
                  <span className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
                  Golden Zone
                </span>
                <span className="text-sm font-body-secondary text-fm-medium-grey">
                  {stats.entitiesByTier.golden.toLocaleString()} ({goldenPercentage}%)
                </span>
              </div>
              <div className="w-full bg-custom-bg rounded-full h-2">
                <div 
                  className="bg-yellow-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${goldenPercentage}%` }}
                ></div>
              </div>
            </div>

            {/* Standard Tier */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-body-primary text-fm-white flex items-center">
                  <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
                  Standard Tier
                </span>
                <span className="text-sm font-body-secondary text-fm-medium-grey">
                  {stats.entitiesByTier.standard.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-custom-bg rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(stats.entitiesByTier.standard / stats.activeEntities) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Economy Tier */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-body-primary text-fm-white flex items-center">
                  <span className="w-3 h-3 bg-gray-500 rounded-full mr-2"></span>
                  Economy Tier
                </span>
                <span className="text-sm font-body-secondary text-fm-medium-grey">
                  {stats.entitiesByTier.economy.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-custom-bg rounded-full h-2">
                <div 
                  className="bg-gray-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(stats.entitiesByTier.economy / stats.activeEntities) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {!compact && (
          <div className="border-t border-custom-border pt-4 mt-4">
            <h4 className="font-body-medium text-fm-light-grey mb-3">Configuration</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-body-secondary text-fm-meta">Max Concurrent:</span>
                <span className="ml-2 font-body-primary text-fm-white">{stats.config.maxConcurrentScrapes}</span>
              </div>
              <div>
                <span className="font-body-secondary text-fm-meta">Batch Size:</span>
                <span className="ml-2 font-body-primary text-fm-white">{stats.config.batchSize}</span>
              </div>
              <div>
                <span className="font-body-secondary text-fm-meta">Lookback Days:</span>
                <span className="ml-2 font-body-primary text-fm-white">{stats.config.historicalLookbackDays}</span>
              </div>
              <div>
                <span className="font-body-secondary text-fm-meta">Golden Limit:</span>
                <span className="ml-2 font-body-primary text-fm-white">{stats.config.goldenZoneLimit}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScalingStatsPanel;