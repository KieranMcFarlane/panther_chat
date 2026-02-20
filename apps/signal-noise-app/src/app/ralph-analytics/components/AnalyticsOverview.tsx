'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Users, Target, DollarSign, AlertCircle } from 'lucide-react';

interface AnalyticsOverviewProps {
  bandDistribution?: any;
  clusterHealth?: any;
  categoryPerformance?: any;
  lifecycleFunnel?: any;
  evidenceImpact?: any;
}

export default function AnalyticsOverview({
  bandDistribution,
  clusterHealth,
  categoryPerformance,
  lifecycleFunnel,
  evidenceImpact
}: AnalyticsOverviewProps) {
  // Calculate overview metrics
  const totalEntities = bandDistribution?.metadata?.total_entities || 0;
  const revenueProjection = bandDistribution?.revenue_projection || {};
  const totalMonthlyRevenue = revenueProjection.total_monthly || 0;
  const actionableCount = bandDistribution?.distribution?.ACTIONABLE?.count || 0;

  const categories = categoryPerformance?.categories || {};
  const categoryEntries = Object.entries(categories);
  const bestCategory = categoryEntries.sort((a: any, b: any) => b[1].accept_rate - a[1].accept_rate)[0];

  const insights = lifecycleFunnel?.insights || [];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Entities */}
        <Card className="bg-custom-box border-custom-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-fm-muted">
              Total Entities
            </CardTitle>
            <Users className="h-4 w-4 text-fm-blue" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-fm-white">{totalEntities.toLocaleString()}</div>
            <p className="text-xs text-fm-muted mt-1">
              Active in intelligence database
            </p>
          </CardContent>
        </Card>

        {/* Monthly Revenue Projection */}
        <Card className="bg-custom-box border-custom-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-fm-muted">
              Monthly Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-fm-green" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-fm-white">
              ${(totalMonthlyRevenue / 1000).toFixed(0)}K
            </div>
            <p className="text-xs text-fm-muted mt-1">
              Projected from all bands
            </p>
          </CardContent>
        </Card>

        {/* Actionable Entities */}
        <Card className="bg-custom-box border-custom-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-fm-muted">
              Actionable
            </CardTitle>
            <Target className="h-4 w-4 text-fm-yellow" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-fm-white">{actionableCount}</div>
            <p className="text-xs text-fm-muted mt-1">
              Ready for immediate outreach
            </p>
          </CardContent>
        </Card>

        {/* Best Category */}
        <Card className="bg-custom-box border-custom-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-fm-muted">
              Top Category
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-fm-blue" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-fm-white truncate">
              {bestCategory ? bestCategory[0] : 'N/A'}
            </div>
            <p className="text-xs text-fm-muted mt-1">
              {bestCategory ? `${(bestCategory[1].accept_rate * 100).toFixed(1)}% accept rate` : 'No data'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Band Distribution Summary */}
      <Card className="bg-custom-box border-custom-border">
        <CardHeader>
          <CardTitle className="text-fm-white">Band Distribution</CardTitle>
          <CardDescription className="text-fm-muted">
            Current distribution across confidence bands
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {bandDistribution?.distribution && Object.entries(bandDistribution.distribution).map(([band, data]: [string, any]) => (
            <div key={band} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge
                    className={
                      band === 'EXPLORATORY'
                        ? 'bg-gray-600 text-white'
                        : band === 'INFORMED'
                        ? 'bg-fm-blue text-white'
                        : band === 'CONFIDENT'
                        ? 'bg-fm-green text-white'
                        : 'bg-fm-yellow text-gray-900'
                    }
                  >
                    {band}
                  </Badge>
                  <span className="text-sm text-fm-white">{data.count} entities</span>
                </div>
                <span className="text-sm font-medium text-fm-white">
                  {data.percentage.toFixed(1)}%
                </span>
              </div>
              <Progress
                value={data.percentage}
                className="h-2"
                indicatorClassName={
                  band === 'EXPLORATORY'
                    ? 'bg-gray-600'
                    : band === 'INFORMED'
                    ? 'bg-fm-blue'
                    : band === 'CONFIDENT'
                    ? 'bg-fm-green'
                    : 'bg-fm-yellow'
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Revenue Breakdown */}
      <Card className="bg-custom-box border-custom-border">
        <CardHeader>
          <CardTitle className="text-fm-white">Revenue Projection</CardTitle>
          <CardDescription className="text-fm-muted">
            Monthly recurring revenue by confidence band
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {bandDistribution?.revenue_projection && Object.entries(bandDistribution.revenue_projection)
              .filter(([key]) => key !== 'total_monthly')
              .map(([band, revenue]: [string, any]) => (
                <div key={band} className="flex items-center justify-between py-2 border-b border-custom-border last:border-0">
                  <span className="text-sm text-fm-white">{band}</span>
                  <span className="text-sm font-medium text-fm-white">
                    ${revenue.toLocaleString()}
                  </span>
                </div>
              ))}
            <div className="flex items-center justify-between py-2 border-t-2 border-fm-yellow mt-2">
              <span className="text-base font-semibold text-fm-white">Total Monthly</span>
              <span className="text-base font-bold text-fm-yellow">
                ${(totalMonthlyRevenue).toLocaleString()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Insights */}
      <Card className="bg-custom-box border-custom-border">
        <CardHeader>
          <CardTitle className="text-fm-white flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-fm-yellow" />
            Quick Insights
          </CardTitle>
          <CardDescription className="text-fm-muted">
            Key findings from analytics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {insights.length > 0 ? insights.map((insight: string, idx: number) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-fm-white">
                <span className="text-fm-yellow mt-0.5">•</span>
                <span>{insight}</span>
              </li>
            )) : (
              <li className="text-sm text-fm-muted">No insights available</li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
