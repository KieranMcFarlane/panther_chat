'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, TrendingDown } from 'lucide-react';

interface LifecycleFunnelProps {
  data?: any;
}

export default function LifecycleFunnel({ data }: LifecycleFunnelProps) {
  const funnel = data?.funnel || {};
  const summary = data?.summary || {};
  const insights = data?.insights || [];

  const funnelEntries = Object.entries(funnel);

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'EXPLORATORY':
        return 'bg-gray-600 border-gray-500';
      case 'INFORMED':
        return 'bg-fm-blue border-blue-500';
      case 'CONFIDENT':
        return 'bg-fm-green border-green-500';
      case 'ACTIONABLE':
        return 'bg-fm-yellow border-yellow-500';
      default:
        return 'bg-gray-600 border-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="bg-custom-box border-custom-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-fm-muted">Total Tracked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-fm-white">
              {summary.total_entities_tracked?.toLocaleString() || 'N/A'}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-custom-box border-custom-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-fm-muted">Final Actionable</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-fm-yellow">
              {summary.final_actionable_entities?.toLocaleString() || 'N/A'}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-custom-box border-custom-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-fm-muted">Overall Conversion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-fm-green">
              {((summary.overall_conversion_rate || 0) * 100).toFixed(1)}%
            </div>
          </CardContent>
        </Card>

        <Card className="bg-custom-box border-custom-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-fm-muted">Avg Iterations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-fm-blue">
              {summary.avg_iterations_to_actionable?.toFixed(1) || 'N/A'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Funnel Visualization */}
      <Card className="bg-custom-box border-custom-border">
        <CardHeader>
          <CardTitle className="text-fm-white">Conversion Funnel</CardTitle>
          <CardDescription className="text-fm-muted">
            Entity progression through confidence bands
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {funnelEntries.map(([transition, data]: [string, any]) => (
              <div key={transition} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge className={getStageColor(data.from_band)}>
                      {data.from_band}
                    </Badge>
                    <span className="text-fm-muted">→</span>
                    <Badge className={getStageColor(data.to_band)}>
                      {data.to_band}
                    </Badge>
                    {data.bottleneck && (
                      <AlertTriangle className="h-4 w-4 text-fm-yellow" />
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-fm-white">
                      {data.converted} / {data.entities}
                    </span>
                    <Badge
                      className={
                        data.conversion_rate > 0.5
                          ? 'bg-green-600 text-white'
                          : data.conversion_rate > 0.3
                          ? 'bg-blue-600 text-white'
                          : 'bg-red-600 text-white'
                      }
                    >
                      {(data.conversion_rate * 100).toFixed(1)}%
                    </Badge>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="relative h-8 bg-custom-border rounded overflow-hidden">
                  <div
                    className={`absolute h-full ${getStageColor(data.from_band).split(' ')[0]}`}
                    style={{ width: '100%', opacity: 0.3 }}
                  />
                  <div
                    className={`absolute h-full ${getStageColor(data.to_band).split(' ')[0]}`}
                    style={{ left: '0', width: `${data.conversion_rate * 100}%` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-medium text-white drop-shadow-lg">
                      {data.drop_off} drop off
                    </span>
                  </div>
                </div>

                {data.bottleneck && (
                  <div className="flex items-start gap-2 text-sm text-fm-yellow bg-fm-yellow/10 p-2 rounded">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{data.recommendation}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {funnelEntries.length === 0 && (
            <div className="text-center py-8 text-fm-muted">
              No funnel data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Insights Panel */}
      {insights.length > 0 && (
        <Card className="bg-custom-box border-custom-border">
          <CardHeader>
            <CardTitle className="text-fm-white flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-fm-blue" />
              Funnel Insights
            </CardTitle>
            <CardDescription className="text-fm-muted">
              Key findings and recommendations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {insights.map((insight: string, idx: number) => (
                <li key={idx} className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-fm-green mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-fm-white">{insight}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Biggest Bottleneck Alert */}
      {summary.biggest_bottleneck && summary.biggest_bottleneck !== 'None' && (
        <Card className="bg-fm-yellow/10 border-fm-yellow">
          <CardHeader>
            <CardTitle className="text-fm-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-fm-yellow" />
              Biggest Bottleneck
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-fm-white">{summary.biggest_bottleneck}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
