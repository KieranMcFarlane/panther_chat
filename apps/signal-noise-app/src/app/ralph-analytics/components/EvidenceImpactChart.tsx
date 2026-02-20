'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface EvidenceImpactChartProps {
  data?: any;
}

export default function EvidenceImpactChart({ data }: EvidenceImpactChartProps) {
  const sources = data?.sources || {};
  const summary = data?.summary || {};

  // Prepare data for visualization
  const chartData = Object.entries(sources)
    .map(([key, source]: [string, any]) => ({
      name: source.source?.length > 25 ? source.source.substring(0, 25) + '...' : source.source,
      fullSource: source.source,
      sourceType: source.source_type,
      totalImpact: source.total_impact.toFixed(2),
      avgImpact: source.avg_impact.toFixed(4),
      count: source.count,
      acceptCount: source.accept_count || 0,
      weakAcceptCount: source.weak_accept_count || 0,
      costPerImpact: source.cost_per_impact?.toFixed(4) || '0.0000',
      effectiveness: source.effectiveness
    }))
    .sort((a, b) => parseFloat(b.totalImpact) - parseFloat(a.totalImpact));

  const getEffectivenessColor = (effectiveness: string) => {
    switch (effectiveness) {
      case 'VERY_EFFECTIVE':
        return 'bg-green-600 text-white';
      case 'EFFECTIVE':
        return 'bg-blue-600 text-white';
      case 'MODERATE':
        return 'bg-yellow-600 text-white';
      case 'LOW':
        return 'bg-red-600 text-white';
      default:
        return 'bg-gray-600 text-white';
    }
  };

  const getSourceTypeColor = (type: string) => {
    switch (type) {
      case 'linkedin':
        return 'bg-blue-700 text-white';
      case 'official_site':
        return 'bg-green-700 text-white';
      case 'job_board':
        return 'bg-purple-700 text-white';
      case 'press':
        return 'bg-orange-700 text-white';
      default:
        return 'bg-gray-700 text-white';
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="bg-custom-box border-custom-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-fm-muted">Total Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-fm-white">{summary.total_sources}</div>
          </CardContent>
        </Card>

        <Card className="bg-custom-box border-custom-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-fm-muted">Evidence Processed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-fm-blue">
              {(summary.total_evidence_processed || 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-custom-box border-custom-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-fm-muted">Total Impact</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-fm-green">
              {summary.total_confidence_impact?.toFixed(1) || 'N/A'}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-custom-box border-custom-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-fm-muted">Best Source</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold text-fm-yellow">{summary.best_source || 'N/A'}</div>
          </CardContent>
        </Card>
      </div>

      {/* Bar Chart */}
      <Card className="bg-custom-box border-custom-border">
        <CardHeader>
          <CardTitle className="text-fm-white">Evidence Source Impact</CardTitle>
          <CardDescription className="text-fm-muted">
            Total confidence impact by evidence source
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af' }}
                width={200}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '0.375rem',
                  color: '#ffffff'
                }}
                formatter={(value: any) => [value, 'Impact']}
              />
              <Bar dataKey="totalImpact" name="Total Impact" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detailed Table */}
      <Card className="bg-custom-box border-custom-border">
        <CardHeader>
          <CardTitle className="text-fm-white">Detailed Source Metrics</CardTitle>
          <CardDescription className="text-fm-muted">
            Performance metrics for each evidence source
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-custom-border">
                  <th className="text-left py-3 px-4 text-fm-white font-semibold">Source</th>
                  <th className="text-center py-3 px-4 text-fm-white font-semibold">Type</th>
                  <th className="text-right py-3 px-4 text-fm-white font-semibold">Count</th>
                  <th className="text-right py-3 px-4 text-fm-white font-semibold">Accepts</th>
                  <th className="text-right py-3 px-4 text-fm-white font-semibold">Weak Accepts</th>
                  <th className="text-right py-3 px-4 text-fm-white font-semibold">Total Impact</th>
                  <th className="text-right py-3 px-4 text-fm-white font-semibold">Avg Impact</th>
                  <th className="text-center py-3 px-4 text-fm-white font-semibold">Effectiveness</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((source, idx) => (
                  <tr key={idx} className="border-b border-custom-border hover:bg-custom-border">
                    <td className="py-4 px-4 text-fm-white" title={source.fullSource}>
                      {source.name}
                    </td>
                    <td className="text-center py-4 px-4">
                      <Badge className={getSourceTypeColor(source.sourceType)}>
                        {source.sourceType}
                      </Badge>
                    </td>
                    <td className="text-right py-4 px-4 text-fm-white">{source.count}</td>
                    <td className="text-right py-4 px-4 text-fm-white">{source.acceptCount}</td>
                    <td className="text-right py-4 px-4 text-fm-white">{source.weakAcceptCount}</td>
                    <td className="text-right py-4 px-4 text-fm-white">{source.totalImpact}</td>
                    <td className="text-right py-4 px-4 text-fm-white">{source.avgImpact}</td>
                    <td className="text-center py-4 px-4">
                      <Badge className={getEffectivenessColor(source.effectiveness)}>
                        {source.effectiveness}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {chartData.length === 0 && (
            <div className="text-center py-8 text-fm-muted">
              No evidence source data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommendation Panel */}
      <Card className="bg-fm-blue/10 border-fm-blue">
        <CardHeader>
          <CardTitle className="text-fm-white">Budget Allocation Recommendation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-fm-white">{summary.recommendation}</p>
        </CardContent>
      </Card>
    </div>
  );
}
