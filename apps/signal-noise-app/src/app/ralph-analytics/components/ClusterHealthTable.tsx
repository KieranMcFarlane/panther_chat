'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface ClusterHealthTableProps {
  data?: any;
}

export default function ClusterHealthTable({ data }: ClusterHealthTableProps) {
  const clusters = data?.clusters || {};
  const clusterEntries = Object.entries(clusters);
  const summary = data?.summary || {};

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'EXCELLENT':
        return 'bg-green-600 text-white';
      case 'GOOD':
        return 'bg-blue-600 text-white';
      case 'FAIR':
        return 'bg-yellow-600 text-white';
      case 'NEEDS_ATTENTION':
        return 'bg-red-600 text-white';
      default:
        return 'bg-gray-600 text-white';
    }
  };

  const getHealthStatusIcon = (status: string) => {
    switch (status) {
      case 'EXCELLENT':
        return '✓';
      case 'GOOD':
        return '↑';
      case 'FAIR':
        return '→';
      case 'NEEDS_ATTENTION':
        return '!';
      default:
        return '•';
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="bg-custom-box border-custom-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-fm-muted">Total Clusters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-fm-white">{summary.total_clusters}</div>
          </CardContent>
        </Card>

        <Card className="bg-custom-box border-custom-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-fm-muted">Avg Saturation Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-fm-white">
              {(summary.avg_saturation_rate * 100).toFixed(0)}%
            </div>
          </CardContent>
        </Card>

        <Card className="bg-custom-box border-custom-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-fm-muted">Total Cost Reduction</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-fm-green">{summary.total_cost_reduction}</div>
          </CardContent>
        </Card>
      </div>

      {/* Cluster Table */}
      <Card className="bg-custom-box border-custom-border">
        <CardHeader>
          <CardTitle className="text-fm-white">Cluster Health Metrics</CardTitle>
          <CardDescription className="text-fm-muted">
            Performance indicators for all entity clusters
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-custom-border">
                  <th className="text-left py-3 px-4 text-fm-white font-semibold">Cluster</th>
                  <th className="text-right py-3 px-4 text-fm-white font-semibold">Entities</th>
                  <th className="text-right py-3 px-4 text-fm-white font-semibold">Saturation</th>
                  <th className="text-right py-3 px-4 text-fm-white font-semibold">Avg Confidence</th>
                  <th className="text-right py-3 px-4 text-fm-white font-semibold">Actionable</th>
                  <th className="text-center py-3 px-4 text-fm-white font-semibold">Health</th>
                </tr>
              </thead>
              <tbody>
                {clusterEntries.map(([clusterId, cluster]: [string, any]) => (
                  <tr key={clusterId} className="border-b border-custom-border hover:bg-custom-border">
                    <td className="py-4 px-4">
                      <div>
                        <div className="text-fm-white font-medium">{cluster.cluster_name || clusterId}</div>
                        <div className="text-xs text-fm-muted">{clusterId}</div>
                      </div>
                    </td>
                    <td className="text-right py-4 px-4 text-fm-white">{cluster.total_entities}</td>
                    <td className="text-right py-4 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-fm-white text-sm w-12">
                          {(cluster.saturation_rate * 100).toFixed(0)}%
                        </span>
                        <Progress
                          value={cluster.saturation_rate * 100}
                          className="w-16 h-2"
                          indicatorClassName={
                            cluster.saturation_rate > 0.7
                              ? 'bg-green-600'
                              : cluster.saturation_rate > 0.5
                              ? 'bg-blue-600'
                              : cluster.saturation_rate > 0.3
                              ? 'bg-yellow-600'
                              : 'bg-red-600'
                          }
                        />
                      </div>
                    </td>
                    <td className="text-right py-4 px-4 text-fm-white">
                      {(cluster.avg_confidence * 100).toFixed(0)}%
                    </td>
                    <td className="text-right py-4 px-4 text-fm-white">
                      {cluster.actionable_count || 0}
                    </td>
                    <td className="text-center py-4 px-4">
                      <Badge className={getHealthStatusColor(cluster.health_status)}>
                        <span className="mr-1">{getHealthStatusIcon(cluster.health_status)}</span>
                        {cluster.health_status?.replace('_', ' ') || 'UNKNOWN'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {clusterEntries.length === 0 && (
            <div className="text-center py-8 text-fm-muted">
              No cluster data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
