'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { RefreshCw, Download, BarChart3, PieChart, TrendingUp, Layers, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AnalyticsOverview from './components/AnalyticsOverview';
import BandDistributionChart from './components/BandDistributionChart';
import ClusterHealthTable from './components/ClusterHealthTable';
import CategoryPerformanceChart from './components/CategoryPerformanceChart';
import LifecycleFunnel from './components/LifecycleFunnel';
import EvidenceImpactChart from './components/EvidenceImpactChart';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function RalphAnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch all analytics data
  const { data: bandDistribution, error: bandError } = useSWR(
    '/api/ralph/analytics/band-distribution',
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );

  const { data: clusterHealth, error: clusterError } = useSWR(
    '/api/ralph/analytics/cluster-health',
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );

  const { data: categoryPerformance, error: categoryError } = useSWR(
    '/api/ralph/analytics/category-performance',
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );

  const { data: lifecycleFunnel, error: funnelError } = useSWR(
    '/api/ralph/analytics/lifecycle-funnel',
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );

  const { data: evidenceImpact, error: evidenceError } = useSWR(
    '/api/ralph/analytics/evidence-impact',
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );

  const isLoading = !bandDistribution && !bandError;
  const hasError = bandError || clusterError || categoryError || funnelError || evidenceError;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Trigger revalidation for all SWR calls
    window.location.reload();
  };

  const handleExport = async (format: 'csv' | 'json') => {
    const exportData = {
      bandDistribution,
      clusterHealth,
      categoryPerformance,
      lifecycleFunnel,
      evidenceImpact,
      exportedAt: new Date().toISOString()
    };

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ralph-analytics-${new Date().toISOString()}.json`;
      a.click();
    } else {
      // CSV export (simplified - just band distribution for now)
      const csvContent = 'data:text/csv;charset=utf-8,' +
        'Band,Count,Percentage,Revenue\n' +
        `${Object.entries(bandDistribution?.distribution || {}).map(([band, data]: [string, any]) =>
          `${band},${data.count},${data.percentage},${data.count * (band === 'EXPLORATORY' ? 0 : band === 'INFORMED' ? 500 : band === 'CONFIDENT' ? 2000 : 5000)}`
        ).join('\n')}`;

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ralph-analytics-${new Date().toISOString()}.csv`;
      a.click();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-custom-box flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-4 text-fm-white">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="min-h-screen bg-custom-box flex items-center justify-center">
        <Card className="bg-custom-box border-custom-border">
          <CardHeader>
            <CardTitle className="text-fm-white">Error Loading Analytics</CardTitle>
            <CardDescription className="text-fm-muted">
              Failed to load analytics data. Please try again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-custom-box">
      {/* Header */}
      <div className="border-b border-custom-border bg-custom-box">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-fm-white">
                Ralph Analytics Dashboard
              </h1>
              <p className="mt-1 text-sm text-fm-muted">
                Real-time intelligence from {bandDistribution?.metadata?.total_entities || 0} tracked entities
              </p>
              {bandDistribution?.metadata?.last_updated && (
                <p className="mt-1 text-xs text-fm-muted">
                  Last updated: {new Date(bandDistribution.metadata.last_updated).toLocaleString()}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="border-custom-border text-fm-white hover:bg-custom-border"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('json')}
                className="border-custom-border text-fm-white hover:bg-custom-border"
              >
                <Download className="mr-2 h-4 w-4" />
                Export JSON
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-custom-box border border-custom-border">
            <TabsTrigger
              value="overview"
              className="data-[state=active]:bg-fm-yellow data-[state=active]:text-gray-900"
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="bands"
              className="data-[state=active]:bg-fm-yellow data-[state=active]:text-gray-900"
            >
              <PieChart className="mr-2 h-4 w-4" />
              Bands
            </TabsTrigger>
            <TabsTrigger
              value="clusters"
              className="data-[state=active]:bg-fm-yellow data-[state=active]:text-gray-900"
            >
              <Layers className="mr-2 h-4 w-4" />
              Clusters
            </TabsTrigger>
            <TabsTrigger
              value="categories"
              className="data-[state=active]:bg-fm-yellow data-[state=active]:text-gray-900"
            >
              <Target className="mr-2 h-4 w-4" />
              Categories
            </TabsTrigger>
            <TabsTrigger
              value="lifecycle"
              className="data-[state=active]:bg-fm-yellow data-[state=active]:text-gray-900"
            >
              <TrendingUp className="mr-2 h-4 w-4" />
              Lifecycle
            </TabsTrigger>
            <TabsTrigger
              value="evidence"
              className="data-[state=active]:bg-fm-yellow data-[state=active]:text-gray-900"
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Evidence
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <AnalyticsOverview
              bandDistribution={bandDistribution}
              clusterHealth={clusterHealth}
              categoryPerformance={categoryPerformance}
              lifecycleFunnel={lifecycleFunnel}
              evidenceImpact={evidenceImpact}
            />
          </TabsContent>

          <TabsContent value="bands" className="space-y-6">
            <BandDistributionChart data={bandDistribution} />
          </TabsContent>

          <TabsContent value="clusters" className="space-y-6">
            <ClusterHealthTable data={clusterHealth} />
          </TabsContent>

          <TabsContent value="categories" className="space-y-6">
            <CategoryPerformanceChart data={categoryPerformance} />
          </TabsContent>

          <TabsContent value="lifecycle" className="space-y-6">
            <LifecycleFunnel data={lifecycleFunnel} />
          </TabsContent>

          <TabsContent value="evidence" className="space-y-6">
            <EvidenceImpactChart data={evidenceImpact} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
